# Impact-based test routing

PR checks currently use source-text heuristics: a production fixture call moves the entire file out of fast PR checks. Adapter contracts are hidden inside flow files; expensive CLI/network integration still runs on unrelated UI changes. The user wants explicit metadata, responsibility-based triggers, preserved coverage and an honest old/new timing comparison.

- [x] Split mixed adapter request/configuration contracts from actual production flows without deleting assertions.
- [x] Explicit metadata covers every executable JS test and native test module; missing/invalid metadata fails validation. Record domain, level, cost, platform and aggregate gate ownership.
- [x] Every PR runs integrity smoke. Code PRs run cheap contracts, typecheck/lint and the union of affected integrations/E2E. Mixed files remain conservative; local-server stays in the fast safety base.
- [x] Shared model/schema, dependencies, Node and unknown impact select full source regression. Git detection failure and renames cannot silently skip affected coverage. Test/fixture changes select their owners/consumers.
- [x] Core generation/discovery/review/reference changes select all six extended service E2Es. Desktop/native/shared-settings triggers select applicable JS, browser and native checks; packaging remains tag/manual only.
- [x] Main runs full JS regression. Release needs same-commit full source qualification plus current release/native/artifact checks. Required status remains Shared checks and reflects native failures.
- [x] Keep existing explicit test commands and focused release/npm gates. Each planned file executes once per PR with appropriate fast/full flags and supported-platform filtering.
- [x] Compare current and proposed PR file selections for representative changes. Measure matched local baseline/new selections; label hosted estimates and unavailable measurements explicitly.
- [x] Concurrent desktop work, real user libraries and production behavior are untouched.

No dependency updates, live inference, publication or desktop packaging are authorized by this test-routing task.
