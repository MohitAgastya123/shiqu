# Remove Docker container support plan

Story base: `df84254` (clean checkout).
Risk: low — remove unused container deployment and wording; production initialization, upgrade, packaging, settings resolution and identities remain unchanged.

## Decision

The user's correction explicitly permits keeping `docker/`. Retain the seed and every consumer at their current paths; do not rename package identity or stored owner IDs. Delete only the container Dockerfile, Compose manifests, healthcheck and ignore file, build script and Docker-only env configuration. Current UI/help/docs describe native desktop/CLI/development use. Historical artifacts remain historical.

## Tasks

- [x] Deleted container deployment files/build command and Docker-only example variables. Verified private `.env` still held only `SHIQU_PORT`, then removed it.
- [x] Removed current container guidance/footer/error wording and obsolete Dockerfile assertion. Setup's private env-file protection now tests generic standalone `PORT`. Seed and consumers are unchanged; seed SHA-256 remains `ea0111eebe396fe7a503791d1821788cc83cb78163251cbb45435588e5dc786f`.
- [x] Pinned-Node typecheck/lint, 102 applicable local-book/configuration/CLI/desktop runtime tests, and 3 real dev startup E2E scenarios passed. Git diff confirms the seed/init/upgrade/packaging/CI/lock paths are unchanged. Footer verified via in-app Vite preview; the preview was stopped after observation. No desktop preparation or packaging.

## Verification

Matching specification: `.docs/tests/test-remove-docker-support.md`. Isolated fixtures only; no inference, existing-library access, builds or publication. Existing current/historical seed paths and schema metadata must have no diff.

## Stages

- AR passed: no blocking architecture flaws. AR risk: low — container-only deletion/wording; runtime seed/upgrade/packaging/identities stay unchanged. AR review round: 2; reviewer: reused (`settings_review`). Prior seed-relocation review is superseded by the user's correction.
- SS: implementation complete; 102 applicable tests and lint passed. Desktop footer verified in in-app Vite preview with an explicit nonexistent temporary library (no user-library access); no native service or packaging. Initial typecheck found an existing stale `recharts` link; a frozen/offline pnpm reinstall with optimistic repeat-install disabled repaired dependencies without lockfile/version changes, and typecheck then passed.
- SS milestone: `e513877` (`chore: remove Docker container support`).
- CR passed: no major findings. CR risk: low — only container deployment files/commands/variables/wording changed. CR review round: 1; reviewer: reused (`settings_review`). No source changes after CR.
- TT passed: 102/102 across development-local, local-books, local-server, codex-provider, system-settings, npm-cli, cli-library, headless-cli, cli-skill, desktop-runtime. Pinned Node 24.22.1 with `--test-concurrency=2`; log `/tmp/shiqu-remove-docker-tt.log`.
- ET passed: 3/3 real dev process scenarios in `tests/development-local.e2e.mjs`, matching the specification; log `/tmp/shiqu-remove-docker-et.log`.
- Typecheck/lint and whitespace check passed. Preview stopped with SIGINT after successful footer observation; its exit 130 is intentional cleanup.
- VR passed: all acceptance criteria complete. VR risk: low — container-only removal; production data and delivery paths unchanged. VR review round: 1; reviewer: reused (`settings_review`). Full final verdict in DD.
- DD: `.docs/done/2026/11/05/remove-docker-support.md` records delivery and the full final VR result.
- GC: implementation milestone `e513877`; final requirements/evidence documentation committed separately. No push.
