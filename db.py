import sqlite3
import os
from datetime import datetime
from typing import Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "soren.db")


def _connect() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init_db():
    with _connect() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                model TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id INTEGER NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('system', 'user', 'assistant')),
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_messages_conversation
                ON messages(conversation_id);

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
        """)


# ── Conversations ─────────────────────────────────────────────────────────────

def create_conversation(title: str, model: str) -> int:
    with _connect() as conn:
        cur = conn.execute(
            "INSERT INTO conversations (title, model) VALUES (?, ?)",
            (title, model),
        )
        return cur.lastrowid


def get_conversation(conv_id: int) -> Optional[sqlite3.Row]:
    with _connect() as conn:
        return conn.execute(
            "SELECT * FROM conversations WHERE id = ?", (conv_id,)
        ).fetchone()


def list_conversations() -> list[sqlite3.Row]:
    with _connect() as conn:
        return conn.execute(
            "SELECT * FROM conversations ORDER BY updated_at DESC"
        ).fetchall()


def rename_conversation(conv_id: int, title: str):
    with _connect() as conn:
        conn.execute(
            "UPDATE conversations SET title = ? WHERE id = ?", (title, conv_id)
        )


def touch_conversation(conv_id: int):
    with _connect() as conn:
        conn.execute(
            "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (conv_id,),
        )


def delete_conversation(conv_id: int):
    with _connect() as conn:
        conn.execute("DELETE FROM conversations WHERE id = ?", (conv_id,))


# ── Messages ──────────────────────────────────────────────────────────────────

def add_message(conv_id: int, role: str, content: str) -> int:
    with _connect() as conn:
        cur = conn.execute(
            "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)",
            (conv_id, role, content),
        )
        conn.execute(
            "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (conv_id,),
        )
        return cur.lastrowid


def get_messages(conv_id: int) -> list[sqlite3.Row]:
    with _connect() as conn:
        return conn.execute(
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
            (conv_id,),
        ).fetchall()


def update_message(msg_id: int, content: str):
    with _connect() as conn:
        conn.execute(
            "UPDATE messages SET content = ? WHERE id = ?", (content, msg_id)
        )


# ── Settings ──────────────────────────────────────────────────────────────────

def get_setting(key: str, default: str = "") -> str:
    with _connect() as conn:
        row = conn.execute(
            "SELECT value FROM settings WHERE key = ?", (key,)
        ).fetchone()
        return row["value"] if row else default


def set_setting(key: str, value: str):
    with _connect() as conn:
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )


def get_conversation_count() -> int:
    with _connect() as conn:
        return conn.execute("SELECT COUNT(*) FROM conversations").fetchone()[0]


# ── Smoke test ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    init_db()
    print(f"DB initialized at {DB_PATH}")

    cid = create_conversation("Test conversation", "qwen2.5-coder:7b")
    print(f"Created conversation id={cid}")

    add_message(cid, "user", "Hello!")
    add_message(cid, "assistant", "Hi there, how can I help?")

    msgs = get_messages(cid)
    for m in msgs:
        print(f"  [{m['role']}] {m['content']}")

    set_setting("default_model", "qwen2.5-coder:7b")
    set_setting("theme", "dark")
    print(f"  default_model = {get_setting('default_model')}")
    print(f"  theme         = {get_setting('theme')}")
    print(f"  conv count    = {get_conversation_count()}")

    delete_conversation(cid)
    print(f"Deleted conversation id={cid}")
    print("Smoke test passed.")
