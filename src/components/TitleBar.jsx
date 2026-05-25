import { useState, useEffect } from 'react'

const api = window.golem

export default function TitleBar({
  title = '',
  pulling = false,
  pullModel = '',
  pullProgress = null,
  pullStatus = '',
  sidebarOpen = true,
  onToggleSidebar,
}) {
  const [isMaximized, setIsMaximized] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(null)   // { version } | null
  const [updateReady, setUpdateReady]     = useState(false)
  const [updateProgress, setUpdateProgress] = useState(null)    // 0-100 | null
  const [updateError, setUpdateError]     = useState(null)
  const [platform, setPlatform] = useState('win32')

  useEffect(() => {
    api.window.isMaximized().then(setIsMaximized)
    api.window.onMaximizeChange(setIsMaximized)
    api.updater.onAvailable(info => { setUpdateAvailable(info); setUpdateError(null) })
    api.updater.onProgress(data => setUpdateProgress(data.percent))
    api.updater.onDownloaded(() => { setUpdateReady(true); setUpdateProgress(null) })
    api.updater.onError(() => { setUpdateProgress(null); setUpdateError(true) })
    api.system.platform().then(setPlatform)
    return () => {
      api.window.offMaximizeChange()
      api.updater.offAvailable()
      api.updater.offProgress()
      api.updater.offDownloaded()
      api.updater.offError()
    }
  }, [])

  return (
    <div
      className="drag flex items-center justify-between h-8 shrink-0 select-none"
      style={{ background: 'var(--title-bar-bg)', borderBottom: '1px solid var(--border-subtle)' }}
    >
      {/* Left: sidebar toggle + conversation title */}
      <div className="no-drag flex items-center gap-0.5 pl-1 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded transition-colors duration-150 hover:bg-white/8"
          style={{ color: 'var(--text-faint)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-faint)' }}
          title={sidebarOpen ? 'Hide sidebar (Ctrl+B)' : 'Show sidebar (Ctrl+B)'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
            {sidebarOpen ? 'left_panel_close' : 'left_panel_open'}
          </span>
        </button>
        <span className="px-2 text-[11px] font-medium tracking-wide truncate max-w-[55%]"
          style={{ color: 'var(--text-faint)' }}>
          {title}
        </span>
      </div>

      {/* Center: status chips */}
      <div className="no-drag flex items-center gap-2">
        {pulling && (
          <div
            className="flex items-center gap-2 px-3 py-0.5 rounded-full text-[10px]"
            style={{
              background: 'rgba(var(--accent-rgb),0.12)',
              border: '1px solid rgba(var(--accent-rgb),0.25)',
              color: 'var(--accent-light)',
            }}
            title={pullStatus}
          >
            <span className="material-symbols-outlined animate-spin" style={{ fontSize: '12px' }}>progress_activity</span>
            <span className="font-mono">{pullModel}</span>
            {pullProgress !== null && (
              <>
                <span className="opacity-60">·</span>
                <span>{pullProgress}%</span>
              </>
            )}
          </div>
        )}

        {/* Update available — downloading or error */}
        {updateAvailable && !updateReady && (
          <div
            className="flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px]"
            style={updateError
              ? { background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', color: 'rgb(248,113,113)' }
              : { background: 'rgba(80,200,120,0.10)', border: '1px solid rgba(80,200,120,0.25)', color: 'rgb(120,210,150)' }
            }
            title={updateError
              ? `Update failed — install manually from github.com/rcadden/golem/releases`
              : `Golem ${updateAvailable.version} is downloading`
            }
          >
            {updateError ? (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>error</span>
                <span>Update failed</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined animate-spin" style={{ fontSize: '12px' }}>downloading</span>
                <span>v{updateAvailable.version}{updateProgress !== null ? ` · ${updateProgress}%` : ' downloading…'}</span>
              </>
            )}
          </div>
        )}

        {/* Update ready to install */}
        {updateReady && (
          <button
            onClick={() => api.updater.install()}
            className="flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] transition-opacity hover:opacity-80"
            style={{
              background: 'rgba(80,200,120,0.18)',
              border: '1px solid rgba(80,200,120,0.4)',
              color: 'rgb(140,230,170)',
            }}
            title="Click to restart and install the update"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '12px', fontVariationSettings: "'FILL' 1" }}>update</span>
            Update ready — restart to install
          </button>
        )}
      </div>

      {/* Right: Windows controls (hidden on macOS — native traffic lights used instead) */}
      {platform !== 'darwin' && (
        <div className="no-drag flex h-full">
          {[
            { icon: 'remove',     action: () => api.window.minimize(), hover: 'var(--border-subtle)' },
            { icon: isMaximized ? 'filter_none' : 'crop_square', action: () => api.window.maximize(), hover: 'var(--border-subtle)' },
            { icon: 'close',      action: () => api.window.close(),    hover: 'rgba(239,68,68,0.8)' },
          ].map(({ icon, action, hover }) => (
            <button
              key={icon}
              onClick={action}
              className="w-11 h-full flex items-center justify-center transition-colors duration-150"
              style={{ color: 'var(--text-faint)' }}
              onMouseEnter={e => { e.currentTarget.style.background = hover; e.currentTarget.style.color = icon === 'close' ? '#fff' : 'var(--text-secondary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--text-faint)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>{icon}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
