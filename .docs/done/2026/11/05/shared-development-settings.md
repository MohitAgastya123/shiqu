# Shared development settings

## Summary

`pnpm dev` previously loaded `.env` and could invoke Codex while desktop settings selected Google. Development now starts through `server/development.ts`, reusing the same saved provider/key/model/reasoning resolver as CLI. Secrets are loaded inside the backend. Explicit shell overrides remain temporary; `local` still owns its checkout shelf. Standalone/Docker startup remains environment-driven.

Setup no longer creates a provider `.env`. Documentation explains the common desktop/dev/CLI/skill configuration and restart behavior. Verified duplicate private `.env` provider/model/key/library entries were removed; the Docker port remains. No private configuration was committed.

## Verification

- Node 24.22.1, pnpm 11.25.0.
- `pnpm typecheck`, `pnpm lint`, and `git diff --check`: passed.
- 162/162 applicable tests across shared settings, failure/startup matrices and PTYs, CLI library/browser/headless/skill entry points, development arguments/setup, API access, and Vite caching. Log: `/tmp/shiqu-shared-settings-tt.log`.
- 3/3 real `pnpm dev` E2E scenarios: saved Google plus conflicting `.env`, explicit shell override, and forced local shelf/private download denial/shutdown. Matching spec: `.docs/tests/test-shared-development-settings.md`. Log: `/tmp/shiqu-shared-settings-et.log`.
- Initial sandbox test attempt could not open listeners/PTYs; the permitted rerun passed. Tests used disposable homes/settings/libraries and fake keys, without inference.
- Independent AR and CR passed; reviewer reused for VR. No source changes after CR.

## Final VR result

VR passed: all acceptance criteria complete.

VR risk: non-low — development now loads saved provider credentials.

VR review round: 1; reviewer: reused.

- **Shared defaults: complete.** Development uses the existing settings resolver; the real Google startup test verifies saved provider, models, and reasoning.
- **Temporary overrides: complete.** Shell override E2E and settings matrices cover precedence, matching credentials, empty/invalid values, and unchanged saved settings.
- **`.env` exclusion: complete.** Conflicting project `.env` is ignored; standalone/Docker entry remains unchanged.
- **Library isolation: complete.** Shared and explicit paths, forced local shelf, private-file denial, and shutdown pass with disposable homes/checkouts.
- **Documentation and skills: complete.** Updated guidance describes shared defaults and restart behavior; skills retain the existing CLI configuration path.
- **Private cleanup: complete.** Recorded read-only comparison verified saved replacements before removing duplicate `.env` entries; `SHIQU_PORT` remains.

Evidence: 162/162 applicable tests, 3/3 actual development-process E2E scenarios, typecheck, and lint passed under pinned Node/pnpm. No source changes followed CR.

Minor artifact correction: remove the stale “Execution evidence pending TT/ET” phrase from the completed AP task when closing the documentation.

## Notes

The artifact correction above has been applied. Existing user services were not restarted or used for verification; restart `pnpm dev` to adopt saved Google settings. No live inference, schema migration, Docker/desktop packaging, installed-skill replacement, or push was performed.

Implementation milestone: `843069a` (`fix: share saved provider settings with development`). Final acceptance/evidence is a separate local documentation commit.
