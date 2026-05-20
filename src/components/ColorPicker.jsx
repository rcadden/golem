import { useState, useRef, useCallback } from 'react'

// ── Color math ────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) }
}

function rgbToHex({ r, g, b }) {
  return '#' + [r,g,b].map(v => Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('')
}

function rgbToHsl({ r, g, b }) {
  r/=255; g/=255; b/=255
  const max=Math.max(r,g,b), min=Math.min(r,g,b), l=(max+min)/2
  if (max===min) return { h:0, s:0, l:Math.round(l*100) }
  const d=max-min, s=l>0.5 ? d/(2-max-min) : d/(max+min)
  let h
  if (max===r) h=((g-b)/d+(g<b?6:0))/6
  else if (max===g) h=((b-r)/d+2)/6
  else h=((r-g)/d+4)/6
  return { h:Math.round(h*360), s:Math.round(s*100), l:Math.round(l*100) }
}

function hslToRgb({ h, s, l }) {
  s/=100; l/=100
  const k=n=>(n+h/30)%12, a=s*Math.min(l,1-l)
  const f=n=>Math.round((l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1))))*255)
  return { r:Math.max(0,Math.min(255,f(0))), g:Math.max(0,Math.min(255,f(8))), b:Math.max(0,Math.min(255,f(4))) }
}

function rgbToHwb({ r, g, b }) {
  const { h } = rgbToHsl({ r, g, b })
  return { h, w:Math.round(Math.min(r,g,b)/255*100), b:Math.round((1-Math.max(r,g,b)/255)*100) }
}

function hwbToRgb({ h, w, b }) {
  const wn=w/100, bn=b/100
  if (wn+bn>=1) { const g=Math.round(wn/(wn+bn)*255); return { r:g, g, b:g } }
  const rgb=hslToRgb({ h, s:100, l:50 }), f=1-wn-bn
  return { r:Math.round(rgb.r/255*f*255+wn*255), g:Math.round(rgb.g/255*f*255+wn*255), b:Math.round(rgb.b/255*f*255+wn*255) }
}

function rgbToHsv({ r, g, b }) {
  r/=255; g/=255; b/=255
  const max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min
  const s=max===0?0:d/max
  let h=0
  if (d!==0) {
    if (max===r) h=((g-b)/d+(g<b?6:0))/6
    else if (max===g) h=((b-r)/d+2)/6
    else h=((r-g)/d+4)/6
  }
  return { h:Math.round(h*360), s:Math.round(s*100), v:Math.round(max*100) }
}

function hsvToRgb({ h, s, v }) {
  s/=100; v/=100
  const k=n=>(n+h/60)%6
  const f=n=>Math.round(v*(1-s*Math.max(0,Math.min(k(n),4-k(n),1)))*255)
  return { r:Math.max(0,Math.min(255,f(5))), g:Math.max(0,Math.min(255,f(3))), b:Math.max(0,Math.min(255,f(1))) }
}

// ── Gradient builders ─────────────────────────────────────────────────────────

function hueRainbow() {
  return `linear-gradient(to right,${Array.from({length:7},(_,i)=>`hsl(${i*60},100%,50%)`).join(',')})`
}

function gradient(mode, key, { hsl, hwb, rgb, hsv }) {
  if (mode==='hsl') {
    if (key==='h') return hueRainbow()
    if (key==='s') return `linear-gradient(to right,hsl(${hsl.h},0%,${hsl.l}%),hsl(${hsl.h},100%,${hsl.l}%))`
    if (key==='l') return `linear-gradient(to right,#000,hsl(${hsl.h},${hsl.s}%,50%),#fff)`
  }
  if (mode==='hwb') {
    if (key==='h') return hueRainbow()
    if (key==='w') return `linear-gradient(to right,hwb(${hwb.h} 0% ${hwb.b}%),hwb(${hwb.h} 100% ${hwb.b}%))`
    if (key==='b') return `linear-gradient(to right,hwb(${hwb.h} ${hwb.w}% 0%),hwb(${hwb.h} ${hwb.w}% 100%))`
  }
  if (mode==='rgb') {
    if (key==='r') return `linear-gradient(to right,rgb(0,${rgb.g},${rgb.b}),rgb(255,${rgb.g},${rgb.b}))`
    if (key==='g') return `linear-gradient(to right,rgb(${rgb.r},0,${rgb.b}),rgb(${rgb.r},255,${rgb.b}))`
    if (key==='b') return `linear-gradient(to right,rgb(${rgb.r},${rgb.g},0),rgb(${rgb.r},${rgb.g},255))`
  }
  if (mode==='hsv') {
    if (key==='h') return hueRainbow()
    if (key==='s') {
      const viv=hsvToRgb({h:hsv.h,s:100,v:hsv.v}), gr=Math.round(hsv.v*2.55)
      return `linear-gradient(to right,rgb(${gr},${gr},${gr}),rgb(${viv.r},${viv.g},${viv.b}))`
    }
    if (key==='v') {
      const viv=hsvToRgb({h:hsv.h,s:hsv.s,v:100})
      return `linear-gradient(to right,#000,rgb(${viv.r},${viv.g},${viv.b}))`
    }
  }
  return '#888'
}

// ── Mode definitions ──────────────────────────────────────────────────────────

const MODES = {
  hsl: [
    { key:'h', label:'H', min:0, max:360 },
    { key:'s', label:'S', min:0, max:100 },
    { key:'l', label:'L', min:0, max:100 },
  ],
  hwb: [
    { key:'h', label:'H', min:0, max:360 },
    { key:'w', label:'W', min:0, max:100 },
    { key:'b', label:'B', min:0, max:100 },
  ],
  rgb: [
    { key:'r', label:'R', min:0, max:255 },
    { key:'g', label:'G', min:0, max:255 },
    { key:'b', label:'B', min:0, max:255 },
  ],
  hsv: [
    { key:'h', label:'H', min:0, max:360 },
    { key:'s', label:'S', min:0, max:100 },
    { key:'v', label:'V', min:0, max:100 },
  ],
}

function colorString(mode, { hsl, hwb, rgb, hsv }) {
  if (mode==='hsl') return `hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)`
  if (mode==='hwb') return `hwb(${hwb.h} ${hwb.w}% ${hwb.b}%)`
  if (mode==='rgb') return `rgb(${rgb.r} ${rgb.g} ${rgb.b})`
  if (mode==='hsv') return `hsv(${hsv.h} ${hsv.s}% ${hsv.v}%)`
}

// ── Slider ────────────────────────────────────────────────────────────────────

function GradientSlider({ value, min, max, grad, onChange }) {
  const trackRef = useRef(null)

  const getVal = useCallback((e) => {
    const rect = trackRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    return Math.round(min + (x / rect.width) * (max - min))
  }, [min, max])

  function onMouseDown(e) {
    e.preventDefault()
    onChange(getVal(e))
    const move = e => onChange(getVal(e))
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const pct = ((value - min) / (max - min)) * 100

  return (
    <div
      ref={trackRef}
      className="relative h-5 rounded-full cursor-pointer select-none"
      style={{ background: grad, boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)' }}
      onMouseDown={onMouseDown}
    >
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full pointer-events-none"
        style={{
          left: `${pct}%`,
          background: '#fff',
          boxShadow: '0 1px 6px rgba(0,0,0,0.5), 0 0 0 2px rgba(255,255,255,0.25)',
        }}
      />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ColorPicker({ value = '#6366f1', onChange }) {
  const [mode, setMode] = useState('hsl')
  const [hex, setHex] = useState(value)
  const [hexInput, setHexInput] = useState(value)
  const [copied, setCopied] = useState(false)

  // Derive all channel sets from the canonical hex
  const rgb = hexToRgb(hex)
  const hsl = rgbToHsl(rgb)
  const hwb = rgbToHwb(rgb)
  const hsv = rgbToHsv(rgb)
  const channels = { hsl, hwb, rgb, hsv }

  function update(newHex) {
    setHex(newHex)
    setHexInput(newHex)
    onChange?.(newHex)
  }

  function handleChannel(key, val) {
    let newRgb
    if (mode==='hsl') newRgb = hslToRgb({ ...hsl, [key]:val })
    else if (mode==='hwb') newRgb = hwbToRgb({ ...hwb, [key]:val })
    else if (mode==='rgb') newRgb = { ...rgb, [key]:val }
    else if (mode==='hsv') newRgb = hsvToRgb({ ...hsv, [key]:val })
    update(rgbToHex(newRgb))
  }

  function handleHexInput(e) {
    const v = e.target.value
    setHexInput(v)
    if (/^#[0-9a-f]{6}$/i.test(v)) update(v)
  }

  function copyHex() {
    navigator.clipboard.writeText(hex)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const modeChannels = MODES[mode]

  return (
    <div className="flex flex-col gap-4 select-none">
      {/* Mode tabs */}
      <div className="flex gap-3 flex-wrap">
        {Object.keys(MODES).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="flex items-center gap-1.5 text-[12px] font-medium transition-colors"
            style={{ color: mode===m ? 'var(--accent-light)' : 'rgba(196,192,216,0.45)' }}
          >
            <div
              className="w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0"
              style={{
                borderColor: mode===m ? 'var(--accent-light)' : 'rgba(196,192,216,0.3)',
                background: mode===m ? 'var(--accent)' : 'transparent',
              }}
            >
              {mode===m && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
            {m.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Preview + sliders */}
      <div className="flex gap-4 items-center">
        {/* Color swatch */}
        <div
          className="shrink-0 w-20 h-20 rounded-xl border"
          style={{ background: hex, borderColor: 'rgba(255,255,255,0.1)', boxShadow: `0 4px 20px rgba(${rgb.r},${rgb.g},${rgb.b},0.35)` }}
        />

        {/* Sliders */}
        <div className="flex-1 flex flex-col gap-3">
          {modeChannels.map(ch => (
            <div key={ch.key} className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-on-surface-variant/50 w-3 shrink-0">{ch.label}</span>
              <div className="flex-1">
                <GradientSlider
                  value={channels[mode][ch.key]}
                  min={ch.min}
                  max={ch.max}
                  grad={gradient(mode, ch.key, channels)}
                  onChange={val => handleChannel(ch.key, val)}
                />
              </div>
              <span className="text-[11px] font-mono text-on-surface-variant/60 w-7 text-right shrink-0">
                {channels[mode][ch.key]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Hex + color string */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <input
            value={hexInput}
            onChange={handleHexInput}
            className="bg-transparent outline-none text-[13px] font-mono text-on-surface w-[72px]"
            spellCheck={false}
          />
          <button onClick={copyHex} className="transition-colors" style={{ color: copied ? 'var(--accent-light)' : 'rgba(196,192,216,0.4)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{copied ? 'check' : 'content_copy'}</span>
          </button>
        </div>
        <span className="text-[12px] font-mono text-on-surface-variant/40 truncate">
          {colorString(mode, channels)}
        </span>
      </div>
    </div>
  )
}
