# English Fork Upstream Integration Plan

## Goal
Integrate upstream 0.9.0 into the saved English fork while preserving the English production experience and shared update history described by the [requirement](../../../../reqs/2026/11/06/req-english-upstream.md).

## Current Context
The user verified a clean clone and applied a byte/mode-verified patch from original ZIP c67c8ec. English conversion commit e0d62bb is published on origin/english-app. The current clean branch is english-upstream. Upstream/main d9005d4 adds 26 commits: 163 changed paths overlap 78 of the English conversion's 262 paths. Upstream deletes old desktop library panes, adds desktop/console-state.ts, separates text/image providers through server/provider-runtime.ts and adds tests/manifest.json. English adds migration 0021; upstream still ends at 0020. Node 24/pnpm must be located locally; Rust may be unavailable.

## Decisions
Perform a real no-commit Git merge on the existing integration branch, then resolve each conflict by preserving upstream behavior and reapplying English presentation/contracts. Do not use whole-tree ours/theirs resolution. Retain obsolete-file deletions and new console structure. Keep English translation attached to the text provider and delegate image generation only to the selected image provider. Preserve native settings CAS/private settings-file transport and root format marker 0021. Register English tests in the production test planner rather than using an alternate runner. No new language flag, parallel generation pipeline, provider fallback, dependency changes, or online-source feature.

## Phased Tasks
### Phase 1 - Verify scope and merge assumptions
- [x] Verify git status, origin/upstream remotes, the English checkpoint and upstream divergence in shiqu-fork.
- [x] Inspect upstream AGENTS.md, package scripts, tests/manifest.json and desktop/provider redesigns to identify integration boundaries.
- [x] Review this requirement, plan and E2E spec together and explicitly pass AR before merging.
### Phase 2 - Merge foundation and production behavior
- [x] Merge upstream/main with --no-commit --no-ff on english-upstream and inventory all unresolved paths.
- [x] Resolve server/** and lib/** conflicts retaining source translation/CAS checkpoints, composed provider credentials, selective redraw and English errors.
- [x] Preserve db/library-format.json, drizzle/0021_english_image_recovery.sql and its journal entry without changing verified library data.
### Phase 3 - Reader, desktop and native presentation
- [x] Resolve client/ui/ProviderSettings.tsx, Reader.tsx, ReaderShelf.tsx and related styles around the new upstream layouts with English controls and accessibility labels.
- [x] Resolve desktop/** and src-tauri/** around the new console and settings/runtime contracts; retain upstream deletions of obsolete library panes and tests.
- [x] Translate newly introduced visible strings, active entry-point docs and applicable comments; reconcile AGENTS.md with the user's English/pnpm instructions.
### Phase 4 - Shared verification and corrections
- [x] Register all four English suites and their covered sources in tests/manifest.json; update language-specific expectations in affected upstream tests without weakening behavior assertions.
- [ ] Install frozen dependencies using pinned Node/pnpm, run pnpm test:changed --plan, then pnpm typecheck, pnpm lint and pnpm test:changed for the selected combined task.
- [x] Run applicable desktop/native source checks using isolated Rust 1.93.0 and pinned Node: formatting and 24 native tests passed, with only the CI-designated prepared-bundle test filtered.
- [x] Execute the English reader and new service-console browser scenarios with isolated temporary libraries and controlled providers; attempt desktop preview through the in-app browser and record its unavailable tool surface. Automated screenshots were inspected separately.
- [ ] Review the combined diff and rerun only checks justified by corrections or unresolved failures; confirm no conflict markers or accidental source/data changes remain.
### Phase 5 - Acceptance and Git completion
- [ ] Record acceptance evidence and current limitations in .docs/done/2026/11/06/english-upstream.md; update this plan and requirement only with observed outcomes.
- [ ] Verify scoped staged changes and create the merge checkpoint with both parents after checks and review; preserve origin/english-app.
- [ ] Provide the user the next single publishing/usage step and distinguish the tested integration branch from main and the saved English checkpoint.

## Validation
Use pnpm install --frozen-lockfile, pnpm typecheck, pnpm lint, pnpm test:changed --plan and pnpm test:changed from shiqu-fork with Node 24.22.1/pnpm 11.25.0. The planner must include the registered English tests and appropriate provider/book/browser flows; unknown/shared paths intentionally broaden coverage. Browser verification uses isolated fixtures (which may bundle the reader to temporary output), fake provider responses, temporary data/settings and pnpm desktop:preview; never start against the personal library. If Rust is installed, use applicable source qualification from .github/workflows/desktop-macos.yml without desktop preparation/packaging. Inspect git diff --check, unresolved path list, branch parents and the staged file set. Do not treat old English-only test results as proof of this merged result.

## Rollback / Risk
The public origin/english-app checkpoint and user's original edited folder/dated backup preserve the pre-merge result. A failed integration remains isolated to english-upstream; no force reset or personal-library restore is needed. Provider composition and source-translation delegation, native CAS/settings transport, new test ownership, migration marker 0021, Chinese text reintroduced by clean merges and modify/delete desktop conflicts require focused review. Native compilation may remain unverified if Rust is unavailable. Do not package to compensate for missing source checks.

## Architecture Review
AR passed: no blocking architecture flaws. Independent reviews confirmed provider delegation, retained desktop deletions, native settings/format contracts and full English test ownership. Verification must record actual planner-selected browser/native commands and environment limitations.
