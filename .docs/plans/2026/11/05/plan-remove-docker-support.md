# Remove Docker container support plan

Story base: `df84254` (clean checkout).
Risk: low — remove unused container deployment and wording; production initialization, upgrade, packaging, settings resolution and identities remain unchanged.

## Decision

The user's correction explicitly permits keeping `docker/`. Retain the seed and every consumer at their current paths; do not rename package identity or stored owner IDs. Delete only the container Dockerfile, Compose manifests, healthcheck and ignore file, build script and Docker-only env configuration. Current UI/help/docs describe native desktop/CLI/development use. Historical artifacts remain historical.

## Tasks

- [x] Deleted container deployment files/build command and Docker-only example variables. Verified private `.env` still held only `SHIQU_PORT`, then removed it.
- [x] Removed current container guidance/footer/error wording and obsolete Dockerfile assertion. Setup's private env-file protection now tests generic standalone `PORT`. Seed and consumers are unchanged; seed SHA-256 remains `ea0111eebe396fe7a503791d1821788cc83cb78163251cbb45435588e5dc786f`.
- [ ] Run pinned-Node typecheck/lint, applicable local-book/configuration/CLI tests and matching development startup E2E. Verify the unchanged seed and consumers by Git diff. Preview the footer with `pnpm desktop:preview` in the in-app browser; no desktop preparation or packaging.

## Verification

Matching specification: `.docs/tests/test-remove-docker-support.md`. Isolated fixtures only; no inference, existing-library access, builds or publication. Existing current/historical seed paths and schema metadata must have no diff.

## Stages

- AR passed: no blocking architecture flaws. AR risk: low — container-only deletion/wording; runtime seed/upgrade/packaging/identities stay unchanged. AR review round: 2; reviewer: reused (`settings_review`). Prior seed-relocation review is superseded by the user's correction.
- SS: implementation complete; 102 applicable tests and lint passed. Desktop footer verified in in-app Vite preview with an explicit nonexistent temporary library (no user-library access); no native service or packaging. Initial typecheck found an existing stale `recharts` link; a frozen/offline pnpm reinstall with optimistic repeat-install disabled repaired dependencies without lockfile/version changes, and typecheck then passed.
- CR / ET / VR / DD / GC: pending.
