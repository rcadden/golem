import { useState, useEffect } from 'react'

const api = window.golem

export default function TitleBar({ title = '' }) {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    api.window.isMaximized().then(setIsMaximized)
    api.window.onMaximizeChange(setIsMaximized)
    return () => api.window.offMaximizeChange()
  }, [])

  return (
    <div
      className="drag flex items-center justify-between h-8 shrink-0 select-none"
      style={{ background: '#111118', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
    >
      {/* Left: conversation title */}
      <div className="no-drag px-4 text-[11px] font-medium tracking-wide truncate max-w-[60%]"
        style={{ color: 'rgba(196,192,216,0.35)' }}>
        {title}
      </div>

      {/* Right: Windows controls */}
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
    </div>
  )
}
