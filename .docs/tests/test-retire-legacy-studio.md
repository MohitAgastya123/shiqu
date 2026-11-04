# Retire legacy studio: focused regression

Use isolated production application data and controlled provider responses.

1. With cached old-studio reading history and a delayed current session list, load discovery. The hero shows its loading placeholder, makes no retired studio requests, then shows the newest readable current story.
2. Delay deletion hydration instead of session loading. The hero remains loading and never exposes a deleted story. When all data settles, only current visible versions are shown.
3. Open a current story deep link, advance a page, favorite, reload, delete and restore. Current progress/favorite state survives and restoration starts no inference by itself.
4. Against isolated desktop runtime, verify current-session reads/writes across service restart and existing direct/LAN/internet access guards. Verify the desktop summary uses the same persisted session.
5. Old studio endpoints return 404 and cannot create content or call inference. Shared media reads and current reader routes remain functional. Historical tables survive reopen unchanged.

Prefer in-app browser for previews. Local browser use is disabled in this Work session. Automated browser regression uses an isolated Playwright session specifically for response-delay/network assertions; it does not verify the user's existing tab or a packaged desktop app.
