# Golem

A fast, private, local-first AI chat desktop application powered by [Ollama](https://ollama.com). No cloud, no accounts, no subscriptions. All your data stays on your local machine.

---

## Features

### Chat & Conversations
- **Local Chat Streaming** — Real-time offline streaming from any Ollama model
- **File Attachments** — Attach code or text files directly to messages
- **Message Editing** — Edit any sent message; downstream responses are cleared and regenerated
- **Retry / Regenerate** — Re-stream the last assistant response with one click
- **Auto-Title** — Model generates a 4–6 word title after the first exchange
- **Draft Persistence** — Unsent input is saved per conversation and restored on revisit
- **Export as Markdown** — Download chat history as a clean markdown file
- **Pin Conversations** — Float important chats above the recent list
- **Full-text Search** — Search across all conversation titles and message content

### Organization
- **Projects** — Group conversations in folders; inject local file context into every chat in the project
- **Sigils** — Named system prompt presets (personas) for instantly scoped chats; built-in Sigil Architect to create new ones
- **Skills** — Workflow templates (code review, debugging, brainstorming, etc.); built-in Skill Architect; 18-skill starter pack

### Model Management
- **Model Library** — Curated catalog of 30 model families with descriptions, use-case tags, context length, and VRAM requirements; hardware-aware tier badges (Runs great / Might be OK / Not a chance)
- **Tool Support Indicator** — Teal badge and filter chip for models that support function calling
- **Deprecated Model Toggle** — Hide superseded models (CodeLlama → Devstral, Phi3.5 → Phi4-Mini, etc.) by default
- **Ollama Install Flow** — Detects missing Ollama on first launch; one-click install, progress tracking, and auto-continue
- **Installed Models Tab** — Pull and delete models directly from the Library view

### Intelligence & Tooling
- **MCP Client** — Connect external MCP servers (stdio); tools discovered at connect time; per-project server association
- **Hardware Panel** — RAM, CPU, GPU, and VRAM detection; per-model traffic-light compatibility indicators in Settings
- **Session Health** — Context fill %, estimated turns remaining, and GPU/CPU mode badge above the input area
- **Model Parameters** — Per-conversation temperature and context window size sliders

### Customization & UX
- **Light / Dark Theme** — Toggle in Settings → Appearance; preference persisted
- **Dynamic Accent Color** — HSL/HWB/RGB/HSV color picker; accent updates instantly across the UI
- **System Tray** — Closing the window minimizes to tray; global hotkey (default `Alt+G`) to show/hide from anywhere
- **Configurable Memory File** — Point Personal Memory at any file path (e.g., a shared `agent_memory.md`) via a browse button in Settings
- **Zen Mode** — Collapsible sidebar via title bar toggle or `Ctrl+B`
- **Keyboard Shortcuts** — `Ctrl+N` new chat · `Ctrl+B` toggle sidebar · `Ctrl+/` focus search · `Escape` cancel stream
- **Telemetry Dashboard** — 30-day token counts, message volume, and latency chart

### Reliability
- **Auto-Updates** — Checks for new GitHub releases on launch; downloads silently; progress shown in title bar; prompts for one-click restart
- **MCP Auto-Reconnect** — Exponential backoff reconnect (1s/2s/4s, max 3 attempts) on transport crash

---

## System Requirements

- **OS:** Windows 10 / 11 (x64) · macOS 12+ · Linux (x64)
- **Ollama:** Installed and running. Golem will prompt to install it if missing.
- **RAM:** 8 GB minimum; 16 GB recommended for larger models

> **Note:** macOS (DMG) and Linux (AppImage) builds are available but have not been tested on real hardware by the developer. Windows is the primary supported platform.

---

## Setup (Development)

```bash
git clone https://github.com/rcadden/golem.git
cd golem
npm install
npm run dev
```

### Development Commands

| Command | Action |
|---|---|
| `npm run dev` | Vite dev server + Electron with live hot reloading |
| `npm run build` | Build the production NSIS installer |
| `npm run release` | Build installer and open the output folder |
| `npm run pack` | Unpacked executable only — fast sanity check |

---

## Data & Storage

All data is stored locally:

| Location | Contents |
|---|---|
| `%APPDATA%/golem/` | SQLite database, settings, memory file (production) |
| `data/` | SQLite database (development, gitignored) |

The Personal Memory file defaults to `%APPDATA%/golem/memory.txt` but can be pointed at any path in Settings → Personal Memory.

---

## Releasing

Use the `/build` slash command in Claude Code — it handles version bump (both `package.json` and `SettingsView.jsx`), CHANGELOG entry, build, commit, annotated tag, push, and GitHub release upload.

---

## Prompt Library Attribution

The starter pack of sigils and skills bundled with Golem (`electron/seeds/starter-pack.js`) includes templates inspired by **[Anthropic's Claude Prompt Library](https://docs.anthropic.com/en/resources/prompt-library/library)**:

| Golem Skill | Inspired by |
|---|---|
| Code Clarifier | *Code clarifier* |
| SQL Writer | *SQL sorcerer* |
| Regex Builder | *Regex recipe* |
| Essay Polisher | *Prose polisher* |
| Grammar Fixer | *Grammar genie* |
| Pros & Cons | *Pros and cons* |
| Flashcard Creator | *Study buddy* |
| Meeting Notes | *Meeting scribe* |

The following skills are adapted from the **[Claude Code](https://claude.ai/code)** superpowers system:

| Golem Skill | Inspired by |
|---|---|
| Debug Assistant | `superpowers:systematic-debugging` |
| Project Planner | `superpowers:writing-plans` |
| TDD Coach | `superpowers:test-driven-development` |
| Code Review Responder | `superpowers:receiving-code-review` |
| Pre-PR Checklist | `superpowers:verification-before-completion` |
| Branch Completion | `superpowers:finishing-a-development-branch` |
| Brainstorming Partner | `superpowers:brainstorming` |

The **Sigil Architect**, **Skill Architect**, **Code Reviewer**, **Commit Message Writer**, and **Email Drafter** skills are original to Golem.

---

## License

Private / Personal Use.
