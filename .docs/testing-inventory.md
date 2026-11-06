# Test scenario inventory and run-policy map

Inventory date: 2026-11-05. Source baseline: `0455be4fc71f4cba98d8b9883f08dddb0c1ec086` plus the working-tree book-tier and extended-runner changes. This is a derived source inventory, not a new test run or a release decision. It does not replace `.tests/TESTING.md`, suite cases, or immutable run ledgers. In-progress desktop specifications outside this test change are excluded.

## Scope and counting

- **165 JavaScript test files**: 149 regression files and 16 `.e2e.mjs` files. Six E2E files drive a real browser; the other ten exercise service/process/engine boundaries.
- **1,118 JavaScript scenario declarations/templates**; 120 are parameterized or registered inside loops. These are source declarations, not expanded runtime instances or individual assertions.
- **26 Rust test functions** across configuration, runtime, desktop commands and library access.
- **7 managed lifecycle cases** and **76 legacy acceptance-spec documents**. These overlap automated scenarios and are listed separately, not added to the executable-test count.
- Source was parsed as JavaScript AST so strings containing fake tests are excluded. Matrix titles, option expressions and source lines are retained; no tests, packaging or live inference were executed for this inventory.

## Decisions exposed by the inventory

1. **The current tiers describe runners, not coherent risk domains.** The `unit` tier contains real CLI, SQLite, HTTP, subprocess and SSR/client contracts. The proposed domain groups below are a review model, not a claim that all path-based policies are already implemented.
2. **The six previously unselected E2E files now have an explicit runner.** `pnpm test:e2e:extended` runs exactly those six service/engine files. `pnpm test:full` includes them once; default user flows and release/npm smoke retain their existing scope. A regression guard requires every E2E file to have an aggregate runner.
3. **`test:full` omits the release browser smoke wrapper.** That wrapper is selected by release/npm gates and reuses the lifecycle creation fixture. The six extended E2E files are included in full selection.
4. **Some adapter and maintenance contracts currently sit inside `flows`.** Examples: `claude-provider`, `deepseek-provider`, `separate-providers`, `task-reasoning`, `library-maintenance` and `library-recovery`. They do not run in the default fast PR command. The suggested trigger is affected-core PR plus main, not an assumption that they already run on PRs.
5. **Mixed files remain visible.** `local-server.test.mjs` is storage/HTTP/locking coverage. Its book fixture does not make the whole file a book-content suite. The three real-book cases formerly mixed with discovery-cache tests now live in `book-reading-plans.test.mjs`.
6. **Recorded QA results are historical.** The managed lifecycle ledger contains earlier results; this inventory does not renew them against the current working tree. Some acceptance documents mention retired Docker/Lite/studio flows and require applicability review.

## Recommended domain groups

The triggers in this table are recommendations. Only the book-vs-fast conditional policy is implemented in the current working tree; the other domains retain the current selections shown below. Shared schemas, dependencies, Node/toolchain or unknown-impact changes should broaden the affected selection.

| Group | JS files | Scenario declarations | Purpose | Recommended run trigger |
| --- | ---: | ---: | --- | --- |
| Safety smoke and CI selection | 3 | 8 | Small production-loader integrity guard; change-scope fallback and regression selection. | Smoke on every PR, including docs; selection contracts on every code PR. |
| Bundled books, originals and source integrity | 10 | 51 | Pinned bytes/editions, parser identity, glyphs, corruption/path checks, citation qualification, book-sized reading and migration. | Relevant book/core PRs; main; release tags. |
| Discovery, chapter choice and matching | 21 | 173 | Explicit extraction, chapter scope, incremental catalogues, cache reuse, model matching, overlap, unknown judgments and discovery metrics. | Changed discovery/source/matching code; main regression. Keep small cache/selection contracts on every code PR. |
| Story preparation and editorial choices | 10 | 63 | Intake, summaries, title edits, requirements, art recommendations, reflection candidates and editorial constraints. | Changed intake/editorial/schema/prompt code; main regression; critical preparation browser smoke before release. |
| Storyboard, frame count and audit/repair | 16 | 87 | Outline/batches, count gate/replay, full source review, structural edits, character continuity, audit history and bounded repairs. | Changed planning/count/review/repair code or prompts; main regression. |
| Production queue, lifecycle and recovery | 23 | 244 | Durable scheduling, pause/drain/resume, explicit retry, version isolation, job membership, image recovery and state-machine command races. | Changed queue/engine/state/revision code; main regression. Keep a short no-duplicate-work lifecycle guard on every code PR; release protocol smoke. |
| Reader, shelf and client UI contracts | 26 | 178 | Navigation, cached startup, saved/trash/favorites, requirements controls, timeline/error presentation and reader request construction. Most .test.mjs checks are SSR/VM/component contracts. | Changed client UI or its API contracts; a small browser path for affected journeys; release creation-to-reading smoke. |
| Library storage, migrations and server boundaries | 7 | 43 | Whole-library backup/recovery/import, schema consolidation, ownership, persistence, HTTP origin/static/media isolation. | Changed database/migration/library/server boundaries; before release. Keep small version-refusal and data-isolation guards on every code PR. |
| CLI startup, settings and configuration | 9 | 67 | First-run/provider/library precedence, saved credentials, concurrent settings, rollback, noninteractive/PTY setup and headless commands. | Changed CLI/settings/config/server-startup code or Node; release/npm smoke. Full PTY on supported Unix environments when changed. |
| Provider adapters, schemas and reasoning | 16 | 76 | Codex/Gemini/OpenAI/Claude/DeepSeek adapters; response errors, token/time budgets, prompt contracts, effort and separate image service. | Fast adapter contracts on every code PR; affected provider matrix when adapters/prompts/shared schemas change; full matrix before release. |
| Images, references, publication and export | 10 | 64 | Image dimensions/versions/references, PNG/ZIP/WebP metadata, saved originals, publication approval and public archive conversion. | Changed image/media/export/publication/reference code; release/npm archive smoke. |
| Desktop console, native runtime and networking | 7 | 36 | Lifecycle IPC, trusted browser opening, Node bundle/runtime, local/LAN/tunnel access, setup authorization and desktop Vite. | Changed desktop/native/runtime/network code or shared settings; Rust checks on relevant PRs; packaging/smoke only on explicit package/release runs. |
| Development, skills and distribution tooling | 7 | 28 | Development data/cache/network isolation, skill install/update safety, npm publish ordering and release push guards. | Changed development/skill/distribution/build/CI/toolchain code; release/npm gates where selected. |

## Current command and CI selection

Working-tree behavior, including the new conditional book routing:

| Entry point | Actual selection | When selected today |
| --- | --- | --- |
| `pnpm test` | 86 regression files; 578 scenario declarations before matrix expansion | Code PRs and manual CI. Includes the small book smoke. |
| Documentation-only PR | `book-integrity-smoke.test.mjs` | Every documentation-only PR still installs dependencies and runs the smoke. |
| `pnpm test:books` | 10 files; 51 scenario declarations, all content flags enabled | Relevant PR changes; main; release tags; manual CI. Known UI/desktop/native/public/docs-only changes skip it on PRs. Shared/core/test/config/unknown changes trigger it. |
| `pnpm test:flows` | 53 regression files; 421 scenario declarations, reduced provider matrix/heavy skips | Every main push. Not ordinary PR CI. |
| `pnpm test:providers` | All 149 regression files with full provider/heavy/book flags | Explicit command. Does not discover `.e2e.mjs` files. |
| `pnpm test:e2e` | 18 explicit files: nine `.e2e.mjs` and nine regression files | Explicit command with full flags; controlled production adapters. |
| `pnpm test:e2e:extended` | Six service/engine E2E files; 44 scenario declarations before matrix expansion | Explicit command with full flags and controlled providers; no browser. |
| `pnpm test:full` | 164 files: all 149 regressions plus fifteen selected `.e2e.mjs` | Explicit command. Only the release-specific creation-smoke wrapper is outside this selection; it reuses the lifecycle creation fixture. |
| Release gate | Eight explicit files | `pnpm release:check` via version-tag pre-push and explicit use. Includes creation browser smoke, protocol recovery, headless CLI, startup/settings and publish guards. |
| npm gate | Seven explicit files | `pnpm npm:check`; same smoke selection without the release-push test. |
| `pnpm test:startup` | npm-cli, cli-library, system-settings, startup-matrix, settings-faults | Explicit focused startup command. |
| `pnpm test:pty` | startup-pty with full flags | Explicit supported-platform terminal onboarding check. |
| `pnpm desktop:test` | Native Rust functions | Tag/manual CI on shipped macOS and Windows runners. Proposed: also affected native/shared-settings PRs. |
| Artifact smoke | Real npm install or prepared desktop runtime | Explicit artifact/package/release workflows; separate from source regression. |

Selector sources: [scripts/test-tiers.mjs](../scripts/test-tiers.mjs), [scripts/test-story-e2e.mjs](../scripts/test-story-e2e.mjs), [scripts/test-providers.mjs](../scripts/test-providers.mjs), [scripts/ci-scope.mjs](../scripts/ci-scope.mjs), [.github/workflows/desktop-macos.yml](../.github/workflows/desktop-macos.yml).

## Explicit extended service/engine E2E selection

These six files run through `pnpm test:e2e:extended` and are included once in `pnpm test:full`. The shared runner records gate, selected files, logs and a failing exit status; controlled providers use disposable data.

| File | Scenario declarations | Suggested domain trigger |
| --- | ---: | --- |
| [tests/adaptive-storyboard-review.e2e.mjs](../tests/adaptive-storyboard-review.e2e.mjs) | 8 | Storyboard, frame count and audit/repair |
| [tests/book-reference-star.e2e.mjs](../tests/book-reference-star.e2e.mjs) | 6 | Images, references, publication and export |
| [tests/character-continuity-edits.e2e.mjs](../tests/character-continuity-edits.e2e.mjs) | 4 | Storyboard, frame count and audit/repair |
| [tests/frame-count-gate.e2e.mjs](../tests/frame-count-gate.e2e.mjs) | 4 | Storyboard, frame count and audit/repair |
| [tests/incremental-story-library.e2e.mjs](../tests/incremental-story-library.e2e.mjs) | 16 | Discovery, chapter choice and matching |
| [tests/story-discovery-speed-accuracy.e2e.mjs](../tests/story-discovery-speed-accuracy.e2e.mjs) | 6 | Discovery, chapter choice and matching |

Command: `pnpm test:e2e:extended` (equivalent to `pnpm test:e2e --gate=extended`). Provider/heavy options in each file remain authoritative.

## Complete JavaScript scenario catalogue

Each row is one source declaration. “Matrix” means its variants are generated at runtime; source expressions are retained rather than inventing an expanded count. File-level group names are primary domains, not a reason to skip unrelated scenarios in a mixed file.

## Safety smoke and CI selection

Recommended trigger: Smoke on every PR, including docs; selection contracts on every code PR.

Change surface: Any PR for integrity smoke; CI/test-harness changes require scope/selector contracts.

### tests/book-integrity-smoke.test.mjs

[tests/book-integrity-smoke.test.mjs](../tests/book-integrity-smoke.test.mjs) — 4 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L20](../tests/book-integrity-smoke.test.mjs#L20) | integrity smoke: production loader preserves bytes and resolves a valid source | Standard |
| [L25](../tests/book-integrity-smoke.test.mjs#L25) | integrity smoke: changed bytes and missing originals fail closed | Standard |
| [L30](../tests/book-integrity-smoke.test.mjs#L30) | integrity smoke: an original outside the library is rejected even with the correct hash | Standard |
| [L34](../tests/book-integrity-smoke.test.mjs#L34) | integrity smoke: stale, missing, reversed and unreadable citations are rejected | Standard |

### tests/ci-scope.test.mjs

[tests/ci-scope.test.mjs](../tests/ci-scope.test.mjs) — 2 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L11](../tests/ci-scope.test.mjs#L11) | book scope skips only known unrelated UI, desktop, native, public and documentation paths | Standard |
| [L23](../tests/ci-scope.test.mjs#L23) | real merge-base diffs preserve book relevance across renames and fail closed for invalid refs | Standard |

### tests/test-tiers.test.mjs

[tests/test-tiers.test.mjs](../tests/test-tiers.test.mjs) — 2 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L9](../tests/test-tiers.test.mjs#L9) | unit, flow and book selections partition all regression files and preserve mixed server checks | Standard |
| [L18](../tests/test-tiers.test.mjs#L18) | book markers select the whole file, including a file that also drives production flows | Standard |

## Bundled books, originals and source integrity

Recommended trigger: Relevant book/core PRs; main; release tags.

Change surface: data/library; local-book/source/reading code; shared schemas, prompts, dependencies and Node.

### tests/book-reading-plans.test.mjs

[tests/book-reading-plans.test.mjs](../tests/book-reading-plans.test.mjs) — 3 scenario declarations.

**Current selection:** Book tier: `pnpm test:books` (relevant PR/main/tag/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L16](../tests/book-reading-plans.test.mjs#L16) | fixed books retain exhaustive bounded blocks and meet provider-neutral size targets | Standard |
| [L23](../tests/book-reading-plans.test.mjs#L23) | all 1129 Shishuo units are covered in at most 60 calls; 1072 eligible stories saved once and 57 rejects accounted | books |
| [L31](../tests/book-reading-plans.test.mjs#L31) | v3 migration maps the proven frontier, rereads only its containing new block, and preserves old bytes | Standard |

### tests/clean-three-originals.test.mjs

[tests/clean-three-originals.test.mjs](../tests/clean-three-originals.test.mjs) — 7 scenario declarations.

**Current selection:** Book tier: `pnpm test:books` (relevant PR/main/tag/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L12](../tests/clean-three-originals.test.mjs#L12) | three collections pin every original byte and cover all sections with declared anomaly handling | books |
| [L25](../tests/clean-three-originals.test.mjs#L25) | all Wiki reading glyphs and small annotations survive packaging in source order | books |
| [L42](../tests/clean-three-originals.test.mjs#L42) | Youyang replacement contains main20 and continuation10 with independent immutable Wiki citations | books |
| [L49](../tests/clean-three-originals.test.mjs#L49) | Shiji ten tables retain every empty cell and its source text, all row/column anchors and span relationships | books |
| [L75](../tests/clean-three-originals.test.mjs#L75) | table layout labels and empty rows cannot independently authorize a storyboard | Standard |
| [L82](../tests/clean-three-originals.test.mjs#L82) | Wiki headings cannot independently authorize a narrative receipt | Standard |
| [L87](../tests/clean-three-originals.test.mjs#L87) | missing, swapped, tampered or escaped originals fail closed | Standard |

### tests/erke-unified.test.mjs

[tests/erke-unified.test.mjs](../tests/erke-unified.test.mjs) — 3 scenario declarations.

**Current selection:** Book tier: `pnpm test:books` (relevant PR/main/tag/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L16](../tests/erke-unified.test.mjs#L16) | forty Wiki volumes retain every parsed body glyph and the complete nine-act finale | books |
| [L31](../tests/erke-unified.test.mjs#L31) | final-play receipts resolve exact Wiki glyphs and reject old editions or invalid ranges | Standard |
| [L38](../tests/erke-unified.test.mjs#L38) | missing, damaged, reordered or escaped original collections fail closed | Standard |

### tests/licensed-books.test.mjs

[tests/licensed-books.test.mjs](../tests/licensed-books.test.mjs) — 5 scenario declarations.

**Current selection:** Book tier: `pnpm test:books` (relevant PR/main/tag/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L10](../tests/licensed-books.test.mjs#L10) | all17 uncertain editions are replaced and seven retained collections keep original bytes with explicit errata versions | books |
| [L25](../tests/licensed-books.test.mjs#L25) | Kanripo edition and chapter identities reject mismatches, and first/final chapters keep actual prose | Standard |
| [L40](../tests/licensed-books.test.mjs#L40) | same-source narrative appendices preserve coverage and numbered chapter identities | books |
| [L45](../tests/licensed-books.test.mjs#L45) | replacement collections reject changed identities, extra files and a truncated final play even with refreshed manifest hashes | Standard |
| [L56](../tests/licensed-books.test.mjs#L56) | the former demo source uses the selected library edition without a hardcoded fallback | Standard |

### tests/local-book-corrections.test.mjs

[tests/local-book-corrections.test.mjs](../tests/local-book-corrections.test.mjs) — 2 scenario declarations.

**Current selection:** Book tier: `pnpm test:books` (relevant PR/main/tag/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L12](../tests/local-book-corrections.test.mjs#L12) | only two missing characters change, with unit-level provenance and a stable derived edition | books |
| [L35](../tests/local-book-corrections.test.mjs#L35) | corrected and historical matching originals pass the production gate, mismatched ones fail | Standard |

### tests/local-books.test.mjs

[tests/local-books.test.mjs](../tests/local-books.test.mjs) — 13 scenario declarations.

**Current selection:** Book tier: `pnpm test:books` (relevant PR/main/tag/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L31](../tests/local-books.test.mjs#L31) | only original downloads are versioned, preserve their bytes and have matching receipts | Standard |
| [L43](../tests/local-books.test.mjs#L43) | the two whole-book inputs contain every parsed body unit, including the final passages | books |
| [L54](../tests/local-books.test.mjs#L54) | range verification rejects stale, cross-book, reversed, multi-anecdote and unreadable refs | Standard |
| [L63](../tests/local-books.test.mjs#L63) | direct whole-book choices preserve labels and reject duplicate and invalid receipts | Standard |
| [L73](../tests/local-books.test.mjs#L73) | both providers directly select from the full original and only verified passages reach planning | Standard |
| [L87](../tests/local-books.test.mjs#L87) | token-based chapter manifests cover all shipped units without splitting small chapters | books |
| [L94](../tests/local-books.test.mjs#L94) | cross-chapter references preserve both original ranges, reject tampering, and allow complete long stories | Standard |
| [L102](../tests/local-books.test.mjs#L102) | verified original reaches SQLite and media before a paid plan, and survives plan failure/retry | Standard |
| [L110](../tests/local-books.test.mjs#L110) | storage failures or missing local receipts cannot issue paid storyboard requests | Standard |
| [L118](../tests/local-books.test.mjs#L118) | storyboard directory and batch calls both verify local source receipts before inference | Standard |
| [L130](../tests/local-books.test.mjs#L130) | ending, review, structural and local repair require the same verified local original as planning | Standard |
| [L140](../tests/local-books.test.mjs#L140) | explicit legacy backfill uses a local chapter and does not plan, draw, or fetch a public source | Standard |
| [L147](../tests/local-books.test.mjs#L147) | local recommendation persists the exact original before inference and rejects tampered receipts or source anomalies | Standard |

### tests/local-library-all-books.test.mjs

[tests/local-library-all-books.test.mjs](../tests/local-library-all-books.test.mjs) — 4 scenario declarations.

**Current selection:** Book tier: `pnpm test:books` (relevant PR/main/tag/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L30](../tests/local-library-all-books.test.mjs#L30) | all 24 catalogs load verified originals with complete chapters and exhaustive bounded inputs | books |
| [L49](../tests/local-library-all-books.test.mjs#L49) | all catalogs use originals without cross-source supplements; Erke final play has a pinned Wiki source | books |
| [L55](../tests/local-library-all-books.test.mjs#L55) | original corruption and unreadable source ranges fail closed | Standard |
| [L60](../tests/local-library-all-books.test.mjs#L60) | all 24 books complete HTTP selection and persist original glyphs before storyboard generation | books |

### tests/local-source-quality.test.mjs

[tests/local-source-quality.test.mjs](../tests/local-source-quality.test.mjs) — 6 scenario declarations.

**Current selection:** Book tier: `pnpm test:books` (relevant PR/main/tag/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L9](../tests/local-source-quality.test.mjs#L9) | known unresolved source encodings and explicit omissions are rejected without normalizing text | Standard |
| [L15](../tests/local-source-quality.test.mjs#L15) | saved cross-chapter evidence applies reviewed exceptions to its own chapter and rejects tampered parts | Standard |
| [L27](../tests/local-source-quality.test.mjs#L27) | retained historical source leaks and current omissions fail closed | Standard |
| [L34](../tests/local-source-quality.test.mjs#L34) | every shipped book applies the same text and chapter-title rules, preserving rare real glyphs | books |
| [L44](../tests/local-source-quality.test.mjs#L44) | candidates, direct preparation and legacy backfill share qualification and never persist a rejected source | Standard |
| [L52](../tests/local-source-quality.test.mjs#L52) | damaged saved originals cannot call a new plan; readable historical receipts retry without reloading new editions | Standard |

### tests/priority-wiki-originals.test.mjs

[tests/priority-wiki-originals.test.mjs](../tests/priority-wiki-originals.test.mjs) — 5 scenario declarations.

**Current selection:** Book tier: `pnpm test:books` (relevant PR/main/tag/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L10](../tests/priority-wiki-originals.test.mjs#L10) | legacy numeric chapter labels still locate the pinned original, and every reading path carries the same exception policy | Standard |
| [L16](../tests/priority-wiki-originals.test.mjs#L16) | all 120/40 chapters preserve every reading glyph, source heading and final verse from pinned originals | books |
| [L30](../tests/priority-wiki-originals.test.mjs#L30) | only the two reviewed edition/chapter/context combinations authorize unchanged anomalous source text | Standard |
| [L41](../tests/priority-wiki-originals.test.mjs#L41) | page identities, chapter sequence, index order and pinned revision cannot drift | Standard |
| [L50](../tests/priority-wiki-originals.test.mjs#L50) | missing, altered, extra and escaped original members fail before a book is exposed | Standard |

### tests/taiping-wyg.test.mjs

[tests/taiping-wyg.test.mjs](../tests/taiping-wyg.test.mjs) — 3 scenario declarations.

**Current selection:** Book tier: `pnpm test:books` (relevant PR/main/tag/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L17](../tests/taiping-wyg.test.mjs#L17) | 500 original WYG volumes preserve all narrative lines, glyphs and final volume in bounded reading | books |
| [L37](../tests/taiping-wyg.test.mjs#L37) | unpunctuated originals resolve exactly; titles, stale editions and invalid ranges fail | Standard |
| [L46](../tests/taiping-wyg.test.mjs#L46) | missing, damaged, extra and escaped collection members cannot load | Standard |

## Discovery, chapter choice and matching

Recommended trigger: Changed discovery/source/matching code; main regression. Keep small cache/selection contracts on every code PR.

Change surface: server/local-story*; server/story-discovery*; server/story-theme*; reading plans; discovery UI and contracts.

### tests/chapter-main-stories.test.mjs

[tests/chapter-main-stories.test.mjs](../tests/chapter-main-stories.test.mjs) — 5 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L21](../tests/chapter-main-stories.test.mjs#L21) | `${name}: three selected Gaotaiwei chapters offer the whole campaign before individual defeats` | Matrix/template |
| [L52](../tests/chapter-main-stories.test.mjs#L52) | `${name}: chapter thirty offers Guandu before Xuyou and Wuchao, retaining both after restart` | Matrix/template |
| [L102](../tests/chapter-main-stories.test.mjs#L102) | nested complete events may share background while renamed exact ranges remain rejected | Standard |
| [L110](../tests/chapter-main-stories.test.mjs#L110) | a main event spanning reading blocks keeps its earlier original available for episodes | Standard |
| [L128](../tests/chapter-main-stories.test.mjs#L128) | chapter scopes do not reuse old flat or block-local main-story caches | Standard |

### tests/continuous-story-discovery.test.mjs

[tests/continuous-story-discovery.test.mjs](../tests/continuous-story-discovery.test.mjs) — 5 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L11](../tests/continuous-story-discovery.test.mjs#L11) | Codex, Gemini and OpenAI custom-book adapters receive a one-story request and bound the returned batch | Standard |
| [L33](../tests/continuous-story-discovery.test.mjs#L33) | each saved story appears before the next completes; choosing fences the late result and automatic restart | Standard |
| [L53](../tests/continuous-story-discovery.test.mjs#L53) | leaving stops continuation; reopening retains stories and finds the next one; empty results stop automatically | Standard |
| [L67](../tests/continuous-story-discovery.test.mjs#L67) | one viewer leaving preserves another; the last viewer and expired leases stop paid discovery | Standard |
| [L81](../tests/continuous-story-discovery.test.mjs#L81) | automatic more cannot race past a chosen story at the SQL write fence | Standard |

### tests/discovery-conditions.test.mjs

[tests/discovery-conditions.test.mjs](../tests/discovery-conditions.test.mjs) — 5 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L17](../tests/discovery-conditions.test.mjs#L17) | discovery edits keep the task identity, shelf count and settings while validating source receipts | Standard |
| [L29](../tests/discovery-conditions.test.mjs#L29) | discovery edits reject forged source receipts without altering the saved task | Standard |
| [L35](../tests/discovery-conditions.test.mjs#L35) | discovery edit replay and competing updates cannot create duplicates or overwrite a newer edit | Standard |
| [L45](../tests/discovery-conditions.test.mjs#L45) | late extraction results and stale candidate choices cannot reappear after discovery conditions change | Standard |
| [L55](../tests/discovery-conditions.test.mjs#L55) | conditions cannot replace a story that has already been selected | Standard |

### tests/editable-extraction-title.test.mjs

[tests/editable-extraction-title.test.mjs](../tests/editable-extraction-title.test.mjs) — 5 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L8](../tests/editable-extraction-title.test.mjs#L8) | changing the extraction title fences a late old result and persists the new query exactly once | Standard |
| [L35](../tests/editable-extraction-title.test.mjs#L35) | query changes preserve canonical source scope, theme and paused control without buying work | Standard |
| [L49](../tests/editable-extraction-title.test.mjs#L49) | selected, preparing and confirmed stories reject a direct title reset | Standard |
| [L63](../tests/editable-extraction-title.test.mjs#L63) | reselection drafts share title search and cancellation leaves the original version unchanged | Standard |
| [L76](../tests/editable-extraction-title.test.mjs#L76) | title search rejects malformed titles and unsupported source books without mutating the query | Standard |

### tests/fast-first-story.test.mjs

[tests/fast-first-story.test.mjs](../tests/fast-first-story.test.mjs) — 8 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L29](../tests/fast-first-story.test.mjs#L29) | small reading plans cap chapters and preserve every unit, even when a whole book fits the old budget | Standard |
| [L42](../tests/fast-first-story.test.mjs#L42) | theme-filtered legacy coverage never skips uncatalogued original, and old files remain intact | Standard |
| [L60](../tests/fast-first-story.test.mjs#L60) | a legacy cache without manifest cannot supply the neutral catalog cursor or records | Standard |
| [L70](../tests/fast-first-story.test.mjs#L70) | a delayed library cache miss cannot overwrite newly catalogued stories or progress | Standard |
| [L86](../tests/fast-first-story.test.mjs#L86) | active chapters and checking stages validate without pretending an unfinished block is complete | Standard |
| [L94](../tests/fast-first-story.test.mjs#L94) | selected-source recommendations validate before inference and share durable results independently of manual style | Standard |
| [L108](../tests/fast-first-story.test.mjs#L108) | both providers recommend from the selected verified excerpt with no discovery or image call | Standard |
| [L120](../tests/fast-first-story.test.mjs#L120) | art endpoint validates selection/origin, rejects stale receipts and safely isolates recommendation failure | Standard |

### tests/incremental-story-library.e2e.mjs

[tests/incremental-story-library.e2e.mjs](../tests/incremental-story-library.e2e.mjs) — 16 scenario declarations.

**Current selection:** `pnpm test:e2e:extended`; `pnpm test:full`.

**Execution surface:** Service/process/engine E2E; filename does not imply visible UI.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L29](../tests/incremental-story-library.e2e.mjs#L29) | cold theme discovery retains rejected stories; restart and new themes reuse them; production receives originals | Standard |
| [L50](../tests/incremental-story-library.e2e.mjs#L50) | REST preserves obsolete review as unknown and retries after exhaustive discovery without rescanning | Standard |
| [L58](../tests/incremental-story-library.e2e.mjs#L58) | two streaming theme requests share extraction; one reader can leave while another receives its story | Standard |
| [L69](../tests/incremental-story-library.e2e.mjs#L69) | `${theme}: synopsis is created only after selection and an unsupported reason is corrected before ${length}-frame production and survive restart` | Matrix/template |
| [L90](../tests/incremental-story-library.e2e.mjs#L90) | `missing ${omitted} fails preparation, blocks confirmation, and retries with the same original` | Matrix/template |
| [L105](../tests/incremental-story-library.e2e.mjs#L105) | reselection binds a new synopsis to its new original, and clients cannot inject a replacement brief | Standard |
| [L116](../tests/incremental-story-library.e2e.mjs#L116) | direct original selection skips matching but still prepares a complete source-mode synopsis | Standard |
| [L131](../tests/incremental-story-library.e2e.mjs#L131) | historical direct selections without a synopsis prepare one before any new storyboard | Standard |
| [L140](../tests/incremental-story-library.e2e.mjs#L140) | `missing synopsis is saved before a ${length}-frame plan and a planning retry does not regenerate it` | Matrix/template |
| [L158](../tests/incremental-story-library.e2e.mjs#L158) | invalid missing-summary preparation blocks planning and retries with the saved original | Standard |
| [L168](../tests/incremental-story-library.e2e.mjs#L168) | a confirmed legacy intake stays confirmed and keeps its selected frame count while a missing synopsis is prepared | Standard |
| [L176](../tests/incremental-story-library.e2e.mjs#L176) | `saved outline batches resume after synopsis preparation without repeating the outline (${unverified?'unverified brief':'missing summary'})` | Matrix/template |
| [L189](../tests/incremental-story-library.e2e.mjs#L189) | REST resumes an old summary catalog from real media without rescanning and persists new binary receipts across restart | Standard |
| [L200](../tests/incremental-story-library.e2e.mjs#L200) | REST accepts a captured pending completion with shared old evidence and preserves it across restart | Standard |
| [L216](../tests/incremental-story-library.e2e.mjs#L216) | one-card intake fills four after a cold miss and shows the remaining batch without extraction | Standard |
| [L225](../tests/incremental-story-library.e2e.mjs#L225) | REST reports a source-specific extraction failure and clears its private diagnostic after retry | Standard |

### tests/incremental-story-library.test.mjs

[tests/incremental-story-library.test.mjs](../tests/incremental-story-library.test.mjs) — 24 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L18](../tests/incremental-story-library.test.mjs#L18) | an irrelevant story is retained and another theme reuses it without extracting the original again | Standard |
| [L28](../tests/incremental-story-library.test.mjs#L28) | new cache/provider wrappers reuse both neutral records and positive/negative theme decisions | Standard |
| [L34](../tests/incremental-story-library.test.mjs#L34) | newly extracted stories receive incremental verdicts without judging old negatives again | Standard |
| [L40](../tests/incremental-story-library.test.mjs#L40) | every matching request reads the exact original on its first and only pass | Standard |
| [L46](../tests/incremental-story-library.test.mjs#L46) | obsolete review remains unknown, permits later originals, and can be retried manually after exhaustion | Standard |
| [L54](../tests/incremental-story-library.test.mjs#L54) | a later provider failure preserves completed positive and negative receipts | Standard |
| [L62](../tests/incremental-story-library.test.mjs#L62) | `invalid ${kind} matching IDs preserve legal decisions and the catalog` | Matrix/template |
| [L69](../tests/incremental-story-library.test.mjs#L69) | catalog and candidates contain no synopsis or production brief | Standard |
| [L74](../tests/incremental-story-library.test.mjs#L74) | different themes share extraction and persist separate matching results | Standard |
| [L82](../tests/incremental-story-library.test.mjs#L82) | joining a matching flight for other IDs rechecks its own missing stories without dropping them | Standard |
| [L91](../tests/incremental-story-library.test.mjs#L91) | a completed binary receipt survives cancellation and no next batch is dispatched | Standard |
| [L99](../tests/incremental-story-library.test.mjs#L99) | one departing matching reader leaves another active and neither repeats the paid judgment | Standard |
| [L106](../tests/incremental-story-library.test.mjs#L106) | matching budget rejects paid work before dispatch and leaves already catalogued stories intact | Standard |
| [L112](../tests/incremental-story-library.test.mjs#L112) | a single oversized original fails before inference and never truncates or writes no | Standard |
| [L117](../tests/incremental-story-library.test.mjs#L117) | input budget shrinks a batch while preserving every full original | Standard |
| [L126](../tests/incremental-story-library.test.mjs#L126) | an all-negative theme stops at exhausted coverage, caches its negatives, and leaves stories for later themes | Standard |
| [L133](../tests/incremental-story-library.test.mjs#L133) | a corrupt theme cache is rejudged without extracting the original again | Standard |
| [L139](../tests/incremental-story-library.test.mjs#L139) | a failed verdict write surfaces failure, preserving the catalog for an explicit retry | Standard |
| [L146](../tests/incremental-story-library.test.mjs#L146) | a changed extraction model or effort starts an isolated library while themes alone do not | Standard |
| [L153](../tests/incremental-story-library.test.mjs#L153) | old summary catalog resumes ranges and coverage without extraction or old theme verdicts | Standard |
| [L161](../tests/incremental-story-library.test.mjs#L161) | matching model and effort invalidate verdicts without invalidating extraction | Standard |
| [L167](../tests/incremental-story-library.test.mjs#L167) | six originals are matched in bounded batches with reordered IDs and durable negative receipts | Standard |
| [L175](../tests/incremental-story-library.test.mjs#L175) | legacy pending ranges lose synopsis metadata and a failed upgrade write remains retryable | Standard |
| [L185](../tests/incremental-story-library.test.mjs#L185) | one-at-a-time presentation extracts a bounded larger batch after a cold miss and consumes the batch without re-reading | Standard |

### tests/manual-extraction-start.test.mjs

[tests/manual-extraction-start.test.mjs](../tests/manual-extraction-start.test.mjs) — 2 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L7](../tests/manual-extraction-start.test.mjs#L7) | creation, demand and restart stay idle until the user starts extraction | Standard |
| [L28](../tests/manual-extraction-start.test.mjs#L28) | opening and cancelling a replacement draft does not extract or change the original | Standard |

### tests/reader-suggestion-request.test.mjs

[tests/reader-suggestion-request.test.mjs](../tests/reader-suggestion-request.test.mjs) — 6 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L18](../tests/reader-suggestion-request.test.mjs#L18) | reading percentage uses character totals, withholds 100% until complete, and validates bounds | Standard |
| [L27](../tests/reader-suggestion-request.test.mjs#L27) | fragmented UTF-8 progress reaches the caller before the final batch | Standard |
| [L36](../tests/reader-suggestion-request.test.mjs#L36) | offline API, interrupted streams and provider failures reject instead of returning partial success | Standard |
| [L43](../tests/reader-suggestion-request.test.mjs#L43) | both a stalled connection and a stalled body time out; explicit cancellation aborts the request | Standard |
| [L53](../tests/reader-suggestion-request.test.mjs#L53) | HTTP keeps JSON clients working, streams progress early, safely reports errors and signals cancellation | Standard |
| [L75](../tests/reader-suggestion-request.test.mjs#L75) | Node HTTP flushes progress without waiting for completion and cancels work on disconnect | Standard |

### tests/selected-chapter-extraction.test.mjs

[tests/selected-chapter-extraction.test.mjs](../tests/selected-chapter-extraction.test.mjs) — 7 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L22](../tests/selected-chapter-extraction.test.mjs#L22) | multiple selected chapters extract scoped stories before preparation, replay canonically and survive restart | Standard |
| [L39](../tests/selected-chapter-extraction.test.mjs#L39) | forged, duplicate, empty, excessive, nonchapter and mixed scopes fail before insertion | Standard |
| [L48](../tests/selected-chapter-extraction.test.mjs#L48) | out-of-scope model receipts fail closed; changing selected scope never reuses another scope cache | Standard |
| [L55](../tests/selected-chapter-extraction.test.mjs#L55) | chapter scopes retain canonical ranges even when the chapter contains an isolated unreadable unit | Standard |
| [L62](../tests/selected-chapter-extraction.test.mjs#L62) | a story may span selected neighboring chapters and prepares their original parts intact | Standard |
| [L72](../tests/selected-chapter-extraction.test.mjs#L72) | an explicit all-chapter scope has a distinct cache from whole-book discovery | Standard |
| [L84](../tests/selected-chapter-extraction.test.mjs#L84) | a fresh task and fresh discovery wrapper reuse persisted stories for the same chapter set without LLM calls | Standard |

### tests/story-chapter-context.test.mjs

[tests/story-chapter-context.test.mjs](../tests/story-chapter-context.test.mjs) — 6 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L18](../tests/story-chapter-context.test.mjs#L18) | the short gold-lock anchor retains its citation and saves all of chapter eight, including the departure | Standard |
| [L29](../tests/story-chapter-context.test.mjs#L29) | discontinuous and cross-chapter anchors expand each involved chapter once in book order | Standard |
| [L39](../tests/story-chapter-context.test.mjs#L39) | the reader exposes saved full chapters and citations while historical passage-only stories stay readable | Standard |
| [L50](../tests/story-chapter-context.test.mjs#L50) | isolated Liaozhai and Shishuo stories keep their exact source without neighboring stories | Standard |
| [L60](../tests/story-chapter-context.test.mjs#L60) | `${provider}: complete chapters survive persistence and reach pacing, outline, scenes, ending, review and repair` | Matrix/template |
| [L89](../tests/story-chapter-context.test.mjs#L89) | full context preserves unreadable markers outside the qualified story and rejects an oversized chapter without truncation | Standard |

### tests/story-chapter-picker.test.mjs

[tests/story-chapter-picker.test.mjs](../tests/story-chapter-picker.test.mjs) — 6 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L12](../tests/story-chapter-picker.test.mjs#L12) | contents preserve named stories, single anecdotes and chapter receipts with quality gates | Standard |
| [L25](../tests/story-chapter-picker.test.mjs#L25) | metadata browsing needs no configured provider; direct intake derives title and keeps production gated across replay/restart | Standard |
| [L43](../tests/story-chapter-picker.test.mjs#L43) | forged, stale, cross-book and non-catalog ranges fail before a task is saved | Standard |
| [L52](../tests/story-chapter-picker.test.mjs#L52) | contents search matches traditional text and full-width chapter punctuation | Standard |
| [L58](../tests/story-chapter-picker.test.mjs#L58) | multiword search matches every normalized term in any order across fields | Standard |
| [L64](../tests/story-chapter-picker.test.mjs#L64) | Three Kingdoms search finds Huang Zhong at Dingjun Mountain beyond the preview without exposing full chapters | Standard |

### tests/story-continuation-overlap.test.mjs

[tests/story-continuation-overlap.test.mjs](../tests/story-continuation-overlap.test.mjs) — 6 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L19](../tests/story-continuation-overlap.test.mjs#L19) | a captured completion sharing only old pending evidence survives acceptance, display, exclusion and restart | Standard |
| [L30](../tests/story-continuation-overlap.test.mjs#L30) | `continuation evidence cannot bypass ${mode}` | Matrix/template |
| [L41](../tests/story-continuation-overlap.test.mjs#L41) | invalid cached continuation evidence cannot be reused as an accepted story | Standard |
| [L47](../tests/story-continuation-overlap.test.mjs#L47) | a different complete third-chapter event may share background without an old pending event | Standard |
| [L56](../tests/story-continuation-overlap.test.mjs#L56) | fresh complete events do not trust model-supplied pending completion metadata | Standard |
| [L63](../tests/story-continuation-overlap.test.mjs#L63) | `rejection diagnostics preserve state for ${mode} and clear on a valid retry` | Matrix/template |

### tests/story-discovery-cache.test.mjs

[tests/story-discovery-cache.test.mjs](../tests/story-discovery-cache.test.mjs) — 25 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L36](../tests/story-discovery-cache.test.mjs#L36) | continuous discovery consumes a larger extracted catalog one story at a time | Standard |
| [L41](../tests/story-discovery-cache.test.mjs#L41) | suggestion effort isolates cached progress and unrelated review effort preserves cache hits | Standard |
| [L50](../tests/story-discovery-cache.test.mjs#L50) | old caches without effort are not migrated into a newly configured effort namespace | Standard |
| [L56](../tests/story-discovery-cache.test.mjs#L56) | whole book first selects one, then catalogs four and returns four matches promptly; hot hits do not extract again | Standard |
| [L65](../tests/story-discovery-cache.test.mjs#L65) | chapter mode returns one first and resumes the same block before advancing | Standard |
| [L73](../tests/story-discovery-cache.test.mjs#L73) | a partial chapter batch returns immediately, survives restart, and continues only after its sources are excluded | Standard |
| [L84](../tests/story-discovery-cache.test.mjs#L84) | a single story ends scanning without marking an unfinished block exhausted | Standard |
| [L95](../tests/story-discovery-cache.test.mjs#L95) | reading manifests contain references only, persist across themes and reject corrupt coverage | Standard |
| [L107](../tests/story-discovery-cache.test.mjs#L107) | cross-chapter pending survives omission, accumulates evidence, and only a covering complete story consumes it | Standard |
| [L131](../tests/story-discovery-cache.test.mjs#L131) | a zero-result explicitly complete block advances; an unfinished no-progress response fails without skipping | Standard |
| [L139](../tests/story-discovery-cache.test.mjs#L139) | fake event consumption and merged pending overflow keep the previous cursor and events | Standard |
| [L152](../tests/story-discovery-cache.test.mjs#L152) | another theme reuses the neutral library while presentation changes reuse its matching cache | Standard |
| [L160](../tests/story-discovery-cache.test.mjs#L160) | a consumed event cannot be resurrected by returning the same source as a new empty-id pending | Standard |
| [L170](../tests/story-discovery-cache.test.mjs#L170) | concurrent requests share one expansion; one reader cancelling does not cancel the other | Standard |
| [L177](../tests/story-discovery-cache.test.mjs#L177) | all readers cancelling still saves the finished call and does not dispatch another block | Standard |
| [L184](../tests/story-discovery-cache.test.mjs#L184) | a second reader gets unseen stories from a shared expansion without waiting to fill a presentation page | Standard |
| [L194](../tests/story-discovery-cache.test.mjs#L194) | a waiting reader whose exclusions cover the shared batch continues scanning | Standard |
| [L204](../tests/story-discovery-cache.test.mjs#L204) | a partial cached batch does not wait behind another readers model call | Standard |
| [L212](../tests/story-discovery-cache.test.mjs#L212) | a complete cached page does not wait behind another readers model call | Standard |
| [L221](../tests/story-discovery-cache.test.mjs#L221) | cache write errors and malformed model state do not pretend success | Standard |
| [L225](../tests/story-discovery-cache.test.mjs#L225) | distinct sources sharing a display title remain available when excluding by source | Standard |
| [L231](../tests/story-discovery-cache.test.mjs#L231) | invalid and overlapping receipts are removed and cannot advance the current block | Standard |
| [L237](../tests/story-discovery-cache.test.mjs#L237) | FileMedia restart and authenticated JSON/streaming routes preserve partial batches and per-reader exclusions | Standard |
| [L251](../tests/story-discovery-cache.test.mjs#L251) | a draining reader waits for the call it ended, surfaces its failure, and leaves shared readers alone | Standard |
| [L270](../tests/story-discovery-cache.test.mjs#L270) | stopping and resuming a search reads on from its saved position | Standard |

### tests/story-discovery-eval.test.mjs

[tests/story-discovery-eval.test.mjs](../tests/story-discovery-eval.test.mjs) — 5 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L6](../tests/story-discovery-eval.test.mjs#L6) | end-to-end recall counts unknown positives while coverage exposes missing judgments | Standard |
| [L12](../tests/story-discovery-eval.test.mjs#L12) | empty denominators are not zero accuracy | Standard |
| [L13](../tests/story-discovery-eval.test.mjs#L13) | range matching is one-to-one and deterministic; merge/split/endpoints are diagnostics | Standard |
| [L18](../tests/story-discovery-eval.test.mjs#L18) | shipped annotations cover 44 pairs, four books and three complete chapters, with controlled provenance | Standard |
| [L26](../tests/story-discovery-eval.test.mjs#L26) | shipped distinct complete events share verified background without sharing their outcomes | Standard |

### tests/story-discovery-metrics.test.mjs

[tests/story-discovery-metrics.test.mjs](../tests/story-discovery-metrics.test.mjs) — 6 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L7](../tests/story-discovery-metrics.test.mjs#L7) | `${provider}: wire IDs, partial parsing, capacity, prefix order and safe metrics` | Matrix/template |
| [L20](../tests/story-discovery-metrics.test.mjs#L20) | unknown usage stays unknown; only recognized content failures are isolatable | Standard |
| [L23](../tests/story-discovery-metrics.test.mjs#L23) | `${provider}: ${fault} transport failure stays a service error` | Matrix/template |
| [L28](../tests/story-discovery-metrics.test.mjs#L28) | `${provider}: valid catalog siblings survive malformed pending metadata` | Matrix/template |
| [L40](../tests/story-discovery-metrics.test.mjs#L40) | shutdown drain includes queued measurement updates that have not entered the cache yet | Standard |
| [L49](../tests/story-discovery-metrics.test.mjs#L49) | cancelled extraction still attributes its completed paid receipt to the original cycle | Standard |

### tests/story-discovery-modes.e2e.mjs

[tests/story-discovery-modes.e2e.mjs](../tests/story-discovery-modes.e2e.mjs) — 1 scenario declarations.

**Current selection:** Default `pnpm test:e2e`; `pnpm test:full`.

**Execution surface:** Real browser E2E with isolated/controlled fixtures.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L17](../tests/story-discovery-modes.e2e.mjs#L17) | title, theme and original scope are independently optional in the creation UI | {timeout:120000} |

### tests/story-discovery-modes.test.mjs

[tests/story-discovery-modes.test.mjs](../tests/story-discovery-modes.test.mjs) — 6 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L15](../tests/story-discovery-modes.test.mjs#L15) | `${name}: title queries keep full scope, ignore theme filtering and never fall back to episodes` | Matrix/template |
| [L55](../tests/story-discovery-modes.test.mjs#L55) | automatic discovery with a chapter scope keeps extraction neutral and applies the selected theme | Standard |
| [L67](../tests/story-discovery-modes.test.mjs#L67) | verified title results and their cached replay never depend on an available theme matcher | Standard |
| [L76](../tests/story-discovery-modes.test.mjs#L76) | title plus a catalog story scopes inference to its exact passage and rejects mixed or forged excerpts | Standard |
| [L93](../tests/story-discovery-modes.test.mjs#L93) | title intent, scope and theme survive creation, replay, restart and choosing in the production API | Standard |
| [L110](../tests/story-discovery-modes.test.mjs#L110) | invalid title intents and unsupported books are rejected before saving a task | Standard |

### tests/story-discovery-speed-accuracy.e2e.mjs

[tests/story-discovery-speed-accuracy.e2e.mjs](../tests/story-discovery-speed-accuracy.e2e.mjs) — 6 scenario declarations.

**Current selection:** `pnpm test:e2e:extended`; `pnpm test:full`.

**Execution surface:** Service/process/engine E2E; filename does not imply visible UI.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L15](../tests/story-discovery-speed-accuracy.e2e.mjs#L15) | persistent bad stories do not block later originals; exhausted results disclose unknown judgments | Standard |
| [L21](../tests/story-discovery-speed-accuracy.e2e.mjs#L21) | eight isolation calls span automatic rounds, viewer departures and a restart; manual retry starts a new cycle | Standard |
| [L29](../tests/story-discovery-speed-accuracy.e2e.mjs#L29) | a service outage stops without splitting and keeps already-paid catalog entries | Standard |
| [L33](../tests/story-discovery-speed-accuracy.e2e.mjs#L33) | later matching batch returns while two pending calls save after selection | Standard |
| [L40](../tests/story-discovery-speed-accuracy.e2e.mjs#L40) | partial pending failure saves independent stories; corrected receipt resolves without reinsertion after restart | Standard |
| [L46](../tests/story-discovery-speed-accuracy.e2e.mjs#L46) | single invalid cached entries are removed without rereading a completed original | Standard |

### tests/story-discovery-speed-accuracy.test.mjs

[tests/story-discovery-speed-accuracy.test.mjs](../tests/story-discovery-speed-accuracy.test.mjs) — 20 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L10](../tests/story-discovery-speed-accuracy.test.mjs#L10) | a bad cached story or pending does not clear good stories or completed coverage | Standard |
| [L15](../tests/story-discovery-speed-accuracy.test.mjs#L15) | partial pending failure retains independent story and corrected receipt closes from cached evidence | Standard |
| [L22](../tests/story-discovery-speed-accuracy.test.mjs#L22) | all queued cache updates execute and merge latest state | Standard |
| [L35](../tests/story-discovery-speed-accuracy.test.mjs#L35) | one persistent story failure is isolated once and later matching stories remain reachable | Standard |
| [L41](../tests/story-discovery-speed-accuracy.test.mjs#L41) | isolation budget survives repeated requests and cache recreation in the same cycle | Standard |
| [L47](../tests/story-discovery-speed-accuracy.test.mjs#L47) | a later matching batch returns before two pending batches, then both pending receipts save | Standard |
| [L52](../tests/story-discovery-speed-accuracy.test.mjs#L52) | service failures stop dispatch instead of being isolated or cached as no | Standard |
| [L57](../tests/story-discovery-speed-accuracy.test.mjs#L57) | matching cache is shared across scope and extraction identity but checks original content | Standard |
| [L67](../tests/story-discovery-speed-accuracy.test.mjs#L67) | arbitrary old theme receipts migrate from frozen keys without repeating paid judgments | Standard |
| [L73](../tests/story-discovery-speed-accuracy.test.mjs#L73) | invalid extraction ranges never advance even when a model claims block completion | Standard |
| [L76](../tests/story-discovery-speed-accuracy.test.mjs#L76) | high overlap is diagnostic; a distinct complete event with new evidence remains usable | Standard |
| [L82](../tests/story-discovery-speed-accuracy.test.mjs#L82) | nine stories need two actual extraction calls; a full receipt cannot falsely complete its block | Standard |
| [L87](../tests/story-discovery-speed-accuracy.test.mjs#L87) | an isolation service failure prevents queued batches from starting | Standard |
| [L91](../tests/story-discovery-speed-accuracy.test.mjs#L91) | changed matching identity cannot reuse an isolation budget charge in the same cycle | Standard |
| [L95](../tests/story-discovery-speed-accuracy.test.mjs#L95) | invalid pending syntax retains independent stories and the prior cursor and pending event | Standard |
| [L99](../tests/story-discovery-speed-accuracy.test.mjs#L99) | a known service outage closes other active queries using the same matching service | Standard |
| [L107](../tests/story-discovery-speed-accuracy.test.mjs#L107) | joined matching cycles each retain one receipt after the initiating reader leaves | Standard |
| [L114](../tests/story-discovery-speed-accuracy.test.mjs#L114) | a cycle starting with an unshown cached yes cannot retry old unknowns after that yes is shown | Standard |
| [L120](../tests/story-discovery-speed-accuracy.test.mjs#L120) | only cycles with reserved isolation credit receive a shared isolation cost receipt | Standard |
| [L126](../tests/story-discovery-speed-accuracy.test.mjs#L126) | valid old neutral records survive a missing manifest without claiming old coverage | Standard |

### tests/story-matching-models.test.mjs

[tests/story-matching-models.test.mjs](../tests/story-matching-models.test.mjs) — 3 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L6](../tests/story-matching-models.test.mjs#L6) | `${provider}: matching uses its dedicated model and low effort while extraction retains its configuration` | Matrix/template |
| [L22](../tests/story-matching-models.test.mjs#L22) | OpenAI rejects a mismatched actual matching model and accepts an omitted model as the explicit request identity | Standard |
| [L28](../tests/story-matching-models.test.mjs#L28) | `${provider}: catalog output limits follow the extraction request, independently of display` | Matrix/template |

## Story preparation and editorial choices

Recommended trigger: Changed intake/editorial/schema/prompt code; main regression; critical preparation browser smoke before release.

Change surface: Story intake/brief/title/summary/requirements/reflection modules and their UI.

### tests/art-recommendation.test.mjs

[tests/art-recommendation.test.mjs](../tests/art-recommendation.test.mjs) — 5 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L18](../tests/art-recommendation.test.mjs#L18) | recommendations validate real style IDs and bounded nonempty reasons, while old history still loads | Standard |
| [L28](../tests/art-recommendation.test.mjs#L28) | new stories adopt their recommendation, reselect preserves manual choice, and another story replaces it | Standard |
| [L40](../tests/art-recommendation.test.mjs#L40) | discovery defers art while existing recommendation contracts and receipts stay compatible | Standard |
| [L62](../tests/art-recommendation.test.mjs#L62) | Gemini and Codex omit art work during scans and preserve recommendations in other modes | Standard |
| [L83](../tests/art-recommendation.test.mjs#L83) | direct whole-book selection preserves the original content-based art recommendation | Standard |

### tests/reader-intake.test.mjs

[tests/reader-intake.test.mjs](../tests/reader-intake.test.mjs) — 14 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L14](../tests/reader-intake.test.mjs#L14) | intent is saved before discovery; restart and waiting for story choice never commission scripts/images | Standard |
| [L22](../tests/reader-intake.test.mjs#L22) | choosing prepares saved source and count; only full production confirmation starts generation | Standard |
| [L34](../tests/reader-intake.test.mjs#L34) | creation/action replay are independent of progress; competing choices conflict atomically | Standard |
| [L45](../tests/reader-intake.test.mjs#L45) | a failed search stays with the search; obsolete jobs do not block the next one | Standard |
| [L54](../tests/reader-intake.test.mjs#L54) | failed preparation can be replaced, manual preferences survive reselect, and old receipts are fenced | Standard |
| [L69](../tests/reader-intake.test.mjs#L69) | empty batches stay selectable, cap at forty, and pause never dispatches discovery | Standard |
| [L80](../tests/reader-intake.test.mjs#L80) | display states distinguish queued extraction, waiting choice and full setup without false completion | Standard |
| [L87](../tests/reader-intake.test.mjs#L87) | choosing a new candidate can carry unsaved manual preferences in the same atomic choice | Standard |
| [L94](../tests/reader-intake.test.mjs#L94) | reselecting remote candidates prepares distinct originals through the real source cache, while returning to one reuses its text | Standard |
| [L115](../tests/reader-intake.test.mjs#L115) | finding another batch leaves the prepared story in place and observes until the search ends | Standard |
| [L126](../tests/reader-intake.test.mjs#L126) | confirmed intake draws eighty frames once across four storyboard batches | heavy |
| [L137](../tests/reader-intake.test.mjs#L137) | legacy prepared choice receipts read as confirming without writes or paid work, and can confirm directly | Standard |
| [L150](../tests/reader-intake.test.mjs#L150) | phase recovery compares local source ranges canonically and rejects partial or mismatched checkpoints | Standard |
| [L172](../tests/reader-intake.test.mjs#L172) | a paused source-and-summary story can be renamed without changing preparation or starting generation | Standard |

### tests/story-brief.test.mjs

[tests/story-brief.test.mjs](../tests/story-brief.test.mjs) — 3 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L18](../tests/story-brief.test.mjs#L18) | binary matching requires a reason and rejects review or summary fields | Standard |
| [L25](../tests/story-brief.test.mjs#L25) | binary matching survives cache reuse and an old receipt is rejudged without rescanning | Standard |
| [L33](../tests/story-brief.test.mjs#L33) | `${provider}: brief verification, bounded output, theme/source guidance and original facts remain separate` | Matrix/template |

### tests/story-editorial.test.mjs

[tests/story-editorial.test.mjs](../tests/story-editorial.test.mjs) — 3 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L10](../tests/story-editorial.test.mjs#L10) | `${provider}: ${theme} edits title and ending after saved scenes, then independently audits both` | Matrix/template |
| [L38](../tests/story-editorial.test.mjs#L38) | `invalid title audit ${JSON.stringify(invalid)} cannot change the plan or authorize drawing` | Matrix/template |
| [L47](../tests/story-editorial.test.mjs#L47) | source editorial context never treats its display label as a theme to satisfy | Standard |

### tests/story-reflection-candidates.test.mjs

[tests/story-reflection-candidates.test.mjs](../tests/story-reflection-candidates.test.mjs) — 7 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L13](../tests/story-reflection-candidates.test.mjs#L13) | `${provider}: audit selects candidate ${index} exactly and persists its evidence before drawing` | Matrix/template |
| [L34](../tests/story-reflection-candidates.test.mjs#L34) | failed choice audit resumes after restart without regenerating candidates or frames | Standard |
| [L44](../tests/story-reflection-candidates.test.mjs#L44) | `invalid ${invalid} choice cannot mutate the saved plan or discard candidates` | Matrix/template |
| [L53](../tests/story-reflection-candidates.test.mjs#L53) | `invalid candidates ${JSON.stringify(values)} preserve the saved storyboard` | Matrix/template |
| [L62](../tests/story-reflection-candidates.test.mjs#L62) | all-rejected selection repairs only the selected sentence, then audits without stale candidates | Standard |
| [L80](../tests/story-reflection-candidates.test.mjs#L80) | candidate and choice schemas preserve the old single-ending report contract | Standard |
| [L89](../tests/story-reflection-candidates.test.mjs#L89) | `${provider}: editorial theme guides review and scene repair, with original facts and authored requirements intact` | Matrix/template |

### tests/story-reflection.test.mjs

[tests/story-reflection.test.mjs](../tests/story-reflection.test.mjs) — 8 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L16](../tests/story-reflection.test.mjs#L16) | `${provider}: ${length} saved frames precede the separate ending and whole-story audit` | Matrix/template |
| [L44](../tests/story-reflection.test.mjs#L44) | `${provider}: failed ending resumes after restart without re-planning saved scenes` | Matrix/template |
| [L56](../tests/story-reflection.test.mjs#L56) | `${provider}: ending-only repair is audited again and preserves every scene` | Matrix/template |
| [L78](../tests/story-reflection.test.mjs#L78) | mixed issues repair all scene batches before rewriting the ending from the corrected whole | Standard |
| [L95](../tests/story-reflection.test.mjs#L95) | unchanged ending blocks drawing and manual continuation uses the saved ending issue | Standard |
| [L106](../tests/story-reflection.test.mjs#L106) | saved ending receipts and concurrent advances cannot repeat a paid ending | Standard |
| [L119](../tests/story-reflection.test.mjs#L119) | review validation keeps ending issues separate from real frame numbers | Standard |
| [L125](../tests/story-reflection.test.mjs#L125) | repairing an ending in a revision retains all existing images | Standard |

### tests/story-requirements.test.mjs

[tests/story-requirements.test.mjs](../tests/story-requirements.test.mjs) — 8 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L13](../tests/story-requirements.test.mjs#L13) | criteria are bounded and legacy stories remain unmodified; acceptance-only revisions preserve images and script | Standard |
| [L21](../tests/story-requirements.test.mjs#L21) | missing, duplicate, out-of-range and unactionable failed criterion results cannot pass review validation | Standard |
| [L27](../tests/story-requirements.test.mjs#L27) | `${provider}: saved per-story requirements, actual prompts and acceptance-only revisions survive restart without redrawing` | Matrix/template |
| [L49](../tests/story-requirements.test.mjs#L49) | failed criteria enter existing targeted repair and must pass a fresh audit before drawing | Standard |
| [L55](../tests/story-requirements.test.mjs#L55) | unknown/conflicting criteria stop immediately with evidence, no fabricated repair or drawing | Standard |
| [L63](../tests/story-requirements.test.mjs#L63) | historical rows have no invented capture history, and previews do not commission inference | Standard |
| [L70](../tests/story-requirements.test.mjs#L70) | prompt export metadata identifies partially retained and inherited calls without leaking raw receipts | Standard |
| [L86](../tests/story-requirements.test.mjs#L86) | confirmation drafts retain both requirements through restart and apply them only on explicit confirmation | Standard |

### tests/story-specific-requirements.test.mjs

[tests/story-specific-requirements.test.mjs](../tests/story-specific-requirements.test.mjs) — 7 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L20](../tests/story-specific-requirements.test.mjs#L20) | generic defaults are system rules; blank and historical automatic fields remain empty | Standard |
| [L29](../tests/story-specific-requirements.test.mjs#L29) | `${provider}: source-specific setup suggestions survive restart, edits and confirmation, then route to their own stages` | Matrix/template |
| [L47](../tests/story-specific-requirements.test.mjs#L47) | a paused draft saved during inference wins through progress and final checkpoints, including intentional blanks | Standard |
| [L65](../tests/story-specific-requirements.test.mjs#L65) | reselection replaces unchanged automatic guidance and preserves authored draft fields even without settings | Standard |
| [L76](../tests/story-specific-requirements.test.mjs#L76) | ordinary revisions retain provenance so a new selection version clears inherited automatic requirements | Standard |
| [L92](../tests/story-specific-requirements.test.mjs#L92) | completed stories retain deliberately blank requirements through open and committed reselection | Standard |
| [L100](../tests/story-specific-requirements.test.mjs#L100) | edits after failed replacement preparation supersede inherited authored overrides | Standard |

### tests/story-summary.test.mjs

[tests/story-summary.test.mjs](../tests/story-summary.test.mjs) — 5 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L40](../tests/story-summary.test.mjs#L40) | upgrade removes old fields from stories, drafts, outlines, revision bases and media without changing content | Standard |
| [L61](../tests/story-summary.test.mjs#L61) | an unsafe media backup blocks migration before writes and a repaired source retries safely | Standard |
| [L70](../tests/story-summary.test.mjs#L70) | derived image IDs and anchors migrate and a paid unpublished image is published without another image request | Standard |
| [L93](../tests/story-summary.test.mjs#L93) | target job identity collisions abort the upgrade without discarding either receipt | Standard |
| [L100](../tests/story-summary.test.mjs#L100) | script disclosure renders the summary with the existing storyboard | Standard |

### tests/story-title.test.mjs

[tests/story-title.test.mjs](../tests/story-title.test.mjs) — 3 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L10](../tests/story-title.test.mjs#L10) | renaming persists across restart without changing source, script, media, progress, versions or jobs; no provider required | Standard |
| [L34](../tests/story-title.test.mjs#L34) | a running image checkpoint cannot revert the name; later revisions inherit it while fresh stories do not | Standard |
| [L50](../tests/story-title.test.mjs#L50) | invalid, cross-origin and other-owner renames leave stored data intact | Standard |

## Storyboard, frame count and audit/repair

Recommended trigger: Changed planning/count/review/repair code or prompts; main regression.

Change surface: reader-engine/review/structure; storyboard/count contracts; provider review schema/prompt changes.

### tests/adaptive-storyboard-review.e2e.mjs

[tests/adaptive-storyboard-review.e2e.mjs](../tests/adaptive-storyboard-review.e2e.mjs) — 8 scenario declarations.

**Current selection:** `pnpm test:e2e:extended`; `pnpm test:full`.

**Execution surface:** Service/process/engine E2E; filename does not imply visible UI.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L12](../tests/adaptive-storyboard-review.e2e.mjs#L12) | `${provider}: automatic counts differ from the estimate; structural insertion/deletion rechecks before images` | Matrix/template |
| [L30](../tests/adaptive-storyboard-review.e2e.mjs#L30) | structural edits remap existing duplicate pictures and concurrent reading progress atomically | Standard |
| [L49](../tests/adaptive-storyboard-review.e2e.mjs#L49) | deleting a duplicate transition reduces count and keeps reading positions valid | Standard |
| [L56](../tests/adaptive-storyboard-review.e2e.mjs#L56) | `${invalid?'invalid':'unchanged'} structural output stops without images or automatic replay` | Matrix/template |
| [L64](../tests/adaptive-storyboard-review.e2e.mjs#L64) | saved structural edits survive restart without being charged a second time | Standard |
| [L78](../tests/adaptive-storyboard-review.e2e.mjs#L78) | automatic structural repairs share the twenty-pass stop and never draw through it | Standard |
| [L85](../tests/adaptive-storyboard-review.e2e.mjs#L85) | `${missing?'missing coverage':'invented source quote'} cannot approve an automatic script` | Matrix/template |
| [L92](../tests/adaptive-storyboard-review.e2e.mjs#L92) | `late reading progress ${structural?'cannot cross a structural save':'survives an unrelated image checkpoint'}` | Matrix/template |

### tests/adaptive-storyboard-review.test.mjs

[tests/adaptive-storyboard-review.test.mjs](../tests/adaptive-storyboard-review.test.mjs) — 6 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L19](../tests/adaptive-storyboard-review.test.mjs#L19) | ordered insertion and deletion preserve explicit identities, including duplicate prompts | Standard |
| [L28](../tests/adaptive-storyboard-review.test.mjs#L28) | caption-only replacement reuses its explicit source; first-frame or global identity changes invalidate artwork | Standard |
| [L36](../tests/adaptive-storyboard-review.test.mjs#L36) | invalid edits fail before mutating a saved plan and execution bounds cannot be exceeded | Standard |
| [L43](../tests/adaptive-storyboard-review.test.mjs#L43) | coverage validates source references, frame bounds and a concrete matching issue | Standard |
| [L52](../tests/adaptive-storyboard-review.test.mjs#L52) | old numeric caption/style edits preserve their mode; explicit narrative replanning selects auto | Standard |
| [L58](../tests/adaptive-storyboard-review.test.mjs#L58) | `${provider} editorial/structure wire schemas and bounded output budgets` | Matrix/template |

### tests/character-continuity-edits.e2e.mjs

[tests/character-continuity-edits.e2e.mjs](../tests/character-continuity-edits.e2e.mjs) — 4 scenario declarations.

**Current selection:** `pnpm test:e2e:extended`; `pnpm test:full`.

**Execution surface:** Service/process/engine E2E; filename does not imply visible UI.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L8](../tests/character-continuity-edits.e2e.mjs#L8) | characters-only repair preserves frames, records old/new metadata and rechecks before drawing | Standard |
| [L17](../tests/character-continuity-edits.e2e.mjs#L17) | an unchanged global repair is blocked without drawing | Standard |
| [L22](../tests/character-continuity-edits.e2e.mjs#L22) | legacy numeric scripts retain their global-replan stop rather than silently changing mode | Standard |
| [L27](../tests/character-continuity-edits.e2e.mjs#L27) | global continuity repairs share the existing twenty-repair ceiling | Standard |

### tests/character-continuity-edits.test.mjs

[tests/character-continuity-edits.test.mjs](../tests/character-continuity-edits.test.mjs) — 2 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L11](../tests/character-continuity-edits.test.mjs#L11) | character-only edits keep frame and progress identities, invalidate global drawing inputs and retain other metadata | Standard |
| [L20](../tests/character-continuity-edits.test.mjs#L20) | `${provider}: global characters-only repair keeps the existing text-stage budget` | Matrix/template |

### tests/frame-count-continuation.test.mjs

[tests/frame-count-continuation.test.mjs](../tests/frame-count-continuation.test.mjs) — 4 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L12](../tests/frame-count-continuation.test.mjs#L12) | legal system drafts retain text, usage, history and repair count but lose old approval | Standard |
| [L15](../tests/frame-count-continuation.test.mjs#L15) | changed source/settings or illegal frame output cannot seed a continuation | Standard |
| [L20](../tests/frame-count-continuation.test.mjs#L20) | a version change never resets the twenty-repair ceiling | Standard |
| [L25](../tests/frame-count-continuation.test.mjs#L25) | restart without new inference retains receipts and failures for the next continuation | Standard |

### tests/frame-count-gate.e2e.mjs

[tests/frame-count-gate.e2e.mjs](../tests/frame-count-gate.e2e.mjs) — 4 scenario declarations.

**Current selection:** `pnpm test:e2e:extended`; `pnpm test:full`.

**Execution surface:** Service/process/engine E2E; filename does not imply visible UI.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L16](../tests/frame-count-gate.e2e.mjs#L16) | old script expands, rechecks count, then completes the original audit with zero media calls | Standard |
| [L35](../tests/frame-count-gate.e2e.mjs#L35) | two restarting processes cannot both reclaim a dead evaluation owner | Standard |
| [L46](../tests/frame-count-gate.e2e.mjs#L46) | a rejected new binding or concurrent process leaves frozen provenance untouched | Standard |
| [L58](../tests/frame-count-gate.e2e.mjs#L58) | an inherited exhausted repair budget blocks before restructuring or media | Standard |

### tests/frame-count-gate.test.mjs

[tests/frame-count-gate.test.mjs](../tests/frame-count-gate.test.mjs) — 6 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L22](../tests/frame-count-gate.test.mjs#L22) | production engine reduces, preserves images, saves every count receipt, then selects ending in full audit | Standard |
| [L35](../tests/frame-count-gate.test.mjs#L35) | a saved count-keep survives restart and failed full retry without paying the count gate again | Standard |
| [L41](../tests/frame-count-gate.test.mjs#L41) | `invalid count ${invalid} stops before full review or media` | Matrix/template |
| [L47](../tests/frame-count-gate.test.mjs#L47) | count repairs share the global limit; no-op repair blocks and manual retry has a distinct job key | Standard |
| [L53](../tests/frame-count-gate.test.mjs#L53) | raw receipt reuse requires the resolved model | Standard |
| [L58](../tests/frame-count-gate.test.mjs#L58) | a count structure repair consumes the same allowance as a subsequent full repair | Standard |

### tests/frame-count-replay.test.mjs

[tests/frame-count-replay.test.mjs](../tests/frame-count-replay.test.mjs) — 6 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L14](../tests/frame-count-replay.test.mjs#L14) | replay freezes every pair and requires the complete job and resolved model | Standard |
| [L22](../tests/frame-count-replay.test.mjs#L22) | replay rejects requested or actual model mismatches | Standard |
| [L26](../tests/frame-count-replay.test.mjs#L26) | different receipts for one exact request are ambiguous regardless of editorial verdict | Standard |
| [L30](../tests/frame-count-replay.test.mjs#L30) | only the receipt linked to an explicit output failure is excluded, not its job or a timeout predecessor | Standard |
| [L39](../tests/frame-count-replay.test.mjs#L39) | explicit failure identity stays tied to its recorded call even after later calls | Standard |
| [L44](../tests/frame-count-replay.test.mjs#L44) | persisted exact entry proof permits restart into structure and full jobs, while forged proof does not | Standard |

### tests/frame-count-review.test.mjs

[tests/frame-count-review.test.mjs](../tests/frame-count-review.test.mjs) — 7 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L14](../tests/frame-count-review.test.mjs#L14) | the dedicated gate derives unambiguous issues and keeps full requirements when one frame has multiple losses | Standard |
| [L23](../tests/frame-count-review.test.mjs#L23) | count verdicts respect the current count, direction, bounds and corresponding structural issues | Standard |
| [L34](../tests/frame-count-review.test.mjs#L34) | the original audit remains intact and the appended count audit follows the requested four-step order | Standard |
| [L39](../tests/frame-count-review.test.mjs#L39) | `${provider}: automatic audit requires count decision without changing review effort or budget` | Matrix/template |
| [L48](../tests/frame-count-review.test.mjs#L48) | local count audits reject mismatched saved source before invoking the provider | Standard |
| [L55](../tests/frame-count-review.test.mjs#L55) | structure revision receives every complete requirement, while the recommendation remains advisory | Standard |
| [L62](../tests/frame-count-review.test.mjs#L62) | count and full audits reuse the same story scope instead of divergent title-based boundaries | Standard |

### tests/review-history-api.test.mjs

[tests/review-history-api.test.mjs](../tests/review-history-api.test.mjs) — 2 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L14](../tests/review-history-api.test.mjs#L14) | history is demand-loaded, read-only, owner scoped, and deleted stories stay hidden | Standard |
| [L22](../tests/review-history-api.test.mjs#L22) | a fresh revision shows its own records and links its parent without inheriting parent verdicts | Standard |

### tests/review-history-flow.test.mjs

[tests/review-history-flow.test.mjs](../tests/review-history-flow.test.mjs) — 1 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L8](../tests/review-history-flow.test.mjs#L8) | formal review flow persists ordered history and before text without affecting generation on read | Standard |

### tests/review-history.test.mjs

[tests/review-history.test.mjs](../tests/review-history.test.mjs) — 8 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L13](../tests/review-history.test.mjs#L13) | mixed count/full/repair order uses only this version and preserves unknown verdict | Standard |
| [L19](../tests/review-history.test.mjs#L19) | stored before wins, absent before stays absent, and ambiguous calls are not assigned a position | Standard |
| [L26](../tests/review-history.test.mjs#L26) | old structure calls with equal full round are matched by saved original ranges and requested issues | Standard |
| [L33](../tests/review-history.test.mjs#L33) | structure insertion/deletion numbers refer to the historical drafts, not the current plan | Standard |
| [L38](../tests/review-history.test.mjs#L38) | first full report is an audit even after manual continuation; prior reports become rechecks | Standard |
| [L41](../tests/review-history.test.mjs#L41) | reflection/global character changes and no-op attempts retain their actual evidence | Standard |
| [L45](../tests/review-history.test.mjs#L45) | empty legacy documents return no invented events or times | Standard |
| [L48](../tests/review-history.test.mjs#L48) | legacy character-only repairs without prior text do not claim no change | Standard |

### tests/story-completeness.test.mjs

[tests/story-completeness.test.mjs](../tests/story-completeness.test.mjs) — 3 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L14](../tests/story-completeness.test.mjs#L14) | `${provider}: structural omissions block before any repair or image and survive retries and restart` | Matrix/template |
| [L47](../tests/story-completeness.test.mjs#L47) | a missing opening introduction is repaired in frame one without replanning or adding frames | Standard |
| [L61](../tests/story-completeness.test.mjs#L61) | historical issues stay compatible; a replan marker cannot masquerade as an ending or local caption issue | Standard |

### tests/storyboard-batches.test.mjs

[tests/storyboard-batches.test.mjs](../tests/storyboard-batches.test.mjs) — 7 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L12](../tests/storyboard-batches.test.mjs#L12) | `${provider}: outline and 20/20/5 checkpoints precede every image` | Matrix/template |
| [L37](../tests/storyboard-batches.test.mjs#L37) | `${provider}: 80 frames complete four batches and background drawing reaches frame 80` | Matrix/template; heavy |
| [L50](../tests/storyboard-batches.test.mjs#L50) | `${length} frames use a single short plan or bounded batches` | Matrix/template |
| [L57](../tests/storyboard-batches.test.mjs#L57) | `${provider}: ${failure} in the second batch keeps the first batch and retries only missing work` | Matrix/template |
| [L75](../tests/storyboard-batches.test.mjs#L75) | `${action} between batches retains 20 saved frames across restart` | Matrix/template |
| [L90](../tests/storyboard-batches.test.mjs#L90) | concurrent batch advances and replayed queue receipts do not repeat saved paid work | Standard |
| [L109](../tests/storyboard-batches.test.mjs#L109) | `${provider}: selected-story stages retain theme context without restoring legacy automatic scene prescriptions` | Matrix/template |

### tests/storyboard-review.test.mjs

[tests/storyboard-review.test.mjs](../tests/storyboard-review.test.mjs) — 14 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L13](../tests/storyboard-review.test.mjs#L13) | `${provider}: review is a separate queued job and gates all drawing` | Matrix/template |
| [L25](../tests/storyboard-review.test.mjs#L25) | `${provider}: twenty automatic repair rounds then block; concurrent manual continue reuses saved issues` | Matrix/template |
| [L38](../tests/storyboard-review.test.mjs#L38) | legacy client does not automatically retry a quality blockage | Standard |
| [L44](../tests/storyboard-review.test.mjs#L44) | 21 requested repairs are saved as 20+1 and only then reviewed again | Standard |
| [L52](../tests/storyboard-review.test.mjs#L52) | `review ${malformed} pages fail validation without image requests` | Matrix/template |
| [L60](../tests/storyboard-review.test.mjs#L60) | `repair ${malformed} output cannot mutate the saved plan` | Matrix/template |
| [L73](../tests/storyboard-review.test.mjs#L73) | `${phase} in flight drains on ${action} and resumes from saved checkpoints after restart` | Matrix/template |
| [L89](../tests/storyboard-review.test.mjs#L89) | old complete plans remain readable without a retroactive audit | Standard |
| [L96](../tests/storyboard-review.test.mjs#L96) | a saved review whose queue receipt was lost is not paid twice | Standard |
| [L105](../tests/storyboard-review.test.mjs#L105) | `${provider}: targeted repair checkpoints precede a fresh whole-plan review` | Matrix/template |
| [L121](../tests/storyboard-review.test.mjs#L121) | `${provider}: caption-only issues across batches gate drawing and preserve scene prompts` | Matrix/template |
| [L144](../tests/storyboard-review.test.mjs#L144) | `${provider}: a new issue after the third repair is fixed automatically before drawing` | Matrix/template |
| [L152](../tests/storyboard-review.test.mjs#L152) | no-op repair blocks immediately, saves the paid attempt and never draws | Standard |
| [L159](../tests/storyboard-review.test.mjs#L159) | manual continuation after a no-op second batch preserves the first twenty repaired pages | Standard |

### tests/unified-story-review.e2e.mjs

[tests/unified-story-review.e2e.mjs](../tests/unified-story-review.e2e.mjs) — 5 scenario declarations.

**Current selection:** Default `pnpm test:e2e`; `pnpm test:full`.

**Execution surface:** Service/process/engine E2E; filename does not imply visible UI.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L24](../tests/unified-story-review.e2e.mjs#L24) | production queue survives old review keys, reduces with full requirements, and reuses bytes before missing-image dispatch | Standard |
| [L46](../tests/unified-story-review.e2e.mjs#L46) | count in flight drains on pause; restart/full failure retries do not repeat saved count | Standard |
| [L56](../tests/unified-story-review.e2e.mjs#L56) | full structure edits return to count, while caption repair stays in full | Standard |
| [L67](../tests/unified-story-review.e2e.mjs#L67) | explicit draw-anyway remains marked, paused and idempotent when bypassing an unfinished count gate | Standard |
| [L74](../tests/unified-story-review.e2e.mjs#L74) | `opening an old automatic plan with ${legacyReview} review does not add either audit` | Matrix/template |

## Production queue, lifecycle and recovery

Recommended trigger: Changed queue/engine/state/revision code; main regression. Keep a short no-duplicate-work lifecycle guard on every code PR; release protocol smoke.

Change surface: server/production*; reader-engine/repository; revision/control/state-machine contracts.

### tests/background-generation.test.mjs

[tests/background-generation.test.mjs](../tests/background-generation.test.mjs) — 18 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L16](../tests/background-generation.test.mjs#L16) | `${provider}: new stories generate every page without a viewer or a mode request` | Matrix/template |
| [L26](../tests/background-generation.test.mjs#L26) | `${action} overrides viewers and legacy calls, survives restart and resumes in the saved mode` | Matrix/template |
| [L41](../tests/background-generation.test.mjs#L41) | manual pause also fences an unmanaged legacy session and direct engine acquisition | Standard |
| [L50](../tests/background-generation.test.mjs#L50) | resume upgrades a paused reader story to whole-story work and reuses every saved image | Standard |
| [L62](../tests/background-generation.test.mjs#L62) | leaving a new story keeps it generating; a manual pause still survives restart | Standard |
| [L72](../tests/background-generation.test.mjs#L72) | `${provider}: shutdown drains saved images; startup resumes only the missing background pages` | Matrix/template |
| [L82](../tests/background-generation.test.mjs#L82) | `expired background attempts recover with saved control (${paused?'paused':'active'}) and never steal live claims` | Matrix/template |
| [L98](../tests/background-generation.test.mjs#L98) | expired background script locks restart planning without viewers | Standard |
| [L105](../tests/background-generation.test.mjs#L105) | background provider failures stay failed after restart until explicit retry | Standard |
| [L114](../tests/background-generation.test.mjs#L114) | reader deletion disarms background work; restore cannot restart it | Standard |
| [L122](../tests/background-generation.test.mjs#L122) | legacy numeric background preparation retains count confirmation and does not plan or draw early | Standard |
| [L129](../tests/background-generation.test.mjs#L129) | background and foreground stories share the global image cap across coordinators | Standard |
| [L138](../tests/background-generation.test.mjs#L138) | controls validate owner, origin, body and completed sessions; pause does not require provider access | Standard |
| [L149](../tests/background-generation.test.mjs#L149) | `${provider}: an expired missing remote result resumes automatically but saved images do not repeat` | Matrix/template |
| [L160](../tests/background-generation.test.mjs#L160) | startup reconciles a fully published background story whose final session save was interrupted | Standard |
| [L167](../tests/background-generation.test.mjs#L167) | a concurrent mode change cannot overwrite another window’s manual pause | Standard |
| [L176](../tests/background-generation.test.mjs#L176) | upgrading a pre-background library preserves checkpoints and pauses old stories | Standard |
| [L193](../tests/background-generation.test.mjs#L193) | single-control upgrade preserves background intent, manual controls, failures, leases and receipts | Standard |

### tests/blocked-revision-recovery.test.mjs

[tests/blocked-revision-recovery.test.mjs](../tests/blocked-revision-recovery.test.mjs) — 3 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L13](../tests/blocked-revision-recovery.test.mjs#L13) | upgrade backs up and repairs stranded blocked revisions without replacing authorizations or healthy checkpoints | Standard |
| [L46](../tests/blocked-revision-recovery.test.mjs#L46) | a fault storage failure rolls back the blocked child instead of publishing an unrecoverable revision | Standard |
| [L58](../tests/blocked-revision-recovery.test.mjs#L58) | a paused blocked revision requires resume before an explicit retry repairs and completes it once | Standard |

### tests/generation-progress.test.mjs

[tests/generation-progress.test.mjs](../tests/generation-progress.test.mjs) — 7 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L8](../tests/generation-progress.test.mjs#L8) | planning reports saved source, chosen count and elapsed attempt time without a percentage | Standard |
| [L17](../tests/generation-progress.test.mjs#L17) | drawing progress counts saved images and completed steps | Standard |
| [L25](../tests/generation-progress.test.mjs#L25) | failure, pause and queueing do not keep a running elapsed clock | Standard |
| [L33](../tests/generation-progress.test.mjs#L33) | unknown counts and timestamps stay unknown and durations include minutes | Standard |
| [L40](../tests/generation-progress.test.mjs#L40) | review and repair are distinct saved stages and drawing only becomes current after approval | Standard |
| [L48](../tests/generation-progress.test.mjs#L48) | step clocks survive reopening and count down to the saved deadline | Standard |
| [L62](../tests/generation-progress.test.mjs#L62) | completed durations merge parallel work, accumulate batches and exclude waiting gaps | Standard |

### tests/paused-editing-versions.test.mjs

[tests/paused-editing-versions.test.mjs](../tests/paused-editing-versions.test.mjs) — 7 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L11](../tests/paused-editing-versions.test.mjs#L11) | a paused unfinished storyboard can be revised; late work, replay and restart do not resume or overwrite it | Standard |
| [L39](../tests/paused-editing-versions.test.mjs#L39) | saving pauses the old version, keeps favorites and valid progress; replay respects later resume and pause | Standard |
| [L53](../tests/paused-editing-versions.test.mjs#L53) | latest means submitted version, independent of status, reads, deletion and owner; independent same-title stories stay separate | Standard |
| [L73](../tests/paused-editing-versions.test.mjs#L73) | pre-confirmation drafts cannot bypass intake; empty-plan impact does not invent changes or reusable artwork | Standard |
| [L84](../tests/paused-editing-versions.test.mjs#L84) | client snapshots cannot replace the latest card with a historical direct read | Standard |
| [L90](../tests/paused-editing-versions.test.mjs#L90) | paused preparation saves settings beside a live call, then allows a different candidate without resuming | Standard |
| [L109](../tests/paused-editing-versions.test.mjs#L109) | `concurrent ${paused?'paused':'running'} submission replay cannot overwrite a later user control` | Matrix/template |

### tests/production-queue-hardening.test.mjs

[tests/production-queue-hardening.test.mjs](../tests/production-queue-hardening.test.mjs) — 17 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L19](../tests/production-queue-hardening.test.mjs#L19) | derived eligibility includes deleted children and ignores corrupt unrelated rows | Standard |
| [L33](../tests/production-queue-hardening.test.mjs#L33) | `concurrent publication fences ${action} control without changing the old version` | Matrix/template |
| [L63](../tests/production-queue-hardening.test.mjs#L63) | every old-version start point refuses without changing attempts or documents | Standard |
| [L82](../tests/production-queue-hardening.test.mjs#L82) | image start rechecks newest version after its first dispatch check | Standard |
| [L92](../tests/production-queue-hardening.test.mjs#L92) | `atomic fork publishes ${paused?'paused':'active'} child without parent writes; replay preserves later control` | Matrix/template |
| [L104](../tests/production-queue-hardening.test.mjs#L104) | `style-only fork preserves ${status\|\|'legacy'} review checkpoint` | Matrix/template |
| [L113](../tests/production-queue-hardening.test.mjs#L113) | seeded legacy paused handoff still resumes and clears its flag without touching parent | Standard |
| [L120](../tests/production-queue-hardening.test.mjs#L120) | `style-only pre-plan edit preserves ${kind}; requirements and counts discard it` | Matrix/template |
| [L138](../tests/production-queue-hardening.test.mjs#L138) | ready orphaned jobs in all four pools are contained and logged once while a valid job runs | Standard |
| [L152](../tests/production-queue-hardening.test.mjs#L152) | `delete during script ${fails?'failure stays retryable':'checkpoint yields and restore does not replay'}` | Matrix/template |
| [L166](../tests/production-queue-hardening.test.mjs#L166) | SQL candidates exclude paused, failed, superseded and active reader-mode deleted jobs, but retain publication and orphans | Standard |
| [L190](../tests/production-queue-hardening.test.mjs#L190) | warm paused pass uses at most 60 statements; unchanged active state and viewer renewals perform no upserts | Standard |
| [L209](../tests/production-queue-hardening.test.mjs#L209) | pruning catches a job failing after the earlier changed-story pass, and expires only expired viewers | Standard |
| [L222](../tests/production-queue-hardening.test.mjs#L222) | shelf trimming keeps recovery metadata and never changes the opened session source | Standard |
| [L230](../tests/production-queue-hardening.test.mjs#L230) | already-paid image publishes to a deleted active reader-mode story without another draw | Standard |
| [L243](../tests/production-queue-hardening.test.mjs#L243) | an old viewer cannot hold back another story after a newer version is published | Standard |
| [L255](../tests/production-queue-hardening.test.mjs#L255) | two blocked manual corrections leave only newest eligible; stale retry/skip and old paid lock stay isolated | Standard |

### tests/production-queue.test.mjs

[tests/production-queue.test.mjs](../tests/production-queue.test.mjs) — 12 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L13](../tests/production-queue.test.mjs#L13) | search and text each have one independent worker beside image and local pools | Standard |
| [L25](../tests/production-queue.test.mjs#L25) | search pool migration upgrades queued and interrupted rows with stable ids and receipts | Standard |
| [L35](../tests/production-queue.test.mjs#L35) | recovery contains an orphan callback failure once and still recovers another lease | Standard |
| [L44](../tests/production-queue.test.mjs#L44) | voice/images branch after script; motion/processing feed video; assembly retry reuses every artifact | Standard |
| [L60](../tests/production-queue.test.mjs#L60) | two schedulers share the SQL pool cap and never claim the same paid job | Standard |
| [L69](../tests/production-queue.test.mjs#L69) | leases renew only their own token; stale completion cannot overwrite a replacement result | Standard |
| [L76](../tests/production-queue.test.mjs#L76) | expired work fails explicitly; enqueue and pump never silently replay it; retry is owner scoped | Standard |
| [L84](../tests/production-queue.test.mjs#L84) | a live attempt survives a clock jump; a second scheduler that recovers it fences the late result | Standard |
| [L95](../tests/production-queue.test.mjs#L95) | a stop-time failure is an interruption unless the handler says it is terminal or it drains | Standard |
| [L104](../tests/production-queue.test.mjs#L104) | a claim released before its handler starts does not count as an attempt | Standard |
| [L111](../tests/production-queue.test.mjs#L111) | a database error before the handler starts makes no paid call and is not a job failure | Standard |
| [L119](../tests/production-queue.test.mjs#L119) | completed timing is saved with the receipt and retained across queue instances and retries | Standard |

### tests/production-stages.test.mjs

[tests/production-stages.test.mjs](../tests/production-stages.test.mjs) — 2 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L7](../tests/production-stages.test.mjs#L7) | seven steps distinguish initial review, targeted repair, recheck, skipped work and legacy stories | Standard |
| [L30](../tests/production-stages.test.mjs#L30) | acceptance blockers mark the audit that produced them without erasing completed repairs | Standard |

### tests/queue-image-recovery.test.mjs

[tests/queue-image-recovery.test.mjs](../tests/queue-image-recovery.test.mjs) — 19 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L46](../tests/queue-image-recovery.test.mjs#L46) | `a ${name} file at publication asks first, then redraws only on explicit retry` | Matrix/template |
| [L62](../tests/queue-image-recovery.test.mjs#L62) | `a ${damage} first image fails the next page before paying, and retry redraws only it` | Matrix/template |
| [L78](../tests/queue-image-recovery.test.mjs#L78) | an invalid saved image result is treated as lost, and redraws only on explicit retry | Standard |
| [L87](../tests/queue-image-recovery.test.mjs#L87) | publication requires the bytes to match the file type; a reference only needs a usable image | Standard |
| [L100](../tests/queue-image-recovery.test.mjs#L100) | a file that comes back before the retry is published without paying again | Standard |
| [L108](../tests/queue-image-recovery.test.mjs#L108) | a read that throws stays transient without redrawing, even at retry | Standard |
| [L122](../tests/queue-image-recovery.test.mjs#L122) | mixed lost and transient failures prioritize the redraw action | Standard |
| [L132](../tests/queue-image-recovery.test.mjs#L132) | an open story draws its first image, current page and read-ahead ahead of other work | Standard |
| [L140](../tests/queue-image-recovery.test.mjs#L140) | a viewed first image goes ahead of an older story's waiting first image | Standard |
| [L148](../tests/queue-image-recovery.test.mjs#L148) | only the current page and six after it go ahead of unread stories | Standard |
| [L159](../tests/queue-image-recovery.test.mjs#L159) | moving to another page changes what comes next without cancelling the running page | Standard |
| [L167](../tests/queue-image-recovery.test.mjs#L167) | closing the story returns it to page order, and it keeps generating | Standard |
| [L178](../tests/queue-image-recovery.test.mjs#L178) | a lost connection returns the story to background order, and it keeps generating | Standard |
| [L188](../tests/queue-image-recovery.test.mjs#L188) | without a reader, order stays by page across stories | Standard |
| [L196](../tests/queue-image-recovery.test.mjs#L196) | the legacy client never retries a lost image automatically | Standard |
| [L203](../tests/queue-image-recovery.test.mjs#L203) | `a non-retry request against a ${state} story starts nothing` | Matrix/template |
| [L235](../tests/queue-image-recovery.test.mjs#L235) | `${name} ends the hold on other stories` | Matrix/template |
| [L242](../tests/queue-image-recovery.test.mjs#L242) | a viewed first image still drawing leaves spare workers free for other stories | Standard |
| [L253](../tests/queue-image-recovery.test.mjs#L253) | two viewed stories both finish | Standard |

### tests/queue-image-versions.test.mjs

[tests/queue-image-versions.test.mjs](../tests/queue-image-versions.test.mjs) — 8 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L14](../tests/queue-image-versions.test.mjs#L14) | explicit retry publishes the current paid result over a stale slot once, without redrawing | Standard |
| [L44](../tests/queue-image-versions.test.mjs#L44) | an old in-flight image cannot publish late or start its queued siblings after inputs change | Standard |
| [L64](../tests/queue-image-versions.test.mjs#L64) | publication rechecks its version after an awaited file read | Standard |
| [L81](../tests/queue-image-versions.test.mjs#L81) | a reference read cannot start paid drawing after the image inputs become obsolete | Standard |
| [L98](../tests/queue-image-versions.test.mjs#L98) | sibling publications that read the same document both save without duplicate usage | Standard |
| [L118](../tests/queue-image-versions.test.mjs#L118) | publication CAS rejects a plan change after its final read | Standard |
| [L142](../tests/queue-image-versions.test.mjs#L142) | obsolete cleanup preserves a real current failure and never retries it | Standard |
| [L158](../tests/queue-image-versions.test.mjs#L158) | `obsolete failed jobs release their saved error while retaining ${generationControl} control` | Matrix/template |

### tests/queue-interruption.test.mjs

[tests/queue-interruption.test.mjs](../tests/queue-interruption.test.mjs) — 22 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L45](../tests/queue-interruption.test.mjs#L45) | quitting during an image resumes after restart without a retry or provider error | Standard |
| [L52](../tests/queue-interruption.test.mjs#L52) | quitting during script work resumes planning without a retry | Standard |
| [L63](../tests/queue-interruption.test.mjs#L63) | `quitting after ${action} keeps the control, and Resume continues without a retry` | Matrix/template |
| [L73](../tests/queue-interruption.test.mjs#L73) | quitting during frame-count preparation resumes it without a retry | Standard |
| [L84](../tests/queue-interruption.test.mjs#L84) | quitting with saved pages redraws only the interrupted pages | Standard |
| [L93](../tests/queue-interruption.test.mjs#L93) | `quitting after ${action} during script work keeps the control, and Resume plans again` | Matrix/template |
| [L104](../tests/queue-interruption.test.mjs#L104) | a deterministic 4xx in script work during a stop stays failed without replaying | Standard |
| [L116](../tests/queue-interruption.test.mjs#L116) | a blocked review during a stop stays failed and never repairs automatically | Standard |
| [L130](../tests/queue-interruption.test.mjs#L130) | a real provider failure while running is not treated as an interruption | Standard |
| [L138](../tests/queue-interruption.test.mjs#L138) | a transient tick error stops one cycle only and logs once | Standard |
| [L151](../tests/queue-interruption.test.mjs#L151) | no paid work starts while the claim cannot be written, and work resumes when it can | Standard |
| [L160](../tests/queue-interruption.test.mjs#L160) | a tick error during shutdown still closes the database, and work resumes next start | Standard |
| [L174](../tests/queue-interruption.test.mjs#L174) | one failed tick during shutdown does not stop the drain: finished work is still published | Standard |
| [L191](../tests/queue-interruption.test.mjs#L191) | `a story with ${name} parks alone: other stories finish and the shelf loads` | Matrix/template |
| [L207](../tests/queue-interruption.test.mjs#L207) | a queued text job for an unreadable document makes no paid plan call | Standard |
| [L220](../tests/queue-interruption.test.mjs#L220) | a failed success write is not a provider failure and recovers as an interruption | Standard |
| [L233](../tests/queue-interruption.test.mjs#L233) | a failed failure write does not stop the queue or report a provider failure | Standard |
| [L245](../tests/queue-interruption.test.mjs#L245) | a failed checkpoint save during script work is not a provider failure and recovers | Standard |
| [L257](../tests/queue-interruption.test.mjs#L257) | a publication write error recovers without paying for the image again | Standard |
| [L269](../tests/queue-interruption.test.mjs#L269) | a clock jump during a live call keeps its claims, saves its result and pays once | Standard |
| [L284](../tests/queue-interruption.test.mjs#L284) | results arriving after a clock jump, before any tick renews the claims, are still saved | Standard |
| [L300](../tests/queue-interruption.test.mjs#L300) | automatic recovery stops at three attempts, and a retry restores the allowance | Standard |

### tests/reader-production.test.mjs

[tests/reader-production.test.mjs](../tests/reader-production.test.mjs) — 21 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L17](../tests/reader-production.test.mjs#L17) | `${provider}: early demand, single anchor, rolling refill, individual visibility and moving lookahead` | Matrix/template |
| [L34](../tests/reader-production.test.mjs#L34) | image concurrency is configurable and global across stories; text/source are not repeated | Standard |
| [L43](../tests/reader-production.test.mjs#L43) | one viewer leaving preserves another; all leaving drains paid results and pauses new generation | Standard |
| [L52](../tests/reader-production.test.mjs#L52) | expired viewer demand stops dispatch even if the browser never sends leave | Standard |
| [L60](../tests/reader-production.test.mjs#L60) | deletion hides a story immediately while retaining every in-flight image and receipt | Standard |
| [L69](../tests/reader-production.test.mjs#L69) | local publication failure and legacy retry reuse the paid receipt and record usage once | Standard |
| [L82](../tests/reader-production.test.mjs#L82) | paid failure stops refill, keeps sibling successes and retry only draws missing scenes | Standard |
| [L91](../tests/reader-production.test.mjs#L91) | restart before viewer expiry never resumes paid work until a fresh viewer request | Standard |
| [L98](../tests/reader-production.test.mjs#L98) | session and job heartbeats fence legacy advances while slow images are still running | Standard |
| [L107](../tests/reader-production.test.mjs#L107) | `${provider}: step timing uses the persisted production claim across reads and renewals` | Matrix/template |
| [L133](../tests/reader-production.test.mjs#L133) | shutdown stops dispatch before draining in-flight outputs and closes SQLite after publication | Standard |
| [L139](../tests/reader-production.test.mjs#L139) | queue routes validate input/origin and use server owner identity | Standard |
| [L147](../tests/reader-production.test.mjs#L147) | reference validation accepts reordered same-story assets and rejects malformed or out-of-range paths | Standard |
| [L158](../tests/reader-production.test.mjs#L158) | `${provider}: reordered story resumes at page 11 after restart without regenerating ten saved images` | Matrix/template |
| [L183](../tests/reader-production.test.mjs#L183) | `${provider}: immutable attempts and exact same-story anchor validation protect replacement bytes` | Matrix/template |
| [L210](../tests/reader-production.test.mjs#L210) | publication must own its job token as well as the session token | Standard |
| [L221](../tests/reader-production.test.mjs#L221) | `${provider}: legacy numeric confirmation gates paid script/images before planning` | Matrix/template |
| [L236](../tests/reader-production.test.mjs#L236) | slow script preparation renews its session lease and excludes a legacy planner | Standard |
| [L248](../tests/reader-production.test.mjs#L248) | deleted pending publication with an expired pre-restart lease cannot poison another story | Standard |
| [L261](../tests/reader-production.test.mjs#L261) | shrinking lookahead after backtracking reports a full buffer idle despite outstanding later jobs | Standard |
| [L270](../tests/reader-production.test.mjs#L270) | completed step durations survive the next stage, fresh reads and service restart | Standard |

### tests/reader-revisions.test.mjs

[tests/reader-revisions.test.mjs](../tests/reader-revisions.test.mjs) — 16 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L18](../tests/reader-revisions.test.mjs#L18) | image dependencies exclude narration, include scene/anchor/global inputs, and reject ambiguous edit scopes | Standard |
| [L37](../tests/reader-revisions.test.mjs#L37) | image-only redraw validates page selection and cannot conceal content edits | Standard |
| [L46](../tests/reader-revisions.test.mjs#L46) | `${provider}: image-only redraw replaces selected pages including anchor without review or touching other images` | Matrix/template |
| [L72](../tests/reader-revisions.test.mjs#L72) | image-only redraw refuses an unreviewed story and missing unselected media without starting work | Standard |
| [L84](../tests/reader-revisions.test.mjs#L84) | `${provider}: caption-only revision reuses every copied image, original and deleted-parent independence` | Matrix/template |
| [L101](../tests/reader-revisions.test.mjs#L101) | one scene change redraws only that image, with copied anchor; first scene change redraws all | Standard |
| [L110](../tests/reader-revisions.test.mjs#L110) | late parent image writes remain isolated and derived eligibility blocks additional old dispatch | Standard |
| [L119](../tests/reader-revisions.test.mjs#L119) | family epoch serializes concurrent drafts; identical request replay is stable, changed replay is rejected | Standard |
| [L132](../tests/reader-revisions.test.mjs#L132) | invalid inputs, unchanged drafts, stale parent, and cross-owner IDs never create a child or write copied media | Standard |
| [L147](../tests/reader-revisions.test.mjs#L147) | `reusable ${kind} asset ${kind==='transient'?'stops the submission':'is redrawn in the new version'}` | Matrix/template |
| [L159](../tests/reader-revisions.test.mjs#L159) | `${provider}: style changes preserve planning and review; requirements and counts re-audit` | Matrix/template |
| [L174](../tests/reader-revisions.test.mjs#L174) | review repair invalidates newly changed staging but preserves caption-only repair images | Standard |
| [L183](../tests/reader-revisions.test.mjs#L183) | atomic active child survives restart and deleted parent; lost response replays without duplicate copy or generation | Standard |
| [L192](../tests/reader-revisions.test.mjs#L192) | failed publication INSERT leaves no child and replay publishes one active version | Standard |
| [L200](../tests/reader-revisions.test.mjs#L200) | new queue: copied anchor loss warns without paying, explicit retry redraws only anchor and edited scene | Standard |
| [L214](../tests/reader-revisions.test.mjs#L214) | new queue: lost revision publication only redraws its own edited page after retry | Standard |

### tests/release-smoke.playwright.e2e.mjs

[tests/release-smoke.playwright.e2e.mjs](../tests/release-smoke.playwright.e2e.mjs) — 1 scenario declarations.

**Current selection:** `--gate=release`; `--gate=npm`.

**Execution surface:** Real browser E2E with isolated/controlled fixtures.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L4](../tests/release-smoke.playwright.e2e.mjs#L4) | STORY-LIFECYCLE-C001: create, wait, extract, edit preparation, confirm and read | {timeout:180000} |

### tests/shared-library.test.mjs

[tests/shared-library.test.mjs](../tests/shared-library.test.mjs) — 1 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L8](../tests/shared-library.test.mjs#L8) | direct desktop and development share stories/media/progress and exclude duplicate generation | Standard |

### tests/story-flow-control.test.mjs

[tests/story-flow-control.test.mjs](../tests/story-flow-control.test.mjs) — 32 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); Default `pnpm test:e2e`; `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L33](../tests/story-flow-control.test.mjs#L33) | images and progress never invalidate a draft on a story still drawing | Standard |
| [L43](../tests/story-flow-control.test.mjs#L43) | a real change conflicts, and the same submission stays idempotent | Standard |
| [L52](../tests/story-flow-control.test.mjs#L52) | a blocked story shows every issue, can be edited, and draws on the reader's word exactly once | Standard |
| [L71](../tests/story-flow-control.test.mjs#L71) | a paused failed review can be explicitly accepted without rerunning or changing the script | Standard |
| [L92](../tests/story-flow-control.test.mjs#L92) | a blocked revision that reused its first image can still be drawn past | Standard |
| [L105](../tests/story-flow-control.test.mjs#L105) | repeating draw anyway cannot redraw a failed image or clear its marker | Standard |
| [L116](../tests/story-flow-control.test.mjs#L116) | a lost image is redrawn in the new version rather than blocking it | Standard |
| [L133](../tests/story-flow-control.test.mjs#L133) | a lost first image redraws everything, and an unreadable one creates nothing | Standard |
| [L145](../tests/story-flow-control.test.mjs#L145) | review changing the first frame reports the real redraw count; no preview, no notice | Standard |
| [L156](../tests/story-flow-control.test.mjs#L156) | searching leaves preparation alone, and neither loses the other's saved state | Standard |
| [L170](../tests/story-flow-control.test.mjs#L170) | a queued preparation survives a search requested before it starts | Standard |
| [L179](../tests/story-flow-control.test.mjs#L179) | a held search allows another story and its own preparation to finish while a second search waits | Standard |
| [L200](../tests/story-flow-control.test.mjs#L200) | observing a choice survives a dropped connection | Standard |
| [L211](../tests/story-flow-control.test.mjs#L211) | a failed search leaves a prepared story confirmable without repeating any work | Standard |
| [L222](../tests/story-flow-control.test.mjs#L222) | a candidate can be chosen while a search runs, and the late result is refused | Standard |
| [L230](../tests/story-flow-control.test.mjs#L230) | confirming ends the search: nothing queued starts and nothing late is added | Standard |
| [L246](../tests/story-flow-control.test.mjs#L246) | clicking the selected story redoes nothing; a stale device can retry from what is saved | Standard |
| [L257](../tests/story-flow-control.test.mjs#L257) | queued preparation fills missing art before confirmation without duplicating work after a style update | Standard |
| [L276](../tests/story-flow-control.test.mjs#L276) | art recommendations apply until the reader really changes the style | Standard |
| [L285](../tests/story-flow-control.test.mjs#L285) | saved settings survive search, restart and re-preparation, and confirmation applies the draft | Standard |
| [L298](../tests/story-flow-control.test.mjs#L298) | `${name} stops a search between calls and frees the text slot` | Matrix/template |
| [L311](../tests/story-flow-control.test.mjs#L311) | a paused search reads as waiting, not running | Standard |
| [L318](../tests/story-flow-control.test.mjs#L318) | a clean stop between calls resumes after restart without spending an attempt | Standard |
| [L326](../tests/story-flow-control.test.mjs#L326) | a call killed by a stop counts as an interruption, resumes after restart and is capped | Standard |
| [L347](../tests/story-flow-control.test.mjs#L347) | an interrupted search on a paused story waits instead of failing | Standard |
| [L355](../tests/story-flow-control.test.mjs#L355) | retry restores only the current selection; superseded jobs leave the queue | Standard |
| [L367](../tests/story-flow-control.test.mjs#L367) | superseded jobs leave the queue on finished, paused and deleted stories too | Standard |
| [L381](../tests/story-flow-control.test.mjs#L381) | a dead lock on a paused story blocks nothing and does not resume it; confirming still starts it | Standard |
| [L393](../tests/story-flow-control.test.mjs#L393) | a preparation whose receipt was lost after saving settles instead of cycling | Standard |
| [L400](../tests/story-flow-control.test.mjs#L400) | a story without intake never gains one from a worker save | Standard |
| [L405](../tests/story-flow-control.test.mjs#L405) | a discovering record an older release wrote still finds its stories | Standard |
| [L422](../tests/story-flow-control.test.mjs#L422) | the migration carries saved searches over without new work or lost choices | Standard |

### tests/story-generation-membership.test.mjs

[tests/story-generation-membership.test.mjs](../tests/story-generation-membership.test.mjs) — 7 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L30](../tests/story-generation-membership.test.mjs#L30) | an initial history deep link does not invalidate the authoritative latest list | Standard |
| [L37](../tests/story-generation-membership.test.mjs#L37) | reading history after deleting the latest card cannot resurrect the family | Standard |
| [L42](../tests/story-generation-membership.test.mjs#L42) | restoring a historical snapshot only admits members returned by the latest list | Standard |
| [L48](../tests/story-generation-membership.test.mjs#L48) | a blocked address update does not reject a saved story or invite another creation | Standard |
| [L61](../tests/story-generation-membership.test.mjs#L61) | a lost creation response retries the same saved story even when address updates are blocked | Standard |
| [L77](../tests/story-generation-membership.test.mjs#L77) | renaming updates the shelf and active story without replaying reading progress or starting production | Standard |
| [L94](../tests/story-generation-membership.test.mjs#L94) | separate successful creation actions can still create independent stories | Standard |

### tests/story-generation-state-machine-client.test.mjs

[tests/story-generation-state-machine-client.test.mjs](../tests/story-generation-state-machine-client.test.mjs) — 1 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L9](../tests/story-generation-state-machine-client.test.mjs#L9) | an explicit first-image retry renews reader demand after restart without another authorization | Standard |

### tests/story-generation-state-machine-commands.test.mjs

[tests/story-generation-state-machine-commands.test.mjs](../tests/story-generation-state-machine-commands.test.mjs) — 8 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L17](../tests/story-generation-state-machine-commands.test.mjs#L17) | one durable recovery command cannot pay again after its response is lost and work fails again | Standard |
| [L31](../tests/story-generation-state-machine-commands.test.mjs#L31) | two different commands cannot claim the same failure, and mismatched replay is rejected | Standard |
| [L42](../tests/story-generation-state-machine-commands.test.mjs#L42) | migration removes display title from existing identities without resetting paid receipts or failures | Standard |
| [L61](../tests/story-generation-state-machine-commands.test.mjs#L61) | restarting an accepted recovery shares its three interrupted attempts; replay cannot reset the cap | Standard |
| [L73](../tests/story-generation-state-machine-commands.test.mjs#L73) | an image-loss insert revokes completed atomically without a second application write | Standard |
| [L79](../tests/story-generation-state-machine-commands.test.mjs#L79) | an already-upgraded library keeps an older display-name failure as an independent legacy block | Standard |
| [L91](../tests/story-generation-state-machine-commands.test.mjs#L91) | restored complete checkpoints settle atomically even while paused and without a subsequent request | Standard |
| [L97](../tests/story-generation-state-machine-commands.test.mjs#L97) | cross-table request ID guards close the race after two connections have both read no receipt | Standard |

### tests/story-generation-state-machine-flow.test.mjs

[tests/story-generation-state-machine-flow.test.mjs](../tests/story-generation-state-machine-flow.test.mjs) — 16 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); Default `pnpm test:e2e`; `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L14](../tests/story-generation-state-machine-flow.test.mjs#L14) | renaming a running image preserves task identity and does not buy a duplicate anchor | Standard |
| [L20](../tests/story-generation-state-machine-flow.test.mjs#L20) | real failed work needs a current fault authorization; replay after another failure never spends again | Standard |
| [L33](../tests/story-generation-state-machine-flow.test.mjs#L33) | two images lost after completion can recover separately without clearing or blocking the other fault | Standard |
| [L43](../tests/story-generation-state-machine-flow.test.mjs#L43) | restored files are reused by both health checks and a durable redraw command without inference | Standard |
| [L51](../tests/story-generation-state-machine-flow.test.mjs#L51) | temporary storage errors and stale image reports cannot create redraw permission; truncated images do | Standard |
| [L59](../tests/story-generation-state-machine-flow.test.mjs#L59) | first-image loss preserves in-flight work, blocks new dependent calls and survives pause/restart | Standard |
| [L68](../tests/story-generation-state-machine-flow.test.mjs#L68) | independent publication recovery does not draw or clear an unrelated missing image | Standard |
| [L76](../tests/story-generation-state-machine-flow.test.mjs#L76) | a lost paid publication file requires a new explicit redraw rather than upgrading save authorization | Standard |
| [L86](../tests/story-generation-state-machine-flow.test.mjs#L86) | independent recoveries can run together; first-image loss fences nonfirst redraws | Standard |
| [L94](../tests/story-generation-state-machine-flow.test.mjs#L94) | control request replay cannot undo a later pause; concurrent fault grants spend only once across restart | Standard |
| [L105](../tests/story-generation-state-machine-flow.test.mjs#L105) | checking a restored anchor settles only its pre-inference dependent failure and completes without a retry | Standard |
| [L112](../tests/story-generation-state-machine-flow.test.mjs#L112) | restoring a file after a new ordinary redraw failure preserves its fault until an explicit free reuse | Standard |
| [L119](../tests/story-generation-state-machine-flow.test.mjs#L119) | creation binds immutable parameters and request IDs cannot be reused across actions | Standard |
| [L126](../tests/story-generation-state-machine-flow.test.mjs#L126) | `healthy restored files complete locally with ${action} and no viewers` | Matrix/template |
| [L133](../tests/story-generation-state-machine-flow.test.mjs#L133) | a display-title change during publication cannot fail the already-paid image | Standard |
| [L139](../tests/story-generation-state-machine-flow.test.mjs#L139) | an uncertain reference read cannot reach a provider that has a separately readable media handle | Standard |

### tests/story-generation-state-machine-reselection.test.mjs

[tests/story-generation-state-machine-reselection.test.mjs](../tests/story-generation-state-machine-reselection.test.mjs) — 10 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); Default `pnpm test:e2e`; `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L22](../tests/story-generation-state-machine-reselection.test.mjs#L22) | opening and cancelling selection drafts never adds a shelf card; cancellation returns the current saved state | Standard |
| [L30](../tests/story-generation-state-machine-reselection.test.mjs#L30) | another story replaces one family card, leaves history intact, rejects old editing and replays without reactivation | Standard |
| [L44](../tests/story-generation-state-machine-reselection.test.mjs#L44) | a pause arriving after the picker opens is inherited at commit, and only explicit resume prepares | Standard |
| [L55](../tests/story-generation-state-machine-reselection.test.mjs#L55) | same source selection is a durable no-op, including replay after the draft is discarded | Standard |
| [L63](../tests/story-generation-state-machine-reselection.test.mjs#L63) | concurrent ordinary edit and replacement share one family CAS; stale choice remains inspectable | Standard |
| [L70](../tests/story-generation-state-machine-reselection.test.mjs#L70) | cancel follows another window current version and never revives a deleted latest version | Standard |
| [L76](../tests/story-generation-state-machine-reselection.test.mjs#L76) | `replacement of a ${stopped?'stopped':'failed active'} story inherits current control but clears only the new work` | Matrix/template |
| [L84](../tests/story-generation-state-machine-reselection.test.mjs#L84) | cancel after old in-flight completion returns its new saved checkpoint without resetting it | Standard |
| [L89](../tests/story-generation-state-machine-reselection.test.mjs#L89) | a matching title without verifiable source identity is not silently discarded as the current story | Standard |
| [L93](../tests/story-generation-state-machine-reselection.test.mjs#L93) | a committed replacement occupies its request ID across families and command kinds | Standard |

### tests/story-generation-state-machine.e2e.mjs

[tests/story-generation-state-machine.e2e.mjs](../tests/story-generation-state-machine.e2e.mjs) — 1 scenario declarations.

**Current selection:** Default `pnpm test:e2e`; `--gate=release`; `--gate=npm`; `pnpm test:full`.

**Execution surface:** Service/process/engine E2E; filename does not imply visible UI.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L8](../tests/story-generation-state-machine.e2e.mjs#L8) | lost HTTP recovery reply, restart and old replay cannot buy another attempt or revive a paused version | Standard |

### tests/story-lifecycle.playwright.e2e.mjs

[tests/story-lifecycle.playwright.e2e.mjs](../tests/story-lifecycle.playwright.e2e.mjs) — 9 scenario declarations.

**Current selection:** Default `pnpm test:e2e`; `pnpm test:full`.

**Execution surface:** Real browser E2E with isolated/controlled fixtures.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L15](../tests/story-lifecycle.playwright.e2e.mjs#L15) | STORY-LIFECYCLE-C001: create, wait, extract, edit preparation, confirm and read | options |
| [L16](../tests/story-lifecycle.playwright.e2e.mjs#L16) | STORY-LIFECYCLE-C002: all edit paths preserve one family, history and eligible images | options |
| [L51](../tests/story-lifecycle.playwright.e2e.mjs#L51) | STORY-LIFECYCLE-C003: pause drains in-flight work, refresh stays paused, explicit resume completes | options |
| [L59](../tests/story-lifecycle.playwright.e2e.mjs#L59) | STORY-LIFECYCLE-C004: failure survives observation and only a retry link authorizes a new attempt | options |
| [L67](../tests/story-lifecycle.playwright.e2e.mjs#L67) | STORY-LIFECYCLE-C005: replacement waits, cancel conserves parent, choosing commits one new version | options |
| [L78](../tests/story-lifecycle.playwright.e2e.mjs#L78) | `STORY-LIFECYCLE-C004-${manual?'review-edit':'review-override'}: blocked audit requires an explicit user decision before drawing` | Matrix/template; options |
| [L97](../tests/story-lifecycle.playwright.e2e.mjs#L97) | STORY-LIFECYCLE-C006: one workflow panel survives first artwork and is shared with reading while shelf stays a reader entry | options |
| [L136](../tests/story-lifecycle.playwright.e2e.mjs#L136) | STORY-LIFECYCLE-C007: shelf cards keep reading and the reader gear opens the workflow without generating | options |
| [L155](../tests/story-lifecycle.playwright.e2e.mjs#L155) | STORY-LIFECYCLE-C008: all shelf and reader entries share one settings layout through generation | options |

### tests/story-revision-flow.test.mjs

[tests/story-revision-flow.test.mjs](../tests/story-revision-flow.test.mjs) — 6 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L44](../tests/story-revision-flow.test.mjs#L44) | `saving manual review corrections re-audits first and ${passes?'continues drawing on approval':'keeps drawing blocked on rejection'}` | Matrix/template |
| [L65](../tests/story-revision-flow.test.mjs#L65) | review edit targets survive initial loading, reopening and ending selection without submitting | Standard |
| [L78](../tests/story-revision-flow.test.mjs#L78) | style-only blocked revisions retain one recoverable fault through replay and restart, then explicit acceptance completes once | Standard |
| [L102](../tests/story-revision-flow.test.mjs#L102) | completed story count edits remain a draft until confirmation starts the new version | Standard |
| [L119](../tests/story-revision-flow.test.mjs#L119) | retrying explicit production after a lost response uses the same version | Standard |
| [L132](../tests/story-revision-flow.test.mjs#L132) | paused edits stay stopped until resume applies them and continues generation | Standard |

## Reader, shelf and client UI contracts

Recommended trigger: Changed client UI or its API contracts; a small browser path for affected journeys; release creation-to-reading smoke.

Change surface: client/; relevant lib reader APIs/state; shelf and workflow components.

### tests/empty-library.test.mjs

[tests/empty-library.test.mjs](../tests/empty-library.test.mjs) — 2 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L21](../tests/empty-library.test.mjs#L21) | fresh/reopened libraries contain no stories or demo artwork and expose no studio endpoints | Standard |
| [L37](../tests/empty-library.test.mjs#L37) | saved stories, progress and uploaded media survive reopen through the standard media API | Standard |

### tests/reader-generation.test.mjs

[tests/reader-generation.test.mjs](../tests/reader-generation.test.mjs) — 43 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L23](../tests/reader-generation.test.mjs#L23) | client automatically recovers planning, source and each image without delays or repeating completed work | Standard |
| [L34](../tests/reader-generation.test.mjs#L34) | persistent failure exhausts two automatic retries and page changes cannot reset its budget | Standard |
| [L44](../tests/reader-generation.test.mjs#L44) | lost advance responses re-read the saved checkpoint and do not regenerate completed images | Standard |
| [L51](../tests/reader-generation.test.mjs#L51) | transport outages are bounded and leaving a story stops automatic recovery | Standard |
| [L60](../tests/reader-generation.test.mjs#L60) | running checkpoints are polled and leaving during a poll issues no further requests | Standard |
| [L67](../tests/reader-generation.test.mjs#L67) | sessions are owner-scoped and client retries reuse a single session | Standard |
| [L68](../tests/reader-generation.test.mjs#L68) | new stories have no rolling daily cap, including concurrent starts | Standard |
| [L81](../tests/reader-generation.test.mjs#L81) | concurrent advances cannot duplicate a paid planning request | Standard |
| [L82](../tests/reader-generation.test.mjs#L82) | only requested scenes are generated; completed scenes are reused and progress is separate | Standard |
| [L83](../tests/reader-generation.test.mjs#L83) | paid image retries resume immediately when requested and reuse saved work | Standard |
| [L100](../tests/reader-generation.test.mjs#L100) | planning can recover after the former cap and only one concurrent retry acquires the checkpoint | Standard |
| [L115](../tests/reader-generation.test.mjs#L115) | stale requests become explicit failures instead of silently issuing another call | Standard |
| [L116](../tests/reader-generation.test.mjs#L116) | an outdated checkpoint cannot acquire the same completed step again | Standard |
| [L119](../tests/reader-generation.test.mjs#L119) | generation saves the original before drawing and keeps it on later checkpoints and reads | Standard |
| [L132](../tests/reader-generation.test.mjs#L132) | unavailable original blocks summary and planning, and recovery saves each paid result once | Standard |
| [L143](../tests/reader-generation.test.mjs#L143) | legacy backfill preserves images and progress and rejects an outdated document or active generation | Standard |
| [L154](../tests/reader-generation.test.mjs#L154) | saving a recovered original clears source failure while preserving an image failure for manual retry | Standard |
| [L165](../tests/reader-generation.test.mjs#L165) | source recovery remains explicit after repeated outages and never repeats the paid plan | Standard |
| [L188](../tests/reader-generation.test.mjs#L188) | `legacy URL ${length} prepares source and summary before its directory and reuses them` | Matrix/template |
| [L204](../tests/reader-generation.test.mjs#L204) | a URL without a verifiable original cannot start summary or directory inference | Standard |
| [L210](../tests/reader-generation.test.mjs#L210) | Gemini allows fifteen minutes for both storyboard and image generation | Standard |
| [L219](../tests/reader-generation.test.mjs#L219) | Gemini plans structured scenes and Nano Banana carries the first picture into subsequent scenes | Standard |
| [L235](../tests/reader-generation.test.mjs#L235) | Gemini failures are redacted, not retried, and never fall back to a different paid provider | Standard |
| [L244](../tests/reader-generation.test.mjs#L244) | book suggestions preserve selected book and custom theme; stale URL fields are ignored | Standard |
| [L249](../tests/reader-generation.test.mjs#L249) | URL suggestions and plans fail closed when source retrieval is absent or failed | Standard |
| [L259](../tests/reader-generation.test.mjs#L259) | Nano Banana stores the actual MIME type and refuses missing anchors or invalid images | Standard |
| [L268](../tests/reader-generation.test.mjs#L268) | blocked, truncated and malformed output never becomes a ready page or plan | Standard |
| [L277](../tests/reader-generation.test.mjs#L277) | narration stays off even when an old client or saved session requests it | Standard |
| [L289](../tests/reader-generation.test.mjs#L289) | chosen art direction persists across resume and reaches every image call | Standard |
| [L303](../tests/reader-generation.test.mjs#L303) | new art styles pass validation and reach planning and image generation without pencil fallback | Standard |
| [L316](../tests/reader-generation.test.mjs#L316) | five story choices are requested and accepted without inventing a missing source | Standard |
| [L328](../tests/reader-generation.test.mjs#L328) | production requirements persist on the story and reach planning and each picture | Standard |
| [L347](../tests/reader-generation.test.mjs#L347) | new batches pass exclusions to Gemini and remove repeated or renamed titles | Standard |
| [L354](../tests/reader-generation.test.mjs#L354) | soft deletion is owner-scoped, durable and does not erase content or block new stories | Standard |
| [L370](../tests/reader-generation.test.mjs#L370) | deleting during a paid step retains its result but cannot resume or resurrect the story | Standard |
| [L379](../tests/reader-generation.test.mjs#L379) | unknown retired identities cannot enter current reader library actions | Standard |
| [L388](../tests/reader-generation.test.mjs#L388) | restoring preserves content and progress without reactivating deleted generation | Standard |
| [L400](../tests/reader-generation.test.mjs#L400) | restoring a current story leaves the other owner’s deletion markers untouched | Standard |
| [L424](../tests/reader-generation.test.mjs#L424) | preparation recommends each chosen story and durably reuses its art on reselection | Standard |
| [L436](../tests/reader-generation.test.mjs#L436) | an in-flight art result preserves a manual draft and concurrently appended search results | Standard |
| [L451](../tests/reader-generation.test.mjs#L451) | a saved manual style survives later story recommendations | Standard |
| [L459](../tests/reader-generation.test.mjs#L459) | frame recommendation retries reuse saved art and art failures never pretend a default was recommended | Standard |
| [L471](../tests/reader-generation.test.mjs#L471) | a replaced generation rejects an in-flight art result | Standard |

### tests/reader-image-health.test.mjs

[tests/reader-image-health.test.mjs](../tests/reader-image-health.test.mjs) — 2 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L7](../tests/reader-image-health.test.mjs#L7) | `offline image health decodes ${name}` | Matrix/template |
| [L8](../tests/reader-image-health.test.mjs#L8) | `${format}: valid dimensions cannot hide corrupt pixel data or reuse a healthy cache entry` | Matrix/template |

### tests/reader-interaction.test.mjs

[tests/reader-interaction.test.mjs](../tests/reader-interaction.test.mjs) — 12 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L6](../tests/reader-interaction.test.mjs#L6) | scene edge clicks use the outer quarters of the reader, not the viewport | Standard |
| [L22](../tests/reader-interaction.test.mjs#L22) | trackpad rebound cannot reverse or skip a page within the same gesture | Standard |
| [L29](../tests/reader-interaction.test.mjs#L29) | mouse wheel units, small movements and cross-axis jitter are handled consistently | Standard |
| [L36](../tests/reader-interaction.test.mjs#L36) | themes share source-faithful production defaults while reader-written requirements remain intact | Standard |
| [L56](../tests/reader-interaction.test.mjs#L56) | batch history isolates book, custom source and theme without splitting on style or length | Standard |
| [L63](../tests/reader-interaction.test.mjs#L63) | PDF refuses incomplete stories and wraps Chinese, newlines and long links without losing content | Standard |
| [L75](../tests/reader-interaction.test.mjs#L75) | home hero resumes the last viewed story and stays empty for new or missing history | Standard |
| [L86](../tests/reader-interaction.test.mjs#L86) | touch swipes support four directions while ignoring taps and ambiguous diagonals | Standard |
| [L93](../tests/reader-interaction.test.mjs#L93) | recent carousel keeps ten distinct readable stories, newest reading first, and resumes each page | Standard |
| [L105](../tests/reader-interaction.test.mjs#L105) | server favorite resets replace newer browser flags without discarding the latest reading position | Standard |
| [L113](../tests/reader-interaction.test.mjs#L113) | published and generated progress hydration reconcile favorite flags regardless of response order | Standard |
| [L125](../tests/reader-interaction.test.mjs#L125) | direct source selection drops inherited theme directions and preserves authored production requirements | Standard |

### tests/reader-production-client.test.mjs

[tests/reader-production-client.test.mjs](../tests/reader-production-client.test.mjs) — 20 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L6](../tests/reader-production-client.test.mjs#L6) | LAN HTTP without crypto.randomUUID still automatically requests the next story with a valid UUID | Standard |
| [L15](../tests/reader-production-client.test.mjs#L15) | automatic discovery stops on an uncertain POST response and releases its viewer without repeating it | Standard |
| [L22](../tests/reader-production-client.test.mjs#L22) | empty, failed, paused, capped and selected pickers never automatically request another story | Standard |
| [L30](../tests/reader-production-client.test.mjs#L30) | a full buffer keeps its viewer alive, page changes update demand, and leaving releases only that viewer | Standard |
| [L39](../tests/reader-production-client.test.mjs#L39) | ordinary failure observation never automatically retries paid work | Standard |
| [L43](../tests/reader-production-client.test.mjs#L43) | review continuation sends one explicit immutable fault authorization | Standard |
| [L51](../tests/reader-production-client.test.mjs#L51) | accepted but lost recovery responses replay the same grant after a new failure | Standard |
| [L58](../tests/reader-production-client.test.mjs#L58) | connection failure after starting demand still sends leave; lost leave falls back to server lease expiry | Standard |
| [L64](../tests/reader-production-client.test.mjs#L64) | awaiting count confirmation releases demand without issuing storyboard or image requests | Standard |
| [L70](../tests/reader-production-client.test.mjs#L70) | inspecting stopped and failed checkpoints only polls snapshots and reflects external changes | Standard |
| [L80](../tests/reader-production-client.test.mjs#L80) | inspection connection errors never dispatch work and late snapshots cannot update a closed dialog | Standard |
| [L87](../tests/reader-production-client.test.mjs#L87) | inspecting a count confirmation releases the observation so the user can choose a frame count | Standard |
| [L92](../tests/reader-production-client.test.mjs#L92) | explicit recovery retains its request ID across transport loss and reads progress | Standard |
| [L98](../tests/reader-production-client.test.mjs#L98) | `viewer loop stops dispatch and automatic retries for ${JSON.stringify(fields)}` | Matrix/template |
| [L106](../tests/reader-production-client.test.mjs#L106) | mode changes and manual resume preserve failed stories as observations until explicit Retry | Standard |
| [L123](../tests/reader-production-client.test.mjs#L123) | an open active story reports its page for priority, follows page changes and leaves on exit | Standard |
| [L134](../tests/reader-production-client.test.mjs#L134) | priority reports clamp a stale page and use page 0 before the first image exists | Standard |
| [L142](../tests/reader-production-client.test.mjs#L142) | a story that is not actively generating never reports a page | Standard |
| [L150](../tests/reader-production-client.test.mjs#L150) | a failed or hung priority report never interrupts status updates or exit | Standard |
| [L158](../tests/reader-production-client.test.mjs#L158) | a lost image is read only until an explicit scoped recovery | Standard |

### tests/reader-prompt-format.test.mjs

[tests/reader-prompt-format.test.mjs](../tests/reader-prompt-format.test.mjs) — 7 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L21](../tests/reader-prompt-format.test.mjs#L21) | task, numbered rule groups and boundary/output labels use readable paragraphs and lists | Standard |
| [L28](../tests/reader-prompt-format.test.mjs#L28) | existing step numbering, quoted phrases, numeric limits and JSON field identifiers retain wording | Standard |
| [L33](../tests/reader-prompt-format.test.mjs#L33) | all active system rule text and section order remain identical after removing layout markers | Standard |
| [L37](../tests/reader-prompt-format.test.mjs#L37) | plain native instructions and empty sections need no invented content | Standard |
| [L42](../tests/reader-prompt-format.test.mjs#L42) | new previews/captures share the dispatch layout while historical records and arbitrary inputs stay exact | Standard |
| [L48](../tests/reader-prompt-format.test.mjs#L48) | archives share only byte-identical historical system rules and preserve every actual input and receipt origin | Standard |
| [L71](../tests/reader-prompt-format.test.mjs#L71) | deduplicating repeated system rules avoids the 1 MiB metadata limit without dropping call inputs | Standard |

### tests/reader-request.test.mjs

[tests/reader-request.test.mjs](../tests/reader-request.test.mjs) — 8 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L7](../tests/reader-request.test.mjs#L7) | a read recovers from a disconnected server and a restarting proxy | Standard |
| [L19](../tests/reader-request.test.mjs#L19) | an interrupted JSON body is retried before displaying a loading error | Standard |
| [L24](../tests/reader-request.test.mjs#L24) | persistent read failures stop after a bounded number of attempts | Standard |
| [L29](../tests/reader-request.test.mjs#L29) | `a stalled ${body?'JSON body':'connection'} times out and the next refresh can succeed` | Matrix/template |
| [L48](../tests/reader-request.test.mjs#L48) | read retries share a deadline instead of extending a stalled refresh indefinitely | Standard |
| [L62](../tests/reader-request.test.mjs#L62) | missing or unauthorized stories are not retried | Standard |
| [L69](../tests/reader-request.test.mjs#L69) | generation, deletion and progress writes are never replayed after failures | Standard |
| [L76](../tests/reader-request.test.mjs#L76) | writes retain multipart bodies and server error messages | Standard |

### tests/reader-snapshots.test.mjs

[tests/reader-snapshots.test.mjs](../tests/reader-snapshots.test.mjs) — 4 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L6](../tests/reader-snapshots.test.mjs#L6) | identical poll rows return the previous array | Standard |
| [L12](../tests/reader-snapshots.test.mjs#L12) | changed rows are replaced while unchanged rows keep their identity | Standard |
| [L21](../tests/reader-snapshots.test.mjs#L21) | reordered, added and removed rows produce a new array | Standard |
| [L29](../tests/reader-snapshots.test.mjs#L29) | single snapshots keep the previous value only when equal | Standard |

### tests/reader-source-runtime.test.mjs

[tests/reader-source-runtime.test.mjs](../tests/reader-source-runtime.test.mjs) — 2 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L13](../tests/reader-source-runtime.test.mjs#L13) | uncached lookup uses native Node fetch and reads the selected chapter | Standard |
| [L20](../tests/reader-source-runtime.test.mjs#L20) | native fetch does not follow upstream redirects to another endpoint | Standard |

### tests/reader-source.test.mjs

[tests/reader-source.test.mjs](../tests/reader-source.test.mjs) — 11 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L9](../tests/reader-source.test.mjs#L9) | numbered citations resolve to the edition chapter title instead of prose page names | Standard |
| [L19](../tests/reader-source.test.mjs#L19) | the two deployed failures have revision-linked originals during a complete source outage | Standard |
| [L28](../tests/reader-source.test.mjs#L28) | numbered chapters can be fetched and accepted without invoking search | Standard |
| [L37](../tests/reader-source.test.mjs#L37) | generation persists source text and future calls reuse the story cache without external retrieval | Standard |
| [L46](../tests/reader-source.test.mjs#L46) | existing generated Cao E story gains verified original without regenerating or relying on the inaccurate item number | Standard |
| [L55](../tests/reader-source.test.mjs#L55) | original chapter is retrieved as text from a matching book and traditional titles are recognized | Standard |
| [L62](../tests/reader-source.test.mjs#L62) | all existing story topics can read checked excerpts even while the remote API is unavailable | Standard |
| [L69](../tests/reader-source.test.mjs#L69) | search fallback requires the same book and a matching chapter heading | Standard |
| [L74](../tests/reader-source.test.mjs#L74) | unavailable or mismatched source stays explicit and never becomes invented original text | Standard |
| [L82](../tests/reader-source.test.mjs#L82) | source failures distinguish network, timeout and invalid response without exposing upstream details | Standard |
| [L88](../tests/reader-source.test.mjs#L88) | custom URLs cannot turn original lookup into arbitrary server-side fetches | Standard |

### tests/reader-startup.e2e.mjs

[tests/reader-startup.e2e.mjs](../tests/reader-startup.e2e.mjs) — 1 scenario declarations.

**Current selection:** Default `pnpm test:e2e`; `pnpm test:full`.

**Execution surface:** Real browser E2E with isolated/controlled fixtures.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L9](../tests/reader-startup.e2e.mjs#L9) | `startup waits for ${delayed}, reads the library once, and ignores cached studio history` | Matrix/template |

### tests/reading-cache.test.mjs

[tests/reading-cache.test.mjs](../tests/reading-cache.test.mjs) — 3 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L12](../tests/reading-cache.test.mjs#L12) | valid inventory keeps every current revision/trash payload and shared media, removes retired/foreign payloads | Standard |
| [L18](../tests/reading-cache.test.mjs#L18) | 'incomplete or invalid metadata never changes caches: '+JSON.stringify(inventory) | Matrix/template |
| [L21](../tests/reading-cache.test.mjs#L21) | a valid empty inventory clears retired payloads while keeping shared media | Standard |

### tests/recent-stories-ui.test.mjs

[tests/recent-stories-ui.test.mjs](../tests/recent-stories-ui.test.mjs) — 3 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L18](../tests/recent-stories-ui.test.mjs#L18) | loading hides both cached story cards and the first-use empty state | Standard |
| [L27](../tests/recent-stories-ui.test.mjs#L27) | settled history shows the resume card or the first-use empty state | Standard |
| [L37](../tests/recent-stories-ui.test.mjs#L37) | a story read to its last frame offers a restart instead of resuming | Standard |

### tests/review-history-ui.test.mjs

[tests/review-history-ui.test.mjs](../tests/review-history-ui.test.mjs) — 4 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L12](../tests/review-history-ui.test.mjs#L12) | unknown acceptance results are visible and do not look like an approved audit | Standard |
| [L17](../tests/review-history-ui.test.mjs#L17) | old missing text and unordered entries are explicit; overrides never become made-up events | Standard |
| [L22](../tests/review-history-ui.test.mjs#L22) | structural history shows old and new frame numbers, captions and expandable prompts | Standard |
| [L26](../tests/review-history-ui.test.mjs#L26) | empty current versions explain the parent option and report text remains escaped | Standard |

### tests/shelf-art-style.test.mjs

[tests/shelf-art-style.test.mjs](../tests/shelf-art-style.test.mjs) — 2 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L17](../tests/shelf-art-style.test.mjs#L17) | saved setup art style drives shelf tags, search and grouping before confirmation | Standard |
| [L42](../tests/shelf-art-style.test.mjs#L42) | shelf falls back to the production style without a draft and ignores obsolete confirmed drafts | Standard |

### tests/shelf-browser.test.mjs

[tests/shelf-browser.test.mjs](../tests/shelf-browser.test.mjs) — 3 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L10](../tests/shelf-browser.test.mjs#L10) | search matches title, source book, theme and art style, including combined keywords | Standard |
| [L17](../tests/shelf-browser.test.mjs#L17) | book groups collect matching stories in original reading order and omit empty search groups | Standard |
| [L24](../tests/shelf-browser.test.mjs#L24) | theme, art style and processing groups preserve each story and its reading order | Standard |

### tests/shelf-favorites.test.mjs

[tests/shelf-favorites.test.mjs](../tests/shelf-favorites.test.mjs) — 2 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L10](../tests/shelf-favorites.test.mjs#L10) | pending and readable generated stories can be favorited without changing progress or starting generation | Standard |
| [L34](../tests/shelf-favorites.test.mjs#L34) | current favorites preserve existing reading progress and reject cross-origin, deleted and malformed requests | Standard |

### tests/shelf-generation.test.mjs

[tests/shelf-generation.test.mjs](../tests/shelf-generation.test.mjs) — 5 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L9](../tests/shelf-generation.test.mjs#L9) | shelf actions distinguish execution, queueing, user decisions, failure and pause | Standard |
| [L34](../tests/shelf-generation.test.mjs#L34) | shelf refresh reports running and queued work without dispatch or viewer renewal | Standard |
| [L62](../tests/shelf-generation.test.mjs#L62) | shelf refresh exposes choice and failure states without retrying | Standard |
| [L76](../tests/shelf-generation.test.mjs#L76) | viewing a saved failure preserves its attempt count until an explicit retry resumes generation | Standard |
| [L95](../tests/shelf-generation.test.mjs#L95) | production rows list user decisions and failures before running, queued and paused work, keeping order within a status | Standard |

### tests/shelf-layout-ui.test.mjs

[tests/shelf-layout-ui.test.mjs](../tests/shelf-layout-ui.test.mjs) — 4 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L20](../tests/shelf-layout-ui.test.mjs#L20) | unfinished productions come first as rows, ordered by what needs the user, each with at most one control | Standard |
| [L40](../tests/shelf-layout-ui.test.mjs#L40) | a long production list shows needs-you rows plus up to five in total, and a search shows every match | Standard |
| [L51](../tests/shelf-layout-ui.test.mjs#L51) | readable cards are the same size in single-story groups and show finished reading | Standard |
| [L67](../tests/shelf-layout-ui.test.mjs#L67) | filters apply to both regions; production-only shelves explain where stories will appear | Standard |

### tests/shelf-retry-ui.test.mjs

[tests/shelf-retry-ui.test.mjs](../tests/shelf-retry-ui.test.mjs) — 5 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L25](../tests/shelf-retry-ui.test.mjs#L25) | failed compact, full-width and pending cards show one retry action instead of pause | Standard |
| [L34](../tests/shelf-retry-ui.test.mjs#L34) | retry dispatches the existing session and is disabled during conflicting shelf operations | Standard |
| [L43](../tests/shelf-retry-ui.test.mjs#L43) | manual pause and stop retain resume; running cards retain pause; completed cards have neither | Standard |
| [L54](../tests/shelf-retry-ui.test.mjs#L54) | a failure with no retryable step does not offer pause or dispatch recovery | Standard |
| [L60](../tests/shelf-retry-ui.test.mjs#L60) | cover overlay actions are independent while the cover and title keep reading | Standard |

### tests/story-publication-ui.test.mjs

[tests/story-publication-ui.test.mjs](../tests/story-publication-ui.test.mjs) — 10 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L45](../tests/story-publication-ui.test.mjs#L45) | settings show the resolved default author, refresh on return and keep explicit work credits | Standard |
| [L62](../tests/story-publication-ui.test.mjs#L62) | settings distinguish a failed lookup from an unsigned work and allow retry | Standard |
| [L71](../tests/story-publication-ui.test.mjs#L71) | late default reads cannot replace a newer name or flash the previous story author | Standard |
| [L83](../tests/story-publication-ui.test.mjs#L83) | restore fetches current defaults, locks duplicate requests and changes all draft fields without saving | Standard |
| [L99](../tests/story-publication-ui.test.mjs#L99) | a failed restore keeps local edits and retry reads latest defaults; missing defaults restore to blank | Standard |
| [L114](../tests/story-publication-ui.test.mjs#L114) | watermark sizing shows a 24px default and saves an independent single-story value | Standard |
| [L125](../tests/story-publication-ui.test.mjs#L125) | `${format}: every output attempt rechecks defaults before unsigned consent` | Matrix/template |
| [L145](../tests/story-publication-ui.test.mjs#L145) | `${format}: live defaults fill blank work fields, refresh on repeated download and preserve explicit overrides` | Matrix/template |
| [L159](../tests/story-publication-ui.test.mjs#L159) | preflight blocks duplicate clicks, fails without exporting on read errors and can retry | Standard |
| [L171](../tests/story-publication-ui.test.mjs#L171) | continuing from unsigned confirmation rechecks a default name saved while the dialog was open | Standard |

### tests/story-requirements-ui.test.mjs

[tests/story-requirements-ui.test.mjs](../tests/story-requirements-ui.test.mjs) — 4 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L13](../tests/story-requirements-ui.test.mjs#L13) | production and acceptance are sibling links/tabs; acceptance editing is an independent local patch | Standard |
| [L20](../tests/story-requirements-ui.test.mjs#L20) | prompt history distinguishes inherited/current records, previews and missing history; model data is escaped | Standard |
| [L26](../tests/story-requirements-ui.test.mjs#L26) | an unknown criterion without fabricated frame issues still exposes the acceptance repair route | Standard |
| [L39](../tests/story-requirements-ui.test.mjs#L39) | flow recovery and exits are links while controls outside the flow retain their presentation | Standard |

### tests/story-stage-feedback.test.mjs

[tests/story-stage-feedback.test.mjs](../tests/story-stage-feedback.test.mjs) — 16 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L21](../tests/story-stage-feedback.test.mjs#L21) | the prominent heading names the story and progress shares the navigation row below | Standard |
| [L36](../tests/story-stage-feedback.test.mjs#L36) | embedded flows omit the repeated story name while retaining progress and failure recovery | Standard |
| [L47](../tests/story-stage-feedback.test.mjs#L47) | a planning failure and retry are inside the planning step, once | Standard |
| [L55](../tests/story-stage-feedback.test.mjs#L55) | failed work replaces pause with one retry in the checkpoint footer after inspection links | Standard |
| [L71](../tests/story-stage-feedback.test.mjs#L71) | shared production components place controls in the image card and history in the completed recheck | Standard |
| [L89](../tests/story-stage-feedback.test.mjs#L89) | independent faults keep their own stage, saved-image recovery and paused explanations | Standard |
| [L105](../tests/story-stage-feedback.test.mjs#L105) | review issue details and next actions live in the failed repair checkpoint | Standard |
| [L115](../tests/story-stage-feedback.test.mjs#L115) | recovering image errors remain visible beneath images while work continues | Standard |
| [L123](../tests/story-stage-feedback.test.mjs#L123) | confirmation puts its start action directly under the confirmation step | Standard |
| [L135](../tests/story-stage-feedback.test.mjs#L135) | confirmation owns all four settings while extraction and preparation retain their real timing | Standard |
| [L171](../tests/story-stage-feedback.test.mjs#L171) | active steps show only their timeout countdown below the current step | Standard |
| [L188](../tests/story-stage-feedback.test.mjs#L188) | completed steps retain their own final duration as the current step changes or finishes | Standard |
| [L204](../tests/story-stage-feedback.test.mjs#L204) | active recovery is concise, retains the old error in a closed disclosure and has no retry button | Standard |
| [L215](../tests/story-stage-feedback.test.mjs#L215) | finished steps contain only their name, result and final time, and flow operations are links | Standard |
| [L228](../tests/story-stage-feedback.test.mjs#L228) | flow links prevent fragment navigation and respect both local and fieldset locks | Standard |
| [L236](../tests/story-stage-feedback.test.mjs#L236) | running countdown and final duration occupy the same right-side metadata slot | Standard |

### tests/story-title-ui.test.mjs

[tests/story-title-ui.test.mjs](../tests/story-title-ui.test.mjs) — 2 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L26](../tests/story-title-ui.test.mjs#L26) | cancel never saves; whitespace is rejected; a failed save keeps the draft and can be retried once | Standard |
| [L51](../tests/story-title-ui.test.mjs#L51) | source-only sessions can open naming and their saved display names appear in shelf search | Standard |

### tests/storyboard-ui.test.mjs

[tests/storyboard-ui.test.mjs](../tests/storyboard-ui.test.mjs) — 2 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L12](../tests/storyboard-ui.test.mjs#L12) | style-only revision UI preserves review progress and offers drawing without a fresh audit | Standard |
| [L27](../tests/storyboard-ui.test.mjs#L27) | reader renders saved directory, batch range, honest progress and automatic frame controls | Standard |

### tests/unified-story-setup-ui.test.mjs

[tests/unified-story-setup-ui.test.mjs](../tests/unified-story-setup-ui.test.mjs) — 1 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L9](../tests/unified-story-setup-ui.test.mjs#L9) | discovery stays in the picker and selection opens one continuous story flow | Standard |

## Library storage, migrations and server boundaries

Recommended trigger: Changed database/migration/library/server boundaries; before release. Keep small version-refusal and data-isolation guards on every code PR.

Change surface: server/database*; db/; drizzle/; repository/media; ownership; HTTP/app; library maintenance.

### tests/diagnostics.test.mjs

[tests/diagnostics.test.mjs](../tests/diagnostics.test.mjs) — 6 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); Default `pnpm test:e2e`; `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

Platform branches occur in this file; case options and fixture code determine applicability.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L13](../tests/diagnostics.test.mjs#L13) | whitelist strips secrets, arbitrary messages/paths and hostile stored records; rotation stays bounded | Standard |
| [L24](../tests/diagnostics.test.mjs#L24) | logging failures never throw and symlinks cannot write or leak outside the library | Standard |
| [L32](../tests/diagnostics.test.mjs#L32) | known console events are saved safely and capture is removed on shutdown | Standard |
| [L38](../tests/diagnostics.test.mjs#L38) | production Gemini failures persist safe rejection details and survive diagnostic export | Standard |
| [L61](../tests/diagnostics.test.mjs#L61) | real CLI saves lifecycle events and exports a new metadata-only report, including corrupt libraries | Standard |
| [L71](../tests/diagnostics.test.mjs#L71) | desktop lifecycle persists diagnostics without forwarding raw stderr or using credentials | Standard |

### tests/library-directory.test.mjs

[tests/library-directory.test.mjs](../tests/library-directory.test.mjs) — 3 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L10](../tests/library-directory.test.mjs#L10) | native platform defaults share the desktop app-data library | Standard |
| [L17](../tests/library-directory.test.mjs#L17) | saved desktop library is read without a credentials table and an explicit override wins | Standard |
| [L25](../tests/library-directory.test.mjs#L25) | malformed saved settings fail without silently switching libraries or echoing private values | Standard |

### tests/library-maintenance.test.mjs

[tests/library-maintenance.test.mjs](../tests/library-maintenance.test.mjs) — 4 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); Default `pnpm test:e2e`; `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

Platform branches occur in this file; case options and fixture code determine applicability.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L22](../tests/library-maintenance.test.mjs#L22) | backup hashes complete SQLite/media and restore is exact without replacing any target | Standard |
| [L31](../tests/library-maintenance.test.mjs#L31) | 'verification/restore reject '+kind+' without publishing a partial library' | Matrix/template |
| [L43](../tests/library-maintenance.test.mjs#L43) | pending migration creates verified old-schema backup once; failed snapshots do not change the source | Standard |
| [L55](../tests/library-maintenance.test.mjs#L55) | CLI maintenance refuses busy library and works without provider setup, preserving full production checkpoints | Standard |

### tests/library-recovery.test.mjs

[tests/library-recovery.test.mjs](../tests/library-recovery.test.mjs) — 3 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L9](../tests/library-recovery.test.mjs#L9) | deleted generated stories retain titles, favorite flags and exact checkpoints through passive restoration | Standard |
| [L30](../tests/library-recovery.test.mjs#L30) | recovery metadata does not expose foreign generated titles and supports unfinished stories while excluding retired studio records | Standard |
| [L50](../tests/library-recovery.test.mjs#L50) | an older restored story remains listed beyond 80 entries without starting production | Standard |

### tests/local-server.test.mjs

[tests/local-server.test.mjs](../tests/local-server.test.mjs) — 10 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L31](../tests/local-server.test.mjs#L31) | [storage/migration] SQLite reopen preserves current reader checkpoints, media, owner identity and recovery | Standard |
| [L48](../tests/local-server.test.mjs#L48) | [storage/migration] failed migrations roll back DDL and can retry after the migration is corrected | Standard |
| [L55](../tests/local-server.test.mjs#L55) | [HTTP/security] HTTP serves SPA deep links and binary uploads, blocks origin writes, and never serves private data | Standard |
| [L70](../tests/local-server.test.mjs#L70) | [HTTP/security] media validates keys, MIME and symlinks; replacing files is atomic and leaves no temporary file | Standard |
| [L80](../tests/local-server.test.mjs#L80) | [queue/persistence] real SQLite locks prevent duplicate paid requests through concurrent REST advances and survive restart | Standard |
| [L110](../tests/local-server.test.mjs#L110) | [storage/migration] offline importer preserves records, identities, media keys and source bytes and prevents migration replay | Standard |
| [L119](../tests/local-server.test.mjs#L119) | [storage/migration] offline importer upgrades a pre-summary legacy database without requiring the local-only migration | Standard |
| [L125](../tests/local-server.test.mjs#L125) | [storage/migration] import failure keeps destination absent and rejects live WAL, missing blobs and unsupported multipart objects | Standard |
| [L136](../tests/local-server.test.mjs#L136) | [storage/migration] retired studio rows are discarded before reopen and have no runtime API | Standard |
| [L143](../tests/local-server.test.mjs#L143) | [storage/migration] single-owner shelf returns more than 80 stories and keeps hidden stories excluded | Standard |

### tests/story-storage-consolidation.e2e.mjs

[tests/story-storage-consolidation.e2e.mjs](../tests/story-storage-consolidation.e2e.mjs) — 1 scenario declarations.

**Current selection:** Default `pnpm test:e2e`; `pnpm test:full`.

**Execution surface:** Real browser E2E with isolated/controlled fixtures.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L8](../tests/story-storage-consolidation.e2e.mjs#L8) | startup inventory removes retired offline payloads and retains hidden current versions, trash and shared media | Standard |

### tests/story-storage-consolidation.test.mjs

[tests/story-storage-consolidation.test.mjs](../tests/story-storage-consolidation.test.mjs) — 16 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L39](../tests/story-storage-consolidation.test.mjs#L39) | fresh and mixed upgrades converge; all owners/revisions/states and current/shared/unknown bytes survive | Standard |
| [L65](../tests/story-storage-consolidation.test.mjs#L65) | 'exception at '+point+' restores original DB and media, then retries once' | Matrix/template |
| [L70](../tests/story-storage-consolidation.test.mjs#L70) | 'process death at '+point+' recovers before access, including missing live DB' | Matrix/template |
| [L80](../tests/story-storage-consolidation.test.mjs#L80) | future schema and recovery formats refuse before runtime files or backups are written | Standard |
| [L85](../tests/story-storage-consolidation.test.mjs#L85) | a separate process cannot enter the brief gate during publication | Standard |
| [L92](../tests/story-storage-consolidation.test.mjs#L92) | normal restore upgrades before publication and current-use legacy art reads through HTTP and Node export | Standard |
| [L108](../tests/story-storage-consolidation.test.mjs#L108) | a library containing only current stories preserves all raw row values and creates one verified backup | Standard |
| [L113](../tests/story-storage-consolidation.test.mjs#L113) | mode+' blocks purge and restores original state with a backup path' | Matrix/template |
| [L120](../tests/story-storage-consolidation.test.mjs#L120) | a current saved original follows absolute library media references and protects their bytes | Standard |
| [L125](../tests/story-storage-consolidation.test.mjs#L125) | titles, prompts and original prose that look like filenames do not become missing-media requirements | Standard |
| [L131](../tests/story-storage-consolidation.test.mjs#L131) | relocated restore protects absolute saved-original references without consulting the original path | Standard |
| [L138](../tests/story-storage-consolidation.test.mjs#L138) | the format declaration names the newest bundled migration for native readers | Standard |
| [L142](../tests/story-storage-consolidation.test.mjs#L142) | a consolidated library applies a later migration in place after a verified backup | Standard |
| [L155](../tests/story-storage-consolidation.test.mjs#L155) | a failed restore publishes nothing and leaves no staging snapshot | Standard |
| [L168](../tests/story-storage-consolidation.test.mjs#L168) | fresh and upgraded libraries refuse pre-0.8 seeding while current opens keep seeding | Standard |
| [L173](../tests/story-storage-consolidation.test.mjs#L173) | a library consolidated before the refusal guard receives it in place | Standard |

## CLI startup, settings and configuration

Recommended trigger: Changed CLI/settings/config/server-startup code or Node; release/npm smoke. Full PTY on supported Unix environments when changed.

Change surface: server/cli*; system/provider settings; startup; shared native configuration; Node/toolchain.

### tests/browser-provider-settings.e2e.mjs

[tests/browser-provider-settings.e2e.mjs](../tests/browser-provider-settings.e2e.mjs) — 1 scenario declarations.

**Current selection:** Default `pnpm test:e2e`; `pnpm test:full`.

**Execution surface:** Service/process/engine E2E; filename does not imply visible UI.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L11](../tests/browser-provider-settings.e2e.mjs#L11) | browser settings save through actual Vite/backend, preserve overrides and adopt changes only after restart | {timeout:60000} |

### tests/browser-provider-settings.test.mjs

[tests/browser-provider-settings.test.mjs](../tests/browser-provider-settings.test.mjs) — 14 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

Platform branches occur in this file; case options and fixture code determine applicability.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L35](../tests/browser-provider-settings.test.mjs#L35) | local view and revision-checked save preserve unrelated shared settings and immutable running models | Standard |
| [L45](../tests/browser-provider-settings.test.mjs#L45) | provider profiles and explicit key keep/replace/remove never return credentials | Standard |
| [L56](../tests/browser-provider-settings.test.mjs#L56) | partial provider, model, per-task and key updates preserve omitted custom profiles and reasoning | Standard |
| [L69](../tests/browser-provider-settings.test.mjs#L69) | invocation overrides report names only and drift follows the effective active provider | Standard |
| [L77](../tests/browser-provider-settings.test.mjs#L77) | stale, malformed, invalid effort and unrelated-field writes fail without partial settings or key updates | Standard |
| [L91](../tests/browser-provider-settings.test.mjs#L91) | real peer, exact loopback hosts, origins and fetch-site guard settings without trusting forwarded headers | Standard |
| [L106](../tests/browser-provider-settings.test.mjs#L106) | Vite guard rejects original LAN peers even through normalized proxy path variants | Standard |
| [L117](../tests/browser-provider-settings.test.mjs#L117) | development settings fail closed behind legacy proxies or missing proof, while CLI stays direct | Standard |
| [L132](../tests/browser-provider-settings.test.mjs#L132) | HTTP adapter supplies socket metadata; forwarded headers cannot change the actual peer | Standard |
| [L139](../tests/browser-provider-settings.test.mjs#L139) | browser CLI edits share the production store and leave runtime unchanged until restart | Standard |
| [L148](../tests/browser-provider-settings.test.mjs#L148) | Codex settings load and save without launching a slow or unavailable CLI readiness probe | {skip:process.platform==='win32'} |
| [L159](../tests/browser-provider-settings.test.mjs#L159) | fully explicit CLI startup survives a corrupt saved store; settings failures stay safe | Standard |
| [L165](../tests/browser-provider-settings.test.mjs#L165) | generic reader and native desktop listeners do not expose browser credential settings | Standard |
| [L173](../tests/browser-provider-settings.test.mjs#L173) | separate image provider saves its own key, clears with null and reports both runtime sides | Standard |

### tests/cli-library.test.mjs

[tests/cli-library.test.mjs](../tests/cli-library.test.mjs) — 12 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

Platform branches occur in this file; case options and fixture code determine applicability.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L31](../tests/cli-library.test.mjs#L31) | saved desktop directory wins without prompting even before it exists, with settings read-only | Standard |
| [L41](../tests/cli-library.test.mjs#L41) | first-run confirmation is remembered, but desktop settings take priority later | Standard |
| [L51](../tests/cli-library.test.mjs#L51) | accepting suggested directory stores only the directory in the shared settings database | Standard |
| [L56](../tests/cli-library.test.mjs#L56) | an existing default desktop library is found without a question or CLI settings write | Standard |
| [L62](../tests/cli-library.test.mjs#L62) | cancelled prompt and non-interactive first use have no library or configuration side effects | Standard |
| [L68](../tests/cli-library.test.mjs#L68) | malformed saved configuration fails clearly; explicit CLI/env directory bypasses it | Standard |
| [L78](../tests/cli-library.test.mjs#L78) | legacy independent CLI shelf is retained rather than moved or silently selected | Standard |
| [L84](../tests/cli-library.test.mjs#L84) | new ownership lock serializes simultaneous stale-owner recovery and releases on process exit | Standard |
| [L131](../tests/cli-library.test.mjs#L131) | CLI creates the saved desktop shelf, shares media/progress, rejects overlap, and releases failed startup | {timeout:30000} |
| [L168](../tests/cli-library.test.mjs#L168) | non-interactive fresh CLI fails without creating configuration or business data | {timeout:10000} |
| [L186](../tests/cli-library.test.mjs#L186) | CLI signal stops a hanging Codex request before draining HTTP and releasing the library | {skip:process.platform==='win32',timeout:15000} |
| [L205](../tests/cli-library.test.mjs#L205) | CLI reuses saved API configuration without prompts and reset clears only provider state | {timeout:15000} |

### tests/headless-cli.test.mjs

[tests/headless-cli.test.mjs](../tests/headless-cli.test.mjs) — 15 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); Default `pnpm test:e2e`; `--gate=release`; `--gate=npm`; `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

Platform branches occur in this file; case options and fixture code determine applicability.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L33](../tests/headless-cli.test.mjs#L33) | `explicit draft copy preserves ${status} review, source text and provenance without inference` | Matrix/template; {timeout:30000} |
| [L56](../tests/headless-cli.test.mjs#L56) | draft copies reject images and invalid checkpoints and retain explicit mode in replay identity | {timeout:30000} |
| [L73](../tests/headless-cli.test.mjs#L73) | copy preserves a passed storyboard and evidence; only images run in the destination | {timeout:30000} |
| [L105](../tests/headless-cli.test.mjs#L105) | CLI image-only edit redraws selected pages after explicit resume/run and preserves text, review and other images | {timeout:30000} |
| [L133](../tests/headless-cli.test.mjs#L133) | Skill can copy text, wait for a user decision, then attach independent images to the same story | Standard |
| [L155](../tests/headless-cli.test.mjs#L155) | copy defaults to text only and accepts explicit image choices without reusing another art style | Standard |
| [L169](../tests/headless-cli.test.mjs#L169) | `${failure} copy image keeps saved text and decision; retry finishes the same story without another question` | Matrix/template |
| [L182](../tests/headless-cli.test.mjs#L182) | image continuation rejects a changed source after the Skill checkpoint and preserves the text copy | Standard |
| [L190](../tests/headless-cli.test.mjs#L190) | copy retains partial image positions and later production draws only the missing page without review | Standard |
| [L201](../tests/headless-cli.test.mjs#L201) | real CLI copy never asks for terminal input, with or without JSON mode or image flags | { skip:process.platform==='win32'?'POSIX terminal test; command contracts run on every platform':false,timeout:30000, } |
| [L213](../tests/headless-cli.test.mjs#L213) | in-process CLI saves intent without inference, runs bounded discovery/preparation/review and completes one story | {timeout:60000} |
| [L239](../tests/headless-cli.test.mjs#L239) | targeted run cannot dispatch another active story and direct-inference API routes never execute | {timeout:30000} |
| [L252](../tests/headless-cli.test.mjs#L252) | timeout and explicit fault recovery retain checkpoints and request identities | {timeout:30000} |
| [L267](../tests/headless-cli.test.mjs#L267) | same native/browser export core produces credited public ZIP, PDF, PNG and escaped offline preview | {timeout:60000} |
| [L282](../tests/headless-cli.test.mjs#L282) | real CLI subcommands initialize/inspect/export diagnostics with one JSON stdout and no network listener | {...heavy,timeout:30000} |

### tests/npm-cli.test.mjs

[tests/npm-cli.test.mjs](../tests/npm-cli.test.mjs) — 6 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `--gate=release`; `--gate=npm`; `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L13](../tests/npm-cli.test.mjs#L13) | CLI accepts named options, equals syntax, and help/version aliases | Standard |
| [L24](../tests/npm-cli.test.mjs#L24) | CLI flags override environment and relative data paths use the launch directory | Standard |
| [L34](../tests/npm-cli.test.mjs#L34) | CLI defaults to LAN access and respects an explicit loopback environment | Standard |
| [L40](../tests/npm-cli.test.mjs#L40) | `CLI startup serves the reader and prints phone QR codes only for LAN access (localOnly=${localOnly})` | Matrix/template; {timeout:20000} |
| [L58](../tests/npm-cli.test.mjs#L58) | CLI suggestions use the desktop app-data paths on every platform | Standard |
| [L68](../tests/npm-cli.test.mjs#L68) | help and version do not load an env file, initialize SQLite, or create a library | Standard |

### tests/settings-faults.test.mjs

[tests/settings-faults.test.mjs](../tests/settings-faults.test.mjs) — 6 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); Default `pnpm test:e2e`; `--gate=release`; `--gate=npm`; `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

Platform branches occur in this file; case options and fixture code determine applicability.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L13](../tests/settings-faults.test.mjs#L13) | settings lock timeouts preserve state and allow subsequent save/reset/open | {timeout:20000} |
| [L36](../tests/settings-faults.test.mjs#L36) | a failed settings write rolls back an already-written replacement key | Standard |
| [L47](../tests/settings-faults.test.mjs#L47) | unwritable settings parent is rejected without changing sibling data | { skip:process.platform==='win32'\|\|process.getuid?.()===0?'requires POSIX permissions and a non-root user':false, } |
| [L58](../tests/settings-faults.test.mjs#L58) | a file blocking the settings directory fails without overwriting it on every platform | Standard |
| [L80](../tests/settings-faults.test.mjs#L80) | late migration failure rolls back DDL, settings, credentials and schema version | Standard |
| [L88](../tests/settings-faults.test.mjs#L88) | killing migration after real DDL recovers the original v1 database and permits a clean upgrade | {timeout:20000} |

### tests/startup-matrix.test.mjs

[tests/startup-matrix.test.mjs](../tests/startup-matrix.test.mjs) — 3 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

Platform branches occur in this file; case options and fixture code determine applicability.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L13](../tests/startup-matrix.test.mjs#L13) | `provider matrix: saved=${saved}, override=${override\|\|'none'}, key=${keySource}` | Matrix/template |
| [L42](../tests/startup-matrix.test.mjs#L42) | 'CLI startup matrix: '+row.name | Matrix/template; {timeout:30000} |
| [L75](../tests/startup-matrix.test.mjs#L75) | 'library discovery matrix: '+source | Matrix/template |

### tests/startup-pty.test.mjs

[tests/startup-pty.test.mjs](../tests/startup-pty.test.mjs) — 1 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

Platform branches occur in this file; case options and fixture code determine applicability.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L12](../tests/startup-pty.test.mjs#L12) | real CLI PTY onboarding, cancellation, configure and reset | { skip:process.platform==='win32'?'POSIX PTYs run on Linux/macOS; Windows runs the non-TTY startup matrix':heavy.skip\|\|false,timeout:120000, } |

### tests/system-settings.test.mjs

[tests/system-settings.test.mjs](../tests/system-settings.test.mjs) — 9 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); Default `pnpm test:e2e`; `--gate=release`; `--gate=npm`; `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

Platform branches occur in this file; case options and fixture code determine applicability.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L15](../tests/system-settings.test.mjs#L15) | v1 migrates atomically, preserves settings/key and supports independent API profiles | Standard |
| [L27](../tests/system-settings.test.mjs#L27) | legacy JSON import retains the confirmed library without inventing API credentials | Standard |
| [L34](../tests/system-settings.test.mjs#L34) | patches preserve concurrent unrelated updates, stale revisions and key failures roll back | Standard |
| [L42](../tests/system-settings.test.mjs#L42) | configure prompts only required fields, retains keys on blank input, and cancels without partial saves | Standard |
| [L53](../tests/system-settings.test.mjs#L53) | invocation overrides choose only the effective provider key and never save environment values | Standard |
| [L63](../tests/system-settings.test.mjs#L63) | development and CLI share saved provider models, credentials and per-task reasoning defaults | Standard |
| [L79](../tests/system-settings.test.mjs#L79) | reset clears only provider settings, keeping library/network state and no API key in story data | Standard |
| [L85](../tests/system-settings.test.mjs#L85) | DeepSeek invocation needs its own key and leaves shared provider settings and credentials unchanged | Standard |
| [L93](../tests/system-settings.test.mjs#L93) | unknown/corrupt/future databases and symlinks are not silently replaced | Standard |

## Provider adapters, schemas and reasoning

Recommended trigger: Fast adapter contracts on every code PR; affected provider matrix when adapters/prompts/shared schemas change; full matrix before release.

Change surface: server provider/generation modules; shared prompts/schemas; reasoning and model settings; SDK/dependency versions.

### tests/claude-provider.test.mjs

[tests/claude-provider.test.mjs](../tests/claude-provider.test.mjs) — 8 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L43](../tests/claude-provider.test.mjs#L43) | Claude failures survive production diagnostic export without raw data or arbitrary error codes | Standard |
| [L53](../tests/claude-provider.test.mjs#L53) | Claude subprocess preserves structured result, actual model and usage with no inherited billing or tools | Standard |
| [L65](../tests/claude-provider.test.mjs#L65) | Claude auth rejects missing subscription or API credentials before inference | Standard |
| [L73](../tests/claude-provider.test.mjs#L73) | Claude validates models, efforts and text-only jobs before spawning | Standard |
| [L80](../tests/claude-provider.test.mjs#L80) | Claude rejects invalid protocol, unsafe tools, model changes and failed results | Standard |
| [L87](../tests/claude-provider.test.mjs#L87) | Claude timeout and explicit shutdown kill outstanding children and preserve safe inference state | Standard |
| [L96](../tests/claude-provider.test.mjs#L96) | Claude invocation-only configuration preserves desktop profile and matches using its own model | Standard |
| [L106](../tests/claude-provider.test.mjs#L106) | Claude uses public production CLI, scene batches, count review and targeted repairs and stops before images | {timeout:30000} |

### tests/codex-provider.test.mjs

[tests/codex-provider.test.mjs](../tests/codex-provider.test.mjs) — 16 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L50](../tests/codex-provider.test.mjs#L50) | runner uses ChatGPT auth, isolated stdin jobs, effective tool restrictions and dynamically disabled MCP | Standard |
| [L59](../tests/codex-provider.test.mjs#L59) | signed-out and API-key Codex logins never start inference or fall back to an API key | Standard |
| [L67](../tests/codex-provider.test.mjs#L67) | explicit effort reaches CLI config and thread; omitted or blank effort keeps inherited high | Standard |
| [L78](../tests/codex-provider.test.mjs#L78) | invalid effort fails before spawn and ignored config/thread fail before inference | Standard |
| [L89](../tests/codex-provider.test.mjs#L89) | per-job effort isolates parallel requests and does not change the runner fallback | Standard |
| [L102](../tests/codex-provider.test.mjs#L102) | status exposes the configured text model for cache identity without starting inference | Standard |
| [L112](../tests/codex-provider.test.mjs#L112) | text and image jobs wait fifteen minutes without the old five-minute cap; status and shorter limits remain | Standard |
| [L129](../tests/codex-provider.test.mjs#L129) | runner rejects unsafe tools, oversized output, process failure, missing image bytes and timeout, then removes jobs | Standard |
| [L136](../tests/codex-provider.test.mjs#L136) | stopping Codex processes rejects the in-flight call, which is how a desktop quit reaches the queue | Standard |
| [L143](../tests/codex-provider.test.mjs#L143) | a real desktop quit during Codex work is recorded as an interruption, not a provider failure | Standard |
| [L160](../tests/codex-provider.test.mjs#L160) | runner accepts native image bytes and attaches the first scene without reading returned paths | Standard |
| [L165](../tests/codex-provider.test.mjs#L165) | provider defaults to Gemini, rejects invalid config and uses Codex for all generation with no Gemini calls | Standard |
| [L180](../tests/codex-provider.test.mjs#L180) | invalid Codex JSON, wrong page count and non-image results never reach storage or another provider | Standard |
| [L189](../tests/codex-provider.test.mjs#L189) | REST reports Codex readiness without a Gemini key and routes checkpoints through the selected provider | Standard |
| [L204](../tests/codex-provider.test.mjs#L204) | pnpm login helper shares the configured home, strips API keys and rejects API-key login flags | Standard |
| [L212](../tests/codex-provider.test.mjs#L212) | per-job model routing uses Luna only for matching and rejects ignored overrides before inference | Standard |

### tests/deepseek-provider.test.mjs

[tests/deepseek-provider.test.mjs](../tests/deepseek-provider.test.mjs) — 5 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L16](../tests/deepseek-provider.test.mjs#L16) | DeepSeek cannot use OpenAI/Gemini keys or invoke image generation | Standard |
| [L26](../tests/deepseek-provider.test.mjs#L26) | DeepSeek sends strict JSON to its fixed endpoint with effective effort, thinking headroom and a fifteen-minute deadline | Standard |
| [L49](../tests/deepseek-provider.test.mjs#L49) | DeepSeek keeps incomplete outputs, oversized scenes and bad evidence behind the shared validators | Standard |
| [L61](../tests/deepseek-provider.test.mjs#L61) | DeepSeek reports safe failures without leaking keys, provider bodies or falling back | Standard |
| [L70](../tests/deepseek-provider.test.mjs#L70) | DeepSeek runs the public production CLI through 20/20/1 scene batches and both review gates without images | {timeout:30000} |

### tests/deepseek-response-diagnostics.test.mjs

[tests/deepseek-response-diagnostics.test.mjs](../tests/deepseek-response-diagnostics.test.mjs) — 2 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L9](../tests/deepseek-response-diagnostics.test.mjs#L9) | DeepSeek records incomplete reason and thinking usage before rejecting an answer, then reprojects hostile logs | Standard |
| [L23](../tests/deepseek-response-diagnostics.test.mjs#L23) | Responses diagnostics preserve zero counts and ignore arbitrary fields | Standard |

### tests/gemini-argon-budget.test.mjs

[tests/gemini-argon-budget.test.mjs](../tests/gemini-argon-budget.test.mjs) — 2 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L15](../tests/gemini-argon-budget.test.mjs#L15) | Argon high thinking has answer room while Flash, lower effort and larger task budgets stay unchanged | Standard |
| [L34](../tests/gemini-argon-budget.test.mjs#L34) | Argon still rejects incomplete answers and oversized outlines after increasing its token budget | Standard |

### tests/gemini-discovery-schema.test.mjs

[tests/gemini-discovery-schema.test.mjs](../tests/gemini-discovery-schema.test.mjs) — 2 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L15](../tests/gemini-discovery-schema.test.mjs#L15) | Gemini catalog and legacy scan avoid counted story and continuation grammars without changing shared contracts | Standard |
| [L42](../tests/gemini-discovery-schema.test.mjs#L42) | Gemini catalog still rejects excessive story counts and invalid source continuations locally | Standard |

### tests/gemini-response-diagnostics.test.mjs

[tests/gemini-response-diagnostics.test.mjs](../tests/gemini-response-diagnostics.test.mjs) — 2 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L12](../tests/gemini-response-diagnostics.test.mjs#L12) | MAX_TOKENS retains finish reason and thinking/output usage before rejecting the paid result | Standard |
| [L27](../tests/gemini-response-diagnostics.test.mjs#L27) | response metadata keeps zero counters and distinguishes absent candidates without storing arbitrary fields | Standard |

### tests/gemini-review-evidence.test.mjs

[tests/gemini-review-evidence.test.mjs](../tests/gemini-review-evidence.test.mjs) — 5 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L20](../tests/gemini-review-evidence.test.mjs#L20) | Gemini full reviews cite exact saved excerpts and retain canonical validated reports | Standard |
| [L35](../tests/gemini-review-evidence.test.mjs#L35) | Gemini frame-count requirements use the same exact-source reference path | Standard |
| [L40](../tests/gemini-review-evidence.test.mjs#L40) | Gemini never falls back to authored quotes or accepts invalid reference IDs | Standard |
| [L44](../tests/gemini-review-evidence.test.mjs#L44) | source excerpts cover long Unicode text and chapter-only evidence without changing the source | Standard |
| [L53](../tests/gemini-review-evidence.test.mjs#L53) | Codex retains its prompts, canonical quote schemas, local validation and repair limits | Standard |

### tests/gemini-review-schema.test.mjs

[tests/gemini-review-schema.test.mjs](../tests/gemini-review-schema.test.mjs) — 3 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L21](../tests/gemini-review-schema.test.mjs#L21) | Gemini full review flattens nested array counts and records the actual wire schema | Standard |
| [L37](../tests/gemini-review-schema.test.mjs#L37) | `${model}: 41-scene issue grammar stays compact and the 42-issue local limit remains strict` | Matrix/template |
| [L44](../tests/gemini-review-schema.test.mjs#L44) | Gemini review still validates coverage counts, page references, source quotes and acceptance evidence locally | Standard |

### tests/gemini-stage-schema.test.mjs

[tests/gemini-stage-schema.test.mjs](../tests/gemini-stage-schema.test.mjs) — 4 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L35](../tests/gemini-stage-schema.test.mjs#L35) | `${model}: all ${length} production stages avoid counted grammar and preserve request contracts` | Matrix/template |
| [L63](../tests/gemini-stage-schema.test.mjs#L63) | `all production stages report ${code} safely without automatic retries` | Matrix/template |
| [L80](../tests/gemini-stage-schema.test.mjs#L80) | relaxed wire counts never relax production counts, exact page sets or saved prompt records | Standard |
| [L101](../tests/gemini-stage-schema.test.mjs#L101) | Gemini production completes discovery after the 1-to-32 transition, preparation, reviews and images | {timeout:30000} |

### tests/gemini-structure-schema.test.mjs

[tests/gemini-structure-schema.test.mjs](../tests/gemini-structure-schema.test.mjs) — 2 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L20](../tests/gemini-structure-schema.test.mjs#L20) | Gemini keeps structural repair counts in guidance and preserves the shared schema | Standard |
| [L33](../tests/gemini-structure-schema.test.mjs#L33) | Gemini repairs still reject excessive edit counts, per-edit frames and combined frames locally | Standard |

### tests/gemini-timeouts.test.mjs

[tests/gemini-timeouts.test.mjs](../tests/gemini-timeouts.test.mjs) — 1 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L9](../tests/gemini-timeouts.test.mjs#L9) | all Gemini inference entry points use fifteen minutes, including discovery, review and images | Standard |

### tests/openai-provider.test.mjs

[tests/openai-provider.test.mjs](../tests/openai-provider.test.mjs) — 7 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L24](../tests/openai-provider.test.mjs#L24) | OpenAI covers suggestions, artwork advice, counts, drafts, outlines, batches, reflections and review | Standard |
| [L59](../tests/openai-provider.test.mjs#L59) | image generation saves validated bytes and later frames send the saved anchor as multipart edits | Standard |
| [L70](../tests/openai-provider.test.mjs#L70) | refusals, incomplete or malformed outputs and invalid image bytes fail without fallback or remote image fetching | Standard |
| [L77](../tests/openai-provider.test.mjs#L77) | API errors never expose response bodies, credentials or prompts | Standard |
| [L93](../tests/openai-provider.test.mjs#L93) | OpenAI metadata-only connection check checks selected models with no generation or key disclosure | Standard |
| [L98](../tests/openai-provider.test.mjs#L98) | strict schemas preserve optional-property nullability instead of requiring invented field values | Standard |
| [L103](../tests/openai-provider.test.mjs#L103) | read-only mode never starts queued work and rejects historical generation even with API environment credentials | Standard |

### tests/prompt-contracts.test.mjs

[tests/prompt-contracts.test.mjs](../tests/prompt-contracts.test.mjs) — 3 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L17](../tests/prompt-contracts.test.mjs#L17) | pre-cleanup v2 fingerprints and automatic presets remain byte-compatible | Standard |
| [L109](../tests/prompt-contracts.test.mjs#L109) | all providers send the same stage-specific instructions, data and strict output contracts | Standard |
| [L176](../tests/prompt-contracts.test.mjs#L176) | `${provider}: story-specific acceptance criteria reach only full validation with exact prompt captures` | Matrix/template |

### tests/separate-providers.test.mjs

[tests/separate-providers.test.mjs](../tests/separate-providers.test.mjs) — 9 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L34](../tests/separate-providers.test.mjs#L34) | Codex text with Gemini images: drawing, timeouts and status come from the image provider only | Standard |
| [L48](../tests/separate-providers.test.mjs#L48) | image failures keep image-provider safe messages through the local-book wrapper; text failures keep text messages | Standard |
| [L57](../tests/separate-providers.test.mjs#L57) | status requires both sides and names the unready image service; read-only ignores the image setting | Standard |
| [L72](../tests/separate-providers.test.mjs#L72) | production queue draws every frame through the separate image provider and keeps text on the text provider | Standard |
| [L79](../tests/separate-providers.test.mjs#L79) | settings keep the image provider optional, scoped to active credentials and cleared by reset | Standard |
| [L99](../tests/separate-providers.test.mjs#L99) | invocation overrides select the image provider and its key for one run without saving | Standard |
| [L114](../tests/separate-providers.test.mjs#L114) | configure asks the image provider, saves its own key/model and Enter keeps saved choices | Standard |
| [L130](../tests/separate-providers.test.mjs#L130) | desktop checks each side with its own key and model, without generating content | Standard |
| [L143](../tests/separate-providers.test.mjs#L143) | invocation-only Claude text draws only through an explicit image provider with that provider key | Standard |

### tests/task-reasoning.test.mjs

[tests/task-reasoning.test.mjs](../tests/task-reasoning.test.mjs) — 5 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L28](../tests/task-reasoning.test.mjs#L28) | `${name}: all text tasks use ${custom?'explicit overrides':'recommended defaults'}, not the old global effort` | Matrix/template |
| [L50](../tests/task-reasoning.test.mjs#L50) | invalid task config fails before inference, and Gemini never downgrades xhigh | Standard |
| [L57](../tests/task-reasoning.test.mjs#L57) | old desktop settings acquire defaults, partial overrides persist, and Gemini rejects incompatible settings | Standard |
| [L67](../tests/task-reasoning.test.mjs#L67) | Gemini task effort survives real queued review checkpoints alongside existing usage | Standard |
| [L75](../tests/task-reasoning.test.mjs#L75) | art effort isolates recommendations while review effort changes reuse the same recommendation | Standard |

## Images, references, publication and export

Recommended trigger: Changed image/media/export/publication/reference code; release/npm archive smoke.

Change surface: reader image/media/export/zip/publication modules; metadata/watermark/signature helpers.

### tests/book-reference-star.e2e.mjs

[tests/book-reference-star.e2e.mjs](../tests/book-reference-star.e2e.mjs) — 6 scenario declarations.

**Current selection:** `pnpm test:e2e:extended`; `pnpm test:full`.

**Execution surface:** Service/process/engine E2E; filename does not imply visible UI.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L11](../tests/book-reference-star.e2e.mjs#L11) | in-flight references stay fixed; new calls use replacement and cancellation restores own anchor without redrawing | Standard |
| [L24](../tests/book-reference-star.e2e.mjs#L24) | no-star defaults and other-book isolation remain first-frame empty then own-first reference | Standard |
| [L29](../tests/book-reference-star.e2e.mjs#L29) | restart keeps the selected bytes and legacy advance uses the same book reference | Standard |
| [L34](../tests/book-reference-star.e2e.mjs#L34) | a valid book reference can serve a later frame without loading its unused missing first-image file | Standard |
| [L40](../tests/book-reference-star.e2e.mjs#L40) | missing snapshot blocks the model but cancellation is still possible | Standard |
| [L45](../tests/book-reference-star.e2e.mjs#L45) | current stories may reference previously uploaded local pictures; deleted sources cannot | Standard |

### tests/book-reference-star.test.mjs

[tests/book-reference-star.test.mjs](../tests/book-reference-star.test.mjs) — 8 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L11](../tests/book-reference-star.test.mjs#L11) | stars replace across stories, cancel with tokens, survive restart, and never alter story checkpoints | Standard |
| [L23](../tests/book-reference-star.test.mjs#L23) | concurrent selection stays unique and source deletion clears it without restore resurrection | Standard |
| [L31](../tests/book-reference-star.test.mjs#L31) | strict local-media and owner validation leaves an existing star unchanged | Standard |
| [L39](../tests/book-reference-star.test.mjs#L39) | a deletion during media loading cannot resurrect a source selection | Standard |
| [L46](../tests/book-reference-star.test.mjs#L46) | snapshots stay immutable, normalize known custom book names, and fail before paid use if lost | Standard |
| [L57](../tests/book-reference-star.test.mjs#L57) | `${provider}: first and later frames attach the resolved reference and reject another story namespace` | Matrix/template |
| [L69](../tests/book-reference-star.test.mjs#L69) | star control renders distinct accessible states | Standard |
| [L76](../tests/book-reference-star.test.mjs#L76) | page changes ignore late reads/saves and keep the write lock until authoritative reload | Standard |

### tests/export-story.test.mjs

[tests/export-story.test.mjs](../tests/export-story.test.mjs) — 7 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L53](../tests/export-story.test.mjs#L53) | named Node export reads the complete story, applies default credits and encodes every frame without a browser | Standard |
| [L72](../tests/export-story.test.mjs#L72) | named Node export leaves the existing archive intact when media is missing, credits are unsigned or the current revision changes | Standard |
| [L86](../tests/export-story.test.mjs#L86) | public ZIP matches the Guandu field/layout contract and retains original signed WebPs byte for byte | Standard |
| [L101](../tests/export-story.test.mjs#L101) | named export rejects ambiguous names and incomplete current versions instead of choosing older complete drafts | Standard |
| [L112](../tests/export-story.test.mjs#L112) | named export preserves the original sharing filename across a new revision ID and renamed title | Standard |
| [L127](../tests/export-story.test.mjs#L127) | missing frames, corrupt images, bad hashes and missing/mismatched signatures stop the export | Standard |
| [L142](../tests/export-story.test.mjs#L142) | export keeps an existing filename after a title change, supports in-place conversion and leaves targets intact on failure | Standard |

### tests/image-dimensions.test.mjs

[tests/image-dimensions.test.mjs](../tests/image-dimensions.test.mjs) — 4 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L12](../tests/image-dimensions.test.mjs#L12) | image metadata reads formats and EXIF rotation without imposing resolution or ratio limits | Standard |
| [L24](../tests/image-dimensions.test.mjs#L24) | outbound sizes follow official custom-size constraints without a default-size minimum | Standard |
| [L44](../tests/image-dimensions.test.mjs#L44) | `${name}: request 9:16 but save every valid native size and ratio without transforming bytes` | Matrix/template |
| [L58](../tests/image-dimensions.test.mjs#L58) | `${name}: only corrupt media fails the queue; explicit retry preserves completed work` | Matrix/template; flowProvider(name) |

### tests/local-image-batches.test.mjs

[tests/local-image-batches.test.mjs](../tests/local-image-batches.test.mjs) — 10 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L14](../tests/local-image-batches.test.mjs#L14) | auto is the count default; invalid counts never create a production story | Standard |
| [L22](../tests/local-image-batches.test.mjs#L22) | `${provider}: auto count 1/30 and exact ${lengths.filter(length=&gt;length!=='auto').join('/')} use durable production checkpoints` | Matrix/template |
| [L36](../tests/local-image-batches.test.mjs#L36) | `${provider}: invalid exact outline fails before images; only explicit fault recovery proceeds` | Matrix/template |
| [L43](../tests/local-image-batches.test.mjs#L43) | `${provider}: anchor runs alone, later scenes publish out of order under one session lease` | Matrix/template |
| [L51](../tests/local-image-batches.test.mjs#L51) | `${provider}: numeric detail prepares once and waits for durable explicit count confirmation` | Matrix/template |
| [L62](../tests/local-image-batches.test.mjs#L62) | `${provider}: invalid recommendations preserve the original and require an authorized retry` | Matrix/template |
| [L72](../tests/local-image-batches.test.mjs#L72) | frame 80 media, events and saved progress remain owner scoped and survive restart | heavy |
| [L83](../tests/local-image-batches.test.mjs#L83) | reader lease exit drains started calls and dispatches no additional images | Standard |
| [L87](../tests/local-image-batches.test.mjs#L87) | frame count validation, owner, running lock and concurrent conflicting confirmation are fenced | Standard |
| [L95](../tests/local-image-batches.test.mjs#L95) | unverifiable originals stop before recommendation, plan or images | Standard |

### tests/reader-png.test.mjs

[tests/reader-png.test.mjs](../tests/reader-png.test.mjs) — 3 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L8](../tests/reader-png.test.mjs#L8) | PNG export requires every image and produces a safe PNG filename | Standard |
| [L15](../tests/reader-png.test.mjs#L15) | contact sheets retain all frames in reading order for 4, 8, 10, 12, 16 and 30 pages | Standard |
| [L29](../tests/reader-png.test.mjs#L29) | long titles, narration and reflections expand the layout without overlapping later rows | Standard |

### tests/reader-zip.test.mjs

[tests/reader-zip.test.mjs](../tests/reader-zip.test.mjs) — 12 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L49](../tests/reader-zip.test.mjs#L49) | ZIP requires every image and sanitizes the archive filename | Standard |
| [L56](../tests/reader-zip.test.mjs#L56) | ZIP preserves images and public metadata while exporting requirements, page prompts and actual history | Standard |
| [L110](../tests/reader-zip.test.mjs#L110) | ZIP exports stories without generation metadata with an empty model list | Standard |
| [L126](../tests/reader-zip.test.mjs#L126) | ZIP rejects failed decoding, missing canvas, empty encoding and PNG fallbacks | Standard |
| [L139](../tests/reader-zip.test.mjs#L139) | ZIP rejects incomplete, foreign, failed, empty and non-image responses | Standard |
| [L157](../tests/reader-zip.test.mjs#L157) | ZIP credits remain consistent and image metadata does not inherit prompt contents | Standard |
| [L174](../tests/reader-zip.test.mjs#L174) | ZIP labels genuinely missing history without inventing system rules or treating empty requirements as missing | Standard |
| [L187](../tests/reader-zip.test.mjs#L187) | ZIP uses working internal references and keeps repeated large system rules below the existing 1 MiB text limit | Standard |
| [L207](../tests/reader-zip.test.mjs#L207) | download loads actual prompt history on demand and excludes API previews and raw receipts | Standard |
| [L227](../tests/reader-zip.test.mjs#L227) | download fails explicitly before creating an incomplete archive if prompt history cannot be read | Standard |
| [L238](../tests/reader-zip.test.mjs#L238) | ZIP applies the saved watermark size to WebP canvases and retains it in story metadata | Standard |
| [L248](../tests/reader-zip.test.mjs#L248) | collection export consumes the browser ZIP with its signed WebPs and shared public serialization | Standard |

### tests/story-publication-defaults.test.mjs

[tests/story-publication-defaults.test.mjs](../tests/story-publication-defaults.test.mjs) — 5 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L19](../tests/story-publication-defaults.test.mjs#L19) | live export defaults preserve work overrides and invalidate unsigned or outdated cached files | Standard |
| [L30](../tests/story-publication-defaults.test.mjs#L30) | defaults survive restart and are copied once for both creation paths, without changing existing stories or generating | Standard |
| [L55](../tests/story-publication-defaults.test.mjs#L55) | a per-story override stays independent of defaults and sibling stories, including revision inheritance | Standard |
| [L74](../tests/story-publication-defaults.test.mjs#L74) | default settings require valid same-owner CAS writes and remain editable without a generation provider | Standard |
| [L88](../tests/story-publication-defaults.test.mjs#L88) | the additive defaults migration preserves an existing library and is safe on repeated startup | Standard |

### tests/story-publication.test.mjs

[tests/story-publication.test.mjs](../tests/story-publication.test.mjs) — 3 scenario declarations.

**Current selection:** Flow tier: `pnpm test:flows` (main); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L13](../tests/story-publication.test.mjs#L13) | metadata survives late full checkpoints, queue completion, restart and revision inheritance without extra generation | Standard |
| [L42](../tests/story-publication.test.mjs#L42) | stale, invalid, cross-origin, other-owner and deleted writes leave saved metadata intact | Standard |
| [L59](../tests/story-publication.test.mjs#L59) | export identity changes with content/metadata and missing credits never impersonate the platform | Standard |

### tests/story-webp-metadata.test.mjs

[tests/story-webp-metadata.test.mjs](../tests/story-webp-metadata.test.mjs) — 6 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L15](../tests/story-webp-metadata.test.mjs#L15) | XMP replacement preserves encoded pixels, padding/dimensions and independently verifiable payload/file hashes | Standard |
| [L29](../tests/story-webp-metadata.test.mjs#L29) | public XMP escapes text, removes invalid XML controls and carries full bounded public attribution only | Standard |
| [L41](../tests/story-webp-metadata.test.mjs#L41) | WebP watermark size defaults to 24px, honors saved sizes and stays within the image width | Standard |
| [L55](../tests/story-webp-metadata.test.mjs#L55) | invalid/truncated/animated containers fail closed | Standard |
| [L60](../tests/story-webp-metadata.test.mjs#L60) | hashing works with no secure-context WebCrypto | Standard |
| [L65](../tests/story-webp-metadata.test.mjs#L65) | lossless alpha and odd-length ICCP survive XMP addition with correct feature flags | Standard |

## Desktop console, native runtime and networking

Recommended trigger: Changed desktop/native/runtime/network code or shared settings; Rust checks on relevant PRs; packaging/smoke only on explicit package/release runs.

Change surface: desktop/; src-tauri/; server/desktop*; remote/tunnel; packaged Node and native configuration.

### tests/desktop-console.test.mjs

[tests/desktop-console.test.mjs](../tests/desktop-console.test.mjs) — 4 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L13](../tests/desktop-console.test.mjs#L13) | preview browser opens only a distinct local reader root without credentials, query or fragment | Standard |
| [L19](../tests/desktop-console.test.mjs#L19) | native console no longer grants loopback frame access or remote capabilities | Standard |
| [L27](../tests/desktop-console.test.mjs#L27) | console renders lifecycle controls, saved/runtime summaries and safe upgrade backup without story controls | Standard |
| [L40](../tests/desktop-console.test.mjs#L40) | stopped provider summary requires both active API keys even when providerConfigured remains true | Standard |

### tests/desktop-internet.test.mjs

[tests/desktop-internet.test.mjs](../tests/desktop-internet.test.mjs) — 11 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

Platform branches occur in this file; case options and fixture code determine applicability.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L25](../tests/desktop-internet.test.mjs#L25) | public URLs gate every reader route; private fragment pairs into a distinct secure session | Standard |
| [L55](../tests/desktop-internet.test.mjs#L55) | pairing and remote sessions expire after twelve hours | Standard |
| [L61](../tests/desktop-internet.test.mjs#L61) | paired NDJSON responses preserve incremental reader output | Standard |
| [L71](../tests/desktop-internet.test.mjs#L71) | legacy LAN settings never silently enable Internet access | Standard |
| [L88](../tests/desktop-internet.test.mjs#L88) | helper receives isolated config/environment, handles split output and stops without leaks | nativeOnly |
| [L98](../tests/desktop-internet.test.mjs#L98) | helper missing, timeout and startup cancellation leave no process or config | nativeOnly |
| [L127](../tests/desktop-internet.test.mjs#L127) | tunnel entry pairs safely and helper exit clears public access while LAN survives | nativeOnly |
| [L143](../tests/desktop-internet.test.mjs#L143) | missing helper leaves direct local/LAN access running without pairing | nativeOnly |
| [L161](../tests/desktop-internet.test.mjs#L161) | helper exiting before readiness closes only the remote entry and retains LAN | nativeOnly |
| [L169](../tests/desktop-internet.test.mjs#L169) | parent EOF during tunnel startup cancels helper before native forced-stop deadline | {...nativeOnly,timeout:15000} |
| [L181](../tests/desktop-internet.test.mjs#L181) | native JSON protocol reports tunnel disconnect and EOF stops the remaining LAN service | {...nativeOnly,timeout:15000} |

### tests/desktop-node.test.mjs

[tests/desktop-node.test.mjs](../tests/desktop-node.test.mjs) — 1 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L6](../tests/desktop-node.test.mjs#L6) | bundled Node staging requires the exact pinned version and native target | Standard |

### tests/desktop-runtime.test.mjs

[tests/desktop-runtime.test.mjs](../tests/desktop-runtime.test.mjs) — 8 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

Platform branches occur in this file; case options and fixture code determine applicability.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L28](../tests/desktop-runtime.test.mjs#L28) | direct access needs no cookies and rejects foreign origins/hosts and native routes | Standard |
| [L43](../tests/desktop-runtime.test.mjs#L43) | desktop settings reject unknown secrets/invalid models and isolate environment variables | Standard |
| [L49](../tests/desktop-runtime.test.mjs#L49) | desktop effort defaults for old settings and maps explicit choices to the runner environment | Standard |
| [L58](../tests/desktop-runtime.test.mjs#L58) | connection test uses only model metadata, does not echo credentials, and no-key checks never make requests | Standard |
| [L66](../tests/desktop-runtime.test.mjs#L66) | desktop lifecycle preserves progress and direct access across restarts, detects busy data, and recovers after port conflicts | Standard |
| [L90](../tests/desktop-runtime.test.mjs#L90) | data ownership rejects a live Node owner and reclaims a demonstrably dead owner | Standard |
| [L101](../tests/desktop-runtime.test.mjs#L101) | parent EOF kills active detached Codex groups before releasing the data directory | {skip:process.platform==='win32',timeout:20000} |
| [L124](../tests/desktop-runtime.test.mjs#L124) | one-shot desktop upgrade returns the verified backup without listeners, credentials or worker jobs | Standard |

### tests/desktop-service-console.playwright.e2e.mjs

[tests/desktop-service-console.playwright.e2e.mjs](../tests/desktop-service-console.playwright.e2e.mjs) — 1 scenario declarations.

**Current selection:** Default `pnpm test:e2e`; `pnpm test:full`.

**Execution surface:** Real browser E2E with isolated/controlled fixtures.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L15](../tests/desktop-service-console.playwright.e2e.mjs#L15) | console-only desktop, lifecycle IPC and actual desktop browser settings | {timeout:120000} |

### tests/desktop-service-console.test.mjs

[tests/desktop-service-console.test.mjs](../tests/desktop-service-console.test.mjs) — 10 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L28](../tests/desktop-service-console.test.mjs#L28) | fresh desktop starts without generation setup; reader works and generation cannot create a partial production | Standard |
| [L36](../tests/desktop-service-console.test.mjs#L36) | desktop uses the exact native store and invocation overrides; browser drift and supervisor summary agree | Standard |
| [L44](../tests/desktop-service-console.test.mjs#L44) | missing/corrupt desktop store fails safely for read/save/check/reset without replacement | Standard |
| [L52](../tests/desktop-service-console.test.mjs#L52) | saved connection check ignores drafts, checks metadata only; reset preserves native fields and rejects stale revisions | Standard |
| [L62](../tests/desktop-service-console.test.mjs#L62) | real desktop HTTP denies foreign origin, LAN address, raw normalized paths and native-only fields | Standard |
| [L73](../tests/desktop-service-console.test.mjs#L73) | tunnel refuses generation settings before forwarding even with a loopback-looking request | Standard |
| [L78](../tests/desktop-service-console.test.mjs#L78) | desktop startup upgrades an isolated legacy library before serving and reports its verified backup | Standard |
| [L85](../tests/desktop-service-console.test.mjs#L85) | failed pending-journal recovery reports its backup safely before any service listener opens | Standard |
| [L94](../tests/desktop-service-console.test.mjs#L94) | in-place migration reports its new verified backup rather than an older consolidation report | Standard |
| [L103](../tests/desktop-service-console.test.mjs#L103) | metadata check uses the model-list route for a DeepSeek invocation override without generation | Standard |

### tests/desktop-vite.test.mjs

[tests/desktop-vite.test.mjs](../tests/desktop-vite.test.mjs) — 1 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L7](../tests/desktop-vite.test.mjs#L7) | desktop Vite transforms the shared production timeline and resolves its library imports | Standard |

## Development, skills and distribution tooling

Recommended trigger: Changed development/skill/distribution/build/CI/toolchain code; release/npm gates where selected.

Change surface: scripts/; .github/; package/lock/toolchain; server/skill and development modules.

### tests/cli-skill.test.mjs

[tests/cli-skill.test.mjs](../tests/cli-skill.test.mjs) — 9 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); Default `pnpm test:e2e`; `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L10](../tests/cli-skill.test.mjs#L10) | bundled skill copies independently, is idempotent, and refuses different instructions and symlink paths | Standard |
| [L37](../tests/cli-skill.test.mjs#L37) | check reports pinned update without replacing files; cache is outside project and policy is opt-in | Standard |
| [L53](../tests/cli-skill.test.mjs#L53) | local edits, unknown legacy content and corrupt state are preserved; matching legacy copies can be adopted | Standard |
| [L66](../tests/cli-skill.test.mjs#L66) | registry failures are non-blocking, bounded, cached briefly, and refreshable | Standard |
| [L77](../tests/cli-skill.test.mjs#L77) | auto discovery respects Git roots, ancestor projects, global fallback and correct update cwd | Standard |
| [L85](../tests/cli-skill.test.mjs#L85) | state symlinks and active operation locks reject mutations without changing their targets | Standard |
| [L94](../tests/cli-skill.test.mjs#L94) | CLI process emits one JSON receipt for check, help and managed update refusal | Standard |
| [L104](../tests/cli-skill.test.mjs#L104) | user cache location can be created independently; unsafe cache paths cannot overwrite external files | Standard |
| [L112](../tests/cli-skill.test.mjs#L112) | failed or malformed cache entries cannot authorize any automatic update or version range | Standard |

### tests/development-access.test.mjs

[tests/development-access.test.mjs](../tests/development-access.test.mjs) — 2 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L15](../tests/development-access.test.mjs#L15) | development LAN proxy allows direct access and protects preserved/private workspace stores | Standard |
| [L47](../tests/development-access.test.mjs#L47) | Vite refuses libraries and private aliases inside its public directory | Standard |

### tests/development-cache.test.mjs

[tests/development-cache.test.mjs](../tests/development-cache.test.mjs) — 1 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L16](../tests/development-cache.test.mjs#L16) | concurrent development optimizers retain each reader dependency URL | {timeout:30000} |

### tests/development-local.e2e.mjs

[tests/development-local.e2e.mjs](../tests/development-local.e2e.mjs) — 3 scenario declarations.

**Current selection:** Default `pnpm test:e2e`; `pnpm test:full`.

**Execution surface:** Service/process/engine E2E; filename does not imply visible UI.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L12](../tests/development-local.e2e.mjs#L12) | dev uses saved Google settings and ignores conflicting project .env without changing the saved profile | {timeout:45000} |
| [L21](../tests/development-local.e2e.mjs#L21) | dev shell overrides saved Google configuration only for the current invocation | {timeout:45000} |
| [L28](../tests/development-local.e2e.mjs#L28) | STORY-LIFECYCLE-C007: pnpm dev local ignores shared data settings and denies private database downloads | {timeout:45000} |

### tests/development-local.test.mjs

[tests/development-local.test.mjs](../tests/development-local.test.mjs) — 2 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L10](../tests/development-local.test.mjs#L10) | local mode selects only the checkout development shelf and preserves ordinary dev defaults | Standard |
| [L16](../tests/development-local.test.mjs#L16) | setup leaves provider configuration in the shared store and preserves an existing standalone env file | Standard |

### tests/npm-publish.test.mjs

[tests/npm-publish.test.mjs](../tests/npm-publish.test.mjs) — 3 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `--gate=release`; `--gate=npm`; `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L15](../tests/npm-publish.test.mjs#L15) | `release checks precede build, exact-artifact smoke and publish (dryRun=${dryRun})` | Matrix/template |
| [L20](../tests/npm-publish.test.mjs#L20) | 'release never publishes after failure at '+failed | Matrix/template |
| [L25](../tests/npm-publish.test.mjs#L25) | release rejects a missing tarball before smoke or publication | Standard |

### tests/release-pre-push.test.mjs

[tests/release-pre-push.test.mjs](../tests/release-pre-push.test.mjs) — 8 scenario declarations.

**Current selection:** Fast tier: `pnpm test` (code PR/manual); `--gate=release`; `pnpm test:full`; `pnpm test:providers`.

**Execution surface:** Source regression; component/contract and integration behavior varies by case.

Platform branches occur in this file; case options and fixture code determine applicability.

| Source | Scenario | Variant / options |
| --- | --- | --- |
| [L10](../tests/release-pre-push.test.mjs#L10) | both local publication gates require the production-backed lifecycle E2E | Standard |
| [L23](../tests/release-pre-push.test.mjs#L23) | smoke gates stay focused while the explicit full selection preserves all regression coverage | Standard |
| [L42](../tests/release-pre-push.test.mjs#L42) | all E2E files have an aggregate runner and the six extended service files have a dedicated command | Standard |
| [L96](../tests/release-pre-push.test.mjs#L96) | extended runner executes all six files under inherited test context and records a failing exit | Standard |
| [L106](../tests/release-pre-push.test.mjs#L106) | release pushes check the tagged snapshot once for lightweight and annotated tags; branches and deletions bypass | {skip:process.platform==='win32'} |
| [L122](../tests/release-pre-push.test.mjs#L122) | 'critical flow failure rejects a real v* tag push: '+failedFlow | Matrix/template; {skip:process.platform==='win32'} |
| [L132](../tests/release-pre-push.test.mjs#L132) | passing critical flows execute under an inherited test environment before a v* tag is accepted | {skip:process.platform==='win32'} |
| [L140](../tests/release-pre-push.test.mjs#L140) | failed checks reject the actual tag push and clean up the isolated worktree | {skip:process.platform==='win32'} |

## Native Rust scenarios

Current command: `pnpm desktop:test`. Run applicable native tests on their actual OS when native lifecycle, runtime, security or shared settings change; the current hosted workflow selects them on tag/manual builds. Some runtime integrity tests require prepared bundle assets. This inventory did not build or package the desktop app.

| Domain | Source | Test function |
| --- | --- | --- |
| Desktop console, native runtime and networking | [src-tauri/src/lib.rs:425](../src-tauri/src/lib.rs#L425) | `stop_and_exit_wait_for_startup_without_holding_the_controller_lock` |
| Desktop console, native runtime and networking | [src-tauri/src/lib.rs:443](../src-tauri/src/lib.rs#L443) | `browser_opener_accepts_only_root_and_fixed_settings_fragment` |
| Desktop console, native runtime and networking | [src-tauri/src/lib.rs:468](../src-tauri/src/lib.rs#L468) | `provider_commands_only_use_committed_database_configuration` |
| Desktop console, native runtime and networking | [src-tauri/src/lib.rs:501](../src-tauri/src/lib.rs#L501) | `provider_environment_is_invocation_only_and_does_not_import_credentials` |
| Desktop console, native runtime and networking | [src-tauri/src/lib.rs:536](../src-tauri/src/lib.rs#L536) | `separate_image_provider_uses_its_own_credential_and_readiness` |
| Desktop console, native runtime and networking | [src-tauri/src/runtime.rs:382](../src-tauri/src/runtime.rs#L382) | `upgrade_wait_outlives_startup_timeout_and_preserves_backup` |
| Desktop console, native runtime and networking | [src-tauri/src/runtime.rs:399](../src-tauri/src/runtime.rs#L399) | `desktop_uses_verified_bundle_and_ignores_saved_system_path` |
| Desktop console, native runtime and networking | [src-tauri/src/runtime.rs:414](../src-tauri/src/runtime.rs#L414) | `desktop_rejects_missing_or_modified_bundle_without_fallback` |
| Desktop console, native runtime and networking | [src-tauri/src/runtime.rs:437](../src-tauri/src/runtime.rs#L437) | `status_stream_keeps_disconnect_updates_after_large_readiness_frame` |
| Desktop console, native runtime and networking | [src-tauri/src/runtime.rs:456](../src-tauri/src/runtime.rs#L456) | `status_stream_normalizes_fatal_diagnostics_during_cleanup` |
| Desktop console, native runtime and networking | [src-tauri/src/runtime.rs:471](../src-tauri/src/runtime.rs#L471) | `rejects_wrong_node_and_sqlite_capabilities` |
| Desktop console, native runtime and networking | [src-tauri/src/runtime.rs:496](../src-tauri/src/runtime.rs#L496) | `exclusive_directory_lock_releases_with_owner` |
| CLI startup, settings and configuration | [src-tauri/src/config.rs:572](../src-tauri/src/config.rs#L572) | `native_patch_preserves_browser_fields_and_stale_saves_fail` |
| CLI startup, settings and configuration | [src-tauri/src/config.rs:613](../src-tauri/src/config.rs#L613) | `legacy_lan_never_enables_internet_and_new_settings_round_trip` |
| CLI startup, settings and configuration | [src-tauri/src/config.rs:655](../src-tauri/src/config.rs#L655) | `database_round_trip_delete_and_private_permissions` |
| CLI startup, settings and configuration | [src-tauri/src/config.rs:689](../src-tauri/src/config.rs#L689) | `migration_is_once_and_never_overwrites_database` |
| CLI startup, settings and configuration | [src-tauri/src/config.rs:710](../src-tauri/src/config.rs#L710) | `task_efforts_migrate_old_settings_and_reject_invalid_saves_atomically` |
| CLI startup, settings and configuration | [src-tauri/src/config.rs:767](../src-tauri/src/config.rs#L767) | `reasoning_effort_reads_old_settings_and_persists_without_changing_keys` |
| CLI startup, settings and configuration | [src-tauri/src/config.rs:811](../src-tauri/src/config.rs#L811) | `failed_key_write_rolls_back_settings_and_key` |
| CLI startup, settings and configuration | [src-tauri/src/config.rs:825](../src-tauri/src/config.rs#L825) | `corrupt_future_and_unknown_schema_are_preserved` |
| CLI startup, settings and configuration | [src-tauri/src/config.rs:847](../src-tauri/src/config.rs#L847) | `settings_cannot_contain_secret_fields_or_invalid_values` |
| CLI startup, settings and configuration | [src-tauri/src/config.rs:866](../src-tauri/src/config.rs#L866) | `windows_rejects_codex_without_changing_saved_gemini_settings` |
| CLI startup, settings and configuration | [src-tauri/src/config.rs:882](../src-tauri/src/config.rs#L882) | `symlink_database_is_rejected` |
| CLI startup, settings and configuration | [src-tauri/src/config.rs:894](../src-tauri/src/config.rs#L894) | `version_one_migrates_preserving_keys_and_revision_rejects_stale_saves` |
| CLI startup, settings and configuration | [src-tauri/src/config.rs:961](../src-tauri/src/config.rs#L961) | `typescript_and_native_share_the_actual_database_protocol` |
| Library storage, migrations and server boundaries | [src-tauri/src/library.rs:108](../src-tauri/src/library.rs#L108) | `refusal_precedes_ownership_writes` |

## Managed business lifecycle scenarios

Seven authoritative READY case definitions exist in `.tests/story-lifecycle/CASES.md`. Their existing run ledger is historical evidence and was not changed. Suggested trigger: affected lifecycle/UI/state-machine work and a current-build pre-release business run.

| Case | Authored objective/title | Source |
| --- | --- | --- |
| STORY-LIFECYCLE-C001 | 新建、提取、准备与确认制作 | [Case definition](../.tests/story-lifecycle/CASES.md#L3) |
| STORY-LIFECYCLE-C002 | 已生成故事的各编辑入口 | [Case definition](../.tests/story-lifecycle/CASES.md#L40) |
| STORY-LIFECYCLE-C003 | 暂停、恢复与检查点 | [Case definition](../.tests/story-lifecycle/CASES.md#L77) |
| STORY-LIFECYCLE-C004 | 失败与显式恢复 | [Case definition](../.tests/story-lifecycle/CASES.md#L114) |
| STORY-LIFECYCLE-C005 | 重选取消与提交 | [Case definition](../.tests/story-lifecycle/CASES.md#L151) |
| STORY-LIFECYCLE-C006 | 状态机协议及媒体恢复 | [Case definition](../.tests/story-lifecycle/CASES.md#L188) |
| STORY-LIFECYCLE-C007 | 开发入口与库隔离 | [Case definition](../.tests/story-lifecycle/CASES.md#L225) |

## Legacy acceptance specifications

All 76 documents are retained below. Numbered statements and section headings are authored missions/steps, not independently counted executable tests. Full linked documents remain authoritative for preconditions and outcomes. Historical execution sections do not establish current-build PASS.

“Review applicability” means legacy terms appear in the source; it is a review flag, not a declaration that the whole document is obsolete.

### Bundled books, originals and source integrity — written specifications

#### 优先三书原文与统一异常范围验证

[.docs/tests/test-clean-priority-originals.md](../.docs/tests/test-clean-priority-originals.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-clean-priority-originals.md#L3) 从现有24本与审计四个范围开始：KR太平003-059、假名红楼003-018、水浒026-027组字、醒世004-026假名。候选/直接选中/legacy补原文均拒绝异常范围；正文不被删字或转字；正常古字、夹注和舞台提示仍可核对。
- [L4](../.docs/tests/test-clean-priority-originals.md#L4) 已存原文包含坏字且尚未有分镜：点击继续前保存件仍在，分镜模型调用为0，返回明确错误；已存可读历史版本在当前版本更新后可重试，不要求重新联网或替换原字。已有分镜和图片不被清除。
- [L5](../.docs/tests/test-clean-priority-originals.md#L5) 实际采用维基程乙本红楼120回（12分卷HTML加index）、维基喻世40卷（40HTML加index），核对每卷目录、正文、末段及80/81边界，逐字保留原字。红楼58回园林背景IDS、喻世37卷念佛发声方式PUA是用户接受的两处非关键例外：仅固定采用版本及对应篇章的完整精确语境可选，给模型的原文仍含原异常，改编不得猜字或依赖异常承担关键情节。语境改变/不足、同字在其他篇章、额外异常、篇题异常、缺文/截断均拒绝。身份/哈希/缺件/错卷/路径失败关闭，注释版式不能单独触发故事生成。太平候选尚不合格，保持旧WYG、明确尚未替换，不以抽查当500卷全扫。
- [L6](../.docs/tests/test-clean-priority-originals.md#L6) 两书真实完整顺序通读每批均有输入证据，汇总只选已核对候选；SQLite和media原文在分镜调用前已保存，给模型的原文逐字相等，8页旁白简体；无外部书源/图片/音频请求。超时不得当部分阅读成功。太平没有新原件，不执行或冒称新版真实验证。
- [L7](../.docs/tests/test-clean-priority-originals.md#L7) 验证完成的真实故事在当前localhost书架可见，原文和分镜可由API读取，重复导入不重复，原有记录逐行不变；不导入自动化mock数据，不触发图片生成。
- [L8](../.docs/tests/test-clean-priority-originals.md#L8) 全部适用测试、typecheck、lint、普通build通过；其余21本的可读范围和旧原文检查点回归，无RAG，无Docker。

#### 三书本地原件验证

[.docs/tests/test-clean-three-originals.md](../.docs/tests/test-clean-three-originals.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-clean-three-originals.md#L3) 三书完整原件集合：读取山海18经、酉阳前20续10、史记130卷；逐件哈希、页面身份和卷名匹配。缺件、篡改、错卷、目录路径逃逸拒绝加载，旧版本/无效范围拒绝引用。
- [L4](../.docs/tests/test-clean-three-originals.md#L4) 原字与全文：逐段与原始HTML/公开段落JSON核对（识典SSR所有lineType均保留，网站article的异体转换与小字省略不得覆盖原字），保留实际Unicode稀字，原字不转换；无私用字、KR代号、残组字符。酉阳两处原有□和51处图片字不猜补且相关范围不能生成；35种原PNG逐件SHA/精确图集匹配，缺图/坏图/未知字图结构失败；variants/components不覆写原字，图片占位留在原段。导航、脚本、许可框及纯图片不入原文；注释标识保留。
- [L5](../.docs/tests/test-clean-three-originals.md#L5) 史记十表：每表均有实际表头和数据，按原件核对全部单元格及rowspan/colspan关系，空格位不丢、无列错配；吕后/赵魏陈涉及尾卷存在。布局标签不冒称原文，标题和空表头不可选故事。
- [L6](../.docs/tests/test-clean-three-originals.md#L6) 全部输入按原顺序覆盖三书全部单元含尾部。三书真实已配置模型各跑全书主题选题/汇总、选择已核对原文后生成8页简体分镜；断言SQLite和media在分镜请求前保存原文、模型收到原文相等且不获取外部书源。不请求图像生成/语音。
- [L7](../.docs/tests/test-clean-three-originals.md#L7) 完整测试、typecheck、lint及普通build；其他21本包含太平与二刻回归通过。无RAG或Docker构建。

#### 二刻统一原件验证

[.docs/tests/test-erke-unified.md](../.docs/tests/test-erke-unified.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-erke-unified.md#L3) 原始40TXT加载：逐件SHA/组合版本、卷序/卷题、非空不重、原字正文单元完整，第四十卷九折及终句均存在。删卷、篡改、卷题错号和目录逃逸时503，不用旧补件兜底；旧候选版本/跨卷/倒序时400。
- [L4](../.docs/tests/test-erke-unified.md#L4) 全书顺序阅读：每单元含最后一卷均可见，按主题推荐只能用可见范围，来源URL为固定Git提交实际TXT，24本HTTP集成原文先存再分镜通过。
- [L5](../.docs/tests/test-erke-unified.md#L5) 真实已配置模型使用隔离数据：全书所有批次选题并汇总、核对一篇并生成8页简体分镜；单独输入第四十卷验证杂剧可选题并核对后生成8页。日志明确区分全书与单卷，不请求图片/音频/外部书源。
- [L6](../.docs/tests/test-erke-unified.md#L6) 回归：pnpm test、typecheck、lint、pnpm build；太平500卷及其他22本不变，无Docker。

#### 全书库本地流程验证

[.docs/tests/test-local-library-all-books.md](../.docs/tests/test-local-library-all-books.md) — **Review applicability: legacy-term references.**

Authored sections:
- [执行结果（2026-10-28）](../.docs/tests/test-local-library-all-books.md#L11)

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-local-library-all-books.md#L3) 初始：已保存 24 本原件。操作：逐本加载、分批并遍历所有单元。预期：实际章数及正文首尾正确、无目录/包装混入、无正文遗漏、原字不变，所有输入有界。
- [L4](../.docs/tests/test-local-library-all-books.md#L4) 初始：两种模拟模型。操作：全部 24 本请求主题候选，按候选建会话并推进一次分镜。预期：每批输入覆盖全书，候选被本地核对，媒体及数据库已有原文后才规划，简体输出、无远程书籍请求、无插画调用。
- [L5](../.docs/tests/test-local-library-all-books.md#L5) 初始：长书多批及有效候选。操作：篡改成其他批单元/其他书/旧版本、批中失败、重复范围；超过五个非空批时让汇总选择尾批。预期：错误引用拒绝、失败不返回部分全书结果、范围去重，尾批确实可入选，汇总只从核对候选中选择，零不必要分镜。
- [L6](../.docs/tests/test-local-library-all-books.md#L6) 初始：史记原始130篇JSON、二刻第四十卷与太平25卷 HTML、浮生四记、红楼 120 回。操作：选补件故事，读取出处；模拟补件损坏。预期：原件哈希及所有补件哈希纳入版本，太平修复anchor唯一、有序且无残段重复，史记130唯一非空不重复篇，并检查吕太后/功臣侯表/赵魏陈涉的标题和首句、太平500卷，来源正确，损坏失败；浮生不把佚失标签算正文，红楼后四十回标签明确。
- [L7](../.docs/tests/test-local-library-all-books.md#L7) 初始：现有 Gemini 配置。操作：代表性新增短书与长书选题后生成一次分镜文本；真实补件篇章验证可选择该原文路径；内置浏览器检查新增书候选出处。预期：本地核对成功、原文原字、简体分镜。记录真实与模拟的边界，不调用图片/音频、不运行 Docker。
- [L8](../.docs/tests/test-local-library-all-books.md#L8) 初始：已有庄子/世说引用及旧故事。操作：复用并回看/补全/失败重试。预期：旧引用有效、保存原文复用，既有回归通过。
- [L13](../.docs/tests/test-local-library-all-books.md#L13) 通过。24本全部加载，逐本章数与全部单元/首尾覆盖断言通过，输入&lt;=100000字符；太平25完整补卷替换缺损，卷173篇目清单剔除且首篇保留，史记130唯一非空不重复篇及缺失篇标题/首句均断言，庄子/世说旧编号与edition不变。
- [L14](../.docs/tests/test-local-library-all-books.md#L14) 通过。全部24本模拟HTTP候选-&gt;会话-&gt;原文SQLite/media先存-&gt;8页分镜，无外部原文API或图片调用。Gemini/Codex完整输入与选中片段契约覆盖。
- [L15](../.docs/tests/test-local-library-all-books.md#L15) 通过。超过5非空批尾批确实可选、跨批未见范围被移除、汇总不能新造receipt、批失败不返回部分结果；坏字/旧版/跨书/倒序等既有回归通过。
- [L16](../.docs/tests/test-local-library-all-books.md#L16) 通过。太平15个残段anchor唯一且有序、补卷实际URL、raw+补件组合版本校验、坏补件失败关闭；二刻补40、浮生4记、红楼前80/后40、阅微附录分别标注。史记更换为单一原始JSON，不使用先前3HTML拼补，十表仅表序如实标注。
- [L17](../.docs/tests/test-local-library-all-books.md#L17) 通过。真实Gemini列子整书5候选+8页，儒林全书分批+汇总5候选+8页；二刻40单卷补件3候选+8页且URL正确。IAB当前localhost列子5候选出处标签已截图。仅文本实测，未生成图片/音频，未运行Docker。
- [L18](../.docs/tests/test-local-library-all-books.md#L18) 通过。原庄子/世说引用回归、原文先存/分镜失败重试和旧HTTP补全均通过；新加旧史记《陈涉世家》按唯一篇名补全成功。

#### 本地整书选题流程验证

[.docs/tests/test-local-whole-book.md](../.docs/tests/test-local-whole-book.md) — **Review applicability: legacy-term references.**

Authored sections:
- [执行结果（2026-10-28）](../.docs/tests/test-local-whole-book.md#L23)

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-local-whole-book.md#L3) 初始：本地 Node 应用与《庄子》《世说新语》书库可用，使用模拟提供方。
- [L6](../.docs/tests/test-local-whole-book.md#L6) 初始：已有有效本地候选。
- [L9](../.docs/tests/test-local-whole-book.md#L9) 初始：有效候选引用。
- [L12](../.docs/tests/test-local-whole-book.md#L12) 初始：已有完成故事或旧版只有分镜的故事。
- [L15](../.docs/tests/test-local-whole-book.md#L15) 初始：真实现有模型配置可用。
- [L18](../.docs/tests/test-local-whole-book.md#L18) 初始：资料已整理、生产构建完成。
- [L25](../.docs/tests/test-local-whole-book.md#L25) 通过。`tests/local-books.test.mjs` 验证完整输入、首尾及全部单元、有效范围过滤；真实 Gemini 两本各 5 个候选通过本地校验。内置浏览器显示全部 5 个出处标签，并可选中候选进入生成设置。
- [L26](../.docs/tests/test-local-whole-book.md#L26) 通过。真实两本各生成 8 页分镜并保留本地原文；自动化验证 SQLite 与 media 先于分镜保存、失败后保留及重试复用。插画/音频和既有重试合同由全套回归覆盖；真实验证只推进分镜，无图片调用。
- [L27](../.docs/tests/test-local-whole-book.md#L27) 通过。跨书、跨篇、倒序、旧版本、私用区字形、多则拼接及无引用输入均由自动化拒绝；存储失败和无引用时分镜调用为零。前端缓存升级 v3，换书/主题/批次清除引用的路径已检查。
- [L28](../.docs/tests/test-local-whole-book.md#L28) 通过。HTTP 自动化验证旧故事按本地《齐物论》补全，不生成分镜、不获取外部正文；已保存原文的回看与检查点合同保留，全部既有回归通过。
- [L29](../.docs/tests/test-local-whole-book.md#L29) 通过。最终原字版本真实 Gemini 验证两本，证据 `.data/evidence/local-whole-book-live/evidence.json`；Codex 只有模拟契约验证。内置浏览器真实候选和选中状态已截图。未进行真实插画或音频调用。
- [L30](../.docs/tests/test-local-whole-book.md#L30) 通过。24 本原件 SHA-256 校验通过，无派生 TXT，世说原文字形保留；生产构建与独立数据目录验证通过。Docker runtime 镜像构建完成，以 `--network none` 启动生产服务，模拟模型但使用包内真实书库的 HTTP 选题两本通过，无 .env/.data 被打包，不需宿主书库挂载。

#### 校订原文验证

[.docs/tests/test-shishuo-source-correction.md](../.docs/tests/test-shishuo-source-correction.md)

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-shishuo-source-correction.md#L3) 加载真实本地书库：shishuo-11-003谜面含“黃絹幼婦，外孫齏臼”，释义含“齏臼，受辛也”；其他1128单元逐字不变，原文件SHA仍匹配catalog，版号与原件哈希不同。
- [L4](../.docs/tests/test-shishuo-source-correction.md#L4) 新选择并保存本则：selection.source与original.localSource一致，读取媒体原文与数据库一致。用stub经过withLocalBooks.plan验证可到达stub，不请求模型。
- [L5](../.docs/tests/test-shishuo-source-correction.md#L5) 精确3条目标更新：保留12幅、画风、主题、revision和其他文档字段；state idle、control paused、无旧校验错误；已完成父故事和红楼故事保持completed及其全部计划/媒体，仅原文与出处更新。REST读取也显示新出处与暂停、原校验错误消失，旧失败text队列项不再阻塞。其余可见及已删除记录逐条未变。
- [L6](../.docs/tests/test-shishuo-source-correction.md#L6) 历史匹配的旧edition原文与selection仍可经过withLocalBooks生成校验；错误的edition或段落仍被拒绝。

#### 太平文渊阁验证

[.docs/tests/test-taiping-wyg.md](../.docs/tests/test-taiping-wyg.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-taiping-wyg.md#L3) 有原始文件集合：加载太平，核验500卷、原始哈希及固定版本，首/旧缺卷/尾卷正文存在；无目录或¶/pb/metadata包装。篡改、缺卷或错卷时503，不回退旧件。
- [L4](../.docs/tests/test-taiping-wyg.md#L4) 新版本候选：全书顺序输入并核对全部单元含500卷，模型跨批/旧版/目录引用被拒；无标点叙事可引用且原字与本地正文完全一致。
- [L5](../.docs/tests/test-taiping-wyg.md#L5) 真实已配置文本模型：全书按主题选题并汇总，选择一篇，创建会话，原文先保存后生成8页简体分镜；原文链接对应WYG固定分卷，未请求图像/语音。不调用外部古籍API。
- [L6](../.docs/tests/test-taiping-wyg.md#L6) 本地应用：选择太平和主题，确认新缓存版本下旧候选清空、选题入口正常。选题、原文持久化和8页分镜由第3项真实HTTP流程检查，不为文本验证触发付费图像。其他23本回归通过。禁止Docker构建。

### Discovery, chapter choice and matching — written specifications

#### 按需全文／章回选题与缓存：可执行流程

[.docs/tests/test-book-theme-story-cache.md](../.docs/tests/test-book-theme-story-cache.md)

Authored sections:
- [本轮执行结果](../.docs/tests/test-book-theme-story-cache.md#L12)

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-book-theme-story-cache.md#L3) 独立空数据目录，真实Codex订阅，通过当前应用API选《阅微草堂笔记》／给我一个反转。预期：直接发送全文，不建候选库；120秒内至多5篇，本地出处均可核对。保存实际耗时和流事件。
- [L4](../.docs/tests/test-book-theme-story-cache.md#L4) 相同目录重复同书同主题：返回相同故事池、缓存提示，新增模型调用为0；重启服务后同样成立。
- [L5](../.docs/tests/test-book-theme-story-cache.md#L5) 排除第一批的标题和原文出处，换一批：不重复旧来源、不通过改名重复；整本模式允许再次发送全文，模型次数留证据。
- [L6](../.docs/tests/test-book-theme-story-cache.md#L6) 超大分块确定性集成：第一个块返回5篇便停止；换批先继续同块，明确完成才读下一块。一个事件在第1章未完，中间章遗漏返回仍保留，后章按稳定ID补充原文，完整故事覆盖证据后才消费；伪造事件ID、无完整故事却声称resolved、超16项不能推进。第2章返回跨章来源；原文核对后真实多段文本传给模拟分镜，不把摘要当原文。单章过大切分完整覆盖。
- [L7](../.docs/tests/test-book-theme-story-cache.md#L7) 确定性故障／恢复：不同主题进度独立；版次/规则/模型变更失效；坏缓存、伪造来源、重复、无进展不跳块；同主题并发共享；单个取消不影响其余等待者；全部取消后保存已完成工作，不派发下一块；重启续读；写盘失败不宣称成功。
- [L8](../.docs/tests/test-book-theme-story-cache.md#L8) 在用户同一个in-app浏览器http://localhost:3000/验证选题、字数/等待文案、换批和前批回看。可用独立端口稳定HTTP服务作为真实API证据，但必须明确与页面会话差异。不得生成分镜、图片或声音。

#### 连续选题 E2E

[.docs/tests/test-continuous-story-discovery.md](../.docs/tests/test-continuous-story-discovery.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L5](../.docs/tests/test-continuous-story-discovery.md#L5) 按主题创建选题：首篇显示后无需操作继续出现第二篇；下一篇尚未完成时已有候选可选。
- [L6](../.docs/tests/test-continuous-story-discovery.md#L6) 选中首篇：进入准备/制作确认，后续查找停止；释放迟到调用后候选和选择不改变，未确认前不生成画面。
- [L7](../.docs/tests/test-continuous-story-discovery.md#L7) 新建选题，首篇出现后关闭界面：释放在途调用，确认没有后续调用；书架停留不启动查找。
- [L8](../.docs/tests/test-continuous-story-discovery.md#L8) 重开该选题：已有候选保留，查找继续且不重复已有故事。
- [L9](../.docs/tests/test-continuous-story-discovery.md#L9) 返回空结果或模拟失败：停止自动查找，已有候选仍可选择，错误显示重试入口；暂停期间不派发查找。

#### 提取窗口标题编辑

[.docs/tests/test-editable-extraction-title.md](../.docs/tests/test-editable-extraction-title.md)

Authored numbered scenario/step statements:
- [L5](../.docs/tests/test-editable-extraction-title.md#L5) 新建条件窗口中没有标题输入，书籍/主题/范围可选，主按钮上方留白至少20px。
- [L6](../.docs/tests/test-editable-extraction-title.md#L6) 进入提取窗口后显示可选标题输入。填写“乌龟报恩”点击按标题提取，生产请求携带search/title，结果只显示本轮故事，主题和范围保留。修改输入本身不发请求。
- [L7](../.docs/tests/test-editable-extraction-title.md#L7) 改为另一个标题并再次提取；旧候选被替换。清空后点击自动提取，保存auto模式。重开窗口显示最后提交标题。
- [L8](../.docs/tests/test-editable-extraction-title.md#L8) 旧自动提取尚未完成时提交标题；旧结果晚到不混入新结果。
- [L9](../.docs/tests/test-editable-extraction-title.md#L9) 已有故事重选草稿显示同一标题控件，修改并提取不改变父故事；取消保留父版本。
- [L10](../.docs/tests/test-editable-extraction-title.md#L10) 390px宽度下标题、提取按钮与候选无水平溢出，操作按钮与上方控件有明确间距。

#### 手动启动提取

[.docs/tests/test-explicit-extraction-start.md](../.docs/tests/test-explicit-extraction-start.md)

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-explicit-extraction-start.md#L3) 选择书籍、原文和主题，点击“进入故事提取”。窗口显示具体原文/主题及“自动标题、输入标题”，没有正在查找提示。API、轮询与生产观看不会产生提取调用。
- [L4](../.docs/tests/test-explicit-extraction-start.md#L4) 切换标题方式、输入/修改文字不启动。自动方式点击“开始提取”，输入方式填写标题点击“按标题提取”，才产生search命令并显示结果。
- [L5](../.docs/tests/test-explicit-extraction-start.md#L5) 等待状态关闭/重开及刷新仍不启动。已提交搜索继续按既有流程保存、续查，重放同一命令不会重复调用。
- [L6](../.docs/tests/test-explicit-extraction-start.md#L6) 已有故事打开重选，父故事不变且草稿无提取调用；点击按钮后才能查找，取消后原版本保持不动。
- [L7](../.docs/tests/test-explicit-extraction-start.md#L7) 三个水浒章节、单篇故事原文与主题组合均保留；390px下等待条件与按钮清晰、无水平溢出。

#### E2E: fast-first-story-discovery

[.docs/tests/test-fast-first-story-discovery.md](../.docs/tests/test-fast-first-story-discovery.md)

Authored sections:
- [Execution — 2026-10-29](../.docs/tests/test-fast-first-story-discovery.md#L12)

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-fast-first-story-discovery.md#L3) Cold discovery: with no cache for a chosen local book/theme, open the picker, choose a book/theme and start discovery. Immediately observe the book animation, placeholders, theme/book text, elapsed time and cancel action. Observe actual chapter labels from server progress. In-flight progress remains indeterminate; first verified result replaces placeholders and is selectable. Check mobile and reduced-motion states.
- [L4](../.docs/tests/test-fast-first-story-discovery.md#L4) Continue and resume: choose "找更多/换一批" after the first story. Existing candidates remain usable while searching. New results exclude prior sources; completed/unfinished boundaries and cross-chapter pending evidence survive a cancelled/restarted request. No fake completion percentage.
- [L5](../.docs/tests/test-fast-first-story-discovery.md#L5) Warm and legacy cache: load the existing Honglou 爱情与错过 cache under the previous plan. Verify the three already-found stories return without inference, then repeat with the new cache. Verify model/edition changes never import incompatible results.
- [L6](../.docs/tests/test-fast-first-story-discovery.md#L6) Deferred art: no recommendation request is sent before choosing a story. Selecting a local story starts one recommendation request using its verified source. Manual styles and generation remain available while pending; success explains the style and requires explicit application, failures allow retry. Change selection during a held response and confirm it does not affect the new story. Existing recommendations need no new call.
- [L7](../.docs/tests/test-fast-first-story-discovery.md#L7) Errors/cancel: cancel a held cold request and verify the panel disappears. A simulated discovery failure releases the picker and offers retry; an art failure does not remove the story or disable generation.
- [L8](../.docs/tests/test-fast-first-story-discovery.md#L8) Real provider: use an isolated cache directory and current subscription provider for one cold/hot request on a local book/theme. Record actual first-request chapter range, input size, request count, time to verified story, hot-cache time, and a selected-source art result. Do not produce a storyboard/image or touch existing reader exclusions.

#### 增量故事库服务级端到端

[.docs/tests/test-incremental-story-library.md](../.docs/tests/test-incremental-story-library.md) — **Review applicability: legacy-term references.**

Authored sections:
- [当前修正的执行规范（取代历史场景1—9、14中的摘要发现和review分支）](../.docs/tests/test-incremental-story-library.md#L33)

Authored numbered scenario/step statements:
- [L5](../.docs/tests/test-incremental-story-library.md#L5) 创建主题甲的新任务并提供真实查看者需求。提取先得到不匹配甲的故事A，再得到匹配甲的B。B必须带匹配理由与拟改编摘要；通用库保留A/B的中性摘要，提取输入没有甲，重复主题返回完整缓存资料。
- [L6](../.docs/tests/test-incremental-story-library.md#L6) 关闭并重启应用，为主题乙创建新任务。用库中A/B的摘要判断，A符合乙，不重新提取原文；再次查乙不重复匹配。
- [L7](../.docs/tests/test-incremental-story-library.md#L7) 受控模型对一条摘要返回review：第二次主题判断带该条真实原文，yes后返回；重复review或失败不当成no，库和cursor保留可重试。
- [L8](../.docs/tests/test-incremental-story-library.md#L8) 同时甲/乙查找共享一轮catalog；关闭一个查看者，另一个仍可得到结果；最后一个离开不派发下一块。选中B拒绝迟到候选/自动续找。
- [L9](../.docs/tests/test-incremental-story-library.md#L9) 选中B，把服务端候选拟改编摘要和理由随原文保存；现有画幅建议调用带摘要及原文，返回核对后的storySummary。完整确认前不生成分镜/图像。确认后短篇plan、长篇outline/batch按原文编排且不带storyBrief；审核有完整storyBrief，修订只据问题与原文。verifiedOriginal.text不被摘要替换。
- [L10](../.docs/tests/test-incremental-story-library.md#L10) 注入与原文冲突的拟摘要，准备调用返回按原文修正后的摘要；持久化并重启，再审核时只使用修正摘要，编排不传摘要。缺少核对摘要或返回非法内容时保存原文并失败，拒绝确认，不调用分镜；明确重试恢复。
- [L11](../.docs/tests/test-incremental-story-library.md#L11) 重选另一故事须清理旧原文及核对摘要；尝试从客户端制作命令伪造brief应被拒绝/忽略，不能覆盖服务端候选。升级前无能力标记且无brief的历史记录仍可按已有流程制作，新任务的旧式候选则须在准备时补齐摘要。
- [L12](../.docs/tests/test-incremental-story-library.md#L12) 主题任务各阶段保留editorialContext.mode=theme，短篇/outline/batch依原文编排；review参考主题和核对摘要审查完整性，repair按原文与具体问题改，不再次传摘要。保留开场、节奏、因果、静态画面和连续性。原典故事/忠于原文任务传mode=source且不带需扣题的theme；不额外造主题、动机或结局。
- [L13](../.docs/tests/test-incremental-story-library.md#L13) 新任务直接选择独立原典故事，跳过主题匹配但仍在准备时依据真实原文生成完整摘要；简介或“准备做什么”不能当核对完成。旧式主题推荐的新任务同样补齐。升级前已有分镜的历史记录不自动重做；无分镜且无摘要的旧式任务按新增兜底先生成摘要。
- [L14](../.docs/tests/test-incremental-story-library.md#L14) 三种provider的短篇、提纲/批次和审核/修订指令都保留第一页必要背景、人物关系和眼前处境要求，直接从原文提取必要背景做开场；不引入独立设局字段，不要求把全篇摘要或后续结局放入开场。
- [L15](../.docs/tests/test-incremental-story-library.md#L15) 创建升级前数据库，含stories.hook、任务plan/draft/outline/版本基线hook及媒体比较快照/缓存hook；部分同时已有summary。打开升级后SQLite列与这些对象均只有summary，已有摘要优先，否则旧文字无损迁移；状态、源文、图片、进度、版本关系与已付费回执不变。重启不重复更新，迁移失败可重试，导入也走同一路径。图片元数据改名导致的派生version/ID及依赖同步迁移，已成功绘制但尚未发布的回执仅发布、不重调模型，冲突失败回滚。新三provider、studio API、分镜显示/编辑与ZIP只读写summary。已核对brief的摘要覆盖模型误写引子，分镜前已生成；旧文本不因此标记已核对。
- [L16](../.docs/tests/test-incremental-story-library.md#L16) 对实际配置书库先生成一致性SQLite与待改JSON备份，再执行相同迁移；核对任务/故事/图片数量及内容指纹、原文/进度/版本状态不变，旧hook键/列消失，缓存中9篇摘要保留；不发模型请求。浏览器禁用时记录缺口，只认定服务与React渲染契约通过。
- [L22](../.docs/tests/test-incremental-story-library.md#L22) 创建非intake无摘要短篇/长篇任务，在模型调用日志中先出现原文准备/摘要recommend，保存summary后才plan/outline。注入原文/摘要失败不得发编排或绘图；重试复用已保存原文，编排失败后不重做摘要。旧confirmed任务补摘要不退回确认；已有outline.summary/成品读取不会额外付费。
- [L26](../.docs/tests/test-incremental-story-library.md#L26) 三provider分别在主题/原典模式使用带唯一summary/matchReason标记的已核对原文，并给plan/draft/outline加不同summary标记。捕获短篇、提纲、批次、结语、候选结语和修订请求：无storyBrief，嵌套的outline/draft/plan无summary标记；原文保持完整，提纲节点/前批画面/元数据保持，未核对brief仍在模型前拒绝。审核请求必须带完整storyBrief及原文，指令先按原文判断，再借摘要检查关键过程和终点；保存的summary不被删除，原对象不变。
- [L35](../.docs/tests/test-incremental-story-library.md#L35) 冷启动主题甲，原文提取只返回标题、简介与出处，故事/未完事件无summary或storyBrief。主题请求第一次就带完整原文，无摘要，返回批量yes/no/reason；甲不匹配的故事仍入库。换主题和重启复用范围，不重新提取，重复主题不再推理。
- [L36](../.docs/tests/test-incremental-story-library.md#L36) 已入库至少5篇：一次最多4篇，回执顺序可乱但ID逐一对应；后续消费同批符合项不调用模型。小输入预算自动缩为更小批，单篇过大不调用模型、不截原文、不缓存no。缺失/重复/未知ID、review、非法类型或provider失败使本批失败；已保存前批判断和库仍在。
- [L37](../.docs/tests/test-incremental-story-library.md#L37) 并发两个主题/读者共享提取与同主题单次匹配，取消一个不影响另一个；模型返回后取消仍保存整批合法判断，不再派发下一批。选中候选拒绝迟到结果。原文核对失败只报错误，不伪装为no。
- [L38](../.docs/tests/test-incremental-story-library.md#L38) 在媒体内预置旧摘要通用库及游标/跨章pending，再以新代码首次查找：复用已核对范围和进度，原文直接重新匹配，不用旧摘要回执、不重扫、不删除旧文件。并发升级不覆盖新写进度，写入失败保留旧文件可重试。配置/原文变更保持原有隔离；只改变匹配模型不使提取失效。
- [L39](../.docs/tests/test-incremental-story-library.md#L39) 选中无summary候选，匹配理由来源服务器，客户端伪造brief或reason不能覆盖。准备阶段真实原文生成并保存summary和数量建议，确认前没有分镜/图片；重启后继续，plan/outline/batch不带摘要，review有完整摘要。原典直选、旧式入口缺摘要、摘要失败重试、已确认任务与已有提纲续编均保留现有防线。
- [L40](../.docs/tests/test-incremental-story-library.md#L40) 捕获Codex/OpenAI主题请求为gpt-6-luna/low，其他文本任务沿用各自配置；Gemini保留自身模型/low。匹配状态与缓存身份吻合，错误模型/不支持模型不静默降级。三provider回执仅yes/no/一句理由，无summary。
- [L44](../.docs/tests/test-incremental-story-library.md#L44) 三provider的选中后摘要准备指令及归档摘要指令均要求2–3句、尽量80–150字、起因/关键行动/实际结果齐全；摘要仅准备/审核使用，旧1200字符范围记录继续读取，不按新建议长度截断或付费重写历史文本。语义与字数质量不由受控回归冒充实测。
- [L48](../.docs/tests/test-incremental-story-library.md#L48) 预置《红楼梦》第一回4个已识别故事与2条跨章pending，第一批主题均no；在第二回使用捕获的“娇杏一顾结奇缘”定位回执，完整覆盖pending，且仅在旧pending证据内与已入库资助故事交叉。继续查找应接受、核验主题并返回候选，结清pending；API不带continuedFrom/摘要，旧故事/游标保留，重启不重复提取。同一故事被已读排除后，其他共享旧证据的完整故事仍可返回。
- [L49](../.docs/tests/test-incremental-story-library.md#L49) 保持同范围改名、无完成关系的交叉、部分交集落在旧证据外、伪造continuedFrom、未知resolved ID及无效缓存证据的失败防线；不以清空缓存、跳过章节或丢弃pending来通过。单元/服务测试全部使用捕获回执和本地替身，不追加真实推理。真实任务只确认修复后服务可读，不自动点击重试触发新模型调用。
- [L53](../.docs/tests/test-incremental-story-library.md#L53) viewer maxStories=1，冷库第一个不符合，下一次提取请求上限4且schema.maxItems同为4；一次得到若干完整故事后一次Luna批量判断，逐个显示/重启复用不再派发新提取。第一篇、最后读者离开、缓存即时返回保持。
- [L54](../.docs/tests/test-incremental-story-library.md#L54) 预置真实“贾雨村获荐复职”范围第二回017及第三回001—004；第三回“黛玉进贾府”范围003至章末为独立完整事件，虽共享003—004但含新原文，应能接受、匹配、显示及被已读排除正确保留，不要求存在旧pending。无新增原文、无完成关系且不被任何主故事包含的交叉拼接拒绝；同范围、同名重叠、未读/非法范围和伪造证据仍拒绝。
- [L55](../.docs/tests/test-incremental-story-library.md#L55) 提取重复、非法原文范围、无增量交叉或空且未完成：内部诊断有受限原因/定位，API明确说明失败但不泄露全文，旧库/游标保留，修正回执后成功清除旧诊断。三provider初次1/后续4的动态schema和token预算一致。所有新增验证是隔离库/受控模型，不自动重试真实任务。

#### Selected-chapter extraction E2E

[.docs/tests/test-selected-chapter-extraction.md](../.docs/tests/test-selected-chapter-extraction.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L4](../.docs/tests/test-selected-chapter-extraction.md#L4) Select Three Kingdoms, search 黄忠 定军山, select chapters 70/71. Search another term and verify both selections remain counted and are checked when the search is cleared; deselect/reselect and verify count/CTA. Book or mode changes clear all selections. Check mobile width and keyboard controls.
- [L5](../.docs/tests/test-selected-chapter-extraction.md#L5) Submit extraction. Observe discovery and story candidates before count/style preparation. Inspect controlled provider payload: only chapters 70/71, correct original order and edition; no recommendation, plan or images before candidate choice. Select one result, await count confirmation, and verify source/scope preserved. Reload and continue search/retry without widening scope.
- [L6](../.docs/tests/test-selected-chapter-extraction.md#L6) Named Liaozhai/Shishuo choices still enter direct preparation. Theme discovery remains whole-book. API regression covers restart, replay/reordered scope, forged/stale/duplicate/cross-book/empty/over-limit scopes and out-of-scope model receipts/cache isolation.
- [L8](../.docs/tests/test-selected-chapter-extraction.md#L8) Create another extraction task for the same selected chapters in reverse click order after restart. It receives cached stories with no additional LLM calls. Continue-find-more retains scope and does not repeat previously offered stories (covered by controlled integration/provider tests).

#### Story/chapter picker E2E

[.docs/tests/test-story-chapter-picker.md](../.docs/tests/test-story-chapter-picker.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L5](../.docs/tests/test-story-chapter-picker.md#L5) Open new-story setup, choose direct source mode and Liaozhai. Search a story title, select it and submit. Observe the chosen title and production confirmation; verify saved original matches the range, discovery calls=0 and storyboard/image calls=0. Reload/resume and verify the same task/choice.
- [L6](../.docs/tests/test-story-chapter-picker.md#L6) Choose a chapter book and search a chapter title. Choose Shishuo and verify individual anecdotes have chapter context. Book switches clear selection; delayed earlier responses cannot restore stale entries. Unavailable entries cannot be selected. At phone width verify no horizontal overflow and accessible labels/focus.
- [L7](../.docs/tests/test-story-chapter-picker.md#L7) Inject a contents request failure, observe retry, then restore and retry. Search an absent term and observe empty state. Switch back to theme mode and verify its existing submission still creates discovery, with no retained direct source.
- [L8](../.docs/tests/test-story-chapter-picker.md#L8) Replay direct creation and verify one task; change source under the same creation ID and expect conflict. Forged/stale/cross-book ranges fail before persistence. These API assertions may use the controlled integration suite.

#### 选题条件界面验证

[.docs/tests/test-story-discovery-modes.md](../.docs/tests/test-story-discovery-modes.md)

Authored numbered scenario/step statements:
- [L5](../.docs/tests/test-story-discovery-modes.md#L5) 新建入口分别展示可选故事标题、主题、原文范围。遍历三条件的8种组合；标题留空自动发现，不限定主题使用原典故事，范围留空使用整本书。每个提交保留选定条件。
- [L6](../.docs/tests/test-story-discovery-modes.md#L6) 标题填写“宋公明三败高俅”，选78—80回并选“欲望与代价”；选题页显示目标和主题用途，选择后主题保留。只选78回时结果为空并提示补选。
- [L7](../.docs/tests/test-story-discovery-modes.md#L7) 选择一个已有故事段落并填对应标题；提交保留准确段落范围，提取输入不含该章其他故事；清空标题恢复已有故事直接选择。
- [L8](../.docs/tests/test-story-discovery-modes.md#L8) 换书清除旧出处和标题。非本地书籍保持自动发现能力；按标题输入提示仅本地书籍可用。
- [L9](../.docs/tests/test-story-discovery-modes.md#L9) 窄屏检查标题、主题、范围及主按钮，无水平溢出；空白标题可自动发现，空白自定义主题不能提交。

#### 故事发现速度、准确度与失败恢复：服务验收

[.docs/tests/test-story-discovery-speed-accuracy.md](../.docs/tests/test-story-discovery-speed-accuracy.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L7](../.docs/tests/test-story-discovery-speed-accuracy.md#L7) **坏故事不挡后面的故事和未读原文。** 预置一个含4篇的库，第一篇拒答，其余包含符合项；发起按主题查找。合法项保存并返回，坏项不为no；移除本轮符合项并自动继续，可读后面的块。改为单篇超预算时该篇0调用，其余仍可找到。最后所有原文已读完且仍有unknown，接口及现有界面note说明判断不完整，不宣称全部检查无符合项。
- [L9](../.docs/tests/test-story-discovery-speed-accuracy.md#L9) **隔离预算跨自动续查与重启。** 假模型让多批的部分项非法，其余逐次给出可展示故事；通过真实`more, automatic:true`跨round继续，关闭查看者、重开并重启服务。整个cycle新增隔离≤8、每个失败批次新增≤缺失篇数、每篇至多单篇隔离一次。耗尽后仍能用正常未尝试项/新原文找符合项。已穷尽、无未展示yes后发起手动more才开始新cycle并允许重试旧unknown；重复requestId不产生新周期。预算预留写失败不派发，重启不补发不确定的已预留调用。
- [L11](../.docs/tests/test-story-discovery-speed-accuracy.md#L11) **服务故障不拆批。** 分别注入401/403、402/429、配置不符、5xx、网络断开、Codex启动/协议失败和未知提供商错误。当前查找停止派发、显示可重试错误、不新增unknown/no；其他已落盘判断保留。已在途合法结果完成后仍保存。推理超时与启动超时分别按可隔离/服务故障处理，取消不被当作故事失败。
- [L13](../.docs/tests/test-story-discovery-speed-accuracy.md#L13) **合法部分保留。** 一个四篇回执中分别制造一个短编号错误、缺失、重复或单项非法，其余合法yes/no走真实适配器解析路径；返回并保存合法部分，重复编号对应项不选有利答案，只隔离缺失部分。重启后合法判断不再调用。JSON外壳损坏可整批失败，但预算仍有界。三提供商的wire schema、reason/verdict顺序、短编号及完整原文用单元契约测试补足，同时捕获catalog和匹配实际序列化请求，确认稳定原文在excludeTitles/pending/contextText/theme等变化字段之前。
- [L15](../.docs/tests/test-story-discovery-speed-accuracy.md#L15) **单条坏缓存与跨章部分成功。** 预置有效故事/游标/pending及可直接返回的合法主题缓存，再混入一个字段或范围失效的故事/pending。经服务入口恢复并命中主题缓存，确认只去除坏项、无模型调用、已读完状态保持；修复写失败时不提取。随后注入一个独立合法新故事及不一致resolved/pending：新故事可匹配返回，旧pending和cursor不变、诊断保留；只靠无效续完证明才成立的项不入库。排除已展示故事后重试，合法回执明确用该已存故事结清旧pending，服务器核对全部旧证据后移除pending、推进本块，故事不重复提取/入库；未确认或只覆盖部分不得结清。pending减少/推进算进展，下一次没有任何故事、pending或位置进展才报可重试错误。
- [L17](../.docs/tests/test-story-discovery-speed-accuracy.md#L17) **并发早返与安全保存。** 已存至少12篇，三批分别用门闩阻塞；后批先返回yes。它立即可供API消费，不等前批，不新增第四批。释放其他两批后所有合法判断均保存，反序写不丢结果；热缓存yes不受槽位等待。两个读者/章节范围请求同一故事时只有一个在途判断；同服务所有正常/隔离调用在途总数≤3，共享隔离对每个依赖周期分别计费且同周期只计一次。
- [L19](../.docs/tests/test-story-discovery-speed-accuracy.md#L19) **选中/离开不破坏周期及其他读者。** 三批在途时选中一个已显示故事，释放迟到回执。选择和候选列表不被迟到结果改动；主题缓存仍保存完整合法回执，不再为该读者派发。一个查看者离开不停止另一个所需共享工作；最后一个离开后不新增调用，槽位直到实际调用完成才释放。重开保持候选/原文位置/cycle预算，既有制作准备门槛不退化、不调用图片。
- [L21](../.docs/tests/test-story-discovery-speed-accuracy.md#L21) **同篇跨范围和提取配置复用。** 同版同标题同原文范围先在全书获取yes/no，再换含同篇的不同章节范围、提取模型/档位/提示词重新发现同篇。主题判断调用数不增加；不同匹配provider/model/effort/语义契约或原文内容则不复用。仅短编号/字段次序变化仍复用。同名不同范围、不同版本、旧摘要回执不串用，保持章节主故事先于子故事的提取约束。另用冻结的旧匹配prompt/schema/键序列化和raw-title故事ID预置旧回执，传入fixture之外的新主题，证明按请求主题可重算旧键、映射到新身份并复用；不能硬编码某个已知主题键通过。
- [L23](../.docs/tests/test-story-discovery-speed-accuracy.md#L23) **扩批不跳原文。** 冷库首篇只请求1；不符合后对同一块按有限上限提取，9篇fixture总提取≤2、预期9篇各一次。最大容量回执即使写blockComplete也不跳块；截断或不完整回执不推进。既有符合项直接返回不启动扩批。世说1129条预期完整定位（1072条有效故事各一次、57条原有防线拒绝显式核算）、≤60调用和五书分块阈值由专项离线集成测试执行，不能以服务小fixture替代。
- [L25](../.docs/tests/test-story-discovery-speed-accuracy.md#L25) **新分块迁移可重启。** 用冻结的旧v3键/manifest建立全书及章节旧库，分别包含已读完、前沿正好落新块边界、前沿落新块中间三种情况；升级并重启。已存故事/pending保留，已读完库0提取；只允许包含前沿的新块重读，后续不再向前回退，旧文件逐字节不变。迁移写失败后不提取，恢复重试成功；晚到旧读不覆盖新状态。缺失或不可信旧manifest不冒充已读覆盖。
- [L27](../.docs/tests/test-story-discovery-speed-accuracy.md#L27) **重叠与推进优先级。** 用娇杏/黛玉已有定位及新编高重叠不同完整事件回执验证入库，不按标题白名单；同范围、同名重叠、无增量交叉仍拒绝。只有重复、未满额且明确读完时推进；混入非法范围、跨章错误或满容量则保持位置。不让疑似重叠诊断变成额外模型调用。
- [L29](../.docs/tests/test-story-discovery-speed-accuracy.md#L29) **测量无敏感信息、离线评测不漏失败。** 请求内植入独特原文/主题/凭证/错误正文标记，捕获三适配器成功、部分非法、故障、unknown、取消后完成的测量事件：实际调用各一次、共享不重复、缺失usage为null，标记不进入日志；查找区分首篇入库与首个符合项，包含早返后的在途费用。默认eval在拒绝一切网络/runner的环境下运行，手算TP/FP/FN/unknown与边界清单吻合，缺失/不可比回执不冒充已完成评测，输出标注草稿状态。边界小样本包括一对一精确命中、重复不能加分、无交集漏提、非包含预期的合并、覆盖并集拆分、缺首/尾、合法背景共享及嵌套；分母按预期故事数、诊断可重叠且不求和，不能把缺首/尾描述成已证明缺因果。
- [L31](../.docs/tests/test-story-discovery-speed-accuracy.md#L31) **现有界面检查。** desktop preview是shell，不能直接渲染reader。以测试专用`tests/fixtures/story-discovery-preview.mjs`在临时书库绑定productionFixture的`app.handle`到loopback HTTP，程序化启动代理至它的reader Vite（假provider、拒绝外部请求、不加载.env、不运行会启动真实后端的`pnpm dev`），再以相同临时`SHIQU_DATA_DIR`和`VITE_DESKTOP_READER_URL`运行`pnpm desktop:preview`。复用相关in-app browser标签，从桌面阅读入口进入隔离reader，观察多章压缩进度、unknown不完整提示、逐篇显示与选择停止。临时harness仅测试使用，不增加产品设置；不得点击真实任务重试。IAB不可用则保留未验证状态并记录原因；REST/受控服务测试不冒充浏览器视觉证据。

### Story preparation and editorial choices — written specifications

#### 排队选题端到端

[.docs/tests/test-queued-story-setup.md](../.docs/tests/test-queued-story-setup.md) — **Review applicability: legacy-term references.**

Authored sections:
- [本轮执行证据（2026-10-30）](../.docs/tests/test-queued-story-setup.md#L14)

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-queued-story-setup.md#L3) 新建选择书籍和主题后点击开始；立即有session及书架条目。受控提取挂起时关闭、刷新再从书架打开，书籍/主题/要求仍在；期间无分镜或绘图。
- [L4](../.docs/tests/test-queued-story-setup.md#L4) 提取结束显示保存的候选，刷新仍可选择；查看原文/画风建议/再找一批/历史批次；空候选保持可操作的等待态。
- [L5](../.docs/tests/test-queued-story-setup.md#L5) 选故事后保存原文并推荐幅数；统一制作确认页有故事、画风、幅数、制作要求与详略。仅选故事不生成分镜/图片。
- [L6](../.docs/tests/test-queued-story-setup.md#L6) 修改画风不重搜；修改要求重新推荐幅数后建议更新；选择另一个故事废弃旧建议。确认准确幅数后进入既有分镜、审片、绘图队列。
- [L7](../.docs/tests/test-queued-story-setup.md#L7) 并发与丢失响应：同requestId重放不重复，另一generation选择409；旧frame-count/advance不能绕过确认；暂停后不派发新任务。
- [L8](../.docs/tests/test-queued-story-setup.md#L8) 与修订共同回归：新生成故事可修订并保留原版，新版未完成仍能回到原版；打开目标失败不改原版收藏和阅读进度。
- [L9](../.docs/tests/test-queued-story-setup.md#L9) 旧世代失败/排队任务：完成一次失败准备后选择另一个故事，旧错误不污染新状态；注入旧queued job不得执行；旧generation结果保存被拒绝。待选择和待确认不能显示已完成，也不能占用文本工作位。
- [L10](../.docs/tests/test-queued-story-setup.md#L10) 已保存original、plan尚为空时可查看原文；新建与setup动作各自幂等，进度更新不会让创建重放再发起提取。执行顺序先后端门槛、再界面、最后修订整体验证。
- [L11](../.docs/tests/test-queued-story-setup.md#L11) 审核前两轮报告问题、后续轮通过：应反复定向修复/复核后才绘图。持续问题达到3轮或修复完全无变化时停止并保留历史，手动继续后可通过；暂停/刷新不丢轮数或已保存修订。
- [L12](../.docs/tests/test-queued-story-setup.md#L12) 40幅问题拆成两批：前20已保存，后20无变化停止；手动继续只请求后20，不重修前20；历史包含无变化尝试，实际审核次数不被手动续跑的job-key递增夸大。

#### Story prompt requirements E2E

[.docs/tests/test-story-prompt-requirements.md](../.docs/tests/test-story-prompt-requirements.md) — **Review applicability: legacy-term references.**

Authored sections:
- [Execution evidence](../.docs/tests/test-story-prompt-requirements.md#L14)

Authored numbered scenario/step statements:
- [L5](../.docs/tests/test-story-prompt-requirements.md#L5) Given a story awaiting production confirmation, open its flow. Both requirement links appear at the same level. Edit each independently; close/reopen and reload. Both values persist. Expand current rules and copy text; labels distinguish previews from saved calls.
- [L6](../.docs/tests/test-story-prompt-requirements.md#L6) Given a completed fixture story with captured production/review calls and criterion results, open both links. Actual stage records include instructions, text inputs and output contract. Acceptance shows per-criterion result, evidence and page references. Missing historical records show an explicit no-record state.
- [L7](../.docs/tests/test-story-prompt-requirements.md#L7) Change only acceptance requirements and submit a new version. Existing script/images remain initially, review becomes pending, original version remains unchanged. A controlled failed criterion triggers repair; passed re-audit permits drawing/completion.
- [L8](../.docs/tests/test-story-prompt-requirements.md#L8) Given a paused story before the full script exists, both links are available; edits stay paused until explicit resume. No third prompt entry appears.
- [L12](../.docs/tests/test-story-prompt-requirements.md#L12) Given unknown or conflicting criteria, the review stops with a visible reason, creates no automatic repair request and permits editing acceptance requirements. No drawing starts.
- [L23](../.docs/tests/test-story-prompt-requirements.md#L23) Flow actions: paused generation and paused reading-settings show a green primary resume. Shelf return is a visible secondary button across discovery, confirmation, pause, failure, legacy count and reading settings. Clicking returns to shelf with saved work intact; inspecting/editing does not resume production.

#### Story-specific requirements scenarios

[.docs/tests/test-story-specific-requirements.md](../.docs/tests/test-story-specific-requirements.md)

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-story-specific-requirements.md#L3) In a new isolated library, select a story and prepare it using a controlled production provider. Both fields receive story-specific suggestions, the synopsis remains separate, and no script/image is generated before confirmation. Restart and inspect the same draft.
- [L4](../.docs/tests/test-story-specific-requirements.md#L4) Edit both fields, including clearing one; save/restart/confirm. Generation receives the production field only. Review receives the acceptance list and production context. Failed checks create targeted repairs; repairs see findings without the acceptance list; drawing follows a passing recheck.
- [L5](../.docs/tests/test-story-specific-requirements.md#L5) Hold preparation in flight, save a paused draft, then resume/release. The authored draft, including empty fields, survives the worker checkpoint. Switch stories; unchanged automatic guidance is replaced while authored changes survive.
- [L6](../.docs/tests/test-story-specific-requirements.md#L6) At the provider boundary, exercise Codex, Gemini and OpenAI recommendation, full/batched generation, reflection, frame review, full review and repair. Check original facts, schema bounds and requirement routing. Historical defaults/captures remain compatible.
- [L7](../.docs/tests/test-story-specific-requirements.md#L7) Open a controlled preview in the in-app browser. Inspect both populated editors, edit/save/reopen, and verify the existing confirmation gate remains available. Browser verification touches only the disposable fixture library.

#### 新建/修订共用流程与编辑

[.docs/tests/test-unified-story-setup.md](../.docs/tests/test-unified-story-setup.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-unified-story-setup.md#L3) 隔离受控库新建选择书籍主题，选择故事到待确认：只显示流程和最终确认，原文/要求/画风/幅数可从步骤打开，叙事详略不存在，plans/images=0。
- [L4](../.docs/tests/test-unified-story-setup.md#L4) 打开制作要求修改草稿，切到画风和幅数再关闭：流程反映草稿，重新打开仍有修改，服务器尚未确认且不编排绘图；方向键选择画风有效。
- [L5](../.docs/tests/test-unified-story-setup.md#L5) 原文窗口：没有plan也展示已保存原文与出处，只GET，没有补全POST；关闭返回流程。候选通过重新选择打开，全部已找到故事累计列出并可继续查找；重选保留手改设置。
- [L6](../.docs/tests/test-unified-story-setup.md#L6) 要求修改后明确重新推荐，设置经队列保存、等待推荐后回到流程；没有提前生成。最终确认提交完整草稿，随后生成准确幅数。
- [L7](../.docs/tests/test-unified-story-setup.md#L7) 已完成故事从阅读设置打开要求/画风/幅数：与新建使用相同标签/字段；分镜仍仅修订可编辑，原版保护与影响摘要保留。关闭后body滚动和原按钮焦点恢复。
- [L8](../.docs/tests/test-unified-story-setup.md#L8) 375px下流程、编辑和候选无横向溢出；只在隔离库提交，不触发真实模型。
- [L9](../.docs/tests/test-unified-story-setup.md#L9) 从新建故事进入书籍/主题页，不出现制作要求；加入队列后等待独立候选窗口，候选态不显示制作确认或后续制作流程。第一次选择与重新选择共用全部候选/继续查找界面；选定后才进入“故事制作流程”。提取失败或暂停仍有重试/恢复入口。
- [L15](../.docs/tests/test-unified-story-setup.md#L15) 已有生成故事在第2幅、已收藏：点击统一重新选择，注入创建503应保留原页/收藏及阅读会话；解除故障再点，只产生一个新选题session，沿用book/theme偏好且清除原出处与标题。独立候选窗口与新建相同，原版仍在书架且原进度/收藏/原图不变。
- [L16](../.docs/tests/test-unified-story-setup.md#L16) 故事已选且原文/幅数已准备后，再找一批再关闭候选：应回到待制作确认，保持旧故事、来源、幅数；新批保存但不要求再选。注入旧choosing+准备完成记录，阅读/桌面均待确认，明确最终确认可继续；不得静默增加推荐/计划/图片调用。
- [L22](../.docs/tests/test-unified-story-setup.md#L22) 先找到第一批候选，再继续查找：同一列表同时保留新旧选项，无批次下拉。选择第二次查找追加的项，发送其原batch/index，保存对应标题与出处，推荐后仍由用户明确确认；同名不同出处不由前端合并。
- [L26](../.docs/tests/test-unified-story-setup.md#L26) 制作确认页两条重复说明均不出现，确认按钮保留；重新选择后点击继续找故事，模拟慢请求时立即显示旋转图标和“正在查找…”，aria-busy=true且按钮禁用；请求结束及后台查找结束后恢复可点击，已找到故事保留。
- [L30](../.docs/tests/test-unified-story-setup.md#L30) 已有空结果提示时点击继续找故事：请求等待和后台查找均隐藏旧提示，已找到候选保留；结束后只按最新结果显示说明。按钮无边框，44px点击区域、键盘焦点与加载指示保留。

### Storyboard, frame count and audit/repair — written specifications

#### 自动幅数与原文审核的受控验收

[.docs/tests/test-adaptive-storyboard-review.md](../.docs/tests/test-adaptive-storyboard-review.md)

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-adaptive-storyboard-review.md#L3) 新任务选定故事，原文已保存：编辑叙事详略为详细后确认制作；界面无幅数输入，保存 `length:auto`。提纲自主决定与前期建议不同的数量，完整生成并审核后才绘图。
- [L4](../.docs/tests/test-adaptive-storyboard-review.md#L4) 自动故事已有完整分镜：初审指出一段关键回应被压缩；结构编辑插入一幅并删除重复过渡。新数量和顺序原子保存，随后全篇复核；复核未结束时图片调用为0。
- [L5](../.docs/tests/test-adaptive-storyboard-review.md#L5) 结构编辑将原文中一段重复讲述合并：数量减少，读取/进度不会越界；保留配文与画面的因果，修订记录可看到前后数量及编辑范围。
- [L6](../.docs/tests/test-adaptive-storyboard-review.md#L6) 注入重叠、逆序、越界、空操作、0/81幅及无实际变化的编辑：不修改已存稿或错配图片，清楚失败，绝不绘图；合法检查点重启后不重复付费步骤。
- [L7](../.docs/tests/test-adaptive-storyboard-review.md#L7) 带已绘图片的修订：在中间插入一幅，后续不变画面移动仍正确复用；改变某幅 prompt 仅使其失效；纯配文不失效；首幅改变使依赖图片失效；重复提示词不跨位猜配或一图多用。父版与独立媒体保持。
- [L8](../.docs/tests/test-adaptive-storyboard-review.md#L8) 旧数值故事/无 coverage 回执可读；旧数值 API 可完成原流程。用户从新 UI 按详略重编后进入 auto。源故事/设置被其他操作修改时原有 CAS/幂等保护有效。
- [L9](../.docs/tests/test-adaptive-storyboard-review.md#L9) 审核回执保存可定位的原文短引、任务、幅号和理由；引用不存在、幅号越界或需改项没有相应问题时不能通过。摘要/旧提纲有误不能覆盖原文事实。仅说到事件但画面焦点无关、连续同姿/状态倒退、关键回应缺失均可表示为具体问题。
- [L11](../.docs/tests/test-adaptive-storyboard-review.md#L11) 旧 `[A,X₁,X₂,B]` 经明确结构操作变为 `[A,Z,X₁,X₂,B]`，X₁/X₂提示词相同而图片不同：严格检查新第3幅来自旧第2幅，新第4幅来自旧第3幅，且一张图不重复用。无来源映射的全篇重编对重复X保守不复用。旧数值故事仅改配文/画风不切auto、不冲突；明确按详略重编时才切auto。

#### 分镜v1→测试v2：数量审核先行

[.docs/tests/test-source-first-storyboard-regression.md](../.docs/tests/test-source-first-storyboard-regression.md)

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-source-first-storyboard-regression.md#L3) 数量审核缺字段、方向不符、无补戏需求却要求调整、keep却有需求、非法数量/锚点/引用不能通过；需求派生的同幅issues合并且保留完整需求上下文；原全项审核保持。
- [L4](../.docs/tests/test-source-first-storyboard-regression.md#L4) 离线两阶段严格顺序：frames调整→结构编辑→frames复核keep→full全面审核；full再改结构回frames，full纯局部修订仍full；无任何绕过/媒体调用。
- [L5](../.docs/tests/test-source-first-storyboard-regression.md#L5) 每轮JSON检查点与请求哈希缓存：重启从已保存结果续接，不重复成功模型调用；非法输出/无变化/20轮上限停止，失败回执保留。纯函数范围/来源校验维持。
- [L6](../.docs/tests/test-source-first-storyboard-regression.md#L6) 三提供方共用数量schema、review推理档位；本地原文绑定无效时不调用；原全面审核主体逐字保持。
- [L7](../.docs/tests/test-source-first-storyboard-regression.md#L7) 真Codex九篇隔离：生产输入仅旧稿/原文/原制作要求，适中不变且length改auto。事后逐项核对关键戏，允许有据数量浮动；不靠模型passed或增幅算完成。原书架/正式队列/媒体均保持。
- [L9](../.docs/tests/test-source-first-storyboard-regression.md#L9) 第二篇失败样本的有界探针：新通用数量提示独立审已保存33幅，原文为唯一事实依据，无人工清单/参考36输入，须报告有据的未覆盖作用并通过引用/schema。新九篇仍须从旧稿独立跑，不把这一修复后的单篇当全篇完成。
- [L11](../.docs/tests/test-source-first-storyboard-regression.md#L11) 范围失衡探针：最终通用提示独立审自动扩到64的第三篇，主事件已在所选text终点完成，而章节上下文是新交锋；须检查可减/重分配，不把同场未离开当必补依据。同时保留主事件真缺结果时可补上下文，不把所选段落当不可变锁。
- [L13](../.docs/tests/test-source-first-storyboard-regression.md#L13) full遗漏身体处境的失败稿：足够幅数时同幅局部修，提示不含故事名/原文目标句/幅号，禁止新天气、伤害、病情。独立结语不计plot pages。
- [L14](../.docs/tests/test-source-first-storyboard-regression.md#L14) 系统稿继续迭代：父快照须稳定合法且有哈希/历史链，旧版本不覆写，清旧passed并重新两门，不继承正确性结论；完全同job+model才复用raw回执，九篇最终同规则验证，记录累计修订与失败。
- [L16](../.docs/tests/test-source-first-storyboard-regression.md#L16) 两门共用storyScopeDirection：不能因chosenStory偏窄删除同一行动目的尚在推进的换题/故事/回应阶段；也不能因同场强收主线完成后另起独立目的的交锋。对实际15与64反例都须真实验证，防止只堵一边。
- [L18](../.docs/tests/test-source-first-storyboard-regression.md#L18) characters-only全局修订：edits空但chars有实际变化才合法；正确pages不动、source/progress映射恒等、全局绘图输入变化使旧图片不可复用、历史保留旧新文字、预算只+1且不能绕20。无实际变化照停，其他元字段仍拒。三提供方可读旧edits输出。
- [L19](../.docs/tests/test-source-first-storyboard-regression.md#L19) full逐角色与取舍条件：次要角色独立触发/回应/立场不能只因不在核心冲突而跳过；保留对白的否定/比较/选择条件，元信息不冒充读者看到的表达。对实际50源稿做无人工答案探针，发现不等于成稿通过。
- [L21](../.docs/tests/test-source-first-storyboard-regression.md#L21) 已付费机审精确接续：完整job与requested/actual model相等才重放，整目录冻结收集；同job不同回执拒绝歧义，不根据有无issues选。首次入口未命中停止；冻结后源文件变化不改变已绑定内容。只有明确校验失败并与具体receipt对应才排除；SOURCE_QUOTE失败不封禁job，同job新合法回执可复用，TIMEOUT前有效count保留。分支保留父链累计20及全部失败，不宣称独立发现稳定。文件fixture与真实首入口cache/正常两门修订验证。

#### Story frame count E2E — revised detail → recommendation → count → storyboard

[.docs/tests/test-story-frame-count.md](../.docs/tests/test-story-frame-count.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L5](../.docs/tests/test-story-frame-count.md#L5) New UI defaults to 适中 and offers 简短/详细; no fixed count presets or manual count before recommendation. Old saved numeric preferences do not skip this flow. Each detail reaches recommendation and plan prompts, with no 30–60 instruction.
- [L6](../.docs/tests/test-story-frame-count.md#L6) Each provider: create a new detail-enabled session; first advance saves verified original and count/reason, with zero plan/image requests. Repeated advance waits, remains idle and not complete. Restart reopens exact suggestion/original. A source failure returns recoverable failed state and makes no recommendation/plan/image request; invalid recommendations fail before planning.
- [L7](../.docs/tests/test-story-frame-count.md#L7) Confirm count via owner-scoped REST. Reject 0/61/fraction/string/null, wrong owner, missing recommendation, running checkpoint. Same count confirmation is idempotent; differing/concurrent choices cannot overwrite an accepted count. Only after confirm can a plan be requested, with exact chosen length and same original/detail. Restart/lost response reuses checkpoints. Invalid plan count fails before images.
- [L8](../.docs/tests/test-story-frame-count.md#L8) Browser at390px: choose story/detail, request recommendation, see reason and count; slider and number sync at1/60 and keyboard adjustment, 1 shows 单幅概述, restore recommended count. Confirm starts generation with locked controls and exact count. A second pending recommendation can be closed and reopened from shelf/reload with no repeat provider call. Inspect screen/focus/overflow, error/retry and no extra modal.
- [L9](../.docs/tests/test-story-frame-count.md#L9) Existing numeric8/10/12 and auto sessions resume directly from saved plan with no recommendation. Retain1/60 reading/batches/media/events/progress/restart regression tests, provider auth and source-isolation behavior.

#### 审核记录ET

[.docs/tests/test-story-review-history.md](../.docs/tests/test-story-review-history.md)

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-story-review-history.md#L3) 使用正式队列和受控模型产生count调整→结构修订→count keep→full问题→局部修订→full通过；从GET历史读取顺序和结论、前后文本，刷新后仍一致。history GET前后比较会话/任务与调用次数不变。
- [L4](../.docs/tests/test-story-review-history.md#L4) 已有旧报告、有调用输入但无before字段：旧前文从对应请求恢复；无输入则明确未留存。结构增删有旧/新幅号，不把当前稿当历史。
- [L5](../.docs/tests/test-story-review-history.md#L5) 最新版本继承parent usage但无新审核：本版无记录，可看上一版真实报告并返回本版；其他用户或已删除版返回拒绝，错误可返回当前版。
- [L6](../.docs/tests/test-story-review-history.md#L6) 应用内浏览器打开当前真实故事的“审核记录”，读数量/全篇结果、修订对照与上一版，不点制作或重试生成；手机宽度检查长文本不溢出。开始制作按钮新文案保留原提交语义。
- [L8](../.docs/tests/test-story-review-history.md#L8) 在故事设置的制作流程标题行，“原文”紧邻“重新选择故事”；点击打开完整原文并关闭，阅读位置和制作状态不变；390px宽度操作组无横向溢出。
- [L10](../.docs/tests/test-story-review-history.md#L10) 制作流程末尾显示一个右对齐的“审核记录”链接，替换审核循环说明；与标题行“重新选择故事”右边缘一致，返回书架下方无重复入口，重绘预览说明不再显示。点击仍打开本版历史。
- [L11](../.docs/tests/test-story-review-history.md#L11) 验收unknown首次出现时，提示和修改入口位于全篇审片节点；第二次及以后出现时位于复核节点。已发生修订保持已完成，无修订不虚报已修订，绘图仍被阻止。实际旧版本只读验证入口打开验收编辑页，不提交或恢复生成。390px宽下提示仅出现一次，无横向溢出。

#### Storyboard batches verification

[.docs/tests/test-storyboard-batches.md](../.docs/tests/test-storyboard-batches.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-storyboard-batches.md#L3) 固定 45 幅故事，从已核原文开始请求制作。观察保存提纲，随后批次为 1–20、21–40、41–45，最后才开始绘图；API 进度已保存数依次为 0、20、40、45。
- [L4](../.docs/tests/test-storyboard-batches.md#L4) 第二批失败，重复读取不发起付费调用；重试只生成第二批，保留提纲和第一批，畸形或不足数量的输出不追加。
- [L5](../.docs/tests/test-storyboard-batches.md#L5) 第一批完成后暂停或停止，后续批次不启动；重启服务并恢复，复用提纲与第一批。
- [L6](../.docs/tests/test-storyboard-batches.md#L6) 两个并发窗口请求同一批，只执行一次付费调用。
- [L7](../.docs/tests/test-storyboard-batches.md#L7) 1、20 幅保持一次完整编排；21、40、60 幅正确收尾；自动幅数由提纲确定且最终幅数一致。两提供方具有相同调用结构和衔接资料。
- [L8](../.docs/tests/test-storyboard-batches.md#L8) 使用桌面 Vite 预览与 in-app browser 查看生成进度；已保存 20 / 45 幅时显示当前范围和保存数量，未完成前无绘图或模型百分比。
- [L9](../.docs/tests/test-storyboard-batches.md#L9) 80 幅分为 20/20/20/20，后台生成覆盖第 80 幅；第 80 幅媒体、阅读记录、事件可用，81 幅与第 81 幅访问遭拒。
- [L10](../.docs/tests/test-storyboard-batches.md#L10) 真实计时复用本机现有东郭故事的 2610 字原文和原制作要求：先目录，后 1–20/21–40/41–60/61–80，记录阶段耗时及总耗时。使用独立 SQLite 测试库、图片方法拒绝调用，仅推进 plan/source 步骤；完成后将无图测试稿作为 paused 新会话保存到原书库，校验原故事 selection/document 未改动。

#### Storyboard review verification

[.docs/tests/test-storyboard-review.md](../.docs/tests/test-storyboard-review.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-storyboard-review.md#L3) 新故事完成目录和批次后独立进入全篇审片；审片在途/报错/发现问题时不启动任何图像请求，空 issues 才放行。短故事同样审片。
- [L4](../.docs/tests/test-storyboard-review.md#L4) 审片指定相隔及相邻幅号，修订请求只包含对应编号；未指定页、全篇元数据、目录和总幅数不变。21 个问题分为 20+1 两批，随后复核，跨批边界也接受全篇上下文检查。
- [L5](../.docs/tests/test-storyboard-review.md#L5) 审片重复/越界幅号、修订缺页/重复页/多页/坏字段都失败且不追加，不绕过绘图门槛；重试复用已保存目录、分镜和审核报告。
- [L6](../.docs/tests/test-storyboard-review.md#L6) 一轮修订后复核仍有实质问题，停止自动生成并显示问题幅号；两个客户端均不自动付费重试。手动继续后只修订已知问题并复核。
- [L7](../.docs/tests/test-storyboard-review.md#L7) 审片或修订中暂停/停止/失去阅读需求，保存当前付费结果后停止后续步骤；重启只续未完成任务。并发窗口或已保存检查点的旧队列回执重放不重复付费步骤。
- [L8](../.docs/tests/test-storyboard-review.md#L8) Gemini/Codex 实际适配器通过受控模型收到一致审核维度与修订上下文；本地原文验证覆盖新入口；旧完整 plan 无审片标记时直接沿原流程继续。
- [L9](../.docs/tests/test-storyboard-review.md#L9) 进度区展示审核/修订及未通过状态，手动继续文案明确；只有审核通过后图像阶段为 current。使用实际 React 组件静态渲染验证文案与标记；浏览器可用时补 in-app 验证。

#### 正式审核流程ET

[.docs/tests/test-unified-story-review.md](../.docs/tests/test-unified-story-review.md)

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-unified-story-review.md#L3) 自动稿在真实production queue中收到reduce及两个同幅完整需求：不调用full或image，结构修订收到未截断需求；减幅后保留对应已有图及阅读位置；再次count=keep后下一检查点才调用full并处理候选结语，最后才派发缺图。
- [L4](../.docs/tests/test-unified-story-review.md#L4) count=keep成功保存后暂停并重启：恢复从full开始，count调用仅一次、usage保留；full失败后重试亦不重复count。数量审核在途暂停时保存完成结果，不继续full或绘图。
- [L5](../.docs/tests/test-unified-story-review.md#L5) full要求结构变化：结构保存后回count；full只要求局部文字修订：局部修订后直接full。数量门与全篇共用20轮限制，无变化或非法引用不进入绘图。
- [L6](../.docs/tests/test-unified-story-review.md#L6) 固定幅数旧稿仍原全篇审核；已通过/未启用审核的旧稿打开不补数量审核。真实稿最终核验暂停，当前复用图与已有字节匹配，无队列running任务。
- [L7](../.docs/tests/test-unified-story-review.md#L7) 浏览器打开当前精简稿及桌面预览：显示与实际检查点相符的数量或全篇审核阶段，暂停/阻断信息一致；原有图片可读。只验证显示，不点击恢复生成。

### Production queue, lifecycle and recovery — written specifications

#### Background generation flows

[.docs/tests/test-background-generation.md](../.docs/tests/test-background-generation.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-background-generation.md#L3) Controlled isolated unfinished story: choose 后台生成整篇 on the shelf, leave/reload with no reader demand, and verify all pages complete using existing images once. Readable unfinished stories expose the same controls in reader settings.
- [L4](../.docs/tests/test-background-generation.md#L4) Hold provider calls, pause from another window, release in-flight calls: results save, no refill. Restart: mode/control remain paused; reader POST/legacy advance cannot bypass. Resume keeps background mode and completes missing pages. Repeat with stop.
- [L5](../.docs/tests/test-background-generation.md#L5) Stop service during active background generation and restart without opening story. Queued work resumes; simulate expired interrupted image and script claims and verify recovery after expiry with late-result fencing and no replay of successes. Reader-only stories remain demand-driven.
- [L6](../.docs/tests/test-background-generation.md#L6) Fail a provider job: sibling results save, restart/passive polling never retries failed work. Explicit retry continues missing work. Global cap remains enforced across background and reader demands/providers.
- [L7](../.docs/tests/test-background-generation.md#L7) Frame-count gate waits for confirmation with background selected. Deletion disarms background intent; restoration does not start work. Invalid action, foreign owner, cross-origin and completed-story controls are bounded/validated.
- [L8](../.docs/tests/test-background-generation.md#L8) In-app browser: inspect shelf and reader controls/status, switch background, pause/stop/resume and reload against controlled isolated data. Verify desktop launcher with pnpm desktop:preview. No bundling, Docker, paid requests or changes to personal stories.

#### Continuous production queue E2E

[.docs/tests/test-continuous-production-queue.md](../.docs/tests/test-continuous-production-queue.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-continuous-production-queue.md#L3) With a fresh eight-page story and controlled provider, submit production demand at page zero. POST returns before provider work finishes. Hold first image: no later image starts. Release it: up to three later images start. Complete one while its siblings stay held: its image appears in session GET and another eligible page starts immediately. Buffer ends at page six; page one demand enables page seven.
- [L4](../.docs/tests/test-continuous-production-queue.md#L4) With two stories and multiple viewers, hold provider calls and verify global configured image cap. Release one viewer, expire another, and delete a story: no new paid jobs for inactive/deleted stories, other viewers continue, and already-started results remain saved. Restart before old viewer TTL expiry: no paid dispatch until fresh demand. Reopen after a process restart: successful outputs are reused; interrupted jobs are explicitly failed until retry.
- [L5](../.docs/tests/test-continuous-production-queue.md#L5) Fail local publication after successful image generation. Retry through both production and legacy advance after fixing local failure: provider call count stays unchanged and saved image is published once, with one usage entry. Fail a paid image: no further paid dispatch until bounded explicit/automatic retry, and sibling successes persist.
- [L6](../.docs/tests/test-continuous-production-queue.md#L6) Run a job across its renewal interval and issue a legacy advance concurrently: no duplicate paid call or stale lease takeover. Stop application during work: stop dispatch, retain settled outputs, drain publication, then close database without unhandled rejections.
- [L7](../.docs/tests/test-continuous-production-queue.md#L7) Register synthetic voice, processing, motion and video assembly handlers with distinct pools and dependencies. Voice and images can progress independently after script; assembly starts only after required artifacts succeed. Failed assembly retry reuses assets and never reruns successful jobs. Version changes create different job identities.
- [L8](../.docs/tests/test-continuous-production-queue.md#L8) In the in-app browser against controlled local providers, open an existing generated story, observe first and later images update, navigate before the old three-page boundary, leave/reopen, and confirm continued progress with saved assets. Record browser/session and avoid claiming live-provider throughput.
- [L10](../.docs/tests/test-continuous-production-queue.md#L10) Start a narrative-detail story, for both auto count and numeric7. Only source/recommendation may run. Reopen and confirm the saved recommendation is reused; confirm7 (including the unchanged numeric case), then exactly one storyboard and images may run. A slow script lease renews and excludes legacy planning.

#### Draft-copy verification

[.docs/tests/test-copy-comparison-drafts.md](../.docs/tests/test-copy-comparison-drafts.md)

Mission is specified in prose/bullets; use the source document.

#### 暂停编辑与最新版书架 E2E

[.docs/tests/test-paused-editing-latest-version.md](../.docs/tests/test-paused-editing-latest-version.md) — **Review applicability: legacy-term references.**

Authored sections:
- [ET 实际结果（2026-10-31）](../.docs/tests/test-paused-editing-latest-version.md#L15)

Authored numbered scenario/step statements:
- [L5](../.docs/tests/test-paused-editing-latest-version.md#L5) 准备中暂停：已有候选并正在准备原文/推荐；暂停，打开制作要求/画风/幅数，保存草稿；当前调用完成后草稿保留、仍暂停；候选可重新选择。
- [L6](../.docs/tests/test-paused-editing-latest-version.md#L6) 分镜未完成：已确认制作，阻塞分镜调用；暂停，修改画风/要求/幅数并保存；新版是同族第 2 版且暂停，旧调用完成不会覆盖新设置；重复提交同一请求只有一版；恢复后按新设置完成。
- [L7](../.docs/tests/test-paused-editing-latest-version.md#L7) 已有图片：原故事部分/全部出图，暂停可编辑；修改画风保留完整分镜，明确继续后重绘；修改幅数/要求重新编排；旧图与旧设置保留。
- [L8](../.docs/tests/test-paused-editing-latest-version.md#L8) 书架：最新版无图/暂停/失败均只有一张卡片；旧版重新访问不改变选择；独立创建同名故事仍有独立卡片。刷新、重启、搜索、收藏、最近阅读及桌面摘要一致。
- [L9](../.docs/tests/test-paused-editing-latest-version.md#L9) 删除恢复：删除最新版后旧版不出现；恢复后只显示最新版，收藏及检查点保留，不启动生成。
- [L10](../.docs/tests/test-paused-editing-latest-version.md#L10) UI：生成前、生成中途、阅读设置均可找到适用编辑入口；保存暂停后的明确恢复控件可见；无历史版本列表；确认制作后重新选故事另开流程。

#### Test: production queue hardening

[.docs/tests/test-production-queue-hardening.md](../.docs/tests/test-production-queue-hardening.md) — **Review applicability: legacy-term references.**

Authored sections:
- [Newest version only](../.docs/tests/test-production-queue-hardening.md#L5)
- [Old version whose row still says active](../.docs/tests/test-production-queue-hardening.md#L7)
- [Old version holding a viewer](../.docs/tests/test-production-queue-hardening.md#L21)
- [New version appears just before paying](../.docs/tests/test-production-queue-hardening.md#L27)
- [Interrupted old job](../.docs/tests/test-production-queue-hardening.md#L33)
- [Deleted newest version](../.docs/tests/test-production-queue-hardening.md#L39)
- [Stale tab](../.docs/tests/test-production-queue-hardening.md#L45)
- [Corrupt row](../.docs/tests/test-production-queue-hardening.md#L51)
- [Atomic publication](../.docs/tests/test-production-queue-hardening.md#L57)
- [Crash around publication](../.docs/tests/test-production-queue-hardening.md#L59)
- [Default and paused submissions](../.docs/tests/test-production-queue-hardening.md#L65)
- [Replay](../.docs/tests/test-production-queue-hardening.md#L71)
- [Old work in flight](../.docs/tests/test-production-queue-hardening.md#L77)
- [Rows saved before this change](../.docs/tests/test-production-queue-hardening.md#L84)
- [Four pools](../.docs/tests/test-production-queue-hardening.md#L90)
- [Search beside script work](../.docs/tests/test-production-queue-hardening.md#L92)
- [Upgrading a saved search](../.docs/tests/test-production-queue-hardening.md#L98)
- [Checkpoints and receipts](../.docs/tests/test-production-queue-hardening.md#L104)
- [Only missing work](../.docs/tests/test-production-queue-hardening.md#L106)
- [Style edit before the plan](../.docs/tests/test-production-queue-hardening.md#L112)
- [Failure containment](../.docs/tests/test-production-queue-hardening.md#L120)
- [One missing session row](../.docs/tests/test-production-queue-hardening.md#L122)
- [Delete and restore during a script step](../.docs/tests/test-production-queue-hardening.md#L128)
- [Review-failure flow](../.docs/tests/test-production-queue-hardening.md#L135)
- [Repeated manual corrections](../.docs/tests/test-production-queue-hardening.md#L137)
- [Paused story](../.docs/tests/test-production-queue-hardening.md#L143)
- [Unchanged actions](../.docs/tests/test-production-queue-hardening.md#L149)
- [Optimization](../.docs/tests/test-production-queue-hardening.md#L155)
- [Stories that can't run](../.docs/tests/test-production-queue-hardening.md#L157)
- [Deleted reader-mode story whose row still says active](../.docs/tests/test-production-queue-hardening.md#L163)
- [Unchanged active stories](../.docs/tests/test-production-queue-hardening.md#L171)
- [Superseded-input job cleanup](../.docs/tests/test-production-queue-hardening.md#L177)
- [Shelf and opened story](../.docs/tests/test-production-queue-hardening.md#L183)
- [Blocked story that can't load](../.docs/tests/test-production-queue-hardening.md#L189)
- [Review tools rendering](../.docs/tests/test-production-queue-hardening.md#L195)
- [Expired viewers](../.docs/tests/test-production-queue-hardening.md#L201)
- [Unchanged behavior](../.docs/tests/test-production-queue-hardening.md#L207)
- [Execution evidence — 2026-11-01](../.docs/tests/test-production-queue-hardening.md#L211)

#### Queue image recovery and reading priority flows

[.docs/tests/test-queue-image-recovery-priority.md](../.docs/tests/test-queue-image-recovery-priority.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L5](../.docs/tests/test-queue-image-recovery-priority.md#L5) **Lost file at publication.** Page 0's generated file is removed before publication. The story fails with the redraw message and `retryMayCharge` true, with no further provider call. A retry redraws page 0 once and the story completes.
- [L6](../.docs/tests/test-queue-image-recovery-priority.md#L6) **Lost reference.** Page 0 is published, then its file is removed or corrupted. The next page fails with the same message and no provider call. A retry redraws page 0, then the remaining pages. Pages already saved are not redrawn.
- [L7](../.docs/tests/test-queue-image-recovery-priority.md#L7) **File comes back.** After the failure in flow 1 the file is restored. A retry publishes it with no provider call.
- [L8](../.docs/tests/test-queue-image-recovery-priority.md#L8) **Transient read.** Reading the file throws at publication. `retryMayCharge` is false, and a retry after the fault clears makes no provider call.
- [L9](../.docs/tests/test-queue-image-recovery-priority.md#L9) **Reading order.** With one worker and two stories, opening the newer story at page 3 draws its first image, then page 3 and the pages after it in order, with no other story's page between them, even though each page's publication briefly blocks the next. Moving to another page changes the next page drawn. Closing the story, or its viewer lease running out, returns to page-number order.
- [L10](../.docs/tests/test-queue-image-recovery-priority.md#L10) **Passive viewing.** Observing failed, paused, stopped, completed and frame-count-waiting stories sends no demand and starts no provider call.

#### Queue interruption resilience flows

[.docs/tests/test-queue-interruption-resilience.md](../.docs/tests/test-queue-interruption-resilience.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L5](../.docs/tests/test-queue-interruption-resilience.md#L5) **Quit during an image.** An active 3-page story has page 0 in flight. Stop the service, end the call as a killed process would, and restart. The story reaches completed with no retry request, and the reader never receives the provider error.
- [L6](../.docs/tests/test-queue-interruption-resilience.md#L6) **Quit during script work.** An active story has a planning call in flight. Stop the service, end the call, and restart. Planning runs again automatically and the story completes.
- [L7](../.docs/tests/test-queue-interruption-resilience.md#L7) **Quit while paused or stopped.** A paused or stopped story has an image in flight. Stop, end the call, and restart. The story keeps its control with no new calls. Resume completes it with no retry request.
- [L8](../.docs/tests/test-queue-interruption-resilience.md#L8) **Real and blocked failures.** A provider failure while running stays failed across restart until a retry. A storyboard review that becomes blocked during a stop stays failed, and no repair runs automatically.
- [L9](../.docs/tests/test-queue-interruption-resilience.md#L9) **Transient error.** One scheduling cycle throws a database error. Generation continues on the next cycle, and new requests return 2xx.
- [L10](../.docs/tests/test-queue-interruption-resilience.md#L10) **Unreadable story.** One story's selection contains an unknown art style, and others' documents are `{}`, `null` or truncated JSON with a queued job. Other stories complete, `GET /sessions` returns them, and the unreadable rows remain in the database.
- [L11](../.docs/tests/test-queue-interruption-resilience.md#L11) **Laptop sleep.** All leases and locks are forced past expiry while a call is in flight. The next cycle keeps the claim, the finished image is published, and exactly one provider call is made.
- [L12](../.docs/tests/test-queue-interruption-resilience.md#L12) **Crash loop.** A job abandoned by a dead service is recovered automatically twice, then stops at the third attempt with a retryable error and no fourth call. A retry completes the story.

#### Single generation control flows

[.docs/tests/test-single-generation-control.md](../.docs/tests/test-single-generation-control.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-single-generation-control.md#L3) New story, controlled provider held: create through normal API with no mode request; observe background/active and preparation without any viewer demand. Confirm frame count; leave the reader. Release responses and verify all missing images finish once.
- [L4](../.docs/tests/test-single-generation-control.md#L4) Hold calls, Pause beside progress; release in-flight results, verify no refill. Restart isolated server: controls/checkpoints stay paused; opening/reading cannot resume. Resume: all remaining images complete in background. No background checkbox/enable dialog anywhere on shelf, progress or reading preferences.
- [L5](../.docs/tests/test-single-generation-control.md#L5) Upgrade a pre-change SQLite library containing reader idle/running/manual paused/stopped/completed, background active/paused, deleted and failed stories. Apply migration twice; old reader jobs never start until Resume; existing background/manual intent and all documents/job receipts/leases remain unchanged. Resume a migrated reader with saved images; reuse them.
- [L6](../.docs/tests/test-single-generation-control.md#L6) Provider failure requires explicit Retry; pause/resume and passive polling never replay a real failed job. Deleted/restored stories remain disarmed. Verify existing ownership/origin/concurrency/live-lease tests.
- [L7](../.docs/tests/test-single-generation-control.md#L7) In-app browser against isolated fake providers: inspect real shelf/read preferences with unfinished story, verify absent background switch and secondary pause/resume beside progress. Capture screenshots; no production-library mutation or paid requests. Desktop files are unchanged; no packaging/build.

#### 故事制作流程 E2E 场景

[.docs/tests/test-story-flow-reader-control.md](../.docs/tests/test-story-flow-reader-control.md)

Authored sections:
- [查找不打断已选故事](../.docs/tests/test-story-flow-reader-control.md#L5)
- [查找失败只影响查找](../.docs/tests/test-story-flow-reader-control.md#L11)
- [点击已选故事](../.docs/tests/test-story-flow-reader-control.md#L17)
- [手动幅数保留](../.docs/tests/test-story-flow-reader-control.md#L23)
- [正在绘制时修改](../.docs/tests/test-story-flow-reader-control.md#L29)
- [审片受阻](../.docs/tests/test-story-flow-reader-control.md#L35)
- [丢图后修改幅数](../.docs/tests/test-story-flow-reader-control.md#L41)
- [真实冲突保留草稿](../.docs/tests/test-story-flow-reader-control.md#L47)
- [准备这篇](../.docs/tests/test-story-flow-reader-control.md#L53)
- [超出预览的重绘](../.docs/tests/test-story-flow-reader-control.md#L59)
- [两台设备](../.docs/tests/test-story-flow-reader-control.md#L65)
- [暂停时查找](../.docs/tests/test-story-flow-reader-control.md#L71)
- [桌面摘要](../.docs/tests/test-story-flow-reader-control.md#L77)

#### 故事生成状态机验收

[.docs/tests/test-story-generation-state-machine.md](../.docs/tests/test-story-generation-state-machine.md) — **Review applicability: legacy-term references.**

Authored sections:
- [执行记录（2026-11-03）](../.docs/tests/test-story-generation-state-machine.md#L18)

Authored numbered scenario/step statements:
- [L7](../.docs/tests/test-story-generation-state-machine.md#L7) 从旧故事打开替换草稿，搜索/关闭/重开均不增加书架卡片。后台原任务推进或另一窗口替换/删除时取消，刷新展示真实当前版本，不恢复旧快照。首次提交新候选才切换卡片并保留历史；重复/过期/并发提交与普通修订交错只允许合法一个版本。
- [L8](../.docs/tests/test-story-generation-state-machine.md#L8) active/paused/stopped/failed/completed各类原版替换，核对继承提交时控制、偏好与收藏，阅读归零、旧产物不复用；明确恢复准备→准备成功→制作确认之前无分镜或绘图。旧在途结果只存历史。
- [L9](../.docs/tests/test-story-generation-state-machine.md#L9) 绘图中改名完成后总调用数等于所需图片数；失败后改名/刷新/暂停恢复调用数不变。修改元信息不改变任务ID。
- [L10](../.docs/tests/test-story-generation-state-machine.md#L10) 已完成后删除/损坏非首幅，客户端失败报告只核对并显示故障；明确重绘仅恢复对应幅；文件已恢复不付费。两幅失效逐幅恢复、首幅依赖、存储临时异常、在途保存、暂停/重启、旧版报告、过期图片身份逐项验证。
- [L11](../.docs/tests/test-story-generation-state-machine.md#L11) 图片模型成功、发布失败时保留回执，“重试保存图片”不增加模型调用；与另一幅失效并存时可独立发布。局部成功不清其他故障或提前完成。
- [L12](../.docs/tests/test-story-generation-state-machine.md#L12) 恢复请求R响应丢失→调用再次普通失败F2→重放R，不入队或重置额度；新R2才恢复F2。两个命令同时领取F1只启动一次；F1历史退出待处理。已受理后服务退出、登记中断及3次中断上限验证可接续且不增加授权。
- [L13](../.docs/tests/test-story-generation-state-machine.md#L13) 审核limit/unchanged续修、requirements/replan拒绝普通重试、显式放行、暂停叠加和请求重放；20轮额度只能由新有效续修命令建立一次。旧版或删除目标的命令及回执不可越权。
- [L14](../.docs/tests/test-story-generation-state-machine.md#L14) 真实UI动作核验：替换选题/选择并替换/恢复准备/开始制作/应用修改并恢复/重试准备/重试保存图片/重新检查图片/按幅重绘；打开只读入口及关闭编辑器不付费或提交。390px布局正常，暂停及其他故障同时可见，双击、丢失响应、加载错误和草稿冲突可处理。

#### 故事修订端到端

[.docs/tests/test-story-revisions.md](../.docs/tests/test-story-revisions.md) — **Review applicability: legacy-term references.**

Authored sections:
- [本轮执行证据（2026-10-30）](../.docs/tests/test-story-revisions.md#L16)

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-story-revisions.md#L3) 完成的本地受控故事：阅读设置中编辑制作要求/画风/画幅数/分镜，保存草稿后有清晰影响；取消/关闭不创建 session 或生成任务。
- [L4](../.docs/tests/test-story-revisions.md#L4) 仅修订中间一幅旁白：提交新版本，展示重新审片、复用全部图片；审片通过后图片字节不变，无 image 调用；可阅读原版且原配文保持。
- [L5](../.docs/tests/test-story-revisions.md#L5) 修改中间一幅提示词：预览只有该幅需重绘；提交后受控队列只绘此幅，先审后画，失败重试不丢其他图。
- [L6](../.docs/tests/test-story-revisions.md#L6) 修改画风：编排保留、重新审片、全部重绘；制作要求/幅数变化：重编排后再审片，幅数确切；多项修改一次提交。
- [L7](../.docs/tests/test-story-revisions.md#L7) 无变化禁用提交，同基线两个不同 requestId 并发仅一个成功，过期修改反馈冲突；同 requestId 相同内容幂等、不同内容拒绝；重编排与手改冲突明确选择，长文本和输入边界有效；小屏无横向溢出。
- [L8](../.docs/tests/test-story-revisions.md#L8) 新版状态页/设置可返回原版，刷新/服务重启后仍可继续新版；分别中断复制/插入/父版暂停/子版激活，不能同时新增付费任务。删除父版不影响新版图片与导出。
- [L12](../.docs/tests/test-story-revisions.md#L12) 新队列兼容：新版本引用的复制资产被识别为自己的有效参考；新版生成中移除第一幅或出版结果，只在用户显式重试后重绘该幅，原版状态和文件不变；浏览新版发送 focus、切回原版/关闭结束新版 viewer demand。服务端受控测试证明无自动付费重绘。
- [L13](../.docs/tests/test-story-revisions.md#L13) 提交前已承诺复用的图文件丢失/损坏/无法读取：提交失败、草稿可继续编辑、不产生新版和绘图任务。若改画风导致有意重绘，旧文件不阻碍已明确确认的重绘。
- [L14](../.docs/tests/test-story-revisions.md#L14) 打开新版失败：原版已收藏且停在第2幅，提交配文修订后令新版 GET 暂时失败；恢复到原版第2幅，收藏不变，持久化 progress/favorite 均不被清空，新版仍能在书架找回。

### Reader, shelf and client UI contracts — written specifications

#### Dongguo demo flows (historical)

[.docs/tests/test-dongguo-demo.md](../.docs/tests/test-dongguo-demo.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L8](../.docs/tests/test-dongguo-demo.md#L8) Fresh SQLite and admin seed: new东郭先生 story is published with30 existing captions/images, 中山狼传 author/source, exact pinned original, matching application seed and all bundled assets. Reader/admin promoted cover opens this story, never old种梨.
- [L9](../.docs/tests/test-dongguo-demo.md#L9) Existing library with modified种梨 and a previously edited东郭 row: reseed/reopen keeps their source, title, progress and media untouched. Missing new sample inserts without deleting historical rows. Catalog stays24.
- [L10](../.docs/tests/test-dongguo-demo.md#L10) Read all30demo frames and original/source explanation; the narrative includes杏树、老牛、丈人、再囊 and original狼被杀结尾; all story text and every image hash match the completed desktop story, and no blank frames occur. No generated replacement asset is referenced. PDF/PNG export readiness passes without paid generation.
- [L11](../.docs/tests/test-dongguo-demo.md#L11) Actual in-app desktop preview if enabled: sample card, opening, paging and end return show new identity/art. If host disables browser, record exact limitation and use router/media/seed integration plus UI-source assertions; do not substitute another browser session.
- [L13](../.docs/tests/test-dongguo-demo.md#L13) Save page29 through ordinary me/progress, reopen and resume it, and POST a complete event atpage29. Reject page30 for this30-frame story and page60 globally; maintain hidden-story/status checks. No generation call occurs.

#### Empty first run and existing library compatibility

[.docs/tests/test-empty-library.md](../.docs/tests/test-empty-library.md)

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-empty-library.md#L3) Fresh isolated database: GET stories and progress empty; admin seed and reopen remain empty;24 book choices still present. Browser discovers books/creation action and empty bookshelf, no demo art or sample links.
- [L4](../.docs/tests/test-empty-library.md#L4) Existing fixture: store ordinary saved story with /art/pear-1.png and another /art/dongguo-1.png plus generated session/progress. Copy legacy images into private media. Start/reseed/reopen: exact row data/progress unchanged, both GET/HEAD images readable at old URLs, invalid paths/missing files fail closed, symlinked private media cannot escape.
- [L5](../.docs/tests/test-empty-library.md#L5) Actual user libraries: read-only before/after checks retain every saved record, narrative/source and previously saved image URL; this task performs no DB writes/deletions. Record concurrent reading/generation progress separately rather than rolling it back. Copied needed images match original hashes; existing generated Dongguo session30pages/art remains intact. No generation is initiated by this task.
- [L6](../.docs/tests/test-empty-library.md#L6) History: recoverable external backup, independent mirror scoped redaction with identical intended tip, preserved branch/commit/code graph, all-object denied demo absence, fsck and24-book hashes. Remote unchanged by this task; stale local origin ref handled separately from remote state.

#### Reader UI audit fixes: in-app scenarios

[.docs/tests/test-reader-ui-audit-fixes.md](../.docs/tests/test-reader-ui-audit-fixes.md) — **Review applicability: legacy-term references.**

Authored sections:
- [Execution evidence — 2026-10-29](../.docs/tests/test-reader-ui-audit-fixes.md#L14)

Authored numbered scenario/step statements:
- [L5](../.docs/tests/test-reader-ui-audit-fixes.md#L5) Home: return to the top. Resume and new-story actions are visible above fixed navigation at the existing viewport and 390×844. Open and close the new-story chooser without requesting suggestions.
- [L6](../.docs/tests/test-reader-ui-audit-fixes.md#L6) Shelf: show all stories. Verify truthful totals, compact cover/book/tools/footer order, matching 44px icons and unchanged full-width structure. Search for an existing title; matched/total count and reset are visible. Search an impossible title; reset recovers the list. Toggle favorites, then reset to all stories.
- [L7](../.docs/tests/test-reader-ui-audit-fixes.md#L7) Recovery: record the selected story's saved/page/checkpoint fields. Delete through confirmation; the count decreases and Undo appears. Undo restores the story. Delete again, reload, navigate to Me → deleted stories and restore it. Original progress/favorite/content fields match; no generation is dispatched. Leave all original deletion markers unchanged.
- [L8](../.docs/tests/test-reader-ui-audit-fixes.md#L8) Me: library/favorite counts agree with Shelf; deleted stories opens a titled list with dates and Restore controls. Preferences and normal navigation remain usable.
- [L9](../.docs/tests/test-reader-ui-audit-fixes.md#L9) Reader: open a fully generated story. Theme precedes style, metadata is legible, narration and source/settings/navigation remain usable. Open the ending; next-story, export and source remain, and disabled sharing controls are absent. Do not start generation.
- [L10](../.docs/tests/test-reader-ui-audit-fixes.md#L10) Finish: clear test filters, restore viewport overrides, retain the relevant preview tab and save screenshots for Home, Shelf, Reader and Me/recovery.

### Library storage, migrations and server boundaries — written specifications

#### Consolidate story storage — executable verification contract

[.docs/tests/test-consolidate-story-storage.md](../.docs/tests/test-consolidate-story-storage.md) — **Review applicability: legacy-term references.**

Authored sections:
- [C01 — Fresh and current-only libraries](../.docs/tests/test-consolidate-story-storage.md#L5)
- [C02 — Mixed studio/demo/production purge](../.docs/tests/test-consolidate-story-storage.md#L13)
- [C03 — Backup requirement and rollback at every boundary](../.docs/tests/test-consolidate-story-storage.md#L21)
- [C04 — Real process interruption and desktop race](../.docs/tests/test-consolidate-story-storage.md#L29)
- [C05 — Older backups and D1/R2 imports](../.docs/tests/test-consolidate-story-storage.md#L37)
- [C06 — Newer or unknown schema refusal](../.docs/tests/test-consolidate-story-storage.md#L45)
- [C07 — Browser caches and complete identity scope](../.docs/tests/test-consolidate-story-storage.md#L53)
- [C08 — Desktop/browser/CLI and durable workflow behavior](../.docs/tests/test-consolidate-story-storage.md#L61)

#### 书库维护与发布检查验收

[.docs/tests/test-library-recovery-diagnostics-release.md](../.docs/tests/test-library-recovery-diagnostics-release.md)

Authored sections:
- [无服务 CLI 验收（!!）](../.docs/tests/test-library-recovery-diagnostics-release.md#L14)

Authored numbered scenario/step statements:
- [L5](../.docs/tests/test-library-recovery-diagnostics-release.md#L5) 完整库含故事、旧新版本、暂停/失败任务、阅读进度和媒体：停服备份→校验→恢复到新目录→只读启动，比较数据与媒体哈希，旧库不变。
- [L6](../.docs/tests/test-library-recovery-diagnostics-release.md#L6) 已有目标、源目标嵌套、缺文件、增加文件、篡改、清单路径越界及符号链接：拒绝，已有目标/库/外部文件不变，无半恢复库。
- [L7](../.docs/tests/test-library-recovery-diagnostics-release.md#L7) 服务持有书库锁：备份拒绝；停服释放后可备份。维护操作在无提供方配置与禁止网络下成功。
- [L8](../.docs/tests/test-library-recovery-diagnostics-release.md#L8) 旧结构库升级：迁移前生成旧结构备份且可恢复，重新打开不重复备份。快照失败时旧结构和媒体不变；失败迁移的已验证备份仍保留。
- [L9](../.docs/tests/test-library-recovery-diagnostics-release.md#L9) 开发/CLI/桌面启动和已知任务错误产生安全事件；任意错误正文、密钥、原文、路径不进入日志/诊断；大量事件轮换后容量有界，写日志失败不破坏生产。
- [L10](../.docs/tests/test-library-recovery-diagnostics-release.md#L10) 正常/损坏/缺失数据库导出诊断：受限版本与计数可读，绝不复制Document、selection、错误原文或凭据；输出不覆盖已有文件。
- [L11](../.docs/tests/test-library-recovery-diagnostics-release.md#L11) 本地发布门执行现有E2E，E2E失败会阻止后续发布；tag检查依旧针对发布提交，保留用户工作区。
- [L12](../.docs/tests/test-library-recovery-diagnostics-release.md#L12) 执行现有 `pnpm test:e2e`，确认新增服务锁、迁移快照和诊断不改变新建/编辑/暂停/重试/替换的正式流程。C007 在一次性源码根目录运行真实 `pnpm dev local`，checkout 内人工 dev-local 与其占用服务均不受影响。
- [L16](../.docs/tests/test-library-recovery-diagnostics-release.md#L16) 从本地 npm 包读取技能原文与 JSON；在隔离 cwd 安装技能，比较包内字节，重复安装幂等，不同内容/符号链接拒绝覆盖。全程禁止监听/网络，目录中无数据库与默认书库改变；包缓存移走后安装副本仍可读。技能所述命令与完整故事流程测试对应。
- [L18](../.docs/tests/test-library-recovery-diagnostics-release.md#L18) skill install --scope global 使用隔离 HOME 落在其 .agents/skills/shiqu/SKILL.md；与调用 cwd 无关，可从另一项目读取。测试实际安装包入口与幂等，拒绝不同内容/符号链接，不写真实 home。project 与 global 共享安全约束，未指定范围拒绝。
- [L20](../.docs/tests/test-library-recovery-diagnostics-release.md#L20) 实际 CLI 子进程在全新 home/data-dir 执行 help/catalog/init/status/list/get；stdout 可独立 JSON.parse，失败非零并有code；确认没有 HTTP 监听/浏览器/桌面进程，没有配置密钥问答和真实模型调用。无子命令仍按现有服务启动测试通过。
- [L21](../.docs/tests/test-library-recovery-diagnostics-release.md#L21) 同一正式dispatcher+受控provider执行新建、按条件提取、选择、准备、确认、分镜审修、生图、暂停/恢复/重试及修改新版本；验证每次非run命令零生成，run只执行指定故事，其他背景故事未获得付费请求。
- [L22](../.docs/tests/test-library-recovery-diagnostics-release.md#L22) 请求重放不多建版/多调用；旧generation/token/fault/版本拒绝；run遇暂停/失败/需要选择/确认/修订上限立即给出可操作结果。run timeout与中断保存/释放，后续显式run可继续且不重复保存结果。
- [L23](../.docs/tests/test-library-recovery-diagnostics-release.md#L23) 完整故事通过共享导出实现生成公开ZIP/内部ZIP、PDF/PNG及HTML预览；验图片可读、WebP水印绘制/XMP/hash、原文署名、公开文件布局、原图不变。未署名无显式允许时拒绝；缺图/旧版本拒绝完整导出。恶意故事文本在HTML中仅为文字。
- [L24](../.docs/tests/test-library-recovery-diagnostics-release.md#L24) npm本地包在隔离目录运行headless init/help/read/maintenance及native导出依赖加载，不发布。现有浏览器导出与测试复用共享核心后仍通过，不能用headless测试替代浏览器回归。
- [L26](../.docs/tests/test-library-recovery-diagnostics-release.md#L26) 对 api suggestions/art-recommendation/advance、历史admin生成及未知路由注入计数provider，全部拒绝且调用数为0；普通保存/确认允许写状态但保持0调用，只有显式run执行。

#### Node React migration E2E

[.docs/tests/test-node-react-local.md](../.docs/tests/test-node-react-local.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-node-react-local.md#L3) Fresh data: with no key and empty mounted directory, start Node and Docker. /api/stories returns the sample; / and /read?id=&lt;sample&gt; render; sample images and original are available; /api/reader/status reports generation unavailable.
- [L4](../.docs/tests/test-node-react-local.md#L4) Persistence: save sample progress, create a mocked generated session and media, soft-delete and restore. Restart against same directory. Rows, media bytes, source, progress and deletion state survive; seed never overwrites edits.
- [L5](../.docs/tests/test-node-react-local.md#L5) Generation: mocked delayed Gemini planning/image requests acquire one SQL checkpoint under duplicate advances. Retry cooldown, manual retry and stale-lock recovery keep current behavior. No real Gemini request.
- [L6](../.docs/tests/test-node-react-local.md#L6) HTTP boundary: supplied identity headers cannot change local owner; cross-origin mutations fail; traversal, data/.env and unknown API routes do not expose files or return SPA HTML. Upload and read media with correct MIME. /read deep-link refresh renders SPA.
- [L7](../.docs/tests/test-node-react-local.md#L7) Legacy conversion: import a stopped fixture containing real-layout D1/R2 records and metadata/blob files into a new directory, verify all expected tables, source JSON and media bytes; source unchanged. Invalid or incomplete blob data leaves no successful target. Existing target refused.
- [L8](../.docs/tests/test-node-react-local.md#L8) Bind mounts: default Compose uses ./data. Override to a path containing spaces with test host UID/GID on Linux, write progress/media, recreate container, verify host-visible SQLite/media and retained values. Container runs non-root. Stop before folder backup; restore copy starts with same data.
- [L9](../.docs/tests/test-node-react-local.md#L9) Browser: in-app browser production UI opens, reads sample, flips pages, opens source and settings, exports PDF, returns home, reloads a deep link. Assert no relevant console/network failures. Inspect desktop and narrow viewport.

#### Git history cleanup flows

[.docs/tests/test-purge-old-book-history.md](../.docs/tests/test-purge-old-book-history.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-purge-old-book-history.md#L3) Before rewrite: snapshot HEAD/ref map/index/current tracked files/untracked CHANGELOG and full Git metadata to a private folder outside the repository. Restore-read the backup and confirm identical refs/HEAD and Git integrity.
- [L4](../.docs/tests/test-purge-old-book-history.md#L4) Independent mirror: remove exactly the enumerated obsolete source paths/blob copies and old embedded source literals. Verify current tracked HEAD tree unchanged and all commits retain non-source files, authors and parent mapping; unaffected branches/captures remain.
- [L5](../.docs/tests/test-purge-old-book-history.md#L5) Activation: compare original live refs/index/status/files to the snapshot. Apply all ref updates atomically with expected-old hashes; any concurrent change aborts. Original remote remains unchanged and its old tip is saved outside the repository.
- [L6](../.docs/tests/test-purge-old-book-history.md#L6) After cleanup: removed path/blob/literal counts are zero across local refs and object store; fsck passes;24 current book manifests validate; tracked application/data bytes and user CHANGELOG are unchanged. Backup remains independently recoverable. Source notices distinguish cleaned local history from unchanged GitHub history.

#### Retire legacy studio: focused regression

[.docs/tests/test-retire-legacy-studio.md](../.docs/tests/test-retire-legacy-studio.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L5](../.docs/tests/test-retire-legacy-studio.md#L5) With cached old-studio reading history and a delayed current session list, load discovery. The hero shows its loading placeholder, makes no retired studio requests, then shows the newest readable current story.
- [L6](../.docs/tests/test-retire-legacy-studio.md#L6) Delay deletion hydration instead of session loading. The hero remains loading and never exposes a deleted story. When all data settles, only current visible versions are shown.
- [L7](../.docs/tests/test-retire-legacy-studio.md#L7) Open a current story deep link, advance a page, favorite, reload, delete and restore. Current progress/favorite state survives and restoration starts no inference by itself.
- [L8](../.docs/tests/test-retire-legacy-studio.md#L8) Against isolated desktop runtime, verify current-session reads/writes across service restart and existing direct/LAN/internet access guards. Verify the desktop summary uses the same persisted session.
- [L9](../.docs/tests/test-retire-legacy-studio.md#L9) Old studio endpoints return 404 and cannot create content or call inference. Shared media reads and current reader routes remain functional. Historical tables survive reopen unchanged.

#### Shared story library E2E

[.docs/tests/test-shared-story-library.md](../.docs/tests/test-shared-story-library.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-shared-story-library.md#L3) With isolated native settings, verify development resolves the native library and a saved custom desktop directory; explicit environment/.env data path wins, malformed native settings fail without creating a new shelf. Unauthenticated direct/raw/@fs requests for old/new library SQLite/media/backups are denied while frontend/HMR load. No credentials are returned; development stays LAN-accessible for phone testing while unpaired API requests are rejected and paired same-origin requests succeed.
- [L4](../.docs/tests/test-shared-story-library.md#L4) Start desktop and development handlers on separate real SQLite connections to one fixture library. Pair desktop, create/read a story from each side, update progress and fetch media across both. Submit the same script/image demand concurrently: one paid step, no duplicate usage or lost images. Leaving/stopping one entry does not revoke the other viewer or release its active lease.
- [L5](../.docs/tests/test-shared-story-library.md#L5) Stop both actual writers, archive source and target, compare conflicting keys, merge through staging. Verify all original reader_sessions/stories IDs, row counts/meaningful progress, referenced media SHA256, source/plan/image hashes for 东郭先生, and SQLite integrity. Preserve tombstones, queued receipts, source and backups.
- [L6](../.docs/tests/test-shared-story-library.md#L6) Restart both real entry points with the compatible current payload. Verify each opens Application Support/library/shiqu.sqlite and returns the same visible story IDs including 东郭先生. Check desktop unauthenticated401 and paired200, image routes readable from both, and no newly paid verification calls. Retain evidence and backup paths without exposing keys/pairing tokens.

### CLI startup, settings and configuration — written specifications

#### Browser provider settings E2E

[.docs/tests/test-browser-provider-settings.md](../.docs/tests/test-browser-provider-settings.md)

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-browser-provider-settings.md#L3) Isolated actual pnpm dev: save fake Google provider/key/models/reasoning, open 我的 → 生成服务与模型, verify saved and running sections. Change saved model/reasoning; save/reload shows persistence and restart required while /api/reader/status remains on old running model. Restart fixture and verify runtime uses new settings.
- [L4](../.docs/tests/test-browser-provider-settings.md#L4) Provider profiles/key handling: switch Google/OpenAI/Codex/readonly, preserve inactive models, use password input for a new fake key, save clears input, reads never return the key. Keep and remove actions behave explicitly. No inference or connection test runs.
- [L5](../.docs/tests/test-browser-provider-settings.md#L5) Concurrent edit: modify the saved revision through the fixture's production store, submit stale UI, verify safe conflict and preserved draft, reload latest then save. Invalid model/effort/unrelated field requests do not mutate settings.
- [L6](../.docs/tests/test-browser-provider-settings.md#L6) Actual CLI browser mode: settings API reads/writes the same saved store, uses startup/runtime status, preserves normal explicit overrides and full explicit corrupt-store startup compatibility. A CLI/skill config read sees browser-saved values after the browser stops.
- [L7](../.docs/tests/test-browser-provider-settings.md#L7) Access boundary: fake socket contexts and real listeners verify remote peers/foreign or LAN Host/cross-origin/forwarded-header spoof requests are denied. Vite guard checks original remote peers before proxy including normalized dot-path variants; LAN reader requests still succeed. Development settings require private proxy proof, so a legacy/unguarded Vite proxy and direct internal API-port access fail closed; CLI loopback settings remain available. The nonce is absent from responses. Native desktop/generic app settings route is unavailable.
- [L8](../.docs/tests/test-browser-provider-settings.md#L8) In-app browser: inspect desktop and narrow layouts, dialog focus/close, visible status, validation feedback, save/reload and cleared fake credential input. Use only an isolated fixture; stop and remove it after verification.

#### CLI 共享书库与桌面单版验证

[.docs/tests/test-cli-shared-library-no-lite.md](../.docs/tests/test-cli-shared-library-no-lite.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-cli-shared-library-no-lite.md#L3) 临时用户目录无配置、无库：非交互启动失败并提示 --data-dir，不产生库；终端确认建议目录后创建 SQLite，重启复用确认路径。取消/EOF 不产生配置或库。
- [L4](../.docs/tests/test-cli-shared-library-no-lite.md#L4) 临时桌面设置只含 desktop_settings：保存目录不存在，CLI 不询问并创建；放入真实故事/图片/阅读进度后，在相同版本桌面服务打开可读。反向桌面写入后 CLI 可读。凭据表不需要读取。
- [L5](../.docs/tests/test-cli-shared-library-no-lite.md#L5) 桌面保存目录和显式 --data-dir/SHIQU_DATA_DIR 冲突：显式选择生效，相对路径按调用目录解析。桌面配置损坏明确报错，显式目录可绕过；--help/--version 无副作用。
- [L6](../.docs/tests/test-cli-shared-library-no-lite.md#L6) 已有 CLI 独立库：不删除、不合并；使用 --data-dir 可继续读取。没有桌面配置但默认桌面目录已有 shiqu.sqlite 时直接复用。
- [L7](../.docs/tests/test-cli-shared-library-no-lite.md#L7) 两个 CLI 或 CLI/桌面尝试同一库：仅一个成功。正常停止、端口占用及启动配置失败后占用释放，随后可重启；陈旧占用回收不能让并发新实例同时成功。所有数据使用临时目录，无真实 AI 请求。
- [L8](../.docs/tests/test-cli-shared-library-no-lite.md#L8) 静态检查 Lite 构建命令、override、UI 选项、发布分支移除。桌面必须始终使用内置 Node，旧 nodePath 不影响运行时。CI 仅上传并校验两平台原 standard 命名安装包。README 及指南的本地链接有效。

#### Installed npm CLI scenarios

[.docs/tests/test-npm-cli.md](../.docs/tests/test-npm-cli.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-npm-cli.md#L3) Build with pinned Node 24.22.1 and pnpm 11.25.0. Inspect the actual tarball: name/version/bin/engines are correct, runtime dependencies are declared, original-book bytes and license notices match, and no private state, checkout symlinks, source maps, development sources, or install scripts are included.
- [L4](../.docs/tests/test-npm-cli.md#L4) Install the tarball with production dependencies into a fresh temporary directory outside the checkout. Run the installed bin from a different directory with spaces in its name. `--help` and `--version` succeed without creating data; unknown flags, missing arguments, invalid ports, and unsupported Node versions fail clearly without creating data.
- [L5](../.docs/tests/test-npm-cli.md#L5) Start with a free local port and an explicit fresh data directory. GET the reader and one compiled browser asset, books, empty shelf, reader status, and progress. Resolve all 24 bundled books using installed resources. Confirm no paid generation occurs and no files appear in the caller or package directories.
- [L6](../.docs/tests/test-npm-cli.md#L6) Reject foreign Host/Origin requests using the existing access middleware. Create a draft via the API, terminate with SIGTERM, restart against the same data directory, and confirm the saved draft survives. Confirm normal exit and immediate port reuse.
- [L7](../.docs/tests/test-npm-cli.md#L7) Exercise explicit env-file loading and CLI precedence over environment. Confirm default OS user-data directory selection and loopback host, and that relative data/env paths resolve against the caller rather than the installed package.

#### Shared development settings E2E

[.docs/tests/test-shared-development-settings.md](../.docs/tests/test-shared-development-settings.md)

Authored numbered scenario/step statements:
- [L5](../.docs/tests/test-shared-development-settings.md#L5) In a disposable home save Google provider, fake API key, distinct text/image models and per-task reasoning, plus a disposable library. Put conflicting Codex/provider/key/model/library values in the disposable checkout's `.env`. Start actual `pnpm dev` on free frontend/backend ports. GET `/api/reader/status` must identify saved Google models/reasoning and configured=true; status/logs must not contain the key. The library must be the saved disposable path; the poisoned `.env` path must not exist. Stop and verify both listeners close and saved settings are unchanged.
- [L6](../.docs/tests/test-shared-development-settings.md#L6) Repeat actual dev startup with explicit shell `readonly` and an explicit library directory. Status must report readonly and the selected shelf must be used, with saved Google configuration unchanged. No inference may run.
- [L7](../.docs/tests/test-shared-development-settings.md#L7) Run existing local-isolation startup with an isolated home, saved provider defaults, and a conflicting explicit shared library. `pnpm dev local` must use only the disposable checkout's `.data/dev-local`, retain private-file download denial, close both ports, and leave the conflicting library unopened.

#### Shared provider setup E2E

[.docs/tests/test-shared-provider-setup.md](../.docs/tests/test-shared-provider-setup.md) — **Review applicability: legacy-term references.**

Authored sections:
- [Execution — 2026-10-31](../.docs/tests/test-shared-provider-setup.md#L11)

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-shared-provider-setup.md#L3) Temporary new home/library: CLI prompts provider, hidden key input is not echoed, cancellation/EOF leaves previous provider config/keys unchanged. Confirm each provider/read-only choice, restart and verify no repeat setup.
- [L4](../.docs/tests/test-shared-provider-setup.md#L4) Use a valid v1 desktop.sqlite with Gemini key and custom library. CLI migrates/reuses it without prompt; Rust can read the new schema and TS can read native-saved OpenAI selection/key. Neither settings views nor HTTP return key bytes.
- [L5](../.docs/tests/test-shared-provider-setup.md#L5) CLI --configure switches provider and remembers each key/model; blank saved-key input retains only the selected provider's existing key. --reset-providers removes saved provider data but preserves stories, progress, library/network settings; interactive setup follows, noninteractive reset exits with guidance.
- [L6](../.docs/tests/test-shared-provider-setup.md#L6) Explicit environment/config overrides win for one invocation, are never saved/imported and do not accidentally combine another provider's key. Partial/missing API setup and fresh non-TTY launch fail clearly, help/version have no side effects.
- [L7](../.docs/tests/test-shared-provider-setup.md#L7) Mock OpenAI Responses text/schema/reasoning/store:false and image-generation/edit requests, use an existing image as the edit reference, validate returned bytes; malformed/incomplete/refused output, HTTP auth/quota/server errors and network failures remain safe and preserve saved work. No live provider calls.
- [L8](../.docs/tests/test-shared-provider-setup.md#L8) Desktop Vite preview in the existing in-app browser: setup view, OpenAI/Codex/Gemini/read-only choices, provider-specific model/key fields, saved-key indicators and reset affordance. Native local tests verify secret-free views, private stdin, migration, metadata-only connection checks and environment override behavior.
- [L9](../.docs/tests/test-shared-provider-setup.md#L9) Read-only startup against an unfinished story never dispatches jobs; normal provider startup and existing CLI/desktop exclusive-library lifecycle remain covered by regression suites. Native installer packaging and registry publication remain outside scope.

### Provider adapters, schemas and reasoning — written specifications

#### Claude CLI integration scenarios

[.docs/tests/test-claude-cli-comparison.md](../.docs/tests/test-claude-cli-comparison.md)

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-claude-cli-comparison.md#L3) With a fake Claude executable and isolated library, select `SHIQU_AI_PROVIDER=claude` through the ordinary headless CLI. Run a source-backed story to reviewed. Expect shared generation/review checkpoints, provider/model identity, saved revisions when needed, and zero image calls.
- [L4](../.docs/tests/test-claude-cli-comparison.md#L4) With absent or API-only auth, run status and generation. Expect a safe login/subscription error before inference, with no fallback API/network provider.
- [L5](../.docs/tests/test-claude-cli-comparison.md#L5) A fake executable returns structured JSON/model usage, invalid output, tool attempts, nonzero result, oversized output or hangs. Expect valid receipts only for success; reject unsafe/invalid output and kill timed-out or cancelled process groups without logging raw content.
- [L6](../.docs/tests/test-claude-cli-comparison.md#L6) With the user's authenticated CLI, create an independent fire-mountain story using preserved source ranges/settings, prepare and confirm through production CLI, then run to reviewed. Expect source/context hashes equal the earlier comparison, all passed review checkpoints, readable text result and no image generation. Authentication/service failures are a blocked live scenario, not a pass.

#### Codex effort verification

[.docs/tests/test-codex-reasoning-effort.md](../.docs/tests/test-codex-reasoning-effort.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L5](../.docs/tests/test-codex-reasoning-effort.md#L5) Environment runner: fake CLI simulates inherited high. With the env unset/blank no override is sent; explicit low/medium/high/xhigh/max produces the matching CLI config override and thread effort. Invalid light/uppercase/injection values fail before process spawn. Effective config or thread mismatch fails before turn/start.
- [L6](../.docs/tests/test-codex-reasoning-effort.md#L6) Real installed CLI: explicit low status succeeds after config/read confirms low; no model inference is requested. This proves local CLI configuration feasibility, not output quality or every model's support.
- [L7](../.docs/tests/test-codex-reasoning-effort.md#L7) Native storage: read SQLite settings and legacy settings.json omitting codexReasoningEffort, observe inherit; save low/high and reopen SQLite, observe exact persisted field. Reject illegal value without changing prior settings or credential. Run for Standard and Lite feature sets.
- [L8](../.docs/tests/test-codex-reasoning-effort.md#L8) Desktop bridge: parse missing and explicit values, map to CODEX_REASONING_EFFORT, verify invalid values rejected. Existing pairing/lifecycle/secret isolation suites stay passing.
- [L9](../.docs/tests/test-codex-reasoning-effort.md#L9) UI: load the actual desktop settings frontend using a controlled native IPC fixture in a test browser; select Codex, choose low, save, reload and see low; change high and verify save-before-start/connection-check; while running or pending, field disabled. Gemini hides the field without erasing its value. Inspect narrow layout at the supported native minimum width760. Prefer the in-app browser; if its known tool gate persists, disclose and use a separate Playwright test session.

#### Codex provider acceptance flows

[.docs/tests/test-codex-subscription.md](../.docs/tests/test-codex-subscription.md) — **Review applicability: legacy-term references.**

Authored sections:
- [Executed evidence](../.docs/tests/test-codex-subscription.md#L11)

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-codex-subscription.md#L3) Default Gemini: with no SHIQU_AI_PROVIDER, status and no-key sample behavior stay unchanged; existing mocked Gemini suggestions/planning/images and retry/concurrency tests pass.
- [L4](../.docs/tests/test-codex-subscription.md#L4) Codex status: missing CLI or signed-out/API-key login returns unconfigured status and safe actionable explanation. ChatGPT-only executable readiness enables generation without GEMINI_API_KEY. Invalid provider config cannot silently choose Gemini.
- [L5](../.docs/tests/test-codex-subscription.md#L5) Codex generation: fake subprocess produces structured suggestions and a valid eight-page plan, then image bytes; first image persists and is attached on subsequent scene jobs. Production prompt, requested style and source metadata remain present. Custom webpage URL sources return a clear Gemini-mode requirement; book-name original passages use existing checked retrieval. Restart continues existing saved steps.
- [L6](../.docs/tests/test-codex-subscription.md#L6) Failure boundaries: invalid JSON/page count, path-only image results, invalid image signatures/bytes, timeout, oversized output and nonzero CLI exit cannot save fabricated content or leak stdout/stderr/credentials. No alternate provider request. Temporary job files/processes are removed.
- [L7](../.docs/tests/test-codex-subscription.md#L7) CLI isolation: argv contains no user prompt; stdin contains only intended story data/instructions; child environment excludes all API/provider credentials. ChatGPT-only login restriction, bounded execution and unrelated tool disabling are verified. Duplicate REST advances acquire only one generation job.
- [L8](../.docs/tests/test-codex-subscription.md#L8) Local actual CLI probe: short structured text and one image only when needed to establish feasibility, using the existing ChatGPT sign-in. Record capability/network/permission failures honestly. No OpenAI API or Gemini billing fallback.
- [L9](../.docs/tests/test-codex-subscription.md#L9) Docker: default data bind remains unchanged. Optional Codex login mount is distinct from /data and uses non-root identity, missing mount is actionable, CLI exists in selected image, login/status commands work without exposing auth contents. Keys/auth are absent from image/source/frontend.

#### 提示词清理验收场景

[.docs/tests/test-prompt-contract-cleanup.md](../.docs/tests/test-prompt-contract-cleanup.md)

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-prompt-contract-cleanup.md#L3) **阶段与提供方契约**：受控 Codex/Gemini/OpenAI transport 记录实际请求。分别调用选题、幅数、提纲、分批与整篇分镜、标题结语、审核、修订、绘图构建器。核对阶段任务单一、输出和 schema 一致、字段仍为数据、主题隔离、画风和用户要求传递不变；不实际绘图。
- [L4](../.docs/tests/test-prompt-contract-cleanup.md#L4) **兼容输入**：使用重构前的冻结指纹和旧自动预设。读取 v2 选题缓存、加载已保存原文/分镜；旧默认要求归一化，用户自写要求逐字保留；不重写现有书库。
- [L5](../.docs/tests/test-prompt-contract-cleanup.md#L5) **复杂故事文字对比**：相同原文、选题和模型/档位下，对比重构前后自动幅数/提纲，并审核已知截断的连环计 18 幅。检查起因、关键选择、决定性行动、原文结果和开场；截断稿必须要求重编，不直接绘图。
- [L6](../.docs/tests/test-prompt-contract-cleanup.md#L6) **短篇与对白**：使用短小独立故事和长对白/比喻文本，对比配文可读性、说话归属、条件/对象、关键反应与画面变化；不得靠凑幅或心理解说弥补理解。
- [L7](../.docs/tests/test-prompt-contract-cleanup.md#L7) **边界与误报**：原作开放结尾或明确指定片段，允许其自然结束，不要求补造结果；结语可以凝练抽象，不以未点名人物而误报；全篇结构缺失仍与局部文字问题分开。
- [L8](../.docs/tests/test-prompt-contract-cleanup.md#L8) **已有流程**：全量本地测试验证审片/修订/重编/绘图闸门和缓存、原文、版本、只读模式保持正确；类型检查和 lint 通过。

#### Separate text and image providers scenarios

[.docs/tests/test-separate-text-image-providers.md](../.docs/tests/test-separate-text-image-providers.md)

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-separate-text-image-providers.md#L3) Existing settings without `imageProvider` (TS and native): image follows the text provider; settings JSON, credentials, runtime variables and status match the previous behaviour.
- [L4](../.docs/tests/test-separate-text-image-providers.md#L4) Codex text with Gemini images through the production provider and the real production queue: every frame request reaches Gemini, text/storyboard calls stay on Codex, image timeouts come from Gemini, status reports both models.
- [L5](../.docs/tests/test-separate-text-image-providers.md#L5) A failed image request through `withLocalBooks` uses the image provider's safe message; text failures keep the text provider's message.
- [L6](../.docs/tests/test-separate-text-image-providers.md#L6) Status is unconfigured and names the image service when the separate API image key is missing; read-only ignores any image setting; an invalid image provider fails clearly for generating modes.
- [L7](../.docs/tests/test-separate-text-image-providers.md#L7) Settings store: list key changes for both active providers; an unused provider's key cannot be changed; "same as text" and `null` are stored as unset; reset clears the image provider.
- [L8](../.docs/tests/test-separate-text-image-providers.md#L8) Invocation overrides: `SHIQU_IMAGE_PROVIDER` and env keys apply for one run without saving; saved image keys are read only for the effective image provider.
- [L9](../.docs/tests/test-separate-text-image-providers.md#L9) CLI `--configure` (scripted and PTY): image question follows the text provider; Enter keeps saved choices and keys; separate API image side asks its own key and image model; cancellation never partially saves.
- [L10](../.docs/tests/test-separate-text-image-providers.md#L10) Desktop: connection check validates text and image sides with their own keys/models; native Rust store, readiness, env overrides and TS↔Rust database interop include `imageProvider`; Vite preview shows text/image selectors, separate key/model or Codex fields, read-only hiding and no 390px overflow.

#### 按任务推理验收

[.docs/tests/test-task-reasoning-effort.md](../.docs/tests/test-task-reasoning-effort.md)

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-task-reasoning-effort.md#L3) 旧桌面设置无任务字段：读取补推荐默认；保存/重启保持七任务配置和既有密钥；非法任务/档位拒绝且不删除密钥。
- [L4](../.docs/tests/test-task-reasoning-effort.md#L4) 同一 Codex runner 连续/并发请求不同档位，分别在子进程 config 和 thread 响应确认；任务配置优先于旧全局，不支持/未采用值拒绝调用；status 无推理。
- [L5](../.docs/tests/test-task-reasoning-effort.md#L5) 两提供方七类任务发送对应档位；review/repair/outline/planBatch 的任务来自明确参数。Gemini 不支持的显式值拒绝，不降档；图片调用保持原语义。
- [L6](../.docs/tests/test-task-reasoning-effort.md#L6) 选题与画风缓存更改对应任务档位后不能命中另一档位结果；无关任务配置变化不重复通读。
- [L7](../.docs/tests/test-task-reasoning-effort.md#L7) 应用内打开 pnpm desktop:preview 的设置页，看到七任务默认配置及提供方允许档位；浏览器预览仍只读，不保存真实设置。
- [L8](../.docs/tests/test-task-reasoning-effort.md#L8) 显式运行真实对比脚本，输入为备份原版《大葫芦》；medium/high/xhigh 固定模型、输入、提示且各运行一次，输出经正式 schema 验证。报告有用量/耗时/错误及质量分析，试验前后书库配文、提示和图片哈希一致。

### Images, references, publication and export — written specifications

#### 每本书星标参考服务端到端

[.docs/tests/test-book-reference-star.md](../.docs/tests/test-book-reference-star.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L5](../.docs/tests/test-book-reference-star.md#L5) 无星时新故事第一幅无参考，第二幅参考自身首图；为同书另一篇已保存的第N幅设星，读取各篇得到同一书级选择，其他书为空。
- [L6](../.docs/tests/test-book-reference-star.md#L6) 同书新故事第一幅及后续实际请求带星标字节；重启后仍可使用。星标操作没有编排、生图或阅读进度/收藏副作用。
- [L7](../.docs/tests/test-book-reference-star.md#L7) 在一幅调用未结束时换星：在途调用仍持旧字节，之后派发用新字节，已存图与成功待发布回执不丢弃，不重新付费；随后取消，下一篇第一幅无参考、后续恢复自身首图。
- [L8](../.docs/tests/test-book-reference-star.md#L8) 并发设星唯一，迟到取消旧图不清新图，A→B→A同页重设也需新token保护；同书不同故事只一个选中，跨书与跨owner不串。删除源故事后无星且恢复不自动重新设星；未发布/删除/其他owner故事拒绝。
- [L9](../.docs/tests/test-book-reference-star.md#L9) 负数/越界/无图/客户端伪造URL/跨站写入拒绝；无效类型、过大或缺失源媒体不改旧星。已保存快照不可读取时模型前报错，不偷偷调用无参考；用户仍可取消。
- [L10](../.docs/tests/test-book-reference-star.md#L10) 三provider捕获实际图片附件：page0支持参考、后续支持参考，且无星时旧契约保持；复制到目标namespace，原跨story引用校验仍拒绝。legacy生成也通过同一helper；有效星标且本篇首图文件丢失时仍使用星标，无星时维持原有lost-image错误。
- [L11](../.docs/tests/test-book-reference-star.md#L11) UI星标有正确aria-label/pressed/disabled，只有实际画幅按钮、结语不显示。状态加载/保存错误不假亮；翻页/换故事和请求乱序不串状态。浏览器不可用时仅确认静态/逻辑契约，未视觉验收。
- [L12](../.docs/tests/test-book-reference-star.md#L12) 旧库升级新增空表，不自动设星，不改变故事、图片作业和回执；重启幂等，旧库不要求具备0010，由导入后openDatabase创建空表；已有导入/队列/版本测试继续通过。

#### Image dimension boundary scenarios

[.docs/tests/test-image-dimensions.md](../.docs/tests/test-image-dimensions.md)

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-image-dimensions.md#L3) With controlled Codex and Gemini providers and empty storage, generate a valid portrait result. Inspect outbound ratio/size instructions, saved MIME/extension and returned asset. Repeat with wrong ratio, too-small and truncated results: fail with no new asset.
- [L4](../.docs/tests/test-image-dimensions.md#L4) With a queued reader story ready for images, return wrong dimensions. Observe failed image job and unchanged page asset, no repeated call from passive demand; explicit retry with a valid portrait succeeds.
- [L5](../.docs/tests/test-image-dimensions.md#L5) With a seeded admin draft and controlled transport, generate using default and valid larger IMAGE_SIZE; verify outbound size/2:3 instructions and actual saved MIME. Invalid override must make zero transport calls. Invalid returned dimensions fail the job, preserve the page/revision and write no media. Cover both inline bytes and downloaded image response.
- [L6](../.docs/tests/test-image-dimensions.md#L6) Existing saved images/reference loading and manual upload contracts continue through existing suites; run without real inference or image generation.

#### 图片保存冲突后的恢复场景

[.docs/tests/test-image-publication-recovery.md](../.docs/tests/test-image-publication-recovery.md)

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-image-publication-recovery.md#L3) 受控故事已保存部分图片，旧 image version 有 queued/failed/正在生成任务；当前 version 继续制作。观察和重试均不得重新运行旧绘图、显示旧失败或用晚到结果覆盖当前图片。
- [L4](../.docs/tests/test-image-publication-recovery.md#L4) 当前 image 已成功，publication 失败且 document 对应位置保存另一个有效 URL。显式重试后恢复进度，不再重复冲突；保存恢复本身不增加图片模型调用，其他已完成页保持原值。
- [L5](../.docs/tests/test-image-publication-recovery.md#L5) 当前真正缺失图片、暂时文件读取失败、手动暂停/停止沿用既有行为；旧任务过滤不得隐式重绘或恢复暂停。
- [L6](../.docs/tests/test-image-publication-recovery.md#L6) 实际阅读重试组件在 publication 失败时显示“重试生成”，解释仅重试保存；按钮仍调用既有显式重试回调。

#### Local batch feature verification

[.docs/tests/test-local-image-batches.md](../.docs/tests/test-local-image-batches.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L5](../.docs/tests/test-local-image-batches.md#L5) For 8, 10, and 12 pages, request the batch containing the reader's page. Observe page one alone, images two and three with its reference, no calls when revisiting saved pages, and a clamped final batch.
- [L6](../.docs/tests/test-local-image-batches.md#L6) For both Gemini and Codex, hold three later image calls. Confirm all start together with the saved reference and art direction. Another advance must return running with no additional calls. Release out of order and inspect durable image/usage progress while locked.
- [L7](../.docs/tests/test-local-image-batches.md#L7) Reject one call while others finish. Confirm all settle before lock release, completed results survive a restart, and retry requests only missing work. Inject an intermediate save failure and confirm the final save retains settled results while reporting failure.
- [L8](../.docs/tests/test-local-image-batches.md#L8) Delete while three images run. Allow them to complete, verify stored results remain and visible reads/advances stay unavailable. Leaving the client during a batch must prevent a later batch from starting.
- [L9](../.docs/tests/test-local-image-batches.md#L9) Simulate batches exceeding six minutes overall with advancing ready counts, including out-of-order results under an unchanged stage. Confirm progress continues, while unchanged work times out and existing retries remain bounded.

#### Replacement source flows

[.docs/tests/test-publication-book-sources.md](../.docs/tests/test-publication-book-sources.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-publication-book-sources.md#L3) Fresh library, all 24 books: load originals offline; check declared complete chapter sequences, final chapter bodies, bounded exhaustive inputs, expected source URLs and immutable hashes. Mock provider selects real receipts via HTTP; original text is persisted before planning. No paid calls.
- [L4](../.docs/tests/test-publication-book-sources.md#L4) Modified/missing/extra/path-escaping originals: loading returns unavailable, never a different edition or remote fallback. Stale edition receipts are rejected. Unsupported glyph ranges remain unselectable.
- [L5](../.docs/tests/test-publication-book-sources.md#L5) Fresh SQLite: 种梨 demo has the independently sourced passage, attribution and ten existing bundled images. Reopen an existing saved session carrying an older edition/source; keep its saved original and media unchanged.
- [L6](../.docs/tests/test-publication-book-sources.md#L6) Current tree and packaging: 17 old source paths absent, seven retained hash sets unchanged, all replacement manifests checked; text licenses and modifications documented separately from Apache code. Git history is explicitly outside removal scope.

#### Story publication protection E2E

[.docs/tests/test-story-publication-protection.md](../.docs/tests/test-story-publication-protection.md)

Authored numbered scenario/step statements:
- [L5](../.docs/tests/test-story-publication-protection.md#L5) Open an existing generated story without publication metadata. It reads normally, identifies AI participation, and never invents creator ownership. Open reading settings and edit publication information; save credit, source/license note, contact, work URL and reuse terms. Reopen/reload and verify all fields persist. Test narrow viewport layout and keyboard access.
- [L6](../.docs/tests/test-story-publication-protection.md#L6) Download the updated ZIP. Decode it in browser: expected numbered WebPs, exact frame counts, original text and captions, and valid ZIP. It excludes private prompt/requirements sentinels, retains saved attribution/AI/source/version, and includes rights text. Decode every WebP and inspect the bottom-right12px credit and absence of interior text, with unchanged dimensions and no crop. Inspect source dimensions/pixels to verify local originals remain untouched.
- [L7](../.docs/tests/test-story-publication-protection.md#L7) Keep an actual newly exported synthetic ZIP as temporary evidence for the following awesome-shiqu RPD, where the actual destination parser and rendering are verified.
- [L8](../.docs/tests/test-story-publication-protection.md#L8) Change credit/terms, download again, and verify new contents rather than a cached older URL. Missing credit exports without an invented creator; a story missing a frame prevents all complete exports.
- [L9](../.docs/tests/test-story-publication-protection.md#L9) Download PDF and PNG and verify available credit plus AI disclosure.
- [L13](../.docs/tests/test-story-publication-protection.md#L13) Extract XMP from every real exported WebP, verify the original-file and explicitly scoped image-payload hashes, then verify its final whole-file hash against `故事.json`. Changing XMP changes the file hash, not the image-payload hash. Both source and watermarked WebPs decode; original file bytes are unchanged.
- [L15](../.docs/tests/test-story-publication-protection.md#L15) Long credits use a bounded visible name with full author in metadata. Unit tests cover Unicode/control handling and XML escaping, RIFF odd padding/flags/duplicate XMP, and SHA-256 with no WebCrypto. Payload hash scope: ICCP/ALPH/VP8/VP8L complete RIFF chunks including headers/padding in file order.

### Desktop console, native runtime and networking — written specifications

#### Desktop internet access E2E

[.docs/tests/test-desktop-internet-access.md](../.docs/tests/test-desktop-internet-access.md) — **Review applicability: legacy-term references.**

Authored sections:
- [Execution evidence](../.docs/tests/test-desktop-internet-access.md#L13)

Authored numbered scenario/step statements:
- [L5](../.docs/tests/test-desktop-internet-access.md#L5) With legacy settings, load current native settings: internet is off; start server and verify localhost and advertised LAN reader work without cookies; no tunnel process/public URL. Stop and repeat with port conflict; ownership releases.
- [L6](../.docs/tests/test-desktop-internet-access.md#L6) In preview inspect internet checkbox, helper setup/path, LAN always-on text, private-link guidance and disabled native operations. Verify layout at desktop and narrow widths without personal-data mutations.
- [L7](../.docs/tests/test-desktop-internet-access.md#L7) With installed official helper and temporary seeded library/static reader, enable internet and start runtime. Public QR link must be HTTPS with fragment credential; bare public API/media deny. Open /connect with fragment in in-app browser, exchange Secure/HttpOnly cookie, and reach reader/API/image. Same-origin mutation succeeds without AI; foreign origin, invalid Host and missing credential fail. Streaming NDJSON passes through (no SSE).
- [L8](../.docs/tests/test-desktop-internet-access.md#L8) Stop runtime: helper PID disappears, local and tunnel listener stop, public URL no longer serves reader. Restart: new pairing secret; old cookie/link cannot authenticate the new runtime.
- [L9](../.docs/tests/test-desktop-internet-access.md#L9) Invalid helper path/startup failure produces safe actionable error and no listeners/process/data lock leak. Terminate helper after readiness: local/LAN remain usable, public URL is cleared and native UI status shows internet failure. Parent stdin EOF stops runtime/helper.

#### Desktop editions E2E

[.docs/tests/test-desktop-lite.md](../.docs/tests/test-desktop-lite.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L5](../.docs/tests/test-desktop-lite.md#L5) Launch Standard with system Node absent from PATH and any saved custom Node path invalid. The settings report bundled Node 24.22.1/SQLite and the server starts. A missing/corrupted bundled executable reports a reinstall error and never selects system Node. Standard hides system-runtime selection. Build Lite with the override: it excludes Node and retains its existing missing/Node 22 rejection and explicit Node 24.22.1 selection behavior.
- [L6](../.docs/tests/test-desktop-lite.md#L6) Configure a disposable data directory and Gemini with no key. Save, quit, relaunch: nonsecret settings persist and the sample remains readable. Enter a disposable test key, reveal/mask it, save, then quit/relaunch and confirm only the saved-presence indicator returns. Delete and confirm the database record stays absent after relaunch without launch environment. Inspect the private native database: the selected key is persisted as disclosed plaintext, while settings responses/payloads/logs/reader routes contain no key. No session-only control exists. A provider test without a key reports a safe local error and makes no request.
- [L7](../.docs/tests/test-desktop-lite.md#L7) Start with phone access disabled. Status becomes Running, Open in browser launches the plain localhost origin, the browser reaches the reader directly, and no LAN URL/QR is shown. Cookie-free requests to stories/media succeed.
- [L8](../.docs/tests/test-desktop-lite.md#L8) Stop, enable phone sharing, restart. Show actual LAN URL(s) and scannable QR. Open one direct IP/port link in the in-app browser (a separate simulated phone client when physical device unavailable), read the sample, write reading progress, restart/reload, and verify persisted progress. Direct access still works after restart; foreign Origin/Host requests fail. No settings/key endpoint exists.
- [L9](../.docs/tests/test-desktop-lite.md#L9) Stop the server and verify listener closes. Occupy the configured port and start: show a bounded actionable error and recover when the port is freed. Close the window: tray/background operation remains. Open another app instance: focus the original. Quit: server exits and listener closes, including on parent-input EOF/crash. Duplicate desktop data-directory lock is rejected.
- [L10](../.docs/tests/test-desktop-lite.md#L10) Inspect packaged resources outside the checkout: all dependencies/books exist with no `.env`, API keys, personal data, developer symlinks, or dependency-install step. Standard includes matching Node 24.22.1, license notices and checksum/provenance metadata; copy it with the runtime and run using only the bundled executable and an empty/unusable system Node PATH. Lite excludes Node. Run `pnpm start` separately and confirm the ordinary reader/API still work.
- [L14](../.docs/tests/test-desktop-lite.md#L14) Fresh database: legacy settings.json imports once; alter settings in SQLite then relaunch with stale JSON still present and confirm database wins. Invalid/corrupt/future schema fails safely without overwriting original bytes. Failed settings/key save rolls back both. Check Unix directory/file permissions; no native database is in the packaged resources or reader routes.
- [L15](../.docs/tests/test-desktop-lite.md#L15) Using only synthetic environment values, verify first launch imports GEMINI_API_KEY only when the database has no key, saves it for later launches without the environment, and never overrides an existing saved key. Delete in the running app and confirm no repeated import; a new app launch may import again. Invalid values report a value-free warning while settings remain usable for valid input. Confirm no shell execution and child environment excludes API secrets. No actual provider request is made.

#### Desktop overview E2E

[.docs/tests/test-desktop-reader-tab.md](../.docs/tests/test-desktop-reader-tab.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L5](../.docs/tests/test-desktop-reader-tab.md#L5) Start the reader development service for the disposable library, then desktop Vite preview with the same SHIQU_DATA_DIR and optional VITE_DESKTOP_READER_URL. Expect exactly 概览 / 生成队列 / 设置, overview selected, no iframe or embed toolbar, and no permanent preview notice. With URL configured, main preview action opens the actual reader in a separate browser tab; without it, show actionable preview setup text and no native service action. Invalid/credentialed/external/root-with-query URL must not be launched.
- [L6](../.docs/tests/test-desktop-reader-tab.md#L6) Seed synthetic generated records covering completed, active, failed, pending choice and paused/idle, with saved flags. Compare displayed summary counts and recent/actionable records against real /__desktop/library data. These are generated-record counts, not all published/demo stories. View should not modify SQLite or enqueue work. Loading shows dashes; forced summary failure shows error/retry and must not claim an empty library. Empty-library preview has an inviting start/open action and honest zero counts after a successful read.
- [L7](../.docs/tests/test-desktop-reader-tab.md#L7) Verify native shell with mocked IPC separately from packaged runtime: initial unconfigured setup opens settings; configured readonly starts on overview. For stopped service, primary action calls save_settings when dirty, detect_node, start_server, then open_reader. Running service skips start. Save/runtime/start failure never opens; opener failure leaves running status and allows another open. During pending operations repeated actions are disabled. Retain stop and settings-lock behavior.
- [L8](../.docs/tests/test-desktop-reader-tab.md#L8) Navigate queue/settings and back using pointer and arrow/Home/End keyboard actions. Queue still reads the same summaries and preserves existing rendering. Saved provider/model/path and Node readiness are labelled accurately; no key material or invented provider connection success is shown. Phone panel preserves LAN and private internet URL/QR selection/copy behavior and notices. Preview does not gain native service/credential access.
- [L9](../.docs/tests/test-desktop-reader-tab.md#L9) Inspect actual screenshots at 760×640, 1040×820, wide/tall and narrow stacked sizes. Primary action, metrics, actionable work and recent records have clear hierarchy, no overlap or horizontal overflow; all lower content and sharing controls remain reachable by scrolling. Capture empty/populated and running/stopped states.
- [L10](../.docs/tests/test-desktop-reader-tab.md#L10) Run focused overview/launch tests and full applicable regression checks. Browser checks and native-IPC simulation are not native runtime smoke; explicitly record unrun platform/browser-launch and prepared-bundle tests. Verify obsolete embed files and iframe-only CSP grant are removed and capabilities remain local-only.

#### Desktop service console E2E

[.docs/tests/test-desktop-service-console.md](../.docs/tests/test-desktop-service-console.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L5](../.docs/tests/test-desktop-service-console.md#L5) Fresh console: one view, no tablist, queue, story metrics, deletion or provider/key form. Native-IPC fixture starts without configured provider; start reports starting/upgrading/running, browser opens only after running. Failure retains safe error and backup; unknown polling is never stopped. Runtime, native paths/port, pickers and quit remain visible/reachable. Native controls lock while running or unknown; stale save instructs reload.
- [L6](../.docs/tests/test-desktop-service-console.md#L6) Browser first run: local service opens shelf/read status without provider. Setup prompt opens 我的 → 生成服务与模型; `/#provider-settings` opens that form only at local-authorized origin. Generation fails before production creation. LAN/tunnel retains reading/generation and host-only setup prompt with no settings entry.
- [L7](../.docs/tests/test-desktop-service-console.md#L7) Settings: load/save both provider profiles, separate image provider, models/reasoning and keep/replace/remove synthetic keys. Saved keys never appear in response/DOM/log. Saving shows restart-needed and leaves runtime unchanged. Check sends no drafts and performs only metadata/login status; reset requires confirmation and preserves native fields/library. Concurrent native/browser saves preserve other fields or reject stale revision.
- [L8](../.docs/tests/test-desktop-service-console.md#L8) Restart: runtime summary matches browser startup snapshot; saved drift matches browser restart-needed including overrides/key changes. Active production requires explicit confirmation that work stops and is resumable; cancel leaves service alone. Stop/start/restart errors recover without duplicate starts. Open-reader allows root and one fixed generation-settings fragment only.
- [L9](../.docs/tests/test-desktop-service-console.md#L9) Security: real HTTP automated tests deny LAN peer/address, foreign origins, spoofed forwarding headers, normalized route variants and tunnel settings; no native control or path mutation endpoint. Exact settings path wins over platform environment directories; missing/corrupt database returns safe error without creating another store. Legacy library startup upgrades before ownership and records verified backup; recovery failure reports available backup safely.
- [L10](../.docs/tests/test-desktop-service-console.md#L10) Inspect actual console screenshots at 1040×820 and 390×820 plus stopped/running/unknown/upgrade IPC states: no overlap/overflow, lifecycle/read-only summary/native path controls and phone QR usable. Disclose IPC simulation versus native OS runtime evidence. Run applicable Node/Rust suites, typecheck/lint/format; do not prepare/package.

#### Direct reader access E2E

[.docs/tests/test-direct-reader-access.md](../.docs/tests/test-direct-reader-access.md)

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-direct-reader-access.md#L3) Run `pnpm desktop:preview`, open its existing in-app browser tab and inspect Settings. Copy/QR labels and network note must describe direct access and contain no re-pair instruction. Browser preview cannot start native services.
- [L4](../.docs/tests/test-direct-reader-access.md#L4) Start a desktop listener against disposable data without provider credentials. Open its root origin in the in-app browser with no pairing cookie. Reader content and stories API succeed. Write progress, stop/restart on the same port and reload the same URL: progress remains and no pairing is needed. Native settings routes stay unavailable.
- [L5](../.docs/tests/test-direct-reader-access.md#L5) Run the development proxy against disposable files. API reads/writes require no cookie; foreign Host/Origin requests are rejected and Vite private/raw/@fs paths stay blocked. Desktop LAN sharing off still binds loopback. QR origins are plain IP/port.

#### LAN-independent startup E2E

[.docs/tests/test-lan-independent-startup.md](../.docs/tests/test-lan-independent-startup.md) — **Review applicability: legacy-term references.**

Authored sections:
- [Result](../.docs/tests/test-lan-independent-startup.md#L8)

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-lan-independent-startup.md#L3) Disposable library, internet enabled, helper missing: start returns running true, publicUrl empty, actionable internetError. GET localhost and discovered LAN library/media succeeds without Cookie; URLs have no hash. Browser local progress mutation remains same-origin and does not call AI. Stop closes listeners/releases lock; restart works.
- [L4](../.docs/tests/test-lan-independent-startup.md#L4) Helper exits before readiness: same LAN fallback, helper PID gone/config removed, public listener unavailable. Startup AbortSignal/parent EOF instead aborts whole startup and leaves no local listener/ownership. Existing port conflicts remain fatal.
- [L5](../.docs/tests/test-lan-independent-startup.md#L5) In-app desktop preview: LAN explicitly says no pairing ID, internet remains opt-in, updated screenshot contains current controls without private credentials. Existing preview operations remain disabled.
- [L6](../.docs/tests/test-lan-independent-startup.md#L6) Installed Lite: user configuration has internet enabled but missing helper. Start reader without changing provider or invoking generation, verify internet-only warning, browser link, local URL and LAN direct-access QR; open reader through local browser action. No public tunnel is started. Leave requested app running. If user has changed state, inspect before acting and preserve unrelated settings.

#### Windows desktop verification

[.docs/tests/test-windows-desktop.md](../.docs/tests/test-windows-desktop.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-windows-desktop.md#L3) Local configuration/automation: from the checkout with pinned toolchains, validate Windows NSIS configuration against the installed Tauri schema and inspect both native jobs plus the publisher. Expect four distinct assets, one publisher gated on every build, and no release on PR/manual runs.
- [L4](../.docs/tests/test-windows-desktop.md#L4) Native Windows CI: on Windows x64 with pinned Node/pnpm/Rust and MSVC, run desktop JavaScript tests and both native edition tests. Package each edition, silently install it into a temporary path containing spaces, and smoke-test the installed runtime. Expect a 24-book empty library, working local/LAN APIs, restart and shutdown; Standard verifies bundled node.exe and license hashes without system Node on PATH, Lite has no bundled Node and uses installed Node 24. No paid generation.
- [L5](../.docs/tests/test-windows-desktop.md#L5) Release: for a matching vX.Y.Z source tag, both platforms must finish before publishing. Expect two DMGs, two EXEs, and a checksum file covering all four. A failed platform prevents publication; manual/PR runs only upload artifacts. Inspect this contract locally; do not push or publish during this task.

### Development, skills and distribution tooling — written specifications

#### 开发数据库 E2E

[.docs/tests/test-dev-local-playwright.md](../.docs/tests/test-dev-local-playwright.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L5](../.docs/tests/test-dev-local-playwright.md#L5) local启动：即使.env指定其他目录也只使用`.data/dev-local`；无local参数沿用原规则。非法参数报错，私有SQLite不可被Vite下载。
- [L6](../.docs/tests/test-dev-local-playwright.md#L6) 新建完整UI：选择原文/主题、打开提取、刷新等待、输入标题或自动提取、选定、草稿编辑、重新准备、最终确认、完成阅读。确认前无plan/image。
- [L7](../.docs/tests/test-dev-local-playwright.md#L7) 编辑完整UI：改名不生成；草稿关闭/丢弃；制作要求、验收、画风、叙事、分镜及结语分别走真实修订；书架仅最新版，原版历史不改，适用时复用图片。
- [L8](../.docs/tests/test-dev-local-playwright.md#L8) 暂停/恢复及失败：受控模型挂起/报错以稳定触发真实持久状态；通过UI按钮恢复或重试，刷新不买新尝试；已保存检查点复用。另触发审核无变化阻断，验证手动修订重审和明确跳过绘图，保留人工放行标记。
- [L9](../.docs/tests/test-dev-local-playwright.md#L9) 重选：打开不提取，取消不变；明确提取并选定才替换，新版需确认制作，原版保留且单卡片。
- [L10](../.docs/tests/test-dev-local-playwright.md#L10) 协议补充：停止、幂等、迟到回执/过期命令、服务重启、同家族并发、图片失效/恢复。复用既有真实REST/生产fixture测试，明确标注不是浏览器点击证据。
- [L11](../.docs/tests/test-dev-local-playwright.md#L11) 保存截图、trace、状态转换、测试库位置、命令结果和Run ID；异常分类为产品/测试/环境，不以重试掩盖问题。

#### Release 0.8.6 recovery scenarios

[.docs/tests/test-release-086-recovery.md](../.docs/tests/test-release-086-recovery.md)

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-release-086-recovery.md#L3) In an isolated production fixture, run a story until its review blocks, then change only the art style. Expect unchanged review history, no new review/image calls, failed child state and exactly one pending review fault owned by the child. Replaying the revision and restarting retain that fault.
- [L4](../.docs/tests/test-release-086-recovery.md#L4) Accept the child's review with its explicit fault ID and stable request ID. Expect completion with the new style, an overridden review and exactly the missing image calls. Replay acceptance after completion; expect no new generation and no parent changes.
- [L5](../.docs/tests/test-release-086-recovery.md#L5) Create an isolated 0.8.5-format library with a stranded failed blocked revision, then open it through ensureLibraryReady. Expect a verified whole-library backup, migration 0020 and one pending fault. Reopen and expect no duplicate; healthy/overridden records stay unchanged.
- [L6](../.docs/tests/test-release-086-recovery.md#L6) Run pnpm release:check and affected integration checks on the release commit using pinned Node/pnpm. Run the npm checks/build/smoke pipeline, then hand the verified tarball to the user for publication, per their later instruction. Finish existing native CI and expect both desktop installers and checksum file; release notes contain no DeepSeek or Claude announcement. No agent-side npm publication remains in scope.

#### Remove Docker container support verification

[.docs/tests/test-remove-docker-support.md](../.docs/tests/test-remove-docker-support.md) — **Review applicability: legacy-term references.**

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-remove-docker-support.md#L3) Run applicable local-book, configuration, CLI and development tests against disposable fixtures. The unchanged `docker/seed.sql` must remain available and production initialization/upgrade/packaging paths must have no diff.
- [L4](../.docs/tests/test-remove-docker-support.md#L4) Run `tests/development-local.e2e.mjs` under pinned Node with disposable homes/checkouts and fake credentials. Saved Google config, explicit shell overrides, forced local shelf, private-file denial and clean shutdown must still pass.
- [L5](../.docs/tests/test-remove-docker-support.md#L5) Start `pnpm desktop:preview` on a free port, inspect the footer in the in-app browser, and verify it no longer advertises Docker. Stop the preview. No container or desktop package build.
- [L6](../.docs/tests/test-remove-docker-support.md#L6) Audit current source/guides/configuration for container commands and Docker-only variables. Retain historical records, the seed folder, persisted owner identifiers and transitive dependencies.

#### 技能更新验收流程

[.docs/tests/test-skill-updates.md](../.docs/tests/test-skill-updates.md)

Authored numbered scenario/step statements:
- [L3](../.docs/tests/test-skill-updates.md#L3) 空临时项目安装旧版本技能，配置隔离 registry 返回新版；执行 check，观察仅提示、固定版本参数数组及正确 updateCwd、原文件未变。再次 check 不请求网络。
- [L4](../.docs/tests/test-skill-updates.md#L4) 开启自动更新偏好，check 表示可自动执行；通过新版 CLI 的 update 更换副本，核对内容、版本、偏好和后续命令配套。关闭偏好后不再允许自动执行。
- [L5](../.docs/tests/test-skill-updates.md#L5) 修改本地副本，check 标记修改，update 拒绝且字节不变。删除状态模拟旧安装：相同内容能认领，不同内容不覆盖。
- [L6](../.docs/tests/test-skill-updates.md#L6) registry 离线/无效内容：check 返回不可用而原任务可继续；显式 refresh 可重试。旧 CLI 不降级新版安装。
- [L7](../.docs/tests/test-skill-updates.md#L7) 在项目子目录自动发现项目技能；没有项目安装时发现隔离全局安装。符号链接、损坏状态、并发操作保守失败，不创建数据库。

## Checks outside scenario registration

| Check/tool | What it verifies | Run trigger / qualification |
| --- | --- | --- |
| `pnpm typecheck`; `pnpm lint` | Type and syntax/static rules | Every code PR/manual CI; no runtime scenario count. |
| `cargo fmt --manifest-path src-tauri/Cargo.toml --check` | Native source formatting | Native source changes; current tag/manual CI and local release gate. |
| `pnpm npm:smoke` | Installs a real package outside checkout; HTTP/assets/persistence/exit and public delivery checks | Explicit npm artifact/release verification; inspect its tarball/registry input first. |
| `pnpm desktop:smoke <runtime>` | Relocated packaged runtime, bundled Node, private-payload exclusion, lifecycle and empty shelf | Explicit prepared artifact/package/release verification. Requires actual runtime assets. |
| `pnpm eval:discovery` | Offline matching/boundary scores against fixed annotations and frozen receipts | Discovery/annotation/scoring changes. This is not a live-model-quality run. |
| [scripts/compare-storyboard-reasoning.mjs](../scripts/compare-storyboard-reasoning.mjs) | Live review-only comparison across explicitly selected Codex reasoning efforts | Explicitly authorized model experiment; needs fixed input/output/model/effort. Never routine PR CI. |
| [scripts/storyboard-evaluation.mjs](../scripts/storyboard-evaluation.mjs) | Evaluation receipt/history/replay and isolated locking helpers | Library used by tests/tools, not an independently registered scenario runner. |
| [tests/queue-hardening-cost.mjs](../tests/queue-hardening-cost.mjs) | In-memory queue/shelf cost probe | Historical measurement helper: references pre-consolidation `reader_sessions`; review compatibility before use. Not a current regression gate. |

## Selection rule to agree before further CI refactoring

Keep an unconditional small safety set; select other scenarios by changed responsibility and its downstream contracts, then run broad regression on main and release qualification. Tag scenarios by domain, level, cost/provider matrix, platform and side-effect needs separately. A book fixture, a `.e2e` suffix, or the current `unit`/`flows` bucket alone is not a sound trigger.

Runner ownership is now regression-checked: all sixteen E2E files belong to full, default or release selection. Further change-trigger refinement should follow the domain groups above; those recommendations are separate from the implemented book and extended-E2E routing.
