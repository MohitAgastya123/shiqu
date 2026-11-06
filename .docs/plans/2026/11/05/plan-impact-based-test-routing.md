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
- [ ] Update development guidance and inventory; produce old/new selection and timing evidence.
- [ ] Verify contracts, affected integrations, six service E2Es, full JS source suite and applicable native checks using isolated data; run typecheck/lint and independent CR.
- [ ] Reconcile acceptance evidence and write completion record. Stop before final delivery commit unless separately requested; SS milestone commits include only this story.

## Validation

See `.docs/tests/test-impact-based-test-routing.md`. Coverage preservation is checked against original declaration bodies and registry unions; intentional heavy/provider flags remain available in full qualification. Performance comparisons separate selection-only estimates from observed wall time, keep dependency setup constant and exclude concurrent desktop inputs.

AR passed: no blocking architecture flaws. Independent reviewer `/root/routing_review`, round 1. Native checks require Node and JS dependencies; probe `bundle.resources: []`, excluding only the verified-bundle artifact test from source-only PR checks.


SS evidence so far: immutable baseline at `/tmp/shiqu-routing-baseline`; first fast probe 29.64s (739 pass, one skip), sequential matched baseline 23.19s plus 38.64s books. Native resource-free probe compiled without preparation and passed 24 tests, with one verified-bundle probe filtered. Guard/split run: 140 pass; routing/runner/release guards: 21 pass before review additions. Typecheck/lint passed. Full source qualification is running against a frozen candidate without desktop inputs.

CR round 1 requested broader generation-helper consumers, isolated lifecycle/release browser evidence and complete source fingerprints. Fixes add production/discovery/preparation ownership, `release-C001` evidence and shared identity over non-ignored working-tree source inputs. The large consolidation integration file is explicitly affected-only; HTTP/local-provider security boundaries remain in the code-PR safety set and are labeled integration rather than contract. Native source checks use the existing release Rust pin 1.93.0.

Local agent workflow uses `pnpm test:changed`, preview and explicit task path overrides in shared checkouts; AGENTS.md documents when full/native/static checks remain required. This is the same planner, not a second selection policy.
