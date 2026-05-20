const fs = require('fs')
const path = require('path')
const { execFile } = require('child_process')

// Tool registry — owns schemas and dispatch for all built-in (and later MCP) tools.
//
// A tool definition looks like:
//   {
//     schema: { type: 'function', function: { name, description, parameters } },
//     execute: async (args, ctx) => any
//   }
//
// `ctx` is provided per-call by the streaming loop in main.js and carries:
//   - conversationId, projectId — for tools that need to scope themselves
//   - sender — the BrowserWindow webContents, for tools that want to emit progress

function resolveSafe(projectDir, relPath) {
  if (!projectDir) throw new Error('No project directory configured. Set one via right-click → Set Directory on the project in the sidebar.')
  const base = path.resolve(projectDir)
  const resolved = path.resolve(base, relPath)
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error(`Path "${relPath}" is outside the project directory.`)
  }
  return resolved
}

function git(args, cwd) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error((stderr || err.message).trim()))
      else resolve(stdout)
    })
  })
}

const ALWAYS_TOOLS = {
  get_current_time: {
    schema: {
      type: 'function',
      function: {
        name: 'get_current_time',
        description: 'Returns the current date and time on the user\'s machine, already converted to their local timezone. Use the `local` field directly when telling the user the time — it is pre-formatted.',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
    },
    execute: async () => {
      const now = new Date()
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const local = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short',
      }).format(now)
      return {
        local,
        iso_utc: now.toISOString(),
        timezone,
      }
    },
  },
}

const PROJECT_TOOLS = {
  read_file: {
    schema: {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read the full text content of a file within the project directory. Always use relative paths (e.g. "src/App.jsx" or "electron/main.js").',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file, relative to the project root.',
            },
          },
          required: ['path'],
        },
      },
    },
    execute: async ({ path: relPath }, ctx) => {
      const fullPath = resolveSafe(ctx.projectDir, relPath)
      if (!fs.existsSync(fullPath)) throw new Error(`File not found: ${relPath}`)
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) throw new Error(`"${relPath}" is a directory, not a file.`)
      const raw = fs.readFileSync(fullPath, 'utf8')
      const MAX_READ_CHARS = 20000
      const truncated = raw.length > MAX_READ_CHARS
      const content = truncated
        ? raw.slice(0, MAX_READ_CHARS) + `\n\n[...truncated — file is ${stat.size} bytes total, showing first 20 KB. Use a byte offset or read a specific section if you need more.]`
        : raw
      return {
        path: relPath,
        content,
        size_bytes: stat.size,
        lines: raw.split('\n').length,
        truncated,
      }
    },
  },

  write_file: {
    schema: {
      type: 'function',
      function: {
        name: 'write_file',
        description: 'Write or overwrite a file within the project directory. Creates any missing parent directories. Always use relative paths.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file, relative to the project root.',
            },
            content: {
              type: 'string',
              description: 'The complete text content to write. This replaces the file entirely.',
            },
          },
          required: ['path', 'content'],
        },
      },
    },
    execute: async ({ path: relPath, content }, ctx) => {
      const fullPath = resolveSafe(ctx.projectDir, relPath)
      fs.mkdirSync(path.dirname(fullPath), { recursive: true })
      fs.writeFileSync(fullPath, content, 'utf8')
      return {
        path: relPath,
        size_bytes: Buffer.byteLength(content, 'utf8'),
        written: true,
      }
    },
  },

  list_directory: {
    schema: {
      type: 'function',
      function: {
        name: 'list_directory',
        description: 'List the files and subdirectories within the project directory. Omit path to list the project root. Never lists node_modules, .git, dist, or other build artifacts.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Subdirectory to list, relative to project root. Omit to list the root.',
            },
            recursive: {
              type: 'boolean',
              description: 'List all descendants recursively. Defaults to false.',
            },
          },
        },
      },
    },
    execute: async ({ path: relPath = '.', recursive = false }, ctx) => {
      const IGNORED = new Set([
        'node_modules', '.git', 'dist', 'dist-electron', 'build',
        'data', '.venv', '__pycache__', '.cache', 'coverage', 'out',
      ])
      const fullPath = resolveSafe(ctx.projectDir, relPath)
      if (!fs.existsSync(fullPath)) throw new Error(`Directory not found: ${relPath}`)
      if (!fs.statSync(fullPath).isDirectory()) throw new Error(`"${relPath}" is a file, not a directory.`)

      function readDir(dir, prefix) {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        const results = []
        for (const entry of entries) {
          if (IGNORED.has(entry.name)) continue
          const entryRel = prefix ? `${prefix}/${entry.name}` : entry.name
          if (entry.isDirectory()) {
            results.push({ name: entry.name, path: entryRel, type: 'directory' })
            if (recursive) results.push(...readDir(path.join(dir, entry.name), entryRel))
          } else {
            const size = fs.statSync(path.join(dir, entry.name)).size
            results.push({ name: entry.name, path: entryRel, type: 'file', size_bytes: size })
          }
        }
        return results
      }

      const prefix = relPath === '.' ? '' : relPath
      return { path: relPath, entries: readDir(fullPath, prefix) }
    },
  },

  create_directory: {
    schema: {
      type: 'function',
      function: {
        name: 'create_directory',
        description: 'Create a directory (and any missing parent directories) within the project. Use relative paths.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path of the directory to create, relative to the project root.',
            },
          },
          required: ['path'],
        },
      },
    },
    execute: async ({ path: relPath }, ctx) => {
      const fullPath = resolveSafe(ctx.projectDir, relPath)
      fs.mkdirSync(fullPath, { recursive: true })
      return { path: relPath, created: true }
    },
  },

  git_status: {
    schema: {
      type: 'function',
      function: {
        name: 'git_status',
        description: 'Show the current git working tree status, including which files are modified, staged, or untracked.',
        parameters: { type: 'object', properties: {} },
      },
    },
    execute: async (_, ctx) => {
      if (!ctx.projectDir) throw new Error('No project directory configured.')
      const output = await git(['status', '--short', '--branch'], ctx.projectDir)
      return { output: output.trim() || '(nothing to report)' }
    },
  },

  git_diff: {
    schema: {
      type: 'function',
      function: {
        name: 'git_diff',
        description: 'Show changes in the working tree. Use staged: true to see what is already staged for commit.',
        parameters: {
          type: 'object',
          properties: {
            staged: {
              type: 'boolean',
              description: 'If true, shows staged (--cached) diff. If false (default), shows unstaged changes.',
            },
            path: {
              type: 'string',
              description: 'Limit the diff to a specific file (relative path). Optional.',
            },
          },
        },
      },
    },
    execute: async ({ staged = false, path: relPath } = {}, ctx) => {
      if (!ctx.projectDir) throw new Error('No project directory configured.')
      const args = ['diff']
      if (staged) args.push('--cached')
      if (relPath) args.push('--', relPath)
      const output = await git(args, ctx.projectDir)
      return { output: output.trim() || '(no changes)' }
    },
  },

  git_add: {
    schema: {
      type: 'function',
      function: {
        name: 'git_add',
        description: 'Stage files for the next commit. Pass ["."] to stage all changes in the project.',
        parameters: {
          type: 'object',
          properties: {
            paths: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of relative file paths to stage, or ["."] to stage everything.',
            },
          },
          required: ['paths'],
        },
      },
    },
    execute: async ({ paths }, ctx) => {
      if (!ctx.projectDir) throw new Error('No project directory configured.')
      for (const p of paths) {
        if (p !== '.') resolveSafe(ctx.projectDir, p)
      }
      await git(['add', ...paths], ctx.projectDir)
      const status = await git(['status', '--short'], ctx.projectDir)
      return { staged: paths, status: status.trim() }
    },
  },

  git_commit: {
    schema: {
      type: 'function',
      function: {
        name: 'git_commit',
        description: 'Create a git commit with the provided message. Stage files with git_add first.',
        parameters: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'The commit message. Use conventional commit format when appropriate (feat:, fix:, chore:, etc.).',
            },
          },
          required: ['message'],
        },
      },
    },
    execute: async ({ message }, ctx) => {
      if (!ctx.projectDir) throw new Error('No project directory configured.')
      const output = await git(['commit', '-m', message], ctx.projectDir)
      return { output: output.trim() }
    },
  },

  git_push: {
    schema: {
      type: 'function',
      function: {
        name: 'git_push',
        description: 'Push committed changes to the remote repository. Assumes git authentication (SSH key or credential manager) is already configured on the machine.',
        parameters: {
          type: 'object',
          properties: {
            remote: {
              type: 'string',
              description: 'Remote name. Defaults to "origin".',
            },
            branch: {
              type: 'string',
              description: 'Branch to push. Defaults to current branch.',
            },
          },
        },
      },
    },
    execute: async ({ remote = 'origin', branch } = {}, ctx) => {
      if (!ctx.projectDir) throw new Error('No project directory configured.')
      const args = ['push', remote]
      if (branch) args.push(branch)
      const output = await git(args, ctx.projectDir)
      return { output: output.trim() || 'Push successful.' }
    },
  },
}

function listSchemas(ctx = {}) {
  const tools = { ...ALWAYS_TOOLS }
  if (ctx.projectDir) Object.assign(tools, PROJECT_TOOLS)
  return Object.values(tools).map(t => t.schema)
}

async function execute(name, args, ctx = {}) {
  const tool = ALWAYS_TOOLS[name] ?? PROJECT_TOOLS[name]
  if (!tool) throw new Error(`Unknown tool: ${name}`)
  return await tool.execute(args ?? {}, ctx)
}

module.exports = { listSchemas, execute }
