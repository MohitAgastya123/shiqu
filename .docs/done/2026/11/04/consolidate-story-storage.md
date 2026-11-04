# One story store; studio and demo removed

## Summary

`stories` is now the only story table. It is the old `reader_sessions` table renamed, and it keeps every current story, revision, owner and state. Opening, restoring or importing an existing library runs one upgrade. That upgrade deletes the retired studio tables (`stories`, `jobs`, `progress`) and their rows, published-deletion records, studio-only events, demo stories, and any demo art or studio-only media that no current story uses. It also removes the demo text from the `liaozhai` row and deletes the unused `zhongshanlang` book row.

Existing libraries upgrade only after a verified backup of the whole library. The work happens on a staged copy, files are quarantined before they are deleted, and a journal lets an interrupted upgrade restore the original before access. Desktop and preview reads share one short lock and wait for the upgrade. The library records its schema version, and these versions refuse a library with a newer schema before writing anything. Browser caches drop entries for stories that no longer exist, but only when the server returns a complete story list.

Implementation: `69a12e4`, `d7064a4`, `f870b2f`, `8762fef`, plus the review-fix commit that follows this document.

## Review fixes

- **Later migrations:** libraries already at schema version 1 (or up to the supported version) count as current. New `drizzle/` migrations apply to them in place after their own verified backup. Pre-consolidation migrations never run again. `db/library-format.json` records the newest migration file name so the desktop app waits until the library has it. Book seeds run on every open again.
- **Startup:** the legacy-art check now runs on the first `/art/` request instead of at app startup. If it fails, no legacy art is served and the app keeps running.
- **Restore:** restoring an older backup reports the source backup as the rollback point and leaves no staging snapshot behind. A failed restore publishes nothing.
- **Backup version:** backups record the real app version instead of a hard-coded `0.8.0`.
- **Book data:** new and upgraded libraries have the same book rows; `liaozhai` gets the seed's placeholder note.
- **Tests:** two desktop fixtures now use the production migration runner. The obsolete test that re-ran a pre-consolidation migration on an upgraded library was deleted.

## Verification

All checks used Node 24.22.1:
- Unit and integration tests: 1204/1204.
- Native Rust library tests: 2/2.
- Typecheck and ESLint pass.

All tests used temporary libraries; the user's library was never touched. No desktop or Docker package was built, and end-to-end and browser tests were not rerun after the review fixes.

## Compatibility

Desktop and CLI 0.8.0 or later are required. Older released versions don't check the schema version and must not open a consolidated library. To roll back, restore the pre-upgrade backup with the matching older app. The one-time upgrade needs free disk space of about twice the library size.
