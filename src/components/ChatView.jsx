import { useState, useEffect, useRef } from 'react'
import MessageBubble, { ToolCard } from './MessageBubble'

const api = window.golem

// Convert DB message rows to the shape Ollama's /api/chat expects: role/content
// plus tool_calls on assistant turns and tool_call_id on tool turns.
function serializeForOllama(msgs) {
  return msgs.map(m => {
    const base = { role: m.role, content: m.content || '' }
    if (m.tool_calls) {
      try { base.tool_calls = JSON.parse(m.tool_calls) } catch {}
    }
    if (m.tool_call_id) base.tool_call_id = m.tool_call_id
    return base
  })
}

// Group persisted messages: combine assistant-with-tool_calls and subsequent
// role='tool' result messages into a single render-time sequence so each tool
// invocation shows as a self-contained card with args + result.
function groupMessages(msgs) {
  const items = []
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i]
    if (m.role === 'tool') {
      let result
      try { result = JSON.parse(m.content) } catch { result = m.content }
      items.push({
        kind: 'tool',
        key: `t${m.id}`,
        name: 'tool',
        args: null,
        result,
        isError: !!(result && typeof result === 'object' && result.error),
      })
      continue
    }
    if (m.role === 'assistant' && m.tool_calls) {
      let calls = []
      try { calls = JSON.parse(m.tool_calls) || [] } catch {}
      // Pair upcoming role='tool' messages with their call ids
      const resultsById = {}
      let j = i + 1
      while (j < msgs.length && msgs[j].role === 'tool') {
        let payload
        try { payload = JSON.parse(msgs[j].content) } catch { payload = msgs[j].content }
        resultsById[msgs[j].tool_call_id] = payload
        j++
      }
      if (m.content) {
        items.push({ kind: 'msg', key: `m${m.id}`, message: m })
      }
      for (const call of calls) {
        const cid = call.id || `${m.id}-${call.function?.name}`
        let args = call.function?.arguments
        if (typeof args === 'string') {
          try { args = JSON.parse(args) } catch {}
        }
        const result = resultsById[call.id]
        items.push({
          kind: 'tool',
          key: `${m.id}-${cid}`,
          name: call.function?.name,
          args,
          result,
          isError: !!(result && typeof result === 'object' && result.error),
        })
      }
      i = j - 1
      continue
    }
    items.push({ kind: 'msg', key: `m${m.id}`, message: m })
  }
  return items
}

const SUGGESTIONS = [
  { icon: 'terminal',      label: 'Debug my code',     prompt: 'Help me debug an issue with my code.' },
  { icon: 'edit_document', label: 'Draft a document',  prompt: 'Help me draft a document.' },
  { icon: 'insights',      label: 'Explain a concept', prompt: 'Explain a technical concept to me.' },
  { icon: 'code_blocks',   label: 'Review my code',    prompt: 'Review my code for improvements.' },
]

export default function ChatView({ conv, models, ollamaReady, onNewChat, onConvUpdate, onGolemAction, pendingInput, onConsumePendingInput }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  // liveSegments: in-flight stream segments while a request is running.
  // Each segment is either { type: 'text', content } or
  // { type: 'tool', id, name, args, result?, isError?, isRunning }.
  const [liveSegments, setLiveSegments] = useState([])
  const [selectedModel, setSelectedModel] = useState('')
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [paramsOpen, setParamsOpen] = useState(false)
  // convParams: overrides for this conversation { temperature, numCtx } — null means use global default
  const [convParams, setConvParams] = useState({ temperature: null, numCtx: null })
  // toolCap: true | false | null (unknown / not yet probed)
  const [toolCap, setToolCap] = useState(null)
  const [streamStats, setStreamStats] = useState(null)   // { promptTokens, completionTokens, durationMs, ttftMs } — set on streamEnd
  const [elapsed, setElapsed] = useState(0)              // seconds since stream started, for live timer
  const [loopStatus, setLoopStatus] = useState(null)     // { reason, iterations } — set when tool-loop cap is hit
  const [error, setError] = useState('')
  const [attachedFiles, setAttachedFiles] = useState([])
  const [runningModels, setRunningModels] = useState([]) // [{ name, size_vram }] from /api/ps
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)
  const elapsedIntervalRef = useRef(null)
  const saveDraftTimerRef = useRef(null)

  useEffect(() => {
    if (!selectedModel) { setToolCap(null); return }
    let cancelled = false
    api.ollama.getToolCapability(selectedModel).then(cap => {
      if (!cancelled) setToolCap(cap)
    })
    return () => { cancelled = true }
  }, [selectedModel])

  useEffect(() => {
    async function load() {
      const defaultModel = await api.db.getSetting('default_model', models[0] || '')
      const model = conv?.model || defaultModel || models[0] || ''
      setSelectedModel(model)
      setAttachedFiles([])
      setParamsOpen(false)
      if (conv) {
        const msgs = await api.db.getMessages(conv.id)
        setMessages(msgs)
        // Load any saved per-conversation params
        setConvParams({
          temperature: conv.temperature ?? null,
          numCtx: conv.num_ctx ?? null,
        })
      } else {
        setMessages([])
        setConvParams({ temperature: null, numCtx: null })
      }
      api.ollama.getRunningModels().then(list => setRunningModels(list ?? [])).catch(() => {})
    }
    load()
  }, [conv?.id])

  useEffect(() => {
    api.ollama.onChunk(chunk => {
      setLiveSegments(prev => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last && last.type === 'text') {
          next[next.length - 1] = { ...last, content: last.content + chunk }
        } else {
          next.push({ type: 'text', content: chunk })
        }
        return next
      })
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    })

    api.ollama.onToolCallStart(({ id, name, args }) => {
      setLiveSegments(prev => [...prev, { type: 'tool', id, name, args, isRunning: true }])
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    })

    api.ollama.onToolCallResult(({ id, result, isError }) => {
      setLiveSegments(prev => prev.map(s =>
        s.type === 'tool' && s.id === id
          ? { ...s, result, isError, isRunning: false }
          : s
      ))
    })

    api.ollama.onStreamStats(data => {
      setStreamStats(data)
    })

    api.ollama.onLoopStatus(setLoopStatus)

    api.ollama.onStreamEnd(async err => {
      setStreaming(false)
      // Refresh running model list so the GPU/CPU badge stays current
      api.ollama.getRunningModels().then(list => setRunningModels(list ?? [])).catch(() => {})
      if (err) {
        setError(`Stream error: ${err}`)
        setLiveSegments([])
        return
      }
      // Main process persisted everything during the loop — reload from DB.
      if (conv) {
        const msgs = await api.db.getMessages(conv.id)
        const userCount = msgs.filter(m => m.role === 'user').length
        if (userCount === 1 && conv.title === 'New Chat') {
          // Set truncated title immediately, then upgrade async with model-generated one
          const firstUser = msgs.find(m => m.role === 'user')
          const truncated = (firstUser?.content || '').slice(0, 50) + ((firstUser?.content || '').length > 50 ? '…' : '')
          await api.db.renameConversation(conv.id, truncated)
          api.ollama.generateTitle(selectedModel, serializeForOllama(msgs))
            .then(async aiTitle => {
              if (aiTitle) {
                await api.db.renameConversation(conv.id, aiTitle)
                await onConvUpdate()
              }
            })
            .catch(() => {})
        }
        setMessages(msgs)
      }
      // Always notify parent — refreshes convs, projects, sigils, and skills
      await onConvUpdate()
      setLiveSegments([])
    })

    return () => {
      api.ollama.offChunk()
      api.ollama.offStreamEnd()
      api.ollama.offToolCallStart()
      api.ollama.offToolCallResult()
      api.ollama.offStreamStats()
      api.ollama.offLoopStatus()
    }
  }, [conv?.id])

  useEffect(() => {
    if (streaming) {
      setElapsed(0)
      setStreamStats(null)
      elapsedIntervalRef.current = setInterval(() => {
        setElapsed(s => s + 1)
      }, 1000)
    } else {
      clearInterval(elapsedIntervalRef.current)
    }
    return () => clearInterval(elapsedIntervalRef.current)
  }, [streaming])

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape' && streaming) {
        api.ollama.stopStream()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [streaming])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [messages])

  useEffect(() => {
    setInput('')
    if (!conv) return
    let cancelled = false
    api.db.getDraft(conv.id).then(draft => {
      if (!cancelled && draft) setInput(draft)
    })
    return () => { cancelled = true }
  }, [conv?.id])

  useEffect(() => {
    if (pendingInput) {
      setInput(pendingInput)
      onConsumePendingInput()
    }
  }, [pendingInput])

  async function saveConvParams(updates) {
    const next = { ...convParams, ...updates }
    setConvParams(next)
    if (conv) {
      await api.db.setConversationParams(conv.id, {
        temperature: next.temperature,
        numCtx: next.numCtx,
      })
    }
  }

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
    if (conv) api.db.saveDraft(conv.id, '')
    setAttachedFiles([])
    setError('')

    await api.db.addMessage(conv.id, 'user', content)
    const allMsgs = await api.db.getMessages(conv.id)
    setMessages(allMsgs)

    setStreaming(true)
    setLiveSegments([])
    setLoopStatus(null)

    const payload = {
      model: selectedModel,
      messages: serializeForOllama(allMsgs),
      sigilId: conv.sigil_id ?? null,
      skillId: conv.skill_id ?? null,
      projectId: conv.project_id ?? null,
      conversationId: conv.id,
    }
    await api.ollama.startStream(payload)
  }

  async function handleEditMessage(msgId, newContent) {
    if (streaming || !conv || !selectedModel) return
    const idx = messages.findIndex(m => m.id === msgId)
    if (idx === -1) return
    await api.db.updateMessage(msgId, newContent)
    const toDelete = messages.slice(idx + 1)
    for (const m of toDelete) await api.db.deleteMessage(m.id)
    const remaining = await api.db.getMessages(conv.id)
    setMessages(remaining)
    setError('')
    setStreaming(true)
    setLiveSegments([])
    setLoopStatus(null)
    await api.ollama.startStream({
      model: selectedModel,
      messages: serializeForOllama(remaining),
      sigilId: conv.sigil_id ?? null,
      skillId: conv.skill_id ?? null,
      projectId: conv.project_id ?? null,
      conversationId: conv.id,
    })
  }

  async function handleRetry() {
    if (streaming || !conv || !selectedModel) return
    // Drop everything after the last user message — that's the assistant's
    // most recent turn (which may include tool calls and tool results).
    const lastUserIdx = [...messages].map(m => m.role).lastIndexOf('user')
    if (lastUserIdx === -1) return
    const toDelete = messages.slice(lastUserIdx + 1)
    for (const m of toDelete) {
      await api.db.deleteMessage(m.id)
    }
    const remaining = await api.db.getMessages(conv.id)
    setMessages(remaining)
    setError('')
    setStreaming(true)
    setLiveSegments([])
    setLoopStatus(null)
    const payload = {
      model: selectedModel,
      messages: serializeForOllama(remaining),
      sigilId: conv.sigil_id ?? null,
      skillId: conv.skill_id ?? null,
      projectId: conv.project_id ?? null,
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

  // Determine last assistant message id for retry button. Only consider assistant
  // messages with actual textual content — intermediate tool-call-only turns shouldn't
  // surface a Regenerate button.
  const lastAssistantId = !streaming
    ? [...messages].reverse().find(m => m.role === 'assistant' && m.content)?.id ?? null
    : null

  const renderItems = groupMessages(messages)

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
    <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg-base)' }}>
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
          {renderItems.map(item => (
            item.kind === 'tool' ? (
              <ToolCard
                key={item.key}
                name={item.name}
                args={item.args}
                result={item.result}
                isError={item.isError}
                onAction={onGolemAction}
              />
            ) : (
              <MessageBubble
                key={item.key}
                role={item.message.role}
                content={item.message.content}
                onRetry={item.message.id === lastAssistantId ? handleRetry : null}
                onEdit={!streaming && item.message.role === 'user' ? (newContent) => handleEditMessage(item.message.id, newContent) : null}
              />
            )
          ))}
          {liveSegments.map((s, i) => (
            s.type === 'text' ? (
              <MessageBubble
                key={`live-${i}`}
                role="assistant"
                content={s.content}
                isStreaming={streaming && i === liveSegments.length - 1}
              />
            ) : (
              <ToolCard
                key={`live-${i}-${s.id}`}
                name={s.name}
                args={s.args}
                result={s.result}
                isError={s.isError}
                isRunning={s.isRunning}
              />
            )
          ))}
          {streaming && liveSegments.length === 0 && (
            <MessageBubble role="assistant" isThinking />
          )}
          {loopStatus?.reason === 'cap_reached' && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] my-2"
              style={{
                background: 'rgba(234,179,8,0.08)',
                border: '1px solid rgba(234,179,8,0.2)',
                color: 'rgb(200,160,60)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>warning</span>
              Tool loop stopped after {loopStatus.iterations} iterations to prevent runaway chains
            </div>
          )}
          {error && (
            <div className="text-error text-body-md text-center py-2">{error}</div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="shrink-0 px-6 pb-6" style={{ background: 'linear-gradient(to top, var(--bg-base) 80%, transparent)' }}>
        <div className="max-w-[860px] mx-auto">
          {/* Stream stats / live timer + context bar */}
          {(streaming || streamStats) && (() => {
            // GPU/CPU badge — check if selected model is in the running list with VRAM
            const runningEntry = runningModels.find(r => r.name === selectedModel || r.model === selectedModel)
            const usingGpu = runningEntry && (runningEntry.size_vram > 0)
            const usingCpu = runningEntry && runningEntry.size_vram === 0

            // Context fill
            const used = streamStats ? streamStats.promptTokens + streamStats.completionTokens : 0
            const numCtxVal = streamStats?.numCtx
            const pct = numCtxVal ? Math.min(used / numCtxVal, 1) : 0
            const warn = pct >= 0.9
            const caution = pct >= 0.75
            const barColor = warn ? 'rgb(239,68,68)' : caution ? 'rgb(234,179,8)' : 'rgba(var(--accent-rgb),0.6)'

            // Turns remaining estimate (average tokens per turn from history)
            let turnsLeft = null
            if (streamStats?.numCtx && messages.length >= 2) {
              const avgTurnTokens = used / Math.max(messages.filter(m => m.role === 'user').length, 1)
              const remaining = streamStats.numCtx - used
              turnsLeft = avgTurnTokens > 0 ? Math.floor(remaining / avgTurnTokens) : null
            }

            return (
              <div className="mb-1 space-y-1">
                <div className="flex items-center justify-between h-5">
                  <div className="flex items-center gap-2">
                    {usingGpu && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(80,200,120,0.12)', color: 'rgb(140,220,160)', border: '1px solid rgba(80,200,120,0.2)' }}>
                        GPU
                      </span>
                    )}
                    {usingCpu && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(234,179,8,0.1)', color: 'rgb(200,160,80)', border: '1px solid rgba(234,179,8,0.2)' }}>
                        CPU
                      </span>
                    )}
                    {streamStats?.numCtx && turnsLeft !== null && (
                      <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                        ~{turnsLeft} turn{turnsLeft !== 1 ? 's' : ''} left
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                    {streamStats
                      ? `${Math.round(streamStats.durationMs / 1000)}s · ${streamStats.completionTokens.toLocaleString()} tokens`
                      : `${elapsed}s`
                    }
                  </span>
                </div>
                {numCtxVal && (
                  <div
                    className="flex items-center gap-2"
                    title={`Context: ${used.toLocaleString()} / ${numCtxVal.toLocaleString()} tokens (${Math.round(pct * 100)}%)`}
                  >
                    <div className="flex-1 h-[2px] rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct * 100}%`, background: barColor }}
                      />
                    </div>
                    {caution && (
                      <span className="text-[10px] tabular-nums shrink-0" style={{ color: barColor }}>
                        {Math.round(pct * 100)}%
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })()}
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
              background: 'var(--bg-input)',
              border: '1px solid var(--border-mid)',
              boxShadow: '0 0 0 0 rgba(var(--accent-rgb),0)',
            }}
            onFocusCapture={e => e.currentTarget.style.boxShadow = '0 0 0 2px rgba(var(--accent-rgb),0.35), 0 8px 32px rgba(var(--accent-rgb),0.08)'}
            onBlurCapture={e => e.currentTarget.style.boxShadow = '0 0 0 0 rgba(var(--accent-rgb),0)'}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => {
                const val = e.target.value
                setInput(val)
                if (conv) {
                  clearTimeout(saveDraftTimerRef.current)
                  saveDraftTimerRef.current = setTimeout(() => {
                    api.db.saveDraft(conv.id, val)
                  }, 300)
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder={conv?.project_id ? 'Message Golem…' : 'Message Golem… — open a project with a directory set for file & git tools'}
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

              {/* Right: tools badge + model picker + send/stop */}
              <div className="flex items-center gap-2">
                {/* Tools-enabled badge — only shown when tools are actually useful */}
                {toolCap === true && conv?.project_id && (
                  <span
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                    style={{
                      background: 'rgba(80,200,120,0.12)',
                      border: '1px solid rgba(80,200,120,0.3)',
                      color: 'rgb(140,220,160)',
                    }}
                    title="Files, git tools active — model will read files before making changes"
                  >
                    <span className="material-symbols-outlined text-[10px]">build</span>
                    Files · Git
                  </span>
                )}
                {toolCap === false && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                    style={{
                      background: 'var(--bg-overlay)',
                      border: '1px solid var(--border-mid)',
                      color: 'var(--text-secondary)',
                    }}
                    title="This model doesn't support tool calling — it can only respond with text"
                  >
                    No tools
                  </span>
                )}
                {/* Conversation params (gear) */}
                <div className="relative">
                  <button
                    onClick={() => { setParamsOpen(v => !v); setModelMenuOpen(false) }}
                    className={`p-1.5 rounded-lg transition-colors ${paramsOpen || convParams.temperature !== null || convParams.numCtx !== null
                      ? 'text-primary bg-primary/10'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`}
                    title="Conversation parameters"
                  >
                    <span className="material-symbols-outlined text-[18px]">tune</span>
                  </button>
                  {paramsOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setParamsOpen(false)} />
                      <div
                        className="absolute bottom-full right-0 mb-2 z-20 rounded-2xl shadow-2xl p-4 w-72"
                        style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-mid)' }}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-label-sm font-semibold text-on-surface">Conversation parameters</span>
                          {(convParams.temperature !== null || convParams.numCtx !== null) && (
                            <button
                              onClick={() => saveConvParams({ temperature: null, numCtx: null })}
                              className="text-[10px] text-on-surface-variant hover:text-primary transition-colors"
                            >
                              Reset
                            </button>
                          )}
                        </div>

                        {/* Temperature */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[12px] text-on-surface-variant">Temperature</label>
                            <span className="text-[12px] tabular-nums font-mono text-on-surface">
                              {convParams.temperature !== null ? convParams.temperature.toFixed(1) : '0.7'}
                              {convParams.temperature === null && <span className="text-on-surface-variant text-[10px] ml-1">(default)</span>}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0" max="2" step="0.1"
                            value={convParams.temperature ?? 0.7}
                            onChange={e => saveConvParams({ temperature: parseFloat(e.target.value) })}
                            className="w-full accent-primary"
                          />
                          <div className="flex justify-between text-[10px] text-on-surface-variant/50 mt-0.5">
                            <span>Precise</span>
                            <span>Creative</span>
                          </div>
                        </div>

                        {/* Context window */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[12px] text-on-surface-variant">Context window</label>
                            <span className="text-[12px] tabular-nums font-mono text-on-surface">
                              {convParams.numCtx !== null ? (convParams.numCtx / 1024).toFixed(0) + 'k' : 'default'}
                              {convParams.numCtx === null && <span className="text-on-surface-variant text-[10px] ml-1">(8k)</span>}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="2048" max="131072" step="2048"
                            value={convParams.numCtx ?? 8192}
                            onChange={e => saveConvParams({ numCtx: parseInt(e.target.value) })}
                            className="w-full accent-primary"
                          />
                          <div className="flex justify-between text-[10px] text-on-surface-variant/50 mt-0.5">
                            <span>2k</span>
                            <span>128k</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Model picker */}
                <div className="relative">
                  <button
                    onClick={() => { setModelMenuOpen(v => !v); setParamsOpen(false) }}
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
