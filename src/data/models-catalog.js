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
export const MODELS_CATALOG = [
  {
    id: 'llama3.2',
    name: 'Llama 3.2',
    family: 'Meta',
    description: "Meta's compact Llama models optimised for edge and mobile. Strong reasoning and instruction following at small sizes.",
    tags: ['general'],
    context_k: 128,
    sizes: [
      { tag: 'llama3.2:1b',  label: '1B',  params_b: 1,  vram_gb: 1.5 },
      { tag: 'llama3.2:3b',  label: '3B',  params_b: 3,  vram_gb: 2.5 },
    ],
  },
  {
    id: 'llama3.1',
    name: 'Llama 3.1',
    family: 'Meta',
    description: "Meta's flagship open model with strong multilingual ability and a massive 128K context window.",
    tags: ['general'],
    context_k: 128,
    sizes: [
      { tag: 'llama3.1:8b',  label: '8B',  params_b: 8,  vram_gb: 5.5 },
      { tag: 'llama3.1:70b', label: '70B', params_b: 70, vram_gb: 43  },
    ],
  },
  {
    id: 'qwen2.5',
    name: 'Qwen 2.5',
    family: 'Alibaba',
    description: "Alibaba's top open-weight series. Excellent across a wide range of sizes, with strong coding and reasoning.",
    tags: ['general'],
    context_k: 128,
    sizes: [
      { tag: 'qwen2.5:0.5b', label: '0.5B', params_b: 0.5, vram_gb: 1.0 },
      { tag: 'qwen2.5:1.5b', label: '1.5B', params_b: 1.5, vram_gb: 1.5 },
      { tag: 'qwen2.5:3b',   label: '3B',   params_b: 3,   vram_gb: 2.5 },
      { tag: 'qwen2.5:7b',   label: '7B',   params_b: 7,   vram_gb: 5.0 },
      { tag: 'qwen2.5:14b',  label: '14B',  params_b: 14,  vram_gb: 9.0 },
      { tag: 'qwen2.5:32b',  label: '32B',  params_b: 32,  vram_gb: 20  },
      { tag: 'qwen2.5:72b',  label: '72B',  params_b: 72,  vram_gb: 45  },
    ],
  },
  {
    id: 'qwen2.5-coder',
    name: 'Qwen 2.5 Coder',
    family: 'Alibaba',
    description: 'Code-specialised variant of Qwen 2.5. Trained on 5.5T tokens of code. Excellent at generation, debugging, and explanation.',
    tags: ['coding'],
    context_k: 128,
    sizes: [
      { tag: 'qwen2.5-coder:1.5b', label: '1.5B', params_b: 1.5, vram_gb: 1.5 },
      { tag: 'qwen2.5-coder:7b',   label: '7B',   params_b: 7,   vram_gb: 5.0 },
      { tag: 'qwen2.5-coder:14b',  label: '14B',  params_b: 14,  vram_gb: 9.0 },
      { tag: 'qwen2.5-coder:32b',  label: '32B',  params_b: 32,  vram_gb: 20  },
    ],
  },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek R1',
    family: 'DeepSeek',
    description: 'Reasoning-first model that thinks before answering. Matches frontier models on math and logic tasks at a fraction of the cost.',
    tags: ['reasoning'],
    context_k: 64,
    sizes: [
      { tag: 'deepseek-r1:1.5b', label: '1.5B', params_b: 1.5, vram_gb: 1.5 },
      { tag: 'deepseek-r1:7b',   label: '7B',   params_b: 7,   vram_gb: 5.0 },
      { tag: 'deepseek-r1:8b',   label: '8B',   params_b: 8,   vram_gb: 5.5 },
      { tag: 'deepseek-r1:14b',  label: '14B',  params_b: 14,  vram_gb: 9.0 },
      { tag: 'deepseek-r1:32b',  label: '32B',  params_b: 32,  vram_gb: 20  },
      { tag: 'deepseek-r1:70b',  label: '70B',  params_b: 70,  vram_gb: 43  },
    ],
  },
  {
    id: 'gemma2',
    name: 'Gemma 2',
    family: 'Google',
    description: "Google's open model family. Known for clean instruction following and strong performance at the 2B and 9B sizes.",
    tags: ['general'],
    context_k: 8,
    sizes: [
      { tag: 'gemma2:2b',  label: '2B',  params_b: 2,  vram_gb: 2.0 },
      { tag: 'gemma2:9b',  label: '9B',  params_b: 9,  vram_gb: 6.0 },
      { tag: 'gemma2:27b', label: '27B', params_b: 27, vram_gb: 17  },
    ],
  },
  {
    id: 'phi4',
    name: 'Phi 4',
    family: 'Microsoft',
    description: "Microsoft's small model that punches above its weight. Strong STEM and reasoning ability from a 14B model.",
    tags: ['general', 'reasoning'],
    context_k: 16,
    sizes: [
      { tag: 'phi4:14b', label: '14B', params_b: 14, vram_gb: 9.0 },
    ],
  },
  {
    id: 'phi3.5',
    name: 'Phi 3.5',
    family: 'Microsoft',
    description: 'Compact 3.8B model with a 128K context window. Efficient for instruction following on constrained hardware.',
    tags: ['general'],
    context_k: 128,
    sizes: [
      { tag: 'phi3.5:3.8b', label: '3.8B', params_b: 3.8, vram_gb: 3.0 },
    ],
  },
  {
    id: 'mistral',
    name: 'Mistral 7B',
    family: 'Mistral AI',
    description: 'The original breakout open model. Fast, efficient, and surprisingly capable for its size. Good general-purpose baseline.',
    tags: ['general'],
    context_k: 32,
    sizes: [
      { tag: 'mistral:7b', label: '7B', params_b: 7, vram_gb: 5.0 },
    ],
  },
  {
    id: 'mistral-nemo',
    name: 'Mistral Nemo',
    family: 'Mistral AI',
    description: 'A capable 12B model built with NVIDIA. Strong multilingual support, 128K context, and improved reasoning over the base 7B.',
    tags: ['general'],
    context_k: 128,
    sizes: [
      { tag: 'mistral-nemo:12b', label: '12B', params_b: 12, vram_gb: 8.0 },
    ],
  },
  {
    id: 'codellama',
    name: 'Code Llama',
    family: 'Meta',
    description: "Meta's code-focused Llama variant. Supports code completion, infill, and instruction following across dozens of languages.",
    tags: ['coding'],
    context_k: 16,
    sizes: [
      { tag: 'codellama:7b',  label: '7B',  params_b: 7,  vram_gb: 5.0 },
      { tag: 'codellama:13b', label: '13B', params_b: 13, vram_gb: 8.5 },
      { tag: 'codellama:34b', label: '34B', params_b: 34, vram_gb: 21  },
    ],
  },
  {
    id: 'starcoder2',
    name: 'StarCoder 2',
    family: 'BigCode',
    description: 'Code completion model trained on The Stack v2. Strong at fill-in-the-middle and completion tasks across 600+ languages.',
    tags: ['coding'],
    context_k: 16,
    sizes: [
      { tag: 'starcoder2:3b',  label: '3B',  params_b: 3,  vram_gb: 2.5 },
      { tag: 'starcoder2:7b',  label: '7B',  params_b: 7,  vram_gb: 5.0 },
      { tag: 'starcoder2:15b', label: '15B', params_b: 15, vram_gb: 10  },
    ],
  },
  {
    id: 'llava',
    name: 'LLaVA',
    family: 'LLaVA Team',
    description: 'One of the original open vision-language models. Can analyse images you attach to your messages.',
    tags: ['vision'],
    context_k: 4,
    sizes: [
      { tag: 'llava:7b',  label: '7B',  params_b: 7,  vram_gb: 5.0 },
      { tag: 'llava:13b', label: '13B', params_b: 13, vram_gb: 8.5 },
      { tag: 'llava:34b', label: '34B', params_b: 34, vram_gb: 21  },
    ],
  },
  {
    id: 'llama3.2-vision',
    name: 'Llama 3.2 Vision',
    family: 'Meta',
    description: "Meta's multimodal Llama with vision built in. Understands images and documents alongside text.",
    tags: ['vision', 'general'],
    context_k: 128,
    sizes: [
      { tag: 'llama3.2-vision:11b', label: '11B', params_b: 11, vram_gb: 7.5 },
      { tag: 'llama3.2-vision:90b', label: '90B', params_b: 90, vram_gb: 55  },
    ],
  },
  {
    id: 'moondream',
    name: 'Moondream',
    family: 'Vikhyat Koptur',
    description: 'Tiny but capable vision model at 1.8B parameters. Understands images with very low hardware requirements.',
    tags: ['vision'],
    context_k: 2,
    sizes: [
      { tag: 'moondream:1.8b', label: '1.8B', params_b: 1.8, vram_gb: 2.0 },
    ],
  },
  {
    id: 'nomic-embed-text',
    name: 'Nomic Embed Text',
    family: 'Nomic AI',
    description: 'High-quality text embedding model. Use this with RAG pipelines or semantic search. Not for chatting.',
    tags: ['embedding'],
    context_k: 8,
    sizes: [
      { tag: 'nomic-embed-text:latest', label: '137M', params_b: 0.137, vram_gb: 0.5 },
    ],
  },
  {
    id: 'mxbai-embed-large',
    name: 'MxBai Embed Large',
    family: 'Mixedbread AI',
    description: 'State-of-the-art embedding model that outperforms OpenAI ada-002 on MTEB. For semantic search and retrieval.',
    tags: ['embedding'],
    context_k: 0.5,
    sizes: [
      { tag: 'mxbai-embed-large:latest', label: '335M', params_b: 0.335, vram_gb: 0.7 },
    ],
  },
]

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
