# English App Implementation Plan

## Goal
Deliver the English application specified in [REQ](../../../../reqs/2026/11/05/req-english-app.md), including English source reading and generated content through the shared production workflow.

## Current Context
React reader starts in client/main.tsx and client/ui/Reader.tsx. Desktop has its own React entry at desktop/main.tsx and Tauri commands in src-tauri/src. server/app.ts creates provider, local books, SQLite and production coordinator. lib/reader-engine.ts saves each generation checkpoint; preparation uses lib/reader-frame-recommendation.ts. Chinese text is embedded across JSX, schema errors, runtime messages, prompts, export rendering and CLI/native dialogs. data/library is 93 MB of provenance-checked Chinese source files, not a ready English corpus. User-facing source translations must be generated and saved during explicit production preparation, without rewriting provenance-checked downloads or introducing paid work on GETs. Existing tests contain Chinese fixtures and assertions. Dependencies are absent; host default Node is 22, so provision the exact pinned runtime locally. Folder has no .git metadata.

## Decisions
English is the sole interface/output language; translate source literals directly, without an i18n dependency, language flags or runtime replacement overlays. Preserve canonical book IDs and Chinese source evidence for exact quote validation, but supply English display metadata and saved English source text. Preparation translates source passages and full context in bounded 1,800-character chunks using the same provider/production preparation pipeline, saving each checkpoint before the next call; recommendation follows translation before confirmation. It must no untranslated reading/export fallback. Shared English source helpers serve reader snapshots and source API. Preserve mandatory archive filenames from AGENTS.md and original machine contracts, but translate their document content. Widen prose limits consistently in Zod/JSON prompts/UI to accommodate English. Do not rewrite legacy prompts used solely to recognize old stored defaults. No parallel alternate generation pipeline. No desktop build/package. Source review uses /tmp/shiqu-english-before.tar.gz because Git is unavailable.

## Phased Tasks
### Phase 1 - Establish scope and evidence
- [x] Inventory client, desktop, lib, server, scripts, Rust and exports; identify visible text versus canonical IDs/source evidence.
- [x] Preserve a source baseline outside the workspace and provision pinned Node/pnpm and frozen dependencies.
- [x] Create human-readable E2E scenarios for reader, desktop, preparation, source reading and exports.
### Phase 2 - Production language and source contracts
- [x] Translate shared production instructions in lib/reader-prompts.ts, reader-generation-contract.ts, reader-storyboard.ts, reader-review.ts and related discovery/requirements contracts to English.
- [x] Add a validated saved English source representation and partial progress to OriginalSource; translate one bounded chunk per recommend checkpoint in lib/reader-engine.ts before frame recommendation. Preserve token budgets and source completeness for large chapters.
- [x] Wire provider preparation schemas and reader source/snapshot responses to the same saved translation; fail clearly when a translation is absent instead of exposing Chinese source text.
- [x] Translate lib/reader-books.ts display metadata while preserving source lookup names/IDs and update English length bounds consistently across generation contracts and editor fields.
### Phase 3 - Product surfaces
- [x] Translate client/ui and desktop components, semantic labels, dates and document language metadata; check long English labels at phone/desktop widths.
- [x] Translate server errors/statuses, scripts/CLI messages and src-tauri native UI text while preserving machine error codes and stable IDs.
- [x] Translate PDF/PNG/ZIP/preview prose, credits and disclosures using shared production exporters and saved English source text.
- [x] Make chapter/content browse responses English-readable while retaining canonical source selections and source title evidence internally.
- [x] Translate current README, user guide, desktop documentation and CLI skill guidance.
- [x] Apply incremental migration 0021_english_image_recovery.sql to isolated libraries so SQL fault classification recognizes English and historical lost-image prefixes; update latestMigration and verify explicit redraw/restored-image recovery.
### Phase 4 - Verification and correction
- [x] Add targeted production tests for English preparation/source persistence, English output directions and prose bounds, export content and source identity stability.
- [x] Update language-dependent existing assertions/selectors without weakening behavior checks or rewriting Chinese evidence fixtures.
- [x] Run pnpm typecheck, pnpm lint and relevant unit tests; fix scoped regressions and record pre-existing/environment failures.
- [x] Run isolated reader browser scenarios and pnpm desktop:preview in the in-app browser; retain screenshots/evidence and do not package.
- [x] Review against baseline and scan Chinese runtime strings for source identity, historical recognition and unintended visible remnants; fix visible remnants.
### Phase 5 - Completion evidence
- [x] Reconcile acceptance criteria against implementation and actual test/browser evidence; repeat implementation/review when incomplete.
- [x] Write .docs/done/2026/11/05/english-app.md with honest results and limitations, and mark only verified work complete.
- [x] Report no Git commit possible in this source folder rather than initializing or staging an unrelated repository.

## Validation
Use PATH=/tmp/shiqu-english-tools/node-v24.22.1-darwin-arm64/bin:$PATH with pnpm 11.25.0. Install pnpm install --frozen-lockfile. Run pnpm typecheck, pnpm lint, pnpm test, then scoped production/E2E tests discovered in package.json and scripts/test-story-e2e.mjs. Add tests/english-app.test.mjs for new language contracts and translation checkpoint behavior. Use temporary SHIQU_DATA_DIR and isolated settings/home with fake providers for browser generation. Use pnpm desktop:preview for native console layout checks. Inspect English title/caption/source in shared exporter output, and preserve ZIP integrity/filenames. Run no real AI calls, desktop builds or packaging. AP itself runs no tests.

## Rollback / Risk
Translation can break IDs, source quotes, error prefix recovery, prompt-history recognition and archive parsers; preserve those contracts explicitly. English requires larger prose budgets and wrapping. Source translation increases preparation output and must fail atomically without losing paid progress. Older saved stories may lack English text and must require explicit production preparation rather than silently showing Chinese. The additive 0021 migration updates two SQL fault triggers to recognize English lost-image errors while retaining historical recognition; only isolated libraries were used for verification. No user-library access or destructive probes. Restore only scoped source files from baseline if rollback is needed; never restore user data.

## Architecture and code review result

AR passed after adding bounded source translation checkpoints for long chapters. CR fixed unique queue receipts, explicit source translation locking/control changes, pre-inference source validation, English theme export labels, legacy cache language identity, legacy signed archive verification, and SQL image-recovery prefix classification. No unresolved blocking architecture issue remains. Native Rust compile/format was unavailable because the Rust toolchain is not installed; no native bundle was built.

## Final verification

VR passed: all acceptance criteria verified by production code, documentation, typecheck/lint, 1,325 passing unit/integration tests and two passing browser scenarios. The source checkout has no Git metadata, so GC could not create a commit; no repository was initialized. Native Rust compilation/formatting was unavailable and no bundle was built.
