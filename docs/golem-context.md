# Golem — Extended Project Context

> This document supplements `CLAUDE.md` with deeper context on product decisions, architecture patterns, feature history, and expansion guidance. Read `CLAUDE.md` first for the core stack and key files.

---

## What Golem Is (and Isn't)

Golem is a **personal-use, local-first Electron desktop app** for chatting with Ollama models. It is not a server, not a cloud product, not a multi-user platform. The guiding constraint is simplicity: every feature addition should be evaluated against whether it makes the app feel heavier or requires the user to think more.

Its closest analogues in the market are LM Studio, Jan, and Msty — but Golem is more opinionated. Rather than being a general model manager, it's oriented around **workflow**: Sigils give the model a persona, Skills shape what you're doing, Projects scope context to a folder. The combination is the differentiator.

**The promise that must not be broken:** No cloud, no accounts, no subscriptions. All data stays on the local machine. Any feature that would require phoning home, creating a cloud account, or persisting data outside `app.getPath('userData')` is off-limits without a very explicit opt-in design.

---

## Feature Map (as of v0.6.1)

### Core Chat
- Streaming from local Ollama via Node.js `http` (not fetch) — chunked, real-time
- Message editing: click any user message, downstream messages clear, response regenerates
- Retry / regenerate last response
- Code block copy buttons on hover
- Export conversation as Markdown
- Auto-title: model generates a 4–6 word title after first exchange (background, non-blocking)
- Live stream timer → locks to token count on completion

### Conversation Management
- Sidebar with all conversations, pinning, real-time search/filter
- Pin to keep important chats at top
- Three-dots menu per conversation (rename, delete, export, pin)
- App always opens to a new session on launch (intentional — not a bug)

### Projects
- Group conversations into folders
- Attach a local directory to a project; files are synced into context
- When a directory is set, **filesystem tools activate** (read/write/list/create files, git commit/push)
- File injection into system prompt is skipped when live tools are active — model reads on demand
- Per-project context window override
- Per-project MCP server associations

### Sigils
- Named system prompt presets (personas)
- Apply to any conversation to instantly scope the model's behavior
- Built-in **Sigil Architect** skill that designs and saves new sigils via tool calling
- "Test this sigil" action button appears inline after creation

### Skills
- Workflow templates that shape the type of work (code review, debugging, brainstorming, etc.)
- Built-in **Skill Architect** for creating new skills
- "Launch skill" action button appears inline after creation
- Starter pack of 18 skills seeded on first launch (attributed to Anthropic prompt library + Claude Code superpowers in README)
- Golem-original skills: Sigil Architect, Skill Architect, Code Reviewer, Commit Message Writer, Email Drafter

### MCP Client (v0.6.0)
- Connects any stdio-based Model Context Protocol server
- Tools discovered at connect time, injected alongside built-in file/git tools
- Settings wizard with one-click templates: Filesystem, GitHub, Brave Search, SQLite, Puppeteer
- Smart command-string parser for custom servers
- Per-project server association via sidebar toggles

### Settings & Configuration
- Default model selection
- Global context window preset (8K/16K/32K/64K/128K)
- Per-conversation temperature and context window sliders (tune icon in input bar)
- Priority chain: conversation → project → global default
- Personal Memory: static text injected as system prompt context (`data/memory.txt` in dev, userData in prod)
- Accent color picker: full HSL/HWB/RGB/HSV sliders, updates entire UI live via CSS custom properties
- Launch at startup (Windows auto-launch toggle)
- Hardware panel: CPU, RAM, GPU name + VRAM, per-model traffic light (Fits well / Tight fit / May be slow)
- Auto-update: checks GitHub releases on launch + every 4 hours, silent download, one-click restart

### Telemetry / Stats
- 30-day token counts, message volume, latency
- Interactive bar chart
- All local — no external analytics

### UI / UX Conventions
- Cinema-dark theme throughout
- Dynamic accent driven by CSS custom properties (`--accent`, `--accent-rgb`, `--accent-mid`, `--accent-light`)
- Fonts bundled offline: Hanken Grotesk (display), Inter (body), JetBrains Mono (code)
- Icons: Material Symbols Outlined (bundled offline as of v0.6.0)
- Context window indicator above input: amber ≥75%, red ≥90%
- Session health row in ChatView: GPU/CPU mode badge, estimated turns remaining, context fill %
- Frameless custom title bar

---

## Data Architecture

```
SQLite (sql.js WASM)
├── conversations    — id, title, created_at, pinned, project_id, sigil_id
├── messages         — id, conversation_id, role, content, tokens, created_at
├── projects         — id, name, directory, context_window, files (JSON blob)
├── sigils           — id, name, content, created_at
├── skills           — id, name, category, prompt, created_at
└── settings         — key/value store for all user preferences
```

- Dev DB: `data/soren.db` (gitignored)
- Prod DB: `%APPDATA%/golem/` via `app.getPath('userData')`
- `persist()` is called immediately after every write — no deferred saves
- Memory context: `data/memory.txt` (dev) / userData path (prod) — static text injected as system prompt prefix

---

## IPC Architecture

All renderer→main communication goes through `contextBridge` → `ipcMain.handle`. The full API surface is defined in `electron/preload.js` as `window.golem.*`. Direct Node.js access from the renderer is disabled.

Key IPC channels:
- `ollama:stream` → starts a streaming chat, pushes `ollama:chunk` events back
- `ollama:abort` → cancels in-flight stream
- `db:*` → all database operations (read/write conversations, messages, projects, sigils, skills, settings)
- `fs:*` → filesystem tools (read, write, list, create — scoped to project directory)
- `git:*` → git operations (commit, push — scoped to project directory)
- `mcp:connect`, `mcp:disconnect`, `mcp:list-tools`, `mcp:call-tool`
- `system:hardware` → CPU/RAM/GPU info for the hardware panel
- `updater:check`, `updater:install`

---

## System Prompt Construction

Assembled in `electron/main.js` before each stream call. Order of injection:

1. Sigil content (if a sigil is active on the conversation)
2. Personal memory text (always, if non-empty)
3. Project file context (only if project has files AND no directory/tools are active)
4. Tool-use guidance (injected when project directory is set, instructs model to read before write)
5. MCP tool descriptions (if any servers are connected to the project)

---

## Streaming Implementation

Ollama streaming uses Node.js `http.request` (not fetch) because Electron's renderer fetch had issues with chunked transfer encoding in early versions. Chunks arrive as newline-delimited JSON, parsed in `main.js`, and forwarded to renderer via `event.sender.send('ollama:chunk')`. The done message includes exact `prompt_eval_count` and `eval_count` token figures, which update the stats DB and the live timer display.

Tool-use loop: after a model response, if tool calls are present, tools execute and results are appended to the message history. Loop continues up to 4 iterations (reduced from 8 in v0.5.0 to avoid runaway chains).

---

## Build & Release Process

```bash
npm run dev       # Vite dev server + Electron with HMR
npm run pack      # Unpacked dir only — fast sanity check
npm run build     # NSIS installer, no folder open
npm run release   # Build + open dist-electron folder
```

Auto-update uses `electron-updater` with GitHub Releases as the feed. To publish:
1. Bump version in `package.json` AND `src/components/SettingsView.jsx`
2. Update `CHANGELOG.md`
3. `GH_TOKEN=your_token npm run build -- --publish always`
4. `electron-builder` uploads installer + `latest.yml` to the GitHub release

Use the `/build` slash command inside Golem itself for a guided release flow.

Versioning policy (X.Y.Z):
- **X (Major):** DB schema incompatibility or data migration required
- **Y (Minor):** Any user-visible new capability
- **Z (Patch):** Bug fix, visual tweak, copy change — no new capability
- Currently pre-1.0 (0.Y.Z). Target 1.0.0 when ready to recommend without caveats.

---

## Known Constraints & Gotchas

- `sql.js` WASM must be unpacked from the asar: `asarUnpack: ["node_modules/sql.js/dist/**"]`
- Use `app.isPackaged` to branch dev vs production paths (not `NODE_ENV` alone)
- Nested `<button>` inside `<button>` is invalid HTML — use sibling absolutely-positioned elements for overlay actions (e.g., three-dots menu hover in sidebar)
- `group/name` scoped Tailwind hover works well for sibling targets within the same component
- MCP servers are stdio-based; no HTTP/SSE MCP support yet
- Windows x64 only — no macOS or Linux build targets currently
- Personal Memory resets-on-mount bug was fixed in v0.6.1 via a guard ref that blocks saves until disk read resolves

---

## Expansion Guidance

The following expansions have been evaluated. This section documents the decisions so future sessions don't re-litigate them.

### Cross-platform (macOS / Linux) — LOW EFFORT, HIGH VALUE
Electron + sql.js are already platform-agnostic. Work required:
- Add `mac` and `linux` targets to `electron-builder` config
- Audit any remaining Windows-specific paths (most already use `app.getPath('userData')`)
- Set up macOS notarization (annoying but mechanical)
- Test on target hardware

No UI changes needed. This is the cheapest expansion on the list.

### Multi-provider support (OpenAI / Anthropic / Gemini APIs) — MODERATE EFFORT
If added, must preserve the "Ollama is default and first-class" identity. Recommended approach:
- Define a provider interface: `{ streamChat(messages, options), listModels() }`
- Ollama becomes one adapter; cloud providers are siblings
- Existing streaming UI (`ollama:chunk` IPC pattern) doesn't need to change — adapters emit the same shape
- API keys stored locally via Electron `safeStorage` (encrypted, never leaves the machine)
- Surface as opt-in "Advanced" section in Settings — not promoted alongside Ollama
- The README's "no cloud" promise gets a carefully worded asterisk: *"Ollama by default. Cloud providers available as opt-in with your own API keys — no Golem accounts or subscriptions required."*

This is a weekend of focused work. The risk is UX sprawl in Settings, not the code.

### RAG / Document Q&A — DO NOT ADD
Adding real retrieval (embedding model, vector store, chunking, ingestion pipeline) would make Golem compete with AnythingLLM. That's not the right fight. The existing project file-context injection + live filesystem tools cover 70% of the practical value. If deeper retrieval is needed, it belongs in a dedicated pipeline, not bolted into this client.

### Workflow / Agent layer — DO NOT ADD
Dify's identity. Golem's Skills system is already a lighter-weight answer to this. Adding a visual workflow builder would be building a different product.

---

## Version History Summary

| Version | Date | Headline |
|---------|------|----------|
| 0.1.0 | 2026-04-01 | Initial release — streaming chat, sidebar, settings, dark theme |
| 0.2.0 | 2026-05-19 | Projects, Sigils, file attachments, search, stats, export, pinning |
| 0.3.0 | 2026-05-19 | Accent color picker, dynamic CSS theme system |
| 0.5.0 | 2026-05-20 | Self-build tools (file R/W, git), configurable context window, stream timer |
| 0.6.0 | 2026-05-22 | MCP client, hardware intelligence, model params per conversation, auto-title, message editing, context indicator, auto-update, Sigil/Skill Architects, starter pack, offline fonts |
| 0.6.1 | 2026-05-22 | Fix: Personal Memory reset-on-mount bug |

---

## Design Principles (Implicit Rules for New Features)

1. **Local by default.** If it requires a network call, it must be clearly opt-in and never required for core functionality.
2. **No new required setup.** A user who just installed Golem and has Ollama running should be able to use every core feature without additional configuration.
3. **One model at a time.** Golem is not a model comparison tool. Don't add multi-model parallel chat.
4. **Settings are a last resort.** If a behavior can be inferred or has a sensible default, don't add a toggle for it.
5. **The sidebar is the app.** Navigation lives in the sidebar. Don't add a top nav bar, tabs, or a second navigation layer.
6. **Keep the stream fast.** Any work that could delay the first chunk appearing on screen should happen before or after — not during — the stream.
