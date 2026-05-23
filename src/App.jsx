import { useState, useEffect, useCallback } from 'react'
import { applyAccentColor } from './utils/accent'
import Sidebar from './components/Sidebar'
import ChatView from './components/ChatView'
import SettingsView from './components/SettingsView'
import StatsView from './components/StatsView'
import TitleBar from './components/TitleBar'

const api = window.golem

export default function App() {
  const [view, setView] = useState('chat')
  const [conversations, setConversations] = useState([])
  const [activeConvId, setActiveConvId] = useState(null)
  const [models, setModels] = useState([])
  const [sigils, setSigils] = useState([])
  const [skills, setSkills] = useState([])
  const [projects, setProjects] = useState([])   // each has .files and .conversations
  const [ollamaReady, setOllamaReady] = useState(null)
  const [pendingInput, setPendingInput] = useState('')

  // App-level model-pull state so progress survives navigation between views.
  const [pulling, setPulling] = useState(false)
  const [pullModel, setPullModel] = useState('')
  const [pullStatus, setPullStatus] = useState('')
  const [pullProgress, setPullProgress] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    api.ollama.onPullProgress(data => {
      setPullStatus(data.status || '')
      if (data.total && data.completed) {
        setPullProgress(Math.round((data.completed / data.total) * 100))
      }
    })
    return () => api.ollama.offPullProgress()
  }, [])

  useEffect(() => {
    async function init() {
      const accent = await api.db.getSetting('accent_color', '#6366f1')
      applyAccentColor(accent)
      const ready = await api.ollama.ensureRunning()
      setOllamaReady(ready)
      if (ready) {
        const m = await api.ollama.listModels()
        setModels(m)
      }
      const [convs, sigs, skls] = await Promise.all([
        api.db.listConversations(),
        api.db.listSigils(),
        api.db.listSkills(),
      ])
      setConversations(convs)
      setSigils(sigs)
      setSkills(skls)
      const projs = await loadProjectsWithData()
      setProjects(projs)
      // Always open to empty state — user can select from sidebar
    }
    init()
  }, [])

  async function loadProjectsWithData() {
    const projs = await api.db.listProjects()
    return Promise.all(projs.map(async p => ({
      ...p,
      files: await api.db.listProjectFiles(p.id),
      conversations: await api.db.listProjectConversations(p.id),
    })))
  }

  const refreshConversations = useCallback(async () => {
    const convs = await api.db.listConversations()
    setConversations(convs)
    return convs
  }, [])

  const refreshSigils = useCallback(async () => {
    const sigs = await api.db.listSigils()
    setSigils(sigs)
  }, [])

  const refreshSkills = useCallback(async () => {
    const s = await api.db.listSkills()
    setSkills(s)
  }, [])

  const refreshProjects = useCallback(async () => {
    const projs = await loadProjectsWithData()
    setProjects(projs)
    return projs
  }, [])

  const refreshModels = useCallback(async () => {
    const m = await api.ollama.listModels()
    setModels(m)
  }, [])

  const startPull = useCallback(async (name) => {
    const target = (name || '').trim()
    if (!target || pulling) return
    setPulling(true)
    setPullModel(target)
    setPullStatus('Starting…')
    setPullProgress(null)
    try {
      await api.ollama.pullModel(target)
      setPullStatus('Done')
      await refreshModels()
    } catch (e) {
      setPullStatus(`Error: ${e.message}`)
    } finally {
      setPulling(false)
      setPullProgress(null)
      setTimeout(() => { setPullStatus(''); setPullModel('') }, 3000)
    }
  }, [pulling, refreshModels])

  const deleteModel = useCallback(async (name) => {
    await api.ollama.deleteModel(name)
    await refreshModels()
  }, [refreshModels])

  async function getDefaultModel() {
    const defaultModel = await api.db.getSetting('default_model', models[0] || '')
    return defaultModel || models[0] || ''
  }

  async function handleNewChat() {
    const model = await getDefaultModel()
    if (!model) return
    const id = await api.db.createConversation('New Chat', model, null, null)
    await refreshConversations()
    setActiveConvId(id)
    setView('chat')
  }

  async function handleNewChatWithSigil(sigilId) {
    const model = await getDefaultModel()
    if (!model) return
    const sigil = sigils.find(s => s.id === sigilId)
    const id = await api.db.createConversation(sigil?.name ?? 'New Chat', model, sigilId, null)
    await refreshConversations()
    setActiveConvId(id)
    setView('chat')
  }

  async function handleNewChatWithSkill(skillId) {
    const model = await getDefaultModel()
    if (!model) return
    const skill = skills.find(s => s.id === skillId)
    const id = await api.db.createConversation(skill?.name ?? 'New Chat', model, null, null, skillId)
    await refreshConversations()
    setActiveConvId(id)
    if (skill?.starter_message) setPendingInput(skill.starter_message)
    setView('chat')
  }

  async function handleNewChatInProject(projectId) {
    const model = await getDefaultModel()
    if (!model) return
    const id = await api.db.createConversation('New Chat', model, null, projectId)
    await refreshProjects()
    setActiveConvId(id)
    setView('chat')
  }

  async function handleSelectConv(id) {
    setActiveConvId(id)
    setView('chat')
  }

  async function handleDeleteConv(id) {
    await api.db.deleteConversation(id)
    const [convs] = await Promise.all([refreshConversations(), refreshProjects()])
    if (activeConvId === id) {
      // fall back to first available conversation from any source
      const allConvs = [...convs, ...projects.flatMap(p => p.conversations || [])]
      setActiveConvId(allConvs[0]?.id ?? null)
    }
  }

  async function handleRenameConv(id, title) {
    await api.db.renameConversation(id, title)
    await Promise.all([refreshConversations(), refreshProjects()])
  }

  async function handlePinConv(id) {
    await api.db.pinConversation(id)
    await Promise.all([refreshConversations(), refreshProjects()])
  }

  async function handleUnpinConv(id) {
    await api.db.unpinConversation(id)
    await Promise.all([refreshConversations(), refreshProjects()])
  }

  async function handleExportConv(id) {
    const conv = conversations.find(c => c.id === id)
      ?? projects.flatMap(p => p.conversations || []).find(c => c.id === id)
    if (!conv) return
    const messages = await api.db.getMessages(id)
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    const lines = [
      `# ${conv.title}`,
      ``,
      `_Exported from Golem — ${date}_`,
      ``,
      `---`,
      ``,
    ]
    for (const msg of messages) {
      lines.push(msg.role === 'user' ? '**You**' : '**Golem**')
      lines.push('')
      lines.push(msg.content)
      lines.push('')
      lines.push('---')
      lines.push('')
    }
    const slug = conv.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    await api.dialog.saveFile({ defaultName: `${slug}.md`, content: lines.join('\n') })
  }

  // Find active conv from either regular convs or project convs
  const activeConv = conversations.find(c => c.id === activeConvId)
    ?? projects.flatMap(p => p.conversations || []).find(c => c.id === activeConvId)
    ?? null

  const titleLabel = view === 'settings' ? 'Settings'
    : view === 'stats' ? 'Stats'
    : (activeConv?.title ?? '')

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-background text-on-surface">
      <TitleBar
        title={titleLabel}
        pulling={pulling}
        pullModel={pullModel}
        pullProgress={pullProgress}
        pullStatus={pullStatus}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(s => !s)}
      />

      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <Sidebar
            conversations={conversations}
            activeConvId={activeConvId}
            activeView={view}
            sigils={sigils}
            skills={skills}
            projects={projects}
            onNewChat={handleNewChat}
            onNewChatWithSigil={handleNewChatWithSigil}
            onNewChatWithSkill={handleNewChatWithSkill}
            onNewChatInProject={handleNewChatInProject}
            onSelectConv={handleSelectConv}
            onDeleteConv={handleDeleteConv}
            onRenameConv={handleRenameConv}
            onPinConv={handlePinConv}
            onUnpinConv={handleUnpinConv}
            onExportConv={handleExportConv}
            onSetView={setView}
            onSigilsChange={refreshSigils}
            onSkillsChange={refreshSkills}
            onProjectsChange={refreshProjects}
          />
        )}

        <main className="flex-1 flex flex-col overflow-hidden">
          {view === 'chat' && (
            <ChatView
              key={activeConvId}
              conv={activeConv}
              models={models}
              ollamaReady={ollamaReady}
              onNewChat={handleNewChat}
              onConvUpdate={async () => {
                await Promise.all([
                  refreshConversations(),
                  refreshProjects(),
                  refreshSigils(),
                  refreshSkills(),
                ])
              }}
              onGolemAction={async ({ type, id }) => {
                if (type === 'test_sigil') {
                  await refreshSigils()
                  await handleNewChatWithSigil(id)
                } else if (type === 'use_skill') {
                  await refreshSkills()
                  await handleNewChatWithSkill(id)
                }
              }}
              pendingInput={pendingInput}
              onConsumePendingInput={() => setPendingInput('')}
            />
          )}
          {view === 'settings' && (
            <SettingsView
              models={models}
              pulling={pulling}
              pullModel={pullModel}
              pullStatus={pullStatus}
              pullProgress={pullProgress}
              onStartPull={startPull}
              onDeleteModel={deleteModel}
            />
          )}
          {view === 'stats' && (
            <StatsView />
          )}
        </main>
      </div>
    </div>
  )
}
