import { useState, useEffect } from 'react'
import {
  MODELS_CATALOG, calculateTier,
  TIER_LABEL, TIER_COLOR,
  TAG_LABEL, TAG_COLOR,
  TOOLS_COLOR,
} from '../data/models-catalog'

const api = window.golem

const ALL_TAGS = ['general', 'coding', 'reasoning', 'vision', 'embedding']

// ── Installed Tab ─────────────────────────────────────────────────────────────

function InstalledTab({ models, hardware, onRefresh }) {
  const [deleting, setDeleting] = useState(null)
  const bestVramBytes = hardware?.gpus?.reduce((acc, g) => Math.max(acc, g.vramBytes), 0) ?? 0

  function estimateVram(modelName) {
    const match = modelName.match(/:(\d+\.?\d*)b/i)
    if (!match) return null
    const params = parseFloat(match[1])
    return Math.round((params * 0.56 + 1) * 10) / 10
  }

  async function handleDelete(name) {
    setDeleting(name)
    try {
      await api.ollama.deleteModel(name)
      onRefresh()
    } finally {
      setDeleting(null)
    }
  }

  async function handleSetDefault(name) {
    await api.db.setSetting('default_model', name)
  }

  if (models.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 mt-16 text-center">
        <span className="material-symbols-outlined text-[40px]" style={{ color: 'var(--text-faint)' }}>inbox</span>
        <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
          No models installed yet. Browse the catalog and pull one.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 mt-2">
      {models.map(name => {
        const vram = estimateVram(name)
        const tier = vram ? calculateTier(vram, bestVramBytes) : 'unknown'
        const tierC = TIER_COLOR[tier]
        const isDeleting = deleting === name

        return (
          <div key={name}
            className="flex items-center gap-4 px-5 py-3.5 rounded-xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>

            <span className="material-symbols-outlined text-[18px]"
              style={{ color: 'var(--accent)', fontVariationSettings: "'FILL' 1" }}>
              smart_toy
            </span>

            <span className="flex-1 text-[13px] font-medium text-on-surface truncate">{name}</span>

            {vram && (
              <span className="text-[11px] px-2 py-0.5 rounded-lg"
                style={{ background: tierC.bg, color: tierC.text, border: `1px solid ${tierC.border}` }}>
                {TIER_LABEL[tier]}
              </span>
            )}

            <button
              onClick={() => handleSetDefault(name)}
              className="text-[11px] px-2.5 py-1 rounded-lg transition-colors"
              style={{ background: 'var(--bg-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(var(--accent-rgb),0.1)'; e.currentTarget.style.color = 'var(--accent-light)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-overlay)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              title="Set as default model"
            >
              Set default
            </button>

            <button
              onClick={() => handleDelete(name)}
              disabled={isDeleting}
              className="text-[11px] px-2.5 py-1 rounded-lg transition-colors disabled:opacity-40"
              style={{ background: 'rgba(220,70,70,0.08)', color: 'rgba(220,100,100,0.7)', border: '1px solid rgba(220,70,70,0.2)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,70,70,0.15)'; e.currentTarget.style.color = 'rgba(240,100,100,0.9)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(220,70,70,0.08)'; e.currentTarget.style.color = 'rgba(220,100,100,0.7)' }}
            >
              {isDeleting ? '…' : 'Delete'}
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ── Library View ──────────────────────────────────────────────────────────────

export default function LibraryView({ pulling, pullModel: activePullModel, pullProgress, onPull }) {
  const [tab, setTab] = useState('browse')
  const [hardware, setHardware] = useState(null)
  const [installedModels, setInstalledModels] = useState([])
  const [filterTier, setFilterTier] = useState('all')
  const [filterTag, setFilterTag] = useState('all')
  const [filterSize, setFilterSize] = useState('all')
  const [filterTools, setFilterTools] = useState('all')   // 'all' | 'yes' | 'no'
  const [showDeprecated, setShowDeprecated] = useState(false)
  const [selectedSize, setSelectedSize] = useState({})  // modelId → tag string
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.system.getHardwareInfo().then(hw => setHardware(hw))
    loadInstalled()
  }, [])

  async function loadInstalled() {
    const models = await api.ollama.listModels()
    setInstalledModels(models || [])
  }

  const bestVramBytes = hardware?.gpus?.reduce((acc, g) => Math.max(acc, g.vramBytes), 0) ?? 0

  function getTierForSize(vram_gb) {
    return calculateTier(vram_gb, bestVramBytes)
  }

  function getBestTier(model) {
    const tiers = model.sizes.map(s => calculateTier(s.vram_gb, bestVramBytes))
    if (tiers.includes('great')) return 'great'
    if (tiers.includes('ok'))    return 'ok'
    return 'no'
  }

  const sizeRanges = {
    small:  m => m.sizes.some(s => s.params_b <= 3),
    medium: m => m.sizes.some(s => s.params_b > 3  && s.params_b <= 13),
    large:  m => m.sizes.some(s => s.params_b > 13),
  }

  const filtered = MODELS_CATALOG.filter(m => {
    if (!showDeprecated && m.deprecated) return false
    if (filterTier  !== 'all' && getBestTier(m) !== filterTier) return false
    if (filterTag   !== 'all' && !m.tags.includes(filterTag))   return false
    if (filterSize  !== 'all' && !sizeRanges[filterSize](m))    return false
    if (filterTools === 'yes' && !m.tools)  return false
    if (filterTools === 'no'  && m.tools)   return false
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) &&
                  !m.description.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function getSelectedTag(model) {
    return selectedSize[model.id] || model.sizes[0].tag
  }

  function getSelectedSizeObj(model) {
    const tag = getSelectedTag(model)
    return model.sizes.find(s => s.tag === tag) || model.sizes[0]
  }

  const isInstalled = tag => installedModels.includes(tag)
  const isPulling   = tag => pulling && activePullModel === tag

  const gpuName = hardware?.gpus?.[0]?.name
  const gpuVramGb = bestVramBytes > 0 ? (bestVramBytes / (1024 ** 3)).toFixed(1) : null

  function FilterBtn({ state, setter, value, label }) {
    return (
      <button
        onClick={() => setter(value)}
        className="px-3 py-1 rounded-lg text-[12px] font-medium transition-colors"
        style={state === value
          ? { background: 'rgba(var(--accent-rgb),0.2)', color: 'var(--accent-light)', border: '1px solid rgba(var(--accent-rgb),0.35)' }
          : { background: 'var(--bg-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }
        }
      >{label}</button>
    )
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="px-8 pt-8 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[22px] font-bold text-on-surface" style={{ fontFamily: 'Hanken Grotesk' }}>Model Library</h1>
            {gpuName && gpuVramGb && (
              <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>
                {gpuName} · {gpuVramGb} GB VRAM
              </p>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-card-hover)' }}>
            {['browse', 'installed'].map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); if (t === 'installed') loadInstalled() }}
                className="px-4 py-1.5 rounded-lg text-[13px] font-medium capitalize transition-all"
                style={tab === t
                  ? { background: 'rgba(var(--accent-rgb),0.2)', color: 'var(--accent-light)' }
                  : { color: 'var(--text-secondary)' }
                }
              >{t}</button>
            ))}
          </div>
        </div>

        {/* Filters — Browse tab only */}
        {tab === 'browse' && (
          <div>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search models…"
              className="rounded-lg px-3 py-1.5 text-[12px] text-on-surface outline-none mr-2"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-mid)', width: 180 }}
            />

            <span className="text-[11px] uppercase tracking-wider mr-1" style={{ color: 'var(--text-faint)' }}>Tier</span>
            {[['all','All'],['great','Runs great'],['ok','Might be OK'],['no','Not a chance']].map(([v,l]) => (
              <FilterBtn key={v} state={filterTier} setter={setFilterTier} value={v} label={l} />
            ))}

            <span className="text-[11px] uppercase tracking-wider ml-2 mr-1" style={{ color: 'var(--text-faint)' }}>Use</span>
            {[['all','All'], ...ALL_TAGS.map(t => [t, TAG_LABEL[t]])].map(([v,l]) => (
              <FilterBtn key={v} state={filterTag} setter={setFilterTag} value={v} label={l} />
            ))}

            <span className="text-[11px] uppercase tracking-wider ml-2 mr-1" style={{ color: 'var(--text-faint)' }}>Size</span>
            {[['all','All'],['small','≤3B'],['medium','4–13B'],['large','14B+']].map(([v,l]) => (
              <FilterBtn key={v} state={filterSize} setter={setFilterSize} value={v} label={l} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center mt-2">
            <span className="text-[11px] uppercase tracking-wider mr-1" style={{ color: 'var(--text-faint)' }}>Tools</span>
            {[['all','All'],['yes','Supports tools'],['no','No tools']].map(([v,l]) => (
              <FilterBtn key={v} state={filterTools} setter={setFilterTools} value={v} label={l} />
            ))}
            <div className="flex-1" />
            <button
              onClick={() => setShowDeprecated(v => !v)}
              className="px-3 py-1 rounded-lg text-[12px] font-medium transition-colors"
              style={showDeprecated
                ? { background: 'rgba(220,160,30,0.15)', color: 'rgba(230,180,50,0.9)', border: '1px solid rgba(220,160,30,0.3)' }
                : { background: 'var(--bg-overlay)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }
              }
            >
              {showDeprecated ? 'Hide legacy' : 'Show legacy'}
            </button>
          </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {tab === 'browse' && (
          <div className="flex flex-col gap-3">
            {filtered.length === 0 && (
              <p className="text-[13px] mt-8 text-center" style={{ color: 'var(--text-faint)' }}>
                No models match these filters.
              </p>
            )}
            {filtered.map(model => {
              const selectedSizeObj = getSelectedSizeObj(model)
              const selectedTag = getSelectedTag(model)
              const tier = getTierForSize(selectedSizeObj.vram_gb)
              const tierC = TIER_COLOR[tier]
              const installed = isInstalled(selectedTag)
              const pulling_ = isPulling(selectedTag)

              return (
                <div key={model.id}
                  className="rounded-xl p-5 flex flex-col gap-3"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>

                  {/* Top row */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[15px] font-semibold text-on-surface">{model.name}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded"
                          style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
                          {model.family}
                        </span>
                        {model.tags.map(tag => {
                          const tc = TAG_COLOR[tag]
                          return (
                            <span key={tag} className="text-[11px] px-2 py-0.5 rounded"
                              style={{ background: tc.bg, color: tc.text, border: `1px solid ${tc.border}` }}>
                              {TAG_LABEL[tag]}
                            </span>
                          )
                        })}
                        {model.tools && (
                          <span className="text-[11px] px-2 py-0.5 rounded flex items-center gap-1"
                            style={{ background: TOOLS_COLOR.bg, color: TOOLS_COLOR.text, border: `1px solid ${TOOLS_COLOR.border}` }}>
                            <span className="material-symbols-outlined text-[11px]">build</span>
                            Tools
                          </span>
                        )}
                        {model.deprecated && (
                          <span className="text-[11px] px-2 py-0.5 rounded"
                            style={{ background: 'rgba(220,160,30,0.1)', color: 'rgba(220,160,30,0.6)', border: '1px solid rgba(220,160,30,0.2)' }}>
                            Legacy
                          </span>
                        )}
                        <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                          {model.context_k}K ctx
                        </span>
                      </div>
                      <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {model.description}
                      </p>
                    </div>

                    {/* Tier badge */}
                    <div className="shrink-0 text-[11px] px-2.5 py-1 rounded-lg font-medium"
                      style={{ background: tierC.bg, color: tierC.text, border: `1px solid ${tierC.border}` }}>
                      {TIER_LABEL[tier]}
                    </div>
                  </div>

                  {/* Size selector + pull */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {model.sizes.map(size => {
                      const t = getTierForSize(size.vram_gb)
                      const tc = TIER_COLOR[t]
                      const isSelected = selectedTag === size.tag
                      return (
                        <button key={size.tag}
                          onClick={() => setSelectedSize(prev => ({ ...prev, [model.id]: size.tag }))}
                          className="px-2.5 py-1 rounded-lg text-[12px] transition-all"
                          style={isSelected
                            ? { background: 'rgba(var(--accent-rgb),0.2)', color: 'var(--accent-light)', border: '1px solid rgba(var(--accent-rgb),0.4)' }
                            : { background: 'var(--bg-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }
                          }
                          title={`${size.vram_gb} GB VRAM needed`}
                        >
                          {size.label}
                          <span className="ml-1 text-[10px]" style={{ color: tc.text }}>·</span>
                          <span className="ml-0.5 text-[10px]" style={{ color: tc.text }}>{size.vram_gb}GB</span>
                        </button>
                      )
                    })}

                    <div className="flex-1" />

                    {pulling_ ? (
                      <div className="flex items-center gap-2">
                        <div className="w-28 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-mid)' }}>
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${pullProgress ?? 0}%`, background: 'var(--accent)' }} />
                        </div>
                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{pullProgress ?? 0}%</span>
                      </div>
                    ) : installed ? (
                      <span className="flex items-center gap-1 text-[12px]" style={{ color: 'rgba(80,220,120,0.7)' }}>
                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                        Installed
                      </span>
                    ) : (
                      <button
                        onClick={() => onPull(selectedTag)}
                        disabled={pulling}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all disabled:opacity-40"
                        style={{ background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent-light)', border: '1px solid rgba(var(--accent-rgb),0.3)' }}
                      >
                        <span className="material-symbols-outlined text-[14px]">download</span>
                        Pull
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'installed' && (
          <InstalledTab
            models={installedModels}
            hardware={hardware}
            onRefresh={loadInstalled}
          />
        )}
      </div>
    </div>
  )
}
