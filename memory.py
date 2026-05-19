import os

MEMORY_PATH = os.path.join(os.path.dirname(__file__), "data", "memory.txt")

SYSTEM_PREAMBLE = "You are a helpful assistant running locally on Ricky's machine via Ollama."
SYSTEM_SUFFIX = "Respond directly and concisely. If asked about something not in your knowledge or context, say so rather than guessing."


def load_memory() -> str:
    """Return contents of memory.txt, or empty string if missing."""
    try:
        with open(MEMORY_PATH, "r", encoding="utf-8") as f:
            return f.read().strip()
    except FileNotFoundError:
        return ""


def save_memory(content: str):
    """Write content to memory.txt, creating data/ if needed."""
    os.makedirs(os.path.dirname(MEMORY_PATH), exist_ok=True)
    with open(MEMORY_PATH, "w", encoding="utf-8") as f:
        f.write(content)


def build_system_prompt() -> str:
    """Construct the full system prompt from preamble + memory + suffix."""
    memory = load_memory()
    parts = [SYSTEM_PREAMBLE]
    if memory:
        parts.append(f"\nHere is some context about Ricky that may be relevant:\n\n{memory}")
    parts.append(f"\n{SYSTEM_SUFFIX}")
    return "\n".join(parts)


if __name__ == "__main__":
    save_memory("Name: Ricky Cadden.\nLocation: Texas.\nPrimary work: digital marketing, n8n automation, AI tooling.")
    print("Memory saved.")
    print("\nSystem prompt:\n")
    print(build_system_prompt())
