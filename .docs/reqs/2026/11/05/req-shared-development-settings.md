# Shared development settings

`pnpm dev` currently loads project `.env` and bypasses the saved provider database. A reader can select Google in desktop settings and still run Codex from the development browser, with different models and credentials. Development must inherit the same saved production configuration as desktop, browser CLI, and skill-driven CLI runs.

## Acceptance criteria

- [x] Ordinary `pnpm dev` and `pnpm dev local` use the shared saved provider, matching provider credential, models, and per-task reasoning defaults.
- [x] Explicit shell variables override saved values for this invocation only. Switching provider uses only that provider's credential; empty/invalid overrides retain existing shared resolver semantics.
- [x] Project `.env` cannot silently select a different development provider, key, models, or library. Standalone server/Docker env behavior remains unchanged.
- [x] Ordinary dev keeps the shared library selection; `local` still forces the checkout-owned shelf. Tests use disposable settings, homes, libraries, and ports without inference or access to the user's library.
- [x] Desktop, CLI, and skill documentation explain the common configuration and restart behavior; skills keep calling the production CLI and carry no independent credentials or provider configuration.
- [x] Redundant local `.env` settings are removed only after checking their saved replacements without exposing credentials; unrelated Docker settings are retained.

## Constraints and non-goals

Reuse the existing settings store and provider resolver, not another settings schema or secret store. No database schema changes, new provider fallback, live inference, Docker/desktop packaging, or changes to standalone `server/index.ts` configuration. Do not restart or advance the user's current production library. No new effective-configuration UI or CLI contract is needed for this fix. Existing running services adopt saved changes only after restart; CLI runs resolve at invocation.

## Open questions

None. Shell overrides remain supported. `.env` remains available for explicit standalone/Docker use.
