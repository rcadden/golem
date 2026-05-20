import { useState, useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble'

const api = window.golem

const SUGGESTIONS = [
  { icon: 'terminal',      label: 'Debug my code',     prompt: 'Help me debug an issue with my code.' },
  { icon: 'edit_document', label: 'Draft a document',  prompt: 'Help me draft a document.' },
  { icon: 'insights',      label: 'Explain a concept', prompt: 'Explain a technical concept to me.' },
  { icon: 'code_blocks',   label: 'Review my code',    prompt: 'Review my code for improvements.' },
]

export default function ChatView({ conv, models, ollamaReady, onNewChat, onConvUpdate }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [error, setError] = useState('')
  const [attachedFiles, setAttachedFiles] = useState([])
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    async function load() {
      const defaultModel = await api.db.getSetting('default_model', models[0] || '')
      const model = conv?.model || defaultModel || models[0] || ''
      setSelectedModel(model)
      setAttachedFiles([])
      if (conv) {
        const msgs = await api.db.getMessages(conv.id)
        setMessages(msgs)
      } else {
        setMessages([])
      }
    }
    load()
  }, [conv?.id])

  useEffect(() => {
    let accumulated = ''

    api.ollama.onChunk(chunk => {
      accumulated += chunk
      setStreamingContent(accumulated)
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    })

    api.ollama.onStreamEnd(async err => {
      setStreaming(false)
      if (err) {
        setError(`Stream error: ${err}`)
        setStreamingContent('')
        return
      }
      if (accumulated && conv) {
        await api.db.addMessage(conv.id, 'assistant', accumulated)
        const msgs = await api.db.getMessages(conv.id)
        if (msgs.length === 2 && conv.title === 'New Chat') {
          const userMsg = msgs[0]?.content || ''
          const title = userMsg.slice(0, 50) + (userMsg.length > 50 ? '…' : '')
          await api.db.renameConversation(conv.id, title)
          await onConvUpdate()
        }
        setMessages(msgs)
      }
      accumulated = ''
      setStreamingContent('')
    })

    return () => {
      api.ollama.offChunk()
      api.ollama.offStreamEnd()
    }
  }, [conv?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [messages])

  async function send(text) {
    const baseContent = (text || input).trim()
    if (!baseContent && attachedFiles.length === 0) return
    if (streaming || !conv || !selectedModel) return

    let content = baseContent
    if (attachedFiles.length > 0) {
      const fileContext = attachedFiles
        .map(f => `<file name="${f.name}">\n${f.content}\n</file>`)
        .join('\n\n')
      content = fileContext + (baseContent ? `\n\n${baseContent}` : '')
    }

    setInput('')
    setAttachedFiles([])
    setError('')

    await api.db.addMessage(conv.id, 'user', content)
    const allMsgs = await api.db.getMessages(conv.id)
    setMessages(allMsgs)

    setStreaming(true)
    setStreamingContent('')

    const payload = {
      model: selectedModel,
      messages: allMsgs.map(m => ({ role: m.role, content: m.content })),
      sigilId: conv.sigil_id || null,
      projectId: conv.project_id || null,
      conversationId: conv.id,
    }
    await api.ollama.startStream(payload)
  }

  async function handleRetry() {
    if (streaming || !conv || !selectedModel) return
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
    if (!lastAssistant) return
    await api.db.deleteMessage(lastAssistant.id)
    const remaining = await api.db.getMessages(conv.id)
    setMessages(remaining)
    setError('')
    setStreaming(true)
    setStreamingContent('')
    const payload = {
      model: selectedModel,
      messages: remaining.map(m => ({ role: m.role, content: m.content })),
      sigilId: conv.sigil_id || null,
      projectId: conv.project_id || null,
      conversationId: conv.id,
    }
    await api.ollama.startStream(payload)
  }

  async function handleAttach() {
    const file = await api.dialog.openFile()
    if (!file) return
    if (file.error) {
      setError(`Could not read file: ${file.error}`)
      return
    }
    setAttachedFiles(prev => [...prev, file])
    textareaRef.current?.focus()
  }

  function removeFile(index) {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index))
  }

  function stop() {
    api.ollama.stopStream()
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  // Determine last assistant message id for retry button
  const lastAssistantId = !streaming
    ? [...messages].reverse().find(m => m.role === 'assistant')?.id ?? null
    : null

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (!conv) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-background px-8">
        {ollamaReady === false ? (
          <div className="text-center max-w-md">
            <span className="material-symbols-outlined text-error text-[48px] mb-4 block">wifi_off</span>
            <h2 className="font-display text-title-md font-bold text-on-surface mb-2" style={{ fontFamily: 'Hanken Grotesk' }}>
              Ollama not found
            </h2>
            <p className="text-body-md text-on-surface-variant">
              Run <code className="bg-surface-container-high px-2 py-0.5 rounded font-mono text-primary">ollama serve</code> in a terminal, then restart Golem.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center max-w-2xl w-full">
            <h2 className="font-display text-[40px] font-bold text-on-surface mb-3" style={{ fontFamily: 'Hanken Grotesk', letterSpacing: '-0.02em' }}>
              How can I help you today?
            </h2>
            <p className="text-body-lg text-on-surface-variant mb-12">
              Start a new chat or select one from the sidebar.
            </p>
            <div className="grid grid-cols-2 gap-3 w-full">
              {SUGGESTIONS.map(s => (
                <button
                  key={s.label}
                  onClick={onNewChat}
                  className="bg-surface hover:bg-surface-container-high border border-outline-variant hover:border-primary/30 p-5 rounded-xl text-left transition-all group"
                >
                  <span className="material-symbols-outlined text-primary text-[24px] mb-2 block"
                    style={{ fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
                  <div className="text-title-md font-medium text-on-surface group-hover:text-primary transition-colors">{s.label}</div>
                  <div className="text-body-md text-on-surface-variant mt-1 text-sm">{s.prompt}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Active chat ──────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: '#0f0f16' }}>
      {/* Context badges */}
      {(conv.sigil_name || conv.project_id) && (
        <div className="flex items-center justify-center gap-2 pt-3 pb-0">
          {conv.sigil_name && (
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium"
              style={{ background: 'rgba(var(--accent-rgb),0.12)', border: '1px solid rgba(var(--accent-rgb),0.25)', color: 'var(--accent-light)' }}
            >
              <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_fix_high</span>
              {conv.sigil_name}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-8" style={{ backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(var(--accent-rgb),0.05) 0%, transparent 60%)' }}>
        <div className="max-w-[860px] mx-auto">
          {messages.map(msg => (
            <MessageBubble
              key={msg.id}
              role={msg.role}
              content={msg.content}
              onRetry={msg.id === lastAssistantId ? handleRetry : null}
            />
          ))}
          {streaming && !streamingContent && (
            <MessageBubble role="assistant" isThinking />
          )}
          {streaming && streamingContent && (
            <MessageBubble role="assistant" content={streamingContent} isStreaming />
          )}
          {error && (
            <div className="text-error text-body-md text-center py-2">{error}</div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="shrink-0 px-6 pb-6" style={{ background: 'linear-gradient(to top, #0f0f16 80%, transparent)' }}>
        <div className="max-w-[860px] mx-auto">
          {/* Attached file pills */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {attachedFiles.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px]"
                  style={{ background: 'rgba(var(--accent-rgb),0.12)', border: '1px solid rgba(var(--accent-rgb),0.25)', color: 'var(--accent-light)' }}
                >
                  <span className="material-symbols-outlined text-[14px]">description</span>
                  <span className="max-w-[160px] truncate">{f.name}</span>
                  <button
                    onClick={() => removeFile(i)}
                    className="ml-1 hover:text-white transition-colors"
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div
            className="rounded-2xl p-3 flex flex-col gap-2 transition-all duration-200"
            style={{
              background: '#1a1a26',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 0 0 0 rgba(var(--accent-rgb),0)',
            }}
            onFocusCapture={e => e.currentTarget.style.boxShadow = '0 0 0 2px rgba(var(--accent-rgb),0.35), 0 8px 32px rgba(var(--accent-rgb),0.08)'}
            onBlurCapture={e => e.currentTarget.style.boxShadow = '0 0 0 0 rgba(var(--accent-rgb),0)'}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Golem…"
              rows={1}
              className="w-full bg-transparent border-none outline-none text-on-surface placeholder:text-on-surface-variant text-body-md resize-none overflow-y-auto leading-6"
              style={{ minHeight: '44px', maxHeight: '128px' }}
              onInput={e => {
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'
              }}
            />
            <div className="flex items-center justify-between px-1">
              {/* Left: attach */}
              <div className="flex gap-1 text-on-surface-variant">
                <button
                  onClick={handleAttach}
                  className="p-1.5 rounded-lg hover:bg-surface-container-high hover:text-on-surface transition-colors"
                  title="Attach file"
                >
                  <span className="material-symbols-outlined text-[20px]">attach_file</span>
                </button>
              </div>

              {/* Right: model picker + send/stop */}
              <div className="flex items-center gap-2">
                {/* Model picker */}
                <div className="relative">
                  <button
                    onClick={() => setModelMenuOpen(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-label-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high border border-outline-variant transition-colors"
                  >
                    <span className="material-symbols-outlined text-[14px]">deployed_code</span>
                    <span className="max-w-[140px] truncate">{selectedModel || 'No model'}</span>
                    <span className="material-symbols-outlined text-[14px]">expand_more</span>
                  </button>
                  {modelMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setModelMenuOpen(false)} />
                      <div className="absolute bottom-full right-0 mb-1 z-20 bg-surface border border-outline-variant rounded-xl shadow-2xl py-1 min-w-[200px]">
                        {models.map(m => (
                          <button
                            key={m}
                            onClick={() => { setSelectedModel(m); setModelMenuOpen(false) }}
                            className={`w-full text-left px-4 py-2 text-label-sm transition-colors flex items-center gap-2
                              ${m === selectedModel
                                ? 'text-primary bg-surface-container-high'
                                : 'text-on-surface hover:bg-surface-container-high'
                              }`}
                          >
                            {m === selectedModel && <span className="material-symbols-outlined text-[14px]">check</span>}
                            {m !== selectedModel && <span className="w-[14px]" />}
                            {m}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Send / Stop */}
                {streaming ? (
                  <button
                    onClick={stop}
                    className="bg-error/20 text-error hover:bg-error/30 p-2 rounded-xl transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">stop</span>
                  </button>
                ) : (
                  <button
                    onClick={() => send()}
                    disabled={!input.trim() && attachedFiles.length === 0}
                    className="bg-surface-container-highest hover:bg-primary disabled:opacity-40 disabled:cursor-not-allowed text-on-surface hover:text-on-primary p-2 rounded-xl transition-all"
                  >
                    <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>arrow_upward</span>
                  </button>
                )}
              </div>
            </div>
          </div>
          <p className="text-center text-label-sm text-on-surface-variant/50 mt-2">
            Golem can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  )
}
