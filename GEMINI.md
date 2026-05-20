# Golem — Project Configuration & Status

## Project Name & North Star
**Golem** — A fast, private, local-first AI chat desktop app powered by Ollama. No cloud, no accounts, no subscriptions.

- **Status**: In Development (Pre-1.0, current version `0.3.0`)
- **Tech Stack**:
  - **Runtime**: Electron 33
  - **UI**: React 19 + Vite 5 + Tailwind CSS 3
  - **Database**: `sql.js` (WASM SQLite)
  - **AI Engine**: Ollama (local streaming via Node.js http)
  - **Packaging**: `electron-builder` (NSIS installer for Windows x64)

---

## Active Integrations
- **Ollama**: Local instance running on default port `11434`. Auto-started via `ensureRunning()` if not active.

---

## Environment & Credentials
- **Ollama URL**: `http://127.0.0.1:11434`
- **Database Paths**:
  - **Dev**: `data/soren.db` in project root (gitignored)
  - **Prod**: `%APPDATA%/golem` (via Electron `app.getPath('userData')`)
- **Memory Context**: `data/memory.txt` in dev, injected into every conversation.

---

## Brand & Design
- **Theme**: Cinema dark theme with ambient gradients.
- **Accent System**: Dynamic theme system driven by CSS custom properties (`--accent`, `--accent-rgb`, `--accent-mid`, `--accent-light`). Adjustable via HSL/HWB/RGB/HSV slider color picker in Settings.
- **Typography**: Hanken Grotesk (display), Inter (body), JetBrains Mono (code) — loaded from Google Fonts CDN.
- **Icons**: Material Symbols Outlined (Google Fonts CDN).

---

## Lessons Learned
- **`sql.js` ASAR packaging**: Requires `asarUnpack: ["node_modules/sql.js/dist/**"]` in `package.json` build config; WASM binaries fail to execute from inside ASAR archives.
- **Path Resolution**: Use `app.isPackaged` to correctly route between local dev data paths and production paths (using `process.resourcesPath`).
- **HTML Validation**: Nested `<button>` tags are invalid. Use sibling absolute-positioned elements for hover actions (e.g. three-dots context menu in the sidebar).
- **Tailwind Hover Triggers**: Use `group` and `group-hover` utility classes for styling sibling targets in the same component.
