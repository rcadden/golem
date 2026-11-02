import BUNDLED_CATALOG from './models-catalog.json'

const GB = 1024 ** 3
// Integrated GPUs report a small slice of shared memory and Ollama runs on CPU for them.
const INTEGRATED_GPU = /intel\(r\)\s+(iris|uhd|hd)|radeon(\(tm\))?\s+graphics|microsoft basic|vega \d+ graphics/i
const MIN_DISCRETE_VRAM_BYTES = 2 * GB

// Decides what the model has to fit in: a discrete GPU's VRAM, or system RAM on CPU.
// Returns { mode: 'gpu' | 'cpu' | 'unknown', vramBytes?, ramBytes?, name? }
export function computeProfile(hardware) {
  if (!hardware) return { mode: 'unknown' }
  const gpu = (hardware.gpus ?? [])
    .filter(g => g.vramBytes >= MIN_DISCRETE_VRAM_BYTES && !INTEGRATED_GPU.test(g.name))
    .sort((a, b) => b.vramBytes - a.vramBytes)[0]
  if (gpu) return { mode: 'gpu', vramBytes: gpu.vramBytes, name: gpu.name }
  const ramBytes = hardware.ram?.totalBytes
  if (ramBytes) return { mode: 'cpu', ramBytes, name: hardware.cpu?.model }
  return { mode: 'unknown' }
}

// modelVramGb: model's estimated memory requirement in GB
export function calculateTier(modelVramGb, profile) {
  if (!profile || profile.mode === 'unknown') return 'unknown'
  if (profile.mode === 'gpu') {
    const vramGb = profile.vramBytes / GB
    if (modelVramGb <= vramGb * 0.85) return 'great'
    if (modelVramGb <= vramGb * 1.3)  return 'ok'
    return 'no'
  }
  // CPU: speed, not just fit, is the limit — small absolute caps, scaled down on low-RAM machines.
  const ramGb = profile.ramBytes / GB
  if (modelVramGb <= Math.min(3,   ramGb * 0.35)) return 'great'
  if (modelVramGb <= Math.min(6.5, ramGb * 0.6))  return 'ok'
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
