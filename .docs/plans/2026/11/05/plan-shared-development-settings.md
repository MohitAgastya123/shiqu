# Shared development settings plan

Story base: `7fd5e5a6b021462987e074a323908b60657c7d4b` (clean tracked checkout at entry).

Risk: non-low — changes which saved provider credentials development loads and requires startup compatibility verification across entry points. No schema or production generation changes.

## Decision

Keep `server/index.ts` as the standalone environment-driven entry. Add a development backend entry that resolves variables through `SystemSettingsStore` and `effectiveProviderVariables()` before starting the same production server. Load secrets inside the backend, not into Vite or a temporary configuration file. Remove the development launcher's implicit `.env` loads. Continue resolving the library separately, preserving explicit/local selection. Saved provider/model/reasoning values are defaults; explicit shell overrides win and are never saved.

Setup must stop creating an obsolete provider `.env` for a normal development install; `.env.example` remains an explicitly copied Docker/standalone example. Documentation must direct source users to desktop settings or `pnpm cli --configure`.

## Tasks

- [x] First SS feasibility probe: pinned Node 24.22.1/pnpm 11.25.0; isolated saved Google fixture resolved matching credential/models/reasoning through the shared resolver without inference.
- [x] Added `server/development.ts` and wired the dev launcher to it, removing both implicit Node `.env` loads while preserving watch/port/library handling. Standalone entry unchanged.
- [x] Added isolated shared resolver/setup tests and real dev process scenarios for saved Google settings, shell overrides, unchanged saved state, `.env` exclusion, shared/local libraries, private-file protection, and shutdown. Execution evidence pending TT/ET.
- [x] Updated setup, `.env.example`, development/desktop/skill user guidance; shared configuration needs no new skill runtime path or independent secret storage.
- [x] Compared private `.env` Gemini credential/models, Codex model, and library against saved settings read-only before removing duplicates and stale provider selector. Retained `SHIQU_PORT`; ignored `.env` is not staged.
- [ ] Run applicable Node unit/integration suites, typecheck, lint, and the matching development startup E2E specification. Reuse existing CLI/settings tests as production parity evidence; do not build/package Docker or desktop.

## Verification and risks

Matching E2E specification: `.docs/tests/test-shared-development-settings.md`.
Use pinned Node via PATH. Test homes must replace HOME/USERPROFILE/APPDATA/XDG paths and avoid inheriting user provider credentials. Saved fixture API keys are fake; no story generation is requested. Existing CLI/system settings tests cover provider matching and persistence semantics. Real process tests prove the actual dev launcher uses the new backend and ignores a poisoned project `.env`. Watch still rebuilds only into `dist/dev`; user-running services are not restarted.

Runtime cleanup must terminate spawned frontend/backend children and free both ports. The user's currently running server will keep its old provider until they restart it.

## Stage evidence

- REQ: recorded before implementation.
- AR passed: no blocking architecture flaws. AR risk: non-low — development reads saved provider credentials; startup precedence and isolation require verification. AR review round: 1; reviewer: new (`settings_review`).
- SS milestone: source/docs/test implementation complete; pinned-Node resolver/development unit checks (11 tests total) and typecheck/lint passed. Actual process E2E and broader regression checks pending.
- CR / TT / ET / VR / DD / GC: pending.
