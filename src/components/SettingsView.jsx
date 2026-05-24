import { useState, useEffect, useRef } from 'react'
import ColorPicker from './ColorPicker'
import { applyAccentColor } from '../utils/accent'

const api = window.golem

// ── Hardware helpers ──────────────────────────────────────────────────────────
function fmtBytes(bytes) {
  if (!bytes) return '0 B'
  const gb = bytes / (1024 ** 3)
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  const mb = bytes / (1024 ** 2)
  return `${mb.toFixed(0)} MB`
}

function HardwareRow({ label, value, sub }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-outline-variant last:border-0">
      <span className="text-label-md text-on-surface-variant">{label}</span>
      <div className="text-right">
        <span className="text-label-md text-on-surface font-medium">{value}</span>
        {sub && <div className="text-[11px] text-on-surface-variant/60 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

// Traffic light: compare model size (bytes) vs free RAM
function modelTrafficLight(sizeBytes, freeBytes, gpuVram) {
  const best = gpuVram > 0 ? Math.max(gpuVram, freeBytes) : freeBytes
  const ratio = sizeBytes / best
  if (ratio < 0.7) return { color: 'rgb(80,200,120)',  bg: 'rgba(80,200,120,0.12)',  label: 'Fits well' }
  if (ratio < 1.0) return { color: 'rgb(234,179,8)',   bg: 'rgba(234,179,8,0.12)',   label: 'Tight fit' }
  return             { color: 'rgb(239,68,68)',   bg: 'rgba(239,68,68,0.12)',   label: 'May be slow' }
}

// ── MCP wizard helpers ────────────────────────────────────────────────────────

// Shell-like command splitter — handles quoted strings
function parseCommandStr(str) {
  const parts = []
  let current = ''
  let inQuote = null
  for (const ch of str.trim()) {
    if (inQuote) {
      if (ch === inQuote) inQuote = null
      else current += ch
    } else if (ch === '"' || ch === "'") {
      inQuote = ch
    } else if (ch === ' ' || ch === '\t') {
      if (current) { parts.push(current); current = '' }
    } else {
      current += ch
    }
  }
  if (current) parts.push(current)
  return { command: parts[0] || '', args: parts.slice(1) }
}

// Popular MCP server templates
const MCP_TEMPLATES = [
  {
    id: 'filesystem',
    name: 'Filesystem',
    icon: 'folder_open',
    description: 'Read & write local files and directories',
    command: 'npx',
    baseArgs: ['-y', '@modelcontextprotocol/server-filesystem'],
    promptArgs: [{ label: 'Directory path', placeholder: 'C:\\Users\\you\\projects', required: true }],
    envKeys: [],
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: 'code_blocks',
    description: 'Repos, pull requests, issues, code search',
    command: 'npx',
    baseArgs: ['-y', '@modelcontextprotocol/server-github'],
    promptArgs: [],
    envKeys: [{ key: 'GITHUB_PERSONAL_ACCESS_TOKEN', label: 'GitHub Personal Access Token', placeholder: 'ghp_...', required: true }],
  },
  {
    id: 'brave-search',
    name: 'Brave Search',
    icon: 'search',
    description: 'Real-time web search via Brave API',
    command: 'npx',
    baseArgs: ['-y', '@modelcontextprotocol/server-brave-search'],
    promptArgs: [],
    envKeys: [{ key: 'BRAVE_API_KEY', label: 'Brave API Key', placeholder: 'BSA...', required: true }],
  },
  {
    id: 'sqlite',
    name: 'SQLite',
    icon: 'database',
    description: 'Query and explore a local SQLite database',
    command: 'npx',
    baseArgs: ['-y', '@modelcontextprotocol/server-sqlite'],
    promptArgs: [{ label: 'Database file path', placeholder: '/path/to/database.sqlite', required: true }],
    envKeys: [],
  },
  {
    id: 'puppeteer',
    name: 'Puppeteer',
    icon: 'web',
    description: 'Browser automation and web scraping',
    command: 'npx',
    baseArgs: ['-y', '@modelcontextprotocol/server-puppeteer'],
    promptArgs: [],
    envKeys: [],
  },
]

const BLANK_WIZARD = {
  template: null,        // null = custom
  name: '',
  commandStr: '',        // custom mode: full command string
  promptArgValues: [],   // template mode: values for each promptArg
  envVars: [],           // [{ key, value }] for both modes
}

export default function SettingsView({
  models,
}) {
  const [defaultModel, setDefaultModel] = useState('')
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [memory, setMemory] = useState('')
  const [launchAtStartup, setLaunchAtStartup] = useState(false)
  const [accentColor, setAccentColor] = useState('#6366f1')
  const [numCtx, setNumCtxState] = useState(16384)
  const [saved, setSaved] = useState(false)
  const [testStatus, setTestStatus] = useState('')

  // Hardware
  const [hwInfo, setHwInfo] = useState(null)
  const [modelSizes, setModelSizes] = useState({}) // modelName → sizeBytes

  // MCP
  const [mcpServers, setMcpServers] = useState([])
  const [mcpStatus, setMcpStatus] = useState({})
  const [mcpErrors, setMcpErrors] = useState({})
  const [mcpWizard, setMcpWizard] = useState(BLANK_WIZARD)
  const [mcpFormOpen, setMcpFormOpen] = useState(false)
  const [mcpConnecting, setMcpConnecting] = useState(null)
  const memoryLoaded = useRef(false)

  useEffect(() => {
    async function load() {
      try {
        const [dm, url, mem, loginEnabled, accent, savedNumCtx] = await Promise.all([
          api.db.getSetting('default_model', models[0] || ''),
          api.db.getSetting('ollama_url', 'http://localhost:11434'),
          api.memory.load(),
          api.application.getLoginItemEnabled(),
          api.db.getSetting('accent_color', '#6366f1'),
          api.db.getSetting('num_ctx', '16384'),
        ])
        setDefaultModel(dm)
        setOllamaUrl(url)
        setMemory(mem)
        memoryLoaded.current = true
        setLaunchAtStartup(loginEnabled)
        setAccentColor(accent)
        setNumCtxState(parseInt(savedNumCtx) || 16384)
      } catch (err) {
        console.error('[Settings] load failed:', err)
      }

      // Hardware
      api.system.getHardwareInfo().then(info => setHwInfo(info)).catch(() => {})

      // MCP
      try {
        const [servers, status, errors] = await Promise.all([
          api.mcp.listServers(),
          api.mcp.getStatus(),
          api.mcp.getErrors(),
        ])
        setMcpServers(servers)
        setMcpStatus(status)
        setMcpErrors(errors)
      } catch (err) {
        console.error('[Settings] MCP load failed:', err)
      }
    }
    load()
  }, [])

  useEffect(() => {
    async function loadModelSizes() {
      const sizes = {}
      for (const m of models) {
        try {
          const info = await api.ollama.getModelInfo(m)
          if (info?.size) sizes[m] = info.size
        } catch {}
      }
      setModelSizes(sizes)
    }
    if (models.length > 0) {
      loadModelSizes()
    }
  }, [models.join(',')])

  async function handleSave() {
    await Promise.all([
      api.db.setSetting('default_model', defaultModel),
      api.db.setSetting('ollama_url', ollamaUrl),
      memoryLoaded.current && api.memory.save(memory),
      api.application.setLoginItem(launchAtStartup),
      api.db.setSetting('accent_color', accentColor),
    ].filter(Boolean))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleTestConnection() {
    setTestStatus('Testing…')
    const ready = await api.ollama.ensureRunning()
    setTestStatus(ready ? '✓ Connected' : '✗ Could not connect')
    setTimeout(() => setTestStatus(''), 3000)
  }

  async function handleNumCtxChange(value) {
    setNumCtxState(value)
    await api.db.setSetting('num_ctx', String(value))
  }

  async function handleMcpAdd() {
    // Build command / argsJson / envJson from wizard state
    let command, argsJson, envJson, name
    name = mcpWizard.name.trim()

    const tmpl = MCP_TEMPLATES.find(t => t.id === mcpWizard.template)
    if (tmpl) {
      command  = tmpl.command
      const allArgs = [...tmpl.baseArgs, ...mcpWizard.promptArgValues.filter(Boolean)]
      argsJson = JSON.stringify(allArgs)
      if (!name) name = tmpl.name
    } else {
      const parsed = parseCommandStr(mcpWizard.commandStr)
      command  = parsed.command
      argsJson = JSON.stringify(parsed.args)
    }

    const envObj = Object.fromEntries(
      mcpWizard.envVars.filter(e => e.key.trim()).map(e => [e.key.trim(), e.value])
    )
    envJson = JSON.stringify(envObj)

    if (!name || !command) return
    setMcpConnecting('new')
    try {
      await api.mcp.addServer({ name, command, argsJson, envJson })
      const [servers, status, errors] = await Promise.all([
        api.mcp.listServers(), api.mcp.getStatus(), api.mcp.getErrors(),
      ])
      setMcpServers(servers)
      setMcpStatus(status)
      setMcpErrors(errors)
      setMcpWizard(BLANK_WIZARD)
      setMcpFormOpen(false)
    } catch (err) {
      console.error('MCP add failed', err)
    } finally {
      setMcpConnecting(null)
    }
  }

  async function handleMcpRemove(id) {
    if (!window.confirm('Remove this MCP server?')) return
    await api.mcp.removeServer(id)
    setMcpServers(prev => prev.filter(s => s.id !== id))
    setMcpStatus(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  async function handleMcpToggle(id, enabled) {
    await api.mcp.setEnabled(id, enabled)
    setMcpServers(prev => prev.map(s => s.id === id ? { ...s, enabled: enabled ? 1 : 0 } : s))
    const [status, errors] = await Promise.all([api.mcp.getStatus(), api.mcp.getErrors()])
    setMcpStatus(status)
    setMcpErrors(errors)
  }

  async function handleMcpReconnect(id) {
    setMcpConnecting(id)
    const result = await api.mcp.reconnect(id)
    const [status, errors] = await Promise.all([api.mcp.getStatus(), api.mcp.getErrors()])
    setMcpStatus(status)
    setMcpErrors(errors)
    setMcpConnecting(null)
  }

  const card = 'bg-surface border border-outline-variant rounded-xl overflow-hidden'
  const cardHeader = 'flex items-center gap-2 px-6 py-4 border-b border-outline-variant'
  const cardBody = 'px-6 py-5'

  return (
    <div className="flex-1 h-full overflow-y-auto bg-background">
      <div className="px-8 py-8 max-w-[800px] mx-auto flex flex-col gap-5">
        <div>
          <h2 className="text-[32px] font-bold text-on-surface" style={{ fontFamily: 'Hanken Grotesk', letterSpacing: '-0.02em' }}>Preferences</h2>
          <p className="text-body-lg text-on-surface-variant mt-1">Manage your local intelligence environment.</p>
        </div>

        {/* Local Connection */}
        <section className={card}>
          <div className={cardHeader}>
            <span className="material-symbols-outlined text-primary text-[20px]">dns</span>
            <h3 className="text-title-md font-medium text-on-surface" style={{ fontFamily: 'Hanken Grotesk' }}>Local Connection</h3>
          </div>
          <div className={cardBody}>
            <label className="block text-label-md text-on-surface-variant mb-2">Ollama Server URL</label>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">link</span>
                <input
                  type="url"
                  value={ollamaUrl}
                  onChange={e => setOllamaUrl(e.target.value)}
                  className="w-full bg-background border border-outline-variant rounded-lg pl-10 pr-4 py-2.5 text-on-surface font-mono text-[13px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>
              <button
                onClick={handleTestConnection}
                className="px-4 py-2.5 bg-surface border border-outline-variant text-on-surface text-label-md rounded-lg hover:bg-surface-container-high transition-colors flex items-center gap-2 shrink-0"
              >
                <span className="material-symbols-outlined text-[18px]">wifi_tethering</span>
                {testStatus || 'Test'}
              </button>
            </div>
          </div>
        </section>

        {/* Default model */}
        <section className={card}>
          <div className={cardHeader}>
            <span className="material-symbols-outlined text-primary text-[20px]">deployed_code</span>
            <h3 className="text-title-md font-medium text-on-surface" style={{ fontFamily: 'Hanken Grotesk' }}>Default Model</h3>
          </div>
          <div className={cardBody}>
            <label className="block text-label-md text-on-surface-variant mb-2">Used for new conversations</label>
            <select
              value={defaultModel}
              onChange={e => setDefaultModel(e.target.value)}
              className="w-full bg-background border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface text-body-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            >
              {models.map(m => <option key={m} value={m}>{m}</option>)}
              {models.length === 0 && <option value="">No models installed</option>}
            </select>
          </div>
        </section>

        {/* Context Window */}
        <section className={card}>
          <div className={cardHeader}>
            <span className="material-symbols-outlined text-primary text-[20px]">memory</span>
            <h3 className="text-title-md font-medium text-on-surface" style={{ fontFamily: 'Hanken Grotesk' }}>Context Window</h3>
          </div>
          <div className={cardBody}>
            <p className="text-label-md text-on-surface-variant mb-4">
              Token budget for each conversation — system prompt, project files, and message history all count against this.
              Higher values let the model see more of your project but require more VRAM and are slower to respond.
              Individual projects can override this setting.
            </p>
            <div className="flex gap-2 flex-wrap">
              {[
                { label: '8K',   value: 8192,   note: 'Fast · minimal RAM · ~2 files' },
                { label: '16K',  value: 16384,  note: 'Default · good for general chat' },
                { label: '32K',  value: 32768,  note: 'Small projects · ~10 files' },
                { label: '64K',  value: 65536,  note: 'Full Golem codebase · recommended for dev' },
                { label: '128K', value: 131072, note: 'Large codebases · high VRAM required' },
              ].map(p => (
                <button
                  key={p.value}
                  onClick={() => handleNumCtxChange(p.value)}
                  title={p.note}
                  className={`px-4 py-2 rounded-lg text-label-md font-medium border transition-colors ${
                    numCtx === p.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-high hover:border-outline'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {numCtx >= 65536 && (
              <p className="mt-3 text-[12px] text-amber-400/80">
                ⚠ 64K+ requires your model to be loaded with a matching context size. If responses seem truncated, the model may have been started with a lower limit by Ollama.
              </p>
            )}
          </div>
        </section>

        {/* Hardware */}
        <section className={card}>
          <div className={cardHeader}>
            <span className="material-symbols-outlined text-primary text-[20px]">developer_board</span>
            <h3 className="text-title-md font-medium text-on-surface" style={{ fontFamily: 'Hanken Grotesk' }}>Hardware</h3>
          </div>
          <div className={cardBody}>
            {!hwInfo ? (
              <div className="text-on-surface-variant text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                Detecting hardware…
              </div>
            ) : (
              <>
                <HardwareRow
                  label="CPU"
                  value={hwInfo.cpu.model}
                  sub={`${hwInfo.cpu.cores} logical cores · ${(hwInfo.cpu.speedMhz / 1000).toFixed(1)} GHz`}
                />
                <HardwareRow
                  label="RAM"
                  value={fmtBytes(hwInfo.ram.totalBytes)}
                  sub={`${fmtBytes(hwInfo.ram.freeBytes)} free`}
                />
                {hwInfo.gpus.length === 0 ? (
                  <HardwareRow label="GPU" value="Not detected" sub="Inference will use CPU" />
                ) : hwInfo.gpus.map((g, i) => (
                  <HardwareRow
                    key={i}
                    label={`GPU${hwInfo.gpus.length > 1 ? ` ${i + 1}` : ''}`}
                    value={g.name}
                    sub={g.vramBytes > 0 ? `${fmtBytes(g.vramBytes)} VRAM` : 'VRAM unknown'}
                  />
                ))}

                {/* Per-model traffic light */}
                {models.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-outline-variant">
                    <p className="text-label-md text-on-surface-variant mb-3">
                      Model fit — based on model disk size vs available memory. Actual VRAM usage varies by quantization and context size.
                    </p>
                    <div className="space-y-2">
                      {models.map(m => {
                        const size = modelSizes[m]
                        if (!size) return (
                          <div key={m} className="flex items-center justify-between py-1">
                            <span className="font-mono text-[13px] text-on-surface">{m}</span>
                            <span className="text-[11px] text-on-surface-variant/50">size unknown</span>
                          </div>
                        )
                        const bestVram = hwInfo.gpus.reduce((acc, g) => Math.max(acc, g.vramBytes), 0)
                        const light = modelTrafficLight(size, hwInfo.ram.freeBytes, bestVram)
                        return (
                          <div key={m} className="flex items-center justify-between py-1">
                            <span className="font-mono text-[13px] text-on-surface">{m}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-on-surface-variant/60">{fmtBytes(size)}</span>
                              <span
                                className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                                style={{ background: light.bg, color: light.color, border: `1px solid ${light.color}40` }}
                              >
                                {light.label}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* MCP Servers */}
        <section className={card}>
          <div className={cardHeader}>
            <span className="material-symbols-outlined text-primary text-[20px]">electrical_services</span>
            <h3 className="text-title-md font-medium text-on-surface" style={{ fontFamily: 'Hanken Grotesk' }}>MCP Servers</h3>
            <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full text-on-surface-variant bg-surface-container-high border border-outline-variant">
              Model Context Protocol
            </span>
          </div>
          <div className={cardBody}>
            <p className="text-label-md text-on-surface-variant mb-4">
              Connect external tool servers. Golem will expose their tools to your models automatically. Requires a model with tool-calling capability.
            </p>

            {/* Server list */}
            {mcpServers.length > 0 && (
              <div className="mb-4 divide-y divide-outline-variant border border-outline-variant rounded-xl overflow-hidden">
                {mcpServers.map(server => {
                  const connected = !!mcpStatus[server.id]
                  const errMsg = mcpErrors[server.id]
                  const toolCount = mcpStatus[server.id]?.toolCount ?? 0
                  const serverTools = mcpStatus[server.id]?.tools ?? []
                  const isConnecting = mcpConnecting === server.id
                  return (
                    <div key={server.id} className="px-4 py-3 bg-surface">
                      <div className="flex items-center gap-3">
                        {/* Status dot */}
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: !server.enabled ? 'rgba(255,255,255,0.15)' : connected ? 'rgb(80,200,120)' : errMsg ? 'rgb(239,68,68)' : 'rgb(234,179,8)' }}
                          title={!server.enabled ? 'Disabled' : connected ? 'Connected' : errMsg || 'Disconnected'}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-on-surface text-[13px]">{server.name}</span>
                            {connected && (
                              <span className="text-[10px] text-on-surface-variant/60">{toolCount} tool{toolCount !== 1 ? 's' : ''}</span>
                            )}
                          </div>
                          <div className="font-mono text-[11px] text-on-surface-variant/60 truncate">{server.command}</div>
                          {errMsg && (
                            <div className="text-[11px] text-error/80 mt-0.5 truncate">{errMsg}</div>
                          )}
                          {connected && serverTools.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {serverTools.slice(0, 6).map(t => (
                                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-mono">{t}</span>
                              ))}
                              {serverTools.length > 6 && (
                                <span className="text-[10px] px-1.5 py-0.5 text-on-surface-variant/50">+{serverTools.length - 6} more</span>
                              )}
                            </div>
                          )}
                        </div>
                        {/* Controls */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Enable toggle */}
                          <div
                            onClick={() => handleMcpToggle(server.id, !server.enabled)}
                            className="relative w-8 h-5 rounded-full transition-colors duration-200 cursor-pointer shrink-0"
                            style={{ background: server.enabled ? 'var(--accent)' : 'rgba(255,255,255,0.12)' }}
                            title={server.enabled ? 'Disable' : 'Enable'}
                          >
                            <div
                              className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
                              style={{ transform: server.enabled ? 'translateX(14px)' : 'translateX(2px)' }}
                            />
                          </div>
                          {/* Reconnect */}
                          {server.enabled && (
                            <button
                              onClick={() => handleMcpReconnect(server.id)}
                              disabled={isConnecting}
                              className="p-1 rounded text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-40"
                              title="Reconnect"
                            >
                              <span className={`material-symbols-outlined text-[16px] ${isConnecting ? 'animate-spin' : ''}`}>
                                {isConnecting ? 'progress_activity' : 'refresh'}
                              </span>
                            </button>
                          )}
                          {/* Remove */}
                          <button
                            onClick={() => handleMcpRemove(server.id)}
                            className="p-1 rounded text-on-surface-variant hover:text-error transition-colors"
                            title="Remove server"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add server form */}
            {mcpFormOpen ? (() => {
              const tmpl = MCP_TEMPLATES.find(t => t.id === mcpWizard.template)
              const isCustom = !mcpWizard.template
              const parsed = isCustom ? parseCommandStr(mcpWizard.commandStr) : null

              // Validation
              const nameOk = mcpWizard.name.trim() || tmpl
              const cmdOk  = tmpl
                ? true
                : (parsed?.command || '').length > 0
              const canSave = !!(nameOk && cmdOk) && mcpConnecting !== 'new'

              return (
                <div className="rounded-xl border border-outline-variant overflow-hidden" style={{ background: '#1a1a26' }}>
                  {/* Template gallery */}
                  <div className="p-4 border-b border-outline-variant">
                    <p className="text-[11px] text-on-surface-variant mb-3 uppercase tracking-wider">Quick-start templates</p>
                    <div className="grid grid-cols-3 gap-2">
                      {MCP_TEMPLATES.map(t => (
                        <button
                          key={t.id}
                          onClick={() => setMcpWizard(w => ({
                            ...BLANK_WIZARD,
                            template: t.id,
                            name: w.name || t.name,
                            promptArgValues: Array(t.promptArgs.length).fill(''),
                            envVars: t.envKeys.map(e => ({ key: e.key, value: '' })),
                          }))}
                          className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all ${
                            mcpWizard.template === t.id
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-outline-variant hover:border-outline hover:bg-white/5 text-on-surface-variant'
                          }`}
                        >
                          <span className={`material-symbols-outlined text-[20px] ${mcpWizard.template === t.id ? 'text-primary' : ''}`}
                            style={{ fontVariationSettings: "'FILL' 1" }}>
                            {t.icon}
                          </span>
                          <span className="text-[12px] font-medium leading-tight">{t.name}</span>
                          <span className="text-[10px] opacity-60 leading-tight">{t.description}</span>
                        </button>
                      ))}
                      {/* Custom card */}
                      <button
                        onClick={() => setMcpWizard(w => ({ ...BLANK_WIZARD, template: null, name: w.name }))}
                        className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all ${
                          isCustom
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-outline-variant hover:border-outline hover:bg-white/5 text-on-surface-variant'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px]">settings</span>
                        <span className="text-[12px] font-medium leading-tight">Custom</span>
                        <span className="text-[10px] opacity-60 leading-tight">Any MCP server</span>
                      </button>
                    </div>
                  </div>

                  {/* Fields */}
                  <div className="p-4 space-y-3">
                    {/* Name */}
                    <div>
                      <label className="block text-[11px] text-on-surface-variant mb-1">Name</label>
                      <input
                        value={mcpWizard.name}
                        onChange={e => setMcpWizard(w => ({ ...w, name: e.target.value }))}
                        placeholder={tmpl?.name || 'My MCP server'}
                        className="w-full bg-background border border-outline-variant rounded-lg px-3 py-2 text-on-surface text-[13px] focus:outline-none focus:border-primary transition-all"
                      />
                    </div>

                    {/* Template-specific: prompt args (e.g. directory path) */}
                    {tmpl && tmpl.promptArgs.map((arg, i) => (
                      <div key={i}>
                        <label className="block text-[11px] text-on-surface-variant mb-1">
                          {arg.label}{arg.required && <span className="text-error ml-0.5">*</span>}
                        </label>
                        <input
                          value={mcpWizard.promptArgValues[i] ?? ''}
                          onChange={e => {
                            const vals = [...(mcpWizard.promptArgValues)]
                            vals[i] = e.target.value
                            setMcpWizard(w => ({ ...w, promptArgValues: vals }))
                          }}
                          placeholder={arg.placeholder}
                          className="w-full bg-background border border-outline-variant rounded-lg px-3 py-2 text-on-surface font-mono text-[12px] focus:outline-none focus:border-primary transition-all"
                        />
                      </div>
                    ))}

                    {/* Custom mode: command string */}
                    {isCustom && (
                      <div>
                        <label className="block text-[11px] text-on-surface-variant mb-1">
                          Command <span className="opacity-50 ml-1">— paste the full command, arguments included</span>
                        </label>
                        <input
                          value={mcpWizard.commandStr}
                          onChange={e => setMcpWizard(w => ({ ...w, commandStr: e.target.value }))}
                          placeholder="npx -y @modelcontextprotocol/server-filesystem /path/to/dir"
                          className="w-full bg-background border border-outline-variant rounded-lg px-3 py-2 text-on-surface font-mono text-[12px] focus:outline-none focus:border-primary transition-all"
                        />
                        {parsed?.command && (
                          <p className="mt-1 text-[10px] text-on-surface-variant/50 font-mono">
                            binary: <span className="text-on-surface-variant">{parsed.command}</span>
                            {parsed.args.length > 0 && (
                              <> · args: <span className="text-on-surface-variant">{JSON.stringify(parsed.args)}</span></>
                            )}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Env vars — template shows required keys pre-filled; custom shows add button */}
                    {(mcpWizard.envVars.length > 0 || isCustom) && (
                      <div>
                        <label className="block text-[11px] text-on-surface-variant mb-1.5">
                          Environment variables
                        </label>
                        <div className="space-y-2">
                          {mcpWizard.envVars.map((ev, i) => (
                            <div key={i} className="flex gap-2 items-center">
                              <input
                                value={ev.key}
                                onChange={e => {
                                  const vars = [...mcpWizard.envVars]
                                  vars[i] = { ...vars[i], key: e.target.value }
                                  setMcpWizard(w => ({ ...w, envVars: vars }))
                                }}
                                placeholder={tmpl?.envKeys[i]?.placeholder?.split('...')[0] || 'KEY'}
                                className="flex-1 bg-background border border-outline-variant rounded-lg px-3 py-2 text-on-surface font-mono text-[11px] focus:outline-none focus:border-primary transition-all"
                              />
                              <input
                                value={ev.value}
                                onChange={e => {
                                  const vars = [...mcpWizard.envVars]
                                  vars[i] = { ...vars[i], value: e.target.value }
                                  setMcpWizard(w => ({ ...w, envVars: vars }))
                                }}
                                type="password"
                                placeholder="value"
                                className="flex-1 bg-background border border-outline-variant rounded-lg px-3 py-2 text-on-surface font-mono text-[11px] focus:outline-none focus:border-primary transition-all"
                              />
                              {isCustom && (
                                <button
                                  onClick={() => setMcpWizard(w => ({ ...w, envVars: w.envVars.filter((_, j) => j !== i) }))}
                                  className="p-1 text-on-surface-variant hover:text-error transition-colors"
                                >
                                  <span className="material-symbols-outlined text-[16px]">close</span>
                                </button>
                              )}
                            </div>
                          ))}
                          {isCustom && (
                            <button
                              onClick={() => setMcpWizard(w => ({ ...w, envVars: [...w.envVars, { key: '', value: '' }] }))}
                              className="text-[11px] text-on-surface-variant hover:text-on-surface flex items-center gap-1 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[14px]">add</span>
                              Add variable
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 justify-end pt-1">
                      <button
                        onClick={() => { setMcpFormOpen(false); setMcpWizard(BLANK_WIZARD) }}
                        className="px-3 py-1.5 text-label-sm text-on-surface-variant hover:text-on-surface transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleMcpAdd}
                        disabled={!canSave}
                        className="px-4 py-1.5 bg-primary text-on-primary text-label-sm font-medium rounded-lg hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                      >
                        {mcpConnecting === 'new' && <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>}
                        Connect & Save
                      </button>
                    </div>
                  </div>
                </div>
              )
            })() : (
              <button
                onClick={() => setMcpFormOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-outline-variant text-on-surface-variant hover:text-on-surface hover:border-outline transition-all text-label-md"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Add MCP Server
              </button>
            )}
          </div>
        </section>

        {/* System */}
        <section className={card}>
          <div className={cardHeader}>
            <span className="material-symbols-outlined text-primary text-[20px]">settings_suggest</span>
            <h3 className="text-title-md font-medium text-on-surface" style={{ fontFamily: 'Hanken Grotesk' }}>System</h3>
          </div>
          <div className={cardBody}>
            <label className="flex items-center justify-between cursor-pointer group">
              <div>
                <div className="text-label-md text-on-surface">Launch at startup</div>
                <div className="text-[12px] text-on-surface-variant/60 mt-0.5">Open Golem automatically when you log into Windows</div>
              </div>
              {/* Toggle */}
              <div
                onClick={() => setLaunchAtStartup(v => !v)}
                className="relative shrink-0 w-10 h-6 rounded-full transition-colors duration-200 cursor-pointer"
                style={{ background: launchAtStartup ? 'var(--accent)' : 'rgba(255,255,255,0.12)' }}
              >
                <div
                  className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
                  style={{ transform: launchAtStartup ? 'translateX(18px)' : 'translateX(2px)' }}
                />
              </div>
            </label>
          </div>
        </section>

        {/* Memory */}
        <section className={card}>
          <div className={cardHeader}>
            <span className="material-symbols-outlined text-primary text-[20px]">psychology</span>
            <h3 className="text-title-md font-medium text-on-surface" style={{ fontFamily: 'Hanken Grotesk' }}>Personal Memory</h3>
          </div>
          <div className={cardBody}>
            <label className="block text-label-md text-on-surface-variant mb-2">
              Injected as context into every conversation
            </label>
            <textarea
              value={memory}
              onChange={e => setMemory(e.target.value)}
              placeholder="Name: Ricky&#10;Role: Director of Marketing&#10;Interests: AI tooling, automation, n8n&#10;..."
              rows={6}
              className="w-full bg-background border border-outline-variant rounded-lg px-4 py-3 text-on-surface text-body-md font-mono text-[13px] resize-y focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>
        </section>

        {/* Appearance */}
        <section className={card}>
          <div className={cardHeader}>
            <span className="material-symbols-outlined text-primary text-[20px]">palette</span>
            <h3 className="text-title-md font-medium text-on-surface" style={{ fontFamily: 'Hanken Grotesk' }}>Appearance</h3>
          </div>
          <div className={cardBody}>
            <label className="block text-label-md text-on-surface-variant mb-4">Accent color</label>
            <ColorPicker
              value={accentColor}
              onChange={hex => { setAccentColor(hex); applyAccentColor(hex) }}
            />
          </div>
        </section>

        {/* About */}
        <section className={card}>
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-surface-container-high border border-outline-variant flex items-center justify-center">
                <span className="material-symbols-outlined text-on-surface-variant text-[28px]">info</span>
              </div>
              <div>
                <div className="text-title-md font-medium text-on-surface" style={{ fontFamily: 'Hanken Grotesk' }}>Golem</div>
                <div className="text-body-md text-on-surface-variant text-sm">Version 0.8.1</div>
              </div>
            </div>
          </div>
        </section>

        {/* Save */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className="px-6 py-2.5 bg-primary text-on-primary text-label-md font-medium rounded-xl hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
          >
            {saved ? (
              <><span className="material-symbols-outlined text-[18px]">check</span>Saved</>
            ) : (
              <><span className="material-symbols-outlined text-[18px]">save</span>Save Changes</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
