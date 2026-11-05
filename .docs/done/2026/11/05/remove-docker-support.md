# Remove Docker container support

## Summary

Removed Dockerfile, both Compose files, container healthcheck, `.dockerignore`, `build:runtime`, Docker-only example variables and the verified port-only private `.env`. Current instructions, guides, desktop footer and Windows provider help no longer advertise container support. The obsolete Dockerfile assertion was removed; provenance and standalone env protection tests remain.

`docker/seed.sql` and every initializer/upgrade/packaging consumer stay unchanged, as the user requested. Persisted owner/package identities, schema metadata, dependency versions, lockfile and historical records are unchanged. Seed SHA-256: `ea0111eebe396fe7a503791d1821788cc83cb78163251cbb45435588e5dc786f`.

## Verification

Node 24.22.1/pnpm 11.25.0: typecheck, lint, whitespace check, 102 applicable regressions and 3 actual `pnpm dev` E2E scenarios passed. Logs: `/tmp/shiqu-remove-docker-tt.log`, `/tmp/shiqu-remove-docker-et.log`. Footer observed in the in-app browser using `pnpm desktop:preview` with an explicit nonexistent temporary library; preview stopped afterward. No native service, inference, user-library migration, package build or publication.

Initial typecheck exposed a stale local `recharts` symlink. `pnpm install --frozen-lockfile --offline --force --no-optimistic-repeat-install` repaired it from cache without dependency/lockfile changes, after which typecheck passed.

## Final VR result

VR passed: all acceptance criteria complete.

VR risk: low — container support removed; production data and delivery paths unchanged.

VR review round: 1; reviewer: reused.

- **Container removal: complete.** Dockerfile, both Compose files, healthcheck, ignore/build configuration, Docker-only variables, and the verified port-only private `.env` were removed.
- **Compatibility: complete.** `docker/seed.sql` remains unchanged. Initialization, upgrades, packaging, CI, identities, schema metadata, dependencies, lockfile, and history have no changes.
- **Current guidance: complete.** Documentation, footer, and error wording no longer advertise containers. Book provenance checks remain.
- **Verification: complete.** 102/102 applicable tests and 3/3 dev-process E2E scenarios passed. Typecheck, lint, whitespace checks, and isolated in-app footer verification passed; the preview was stopped afterward.

All AP tasks are complete. No source changes followed CR. No edits or test execution performed during VR.

## Delivery

Implementation milestone: `e513877` (`chore: remove Docker container support`). Final acceptance/evidence is a separate local documentation commit. No push.
