const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const http = require('http')
const https = require('https')
const { execFile, spawn } = require('child_process')
const fs = require('fs')
const db = require('./db')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow
let activeStreamController = null

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow() {
  const w = parseInt(db.getSetting('window_width',  '1200'))
  const h = parseInt(db.getSetting('window_height', '800'))

  mainWindow = new BrowserWindow({
    width: w,
    height: h,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#121212',
    titleBarStyle: 'hiddenInset',
    frame: false,
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

app.whenReady().then(async () => {
  await db.init()
  createWindow()
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

// ── DB handlers ───────────────────────────────────────────────────────────────

ipcMain.handle('db:listConversations',  ()                        => db.listConversations())
ipcMain.handle('db:getConversation',    (_, id)                   => db.getConversation(id))
ipcMain.handle('db:createConversation', (_, title, model, sigilId, projectId) => db.createConversation(title, model, sigilId, projectId))
ipcMain.handle('db:renameConversation', (_, id, title)            => db.renameConversation(id, title))
ipcMain.handle('db:deleteConversation', (_, id)                   => db.deleteConversation(id))
ipcMain.handle('db:pinConversation',    (_, id)                   => db.pinConversation(id))
ipcMain.handle('db:unpinConversation',  (_, id)                   => db.unpinConversation(id))
ipcMain.handle('db:getMessages',        (_, convId)               => db.getMessages(convId))
ipcMain.handle('db:addMessage',         (_, convId, role, content) => db.addMessage(convId, role, content))
ipcMain.handle('db:updateMessage',      (_, id, content)          => db.updateMessage(id, content))
ipcMain.handle('db:deleteMessage',      (_, id)                   => db.deleteMessage(id))
ipcMain.handle('db:getSetting',         (_, key, fb)              => db.getSetting(key, fb))
ipcMain.handle('db:setSetting',         (_, key, val)             => db.setSetting(key, val))

ipcMain.handle('db:listSigils',   ()                       => db.listSigils())
ipcMain.handle('db:createSigil',  (_, name, content)       => db.createSigil(name, content))
ipcMain.handle('db:updateSigil',  (_, id, name, content)   => db.updateSigil(id, name, content))
ipcMain.handle('db:deleteSigil',  (_, id)                  => db.deleteSigil(id))

ipcMain.handle('db:listProjects',              ()                         => db.listProjects())
ipcMain.handle('db:createProject',            (_, name)                  => db.createProject(name))
ipcMain.handle('db:renameProject',            (_, id, name)              => db.renameProject(id, name))
ipcMain.handle('db:deleteProject',            (_, id)                    => db.deleteProject(id))
ipcMain.handle('db:listProjectConversations', (_, projectId)             => db.listProjectConversations(projectId))
ipcMain.handle('db:listProjectFiles',         (_, projectId)             => db.listProjectFiles(projectId))
ipcMain.handle('db:addProjectFile',           (_, projectId, name, content) => db.addProjectFile(projectId, name, content))
ipcMain.handle('db:removeProjectFile',        (_, id)                    => db.removeProjectFile(id))

ipcMain.handle('memory:load',     ()                   => db.loadMemory())
ipcMain.handle('memory:save',     (_, content)         => db.saveMemory(content))

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

function ollamaPost(path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body)
    const req = http.request(`${OLLAMA_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) },
      timeout: 10000,
    }, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch { resolve(null) }
      })
    })
    req.on('error', reject)
    req.write(bodyStr)
    req.end()
  })
}

async function isOllamaReady() {
  try { await ollamaGet('/api/tags'); return true } catch { return false }
}

function findOllamaExe() {
  const candidates = [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Ollama', 'ollama.exe'),
    'C:\\Program Files\\Ollama\\ollama.exe',
  ].filter(Boolean)
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return 'ollama'
}

// ── Ollama IPC ────────────────────────────────────────────────────────────────

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

ipcMain.handle('ollama:startStream', async (event, payload) => {
  if (activeStreamController) activeStreamController.abort = true
  const controller = { abort: false }
  activeStreamController = controller

  const memory = db.loadMemory()
  let basePrompt = "You are a helpful assistant running locally on the user's machine via Ollama.\nRespond directly and concisely."
  if (payload.sigilId) {
    const sigil = db.getSigil(payload.sigilId)
    if (sigil?.content) basePrompt = sigil.content
  }

  const parts = [basePrompt]
  if (memory) parts.push(`User context:\n${memory}`)
  if (payload.projectId) {
    const files = db.listProjectFiles(payload.projectId)
    if (files.length > 0) {
      const fileContext = files.map(f => `<file name="${f.name}">\n${f.content}\n</file>`).join('\n\n')
      parts.push(`Project files (always available for reference):\n${fileContext}`)
    }
  }
  const systemPrompt = parts.join('\n\n')

  const messages = [{ role: 'system', content: systemPrompt }, ...payload.messages]
  const body = JSON.stringify({ model: payload.model, messages, stream: true, options: { temperature: 0.7, num_ctx: 8192 } })

  return new Promise((resolve, reject) => {
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
            if (content) event.sender.send('ollama:chunk', content)
            if (parsed?.done) event.sender.send('ollama:streamEnd', null)
          } catch {}
        }
      })
      res.on('end', () => resolve({ ok: true }))
      res.on('error', err => { event.sender.send('ollama:streamEnd', err.message); reject(err) })
    })
    req.on('error', err => {
      event.sender.send('ollama:streamEnd', err.message)
      resolve({ ok: false, error: err.message })
    })
    req.write(body)
    req.end()
  })
})

ipcMain.on('ollama:stopStream', () => {
  if (activeStreamController) activeStreamController.abort = true
})

ipcMain.on('window:setSize',  (_, w, h) => { if (mainWindow) mainWindow.setSize(w, h) })
ipcMain.on('window:minimize', ()        => mainWindow?.minimize())
ipcMain.on('window:maximize', ()        => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize())
ipcMain.on('window:close',    ()        => mainWindow?.close())
ipcMain.handle('window:isMaximized',    () => mainWindow?.isMaximized() ?? false)
