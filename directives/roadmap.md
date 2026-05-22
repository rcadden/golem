# Golem — Roadmap

Sprints are thematic, not time-boxed. Items marked **bold** are critical path.
RICE scoring: Reach · Impact · Confidence · Effort (higher = do sooner).

---

## Sprint 1 — Chat Parity
_Make the core chat experience match Claude Desktop._

- [x] **Remove voice input icon from input bar** · RICE: trivial cleanup
- [x] **Full-width chat canvas** (widened max-width constraint) · RICE: trivial
- [x] **File attachments** — inject text content as user context into the message (text/code files; PDF not yet supported)
- [x] **Inline rename** — double-click a conversation title in sidebar to rename _(right-click also works)_
- [x] **Pin conversations** — pinned chats float above Recent, persist across restarts
- [x] **Sigils** — named system prompt presets; listed in sidebar above Recent; right-click to edit/delete; creates new chat scoped to that sigil
- [x] **Code block copy buttons** — per-block copy overlay button on hover
- [x] **Retry / Regenerate** — button below last assistant message; deletes last response and re-streams

---

## Sprint 2 — Power Features
_Features that pay off once the core is solid._

- [x] **Projects** — conversation folders with injected file context; files listed inside the project in sidebar; all chats in a project share the file context automatically; raw injection (no RAG)
- [ ] **Three-dots hover menu** — already implemented; hover `⋯` replaces double-click rename _(done as UX fix)_
- [x] **Message editing** — click a sent user message to edit it; clears subsequent messages and regenerates · RICE: 7·3·0.8·3 = 5.6
- [x] **Conversation search** — search bar in sidebar filters all conversations (Recent + Projects) by title in real-time
- [x] **Export conversation** — three-dots menu → "Export as Markdown"; opens save dialog with slugified filename
- [x] **Context window indicator** — subtle token usage bar near input; warns when approaching model limit · RICE: 5·2·0.7·2 = 3.5
- [ ] **Keyboard shortcuts** — Ctrl+N new chat, Escape cancel stream · RICE: deprioritized per user preference

---

## Sprint 3 — Intelligence & Ecosystem
_Golem becomes aware of itself and opens to the world._

- [ ] **MCP client support** — connect external MCP servers (stdio); tools discovered at connect time and injected alongside built-ins; per-project server association; MCP management in Settings · RICE: 8·4·0.7·5 = 4.5
  - Phase 1: `electron/mcp/client.js` — spawn/connect/discover/execute; `mcp_servers` DB table; wire into tool registry
  - Phase 2: Settings UI — add/remove/enable servers, status indicators, tool list preview
  - Phase 3: Per-project MCP association (junction table)
- [ ] **Hardware & model intelligence** — surface what the device can actually do · RICE: 7·3·0.8·3 = 5.6
  - Hardware panel in Settings: RAM, CPU, GPU name + VRAM, per-model traffic-light (🟢 VRAM / 🟡 split / 🔴 CPU-only)
  - Session health row above input: context bar always-visible %, estimated turns remaining, GPU/CPU mode badge per session
  - Input token counter: live chars→tokens estimate next to send button; warns at 85% context
- [ ] **Auto-title improvement** — use the model to generate a better title (async, after first response) · RICE: 6·2·0.8·2 = 4.8
- [ ] **Model parameters per conversation** — temperature, context window size sliders in conversation settings · RICE: 4·2·0.7·3 = 1.9
- [ ] **Offline font bundling** — bundle Inter, Hanken Grotesk, JetBrains Mono, Material Symbols locally (currently CDN; breaks without internet) · RICE: 3·2·0.9·1 = 5.4
- [ ] **Artifacts panel** — side-by-side panel for generated code/documents (like Claude's artifacts) · RICE: 5·3·0.5·5 = 1.5
- [ ] **Conversation branching** — fork from any message to explore a different direction · RICE: 4·2·0.5·4 = 1.0

---

## Future Explorations
_No commitment; parking lot for ideas._

- Voice input (push-to-talk, Whisper-backed)
- Multi-modal image attachments (when supported by local model)
- Ollama model marketplace browser within the app
- Full-text message search (currently title-only)
- Zen mode — collapse sidebar for full-canvas focus
- Draft persistence — restore unsent input when switching conversations
- Encrypted conversation storage
- Windows tray icon + global hotkey to open

---

## Completed
_Never delete — move items here when done._

- [x] Electron + React + Vite scaffold
- [x] sql.js SQLite persistence (conversations, messages, settings)
- [x] Ollama auto-start and streaming via IPC
- [x] Sidebar with conversation list, context menu (rename/delete)
- [x] Chat view with streaming, auto-title on first message
- [x] Thinking dots animation
- [x] Model picker dropdown in input bar
- [x] Models view (pull, delete, progress)
- [x] Settings view (Ollama URL, default model, personal memory)
- [x] Custom title bar with Windows controls (minimize/maximize/close)
- [x] Design pass: cinema dark, ambient gradient, unbubbled assistant messages, indigo user bubbles
