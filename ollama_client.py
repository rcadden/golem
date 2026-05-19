import asyncio
import json
import os
import subprocess
import sys
import httpx
from typing import AsyncIterator

BASE_URL = "http://localhost:11434"
TIMEOUT = httpx.Timeout(connect=5.0, read=300.0, write=10.0, pool=5.0)
_STARTUP_POLL_INTERVAL = 0.5  # seconds between readiness checks
_STARTUP_TIMEOUT = 15         # seconds to wait for Ollama to become ready

OLLAMA_OFFLINE_MSG = (
    "Ollama is not running. Start it with `ollama serve` "
    "or ensure the Ollama service is active."
)

_OLLAMA_SEARCH_PATHS = [
    os.path.expandvars(r"%LOCALAPPDATA%\Programs\Ollama\ollama.exe"),
    r"C:\Program Files\Ollama\ollama.exe",
]


def _find_ollama_exe() -> str | None:
    """Return path to the Ollama executable, or None if not found."""
    for path in _OLLAMA_SEARCH_PATHS:
        if os.path.isfile(path):
            return path
    # Fall back to PATH lookup
    import shutil
    return shutil.which("ollama")


async def ensure_ollama_running() -> bool:
    """
    Check if Ollama is reachable. If not, try to launch it.
    Returns True if Ollama is (or becomes) ready, False if it couldn't be started.
    """
    if await _is_ready():
        return True

    exe = _find_ollama_exe()
    if not exe:
        return False

    # Launch Ollama silently — it will start the server and system tray
    kwargs = {}
    if sys.platform == "win32":
        kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW | subprocess.DETACHED_PROCESS
    subprocess.Popen([exe], **kwargs)

    # Poll until ready or timeout
    elapsed = 0.0
    while elapsed < _STARTUP_TIMEOUT:
        await asyncio.sleep(_STARTUP_POLL_INTERVAL)
        elapsed += _STARTUP_POLL_INTERVAL
        if await _is_ready():
            return True

    return False


async def _is_ready() -> bool:
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(2.0)) as client:
            resp = await client.get(f"{BASE_URL}/api/tags")
            return resp.status_code == 200
    except Exception:
        return False


async def list_models() -> list[str]:
    """Return installed model names, sorted. Empty list if Ollama is offline."""
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(f"{BASE_URL}/api/tags")
            resp.raise_for_status()
            data = resp.json()
            return sorted(m["name"] for m in data.get("models", []))
    except (httpx.ConnectError, httpx.TimeoutException):
        return []
    except Exception:
        return []


async def stream_chat(payload: dict) -> AsyncIterator[str]:
    """
    Yield content string chunks from a streaming /api/chat call.
    Raises OllamaOfflineError if Ollama is unreachable.
    Raises httpx.HTTPStatusError on non-2xx responses.
    """
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            async with client.stream("POST", f"{BASE_URL}/api/chat", json=payload) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        chunk = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    content = chunk.get("message", {}).get("content", "")
                    if content:
                        yield content
                    if chunk.get("done"):
                        break
    except httpx.ConnectError:
        raise OllamaOfflineError(OLLAMA_OFFLINE_MSG)
    except httpx.TimeoutException:
        raise OllamaOfflineError("Connection to Ollama timed out. Is it still running?")


def build_chat_payload(
    model: str,
    messages: list[dict],
    system_prompt: str = "",
    temperature: float = 0.7,
    num_ctx: int = 8192,
) -> dict:
    """Build the request payload for /api/chat."""
    all_messages = []
    if system_prompt:
        all_messages.append({"role": "system", "content": system_prompt})
    all_messages.extend(messages)
    return {
        "model": model,
        "messages": all_messages,
        "stream": True,
        "options": {
            "temperature": temperature,
            "num_ctx": num_ctx,
        },
    }


class OllamaOfflineError(Exception):
    pass


# ── Smoke test ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import asyncio

    async def test():
        print("Checking installed models...")
        models = await list_models()
        if not models:
            print(f"  {OLLAMA_OFFLINE_MSG}")
            return

        print(f"  Found: {models}")
        model = models[0]
        print(f"\nStreaming test with '{model}'...")

        payload = build_chat_payload(
            model=model,
            messages=[{"role": "user", "content": "Say exactly: Hello from Golem."}],
        )

        response = ""
        try:
            async for chunk in stream_chat(payload):
                print(chunk, end="", flush=True)
                response += chunk
        except OllamaOfflineError as e:
            print(f"\nOffline: {e}")
            return

        print(f"\n\nStream complete. {len(response)} chars received.")

    asyncio.run(test())
