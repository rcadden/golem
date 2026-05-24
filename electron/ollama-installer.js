const { spawn } = require('child_process')
const { shell } = require('electron')
const fs = require('fs')
const path = require('path')
const https = require('https')
const os = require('os')
const http = require('http')

async function isOllamaInstalled() {
  if (process.platform === 'win32') {
    const candidates = [
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Ollama', 'ollama.exe'),
      process.env.ProgramFiles  && path.join(process.env.ProgramFiles,  'Ollama', 'ollama.exe'),
    ].filter(Boolean)
    return candidates.some(p => fs.existsSync(p))
  }
  return new Promise(resolve => {
    const proc = spawn('ollama', ['--version'], { stdio: 'ignore' })
    proc.on('error', () => resolve(false))
    proc.on('close', code => resolve(code === 0))
  })
}

// Poll Ollama's HTTP API until it responds, up to maxWaitMs
async function waitForOllama(maxWaitMs = 60000) {
  const interval = 1500
  const attempts = Math.ceil(maxWaitMs / interval)
  for (let i = 0; i < attempts; i++) {
    const ready = await new Promise(resolve => {
      const req = http.get('http://localhost:11434/api/tags', { timeout: 2000 }, () => resolve(true))
      req.on('error', () => resolve(false))
      req.on('timeout', () => { req.destroy(); resolve(false) })
    })
    if (ready) return true
    await new Promise(r => setTimeout(r, interval))
  }
  return false
}

// Windows: download OllamaSetup.exe and run silently
function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    https.get(url, { headers: { 'User-Agent': 'Golem/0.8.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close()
        fs.unlink(dest, () => {})
        return downloadFile(res.headers.location, dest, onProgress).then(resolve).catch(reject)
      }
      const total = parseInt(res.headers['content-length'] || '0', 10)
      let downloaded = 0
      res.on('data', chunk => {
        downloaded += chunk.length
        if (total > 0) onProgress(Math.round((downloaded / total) * 100))
      })
      res.pipe(file)
      file.on('finish', () => file.close(resolve))
    }).on('error', err => {
      fs.unlink(dest, () => {})
      reject(err)
    })
  })
}

async function downloadAndInstall(mainWindow) {
  const send = (event, data) => mainWindow?.webContents.send('ollama:installProgress', { event, ...data })

  if (process.platform === 'win32') {
    const dest = path.join(os.tmpdir(), 'OllamaSetup.exe')
    send('status', { message: 'Downloading Ollama…' })
    try {
      await downloadFile('https://ollama.com/download/OllamaSetup.exe', dest, pct => {
        send('download', { pct })
      })
    } catch (err) {
      send('error', { message: 'Download failed. Check your internet connection.' })
      return
    }

    send('status', { message: 'Installing…' })
    await new Promise((resolve, reject) => {
      const proc = spawn(dest, ['/VERYSILENT', '/NORESTART'], { stdio: 'ignore' })
      proc.on('error', reject)
      proc.on('close', resolve)
    })

    send('status', { message: 'Waiting for Ollama to start…' })
    const ready = await waitForOllama(60000)
    if (ready) {
      send('done', { message: 'Ollama is ready.' })
    } else {
      send('error', { message: 'Ollama installed but did not start. Try restarting Golem.' })
    }
  } else {
    // macOS / Linux: open download page, user installs manually
    shell.openExternal('https://ollama.com/download')
    send('manual', { message: "Ollama download opened in your browser. Install it, then click \"I've installed Ollama\"." })
  }
}

module.exports = { isOllamaInstalled, downloadAndInstall, waitForOllama }
