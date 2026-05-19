import sys, traceback

tests = [
    ("ui.chat_view", "ChatView"),
    ("ui.settings", "SettingsDialog"),
    ("ui.sidebar", "Sidebar"),
]

for mod, cls in tests:
    try:
        m = __import__(mod, fromlist=[cls])
        print(f"OK: {mod}")
    except Exception:
        print(f"FAIL: {mod}")
        traceback.print_exc()
