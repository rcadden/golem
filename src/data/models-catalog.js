// userVramBytes: best GPU VRAM in bytes from hardware.gpus[].vramBytes
// modelVramGb: model's estimated VRAM requirement in GB
export function calculateTier(modelVramGb, userVramBytes) {
  if (!userVramBytes || userVramBytes === 0) return 'unknown'
  const userVramGb = userVramBytes / (1024 ** 3)
  if (modelVramGb <= userVramGb * 0.85) return 'great'
  if (modelVramGb <= userVramGb * 1.3)  return 'ok'
  return 'no'
}

export const TIER_LABEL = {
  great:   'Runs great',
  ok:      'Might be OK',
  no:      'Not a chance',
  unknown: 'Hardware unknown',
}

export const TIER_COLOR = {
  great:   { bg: 'rgba(60,200,100,0.12)',  text: 'rgba(80,220,120,0.9)',  border: 'rgba(60,200,100,0.25)' },
  ok:      { bg: 'rgba(220,160,30,0.12)',  text: 'rgba(230,180,50,0.9)',  border: 'rgba(220,160,30,0.25)' },
  no:      { bg: 'rgba(220,70,70,0.12)',   text: 'rgba(230,90,90,0.9)',   border: 'rgba(220,70,70,0.25)'  },
  unknown: { bg: 'rgba(150,150,150,0.1)',  text: 'rgba(160,160,160,0.7)', border: 'rgba(150,150,150,0.2)' },
}

// vram_gb values are Q4_K_M estimates (the default Ollama quantization)
// Formula: (params_b × 0.56) + 1.0 GB overhead
import BUNDLED_CATALOG from './models-catalog.json'
export const MODELS_CATALOG = BUNDLED_CATALOG

export const TAG_LABEL = {
  general:   'General',
  coding:    'Coding',
  reasoning: 'Reasoning',
  vision:    'Vision',
  embedding: 'Embedding',
}

export const TAG_COLOR = {
  general:   { bg: 'rgba(100,100,220,0.12)', text: 'rgba(140,140,240,0.85)', border: 'rgba(100,100,220,0.2)' },
  coding:    { bg: 'rgba(40,180,120,0.12)',  text: 'rgba(60,200,140,0.85)',  border: 'rgba(40,180,120,0.2)' },
  reasoning: { bg: 'rgba(180,100,220,0.12)', text: 'rgba(200,130,240,0.85)', border: 'rgba(180,100,220,0.2)' },
  vision:    { bg: 'rgba(220,140,40,0.12)',  text: 'rgba(240,170,60,0.85)',  border: 'rgba(220,140,40,0.2)' },
  embedding: { bg: 'rgba(100,180,220,0.12)', text: 'rgba(130,200,240,0.85)', border: 'rgba(100,180,220,0.2)' },
}

export const TOOLS_COLOR = {
  bg:     'rgba(80,200,200,0.12)',
  text:   'rgba(100,220,220,0.85)',
  border: 'rgba(80,200,200,0.2)',
}
