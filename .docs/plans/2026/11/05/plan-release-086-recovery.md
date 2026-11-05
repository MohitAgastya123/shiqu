# Release 0.8.6 recovery fix

Git base: `17a00d5335b2b211ca77a7c497ba59872706797c`.
Risk: non-low — persisted recovery authorization, schema upgrade and public release.
Existing working changes in Claude comparison/provider files, reader-commands.ts and story-flow-control.test.mjs are unrelated and remain outside release commits.

Use an incremental migration to atomically register a legacy-compatible pending fault when a blocked revision is inserted failed. Backfill only failed blocked revisions without an unresolved fault. Keep schemaVersion/minimumAppVersion stable and advance latestMigration, so desktop waits for the shared verified-backup upgrade. The existing override and retry contracts consume the fault; no alternate recovery path is added.

1. [x] Extend the production revision regression through explicit acceptance, command replay, restart and completion; reproduce the missing fault before the fix.
2. [x] Add `0020_blocked_revision_faults.sql`, update `db/library-format.json`, and verify both atomic fault creation and isolated pre-migration backfill with backup evidence. Preserve normal/overridden behavior and migration fixtures.
3. [x] Update package/Tauri/Cargo versions to 0.8.6, upgrade guidance and changelog. Release notes omit DeepSeek and Claude. Review the implementation independently.
4. [ ] Run affected integration suites, the release gate and npm artifact smoke checks against the exact release source in an isolated checkout. Commit only intended files.
5. [ ] Publish npm 0.8.6 and push the release commit/tag with the existing pre-push gate. Immediately after the successful tag push, create a draft GitHub release with curated notes and `--verify-tag` before CI publication, then monitor native builds and installer publication through completion. Verify registry version and release assets.

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
