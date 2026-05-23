# Golem — Roadmap

Sprints are thematic, not time-boxed. Items marked **bold** are critical path.
RICE scoring: Reach · Impact · Confidence · Effort (higher = do sooner).

---

## Sprint 1 — Chat Parity ✓
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

## Sprint 2 — Power Features ✓
_Features that pay off once the core is solid._

- [x] **Projects** — conversation folders with injected file context; files listed inside the project in sidebar; all chats in a project share the file context automatically; raw injection (no RAG)
- [x] **Three-dots hover menu** — hover `⋯` replaces double-click rename
- [x] **Message editing** — click a sent user message to edit it; clears subsequent messages and regenerates · RICE: 7·3·0.8·3 = 5.6
- [x] **Conversation search** — search bar in sidebar filters all conversations (Recent + Projects) by title in real-time
- [x] **Export conversation** — three-dots menu → "Export as Markdown"; opens save dialog with slugified filename
- [x] **Context window indicator** — subtle token usage bar near input; warns when approaching model limit · RICE: 5·2·0.7·2 = 3.5
- [x] **Keyboard shortcuts** — Ctrl+N new chat, Escape cancel stream · RICE: deprioritized per user preference _(shipped in Sprint 4 with full set: Ctrl+N, Ctrl+B, Ctrl+/, Escape)_

---

## Sprint 3 — Intelligence & Ecosystem ✓
_Golem becomes aware of itself and opens to the world._

- [x] **MCP client support** — connect external MCP servers (stdio); tools discovered at connect time and injected alongside built-ins; per-project server association; MCP management in Settings · RICE: 8·4·0.7·5 = 4.5
  - Phase 1: `electron/mcp/client.js` — spawn/connect/discover/execute; `mcp_servers` DB table; wire into tool registry ✓
  - Phase 2: Settings UI — add/remove/enable servers, status indicators, tool list preview ✓
  - Phase 3: Per-project MCP association (junction table + sidebar toggles) ✓
- [x] **Hardware & model intelligence** — surface what the device can actually do · RICE: 7·3·0.8·3 = 5.6
  - Hardware panel in Settings: RAM, CPU, GPU name + VRAM, per-model traffic-light ✓
  - Session health row above input: context fill %, estimated turns remaining, GPU/CPU mode badge ✓
- [x] **Auto-title** — model generates 4–6 word title after first exchange (async, non-blocking) · RICE: 6·2·0.8·2 = 4.8
- [x] **Model parameters per conversation** — temperature, context window size sliders in conversation settings · RICE: 4·2·0.7·3 = 1.9
- [x] **Offline font + icon bundling** — Inter, Hanken Grotesk, JetBrains Mono, Material Symbols served locally · RICE: 3·2·0.9·1 = 5.4
- [x] **Sigil Architect** — built-in skill that designs and saves new sigils via tool calling; "Test this sigil" inline action ✓
- [x] **Skill Architect** — built-in skill for creating new skills; "Launch skill" inline action ✓
- [x] **Skills starter pack** — 18 skills seeded on first launch (Anthropic prompt library + Claude Code superpowers) ✓
- [x] **Auto-update** — checks GitHub releases on launch + every 4 hours; silent download, one-click restart ✓

---

## Sprint 4 — Reliability & Reach ✓
_Harden what exists. Expand who can run it._

- [x] **Cross-platform builds** — macOS DMG (x64+arm64), Linux AppImage (x64); `build:win/mac/linux` scripts; macOS title bar uses `hiddenInset` + native traffic lights; hardcoded Ollama path made portable · RICE: 7·4·0.9·2 = 12.6
- [x] **Full-text message search** — sidebar search matches message content (≥3 chars); content matches show "in messages" badge; deduped against title results · RICE: 6·3·0.8·3 = 4.8
- [x] **Keyboard shortcuts** — Ctrl+N new chat, Ctrl+B toggle sidebar, Ctrl+/ focus search, Escape cancel stream · RICE: 5·2·0.8·2 = 4.0
- [x] **MCP error resilience** — `transport.onerror`/`onclose` detect crashes; exponential-backoff auto-reconnect (1s/2s/4s, max 3 attempts) · RICE: 6·3·0.8·2 = 7.2
- [x] **Tool-loop failure handling** — amber status bar in ChatView when 4-iteration cap hit; `ollama:loopStatus` IPC event · RICE: 5·3·0.8·2 = 6.0
- [x] **Zen mode** — collapsible sidebar via title bar toggle (`left_panel_close`/`left_panel_open`); Ctrl+B shortcut · RICE: 4·2·0.8·1 = 6.4
- [x] **Draft persistence** — unsent input saved per conversation; debounced writes; cancellation guard on load · RICE: 5·2·0.9·1 = 9.0

---

## Sprint 5 — Providers
_Extend the provider surface without diluting the local-first identity._

> Design constraint: Ollama remains default and first-class. Cloud providers are opt-in, hidden in Advanced Settings. The README's "no cloud" promise becomes: *"Ollama by default. Cloud providers available as opt-in with your own API keys — no Golem accounts or subscriptions required."*

- [ ] **Provider interface** — define `{ streamChat(messages, options), listModels() }`; Ollama becomes the first adapter · RICE: 8·4·0.7·4 = 5.6
- [ ] **OpenAI adapter** — GPT-4o, o3-mini; API key stored via Electron `safeStorage` · RICE: 7·3·0.7·3 = 4.9
- [ ] **Anthropic adapter** — Claude 3.5+; same safeStorage pattern · RICE: 7·3·0.7·3 = 4.9
- [ ] **Gemini adapter** — Gemini 1.5 Pro/Flash · RICE: 5·2·0.7·3 = 2.3
- [ ] **Advanced Settings section** — provider management UI; keys never displayed after entry; clear "local vs cloud" visual separation

---

## Future Explorations
_No commitment. Parking lot for evaluated ideas._

| Idea | Notes |
|------|-------|
| Multi-modal image attachments | Blocked on local model support — revisit when vision models are common |
| Voice input (push-to-talk, Whisper-backed) | High effort; not core identity |
| Ollama model marketplace browser | Nice-to-have; Ollama's own UI covers this |
| Artifacts side panel | Deferred from Sprint 3 · RICE: 5·3·0.5·5 = 1.5 |
| Conversation branching | Fork from any message · RICE: 4·2·0.5·4 = 1.0 |
| Encrypted conversation storage | Low demand until user base grows |
| Windows tray icon + global hotkey | Quality-of-life; Sprint 4 candidate if demand appears |

### Evaluated and Rejected
- **RAG / Document Q&A** — would make Golem compete with AnythingLLM; existing file-context + filesystem tools cover 70% of the value. Not our fight.
- **Visual workflow / agent builder** — that's Dify's identity. Skills are the right abstraction boundary for Golem.
- **Multi-model parallel chat** — violates the "one model at a time" design principle.

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
- [x] Accent color picker — full HSL/HWB/RGB/HSV sliders, live CSS custom property update
- [x] Stats / telemetry view — 30-day token counts, message volume, latency, bar chart (all local)
- [x] Self-build filesystem tools — read/write/list/create scoped to project directory
- [x] Git tools — commit/push scoped to project directory
- [x] Configurable context window (global preset + per-project + per-conversation)
- [x] Stream timer — live elapsed → locks to exact token count on completion
- [x] Personal Memory — static text injected as system prompt prefix; stored in userData
- [x] Launch at startup — Windows auto-launch toggle
- [x] Per-project context window override
- [x] Per-project MCP server associations
