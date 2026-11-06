# Discovery match reason validation fix

## Goal

Unblock the real story-to-comic workflow by carrying valid matching explanations through the final story-picker response without rejecting or shortening them.

## Current Context

`themeDecisionSchema` and provider JSON allow 480 characters. `matchLibraryStories()` forwards the exact reason. `discoverLocalStories()` records a matched search then calls `suggestionBatchSchema`, whose `matchReason` maximum is 120. `server/reader-intake.ts` and the browser streaming parser use the same suggestion schema. An isolated memory fixture reproduced a 138-character cold failure and the identical warm failure with zero further model calls. The user's live API reports configured Codex and an empty failed intake.

## Decisions

Reuse `themeDecisionSchema.shape.reason` for the optional suggestion `matchReason`. This keeps matching and display validation on the same established 480-character contract. Do not truncate prose, widen to unbounded text, alter prompts/cache keys, clear caches or retry inference during tests. Existing optional absent reasons remain valid. Inspect imports for runtime cycles before editing. Verification uses production discovery/intake/parser functions and isolated memory or temporary data; the real user's only dependent action will be an explicit UI retry after verification.

AR passed: no blocking architecture flaws; independent reviewer confirmed the contract reuse, import graph, cache invariants and coverage before source changes.

## Phased Tasks

### Phase 1 - Diagnose and review

- [x] Trace live `INVALID_OUTPUT` from successful matching to the final suggestion schema.
- [x] Reproduce the failure with an isolated 138-character reason and a zero-inference warm cache hit.
- [x] Review this REQ/AP and the E2E spec; explicitly pass AR before source edits.

### Phase 2 - Align the contract

- [x] Inspect `reader-theme-match.ts` imports and existing reason semantics to verify safe reuse.
- [x] Update `reader-suggestions.ts` to use the established theme-reason schema with its optional saved-field behavior.
- [x] Keep production model/prompt/cache/source contracts unchanged.

### Phase 3 - Production regressions

- [x] Add 480/481-character boundary assertions and exact reason preservation to existing discovery tests.
- [x] Exercise cold/warm `discoverLocalStories()` with a long valid reason and assert zero extra warm provider calls.
- [x] Exercise the production intake/browser response schema with that candidate and register any new direct source imports in `tests/manifest.json`.

### Phase 4 - Verify and review

- [x] Run `pnpm test:changed --plan` and its selected `pnpm test:changed` suite, honoring any full/native fallback.
- [x] Run `pnpm typecheck`, `pnpm lint`, focused tests and independent CR; fix any blocking regressions.
- [x] Confirm through the running app's GET status/session endpoints that no settings or saved user search were changed during diagnosis.

### Phase 5 - Close verification loop

- [x] Record acceptance evidence and a concise completion doc; update the prior comic-bubbles completion note with the discovered live blocker and fix.
- [x] Commit the verified fix on the existing feature branch and guide the user to explicitly retry the preserved search.

## Validation

Pinned Node 24.22.1 / pnpm 11.25.0. Run `node --experimental-strip-types --test tests/english-discovery-cache.test.mjs` with `SHIQU_TEST_TIER=full` for the focused production regressions, plus any intake test file changed. Run `pnpm test:changed --plan`, then `pnpm test:changed`, `pnpm typecheck`, `pnpm lint`, and `git diff --check`. If native is selected, use the repository's source-only CI Rust commands/TAURI_CONFIG; no packaging. Observe complete candidate/source data, precise 480-character validation, no repeat warm calls and no mutations to the user's saved search or settings. Browser parser coverage may be exercised through its real function with a controlled response; no visual design changed.

## Review and verification evidence

- Independent AR passed before implementation; independent CR passed after the shared schema and production-boundary tests were written.
- `SHIQU_TEST_TIER=full node --experimental-strip-types --test tests/english-discovery-cache.test.mjs tests/reader-suggestion-request.test.mjs`: 10 passed. Covers exact 480-character preservation, 481 rejection, absent legacy reasons, cold/warm real streaming browser parsing and saved intake, unchanged source receipts and zero extra warm provider calls.
- `pnpm typecheck`, `pnpm lint` and `git diff --check` passed.
- Updating the test manifest to register the new direct imports correctly selects full fallback: 181 JavaScript files and native checks. Source-only CI native tests passed 24; formatting passed, with only the designated prepared-bundle resource test filtered. No desktop preparation or package was run.
- Read-only live status/session checks confirmed configured Codex and preserved failed intake while the dev watcher loaded the source change. No diagnostic request ran inference or mutated the saved search/settings. A read-only cache inspection confirmed retained explanations exceeded the old 120-character boundary.

## VR acceptance matrix

VR passed: the live blocker is fixed in the production schema and every acceptance point is implemented, tested and documented.

| Acceptance point | Status | Evidence |
| --- | --- | --- |
| Shared finite reason bound | Complete | Both matching and suggestions accept exact 480-character text, reject 481 and retain legacy absent fields. |
| Cold discovery | Complete | Real production REST stream and browser `requestSuggestions` parse the complete reason with unchanged verified source. |
| Warm reuse | Complete | Repeated discovery and intake use the same cache with zero additional extraction/matching calls. |
| Saved intake/browser boundary | Complete | Controlled production SQLite/API intake persists the exact reason and source; no storyboard/image generation starts. |
| Regression and retry readiness | Complete | Final 181-file suite passed 1492 tests with no failures/skips/cancellations, typecheck/lint and native checks pass, AR/CR pass. Running dev service loaded the change; saved failed search remains available for an explicit user retry. |

Final full receipt: `.data/test-plans/2026-11-06T19-35-41-841Z-4bc8aa18/run.json` (full 181-file batch, exit 0). Log: `/tmp/shiqu-discovery-match-reason-full-final.log`. The first full run had an unrelated existing evaluation-owner concurrency failure (both contenders reported active); the isolated file passed 4/4 and the full rerun passed 1492/1492. The owner implementation/tests were unchanged. Native source-only checks used the repository CI `TAURI_CONFIG` resources override and filtered only the designated prepared-bundle test; no packaging was run.

## Rollback / Risk

One shared validation boundary changes. Preserve optional old fields and finite bounds. The shared matching module's import graph must not introduce a runtime cycle. Existing cached explanations remain intact; a rollback would restore the rejection bug but requires no data rollback. Do not publish or merge without user direction.
