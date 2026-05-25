# Changelog

All notable changes to Golem are documented here.

---

## [0.9.1] — 2026-05-25

### Fixed
- Auto-updater now shows download progress (percentage) in the title bar chip while downloading, and surfaces a red "Update failed" chip if the download errors — previously all feedback was silent, making the update appear stuck

---

## [0.9.0] — 2026-05-25

### Added
- Light/dark theme toggle in Settings → Appearance; dark remains default
- Model Library: 13 new models added (Gemma3, Gemma4, Qwen3, Qwen3-Coder, Llama3.3, Llama4, DeepSeek Coder V2, QwQ, Devstral, Magistral, Phi4-Mini, Qwen2.5VL, MiniCPM-V)
- Model Library: tool-support badge and filter (All / Supports Tools / No Tools)
- Model Library: deprecated model toggle — hides superseded models by default
- System tray icon: closing the window minimizes to tray instead of quitting
- Global hotkey (default Alt+G) to show/hide window from anywhere, configurable in Settings → System
- Settings → Personal Memory: browse button to point memory at any file path (e.g., shared Agent_Memory)
- GitHub Action: weekly automated scan of ollama.com/library — opens issue when new models are detected

---

## [0.8.1] — 2026-05-24

### Fixed
- **GPU VRAM detection** — Fixed WMI integer wrap-around for GPUs with 4 GB or more VRAM (e.g. RTX 3050 Ti) by querying `nvidia-smi` first and falling back to `wmic`.
- **Packaging build** — Corrected `publisherName` location in `package.json` from the `nsis` block to the `win` block to fix electron-builder schema validation failures.

---

## [0.8.0] — 2026-05-24

### Added
- **Ollama install flow** — Golem detects if Ollama is missing at launch and shows a first-run screen. On Windows, downloads and silently installs Ollama automatically with a live progress bar. On macOS/Linux, opens the Ollama download page with a manual confirmation step.
- **Model Library** — new Library section in the bottom nav with a curated catalog of 17 model families (~35 sizes). Each card shows hardware-aware tier badges (Runs great / Might be OK / Not a chance) based on detected GPU VRAM. Filter by tier, use case, and parameter size; pull directly from the library card with live progress.
- **Installed tab** inside Library — lists locally pulled models with delete and set-as-default actions. Model management has been removed from Settings (only the default model selector remains there).
- **Collapsible sidebar sections** — Projects, Sigils, and Skills sections are collapsed by default, keeping Chats always visible at the top.

### Changed
- Auto-update check now runs once on launch only; removed the 4-hour polling interval.

---

## [0.7.0] — 2026-05-23

### Added
- **Full-text message search** — sidebar search now matches message content (≥3 chars); results show an "in messages" badge when the match is in message body rather than title
- **Zen mode** — collapse/expand the sidebar from the title bar toggle or Ctrl+B
- **Keyboard shortcuts** — Ctrl+N new chat, Ctrl+B toggle sidebar, Ctrl+/ focus search, Escape cancel stream
- **Draft persistence** — unsent input is saved per conversation and restored on return; 300ms debounced writes
- **MCP crash resilience** — transport error/close detection with exponential-backoff auto-reconnect (1s/2s/4s, max 3 attempts)
- **Tool-loop status bar** — amber warning bar in chat when the 4-iteration tool-loop cap is hit
- **Cross-platform builds** — macOS DMG (x64 + arm64) and Linux AppImage (x64) targets; `build:mac` and `build:linux` scripts added

### Fixed
- Replaced hardcoded Windows Ollama path with cross-platform `path.join()` fallback
- Removed IPC listener leak in `offLoopStatus` — now uses `removeAllListeners`
- Search result click now correctly switches to chat view
- Draft load cancellation guard prevents stale IPC responses overwriting current conversation input

---

## [0.6.1] — 2026-05-22

### Fixed
- Personal Memory no longer resets to blank when the Settings view mounts before
  the async load resolves. A guard ref now blocks the save from firing until the
  disk read has completed, and load errors surface in the console instead of being
  silently swallowed.

---

## [0.6.0] — 2026-05-22

### Added
- **MCP client** — connect any stdio-based Model Context Protocol server; tools
  discovered at connect time and injected alongside built-ins. Settings wizard
  with one-click templates (Filesystem, GitHub, Brave Search, SQLite, Puppeteer)
  and a smart command-string parser for custom servers. Per-project server
  association via sidebar toggles.
- **Hardware & model intelligence** — Settings Hardware panel shows CPU, RAM,
  GPU name + VRAM, and a per-model traffic light (Fits well / Tight fit / May
  be slow). ChatView session health row shows GPU/CPU mode badge, estimated
  turns remaining, and context fill percentage.
- **Model parameters per conversation** — temperature and context window sliders
  per conversation (tune icon in input bar). Settings persist; priority chain:
  conversation → project → global default.
- **Auto-title** — model generates a 4–6 word title after the first exchange,
  upgrading the immediate truncated fallback in the background.
- **Offline font bundling** — Inter, Hanken Grotesk, JetBrains Mono, and
  Material Symbols are now bundled via npm. No internet required at runtime.
- **Auto-update** — app checks for new GitHub releases on launch and every
  4 hours; update chip appears in title bar with one-click install.
- **Sigil & Skill Architects** — built-in skills that design and save sigils/
  skills directly via tool calling. "Test this sigil" and "Launch skill" action
  buttons appear inline after saving.
- **Starter pack** — 5 sigils and 18 skills seeded on first launch, drawing
  from Anthropic's prompt library and Claude Code superpowers (attributed in
  README).
- **Message editing** — click any sent user message to edit it; downstream
  messages are cleared and the response regenerates from the edit point.
- **Context window indicator** — token usage bar above the input, with amber
  warning at ≥75% and red at ≥90% fill.

### Changed
- Models management consolidated into Settings view (ModelsView removed).
- App always opens to a new session on launch rather than restoring the last
  conversation.
- Built-in Golem-category skill prompts always updated on launch (not skipped
  if already present).

---

## [0.5.0] — 2026-05-20

### Added
- **Self-build tools** — Golem can now read, write, list, and create files within
  any directory-linked project, and make git commits and pushes, all via the model.
  Tools are scoped: only offered when a project has a directory set.
- **Configurable context window** — global preset (8K/16K/32K/64K/128K) in
  Settings; per-project override in the expanded sidebar project view.
- **Live stream timer** — elapsed time ticks up while the model is responding;
  locks to actual token count on completion (e.g. `4s · 847 tokens`).
- **Collapsible file list** — directory-synced projects collapse their file list
  by default so they don't push conversations off screen.

### Changed
- File injection into system prompt is now skipped when live filesystem tools are
  active — the model reads files on demand instead of receiving a pre-loaded dump.
- Tool-use guidance injected into system prompt when a project directory is set,
  instructing the model to read before writing and verify paths before assuming.
- Tools badge now shows **Files · Git** (project context) or nothing (no project);
  removed the misleading "Tools" badge for plain conversations.
- Placeholder hint added to the input box when no project is active.
- Default `num_ctx` lowered to 8,192 (was 16,384) — opt up in Settings.
- `read_file` output capped at 20 KB to prevent context flooding.
- Tool iteration limit reduced from 8 to 4.
- File sync limits restored: 50 KB/file, 256 KB total.

### Fixed
- Removed `get_current_time` tool (unnecessary, caused false "Tools active" signal).
- `num_ctx` no longer redundantly saved in `handleSave` (immediate persistence only).

---

## [0.3.0] — 2026-05-19

### Added
- **Accent color picker** — full HSL/HWB/RGB/HSV slider-based color picker in Settings → Appearance; entire UI updates live as you drag; persists across restarts
- **Dynamic theme system** — all accent colors now driven by CSS custom properties (`--accent`, `--accent-rgb`, `--accent-mid`, `--accent-light`); no more hardcoded indigo

### Changed
- Versioning policy and dev workflow documented in `CLAUDE.md`
- `/build` slash command added for guided releases with auto version recommendation and changelog drafting

---

## [0.2.0] — 2026-05-19

### Added
- **Projects** — conversation folders with injected file context; attach files to a project and all chats in that project reference them automatically
- **Sigils** — named system prompts; apply a sigil to any conversation to give the model a persona or instruction set
- **File attachments** — attach files directly to individual messages via the paperclip button
- **Conversation search** — filter sidebar by conversation title in real time
- **Export as Markdown** — save any conversation to a `.md` file via the three-dots menu
- **Stats view** — in-app telemetry dashboard with token counts, message volume, latency, and a 30-day bar chart
- **Pin conversations** — pin important chats to the top of the sidebar
- **Retry / Regenerate** — re-run the last assistant response without retyping your message
- **Code block copy buttons** — hover any code block to copy it
- **Launch at startup** — toggle Windows auto-launch in Settings
- **Installer** — NSIS installer with desktop and Start Menu shortcuts (`npm run release`)

### Changed
- Sidebar conversation actions moved from double-click rename to hover three-dots menu
- Stats moved to bottom nav (secondary location)
- Version bump to 0.2.0

---

## [0.1.0] — 2026-04-01

### Added
- Initial release
- Chat view with Ollama streaming
- Sidebar with conversation list
- Settings view (default model, memory)
- Dark theme with indigo accent
- Custom frameless title bar
