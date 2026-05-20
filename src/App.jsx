import { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import ChatView from './components/ChatView'
import ModelsView from './components/ModelsView'
import SettingsView from './components/SettingsView'
import TitleBar from './components/TitleBar'

const api = window.golem

export default function App() {
  const [view, setView] = useState('chat')
  const [conversations, setConversations] = useState([])
  const [activeConvId, setActiveConvId] = useState(null)
  const [models, setModels] = useState([])
  const [sigils, setSigils] = useState([])
  const [projects, setProjects] = useState([])   // each has .files and .conversations
  const [ollamaReady, setOllamaReady] = useState(null)

  useEffect(() => {
    async function init() {
      const ready = await api.ollama.ensureRunning()
      setOllamaReady(ready)
      if (ready) {
        const m = await api.ollama.listModels()
        setModels(m)
      }
      const [convs, sigs] = await Promise.all([
        api.db.listConversations(),
        api.db.listSigils(),
      ])
      setConversations(convs)
      setSigils(sigs)
      const projs = await loadProjectsWithData()
      setProjects(projs)
      if (convs.length > 0) setActiveConvId(convs[0].id)
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

  const refreshProjects = useCallback(async () => {
    const projs = await loadProjectsWithData()
    setProjects(projs)
    return projs
  }, [])

  const refreshModels = useCallback(async () => {
    const m = await api.ollama.listModels()
    setModels(m)
  }, [])

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

  const titleLabel = view === 'models' ? 'Models'
    : view === 'settings' ? 'Settings'
    : (activeConv?.title ?? '')

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-background text-on-surface">
      <TitleBar title={titleLabel} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          conversations={conversations}
          activeConvId={activeConvId}
          activeView={view}
          sigils={sigils}
          projects={projects}
          onNewChat={handleNewChat}
          onNewChatWithSigil={handleNewChatWithSigil}
          onNewChatInProject={handleNewChatInProject}
          onSelectConv={handleSelectConv}
          onDeleteConv={handleDeleteConv}
          onRenameConv={handleRenameConv}
          onPinConv={handlePinConv}
          onUnpinConv={handleUnpinConv}
          onExportConv={handleExportConv}
          onSetView={setView}
          onSigilsChange={refreshSigils}
          onProjectsChange={refreshProjects}
        />

        <main className="flex-1 flex flex-col overflow-hidden">
          {view === 'chat' && (
            <ChatView
              key={activeConvId}
              conv={activeConv}
              models={models}
              ollamaReady={ollamaReady}
              onNewChat={handleNewChat}
              onConvUpdate={async () => {
                await Promise.all([refreshConversations(), refreshProjects()])
              }}
            />
          )}
          {view === 'models' && (
            <ModelsView models={models} onRefresh={refreshModels} />
          )}
          {view === 'settings' && (
            <SettingsView models={models} />
          )}
        </main>
      </div>
    </div>
  )
}
