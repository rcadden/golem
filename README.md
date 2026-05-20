# Golem

A fast, private, local-first AI chat desktop application powered by [Ollama](https://ollama.com). No cloud, no accounts, no subscriptions. All your data stays on your local machine.

---

> [!IMPORTANT]
> **Stack Migration Note:** Golem has been rewritten from Python + Flet to an **Electron 33 + React 19** architecture. The legacy Python code is deprecated.

## Core Features

- 💬 **Local Chat Streaming** — Real-time offline streaming from your local Ollama models.
- 📁 **Projects** — Group conversations in folders and automatically inject local file contexts into all chats within that project.
- 🔮 **Sigils** — Create named system prompt presets (personas) to instantly spin up scoped chats.
- 🎨 **Dynamic Accent Themes** — HSL/HWB/RGB/HSV slider color picker in Settings that instantly updates the cinema-dark theme.
- 📎 **File Attachments** — Attach code or text files directly to your messages.
- 📊 **Telemetry Stats** — Interactive telemetry dashboard showing 30-day token counts, message volume, and latency.
- 🔍 **Real-time Search** — Instant filtering of conversations in the sidebar.
- 📌 **Pin Conversations** — Keep your most important chats at the top of the sidebar.
- 💾 **Export as Markdown** — Download your chat history to a clean markdown document.

## System Requirements

- **OS:** Windows 10 or Windows 11 (x64)
- **Node.js:** v18.0.0 or higher
- **Ollama:** Installed and running locally (`ollama serve`)
- **Models:** At least one model pulled (e.g. `ollama pull qwen2.5-coder:7b`)

## Setup

```bash
# Clone the repository
git clone https://github.com/rcadden/golem.git
cd golem

# Install dependencies
npm install

# Run in development mode (with Hot Module Replacement)
npm run dev
```

## Development Commands

| Command | Action |
|---|---|
| `npm run dev` | Runs the Vite dev server and launches Electron with live hot reloading |
| `npm run build` | Compiles the React UI and builds the NSIS production installer (`.exe`) |
| `npm run release` | Compiles, builds the installer, and opens the output distribution folder |
| `npm run pack` | Creates an unpacked executable directory (fast sanity check) |

## Data & Database

All configuration and conversation history is persisted locally using **SQLite** via `sql.js` (WASM):
- **Development Database:** `data/soren.db` (gitignored, in the project root)
- **Production Database:** `%APPDATA%/golem/` (electron userData path)
- **Memory Context:** `data/memory.txt` (local static memory injected as system prompt context)

## License

Private / Personal Use.
