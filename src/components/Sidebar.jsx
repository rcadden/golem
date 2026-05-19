import { useState, useRef } from 'react'
import SigilModal from './SigilModal'

const ICON_SRC = '/icon.png'

const api = window.golem

export default function Sidebar({
  conversations, activeConvId, activeView,
  sigils,
  onNewChat, onNewChatWithSigil,
  onSelectConv, onDeleteConv, onRenameConv, onPinConv, onUnpinConv,
  onSetView,
  onSigilsChange,
}) {
  const [contextMenu, setContextMenu] = useState(null)   // { x, y, convId }
  const [sigilMenu, setSigilMenu] = useState(null)       // { x, y, sigilId }
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [sigilModal, setSigilModal] = useState(null)     // null | { sigil: null|object }
  const renameRef = useRef(null)

  // ── Conversation rename ───────────────────────────────────────────────────────

  function handleRightClick(e, convId) {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, convId })
  }

  function closeMenu() { setContextMenu(null) }

  function startRename(conv) {
    setRenamingId(conv.id)
    setRenameValue(conv.title)
    closeMenu()
    setTimeout(() => renameRef.current?.select(), 50)
  }

  async function commitRename(id) {
    if (renameValue.trim()) await onRenameConv(id, renameValue.trim())
    setRenamingId(null)
  }

  // ── Sigil CRUD ────────────────────────────────────────────────────────────────

  function handleSigilRightClick(e, sigilId) {
    e.preventDefault()
    setSigilMenu({ x: e.clientX, y: e.clientY, sigilId })
  }

  async function handleSigilSave(id, name, content) {
    if (id) {
      await api.db.updateSigil(id, name, content)
    } else {
      await api.db.createSigil(name, content)
    }
    await onSigilsChange()
  }

  async function handleSigilDelete(id) {
    await api.db.deleteSigil(id)
    setSigilMenu(null)
    await onSigilsChange()
  }

  // ── Shared nav item ───────────────────────────────────────────────────────────

  const navItem = (label, icon, viewName) => {
    const isActive = (viewName === 'settings' || viewName === 'models') && activeView === viewName
    return (
      <button
        onClick={() => onSetView(viewName)}
        className="flex items-center gap-2.5 px-2 py-2 rounded-lg w-full text-left transition-all duration-150 no-drag"
        style={isActive
          ? { background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }
          : { color: 'rgba(196,192,216,0.6)' }
        }
        onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#d4d0e8' } }}
        onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(196,192,216,0.6)' } }}
      >
        <span className="material-symbols-outlined text-[18px]"
          style={isActive ? { fontVariationSettings: "'FILL' 1", color: '#818cf8' } : {}}>
          {icon}
        </span>
        <span className="text-[13px] font-medium">{label}</span>
      </button>
    )
  }

  // ── Conversation row ──────────────────────────────────────────────────────────

  function ConvRow({ conv }) {
    const isActive = activeConvId === conv.id && activeView === 'chat'
    return (
      <div className="relative group">
        {renamingId === conv.id ? (
          <input
            ref={renameRef}
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={() => commitRename(conv.id)}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename(conv.id)
              if (e.key === 'Escape') setRenamingId(null)
            }}
            className="w-full rounded-lg px-3 py-2 text-[13px] text-on-surface focus:outline-none"
            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)' }}
          />
        ) : (
          <button
            onClick={() => { onSelectConv(conv.id); onSetView('chat') }}
            onDoubleClick={() => startRename(conv)}
            onContextMenu={e => handleRightClick(e, conv.id)}
            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left transition-all duration-150"
            style={isActive ? { background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' } : {}}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = '' }}
          >
            <span
              className="material-symbols-outlined shrink-0"
              style={{ fontSize: '15px', color: isActive ? '#818cf8' : 'rgba(196,192,216,0.4)' }}
            >
              {conv.pinned ? 'keep' : 'chat_bubble'}
            </span>
            <span
              className="text-[13px] truncate leading-tight flex-1"
              style={{ color: isActive ? '#c7c4ff' : 'rgba(196,192,216,0.7)' }}
            >
              {conv.title}
            </span>
            {conv.sigil_name && (
              <span
                className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
              >
                {conv.sigil_name}
              </span>
            )}
          </button>
        )}
      </div>
    )
  }

  const pinned = conversations.filter(c => c.pinned)
  const recent = conversations.filter(c => !c.pinned)

  return (
    <>
      <nav
        className="flex flex-col w-64 shrink-0 h-full"
        style={{ background: '#111118', borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Header */}
        <div className="drag flex items-center gap-3 px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <img src={ICON_SRC} alt="Golem" className="w-8 h-8 rounded-xl no-drag" onError={e => { e.target.style.display = 'none' }} />
          <div className="no-drag">
            <div className="text-[17px] font-bold text-on-surface leading-tight tracking-tight" style={{ fontFamily: 'Hanken Grotesk' }}>Golem</div>
            <div className="text-[11px] text-on-surface-variant/50 tracking-wide">Local Intelligence</div>
          </div>
        </div>

        {/* New Chat */}
        <div className="px-4 pt-4 pb-2">
          <button
            onClick={onNewChat}
            className="no-drag w-full flex items-center justify-center gap-2 text-white py-2.5 px-4 rounded-xl text-[13px] font-medium transition-all duration-200 active:scale-[0.97]"
            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)', boxShadow: '0 0 0 0 rgba(99,102,241,0)' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(99,102,241,0.35)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 0 0 rgba(99,102,241,0)'}
          >
            <span className="material-symbols-outlined text-[17px]">add</span>
            New Chat
          </button>
        </div>

        {/* Nav links */}
        <div className="px-3 pb-2 flex flex-col gap-0.5 no-drag">
          {navItem('Chat', 'chat', 'chat')}
          {navItem('Models', 'deployed_code', 'models')}
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto px-3 mt-2 no-drag flex flex-col gap-3 pb-2">

          {/* Sigils */}
          <div>
            <div className="px-2 mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-on-surface-variant/40 uppercase tracking-widest">Sigils</span>
              <button
                onClick={() => setSigilModal({ sigil: null })}
                className="p-0.5 rounded hover:bg-white/5 text-on-surface-variant/40 hover:text-on-surface-variant transition-colors"
                title="New Sigil"
              >
                <span className="material-symbols-outlined text-[14px]">add</span>
              </button>
            </div>
            {sigils.length === 0 ? (
              <button
                onClick={() => setSigilModal({ sigil: null })}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] text-on-surface-variant/40 hover:text-on-surface-variant/70 hover:bg-white/03 transition-colors text-left"
              >
                <span className="material-symbols-outlined text-[14px]">add_circle</span>
                Create your first sigil
              </button>
            ) : (
              <div className="flex flex-col gap-px">
                {sigils.map(sigil => (
                  <button
                    key={sigil.id}
                    onClick={() => onNewChatWithSigil(sigil.id)}
                    onContextMenu={e => handleSigilRightClick(e, sigil.id)}
                    className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left transition-all duration-150"
                    style={{ color: 'rgba(196,192,216,0.7)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#d4d0e8' }}
                    onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(196,192,216,0.7)' }}
                  >
                    <span className="material-symbols-outlined shrink-0 text-[#6366f1]" style={{ fontSize: '15px', fontVariationSettings: "'FILL' 1" }}>auto_fix_high</span>
                    <span className="text-[13px] truncate">{sigil.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pinned conversations */}
          {pinned.length > 0 && (
            <div>
              <div className="px-2 mb-1.5">
                <span className="text-[10px] font-semibold text-on-surface-variant/40 uppercase tracking-widest">Pinned</span>
              </div>
              <div className="flex flex-col gap-px">
                {pinned.map(conv => <ConvRow key={conv.id} conv={conv} />)}
              </div>
            </div>
          )}

          {/* Recent conversations */}
          <div>
            <div className="px-2 mb-1.5">
              <span className="text-[10px] font-semibold text-on-surface-variant/40 uppercase tracking-widest">Recent</span>
            </div>
            <div className="flex flex-col gap-px">
              {recent.map(conv => <ConvRow key={conv.id} conv={conv} />)}
            </div>
          </div>
        </div>

        {/* Bottom nav */}
        <div className="px-3 pb-3 pt-2 no-drag flex flex-col gap-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {navItem('Settings', 'settings', 'settings')}
          {navItem('Help', 'help', 'help')}
        </div>
      </nav>

      {/* Conversation context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeMenu} />
          <div
            className="fixed z-50 rounded-xl shadow-2xl py-1 min-w-[160px]"
            style={{ top: contextMenu.y, left: contextMenu.x, background: '#1a1a26', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}
          >
            {(() => {
              const conv = conversations.find(c => c.id === contextMenu.convId)
              return (
                <>
                  <button
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-on-surface hover:bg-white/5 transition-colors"
                    onClick={() => { startRename(conv) }}
                  >
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant">edit</span>
                    Rename
                  </button>
                  {conv?.pinned ? (
                    <button
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-on-surface hover:bg-white/5 transition-colors"
                      onClick={() => { onUnpinConv(contextMenu.convId); closeMenu() }}
                    >
                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant">keep_off</span>
                      Unpin
                    </button>
                  ) : (
                    <button
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-on-surface hover:bg-white/5 transition-colors"
                      onClick={() => { onPinConv(contextMenu.convId); closeMenu() }}
                    >
                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant">keep</span>
                      Pin
                    </button>
                  )}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '2px 0' }} />
                  <button
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-red-400 hover:bg-red-500/10 transition-colors"
                    onClick={() => { onDeleteConv(contextMenu.convId); closeMenu() }}
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                    Delete
                  </button>
                </>
              )
            })()}
          </div>
        </>
      )}

      {/* Sigil context menu */}
      {sigilMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setSigilMenu(null)} />
          <div
            className="fixed z-50 rounded-xl shadow-2xl py-1 min-w-[160px]"
            style={{ top: sigilMenu.y, left: sigilMenu.x, background: '#1a1a26', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}
          >
            <button
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-on-surface hover:bg-white/5 transition-colors"
              onClick={() => {
                const s = sigils.find(x => x.id === sigilMenu.sigilId)
                setSigilModal({ sigil: s })
                setSigilMenu(null)
              }}
            >
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">edit</span>
              Edit
            </button>
            <button
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-red-400 hover:bg-red-500/10 transition-colors"
              onClick={() => handleSigilDelete(sigilMenu.sigilId)}
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
              Delete
            </button>
          </div>
        </>
      )}

      {/* Sigil modal */}
      {sigilModal && (
        <SigilModal
          sigil={sigilModal.sigil}
          onSave={handleSigilSave}
          onClose={() => setSigilModal(null)}
        />
      )}
    </>
  )
}
