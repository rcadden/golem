# Golem

A local desktop chat frontend for [Ollama](https://ollama.com) models. Persistent conversations, streaming responses, markdown rendering, and static personal memory — no Docker, no backend, no cloud.

Built with Python + Flet. Runs as a single process on Windows.

---

## Requirements

- Windows 11
- Python 3.11+
- [Ollama](https://ollama.com) installed and running (`ollama serve`)
- At least one model pulled (e.g. `ollama pull qwen2.5-coder:7b`)

## Setup

```bash
# Clone
git clone https://github.com/rcadden/golem.git
cd golem

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run
python main.py
```

## Usage

- **New Chat** — click "+ New Chat" in the sidebar
- **Switch models** — use the model picker in the top bar
- **Personal memory** — open Settings (⚙) and edit the memory text; it's injected as context into every conversation
- **Stop generation** — click the Stop button while the model is responding
- **Rename / Delete conversation** — right-click a conversation in the sidebar

## Stack

| Layer | Choice |
|---|---|
| UI | [Flet](https://flet.dev) |
| HTTP / Streaming | httpx (async) |
| Persistence | SQLite (stdlib) |
| Models | Ollama (local) |

## Data

All data lives in `data/` (gitignored):
- `soren.db` — conversation and message history
- `memory.txt` — personal context injected into every chat

## License

Private.
