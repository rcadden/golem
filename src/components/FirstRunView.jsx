import { useState, useEffect } from 'react'

const api = window.golem

export default function FirstRunView({ onInstallComplete }) {
  const [status, setStatus] = useState('idle')     // idle | downloading | installing | waiting | manual | done | error
  const [message, setMessage] = useState('')
  const [pct, setPct] = useState(0)
  const [platform, setPlatform] = useState('win32')

  useEffect(() => {
    api.system.platform().then(setPlatform)
    api.ollama.onInstallProgress(data => {
      if (data.event === 'download')  { setStatus('downloading'); setPct(data.pct) }
      if (data.event === 'status')    { setStatus('installing');  setMessage(data.message) }
      if (data.event === 'manual')    { setStatus('manual');      setMessage(data.message) }
      if (data.event === 'done')      { setStatus('done');        setMessage(data.message) }
      if (data.event === 'error')     { setStatus('error');       setMessage(data.message) }
    })
    return () => api.ollama.offInstallProgress()
  }, [])

  useEffect(() => {
    if (status === 'done') {
      setTimeout(() => onInstallComplete(), 800)
    }
  }, [status])

  async function handleInstall() {
    setStatus('downloading')
    setMessage('')
    setPct(0)
    api.ollama.install()
  }

  async function handleManualDone() {
    setStatus('waiting')
    setMessage('Checking for Ollama…')
    const ready = await api.ollama.waitForReady()
    if (ready) {
      setStatus('done')
    } else {
      setStatus('error')
      setMessage('Ollama not detected. Make sure it is running, then try again.')
    }
  }

  const isWindows = platform === 'win32'
  const busy = status === 'downloading' || status === 'installing' || status === 'waiting'

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-8"
      style={{ background: '#0e0e14' }}>
      <img src="/icon.png" alt="Golem" className="w-20 h-20 rounded-2xl opacity-90"
        onError={e => { e.target.style.display = 'none' }} />

      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-on-surface mb-3" style={{ fontFamily: 'Hanken Grotesk' }}>
          Welcome to Golem
        </h1>
        <p className="text-[14px] leading-relaxed" style={{ color: 'rgba(196,192,216,0.6)' }}>
          Golem runs AI models locally using Ollama. Ollama isn't detected on this machine — install it to get started.
        </p>
      </div>

      {status === 'idle' && (
        <button
          onClick={handleInstall}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-medium text-[14px] transition-all active:scale-[0.97]"
          style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-mid) 100%)' }}
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          {isWindows ? 'Install Ollama' : 'Download Ollama'}
        </button>
      )}

      {status === 'downloading' && (
        <div className="w-full max-w-xs flex flex-col gap-2">
          <div className="text-[13px] text-center" style={{ color: 'rgba(196,192,216,0.6)' }}>
            Downloading… {pct}%
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
          </div>
        </div>
      )}

      {(status === 'installing' || status === 'waiting') && (
        <div className="flex items-center gap-2 text-[13px]" style={{ color: 'rgba(196,192,216,0.6)' }}>
          <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
          {message}
        </div>
      )}

      {status === 'manual' && (
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <p className="text-[13px]" style={{ color: 'rgba(196,192,216,0.6)' }}>{message}</p>
          <button
            onClick={handleManualDone}
            className="px-5 py-2.5 rounded-xl text-white text-[13px] font-medium"
            style={{ background: 'rgba(var(--accent-rgb),0.2)', border: '1px solid rgba(var(--accent-rgb),0.4)' }}
          >
            I've installed Ollama
          </button>
        </div>
      )}

      {status === 'done' && (
        <div className="flex items-center gap-2 text-[13px]" style={{ color: 'rgba(80,220,120,0.8)' }}>
          <span className="material-symbols-outlined text-[16px]">check_circle</span>
          Ollama is ready
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center gap-3 max-w-sm text-center">
          <p className="text-[13px]" style={{ color: 'rgba(240,100,100,0.8)' }}>{message}</p>
          <button
            onClick={() => { setStatus('idle'); setPct(0) }}
            className="text-[12px] underline"
            style={{ color: 'rgba(196,192,216,0.5)' }}
          >
            Try again
          </button>
        </div>
      )}

      <p className="text-[12px]" style={{ color: 'rgba(196,192,216,0.35)' }}>
        Free and open source · Runs entirely on your machine
      </p>
    </div>
  )
}
