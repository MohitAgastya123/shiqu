# Shared development settings plan

Story base: `7fd5e5a6b021462987e074a323908b60657c7d4b` (clean tracked checkout at entry).

Risk: non-low — changes which saved provider credentials development loads and requires startup compatibility verification across entry points. No schema or production generation changes.

## Decision

Keep `server/index.ts` as the standalone environment-driven entry. Add a development backend entry that resolves variables through `SystemSettingsStore` and `effectiveProviderVariables()` before starting the same production server. Load secrets inside the backend, not into Vite or a temporary configuration file. Remove the development launcher's implicit `.env` loads. Continue resolving the library separately, preserving explicit/local selection. Saved provider/model/reasoning values are defaults; explicit shell overrides win and are never saved.

Setup must stop creating an obsolete provider `.env` for a normal development install; `.env.example` remains an explicitly copied Docker/standalone example. Documentation must direct source users to desktop settings or `pnpm cli --configure`.

## Tasks

- [x] First SS feasibility probe: pinned Node 24.22.1/pnpm 11.25.0; isolated saved Google fixture resolved matching credential/models/reasoning through the shared resolver without inference.
- [x] Added `server/development.ts` and wired the dev launcher to it, removing both implicit Node `.env` loads while preserving watch/port/library handling. Standalone entry unchanged.
- [x] Added isolated shared resolver/setup tests and real dev process scenarios for saved Google settings, shell overrides, unchanged saved state, `.env` exclusion, shared/local libraries, private-file protection, and shutdown. TT/ET execution passed as recorded below.
- [x] Updated setup, `.env.example`, development/desktop/skill user guidance; shared configuration needs no new skill runtime path or independent secret storage.
- [x] Compared private `.env` Gemini credential/models, Codex model, and library against saved settings read-only before removing duplicates and stale provider selector. Retained `SHIQU_PORT`; ignored `.env` is not staged.
- [x] Ran 11 applicable Node unit/integration suites (162 tests), typecheck, lint, and the matching real development startup E2E specification (3 tests). No inference, Docker or desktop packaging.

## Verification and risks

Matching E2E specification: `.docs/tests/test-shared-development-settings.md`.
Use pinned Node via PATH. Test homes must replace HOME/USERPROFILE/APPDATA/XDG paths and avoid inheriting user provider credentials. Saved fixture API keys are fake; no story generation is requested. Existing CLI/system settings tests cover provider matching and persistence semantics. Real process tests prove the actual dev launcher uses the new backend and ignores a poisoned project `.env`. Watch still rebuilds only into `dist/dev`; user-running services are not restarted.

Runtime cleanup must terminate spawned frontend/backend children and free both ports. The user's currently running server will keep its old provider until they restart it.

## Stage evidence

- REQ: recorded before implementation.
- AR passed: no blocking architecture flaws. AR risk: non-low — development reads saved provider credentials; startup precedence and isolation require verification. AR review round: 1; reviewer: new (`settings_review`).
- SS milestone: `843069a` (`fix: share saved provider settings with development`). Source/docs/test implementation complete; pinned-Node resolver/development unit checks (11 tests total) and typecheck/lint passed before the milestone commit.
- CR passed: no major findings. CR risk: non-low — development loads saved provider credentials/defaults. CR review round: 1; reviewer: reused (`settings_review`). Full base-to-milestone diff reviewed; no source changes followed.
- TT passed: 162/162 tests across `system-settings`, `settings-faults`, `startup-matrix`, `startup-pty`, `cli-library`, `npm-cli`, `headless-cli`, `cli-skill`, `development-local`, `development-access`, and `development-cache`. Executed with Node 24.22.1, `--experimental-strip-types --test --test-concurrency=2`; log `/tmp/shiqu-shared-settings-tt.log`. Initial sandbox attempt could not open listeners/PTYs; the permitted rerun passed outside the sandbox using isolated fixtures.
- `pnpm typecheck` and `pnpm lint`: passed under Node 24.22.1/pnpm 11.25.0.
- ET passed: 3/3 tests in `tests/development-local.e2e.mjs` via the matching specification; saved Google with poisoned `.env`, shell readonly override, and local-library/private-file/shutdown checks. Actual `pnpm dev` processes used disposable homes/checkouts/ports, fake keys and no inference. Log `/tmp/shiqu-shared-settings-et.log`.
- VR passed: all acceptance criteria complete. VR risk: non-low — development loads saved provider credentials. VR review round: 1; reviewer: reused (`settings_review`). Full criterion-by-criterion verdict preserved in DD.
- DD: `.docs/done/2026/11/05/shared-development-settings.md` records behavior, validation, and the full final VR result. Stale AP pending-evidence phrase corrected.
- GC: implementation milestone `843069a`; final evidence/acceptance documentation committed separately. No push; no user service restart.
