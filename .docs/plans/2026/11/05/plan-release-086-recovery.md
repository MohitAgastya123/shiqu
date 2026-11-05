# Release 0.8.6 recovery fix

Git base: `17a00d5335b2b211ca77a7c497ba59872706797c`.
Risk: non-low — persisted recovery authorization, schema upgrade and public release.
Existing working changes in Claude comparison/provider files, reader-commands.ts and story-flow-control.test.mjs are unrelated and remain outside release commits.

Use an incremental migration to atomically register a legacy-compatible pending fault when a blocked revision is inserted failed. Backfill only failed blocked revisions without an unresolved fault. Keep schemaVersion/minimumAppVersion stable and advance latestMigration, so desktop waits for the shared verified-backup upgrade. The existing override and retry contracts consume the fault; no alternate recovery path is added.

1. [x] Extend the production revision regression through explicit acceptance, command replay, restart and completion; reproduce the missing fault before the fix.
2. [x] Add `0020_blocked_revision_faults.sql`, update `db/library-format.json`, and verify both atomic fault creation and isolated pre-migration backfill with backup evidence. Preserve normal/overridden behavior and migration fixtures.
3. [x] Update package/Tauri/Cargo versions to 0.8.6, upgrade guidance and changelog. Release notes omit DeepSeek and Claude. Review the implementation independently.
4. [x] Run affected integration suites, the release gate and npm artifact smoke checks against the exact release source in an isolated checkout. Commit only intended files.
5. [x] Hand the tested npm tarball to the user for publication (per later user steering), and push the release commit/tag with the existing pre-push gate. Immediately after the successful tag push, create a draft GitHub release with curated notes and `--verify-tag` before CI publication, then monitor native builds and installer publication through completion. Verify release assets.

Validation: `.docs/tests/test-release-086-recovery.md`. No Docker build. Desktop installers are built by the existing release CI. Unrelated working changes remain untouched; exact-commit checks and publication use a managed worktree if needed.

AR passed: no blocking architecture flaws.
AR risk: non-low — persisted recovery authorization, library migration, and public release.
AR review round: 1; reviewer: reused (`release_review`).

SS: regression first failed with `Blocked child needs its own recovery fault` in `/tmp/shiqu-086-repro.log`. Migration, backfill and atomic rollback checks plus revision/storage suites pass 55/55 in `/tmp/shiqu-086-recovery.log` using Node 24.22.1. Existing reader-commands/story-flow changes remain outside release edits. Concurrent commit `837862e` records the already-present provider quota diagnostic correction; it does not change recovery scope.

CR passed: no major findings.
CR risk: non-low — persisted recovery authorization, verified library migration, and public release.
CR review round: 2; reviewer: reused (`release_review`).

TT: 15/15 further upgrade/recovery/maintenance checks pass in `/tmp/shiqu-086-upgrade-checks.log`, including paused explicit retry and idempotent replay. Typecheck, full ESLint, scoped post-test ESLint and Rust formatting pass. The retry test's initial hold-fixture timeout was corrected by releasing the controlled image gate; production code was unchanged.

SS milestone: `81f5d9c` commits the reviewed migration, recovery regressions and task artifacts. Verification: 55/55 affected checks plus 15/15 further upgrade checks; no unrelated files staged.

Release milestone: `f1451e35c9e7c70e7a004cca9f0fd05635bd4d3e` commits 0.8.6 versions and curated notes. Isolated managed worktree `release-086` is clean at that commit. Exact-commit release checks pass 50/50 (`/tmp/shiqu-086-release-check.log`), affected regression checks pass 68/68 (`/tmp/shiqu-086-exact-regression.log`), and npm installed-artifact smoke passes all 24 books and native/headless/HTTP/restart/backup paths (`/tmp/shiqu-086-npm-publish.log`). Tarball SHA-256: `d813a1eaa30ffad4effc0bfef19ffe6096249865e794d8732297f277df5d9871`.

Tag pre-push checks also pass 50/50 in the hook's isolated commit checkout (`/tmp/shiqu-086-push.log`). `main` and annotated `v0.8.6` were pushed atomically; curated draft notes were created with `--verify-tag` before native CI publication. Workflow: https://github.com/yysun/shiqu/actions/runs/42044996683.

Initial npm delivery check: existing npm credential returned 401. The pipeline completed its checks/build/smoke then stopped on detached-HEAD branch policy, before publication. The unchanged release checkout was placed on `codex/release-086`; no Git checks were disabled. Authentication was requested only after the exact tarball was concrete and verified.

User steering: user will publish npm themselves. Cancelled the pending npm login; no credentials were entered and no package was published. Copied the already-tested tarball byte-for-byte to `/Users/esun/Documents/Projects/shiqu-docker/outputs/npm/apprun-shiqu-0.8.6.tgz` and verified the recorded SHA-256. Desktop release verification continues as announced.

Native attempt 1: macOS tests/package/smoke succeeded. Windows compiled the 0.8.6 executable, then GitHub returned HTTP 504 while Tauri downloaded `nsis-3.13.zip`; installer packaging stopped and publication was skipped. Logs: `/tmp/shiqu-086-windows-failure.log`. Reran failed jobs only using the connected GitHub tool; successful macOS artifact is retained. No source changes or tag replacement.

Delivery complete: native retry and publication succeeded, with release published at `2026-11-05T14:51:37Z`: https://github.com/yysun/shiqu/releases/tag/v0.8.6. Public notes exactly match the curated text and exclude the requested provider announcements. Both installers and `SHA256SUMS.txt` are present; the downloaded checksum file matches its GitHub digest, and its two installer hashes match GitHub's uploaded-asset digests. Evidence: `/tmp/shiqu-086-delivery.json`.

Final npm handoff: the user's separate work replaced `outputs/npm/apprun-shiqu-0.8.6.tgz` after the initial copy. That file was preserved. The original smoke-tested tarball is retained at `outputs/releases/0.8.6/apprun-shiqu-0.8.6.tgz`, with SHA-256 `d813a1eaa30ffad4effc0bfef19ffe6096249865e794d8732297f277df5d9871`. npm publication remains with the user. Concurrent commits and staged changes are outside this release; final evidence documentation is committed locally without pushing those unrelated commits.

VR passed: all acceptance criteria complete. Full final criterion evidence and review metadata are retained verbatim in `.docs/done/2026/11/05/release-086-recovery.md`.
