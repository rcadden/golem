# Changelog

All notable changes to Golem are documented here.

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
