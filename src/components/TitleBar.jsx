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
  const [platform, setPlatform] = useState('win32')

  useEffect(() => {
    api.window.isMaximized().then(setIsMaximized)
    api.window.onMaximizeChange(setIsMaximized)
    api.updater.onAvailable(info => setUpdateAvailable(info))
    api.updater.onDownloaded(() => setUpdateReady(true))
    api.system.platform().then(setPlatform)
    return () => {
      api.window.offMaximizeChange()
      api.updater.offAvailable()
      api.updater.offDownloaded()
    }
  }, [])

  return (
    <div
      className="drag flex items-center justify-between h-8 shrink-0 select-none"
      style={{ background: '#111118', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
    >
      {/* Left: sidebar toggle + conversation title */}
      <div className="no-drag flex items-center gap-0.5 pl-1 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded transition-colors duration-150 hover:bg-white/8"
          style={{ color: 'rgba(196,192,216,0.35)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'rgba(196,192,216,0.75)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(196,192,216,0.35)' }}
          title={sidebarOpen ? 'Hide sidebar (Ctrl+B)' : 'Show sidebar (Ctrl+B)'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
            {sidebarOpen ? 'left_panel_close' : 'left_panel_open'}
          </span>
        </button>
        <span className="px-2 text-[11px] font-medium tracking-wide truncate max-w-[55%]"
          style={{ color: 'rgba(196,192,216,0.35)' }}>
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

        {/* Update available — downloading */}
        {updateAvailable && !updateReady && (
          <div
            className="flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px]"
            style={{
              background: 'rgba(80,200,120,0.10)',
              border: '1px solid rgba(80,200,120,0.25)',
              color: 'rgb(120,210,150)',
            }}
            title={`Golem ${updateAvailable.version} is downloading in the background`}
          >
            <span className="material-symbols-outlined animate-spin" style={{ fontSize: '12px' }}>downloading</span>
            <span>v{updateAvailable.version} downloading…</span>
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
            { icon: 'remove',     action: () => api.window.minimize(), hover: 'rgba(255,255,255,0.06)' },
            { icon: isMaximized ? 'filter_none' : 'crop_square', action: () => api.window.maximize(), hover: 'rgba(255,255,255,0.06)' },
            { icon: 'close',      action: () => api.window.close(),    hover: 'rgba(239,68,68,0.8)' },
          ].map(({ icon, action, hover }) => (
            <button
              key={icon}
              onClick={action}
              className="w-11 h-full flex items-center justify-center transition-colors duration-150"
              style={{ color: 'rgba(196,192,216,0.3)' }}
              onMouseEnter={e => { e.currentTarget.style.background = hover; e.currentTarget.style.color = icon === 'close' ? '#fff' : 'rgba(196,192,216,0.8)' }}
              onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(196,192,216,0.3)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>{icon}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
