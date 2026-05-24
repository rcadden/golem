# Golem — Architecture

> Technical reference for Golem's subsystems and implementation patterns. For product context and feature decisions, see [golem-context.md](golem-context.md).

---

## Key Files

| File | Purpose |
|---|---|
| `electron/main.js` | Main process, IPC handlers, stream logic |
| `electron/db.js` | All SQLite operations |
| `electron/preload.js` | contextBridge — defines the full `window.golem` API |
| `src/App.jsx` | Root state, all conversation/project/sigil handlers |
| `src/components/Sidebar.jsx` | Nav, conversation list, projects, sigils, search |
| `src/components/ChatView.jsx` | Message thread, input, file attachments, streaming |
| `src/components/MessageBubble.jsx` | Markdown rendering, code copy, retry button |
| `src/components/StatsView.jsx` | Telemetry dashboard — token/message stats, bar chart |

---

## Data Architecture

SQLite via `sql.js` (WASM):

```
SQLite (sql.js WASM)
├── conversations    — id, title, created_at, pinned, project_id, sigil_id
├── messages         — id, conversation_id, role, content, tokens, created_at
├── projects         — id, name, directory, context_window, files (JSON blob)
├── sigils           — id, name, content, created_at
├── skills           — id, name, category, prompt, created_at
└── settings         — key/value store for all user preferences
```

- **Dev DB:** `data/soren.db` (gitignored)
- **Prod DB:** `%APPDATA%/golem/` via `app.getPath('userData')`
- `persist()` is called immediately after every write — no deferred saves
- **Memory context:** `data/memory.txt` (dev) / userData path (prod) — static text injected as system prompt prefix

---

## IPC Architecture

All renderer→main communication goes through `contextBridge` → `ipcMain.handle`. The full API surface is defined in `electron/preload.js` as `window.golem.*`. Direct Node.js access from the renderer is disabled.

Key IPC channels:

| Channel | Direction | Purpose |
|---|---|---|
| `ollama:stream` | renderer → main | Start a streaming chat |
| `ollama:chunk` | main → renderer | Push a streamed token chunk |
| `ollama:abort` | renderer → main | Cancel in-flight stream |
| `db:*` | renderer → main | All database operations |
| `fs:*` | renderer → main | Filesystem tools (scoped to project directory) |
| `git:*` | renderer → main | Git operations (scoped to project directory) |
| `mcp:connect` / `mcp:disconnect` / `mcp:list-tools` / `mcp:call-tool` | renderer → main | MCP server management |
| `system:hardware` | renderer → main | CPU/RAM/GPU info |
| `updater:check` / `updater:install` | renderer → main | Auto-update |

---

## System Prompt Construction

Assembled in `electron/main.js` before each stream call. Injection order:

1. Sigil content (if a sigil is active on the conversation)
2. Personal memory text (always, if non-empty)
3. Project file context (only if project has files AND no directory/tools are active)
4. Tool-use guidance (injected when project directory is set — instructs model to read before write)
5. MCP tool descriptions (if any servers are connected to the project)

---

## Streaming Implementation

Ollama streaming uses Node.js `http.request` (not `fetch`) — Electron's renderer fetch had issues with chunked transfer encoding in early versions. Chunks arrive as newline-delimited JSON, parsed in `main.js`, and forwarded to the renderer via `event.sender.send('ollama:chunk')`. The done message includes exact `prompt_eval_count` and `eval_count` token figures, which update the stats DB and the live timer display.

**Tool-use loop:** after a model response, if tool calls are present, tools execute and results are appended to the message history. Loop continues up to 4 iterations (reduced from 8 in v0.5.0 to avoid runaway chains).

---

## Known Constraints & Gotchas

- `sql.js` WASM must be unpacked from the asar: `asarUnpack: ["node_modules/sql.js/dist/**"]` — WASM won't load from inside the archive
- Use `app.isPackaged` to branch dev vs production paths (not `NODE_ENV` alone)
- Nested `<button>` inside `<button>` is invalid HTML — use sibling absolutely-positioned elements for overlay actions (e.g., three-dots menu hover in sidebar)
- `group/name` scoped Tailwind hover works well for sibling targets within the same component
- MCP servers are stdio-based; no HTTP/SSE MCP support yet
- Personal Memory resets-on-mount bug was fixed in v0.6.1 via a guard ref that blocks saves until disk read resolves
