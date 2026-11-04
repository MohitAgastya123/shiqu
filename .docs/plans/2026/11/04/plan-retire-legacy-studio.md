# Retire the legacy studio

Git base: `bb43cf79f15142b9c0debc3299ff04fea6f501bf`.

Scope includes the existing uncommitted demo cleanup and hero loading guard from this conversation. This change intentionally retires old studio HTTP contracts. Current `/api/reader/*`, desktop native commands and saved-media URLs remain supported. Keep SQLite migrations/tables and legacy offline import readable; do not purge other libraries or backups.

Desktop evidence: `desktop/useLibrarySummary.ts` uses native `library_summary` or preview `/__desktop/library`; `src-tauri/src/library.rs` and `desktop/library-preview.ts` read current session summaries. Desktop lifecycle tests currently seed studio stories and must use current session fixtures instead.

- [x] Remove `client/ui/Admin.tsx`, studio-only presentation helpers/styles, `lib/studio-prompts.ts` and validation used solely by studio writes. Retain shared story types and current CLI theme choices.
- [x] Reduce `lib/server.ts` to current reader routing and shared saved-media reads. Retire `/api/admin/*`, `/api/stories*`, `/api/books`, `/api/me/progress` and `/api/events`; move liveness/smoke consumers to `/api/reader/sessions` or status.
- [x] Remove published-story runtime branches in `Reader.tsx`, `ReaderRepository` and book reference resolution. Preserve generated-story startup/deep links, deletion hydration, latest-version selection and local progress reconciliation; mask partial startup results.
- [x] Adapt isolated fixtures/tests and smoke scripts to current production APIs. Replace studio tests with retirement assertions and current workflow checks; preserve historical database migration/import tests and generic media safety tests.
- [x] Verify typecheck, lint, unit/integration suites, desktop Rust tests and the focused browser regression in `.docs/tests/test-retire-legacy-studio.md`. Use Node 24.22.1 and pnpm 11.25.0; no packaging/build commands.

Risks: removing an endpoint still used by desktop or health checks; removing shared media for existing generated stories; prematurely showing hero content; hiding current stories during delete/restore. Trace callers, retain shared reads, test delayed startup and existing persistence/access contracts. Browser interaction is disabled in Work settings; automated Playwright checks may use their isolated session for controlled response delays, with that limitation disclosed.

AR risk: non-low — intentional HTTP retirement and coordinated reader persistence changes.
AR review round: 1; reviewer: new.
AR passed: no blocking architecture flaws.

Startup scope: one initial current-library list per frontend instance, including React StrictMode effect replay. Deletion metadata remains a separate small request; a fresh snapshot suppresses the redundant immediate shelf poll. Desktop summary APIs and their polling cadence remain unchanged.

Implementation milestone: studio runtime retired; current reader startup shares one initial list, uses current progress only and waits for deletion hydration. Historical tables/import/backup and desktop source are unchanged. Runtime retirement/current-library reads, typecheck, lint, 8 focused browser/reference checks, 20 Rust tests and 44 focused reader-generation tests pass. Full Node 24 unit suite and existing lifecycle browser suite are running.

CR risk: non-low — retired HTTP contracts and coordinated reader/persistence changes.
CR review round: 1; reviewer: reused.
CR passed: no major findings.

Final TT: Node24.22.1 via `pnpm exec node --experimental-strip-types --test --test-concurrency=4 tests/*.test.mjs` passes1169/1169 (`unit-node24.log`). Focused current-reader generation passes44/44. Global pnpm's initial script run selected Node22, so it was superseded by the explicit pinned run. Typecheck, ESLint and diff checks pass.

Final ET: `reader-startup.e2e.mjs` plus `book-reference-star.e2e.mjs` pass8/8; existing `story-lifecycle.playwright.e2e.mjs` passes10/10. Tests cover delayed session/deletion responses, one initial list under StrictMode, progress/favorites/reload/delete/restore, uploaded-media references and continuous generation/revision controls. Automated Playwright uses isolated data/session; Work in-app browser is disabled. Desktop Rust passes20/20. Runtime old endpoints return404; current API still lists47visible current versions. No desktop production file, schema or migration changed; no desktop or Docker package/build was run.

SS implementation commit: `af4542b`. Final independent VR passed; all acceptance criteria and implementation/verification tasks are complete. DD: `.docs/done/2026/11/04/retire-legacy-studio.md`. No push or final GC.
