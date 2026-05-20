const fs = require('fs')
const path = require('path')

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

const BUILTIN_TOOLS = {
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
      const content = fs.readFileSync(fullPath, 'utf8')
      return {
        path: relPath,
        content,
        size_bytes: stat.size,
        lines: content.split('\n').length,
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
}

function listSchemas(_ctx = {}) {
  // Future phases (code, web, MCP) will filter by ctx (e.g., only register code tools
  // when ctx.projectId points at a folder-mode project). For Phase 1, always return all.
  return Object.values(BUILTIN_TOOLS).map(t => t.schema)
}

async function execute(name, args, ctx = {}) {
  const tool = BUILTIN_TOOLS[name]
  if (!tool) throw new Error(`Unknown tool: ${name}`)
  return await tool.execute(args ?? {}, ctx)
}

module.exports = { listSchemas, execute }
