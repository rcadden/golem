import { useEffect, useRef } from 'react'

export default function ConfirmDialog({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }) {
  const cancelRef = useRef(null)

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        className="w-full max-w-sm rounded-2xl flex flex-col"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-mid)', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}
      >
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-[17px] font-semibold text-on-surface" style={{ fontFamily: 'Hanken Grotesk' }}>
            {title}
          </h2>
          <p className="text-[13px] mt-2" style={{ color: 'var(--text-secondary)' }}>
            {message}
          </p>
        </div>

        <div className="flex justify-end gap-2 px-6 pb-6">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-[13px] font-medium text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2 rounded-xl text-[13px] font-medium transition-all"
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: 'rgb(255,140,140)' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
