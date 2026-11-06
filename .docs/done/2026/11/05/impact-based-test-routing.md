# Impact-based test routing

## Summary

Source-text heuristics hid adapter contracts and ran unrelated process/book checks on PRs. Explicit metadata now separates contracts, integrations, E2E and native consumers. PR CI and `pnpm test:changed` share responsibility/covered-source selection, conservative full fallback and retained safety smoke. AGENTS.md documents preview and task-path rules for shared checkouts. Main/tag/manual CI retains full qualification, with a stable required Shared checks aggregator and conditional native source coverage.

Implementation milestones: `0295103`, `f1c6860`. This record finalizes acceptance and timing evidence. No push.

## Verification

Measured local fast command22.50s→15.71s (30.2% less); provider PR fast+books59.47s→affected26.09s (56.1% less). Full counts, commands, evidence limits and hosted estimates are in `testing-triggers.md` and `testing-trigger-measurements.json`. No hosted timing or local Windows pass is claimed. Added browser/native coverage can increase relevant PR times; estimates also exclude extra aggregation-job startup.

## Notes

No production, client, desktop, Rust, lockfile or concurrent desktop/phone files changed. Tests used disposable libraries and controlled providers, with no desktop preparation/packaging. Existing browser receipt/synchronization and Vite port-isolation defects exposed by broader qualification were fixed only in fixtures/tests; assertions were preserved. All current direct production test imports have explicit ownership, validated without source-based execution selection.

## Final verification result

VR passed: all acceptance criteria complete

1. **Adapter separation:** Five provider contract files and the startup matrices are separated from production/CLI flows. Original scenario assertions are retained; focused split checks passed.
2. **Explicit metadata:** All 172 JS files and four native modules declare ownership, level, cost, platform, suite and gates. Validation rejects missing/invalid registrations. Direct-import ownership guards passed.
3. **PR safety base:** Every PR retains integrity smoke. Code PRs retain contracts and local-server/queue/state checks, plus static checks and affected suites.
4. **Conservative routing:** Unknown/shared/toolchain changes and failed/empty comparisons select full coverage. Rename and working-tree guards cover both paths, staged/unstaged/untracked changes, and explicit task selection.
5. **Relevant integration coverage:** Core changes select all six extended services. Explicit consumers broaden cross-domain coverage and native requirements. Packaging remains tag/manual.
6. **CI qualification:** Main/tag/manual runs qualify the current commit with full JS. `Shared checks` aggregates JS and required native results; reviewed failure/skip guards passed.
7. **Runner compatibility:** Existing full, extended, books, provider, release and npm commands remain. Plans select each file once, isolate fast/full flags, report platform exclusions and propagate failures.
8. **Timing comparison:** Logs substantiate fast tests **22.50s → 15.71s**, and the provider PR workload **59.47s → 26.09s**. Documentation distinguishes measured local results from hosted estimates and notes added E2E/native costs.
9. **Isolation:** No production/client/desktop/Rust/lockfile changes exist against the story base. Concurrent work remains outside the commits. Verification used isolated inputs without packaging or live inference.

Verification comprises the 1,422-case full run, its 1,419 passing cases, corrected affected browser files passing 11/11, 24 routing/ownership guards, 627 final fast cases, the final provider plan, typecheck/lint, and 24 clean-source native tests with one artifact-only test filtered. Passing unchanged full-run coverage was reused; there was no repeated single all-green full run. Windows execution and hosted timing remain explicitly disclosed limits.

All AP tasks are complete. Applicable AR/CR conclusions remain current through `0295103` and `f1c6860`.

VR risk: non-low — Required CI coverage and cross-platform qualification changed.
VR review round: 1; reviewer: reused

Read-only verification; no tests run or files edited.
