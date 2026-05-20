# Implementation Plan — Update README.md to Electron/React Stack

This plan outlines the updates to README.md to reflect the modern Electron-based stack instead of the legacy Python+Flet stack.

## Affected Files
*   [README.md](../../README.md)

## Detailed Steps
1.  **Header & Description:**
    *   Change description from "Python + Flet" to "Electron 33 + React 19 + Vite 5 + Tailwind CSS 3 + WASM SQLite (sql.js)".
2.  **Requirements:**
    *   Remove Python 3.11 requirement.
    *   Add Node.js (v18+ recommended) and `npm`.
    *   Keep local Ollama dependency.
3.  **Setup & Development:**
    *   Replace `.venv` activation and `pip install` commands with `npm install`.
    *   Replace `python main.py` with `npm run dev` for running in development mode.
    *   Add packaging/release command: `npm run release` (to package installer using electron-builder).
4.  **Tech Stack Table:**
    *   Update the table:
        *   Runtime/UI: Electron 33 / React 19 + Vite 5 + Tailwind CSS 3
        *   HTTP/Streaming: Native Node.js `http` client
        *   Persistence: SQLite via `sql.js` (WASM)
        *   Models: Ollama (local)
5.  **Features List:**
    *   Document user features: Conversations, Projects (context directories), Sigils (persona presets), Custom themes (accent picker), stats telemetry, markdown rendering, code copying, and conversation search.
6.  **Data Path Details:**
    *   Clarify database location:
        *   Dev: `data/soren.db` in project root
        *   Prod: `%APPDATA%/golem` on Windows

## Risks & Mitigations
*   *Risk:* Users with old checkouts might run python commands and get errors.
    *Mitigation:* Keep a brief historical note in the README or a migration note, but make it very clear that the Python/Flet code is deprecated and the main branch is now Electron/React.
