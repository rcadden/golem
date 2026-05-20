import { useState, useEffect, useRef } from 'react'

export default function SigilModal({ sigil = null, onSave, onClose }) {
  const [name, setName] = useState(sigil?.name ?? '')
  const [content, setContent] = useState(sigil?.content ?? '')
  const nameRef = useRef(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  function handleKeyDown(e) {
    if (e.key === 'Escape') onClose()
  }

  async function handleSave() {
    if (!name.trim() || !content.trim()) return
    await onSave(sigil?.id ?? null, name.trim(), content.trim())
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-lg rounded-2xl flex flex-col"
        style={{ background: '#16161f', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="text-[17px] font-semibold text-on-surface" style={{ fontFamily: 'Hanken Grotesk' }}>
              {sigil ? 'Edit Sigil' : 'New Sigil'}
            </h2>
            <p className="text-[12px] text-on-surface-variant/60 mt-0.5">
              A sigil is a named system prompt applied to every conversation.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/5 text-on-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 flex flex-col gap-4">
          <div>
            <label className="block text-[12px] font-medium text-on-surface-variant mb-1.5">Name</label>
            <input
              ref={nameRef}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Code Reviewer, Writing Coach…"
              className="w-full rounded-xl px-4 py-2.5 text-[14px] text-on-surface placeholder:text-on-surface-variant/40 outline-none transition-all"
              style={{
                background: '#1a1a26',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(var(--accent-rgb),0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
              onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-on-surface-variant mb-1.5">System Prompt</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="You are a senior code reviewer. Focus on correctness, performance, and maintainability…"
              rows={8}
              className="w-full rounded-xl px-4 py-3 text-[13px] text-on-surface placeholder:text-on-surface-variant/40 outline-none resize-none transition-all font-mono leading-relaxed"
              style={{
                background: '#1a1a26',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(var(--accent-rgb),0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-[13px] font-medium text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || !content.trim()}
              className="px-5 py-2 rounded-xl text-[13px] font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-mid) 100%)' }}
            >
              {sigil ? 'Save changes' : 'Create Sigil'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
