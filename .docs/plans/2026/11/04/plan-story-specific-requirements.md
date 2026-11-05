# Story-specific requirements

Git base: `89334129bf7d5988880e6d8d0afe064f456c24b1`.
Existing unrelated changes at entry: `lib/reader-gemini.ts`, `server/diagnostics.ts`, `tests/diagnostics.test.mjs`; preserve these changes. Shared Gemini recommendation edits must preserve its existing diff.

Risk: non-low — coordinated preparation/provider contracts and concurrent persistence of editable setup drafts.

Use the existing source/summary/count preparation call to return a bounded requirements pair. Save suggestions with a small optional setup provenance record and populate the existing setup draft, merging concurrent authored drafts rather than overwriting them. Provenance survives ordinary revisions; authored overrides, including empty fields, survive reselection and failed preparation. Confirmation already applies the draft to selection. Historical records remain readable with optional recommendation metadata; the first intake preparation explicitly requests and requires the pair. Repreparing the same story retains edits and does not regenerate requirements. No additional database schema or pipeline.

- [x] Extend the shared recommendation schema/prompt with story-specific adaptation direction and 2–4 source-grounded checks. Update controlled transports.
- [x] Populate setup drafts through the production engine; preserve concurrent draft saves in the repository checkpoint merge, preserve generated-art selection, and clear only unchanged automatic values on reselection.
- [x] Move generic defaults into generation system rules, normalize old automatic presets to empty, and separate creation/repair payloads from acceptance-only review payloads across all providers.
- [x] Explain generated editable guidance in existing setup editors and update the user guide.
- [x] Verify bounded contracts, provider payload separation, editable setup/restart/confirmation, concurrent drafts, reselection, and acceptance failure → repair → review using production implementations and isolated data.
- [x] Run Node 24.22.1, pnpm typecheck/lint and applicable unit/integration suites; inspect the actual setup editors in the in-app browser using a controlled production preview.

AR passed: no blocking architecture flaws

AR risk: non-low — shared provider output contracts and concurrent setup-draft persistence change together.

AR review round: 1; reviewer: new

Implementation must also preserve drafts when choose omits settings, clear inherited automatic values in open/commit reselection, use the actual selected art, and retain concurrent drafts through progress/final checkpoints.


CR passed: no major findings

CR risk: non-low — shared provider contracts and concurrent setup persistence.

CR review round: 3; reviewer: reused

Review repairs: retain provenance through ordinary revisions; preserve intentional blanks across reselection; refresh inherited overrides after failed preparation before applying new suggestions. Focused production-backed regressions cover all three paths.

Verification so far: Node 24.22.1 / pnpm 11.25.0; typecheck and lint pass; targeted provider/setup/headless suites pass; final reselection/revision group 34/34; affected generation/flow group 77/77. In-app browser at an isolated fixture preview verified populated fields, edits, save/reload persistence, and the unconfirmed production gate. No live inference or user-library access. Final complete suite: 1,224/1,226 pass. The two failures are Gemini task-reasoning fixtures affected by concurrent uncommitted evidence-format work. Both pass when loading the exact production provider from milestone `28bfd84` through an isolated Node load hook; the workspace file is never modified.

Concurrent baseline update: commit `5008b25998ba969a6161963a8bcef14a2b92f607` and ongoing Gemini grammar tests are unrelated; preserve them and exclude from this story's milestone commit.

SS milestone: `28bfd84` (`feat: generate story-specific setup requirements`). Implementation, focused production regressions, typecheck, lint and browser verification passed at commit time; the complete regression rerun and isolated provider checks are recorded below. Unrelated Gemini grammar changes were excluded with a partial-file stage.


Final verification: `pnpm test` under Node 24.22.1 with loopback access ran 1,226 tests in 184.8 seconds; 1,224 passed and only the two concurrent Gemini evidence-format task-reasoning cases failed. Re-running both against `28bfd84:lib/reader-gemini.ts` passed 2/2. This isolates unrelated workspace edits without rewriting them or introducing a second workflow. The implementation's focused provider/setup/review tests are also verified against that committed provider. No live model quality benchmark was performed.

The initial sandbox-only full run was stopped because local server tests hit EPERM; its results are not treated as application failures. Verification used isolated fixture libraries throughout.


Final committed-provider routing check: 26/26 pass (`/tmp/shiqu-requirements-committed-routing.log`).

VR passed: all acceptance criteria complete

VR risk: non-low — coordinated provider contracts, editable setup persistence and reselection provenance.

VR review round: 1; reviewer: reused

The full final VR result is retained verbatim in `.docs/done/2026/11/04/story-specific-requirements.md`.

DD/GC delivery retains implementation milestone `28bfd84` and commits the remaining completed REQ, verification plan and delivery note. No source or test changes are included in this finalization; concurrent Gemini work stays outside the delivery.
