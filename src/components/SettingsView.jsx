import { useState, useEffect } from 'react'

const api = window.golem

export default function SettingsView({ models }) {
  const [defaultModel, setDefaultModel] = useState('')
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [memory, setMemory] = useState('')
  const [saved, setSaved] = useState(false)
  const [testStatus, setTestStatus] = useState('')

  useEffect(() => {
    async function load() {
      const dm = await api.db.getSetting('default_model', models[0] || '')
      const url = await api.db.getSetting('ollama_url', 'http://localhost:11434')
      const mem = await api.memory.load()
      setDefaultModel(dm)
      setOllamaUrl(url)
      setMemory(mem)
    }
    load()
  }, [])

  async function handleSave() {
    await api.db.setSetting('default_model', defaultModel)
    await api.db.setSetting('ollama_url', ollamaUrl)
    await api.memory.save(memory)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleTestConnection() {
    setTestStatus('Testing…')
    const ready = await api.ollama.ensureRunning()
    setTestStatus(ready ? '✓ Connected' : '✗ Could not connect')
    setTimeout(() => setTestStatus(''), 3000)
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

        {/* About */}
        <section className={card}>
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-surface-container-high border border-outline-variant flex items-center justify-center">
                <span className="material-symbols-outlined text-on-surface-variant text-[28px]">info</span>
              </div>
              <div>
                <div className="text-title-md font-medium text-on-surface" style={{ fontFamily: 'Hanken Grotesk' }}>Golem</div>
                <div className="text-body-md text-on-surface-variant text-sm">Version 1.0.0</div>
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
