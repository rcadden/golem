function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) }
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

function hslToHex(h, s, l) {
  s/=100; l/=100
  const k=n=>(n+h/30)%12, a=s*Math.min(l,1-l)
  const f=n=>Math.round(Math.max(0,Math.min(255,(l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1))))*255)))
  return '#'+[f(0),f(8),f(4)].map(v=>v.toString(16).padStart(2,'0')).join('')
}

export function applyAccentColor(hex) {
  const { r, g, b } = hexToRgb(hex)
  const hsl = rgbToHsl({ r, g, b })
  document.documentElement.style.setProperty('--accent', hex)
  document.documentElement.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`)
  document.documentElement.style.setProperty('--accent-mid', hslToHex(hsl.h, Math.min(100,hsl.s+5), Math.min(90,hsl.l+11)))
  document.documentElement.style.setProperty('--accent-light', hslToHex(hsl.h, Math.min(100,hsl.s+10), Math.min(95,hsl.l+22)))
}
