import { useState, useRef } from 'react'
import SigilModal from './SigilModal'
import SkillModal from './SkillModal'

const ICON_SRC = '/icon.png'
const api = window.golem

export default function Sidebar({
  conversations, activeConvId, activeView,
  projects, sigils, skills = [],
  onNewChat, onNewChatWithSigil, onNewChatWithSkill, onNewChatInProject,
  onSelectConv, onDeleteConv, onRenameConv, onPinConv, onUnpinConv, onExportConv,
  onSetView,
  onSigilsChange, onSkillsChange, onProjectsChange,
}) {
  const [convMenu, setConvMenu] = useState(null)      // { x, y, convId }
  const [sigilMenu, setSigilMenu] = useState(null)    // { x, y, sigilId }
  const [skillMenu, setSkillMenu] = useState(null)    // { x, y, skillId }
  const [skillModal, setSkillModal] = useState(null)  // null | 'new' | skillId (number)
  const [projectMenu, setProjectMenu] = useState(null)// { x, y, projectId }
  const [syncingProjectId, setSyncingProjectId] = useState(null)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [renamingProjectId, setRenamingProjectId] = useState(null)
  const [renameProjectValue, setRenameProjectValue] = useState('')
  const [expandedProjects, setExpandedProjects] = useState(new Set())
  const [expandedFileLists, setExpandedFileLists] = useState(new Set())
  const [sigilModal, setSigilModal] = useState(null)
  const [search, setSearch] = useState('')
  const renameRef = useRef(null)
  const renameProjectRef = useRef(null)
  const searchRef = useRef(null)

  // ── Conversation menu ─────────────────────────────────────────────────────────

  function openConvMenu(e, convId) {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setConvMenu({ x: rect.left - 8, y: rect.bottom + 4, convId })
  }

  function startRename(conv) {
    setRenamingId(conv.id)
    setRenameValue(conv.title)
    setConvMenu(null)
    setTimeout(() => renameRef.current?.select(), 50)
  }

  async function commitRename(id) {
    if (renameValue.trim()) await onRenameConv(id, renameValue.trim())
    setRenamingId(null)
  }

  // ── Project actions ───────────────────────────────────────────────────────────

  function toggleProject(id) {
    setExpandedProjects(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function openProjectMenu(e, projectId) {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setProjectMenu({ x: rect.left - 8, y: rect.bottom + 4, projectId })
  }

  function startRenameProject(project) {
    setRenamingProjectId(project.id)
    setRenameProjectValue(project.name)
    setProjectMenu(null)
    setTimeout(() => renameProjectRef.current?.select(), 50)
  }

  async function commitRenameProject(id) {
    if (renameProjectValue.trim()) await api.db.renameProject(id, renameProjectValue.trim())
    setRenamingProjectId(null)
    await onProjectsChange()
  }

  async function handleAddFileToProject(projectId) {
    setProjectMenu(null)
    const file = await api.dialog.openFile()
    if (!file || file.error) return
    await api.db.addProjectFile(projectId, file.name, file.content)
    await onProjectsChange()
  }

  async function handleRemoveProjectFile(fileId) {
    await api.db.removeProjectFile(fileId)
    await onProjectsChange()
  }

  async function handleSetDirectory(projectId) {
    setProjectMenu(null)
    const dirPath = await api.dialog.openDirectory()
    if (!dirPath) return
    setSyncingProjectId(projectId)
    try {
      await api.db.syncProjectDirectory(projectId, dirPath)
      await onProjectsChange()
    } finally {
      setSyncingProjectId(null)
    }
  }

  async function handleSyncDirectory(projectId, dirPath) {
    setSyncingProjectId(projectId)
    try {
      await api.db.syncProjectDirectory(projectId, dirPath)
      await onProjectsChange()
    } finally {
      setSyncingProjectId(null)
    }
  }

  async function handleDeleteSkill(skillId) {
    await api.db.deleteSkill(skillId)
    await onSkillsChange()
    setSkillMenu(null)
  }

  async function handleDeleteProject(id) {
    await api.db.deleteProject(id)
    setProjectMenu(null)
    setExpandedProjects(prev => { const next = new Set(prev); next.delete(id); return next })
    await onProjectsChange()
  }

  async function handleCreateProject() {
    const id = await api.db.createProject('New Project')
    await onProjectsChange()
    const project = { id, name: 'New Project' }
    setExpandedProjects(prev => new Set([...prev, id]))
    setRenamingProjectId(id)
    setRenameProjectValue('New Project')
    setTimeout(() => renameProjectRef.current?.select(), 80)
  }

  // ── Sigil actions ─────────────────────────────────────────────────────────────

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
    const isActive = (viewName === 'settings' || viewName === 'stats') && activeView === viewName
    return (
      <button
        onClick={() => onSetView(viewName)}
        className="flex items-center gap-2.5 px-2 py-2 rounded-lg w-full text-left transition-all duration-150 no-drag"
        style={isActive ? { background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent-light)' } : { color: 'rgba(196,192,216,0.6)' }}
        onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#d4d0e8' } }}
        onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(196,192,216,0.6)' } }}
      >
        <span className="material-symbols-outlined text-[18px]" style={isActive ? { fontVariationSettings: "'FILL' 1", color: 'var(--accent-mid)' } : {}}>{icon}</span>
        <span className="text-[13px] font-medium">{label}</span>
      </button>
    )
  }

  // ── Conversation row ──────────────────────────────────────────────────────────

  function ConvRow({ conv, projectId = null }) {
    const isActive = activeConvId === conv.id && activeView === 'chat'

    return (
      <div className="relative group/conv">
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
            style={{ background: 'rgba(var(--accent-rgb),0.15)', border: '1px solid rgba(var(--accent-rgb),0.4)' }}
          />
        ) : (
          <>
            <button
              onClick={() => { onSelectConv(conv.id); onSetView('chat') }}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left transition-all duration-150"
              style={{
                paddingRight: '2rem',
                ...(isActive ? { background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent-light)' } : {}),
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = '' }}
            >
              <span
                className="material-symbols-outlined shrink-0"
                style={{ fontSize: '15px', color: isActive ? 'var(--accent-mid)' : 'rgba(196,192,216,0.4)' }}
              >
                {conv.pinned ? 'keep' : 'chat_bubble'}
              </span>
              <span
                className="text-[13px] truncate leading-tight flex-1"
                style={{ color: isActive ? 'var(--accent-light)' : 'rgba(196,192,216,0.7)' }}
              >
                {conv.title}
              </span>
              {conv.sigil_name && (
                <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent-mid)' }}>
                  {conv.sigil_name}
                </span>
              )}
            </button>

            {/* Three-dots menu button */}
            <button
              onClick={e => openConvMenu(e, conv.id)}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover/conv:opacity-100 transition-opacity"
              style={{ color: 'rgba(196,192,216,0.5)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(196,192,216,0.9)' }}
              onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(196,192,216,0.5)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>more_horiz</span>
            </button>
          </>
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
            style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-mid) 100%)', boxShadow: '0 0 0 0 rgba(var(--accent-rgb),0)' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(var(--accent-rgb),0.35)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 0 0 rgba(var(--accent-rgb),0)'}
          >
            <span className="material-symbols-outlined text-[17px]">add</span>
            New Chat
          </button>
        </div>

        {/* Nav links */}
        <div className="px-3 pb-2 flex flex-col gap-0.5 no-drag">
          {navItem('Chat', 'chat', 'chat')}
        </div>

        {/* Search */}
        <div className="px-3 pb-2 no-drag">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px]"
              style={{ color: 'rgba(196,192,216,0.35)' }}>search</span>
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="w-full rounded-lg pl-8 pr-8 py-1.5 text-[13px] text-on-surface placeholder:text-on-surface-variant/30 outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
              onFocus={e => e.target.style.borderColor = 'rgba(var(--accent-rgb),0.4)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.07)'}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2"
                style={{ color: 'rgba(196,192,216,0.4)' }}
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            )}
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto px-3 no-drag flex flex-col gap-3 pb-2">

          {/* Search results */}
          {search.trim() && (() => {
            const q = search.toLowerCase()
            const allConvs = [
              ...conversations,
              ...projects.flatMap(p => p.conversations || [])
            ]
            const results = allConvs.filter(c => c.title.toLowerCase().includes(q))
            return (
              <div>
                <div className="px-2 mb-1.5">
                  <span className="text-[10px] font-semibold text-on-surface-variant/40 uppercase tracking-widest">
                    {results.length} result{results.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {results.length === 0 ? (
                  <div className="px-2 py-3 text-[13px] text-on-surface-variant/40 text-center">No matches</div>
                ) : (
                  <div className="flex flex-col gap-px">
                    {results.map(conv => <ConvRow key={conv.id} conv={conv} />)}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Normal sections — hidden during search */}
          {!search.trim() && (<>

          {/* Projects */}
          <div>
            <div className="px-2 mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-on-surface-variant/40 uppercase tracking-widest">Projects</span>
              <button
                onClick={handleCreateProject}
                className="p-0.5 rounded hover:bg-white/5 text-on-surface-variant/40 hover:text-on-surface-variant transition-colors"
                title="New Project"
              >
                <span className="material-symbols-outlined text-[14px]">add</span>
              </button>
            </div>

            {projects.length === 0 ? (
              <button
                onClick={handleCreateProject}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] text-on-surface-variant/40 hover:text-on-surface-variant/70 hover:bg-white/5 transition-colors text-left"
              >
                <span className="material-symbols-outlined text-[14px]">create_new_folder</span>
                Create your first project
              </button>
            ) : (
              <div className="flex flex-col gap-px">
                {projects.map(project => {
                  const isExpanded = expandedProjects.has(project.id)
                  return (
                    <div key={project.id}>
                      {/* Project header */}
                      <div className="relative group/proj">
                        {renamingProjectId === project.id ? (
                          <input
                            ref={renameProjectRef}
                            value={renameProjectValue}
                            onChange={e => setRenameProjectValue(e.target.value)}
                            onBlur={() => commitRenameProject(project.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') commitRenameProject(project.id)
                              if (e.key === 'Escape') setRenamingProjectId(null)
                            }}
                            className="w-full rounded-lg px-3 py-2 text-[13px] text-on-surface focus:outline-none"
                            style={{ background: 'rgba(var(--accent-rgb),0.15)', border: '1px solid rgba(var(--accent-rgb),0.4)' }}
                          />
                        ) : (
                          <>
                            <button
                              onClick={() => toggleProject(project.id)}
                              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-all"
                              style={{ paddingRight: '2rem', color: 'rgba(196,192,216,0.7)' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#d4d0e8' }}
                              onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(196,192,216,0.7)' }}
                            >
                              <span className="material-symbols-outlined text-[15px]" style={{ color: 'var(--accent)', fontVariationSettings: "'FILL' 1" }}>
                                {isExpanded ? 'folder_open' : 'folder'}
                              </span>
                              <span className="text-[13px] font-medium truncate flex-1">{project.name}</span>
                              <span className="material-symbols-outlined shrink-0 transition-transform" style={{ fontSize: '14px', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', color: 'rgba(196,192,216,0.3)' }}>
                                expand_more
                              </span>
                            </button>
                            <button
                              onClick={e => openProjectMenu(e, project.id)}
                              className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover/proj:opacity-100 transition-opacity"
                              style={{ color: 'rgba(196,192,216,0.5)' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(196,192,216,0.9)' }}
                              onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(196,192,216,0.5)' }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>more_horiz</span>
                            </button>
                          </>
                        )}
                      </div>

                      {/* Expanded project contents */}
                      {isExpanded && (
                        <div className="pl-4 mt-0.5 flex flex-col gap-px">
                          {/* Directory badge */}
                          {project.directory_path && (
                            <div className="flex items-center gap-1.5 px-2 py-1 mb-1">
                              <span className="material-symbols-outlined text-[14px] opacity-40">folder_open</span>
                              <span
                                className="text-[11px] opacity-40 truncate flex-1"
                                title={project.directory_path}
                              >
                                {project.directory_path.split(/[/\\]/).pop()}
                              </span>
                              <button
                                onClick={() => handleSyncDirectory(project.id, project.directory_path)}
                                disabled={syncingProjectId === project.id}
                                className="text-[11px] opacity-50 hover:opacity-100 px-1.5 py-0.5 rounded hover:bg-white/10 disabled:opacity-25"
                                title="Re-sync directory"
                              >
                                {syncingProjectId === project.id ? '…' : 'Sync'}
                              </button>
                            </div>
                          )}

                          {/* Per-project context window override */}
                          <div className="flex items-center gap-1.5 px-2 py-1 mb-1">
                            <span className="material-symbols-outlined text-[14px] opacity-40">memory</span>
                            <span className="text-[11px] opacity-40 shrink-0">ctx:</span>
                            <div className="flex gap-1 flex-wrap">
                              {[
                                { label: 'Default', value: null },
                                { label: '32K',     value: 32768 },
                                { label: '64K',     value: 65536 },
                                { label: '128K',    value: 131072 },
                              ].map(opt => {
                                const isActive = (project.num_ctx ?? null) === opt.value
                                return (
                                  <button
                                    key={opt.label}
                                    onClick={async () => {
                                      await api.db.setProjectNumCtx(project.id, opt.value)
                                      await onProjectsChange()
                                    }}
                                    className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                                      isActive
                                        ? 'bg-[var(--accent)]/20 text-[var(--accent-light)]'
                                        : 'opacity-40 hover:opacity-80 hover:bg-white/10'
                                    }`}
                                    title={opt.value ? `Override context window to ${opt.label} for this project` : 'Use the global context window setting'}
                                  >
                                    {opt.label}
                                  </button>
                                )
                              })}
                            </div>
                          </div>

                          {/* Files — collapsible, default collapsed for directory-backed projects */}
                          {project.files?.length > 0 && (() => {
                            const fileListVisible = !project.directory_path || expandedFileLists.has(project.id)
                            return (
                              <>
                                <button
                                  onClick={() => setExpandedFileLists(prev => {
                                    const next = new Set(prev)
                                    if (next.has(project.id)) next.delete(project.id)
                                    else next.add(project.id)
                                    return next
                                  })}
                                  className="flex items-center gap-1.5 px-2 py-1 w-full text-left rounded-lg transition-colors hover:bg-white/5"
                                  style={{ color: 'rgba(196,192,216,0.4)' }}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>description</span>
                                  <span className="text-[11px] flex-1">Files ({project.files.length})</span>
                                  <span
                                    className="material-symbols-outlined transition-transform"
                                    style={{ fontSize: '13px', transform: fileListVisible ? 'rotate(180deg)' : 'rotate(0deg)' }}
                                  >expand_more</span>
                                </button>
                                {fileListVisible && project.files.map(file => (
                                  <div key={file.id} className="relative group/file flex items-center gap-2 px-2 py-1.5 rounded-lg"
                                    style={{ color: 'rgba(196,192,216,0.5)' }}>
                                    <span className="material-symbols-outlined shrink-0" style={{ fontSize: '13px' }}>description</span>
                                    <span className="text-[12px] truncate flex-1">{file.name}</span>
                                    <button
                                      onClick={() => handleRemoveProjectFile(file.id)}
                                      className="opacity-0 group-hover/file:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-500/10 hover:text-red-400"
                                      title="Remove file"
                                    >
                                      <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>close</span>
                                    </button>
                                  </div>
                                ))}
                              </>
                            )
                          })()}

                          {/* Add file button */}
                          <button
                            onClick={() => handleAddFileToProject(project.id)}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] transition-colors text-left"
                            style={{ color: 'rgba(196,192,216,0.35)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = 'rgba(196,192,216,0.6)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(196,192,216,0.35)' }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>attach_file</span>
                            Add file
                          </button>

                          {/* Project conversations */}
                          {project.conversations?.map(conv => (
                            <ConvRow key={conv.id} conv={conv} projectId={project.id} />
                          ))}

                          {/* New chat in project */}
                          <button
                            onClick={() => onNewChatInProject(project.id)}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] transition-colors text-left"
                            style={{ color: 'rgba(var(--accent-rgb),0.6)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(var(--accent-rgb),0.08)'; e.currentTarget.style.color = 'var(--accent-mid)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(var(--accent-rgb),0.6)' }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>add</span>
                            New chat
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

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
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] text-on-surface-variant/40 hover:text-on-surface-variant/70 hover:bg-white/5 transition-colors text-left"
              >
                <span className="material-symbols-outlined text-[14px]">add_circle</span>
                Create your first sigil
              </button>
            ) : (
              <div className="flex flex-col gap-px">
                {sigils.map(sigil => (
                  <div key={sigil.id} className="relative group/sigil">
                    <button
                      onClick={() => onNewChatWithSigil(sigil.id)}
                      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left transition-all duration-150"
                      style={{ paddingRight: '2rem', color: 'rgba(196,192,216,0.7)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#d4d0e8' }}
                      onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(196,192,216,0.7)' }}
                    >
                      <span className="material-symbols-outlined shrink-0" style={{ fontSize: '15px', fontVariationSettings: "'FILL' 1", color: 'var(--accent)' }}>auto_fix_high</span>
                      <span className="text-[13px] truncate">{sigil.name}</span>
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); const rect = e.currentTarget.getBoundingClientRect(); setSigilMenu({ x: rect.left - 8, y: rect.bottom + 4, sigilId: sigil.id }) }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover/sigil:opacity-100 transition-opacity"
                      style={{ color: 'rgba(196,192,216,0.5)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(196,192,216,0.9)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(196,192,216,0.5)' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>more_horiz</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Skills */}
          <div>
            <div className="px-2 mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-on-surface-variant/40 uppercase tracking-widest">Skills</span>
              <button
                onClick={() => setSkillModal('new')}
                className="p-0.5 rounded hover:bg-white/5 text-on-surface-variant/40 hover:text-on-surface-variant transition-colors"
                title="New Skill"
              >
                <span className="material-symbols-outlined text-[14px]">add</span>
              </button>
            </div>

            {skills.length === 0 ? (
              <button
                onClick={() => setSkillModal('new')}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] text-on-surface-variant/40 hover:text-on-surface-variant/70 hover:bg-white/5 transition-colors text-left"
              >
                <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                Create your first skill
              </button>
            ) : (
              <div className="flex flex-col gap-px">
                {Object.entries(
                  skills.reduce((acc, skill) => {
                    const cat = skill.category || 'General'
                    if (!acc[cat]) acc[cat] = []
                    acc[cat].push(skill)
                    return acc
                  }, {})
                ).map(([cat, catSkills]) => (
                  <div key={cat}>
                    <div className="px-2 py-0.5 text-[10px] opacity-30 uppercase tracking-wider">{cat}</div>
                    {catSkills.map(skill => (
                      <div
                        key={skill.id}
                        className="relative group/skill"
                      >
                        <button
                          onClick={() => onNewChatWithSkill(skill.id)}
                          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left transition-all duration-150"
                          style={{ paddingRight: '2rem', color: 'rgba(196,192,216,0.7)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#d4d0e8' }}
                          onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(196,192,216,0.7)' }}
                        >
                          <span className="material-symbols-outlined shrink-0" style={{ fontSize: '15px', fontVariationSettings: "'FILL' 1", color: 'var(--accent)' }}>auto_awesome</span>
                          <span className="text-[13px] truncate">{skill.name}</span>
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); const rect = e.currentTarget.getBoundingClientRect(); setSkillMenu({ x: rect.left - 8, y: rect.bottom + 4, skillId: skill.id }) }}
                          className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover/skill:opacity-100 transition-opacity"
                          style={{ color: 'rgba(196,192,216,0.5)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(196,192,216,0.9)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(196,192,216,0.5)' }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>more_horiz</span>
                        </button>
                      </div>
                    ))}
                  </div>
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

          </>)}
        </div>

        {/* Bottom nav */}
        <div className="px-3 pb-3 pt-2 no-drag flex flex-col gap-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {navItem('Stats', 'bar_chart', 'stats')}
          {navItem('Settings', 'settings', 'settings')}
          {navItem('Help', 'help', 'help')}
        </div>
      </nav>

      {/* Conversation context menu */}
      {convMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setConvMenu(null)} />
          <div
            className="fixed z-50 rounded-xl shadow-2xl py-1 min-w-[160px]"
            style={{ top: convMenu.y, left: convMenu.x, background: '#1a1a26', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}
          >
            {(() => {
              const conv = [...conversations, ...projects.flatMap(p => p.conversations || [])].find(c => c.id === convMenu.convId)
              return (
                <>
                  <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-on-surface hover:bg-white/5 transition-colors"
                    onClick={() => { startRename(conv) }}>
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant">edit</span>
                    Rename
                  </button>
                  <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-on-surface hover:bg-white/5 transition-colors"
                    onClick={() => { onExportConv(convMenu.convId); setConvMenu(null) }}>
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant">download</span>
                    Export as Markdown
                  </button>
                  {conv?.pinned ? (
                    <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-on-surface hover:bg-white/5 transition-colors"
                      onClick={() => { onUnpinConv(convMenu.convId); setConvMenu(null) }}>
                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant">keep_off</span>
                      Unpin
                    </button>
                  ) : (
                    <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-on-surface hover:bg-white/5 transition-colors"
                      onClick={() => { onPinConv(convMenu.convId); setConvMenu(null) }}>
                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant">keep</span>
                      Pin
                    </button>
                  )}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '2px 0' }} />
                  <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-red-400 hover:bg-red-500/10 transition-colors"
                    onClick={() => { onDeleteConv(convMenu.convId); setConvMenu(null) }}>
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                    Delete
                  </button>
                </>
              )
            })()}
          </div>
        </>
      )}

      {/* Project context menu */}
      {projectMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setProjectMenu(null)} />
          <div
            className="fixed z-50 rounded-xl shadow-2xl py-1 min-w-[170px]"
            style={{ top: projectMenu.y, left: projectMenu.x, background: '#1a1a26', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}
          >
            {(() => {
              const proj = projects.find(p => p.id === projectMenu.projectId)
              return (
                <>
                  <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-on-surface hover:bg-white/5 transition-colors"
                    onClick={() => startRenameProject(proj)}>
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant">edit</span>
                    Rename
                  </button>
                  <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-on-surface hover:bg-white/5 transition-colors"
                    onClick={() => handleAddFileToProject(projectMenu.projectId)}>
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant">attach_file</span>
                    Add file
                  </button>
                  <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-on-surface hover:bg-white/5 transition-colors"
                    onClick={() => handleSetDirectory(projectMenu.projectId)}>
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant">folder_open</span>
                    Set Directory
                  </button>
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '2px 0' }} />
                  <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-red-400 hover:bg-red-500/10 transition-colors"
                    onClick={() => handleDeleteProject(projectMenu.projectId)}>
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                    Delete project
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
            <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-on-surface hover:bg-white/5 transition-colors"
              onClick={() => { const s = sigils.find(x => x.id === sigilMenu.sigilId); setSigilModal({ sigil: s }); setSigilMenu(null) }}>
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">edit</span>
              Edit
            </button>
            <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-red-400 hover:bg-red-500/10 transition-colors"
              onClick={() => handleSigilDelete(sigilMenu.sigilId)}>
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

      {/* Skill context menu */}
      {skillMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setSkillMenu(null)} />
          <div
            className="fixed z-50 rounded-xl shadow-2xl py-1 min-w-[160px]"
            style={{ top: skillMenu.y, left: skillMenu.x, background: '#1a1a26', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}
          >
            <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-on-surface hover:bg-white/5 transition-colors"
              onClick={() => { setSkillModal(skillMenu.skillId); setSkillMenu(null) }}>
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">edit</span>
              Edit
            </button>
            <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-red-400 hover:bg-red-500/10 transition-colors"
              onClick={() => handleDeleteSkill(skillMenu.skillId)}>
              <span className="material-symbols-outlined text-[16px]">delete</span>
              Delete
            </button>
          </div>
        </>
      )}

      {/* Skill modal */}
      {skillModal && (
        <SkillModal
          skillId={skillModal === 'new' ? null : skillModal}
          onClose={() => setSkillModal(null)}
          onSaved={onSkillsChange}
        />
      )}
    </>
  )
}
