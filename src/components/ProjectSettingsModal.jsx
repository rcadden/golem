const CTX_OPTIONS = [
  { label: 'Default', value: null },
  { label: '32K',     value: 32768 },
  { label: '64K',     value: 65536 },
  { label: '128K',    value: 131072 },
]

export default function ProjectSettingsModal({
  project,
  mcpServers = [],
  associatedServerIds = new Set(),
  onToggleServer,
  onSetNumCtx,
  onSetDirectory,
  onSync,
  syncing = false,
  onClose,
}) {
  function handleKeyDown(e) {
    if (e.key === 'Escape') onClose()
  }

  const enabledServers = mcpServers.filter(s => s.enabled)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-lg rounded-2xl flex flex-col"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-mid)', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="text-[17px] font-semibold text-on-surface" style={{ fontFamily: 'Hanken Grotesk' }}>
              Project Settings
            </h2>
            <p className="text-[12px] text-on-surface-variant/60 mt-0.5">
              {project?.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/5 text-on-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 flex flex-col gap-5">

          {/* Directory */}
          <div>
            <label className="block text-[12px] font-medium text-on-surface-variant mb-1.5">Directory</label>
            <div
              className="flex items-center gap-2 rounded-xl px-4 py-2.5"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-mid)' }}
            >
              <span className="material-symbols-outlined text-[16px] shrink-0" style={{ color: 'var(--text-faint)' }}>folder_open</span>
              <span
                className="text-[13px] truncate flex-1"
                style={{ color: project?.directory_path ? 'var(--text-secondary)' : 'var(--text-faint)' }}
                title={project?.directory_path || ''}
              >
                {project?.directory_path || 'No directory set'}
              </span>
              {project?.directory_path && (
                <button
                  onClick={onSync}
                  disabled={syncing}
                  className="text-[12px] font-medium px-2.5 py-1 rounded-lg transition-colors disabled:opacity-40"
                  style={{ color: 'var(--accent-light)', background: 'rgba(var(--accent-rgb),0.12)' }}
                >
                  {syncing ? 'Syncing…' : 'Sync now'}
                </button>
              )}
              <button
                onClick={onSetDirectory}
                className="text-[12px] font-medium px-2.5 py-1 rounded-lg transition-colors hover:bg-white/5"
                style={{ color: 'var(--text-secondary)' }}
              >
                Set directory…
              </button>
            </div>
          </div>

          {/* Context window */}
          <div>
            <label className="block text-[12px] font-medium text-on-surface-variant mb-1.5">Context window</label>
            <div className="flex gap-1.5 flex-wrap">
              {CTX_OPTIONS.map(opt => {
                const isActive = (project?.num_ctx ?? null) === opt.value
                return (
                  <button
                    key={opt.label}
                    onClick={() => onSetNumCtx(opt.value)}
                    className={`text-[12px] px-3 py-1.5 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-[var(--accent)]/20 text-[var(--accent-light)]'
                        : 'text-on-surface-variant/60 hover:text-on-surface-variant hover:bg-white/5'
                    }`}
                    style={isActive ? { border: '1px solid rgba(var(--accent-rgb),0.4)' } : { border: '1px solid var(--border-mid)' }}
                    title={opt.value ? `Override context window to ${opt.label} for this project` : 'Use the global context window setting'}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* MCP servers */}
          <div>
            <label className="block text-[12px] font-medium text-on-surface-variant mb-1.5">MCP servers</label>
            {enabledServers.length === 0 ? (
              <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
                No MCP servers configured — add them in Settings.
              </p>
            ) : (
              <div className="flex flex-col gap-1 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-mid)' }}>
                {enabledServers.map((server, i) => {
                  const associated = associatedServerIds.has(server.id)
                  return (
                    <button
                      key={server.id}
                      onClick={() => onToggleServer(server.id, associated)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-white/5"
                      style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)', background: 'var(--bg-input)' }}
                    >
                      <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--text-faint)' }}>electrical_services</span>
                      <span className="text-[13px] flex-1 text-on-surface">{server.name}</span>
                      <span
                        className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                        style={associated
                          ? { background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent-light)' }
                          : { color: 'var(--text-faint)', background: 'var(--bg-overlay)' }}
                      >
                        {associated ? 'Enabled' : 'Off'}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-[13px] font-medium text-white transition-all"
              style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-mid) 100%)' }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
