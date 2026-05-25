import { useState, useEffect } from 'react'

const api = window.golem

export default function SkillModal({ skillId, onClose, onSaved }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('General')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [starterMessage, setStarterMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!skillId) return
    api.db.getSkill(skillId).then(skill => {
      if (!skill) return
      setName(skill.name)
      setCategory(skill.category)
      setSystemPrompt(skill.system_prompt)
      setStarterMessage(skill.starter_message ?? '')
    })
  }, [skillId])

  async function handleSave() {
    if (!name.trim() || !systemPrompt.trim()) return
    setSaving(true)
    try {
      if (skillId) {
        await api.db.updateSkill(skillId, name.trim(), category.trim() || 'General', systemPrompt.trim(), starterMessage.trim())
      } else {
        await api.db.createSkill(name.trim(), category.trim() || 'General', systemPrompt.trim(), starterMessage.trim())
      }
      await onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Escape') onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onKeyDown={handleKey}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="border rounded-xl p-5 w-[520px] max-h-[80vh] overflow-y-auto flex flex-col gap-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
        <h2 className="text-sm font-semibold">{skillId ? 'Edit Skill' : 'New Skill'}</h2>

        <div className="flex gap-3">
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-[11px] opacity-50">Name</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Code Review"
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div className="w-32 flex flex-col gap-1">
            <label className="text-[11px] opacity-50">Category</label>
            <input
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="e.g. Dev"
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] opacity-50">System Prompt</label>
          <textarea
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
            rows={6}
            placeholder="You are a code reviewer. Focus on correctness, security, and readability..."
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)] resize-none font-mono"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] opacity-50">
            Starter Message <span className="opacity-40">(optional — pre-fills the chat input)</span>
          </label>
          <textarea
            value={starterMessage}
            onChange={e => setStarterMessage(e.target.value)}
            rows={3}
            placeholder="Review this code for bugs and security issues:"
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)] resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded-lg hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || !systemPrompt.trim()}
            className="px-4 py-1.5 text-sm rounded-lg bg-[var(--accent)] hover:opacity-90 disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
