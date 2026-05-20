import { useState, useEffect } from 'react'
import ColorPicker from './ColorPicker'
import { applyAccentColor } from '../utils/accent'

const api = window.golem

const SUGGESTED_MODELS = ['llama3.1:8b', 'qwen2.5:7b', 'mistral-nemo:12b', 'gemma4:e4b']

export default function SettingsView({
  models,
  pulling = false,
  pullModel = '',
  pullStatus = '',
  pullProgress = null,
  onStartPull,
  onDeleteModel,
}) {
  const [defaultModel, setDefaultModel] = useState('')
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [memory, setMemory] = useState('')
  const [launchAtStartup, setLaunchAtStartup] = useState(false)
  const [accentColor, setAccentColor] = useState('#6366f1')
  const [numCtx, setNumCtxState] = useState(16384)
  const [saved, setSaved] = useState(false)
  const [testStatus, setTestStatus] = useState('')
  // toolCaps: { [modelName]: 'yes' | 'no' | 'unknown' | 'testing' }
  const [toolCaps, setToolCaps] = useState({})
  // Local UI state only — actual pull state lives in App
  const [pullInput, setPullInput] = useState('')
  const [deletingModel, setDeletingModel] = useState(null)

  useEffect(() => {
    async function load() {
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
      setLaunchAtStartup(loginEnabled)
      setAccentColor(accent)
      setNumCtxState(parseInt(savedNumCtx) || 16384)
    }
    load()
  }, [])

  useEffect(() => {
    async function loadCaps() {
      const entries = await Promise.all(models.map(async m => {
        const cap = await api.ollama.getToolCapability(m)
        return [m, cap === true ? 'yes' : cap === false ? 'no' : 'unknown']
      }))
      setToolCaps(Object.fromEntries(entries))
    }
    if (models.length > 0) loadCaps()
  }, [models.join(',')])

  async function retestModel(model) {
    setToolCaps(prev => ({ ...prev, [model]: 'testing' }))
    const result = await api.ollama.testToolCapability(model)
    setToolCaps(prev => ({ ...prev, [model]: result ? 'yes' : 'no' }))
  }

  async function handlePull(name) {
    const target = (name || pullInput).trim()
    if (!target || pulling) return
    setPullInput('')
    if (onStartPull) await onStartPull(target)
  }

  async function handleDelete(name) {
    if (deletingModel) return
    if (!window.confirm(`Delete ${name}? This removes the model from disk.`)) return
    setDeletingModel(name)
    try {
      if (onDeleteModel) await onDeleteModel(name)
    } finally {
      setDeletingModel(null)
    }
  }

  async function handleSave() {
    await Promise.all([
      api.db.setSetting('default_model', defaultModel),
      api.db.setSetting('ollama_url', ollamaUrl),
      api.memory.save(memory),
      api.application.setLoginItem(launchAtStartup),
      api.db.setSetting('accent_color', accentColor),
    ])
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

        {/* Models — pull, delete, tool capability */}
        <section className={card}>
          <div className={cardHeader}>
            <span className="material-symbols-outlined text-primary text-[20px]">deployed_code</span>
            <h3 className="text-title-md font-medium text-on-surface" style={{ fontFamily: 'Hanken Grotesk' }}>Models</h3>
          </div>
          <div className={cardBody}>
            {/* Pull a new model */}
            <div className="mb-5">
              <label className="block text-label-md text-on-surface-variant mb-2">Pull a model from the Ollama library</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">cloud_download</span>
                  <input
                    value={pullInput}
                    onChange={e => setPullInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handlePull()}
                    placeholder="e.g., gemma4:e4b"
                    className="w-full bg-background border border-outline-variant rounded-lg pl-10 pr-4 py-2.5 text-on-surface font-mono text-[13px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    disabled={pulling}
                  />
                </div>
                <button
                  onClick={() => handlePull()}
                  disabled={!pullInput.trim() || pulling}
                  className="px-4 py-2.5 bg-primary text-on-primary text-label-md font-medium rounded-lg hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shrink-0"
                >
                  {pulling ? (
                    <><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>Pulling…</>
                  ) : (
                    <><span className="material-symbols-outlined text-[16px]">download</span>Pull</>
                  )}
                </button>
              </div>
              {pullStatus && (
                <div className="mt-2 text-label-sm text-on-surface-variant">
                  {pullStatus}
                  {pullProgress !== null && (
                    <div className="mt-1.5 w-full bg-surface-container-high rounded-full h-1.5 overflow-hidden">
                      <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${pullProgress}%` }} />
                    </div>
                  )}
                </div>
              )}
              {/* Suggested model chips */}
              {SUGGESTED_MODELS.filter(s => !models.includes(s) && !pulling).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-on-surface-variant/60 self-center mr-1">Suggested</span>
                  {SUGGESTED_MODELS.filter(s => !models.includes(s)).map(s => (
                    <button
                      key={s}
                      onClick={() => handlePull(s)}
                      disabled={pulling}
                      className="bg-surface-container-high border border-outline-variant text-on-surface text-label-sm font-mono px-2.5 py-1 rounded hover:border-primary disabled:opacity-40 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-outline-variant pt-4">
              <p className="text-body-md text-on-surface-variant mb-3 text-sm">
                Installed models. Tool calling lets the model take actions — capability is auto-detected; unknown models are probed live the first time they're used.
              </p>
              {models.length === 0 ? (
                <div className="text-on-surface-variant text-sm">No models installed. Pull one above to get started.</div>
              ) : (
                <ul className="divide-y divide-outline-variant">
                  {models.map(m => {
                    const cap = toolCaps[m] || 'unknown'
                    const badgeStyle = cap === 'yes'
                      ? { background: 'rgba(80,200,120,0.12)', color: 'rgb(140,220,160)', border: '1px solid rgba(80,200,120,0.3)' }
                      : cap === 'no'
                        ? { background: 'rgba(255,255,255,0.06)', color: 'rgba(196,192,216,0.7)', border: '1px solid rgba(255,255,255,0.1)' }
                        : cap === 'testing'
                          ? { background: 'rgba(255,200,80,0.12)', color: 'rgb(230,200,140)', border: '1px solid rgba(255,200,80,0.3)' }
                          : { background: 'rgba(255,255,255,0.04)', color: 'rgba(196,192,216,0.5)', border: '1px solid rgba(255,255,255,0.08)' }
                    const label = cap === 'yes' ? 'Tools: Yes'
                      : cap === 'no' ? 'Tools: No'
                      : cap === 'testing' ? 'Testing…'
                      : 'Tools: Unknown'
                    const isDeleting = deletingModel === m
                    return (
                      <li key={m} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                        <span className="font-mono text-[13px] text-on-surface truncate mr-3">{m}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                            style={badgeStyle}
                          >
                            {label}
                          </span>
                          <button
                            onClick={() => retestModel(m)}
                            disabled={cap === 'testing'}
                            className="text-[11px] text-on-surface-variant hover:text-on-surface px-2 py-0.5 rounded transition-colors disabled:opacity-40"
                            title="Force a live probe (may take a few seconds)"
                          >
                            {cap === 'testing' ? '…' : 'Retest'}
                          </button>
                          <button
                            onClick={() => handleDelete(m)}
                            disabled={isDeleting}
                            className="p-1 rounded text-on-surface-variant hover:text-error transition-colors disabled:opacity-40"
                            title="Delete model from disk"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {isDeleting ? 'hourglass_empty' : 'delete'}
                            </span>
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
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
                <div className="text-body-md text-on-surface-variant text-sm">Version 0.4.0</div>
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
