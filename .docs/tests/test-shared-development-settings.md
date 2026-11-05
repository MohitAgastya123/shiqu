# Shared development settings E2E

Execute with pinned Node: `node --experimental-strip-types --test --test-concurrency=1 tests/development-local.e2e.mjs`.

1. In a disposable home save Google provider, fake API key, distinct text/image models and per-task reasoning, plus a disposable library. Put conflicting Codex/provider/key/model/library values in the disposable checkout's `.env`. Start actual `pnpm dev` on free frontend/backend ports. GET `/api/reader/status` must identify saved Google models/reasoning and configured=true; status/logs must not contain the key. The library must be the saved disposable path; the poisoned `.env` path must not exist. Stop and verify both listeners close and saved settings are unchanged.
2. Repeat actual dev startup with explicit shell `readonly` and an explicit library directory. Status must report readonly and the selected shelf must be used, with saved Google configuration unchanged. No inference may run.
3. Run existing local-isolation startup with an isolated home, saved provider defaults, and a conflicting explicit shared library. `pnpm dev local` must use only the disposable checkout's `.data/dev-local`, retain private-file download denial, close both ports, and leave the conflicting library unopened.

The unit/integration settings matrix additionally verifies matching credentials, shell precedence, empty/invalid override behavior, and no writes of overrides. Existing desktop/CLI settings compatibility and headless CLI suites remain required regression checks.
