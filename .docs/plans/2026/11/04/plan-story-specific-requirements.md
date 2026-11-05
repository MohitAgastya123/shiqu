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
- [ ] Run Node 24.22.1, pnpm typecheck/lint and applicable unit/integration suites; inspect the actual setup editors in the in-app browser using a controlled production preview.

AR passed: no blocking architecture flaws

AR risk: non-low — shared provider output contracts and concurrent setup-draft persistence change together.

AR review round: 1; reviewer: new

Implementation must also preserve drafts when choose omits settings, clear inherited automatic values in open/commit reselection, use the actual selected art, and retain concurrent drafts through progress/final checkpoints.


CR passed: no major findings

CR risk: non-low — shared provider contracts and concurrent setup persistence.

CR review round: 3; reviewer: reused

Review repairs: retain provenance through ordinary revisions; preserve intentional blanks across reselection; refresh inherited overrides after failed preparation before applying new suggestions. Focused production-backed regressions cover all three paths.

Verification so far: Node 24.22.1 / pnpm 11.25.0; typecheck and lint pass; targeted provider/setup/headless suites pass; final reselection/revision group 34/34; affected generation/flow group 77/77. In-app browser at an isolated fixture preview verified populated fields, edits, save/reload persistence, and the unconfirmed production gate. No live inference or user-library access. Final complete suite pending.

Concurrent baseline update: commit `5008b25998ba969a6161963a8bcef14a2b92f607` and ongoing Gemini grammar tests are unrelated; preserve them and exclude from this story's milestone commit.
