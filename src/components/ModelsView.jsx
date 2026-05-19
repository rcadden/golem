import { useState, useEffect } from 'react'

const api = window.golem

const SUGGESTED = ['llama3:8b', 'mistral:7b', 'phi3:mini', 'gemma:2b', 'qwen2.5-coder:7b']

export default function ModelsView({ models, onRefresh }) {
  const [pullInput, setPullInput] = useState('')
  const [pulling, setPulling] = useState(false)
  const [pullStatus, setPullStatus] = useState('')
  const [pullProgress, setPullProgress] = useState(null)
  const [deletingName, setDeletingName] = useState(null)
  const [localModels, setLocalModels] = useState(models)

  useEffect(() => { setLocalModels(models) }, [models])

  useEffect(() => {
    api.ollama.onPullProgress(data => {
      setPullStatus(data.status || '')
      if (data.total && data.completed) {
        setPullProgress(Math.round((data.completed / data.total) * 100))
      }
    })
    return () => api.ollama.offPullProgress()
  }, [])

  async function handlePull() {
    const name = pullInput.trim()
    if (!name || pulling) return
    setPulling(true)
    setPullStatus('Starting…')
    setPullProgress(null)
    try {
      await api.ollama.pullModel(name)
      setPullStatus('Done')
      setPullInput('')
      await onRefresh()
    } catch (e) {
      setPullStatus(`Error: ${e.message}`)
    } finally {
      setPulling(false)
      setPullProgress(null)
      setTimeout(() => setPullStatus(''), 3000)
    }
  }

  async function handleDelete(name) {
    setDeletingName(name)
    await api.ollama.deleteModel(name)
    await onRefresh()
    setDeletingName(null)
  }

  return (
    <div className="flex-1 h-full overflow-y-auto bg-background">
      <div className="px-8 py-8 max-w-[1100px] mx-auto">
        <p className="text-body-lg text-on-surface-variant mb-8">Configure, pull, and manage local LLMs for inference.</p>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Pull + Resources */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            {/* Pull a model */}
            <section className="bg-surface border border-outline-variant rounded-xl p-6">
              <div className="flex items-center gap-2 mb-1 border-b border-outline-variant pb-4 mb-4">
                <span className="material-symbols-outlined text-primary">cloud_download</span>
                <h2 className="text-title-md font-medium text-on-surface" style={{ fontFamily: 'Hanken Grotesk' }}>Pull a Model</h2>
              </div>
              <p className="text-body-md text-on-surface-variant mb-4">Enter an Ollama model tag to download locally.</p>
              <div className="flex flex-col gap-3">
                <div className="flex items-center bg-surface-container-high border border-outline-variant rounded-lg px-3 focus-within:border-primary transition-colors">
                  <span className="material-symbols-outlined text-on-surface-variant text-[20px]">search</span>
                  <input
                    value={pullInput}
                    onChange={e => setPullInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handlePull()}
                    placeholder="e.g., mistral:7b-instruct"
                    className="flex-1 bg-transparent border-none outline-none text-on-surface text-label-md px-3 py-3 placeholder:text-on-surface-variant placeholder:opacity-40"
                  />
                </div>
                <button
                  onClick={handlePull}
                  disabled={!pullInput.trim() || pulling}
                  className="w-full bg-primary text-on-primary py-3 rounded-lg text-label-md font-medium flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {pulling ? (
                    <>
                      <span className="animate-spin material-symbols-outlined text-[18px]">refresh</span>
                      Pulling…
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">download</span>
                      Pull Model
                    </>
                  )}
                </button>
                {pullStatus && (
                  <div className="text-label-sm text-on-surface-variant">
                    {pullStatus}
                    {pullProgress !== null && (
                      <div className="mt-2 w-full bg-surface-container-high rounded-full h-1.5">
                        <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${pullProgress}%` }} />
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-5 pt-5 border-t border-outline-variant">
                <div className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-2">Suggested</div>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED.filter(s => !localModels.includes(s)).slice(0, 5).map(s => (
                    <button
                      key={s}
                      onClick={() => setPullInput(s)}
                      className="bg-surface-container-high text-on-surface border border-outline-variant px-3 py-1 rounded text-label-sm hover:border-primary transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* System resources placeholder */}
            <section className="bg-surface border border-outline-variant rounded-xl p-6">
              <h2 className="flex items-center gap-2 text-title-md font-medium text-on-surface mb-4" style={{ fontFamily: 'Hanken Grotesk' }}>
                <span className="material-symbols-outlined text-on-surface-variant">memory</span>
                System Resources
              </h2>
              <p className="text-body-md text-on-surface-variant text-sm">
                Resource monitoring requires additional integration. Models run fully on-device via Ollama.
              </p>
            </section>
          </div>

          {/* Installed models */}
          <section className="lg:col-span-7 bg-surface border border-outline-variant rounded-xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-on-surface">dns</span>
                <h2 className="text-title-md font-medium text-on-surface" style={{ fontFamily: 'Hanken Grotesk' }}>Installed Models</h2>
              </div>
              <span className="text-label-sm text-on-surface-variant bg-surface-container-high px-3 py-1 rounded">
                {localModels.length} Available
              </span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-outline-variant">
              {localModels.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[40px] mb-3 opacity-40">deployed_code</span>
                  <p className="text-body-md">No models installed yet.</p>
                  <p className="text-body-md text-sm opacity-60 mt-1">Pull a model to get started.</p>
                </div>
              ) : (
                localModels.map(name => (
                  <div key={name} className="flex items-center justify-between px-6 py-4 hover:bg-surface-container-high transition-colors group">
                    <div>
                      <div className="text-title-md font-medium text-on-surface">{name.split(':')[0]}</div>
                      <div className="text-label-sm text-on-surface-variant mt-0.5">{name}</div>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleDelete(name)}
                        disabled={deletingName === name}
                        className="p-2 rounded-lg text-on-surface-variant hover:text-error hover:bg-surface-container border border-transparent hover:border-outline-variant transition-all"
                        title="Delete model"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {deletingName === name ? 'hourglass_empty' : 'delete'}
                        </span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
