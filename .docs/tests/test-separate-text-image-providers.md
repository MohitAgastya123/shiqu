# Separate text and image providers scenarios

1. Existing settings without `imageProvider` (TS and native): image follows the text provider; settings JSON, credentials, runtime variables and status match the previous behaviour.
2. Codex text with Gemini images through the production provider and the real production queue: every frame request reaches Gemini, text/storyboard calls stay on Codex, image timeouts come from Gemini, status reports both models.
3. A failed image request through `withLocalBooks` uses the image provider's safe message; text failures keep the text provider's message.
4. Status is unconfigured and names the image service when the separate API image key is missing; read-only ignores any image setting; an invalid image provider fails clearly for generating modes.
5. Settings store: list key changes for both active providers; an unused provider's key cannot be changed; "same as text" and `null` are stored as unset; reset clears the image provider.
6. Invocation overrides: `SHIQU_IMAGE_PROVIDER` and env keys apply for one run without saving; saved image keys are read only for the effective image provider.
7. CLI `--configure` (scripted and PTY): image question follows the text provider; Enter keeps saved choices and keys; separate API image side asks its own key and image model; cancellation never partially saves.
8. Desktop: connection check validates text and image sides with their own keys/models; native Rust store, readiness, env overrides and TS↔Rust database interop include `imageProvider`; Vite preview shows text/image selectors, separate key/model or Codex fields, read-only hiding and no 390px overflow.

Automated cases: `tests/separate-providers.test.mjs`, updated `tests/system-settings.test.mjs`, `tests/fixtures/startup_pty.py`, Rust `cargo test`. No live inference.
