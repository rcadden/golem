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
      if (convs.length > 0) setActiveConvId(convs[0].id)
    }
    init()
  }, [])

  const refreshConversations = useCallback(async () => {
    const convs = await api.db.listConversations()
    setConversations(convs)
    return convs
  }, [])

  const refreshSigils = useCallback(async () => {
    const sigs = await api.db.listSigils()
    setSigils(sigs)
  }, [])

  const refreshModels = useCallback(async () => {
    const m = await api.ollama.listModels()
    setModels(m)
  }, [])

  async function handleNewChat() {
    const defaultModel = await api.db.getSetting('default_model', models[0] || '')
    const model = defaultModel || models[0] || ''
    if (!model) return
    const id = await api.db.createConversation('New Chat', model, null)
    await refreshConversations()
    setActiveConvId(id)
    setView('chat')
  }

  async function handleNewChatWithSigil(sigilId) {
    const defaultModel = await api.db.getSetting('default_model', models[0] || '')
    const model = defaultModel || models[0] || ''
    if (!model) return
    const sigil = sigils.find(s => s.id === sigilId)
    const title = sigil ? sigil.name : 'New Chat'
    const id = await api.db.createConversation(title, model, sigilId)
    await refreshConversations()
    setActiveConvId(id)
    setView('chat')
  }

  async function handleSelectConv(id) {
    setActiveConvId(id)
    setView('chat')
  }

  async function handleDeleteConv(id) {
    await api.db.deleteConversation(id)
    const convs = await refreshConversations()
    if (activeConvId === id) {
      setActiveConvId(convs[0]?.id ?? null)
    }
  }

  async function handleRenameConv(id, title) {
    await api.db.renameConversation(id, title)
    await refreshConversations()
  }

  async function handlePinConv(id) {
    await api.db.pinConversation(id)
    await refreshConversations()
  }

  async function handleUnpinConv(id) {
    await api.db.unpinConversation(id)
    await refreshConversations()
  }

  const activeConv = conversations.find(c => c.id === activeConvId) ?? null
  const titleLabel = view === 'models' ? 'Models' : view === 'settings' ? 'Settings' : (activeConv?.title ?? '')

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-background text-on-surface">
      <TitleBar title={titleLabel} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          conversations={conversations}
          activeConvId={activeConvId}
          activeView={view}
          sigils={sigils}
          onNewChat={handleNewChat}
          onNewChatWithSigil={handleNewChatWithSigil}
          onSelectConv={handleSelectConv}
          onDeleteConv={handleDeleteConv}
          onRenameConv={handleRenameConv}
          onPinConv={handlePinConv}
          onUnpinConv={handleUnpinConv}
          onSetView={setView}
          onSigilsChange={refreshSigils}
        />

        <main className="flex-1 flex flex-col overflow-hidden">
          {view === 'chat' && (
            <ChatView
              key={activeConvId}
              conv={activeConv}
              models={models}
              ollamaReady={ollamaReady}
              onNewChat={handleNewChat}
              onConvUpdate={refreshConversations}
            />
          )}
          {view === 'models' && (
            <ModelsView
              models={models}
              onRefresh={refreshModels}
            />
          )}
          {view === 'settings' && (
            <SettingsView
              models={models}
            />
          )}
        </main>
      </div>
    </div>
  )
}
