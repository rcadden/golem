# Changelog

All notable changes to Golem are documented here.

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
