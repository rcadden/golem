const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const http = require('http')
const https = require('https')
const { execFile, spawn } = require('child_process')
const fs = require('fs')
const db = require('./db')
const tools = require('./tools/registry')
const mcpManager = require('./mcp/client')
const { isOllamaInstalled, downloadAndInstall, waitForOllama } = require('./ollama-installer')
const { autoUpdater } = require('electron-updater')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow
let activeStreamController = null

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow() {
  const w = parseInt(db.getSetting('window_width',  '1200'))
  const h = parseInt(db.getSetting('window_height', '800'))

  const isMac = process.platform === 'darwin'

  mainWindow = new BrowserWindow({
    width: w,
    height: h,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#121212',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    frame: isMac ? true : false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '..', 'public', 'icon.png'),
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.on('resize', () => {
    const [width, height] = mainWindow.getSize()
    db.setSetting('window_width',  String(width))
    db.setSetting('window_height', String(height))
  })

  mainWindow.on('maximize',   () => mainWindow.webContents.send('window:maximizeChange', true))
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximizeChange', false))
}

// ── Auto-update ───────────────────────────────────────────────────────────────
// Only active in packaged builds — never in dev (would throw on missing feed).
function setupAutoUpdater() {
  if (isDev) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', info => {
    mainWindow?.webContents.send('updater:available', { version: info.version })
  })

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('updater:downloaded')
  })

  autoUpdater.on('error', err => {
    // Silent in production — update failures shouldn't interrupt the user
    console.error('[updater]', err?.message ?? err)
  })

  autoUpdater.checkForUpdates().catch(() => {})
}

ipcMain.on('updater:install', () => {
  autoUpdater.quitAndInstall(false, true)
})

app.whenReady().then(async () => {
  await db.init()
  createWindow()
  setupAutoUpdater()
  // Connect all enabled MCP servers in the background — don't block startup.
  const servers = db.listMcpServers()
  if (servers.length > 0) {
    mcpManager.connectAll(servers).catch(() => {})
  }
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

// ── DB handlers ───────────────────────────────────────────────────────────────

ipcMain.handle('db:listConversations',  ()                        => db.listConversations())
ipcMain.handle('db:getConversation',    (_, id)                   => db.getConversation(id))
ipcMain.handle('db:createConversation', (_, title, model, sigilId, projectId, skillId) => db.createConversation(title, model, sigilId, projectId, skillId))
ipcMain.handle('db:renameConversation', (_, id, title)            => db.renameConversation(id, title))
ipcMain.handle('db:deleteConversation', (_, id)                   => db.deleteConversation(id))
ipcMain.handle('db:pinConversation',         (_, id)                    => db.pinConversation(id))
ipcMain.handle('db:unpinConversation',       (_, id)                    => db.unpinConversation(id))
ipcMain.handle('db:setConversationParams',   (_, id, params)            => db.setConversationParams(id, params))
ipcMain.handle('db:getMessages',        (_, convId)               => db.getMessages(convId))
ipcMain.handle('db:addMessage',         (_, convId, role, content) => db.addMessage(convId, role, content))
ipcMain.handle('db:updateMessage',      (_, id, content)          => db.updateMessage(id, content))
ipcMain.handle('db:deleteMessage',      (_, id)                   => db.deleteMessage(id))
ipcMain.handle('db:getSetting',         (_, key, fb)              => db.getSetting(key, fb))
ipcMain.handle('db:setSetting',         (_, key, val)             => db.setSetting(key, val))
ipcMain.handle('db:getDraft',           (_, convId)               => db.getDraft(convId))
ipcMain.handle('db:saveDraft',          (_, convId, text)         => db.saveDraft(convId, text))

ipcMain.handle('db:listSigils',   ()                       => db.listSigils())
ipcMain.handle('db:createSigil',  (_, name, content)       => db.createSigil(name, content))
ipcMain.handle('db:updateSigil',  (_, id, name, content)   => db.updateSigil(id, name, content))
ipcMain.handle('db:deleteSigil',  (_, id)                  => db.deleteSigil(id))

ipcMain.handle('db:listSkills',   ()                                          => db.listSkills())
ipcMain.handle('db:getSkill',     (_, id)                                     => db.getSkill(id))
ipcMain.handle('db:createSkill',  (_, name, category, sysPrompt, starter)    => db.createSkill(name, category, sysPrompt, starter))
ipcMain.handle('db:updateSkill',  (_, id, name, category, sysPrompt, starter) => db.updateSkill(id, name, category, sysPrompt, starter))
ipcMain.handle('db:deleteSkill',  (_, id)                                     => db.deleteSkill(id))

ipcMain.handle('db:listProjects',              ()                         => db.listProjects())
ipcMain.handle('db:createProject',            (_, name)                  => db.createProject(name))
ipcMain.handle('db:renameProject',            (_, id, name)              => db.renameProject(id, name))
ipcMain.handle('db:deleteProject',            (_, id)                    => db.deleteProject(id))
ipcMain.handle('db:setProjectDirectory',      (_, id, dirPath)           => db.setProjectDirectory(id, dirPath))
ipcMain.handle('db:setProjectNumCtx',         (_, id, numCtx)            => db.setProjectNumCtx(id, numCtx))
ipcMain.handle('db:listProjectConversations', (_, projectId)             => db.listProjectConversations(projectId))
ipcMain.handle('db:listProjectFiles',         (_, projectId)             => db.listProjectFiles(projectId))
ipcMain.handle('db:addProjectFile',           (_, projectId, name, content) => db.addProjectFile(projectId, name, content))
ipcMain.handle('db:removeProjectFile',        (_, id)                    => db.removeProjectFile(id))

ipcMain.handle('db:searchMessages', (_, query) => db.searchMessages(query))

ipcMain.handle('memory:load',     ()                   => db.loadMemory())
ipcMain.handle('memory:save',     (_, content)         => db.saveMemory(content))

ipcMain.handle('memory:getPath', () => {
  const custom = db.getSetting('memory_path', '')
  return custom && custom.trim() ? custom.trim() : null
})

ipcMain.handle('memory:setPath', (_, filePath) => {
  db.setSetting('memory_path', filePath || '')
})

ipcMain.handle('memory:browsePath', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Memory File',
    properties: ['openFile'],
    filters: [
      { name: 'Text & Markdown', extensions: ['txt', 'md'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })
  if (result.canceled || !result.filePaths.length) return null
  return result.filePaths[0]
})

ipcMain.handle('dialog:saveFile', async (_, { defaultName, content }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  })
  if (result.canceled || !result.filePath) return false
  fs.writeFileSync(result.filePath, content, 'utf8')
  return true
})

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Text & Code', extensions: ['txt', 'md', 'js', 'ts', 'jsx', 'tsx', 'py', 'json', 'css', 'html', 'xml', 'csv', 'log', 'yaml', 'yml', 'toml', 'sh', 'bat'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })
  if (result.canceled || !result.filePaths.length) return null
  const filePath = result.filePaths[0]
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    return { name: path.basename(filePath), content }
  } catch (e) {
    return { name: path.basename(filePath), content: null, error: e.message }
  }
})

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  })
  if (result.canceled || !result.filePaths.length) return null
  return result.filePaths[0]
})

ipcMain.handle('project:syncDirectory', async (_, projectId, dirPath) => {
  const IGNORED_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', '.next', 'out', '.cache',
    'coverage', '__pycache__', '.venv', 'venv', '.idea', '.vscode',
  ])
  const ALLOWED_EXTS = new Set([
    '.txt', '.md', '.js', '.ts', '.jsx', '.tsx', '.py', '.json',
    '.css', '.html', '.xml', '.yaml', '.yml', '.toml', '.sh', '.bat',
    '.gitignore', '.env.example', '.sql', '.graphql', '.vue', '.svelte',
  ])
  const MAX_FILE_BYTES = 50 * 1024
  const MAX_TOTAL_BYTES = 256 * 1024

  let totalBytes = 0
  const collected = []
  const skipped = []

  function walk(dir) {
    let entries
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) walk(path.join(dir, entry.name))
      } else if (entry.isFile()) {
        const fullPath = path.join(dir, entry.name)
        const ext = path.extname(entry.name).toLowerCase()
        if (!ALLOWED_EXTS.has(ext)) { skipped.push(entry.name); continue }
        let size
        try { size = fs.statSync(fullPath).size } catch { skipped.push(entry.name); continue }
        if (size > MAX_FILE_BYTES) { skipped.push(entry.name); continue }
        if (totalBytes + size > MAX_TOTAL_BYTES) { skipped.push(entry.name); continue }
        let content
        try { content = fs.readFileSync(fullPath, 'utf8') } catch { skipped.push(entry.name); continue }
        const relPath = path.relative(dirPath, fullPath).replace(/\\/g, '/')
        collected.push({ name: relPath, content })
        totalBytes += size
      }
    }
  }

  walk(dirPath)

  db.clearProjectFiles(projectId)
  for (const f of collected) db.addProjectFile(projectId, f.name, f.content)
  db.setProjectDirectory(projectId, dirPath)

  return { added: collected.length, skipped: skipped.length }
})

// ── Ollama helpers ────────────────────────────────────────────────────────────

const OLLAMA_BASE = 'http://localhost:11434'

function ollamaGet(path) {
  return new Promise((resolve, reject) => {
    http.get(`${OLLAMA_BASE}${path}`, { timeout: 3000 }, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch { resolve(null) }
      })
    }).on('error', reject).on('timeout', () => reject(new Error('timeout')))
  })
}

function ollamaPost(path, body, { timeout = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body)
    const req = http.request(`${OLLAMA_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) },
      timeout,
    }, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch { resolve(null) }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(new Error('timeout')) })
    req.write(bodyStr)
    req.end()
  })
}

// ── Tool-calling capability ───────────────────────────────────────────────────
// Ollama doesn't advertise tool support per model, so we maintain an allowlist
// of known-good families and probe unknown models once, caching the result.

const TOOL_CAPABLE_PATTERNS = [
  /^llama3\.[1-9]/i, /^llama4/i,
  /^qwen2\.5/i, /^qwen3/i,
  /^mistral-nemo/i, /^mistral-small/i, /^mistral-large/i,
  /^command-r/i,
  /^firefunction/i,
  /^granite3/i,
  /^gemma4/i,
]

function modelNameMatchesAllowlist(model) {
  const stem = model.split(':')[0]
  return TOOL_CAPABLE_PATTERNS.some(rx => rx.test(stem))
}

async function probeToolCapability(model) {
  try {
    const response = await ollamaPost('/api/chat', {
      model,
      messages: [{ role: 'user', content: 'Call test_tool with the argument x set to 1. Do not respond with any text.' }],
      tools: [{
        type: 'function',
        function: {
          name: 'test_tool',
          description: 'A test tool. Call this with x=1.',
          parameters: {
            type: 'object',
            properties: { x: { type: 'number' } },
            required: ['x'],
          },
        },
      }],
      stream: false,
      options: { temperature: 0 },
    }, { timeout: 60000 })
    return Array.isArray(response?.message?.tool_calls) && response.message.tool_calls.length > 0
  } catch {
    return false
  }
}

async function getToolCapability(model) {
  const cached = db.getSetting(`tool_capable_${model}`, '')
  if (cached === 'true') return true
  if (cached === 'false') return false
  // Unknown — try the allowlist first (fast path, no network probe needed)
  if (modelNameMatchesAllowlist(model)) {
    db.setSetting(`tool_capable_${model}`, 'true')
    return true
  }
  // Fall back to a live probe and cache the result
  const result = await probeToolCapability(model)
  db.setSetting(`tool_capable_${model}`, result ? 'true' : 'false')
  return result
}

ipcMain.handle('ollama:testToolCapability', async (_, model) => {
  // Force a fresh probe regardless of cache
  const result = await probeToolCapability(model)
  db.setSetting(`tool_capable_${model}`, result ? 'true' : 'false')
  return result
})

ipcMain.handle('ollama:getToolCapability', async (_, model) => {
  const cached = db.getSetting(`tool_capable_${model}`, '')
  if (cached === 'true') return true
  if (cached === 'false') return false
  if (modelNameMatchesAllowlist(model)) {
    db.setSetting(`tool_capable_${model}`, 'true')
    return true
  }
  return null // unknown — not yet probed
})

async function isOllamaReady() {
  try { await ollamaGet('/api/tags'); return true } catch { return false }
}

function findOllamaExe() {
  const candidates = [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Ollama', 'ollama.exe'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Ollama', 'ollama.exe'),
  ].filter(Boolean)
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return 'ollama'
}

// ── Ollama IPC ────────────────────────────────────────────────────────────────

ipcMain.handle('ollama:isInstalled', () => isOllamaInstalled())

ipcMain.handle('ollama:install', async () => {
  await downloadAndInstall(mainWindow)
})

ipcMain.handle('ollama:waitForReady', async () => {
  return waitForOllama(60000)
})

ipcMain.handle('ollama:ensureRunning', async () => {
  if (await isOllamaReady()) return true
  const exe = findOllamaExe()
  spawn(exe, [], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 500))
    if (await isOllamaReady()) return true
  }
  return false
})

ipcMain.handle('ollama:listModels', async () => {
  try {
    const data = await ollamaGet('/api/tags')
    return (data?.models || []).map(m => m.name).sort()
  } catch { return [] }
})

ipcMain.handle('ollama:deleteModel', async (_, name) => {
  return ollamaPost('/api/delete', { name })
})

ipcMain.handle('ollama:pullModel', async (event, name) => {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify({ name, stream: true })
    const req = http.request(`${OLLAMA_BASE}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) },
    }, (res) => {
      let buf = ''
      res.on('data', chunk => {
        buf += chunk
        const lines = buf.split('\n')
        buf = lines.pop()
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const data = JSON.parse(line)
            event.sender.send('ollama:pullProgress', data)
          } catch {}
        }
      })
      res.on('end', () => resolve({ ok: true }))
    })
    req.on('error', reject)
    req.write(bodyStr)
    req.end()
  })
})

ipcMain.handle('db:getTelemetrySummary', () => db.getTelemetrySummary())

const MAX_TOOL_ITERATIONS = 4

// One round-trip to Ollama. Streams content chunks via 'ollama:chunk' and resolves
// with { content, toolCalls, promptTokens, completionTokens, ttftMs }.
function streamOnce({ event, model, messages, toolSchemas, controller, streamStart, ttftRef, numCtx = 16384, temperature = 0.7 }) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model,
      messages,
      stream: true,
      ...(toolSchemas?.length ? { tools: toolSchemas } : {}),
      options: { temperature, num_ctx: numCtx },
    })

    let accumulatedContent = ''
    let accumulatedToolCalls = []
    let promptTokens = 0
    let completionTokens = 0
    let done = false

    const req = http.request(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let buf = ''
      res.on('data', chunk => {
        if (controller.abort) { res.destroy(); return }
        buf += chunk
        const lines = buf.split('\n')
        buf = lines.pop()
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const parsed = JSON.parse(line)
            const content = parsed?.message?.content
            if (content) {
              if (!ttftRef.value) ttftRef.value = Date.now() - streamStart
              accumulatedContent += content
              event.sender.send('ollama:chunk', content)
            }
            const calls = parsed?.message?.tool_calls
            if (Array.isArray(calls) && calls.length > 0) {
              accumulatedToolCalls.push(...calls)
            }
            if (parsed?.done) {
              done = true
              promptTokens = parsed.prompt_eval_count || 0
              completionTokens = parsed.eval_count || 0
            }
          } catch {}
        }
      })
      res.on('end', () => {
        if (controller.abort) return resolve({ aborted: true })
        resolve({
          content: accumulatedContent,
          toolCalls: accumulatedToolCalls,
          promptTokens,
          completionTokens,
        })
      })
      res.on('error', err => reject(err))
    })
    req.on('error', err => reject(err))
    req.write(body)
    req.end()
  })
}

ipcMain.handle('ollama:startStream', async (event, payload) => {
  if (activeStreamController) activeStreamController.abort = true
  const controller = { abort: false }
  activeStreamController = controller

  const project = payload.projectId ? db.getProject(payload.projectId) : null
  const conversation = payload.conversationId ? db.getConversation(payload.conversationId) : null
  const numCtx = conversation?.num_ctx ?? project?.num_ctx ?? parseInt(db.getSetting('num_ctx', '8192'))
  const temperature = conversation?.temperature ?? 0.7
  const projectDir = project?.directory_path ?? null
  const memory = db.loadMemory()
  let basePrompt = "You are a helpful assistant running locally on the user's machine via Ollama.\nRespond directly and concisely."
  if (payload.sigilId) {
    const sigil = db.getSigil(payload.sigilId)
    if (sigil?.content) basePrompt = sigil.content
  } else if (payload.skillId) {
    const skill = db.getSkill(payload.skillId)
    if (skill?.system_prompt) basePrompt = skill.system_prompt
  }

  const parts = [basePrompt]
  if (memory) parts.push(`User context:\n${memory}`)
  if (payload.projectId && !projectDir) {
    // Only inject synced files when no live directory is set.
    // When a directory is active, the model uses read_file / list_directory on demand.
    const files = db.listProjectFiles(payload.projectId)
    if (files.length > 0) {
      const fileContext = files.map(f => `<file name="${f.name}">\n${f.content}\n</file>`).join('\n\n')
      parts.push(`Project files (always available for reference):\n${fileContext}`)
    }
  }
  if (projectDir) {
    parts.push(
      `You have access to filesystem and git tools for the project at: ${projectDir}\n\n` +
      `IMPORTANT — always follow this order:\n` +
      `1. Use list_directory to understand the project structure before making suggestions.\n` +
      `2. Use read_file to read any file before editing or referencing it — never assume file contents.\n` +
      `3. Use write_file only after reading the current file first.\n` +
      `4. Use git_status before committing. Use git_add then git_commit in sequence.\n` +
      `Never create files or directories that do not fit the existing project structure.\n` +
      `Never hallucinate file paths — always verify with list_directory first.`
    )
  }
  const systemPrompt = parts.join('\n\n')

  // Tool capability — auto-detected per model
  const toolsEnabled = await getToolCapability(payload.model)
  const activeSkill = payload.skillId ? db.getSkill(payload.skillId) : null

  // MCP tools — filter to project associations when applicable (Phase 3)
  let mcpTools = null
  if (toolsEnabled) {
    if (payload.projectId) {
      const projectServers = db.getProjectMcpServers(payload.projectId)
      if (projectServers.length > 0) {
        const allowed = new Set(projectServers.map(s => s.id))
        mcpTools = mcpManager.getTools(allowed)
      } else {
        // No specific associations → expose all connected servers
        mcpTools = mcpManager.getTools()
      }
    } else {
      mcpTools = mcpManager.getTools()
    }
  }

  const ctx = {
    conversationId: payload.conversationId ?? null,
    projectId: payload.projectId ?? null,
    projectDir,
    sender: event.sender,
    skillId: payload.skillId ?? null,
    skillCategory: activeSkill?.category ?? null,
    db,
    mcpTools,
    mcpManager,
  }
  const toolSchemas = toolsEnabled ? tools.listSchemas(ctx) : []

  // Working message array — starts with system + history, grows with assistant/tool turns
  const messages = [{ role: 'system', content: systemPrompt }, ...payload.messages]

  const streamStart = Date.now()
  const ttftRef = { value: 0 }
  let totalPromptTokens = 0
  let totalCompletionTokens = 0

  try {
    for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
      const result = await streamOnce({
        event, model: payload.model, messages,
        toolSchemas, controller, streamStart, ttftRef,
        numCtx, temperature,
      })

      if (result.aborted) {
        event.sender.send('ollama:streamEnd', null)
        return { ok: true, aborted: true }
      }

      totalPromptTokens += result.promptTokens
      totalCompletionTokens += result.completionTokens

      // Persist the assistant turn (content + any tool_calls)
      if (payload.conversationId && (result.content || result.toolCalls.length > 0)) {
        db.addMessage(payload.conversationId, 'assistant', result.content, {
          toolCalls: result.toolCalls.length > 0 ? result.toolCalls : null,
        })
      }

      // No tool calls → we're done
      if (result.toolCalls.length === 0) break

      // Append the assistant message (with tool_calls) to the working messages array
      // so the next round sees it
      messages.push({
        role: 'assistant',
        content: result.content,
        tool_calls: result.toolCalls,
      })

      // Execute each tool call, emit progress, persist + append the result message
      for (const call of result.toolCalls) {
        if (controller.abort) break
        const callId = call.id || `call_${iter}_${Math.random().toString(36).slice(2, 8)}`
        const name = call.function?.name
        const rawArgs = call.function?.arguments
        let args = rawArgs
        if (typeof rawArgs === 'string') {
          try { args = JSON.parse(rawArgs) } catch { args = {} }
        }

        event.sender.send('ollama:tool_call_start', { id: callId, name, args })

        let resultPayload
        let isError = false
        try {
          resultPayload = await tools.execute(name, args, ctx)
        } catch (err) {
          isError = true
          resultPayload = { error: err.message || String(err) }
        }
        const resultJson = JSON.stringify(resultPayload)

        event.sender.send('ollama:tool_call_result', { id: callId, name, result: resultPayload, isError })

        if (payload.conversationId) {
          db.addMessage(payload.conversationId, 'tool', resultJson, { toolCallId: callId })
        }
        messages.push({ role: 'tool', tool_call_id: callId, content: resultJson })
      }

      if (controller.abort) {
        event.sender.send('ollama:streamEnd', null)
        return { ok: true, aborted: true }
      }

      // If we hit the cap on the next loop test, signal it to the user as an assistant
      // message rather than silently dropping the conversation state
      if (iter === MAX_TOOL_ITERATIONS - 1) {
        const capMsg = '_[Tool-call iteration cap reached. Stopping to avoid runaway loops.]_'
        event.sender.send('ollama:chunk', capMsg)
        event.sender.send('ollama:loopStatus', { reason: 'cap_reached', iterations: MAX_TOOL_ITERATIONS })
        if (payload.conversationId) {
          db.addMessage(payload.conversationId, 'assistant', capMsg)
        }
      }
    }

    db.logTelemetry({
      conversationId: payload.conversationId ?? null,
      model: payload.model,
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      ttftMs: ttftRef.value,
      durationMs: Date.now() - streamStart,
    })

    event.sender.send('ollama:streamStats', {
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      durationMs: Date.now() - streamStart,
      ttftMs: ttftRef.value,
      numCtx,
    })
    event.sender.send('ollama:streamEnd', null)
    return { ok: true }
  } catch (err) {
    event.sender.send('ollama:streamEnd', err.message || String(err))
    return { ok: false, error: err.message || String(err) }
  } finally {
    if (activeStreamController === controller) activeStreamController = null
  }
})

ipcMain.on('ollama:stopStream', () => {
  if (activeStreamController) activeStreamController.abort = true
})

// ── Auto-title ────────────────────────────────────────────────────────────────
// Fire-and-forget from renderer after first exchange. Returns a short title
// or null if the model fails / times out.
ipcMain.handle('ollama:generateTitle', async (_, { model, messages }) => {
  try {
    const result = await ollamaPost('/api/chat', {
      model,
      stream: false,
      options: { temperature: 0.3, num_predict: 20 },
      messages: [
        ...messages,
        {
          role: 'user',
          content: 'Summarize this conversation as a title of 4–6 words. Return only the title — no quotes, no punctuation at the end, no commentary.',
        },
      ],
    }, { timeout: 15000 })
    const title = result?.message?.content?.trim()
    return title && title.length > 0 && title.length < 80 ? title : null
  } catch {
    return null
  }
})

// ── System info ───────────────────────────────────────────────────────────────
const os = require('os')

ipcMain.handle('system:platform', () => process.platform)

ipcMain.handle('system:getHardwareInfo', async () => {
  const cpus = os.cpus()
  const totalMem = os.totalmem()
  const freeMem  = os.freemem()

  // GPU detection — try nvidia-smi first (accurate VRAM), fall back to wmic
  let gpus = []

  // Attempt nvidia-smi for NVIDIA GPUs
  try {
    const nvsmi = await new Promise((resolve, reject) => {
      execFile('nvidia-smi', [
        '--query-gpu=name,memory.total',
        '--format=csv,noheader,nounits',
      ], { encoding: 'utf8', timeout: 5000 }, (err, stdout) => {
        if (err) reject(err)
        else resolve(stdout)
      })
    })
    gpus = nvsmi.split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const idx = line.lastIndexOf(',')
        const name = line.slice(0, idx).trim()
        const vramMb = parseInt(line.slice(idx + 1).trim()) || 0
        return { name, vramBytes: vramMb * 1024 * 1024 }
      })
      .filter(g => g.name)
  } catch {
    // nvidia-smi not available — fall back to wmic
    try {
      const raw = await new Promise((resolve, reject) => {
        execFile('wmic', [
          'path', 'win32_VideoController',
          'get', 'Name,AdapterRAM',
          '/format:csv',
        ], { encoding: 'utf8', timeout: 5000 }, (err, stdout) => {
          if (err) reject(err)
          else resolve(stdout)
        })
      })
      gpus = raw.split('\n')
        .slice(1)
        .map(line => line.trim().split(','))
        .filter(parts => parts.length >= 3 && parts[2])
        .map(parts => ({
          name:      parts[2].trim(),
          vramBytes: parseInt(parts[1]) || 0,
        }))
        .filter(g => g.name && g.name !== 'Name')
    } catch {}
  }

  return {
    cpu:     { model: cpus[0]?.model ?? 'Unknown', cores: cpus.length, speedMhz: cpus[0]?.speed ?? 0 },
    ram:     { totalBytes: totalMem, freeBytes: freeMem },
    gpus,
  }
})

ipcMain.handle('ollama:getRunningModels', async () => {
  try {
    const data = await ollamaGet('/api/ps')
    return data?.models ?? []
  } catch { return [] }
})

ipcMain.handle('ollama:getModelInfo', async (_, modelName) => {
  try {
    return await ollamaPost('/api/show', { name: modelName }, { timeout: 8000 })
  } catch { return null }
})

ipcMain.handle('app:getLoginItemEnabled', () => app.getLoginItemSettings().openAtLogin)
ipcMain.handle('app:setLoginItem', (_, enable) => app.setLoginItemSettings({ openAtLogin: enable, openAsHidden: false }))

// ── MCP ───────────────────────────────────────────────────────────────────────

ipcMain.handle('mcp:listServers', () => db.listMcpServers())

ipcMain.handle('mcp:addServer', async (_, { name, command, argsJson, envJson }) => {
  const id = db.createMcpServer(name.trim(), command.trim(), argsJson || '[]', envJson || '{}')
  const server = db.getMcpServer(id)
  let connectResult = { ok: false, error: 'Not attempted' }
  try {
    const toolList = await mcpManager.connect(server)
    connectResult = { ok: true, toolCount: toolList.length }
  } catch (err) {
    connectResult = { ok: false, error: err.message }
  }
  return { id, ...connectResult }
})

ipcMain.handle('mcp:updateServer', async (_, id, { name, command, argsJson, envJson }) => {
  db.updateMcpServer(id, name.trim(), command.trim(), argsJson || '[]', envJson || '{}')
  const server = db.getMcpServer(id)
  if (server?.enabled) {
    try { await mcpManager.connect(server) } catch {}
  }
})

ipcMain.handle('mcp:removeServer', async (_, id) => {
  await mcpManager.disconnect(id)
  db.deleteMcpServer(id)
})

ipcMain.handle('mcp:setEnabled', async (_, id, enabled) => {
  const server = db.setMcpServerEnabled(id, enabled)
  if (enabled) {
    try { await mcpManager.connect(server) } catch {}
  } else {
    await mcpManager.disconnect(id)
  }
  return server
})

ipcMain.handle('mcp:reconnect', async (_, id) => {
  const server = db.getMcpServer(id)
  if (!server) return { ok: false, error: 'Server not found' }
  try {
    const toolList = await mcpManager.connect(server)
    return { ok: true, toolCount: toolList.length }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('mcp:getStatus',  () => mcpManager.getStatus())
ipcMain.handle('mcp:getErrors',  () => mcpManager.getErrors())

// Phase 3 — per-project MCP associations
ipcMain.handle('mcp:getProjectServers',    (_, projectId)           => db.getProjectMcpServers(projectId))
ipcMain.handle('mcp:addProjectServer',    (_, projectId, serverId)  => { db.addProjectMcpServer(projectId, serverId) })
ipcMain.handle('mcp:removeProjectServer', (_, projectId, serverId)  => { db.removeProjectMcpServer(projectId, serverId) })

ipcMain.on('window:setSize',  (_, w, h) => { if (mainWindow) mainWindow.setSize(w, h) })
ipcMain.on('window:minimize', ()        => mainWindow?.minimize())
ipcMain.on('window:maximize', ()        => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize())
ipcMain.on('window:close',    ()        => mainWindow?.close())
ipcMain.handle('window:isMaximized',    () => mainWindow?.isMaximized() ?? false)
