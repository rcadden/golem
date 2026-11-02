# Golem — Project Instructions

## North Star
A fast, private, local-first AI chat desktop app powered by Ollama. No cloud, no accounts, no subscriptions.

## Tech Stack
- **Runtime:** Electron 45 (upgraded from 33 on 2026-11-02, superseding "Electron 33"; electron-builder 26)
- **UI:** React 19 + Vite 5 + Tailwind CSS 3
- **Data:** sql.js (WASM SQLite) — `app.getPath('userData')` in production, `data/` in dev
- **AI:** Ollama (local streaming via Node.js http)
- **Fonts:** Hanken Grotesk (display), Inter (body), JetBrains Mono (code) — bundled via @fontsource
- **Icons:** Material Symbols Outlined — bundled via npm
- **Packaging:** electron-builder, NSIS installer (Windows x64)

## Architecture
- **IPC pattern:** `contextBridge` exposes `window.golem.*` in preload → `ipcMain.handle` in main
- **Streaming:** Ollama chunks pushed via `event.sender.send('ollama:chunk')`, done message has exact token counts
- **Data layer:** `electron/db.js` — writes schedule a debounced `persist()` (300ms); `flush()` runs on will-quit
- **System prompt:** sigil content + memory + project files injected in `electron/main.js` before streaming

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

## Versioning Policy (X.Y.Z)
| Part | Name | Bump when |
|---|---|---|
| **X** — Major | Breaking | DB schema incompatibility, data migration required, complete reimagining |
| **Y** — Minor | Feature | Any user-visible new capability ships |
| **Z** — Patch | Fix/Polish | Bug fix, visual tweak, copy change — no new capability |

**Rules:**
- Never bump patch after a minor in the same release — the minor covers it
- The leading `0` (0.Y.Z) means pre-1.0/beta. Bump to `1.0.0` when recommending without caveats
- Version lives in two places: `package.json` → `"version"` and `src/components/SettingsView.jsx` → version string in the About card

## Dev Workflow
```
npm run dev       # Live development — hot reload, no packaging, data in data/
npm run release   # Build + open dist-electron folder (run this to ship)
npm run build     # Build installer without opening folder
npm run pack      # Unpacked dir only — fast sanity check, no installer
```
Use `/build` to step through a guided release: version bump, build, commit, tag.

**Release order (always follow this sequence):**
1. Finish feature work on a branch/worktree
2. Merge the branch into `main` (via PR or local merge) — **never run `/build` on a feature branch**
3. Run `/build` on `main` after the merge is confirmed
4. `/build` handles: version bump in `package.json` AND `src/components/SettingsView.jsx`, CHANGELOG entry, `npm run build`, commit + annotated tag, push, GitHub release with installer + blockmap + `latest.yml`
5. Verify all three release assets are present: `gh api repos/rcadden/golem/releases/tags/vX.Y.Z --jq '.assets[].name'`

**Asset naming:** electron-builder writes `latest.yml` with dash-separated names (`Golem-Setup-X.Y.Z.exe`), but GitHub normalizes uploaded names to dots. Update `dist-electron/latest.yml` to use `Golem.Setup.X.Y.Z.exe` before uploading, and use `#targetName` in `gh release upload` to control the final asset name.

## Active Integrations
- **Ollama** — local, no API key. Must be running before Golem launches (auto-start via `ensureRunning()`)

## Lessons Learned
- `sql.js` requires `asarUnpack: ["node_modules/sql.js/dist/**"]` — WASM won't load from inside the asar archive
- Use `app.isPackaged` to branch between dev paths and `process.resourcesPath` production paths
- *(2026-11-02)* Electron 33 was ~12 majors behind and out of security support. Upgrading to 45 needed no code changes beyond the dialogs below: the preload only requires `electron`, the build is x64-only, and the renderer uses `navigator.clipboard`. Check those three first on any future major bump (45 removed sandboxed-preload shims, 44 dropped ia32, 44 removed renderer `clipboard`).
- *(2026-11-02)* Electron 43+ opens file dialogs in Downloads instead of the last folder. Dialogs in `electron/main.js` now pass `defaultPath` from the `last_dialog_dir` setting.
- *(2026-11-02)* `child_process.spawn` of a missing exe emits an async `error` event. Unhandled, it becomes a fatal "JavaScript error in the main process" dialog. Every `spawn` needs an `error` handler (found when Ollama was not installed).
- *(2026-11-02)* `wmic` is removed on Windows 11 24H2+. Use `Get-CimInstance` via PowerShell for hardware queries. Model tiers (`computeProfile`/`calculateTier` in `src/data/models-catalog.js`) use VRAM for discrete GPUs and system RAM for CPU-only machines (great <= 3 GB, ok <= 6.5 GB). VRAM-only tiering left integrated-GPU users with an empty "Runs great" list.
- *(2026-11-02)* Never show the user a terminal command for basic setup. Ollama start/install goes through the in-app Start Ollama / Reinstall buttons.
- *(2026-11-02)* An unpacked `npm run pack` build logs `app-update.yml` ENOENT from the updater. This is expected, since only the installer build ships the feed. Quit the app before re-packing or the build fails with EPERM on a locked DLL.
- Nested `<button>` inside `<button>` is invalid HTML — use sibling absolute-positioned elements for hover actions (e.g., three-dots menu in sidebar)
- `group/name` scoped Tailwind hover works well for sibling targets in the same component
