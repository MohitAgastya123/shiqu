# Test triggers and cost

The registry is `tests/manifest.json`; `scripts/test-plan.mjs` owns responsibility matching and unions. PR CI and local agents use the same planner. This policy changes coverage as well as speed: affected production/browser flows now block relevant PRs rather than waiting for main.

## Commands for agents

```bash
pnpm test:changed --plan
pnpm test:changed
pnpm typecheck
pnpm lint
```

`test:changed` includes staged, unstaged and untracked paths relative to HEAD. It tests the current working tree. For a shared checkout, inspect the preview and pass every path belonging to the task with `pnpm test:pr --files <paths...>`; concurrent desktop changes remain outside that task. A clean/failed comparison conservatively selects full coverage. `pnpm test:pr` without explicit paths reads CI scope or a `BASE...HEAD` diff; it does not assume an arbitrary default branch.

Plan output lists files, execution levels, `fast`/`full` modes and unsupported-platform exclusions. Actual runs retain source identity, batch duration, selected files and exits under `.data/test-plans/`. `native: true` means native source checks are also required; the JS runner does not execute Cargo. `AGENTS.md` documents these rules.

## Trigger table

Every PR runs the small integrity smoke. Every code PR also runs fast contracts and the local-server/queue/state safety set. The following additions run with full provider/heavy flags. Changed tests select their declared domains. Multiple domains form a union, and each selected file runs once.

| Change responsibility | Additional coverage | Native source checks |
| --- | --- | --- |
| Documentation outside runtime/data/test directories | Integrity smoke only | No |
| Client/public assets and reader helpers | Reader contracts and affected reader browser journeys | No |
| Desktop UI and remote/network runtime | Desktop integration and console browser journey | Rust changes separately |
| CLI startup and invocation | Startup/CLI integration; production entry points also select production/tooling | Shared configuration: yes |
| Saved/shared provider settings and configuration | Startup/provider/desktop integration and browser settings | macOS + Windows |
| Provider adapter or wire schema/reasoning | Provider contracts and controlled provider production flows | No |
| Bundled books, local source readers/parsers and reading inputs | Full ten-file book suite plus discovery consumers | No |
| Discovery/cache/theme matching | Discovery integration and browser journeys; all six extended service E2Es | No |
| Preparation, storyboard review, frame count, queue, generation or book references | Affected responsibility groups; all six extended service E2Es | Storage upgrade boundaries separately |
| Images, publication and export | Media integration and reference consumers | No |
| Library backup/recovery/maintenance/upgrade | Storage/startup integration and consolidation browser coverage | macOS + Windows |
| Rust source/configuration and desktop resource/runtime scripts | Native module consumers plus applicable desktop/storage JS | macOS + Windows |
| Shared models/API schemas/prompts, DB schema/migrations, dependencies/Node, test/build/CI infrastructure, unknown paths or failed/empty comparison | All 172 JS files, full flags | macOS + Windows |

Known component path patterns are listed in `scripts/test-plan.mjs`. New unclassified runtime files, deleted/unregistered tests and shared fixtures broaden to full coverage. Rename detection uses both old and new paths. Documentation inside `data/`, `tests/`, `skills/` and runtime directories is not automatically exempt.

A code PR does not necessarily get faster. Core changes gain service/browser coverage; schema/dependency changes deliberately run full qualification. Optimizing these back to the old PR time would remove the coverage this policy adds.

## Existing versus new PR selection

Counts are files, not runtime test instances. Old counts refer to commit `75a1331d3594edb140b13125d3fd278c12a164a5`; new counts use the explicit metadata. Static checks remain on code PRs.

| Example | Existing PR | New PR JS files | Added behavior |
| --- | --- | ---: | --- |
| README | 1 smoke | 1 | Same smoke policy |
| Client CSS | 86 fast | 83 | Reader browser journeys; skips unrelated process/startup suites |
| `server/claude-runner.ts` | 86 fast + 10 books | 83 | Provider contracts and flows; no full-book scan |
| `server/local-story-discovery.ts` | 86 fast + 10 books | 96 | Discovery consumers and all six extended E2Es |
| `src-tauri/src/runtime.rs` | 86 fast | 83 | Native source tests on macOS/Windows; relevant console journey |
| `lib/system-settings.ts` | 86 fast + 10 books | 93 | Configuration consumers plus macOS/Windows native checks |
| `lib/reader-model.ts` / lockfile / unknown path | 86 fast + 10 books | 172 | Full source qualification and native checks |

Five adapter contract files were separated from their queued flows. The startup file keeps its pure provider/library precedence matrices; twelve real CLI launch rows now live in `startup-cli-flow.test.mjs`. Original top-level test/matrix statements were compared against the immutable baseline and preserved structurally, with assertions unchanged; a moved comment was translated to Chinese.

## Timing evidence

Local comparisons use disposable snapshots, Node 24.22.1, the same installed dependencies and sequential execution. No desktop preparation, packaging, live models or user libraries are involved. Snapshot source excludes concurrent desktop work. Dependency installation and hosted scheduling are not included. Final observed timings are recorded after the sequential comparison completes.

The reported hosted baseline is 7s scope + 12s setup + 18s install + 15s typecheck + 6s lint + 120s fast tests, about **178s before any separately selected book suite**. This implementation does not claim to reduce the first 58s. Local elapsed times cannot be substituted directly into hosted estimates; compare test-phase ratios only as a provisional estimate, then verify a hosted run.

## CI qualification

`Shared checks` aggregates JavaScript and selected native jobs. Missing scope defaults to full JS and native checks. Main, version tags and manual runs qualify the exact current commit with all JS tests. The native PR matrix installs pinned Node/JS dependencies and Rust 1.93.0, disables bundle resources, and excludes only `runtime::tests::desktop_uses_verified_bundle_and_ignores_saved_system_path`. Prepared-artifact builds retain complete Cargo testing and artifact smoke. Packaging remains tag/manual only and waits for successful source qualification. Local release/npm smoke gates retain their focused eight/seven files.

Pnpm store caching is retained. Selected browser jobs cache Chromium; native jobs cache Cargo registry/git/build outputs with OS, architecture, Rust version, lockfiles and Node in the key. These caches do not contain user libraries or credentials. Windows behavior and GitHub scheduling require hosted validation; local macOS evidence does not claim otherwise.
