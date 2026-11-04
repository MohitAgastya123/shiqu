# Consolidate story storage — executable verification contract

REQ/AP: `consolidate-story-storage`. All libraries, homes, providers and media are disposable fixtures. Use the production initializer/upgrader, import/restore and current workflow. Planned browser runner: `tests/story-storage-consolidation.e2e.mjs`; persistence, recovery and process-boundary cases belong in production integration tests as appropriate. No paid inference or personal-library mutation.

## C01 — Fresh and current-only libraries

Initial: one missing library and one pre-consolidation library containing current production rows for multiple owners, every generation state, historical/reselection versions, recoverable deletions, saved sources, credits, progress, references, queue receipts and media. No retired content is required.

Actions: initialize/open normally; record the backup path for the existing library; reopen, restart desktop/CLI and open through another supported entry point. In a separate missing-library fixture, inject a staging failure during first initialization and retry.

Expected: final physical `stories` table, format 1, support tables preserved, no `reader_sessions`/studio `jobs`/`progress` or alias/view. Fresh story count 0. Fresh/upgraded application columns, indexes, triggers and constraints match. All current IDs, raw row values, support-state invariants and existing media hashes match the protected manifest; retries add no copies. Reopening a clean current library does not repeat upgrade/backup. Failed first initialization exposes no partial live database; retry creates the same empty canonical schema.

## C02 — Mixed studio/demo/production purge

Initial: C01 production data plus old studio rows (including non-demo titles), `published` tombstones, current and retired analytics, known pear/Dongguo art, seed excerpt/note, unused and currently used demo book metadata. Include current rows that collide with a demo ID, studio-only uploaded assets, a shared asset, unknown-owner files, nested revision/original links, job-input-only references, retained exports and book-reference snapshots. Include a disposable demo reference whose bytes are also used by a current story.

Actions: upgrade normally; inspect current APIs and the final database/filesystem; GET and HEAD retained `/art/pear-N.png` and `/art/dongguo-N.png` URLs, read their current stories in the browser and export through the production Node exporter. Request an unreferenced legacy-art URL as a negative case. Resume no production work.

Expected: every current row survives, including colliding identities and all owners/revisions. No old studio row is converted into a production story/job. Eligible retired analytics/tombstones/media and unused demo metadata are gone. Disposable reference records are cleared; other current references remain. Shared, current-namespace, receipt-linked and uncertain bytes remain unchanged and retained exceptions are accounted for. Retained current-use legacy URLs preserve their URL, bytes, content type and readable/exportable behavior; unreferenced retired art returns 404 even if a stale file is present. Legitimate 24-book source originals and unrelated backups are untouched. Only the required safety backup remains; no separate studio archive or leftover live quarantine/database copy is retained.

## C03 — Backup requirement and rollback at every boundary

Initial: a mixed library with a complete pre-upgrade row/schema/media manifest. Inject a backup failure, staging failure, quarantine failure, database-publication failure, final-validation failure and cleanup failure in separate runs. Include a failure after SQL publication but before durable completion.

Actions: invoke the normal production upgrade, not a test-only pipeline. Inspect the failure and reported backup path. Reopen/retry after clearing the injected fault.

Expected: backup failure permits no destructive change. Other failures restore the original logical database/schema and all original media paths/bytes before normal access; no partial library or false success. The verified backup is restorable with the matching old application. Recovery failure blocks use and reports the backup. Retry completes once without duplicates or paid calls.

## C04 — Real process interruption and desktop race

Initial: C03 data, a Node upgrader paused at durable-journal/quarantine/publish/cleanup checkpoints, and a separate native or preview process attempting summary/deletion. Service ownership and the brief upgrade gate are exercised separately.

Actions: terminate the upgrader without cleanup at each checkpoint, including the interval when `shiqu.sqlite` has been moved aside; attempt normal access; restart. Race two upgraders and a native deletion. Exercise supported closed-handle replacement on available target runtimes.

Expected: no reader/writer observes a partial publication or changes the protected inventory during upgrade. Crash recovery restores the original before use, then a retry completes; a missing database plus pending journal is never initialized as a fresh library. Locks release after process death; journal presence prevents bypass based only on the renamed table/version. Busy operations fail/retry clearly without deadlock or fabricated empty summaries. Windows validation cannot be claimed solely from a macOS run.

## C05 — Older backups and D1/R2 imports

Initial: a verified older backup and a supported stopped legacy import source containing both current records and disposable studio/demo rows; include missing studio-only art, current shared media and historical migration receipts.

Actions: use actual maintenance/headless restore and import entry points into new explicit destinations, without starting generation; then start/read the destination normally. Inject an import/restore upgrade failure.

Expected: supported successful destinations use the canonical schema and purge policy, retain all current records/media and report the safety backup as required. Missing disposable art does not block success; missing protected media is reported and never silently omitted. Source backups/databases remain unchanged. Necessary pre-existing historical format conversions are compared through their documented content/state mappings; the consolidation rename/purge adds no changes to raw canonical current rows. Failed destinations are not published as complete; the raw restore helper used internally for rollback does not accidentally upgrade the old recovery snapshot.

## C06 — Newer or unknown schema refusal

Initial: a database with user_version greater than 1 and an unrecognized version 0 database; inventory database, media, runtime files and backup-directory contents.

Actions: attempt Node server, browser CLI, headless init/list/run, desktop service start, native summary/deletion, preview summary/deletion and import/restore publication. Verification-only backup inspection remains read-only.

Expected: supported entry points issue clear unsupported-version/shape errors before ownership/diagnostic/backup/migration/seed/library writes. A recheck under the gate fences a format changed after preflight. No workers/provider calls start. Current release notes identify 0.8.0 as the minimum consolidated-schema desktop/CLI release; old binaries are not falsely described as self-protecting.

## C07 — Browser caches and complete identity scope

Initial: Cache API/localStorage entries for a visible current story, a superseded revision, a recoverable deletion, a reselection record, an unknown legacy ID and demo IDs. Add another owner's current ID. The server's normal session list deliberately omits the protected historical/trash rows. Keep shared cached media.

Actions: load the reader against the upgraded library with the session list and identity metadata delayed independently. Then reload offline; retry after failed/malformed identity metadata. Use the default deletion API from an unchanged client as a compatibility check.

Expected: valid authoritative metadata includes all current IDs for the requesting owner only. Retired history/last-read/offline payloads are removed after metadata succeeds; current historical/trash/offline payloads and shared media are retained. No cleanup occurs from an empty visible shelf or failed/incomplete inventory. The default deletion API retains its old array shape. The hero stays loading while startup metadata is pending, performs one full initial session-list request and never promotes a demo through offline data.

## C08 — Desktop/browser/CLI and durable workflow behavior

Initial: an upgraded canonical library with prepared, paused, failed, completed and revised stories, shared book metadata, saved settings and exports.

Actions: open native and preview summaries before service launch, start/stop/restart service, navigate/read/advance/favorite/delete/restore from browser and supported desktop controls, inspect/export through CLI and exercise representative pause/recovery/revision commands against controlled production providers.

Expected: native readiness uses the normal one-shot upgrader without provider setup or work dispatch; canonical read-only summaries create no missing library. Book labels, current version selection, settings and direct/LAN/internet guards retain behavior. API paths and IDs are unchanged, progress/favorites/media survive, and durable triggers/receipts preserve current paid-work semantics. Existing export and full workflow regressions pass. No desktop/Docker package build is part of this execution.
