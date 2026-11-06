# Impact-based test routing

Base: `75a1331d3594edb140b13125d3fd278c12a164a5`. Risk: non-low, because required PR coverage and cross-platform CI dependencies change together. Concurrent desktop specifications and any later desktop edits are outside this story.

## Design

Use `tests/manifest.json` as an explicit registry for JS files and native test modules. Each entry has file, groups, level, cost, platforms, suite and E2E gate ownership. Keep 13 responsibility domains from the inventory. Validate completeness, types, paths and supported values; execution selectors do not scan test source. Keep cheap contracts and selected small integrity/queue/state/storage checks unconditional for code PRs. Keep local-server conservative in that base.

Split Claude, DeepSeek, separate-provider, task-reasoning and any other genuinely mixed schema/adapter files at test declaration boundaries, preserving case bodies and controlled fixtures. New contract files have no queued production calls; corresponding flow files keep production workflow coverage.

One scope/plan implementation maps changed responsibilities to a union of metadata groups, handles old/new rename paths, and defaults unknown/shared changes to full JS. Test files select their own groups; common fixtures broaden to their consumer groups. Browser/service/native tests are separate execution levels, not inferred from suffixes. PR plan modes are fast and full: affected files run once, with full flags; unaffected base contracts run fast. Docs run integrity smoke only. Existing unit/flows/books/full/extended commands consume the same registry.

CI runs the PR plan plus static checks, with a stable Shared checks aggregator covering JS and required native jobs. Main and tag/manual qualification run full JS. Native PR checks use existing source tests without packaging/preparation; bundle-dependent smoke remains at artifact gates and any excluded source probe is explicitly identified. Rust builds use resource-free test configuration when bundle assets are unavailable; do not alter native production code.

## Ordered work

- [x] First SS probe: create a disposable baseline snapshot and verify old fast suite/selection/timing with pinned Node/pnpm; confirm native test feasibility without preparation. Record unresolved environment constraints.
- [x] Split adapters and create explicit validated metadata for every current/new test.
- [x] Implement shared plan/trigger selection, compatible commands and behavior tests for routing, completeness, mixed files, platform filtering and exit propagation.
- [x] Wire PR/native/full-main/release CI dependencies and validate event/result truth tables; preserve tag-only packaging and focused local release gates.
- [x] Update development guidance and inventory; produce old/new selection and timing evidence.
- [x] Verify contracts, affected integrations, six service E2Es, full JS source suite and applicable native checks using isolated data; run typecheck/lint and independent CR.
- [x] Reconcile acceptance evidence and record concrete verification limits; subsequent VR/DD follow the workflow. SS milestone commits include only this story.

## Validation

See `.docs/tests/test-impact-based-test-routing.md`. Coverage preservation is checked against original declaration bodies and registry unions; intentional heavy/provider flags remain available in full qualification. Performance comparisons separate selection-only estimates from observed wall time, keep dependency setup constant and exclude concurrent desktop inputs.

AR passed: no blocking architecture flaws. Independent reviewer `/root/routing_review`, round 1. Native checks require Node and JS dependencies; probe `bundle.resources: []`, excluding only the verified-bundle artifact test from source-only PR checks.


SS evidence so far: immutable baseline at `/tmp/shiqu-routing-baseline`; first fast probe 29.64s (739 pass, one skip), sequential matched baseline 23.19s plus 38.64s books. Native resource-free probe compiled without preparation and passed 24 tests, with one verified-bundle probe filtered. Guard/split run: 140 pass; routing/runner/release guards: 21 pass before review additions. Typecheck/lint passed. Full source qualification is running against a frozen candidate without desktop inputs.

CR round 1 requested broader generation-helper consumers, isolated lifecycle/release browser evidence and complete source fingerprints. Fixes add production/discovery/preparation ownership, `release-C001` evidence and shared identity over non-ignored working-tree source inputs. The large consolidation integration file is explicitly affected-only; HTTP/local-provider security boundaries remain in the code-PR safety set and are labeled integration rather than contract. Native source checks use the existing release Rust pin 1.93.0.

Local agent workflow uses `pnpm test:changed`, preview and explicit task path overrides in shared checkouts; AGENTS.md documents when full/native/static checks remain required. This is the same planner, not a second selection policy.


Clean-source native probe addendum: a fresh snapshot without desktop/dist exposed a compile-time frontendDist dependency masked by local artifacts. Resource-free native source tests will set `build.frontendDist` to the checked-in `../desktop/index.html` file list as compile-time context, alongside `bundle.resources: []`; no Vite preparation, packaging or production/native source changes. The bounded clean-snapshot probe passed 24 tests with one artifact-only probe filtered. Return this addendum for AR before editing the CI configuration.

Full JS run completed 1,419/1,422 passing in 287.13s; three existing lifecycle browser scenarios failed. C004 overrides returned incomplete acceptance receipts, reaching invalid-output failure rather than the intended blocked audit. C006 asserted a link disappearance immediately after backend failure without awaiting UI refresh. Reproduce baseline, repair only controlled test receipts/UI synchronization while retaining assertions, then rerun the complete affected browser files and new runner against final source. No client/desktop production fix is in scope.

AR addendum passed (round 2, reused independent reviewer): checked-in frontend context and test-only receipt/synchronization fixes are feasible; release configuration and production desktop code remain untouched.

Cost audit: real Git tag-push tests in release-pre-push are tooling integration, not unconditional cheap contracts. Their file now follows the tooling trigger; focused release gate still owns it and full qualification retains it. This removes repeated disposable Git/pnpm hook work from unrelated code PRs.

SS milestone: `0295103` (explicit registry, splits, shared planner/runners, CI and agent rules); verification at commit was focused CR/guards plus pending full qualification. Final native context and browser fixture corrections are a separate milestone. CR round 3 passed with no major findings.


Final ownership audit / AR addendum: primary domains alone miss direct cross-domain consumers (for example book-reading-plans imports discovery modules; queue/review/storage integrations share repositories and image helpers). Add explicit `covers` source paths to each registry entry, initially enumerated from actual top-level production imports; native configuration modules also declare cross-language settings inputs. Known source changes union rule responsibilities with all declaring consumers, including native consumers. Unknown paths retain full fallback. Execution does not inspect tests. A maintainer regression test parses top-level test imports with the existing TypeScript dependency and rejects missing direct-source ownership. Existing responsibility rules retain indirect workflow consumers. No automatic runtime dependency graph or new dependencies. Re-review AR before source edits; then validate every direct import is selected for a change to its source and update final selection counts/timing.

AR ownership addendum passed, round 3/reused independent reviewer. Explicit covered-source paths validated for duplicates/traversal; direct consumers must be selected with full flags; native consumers request native checks.

CR round 4 passed: explicit covered-source ownership, static/literal dynamic-import guards and native consumers have no major findings. All 24 focused guards and final lint pass. Provider file/mode selection remains unchanged at 82 files after adding ownership validation.

Late fixture isolation finding: unchanged-baseline development-access also failed when Vite port:0 resolved to5173 and reached another existing local app. The fixture now obtains an explicit free ephemeral port and asserts Vite uses it, preserving API/security assertions without touching any other app or production code.


Final verification: source projection matched all story execution inputs in the frozen candidate. Full 1,422-case run passed 1,419; three baseline lifecycle fixture/race failures were fixed, then complete affected browser files passed 11/11. Added ownership/runner guards passed 24/24, final fast suite 627/627, isolated development proxy 2/2, final provider impact plan exit0, typecheck/lint pass, clean native source 24 pass/one verified-bundle probe filtered. Unchanged passing full-run cases were reused after affected-only fixture corrections. Six extended services were included in the full run. No production, client, desktop, Rust or lockfile diffs versus story base. Windows/hosted execution remains an explicitly reported environment limit, not claimed local evidence.

Final timing: old fast22.50s plus books36.97s; new fast15.71s; new provider PR26.09s (82 files, same final selection/modes). Registry: 172 JS, 4 native modules; 1,128 JS declarations, 26 native functions; 76 fast/70 integration/10 book regressions. `.docs/testing-trigger-measurements.json` and `.docs/testing-triggers.md` retain measured/estimated distinctions and raw evidence references. CR rounds1–5 resolved all material findings; last verdict CR passed: no major findings.

SS follow-up milestone: `f1c6860` (covered-source consumers, native clean-checkout context, preserved lifecycle receipts/UI synchronization, isolated proxy test and measured inventory). VR passed: all acceptance criteria complete (independent round1/reused reviewer); hosted timing and Windows execution remain disclosed limits.
