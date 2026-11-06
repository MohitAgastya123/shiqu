# Desktop service console

Story base: `ee8b45944f7026eaf42ba20938942d899bb7be80`. Entry tree contains only the selected untracked REQ, included in this story. No push or desktop preparation/packaging.

## Outcome and boundaries

Replace the three desktop tabs with one operational console. Reuse the browser generation-settings form and shared v2 SQLite settings store. Keep native filesystem/executable/network controls, strict browser opening, library version refusal, CLI startup and story schema unchanged. Desktop no longer queries or mutates story documents.

The Node desktop child receives the exact native settings database path through private stdin, separately from invocation overrides. Resolve effective providers with the existing shared resolver. Its local HTTP listener dispatches the existing settings handler using real socket metadata; its separate tunnel listener refuses settings explicitly. Browser provider saves patch provider fields; native saves accept only native fields, merge into the current transaction and reject stale revisions. The store's existing format stays unchanged; desktop HTTP opens existing stores only.

Startup runs ensureLibraryReady before data ownership and application creation. Child reports upgrading/starting/running/failure plus verified backup through the existing bounded stdout protocol. The supervisor waits without a migration deadline while upgrade is in progress, releases its controller lock while waiting, and exposes progress to polling. No provider is required to start; unavailable generation fails before creating a production. Runtime configuration remains a startup snapshot; current saved effective configuration determines restart-needed using the same in-memory signature in browser and native status. Native restart asks about active generation using child operational metadata, without story queries.

Browser adds saved-configuration check/reset operations to the existing guarded settings endpoint (revision required for reset); metadata-only provider checks use effective saved settings plus invocation overrides. No unsaved draft is submitted to check. One fixed `/#provider-settings` deep link opens the existing form only after loopback permission succeeds. Remote clients see a setup-on-host prompt without a settings entry. Secrets remain in private stdin/server memory/database and submitted drafts only.

## Ordered tasks

- [x] Bounded feasibility probe: inspect production upgrade/ownership order, provider setup guards, settings-store constructor and child status lifecycle; verify a disposable first-run service and exact-path store access can use existing production components. If not feasible, revise design and rerun AR before dependent implementation.
- [x] Extend shared guarded browser provider settings with existing-only store opening for desktop, saved-effective check/reset, common runtime summary/signature and strict route handling; add isolated boundary, key, drift, reset and concurrent-save tests.
- [x] Wire desktop child to exact settings path and shared provider resolution, upgrade-before-ownership and progress/backup reporting, no-provider startup and pre-production guard; preserve environment precedence and remote reading/generation.
- [x] Refactor Rust supervisor for observable startup/upgrade without deadline interruption, exact store handoff, native-only revision-safe saves, status/restart metadata and fixed deep-link opener. Remove summary/tombstone native and preview paths while retaining schema/journal refusal.
- [x] Replace desktop tabs/queue/provider form with single console, native path pickers, lifecycle/restart confirmation, read-only provider summary and phone access. Add browser first-run prompt/deep link/check/reset controls; update desktop README and user guide and affected tests.
- [x] Verify focused Node/Rust behavior, full applicable unit/integration tiers, typecheck/lint/Rust format and matching E2E including in-app Vite console at multiple sizes. Use isolated settings/homes/libraries and synthetic keys, no inference or packaging.

## Validation and risks

Automated tests cover legacy upgrade and recovery safety/backup, first-run no-provider and no partial production, exact native store identity despite platform overrides and no recreation on missing/corrupt store, effective overrides including credential drift, stale native/browser save refusal, metadata-only check/reset and unchanged runtime. Access tests exercise loopback peer/Host/origin, LAN address, cross-site, forwarding spoof, normalized paths and tunnel denial; path/executable and lifecycle fields are rejected over HTTP. Rust tests cover status streaming without upgrade deadline and native-only merging/deep-link restriction; prepared-bundle-only test is excluded if resources absent. Native OS opener/tray/bundled runtime remain distinct from IPC simulation and Vite evidence.

A supervisor cannot hold its mutex during long startup: polling must observe progress and quit must not kill migration. Explicit stop/restart are disabled during startup/upgrade. Unexpected shell exit must allow synchronous migration/recovery to finish before child cleanup. Compare running configuration using the shared JS signature, never a Rust approximation of secret precedence.

## Architecture review

AR passed: no blocking architecture flaws

AR risk: non-low — coordinates native startup and migration safety, shared settings, secrets and HTTP access boundaries.
AR review round: 1; reviewer: new (`console_review`).

Carry forward: browser reset preserves Codex paths (existing reset clears them); runtime command clears environment so pass invocation overrides explicitly; reject malformed/symlink journals before native ownership; dispatch browser settings with real socket peer; release controller lock while starting and never time out migration.

SS probe: Node 24.22.1 production startDesktop with a disposable fresh library started and returned configured:false without inference. Shared resolver read the exact disposable settings file. Initial sandbox socket bind was denied (EPERM); authorized local-listener execution passed. Source confirms requireProvider precedes session creation and ensureLibraryReady owns its upgrade lease. No architecture change required.

Concurrent workspace work appeared after entry: CI pnpm-store caching plus test fixture/performance changes in startup, desktop-internet, book-library and related tests. Preserve and exclude those changes from story commits. No dependency change is part of this story. pnpm attempted automatic dependency verification/install on a later invocation and refused noninteractive module removal; checks use verifyDepsBeforeRun=never against the already-installed pinned toolchain.

## Implementation evidence

The implementation and focused checks are complete. Desktop browser settings reuse the shared form/store/resolver; Rust accepts only six native fields and a required revision; child startup upgrades before creating the application and streams progress without an upgrade deadline. Native/preview story summary and tombstone files and commands were removed; obsolete assertions were removed only for those deleted surfaces, retaining existing browser production-path coverage. Browser restart always confirms potential interruption, covering jobs that begin between status polls.

Node focused checks: initial 32 tests passed; full default-tier run found three consumers of the newly extended status/check contract, fixed without weakening behavior assertions. Final affected 39 tests passed. Full default tier had 1283 tests (1257 pass, 3 subsequently fixed, 23 tier skips). Full provider/heavy tier is now running. Typecheck/lint passed. Rust 23 tests passed with `TAURI_CONFIG='{"bundle":{"resources":[]}}'` and the prepared-bundle-only test excluded; no native build/preparation.

ET passed: actual in-app Vite preview has no tablist/password fields and fits 1040/390 widths; backend does not permit initialization-script injection, so native IPC simulation uses a disclosed separate Playwright session. Executable E2E passes startup/upgrading, runtime vs saved summary, backup, stop, restart confirm/cancel, dirty native save, stale refusal, unknown/failure recovery, QR and both widths. Actual production desktop HTTP plus a temporary browser-only build passes fixed deep link, browser provider/key save, secret absence in DOM, unchanged running snapshot, restart-needed, saved-only metadata check and confirmed reset preserving paths. No paid requests or personal data. Screenshots inspected at `.data/e2e/desktop-service-console/`; actual OS opener, tray and packaged runtime remain unrun.

Concurrent unrelated work was committed separately as `eed3629`; it is excluded from this story. Story base remains unchanged. Source/test story path list: `/tmp/shiqu-console-story-files` (including the status-stream-only hunks of desktop-internet tests). Current tree contains only this story's pending changes.

Implementation milestone: `e6c089e` (only this story's changes; unrelated `eed3629` preserved).

CR blocked: three acceptance gaps remain — current-format upgrades could report an old backup; authorized browser 503 errors hid their retry sheet; stopped summaries trusted providerConfigured after key removal.
CR risk: non-low — native lifecycle, library upgrades and secret-bearing HTTP settings.
CR review round: 1; reviewer: reused (`console_review`).

Corrections: prefer the actual initializer return backup over an older report, with a current-format pending-migration test; distinguish authorized-but-unavailable browser settings from denied access and keep the safe error/reload sheet reachable; calculate saved provider readiness from native key-presence flags for both active providers. Closing the settings sheet clears only its fixed fragment so the setup prompt can reopen it. Tray/OS stop and quit now share a lock-releasing startup wait, covered by a native concurrency test. The running provider summary also survives settings-store failure using its immutable startup variables.

Fix verification: isolated upgrade/recovery tests pass including in-place migration backup; native suite 24 pass, one prepared-bundle test excluded; E2E plus console tests 5/5 pass, now including missing-store error visibility/reload, reopening the fixed deep link and key-presence summaries. Existing actual pnpm dev settings E2E passed in its disposable checkout. Full provider/heavy TT continues with no failures so far.

Fix milestone: `bc7e74c`.

CR fixed: latest upgrade backup preserved; local settings failures expose retry; saved readiness reflects missing keys; all stop/exit paths wait safely for startup. Rerun result passed.
CR risk: non-low — native lifecycle, migration safety and shared HTTP settings.
CR review round: 2; reviewer: reused (`console_review`).

## Final verification

TT passed: full Node 24.22.1/pnpm 11.25.0 provider/heavy tier (`SHIQU_TEST_TIER=full pnpm exec node --experimental-strip-types --test --test-concurrency=2 tests/*.test.mjs`) completed 1323/1323, no failures/skips/cancellations, 291.3 seconds. Log `/tmp/shiqu-console-full-tier.log`. Reuse unaffected full-tier evidence after the localized review fixes; final focused settings/separate-provider suite passes 33/33 including new backup/list-metadata cases (`/tmp/shiqu-console-review-fix.log`). Native suite passes 24 tests with the absent prepared-bundle-only test filtered (`/tmp/shiqu-console-rust.log`); typecheck/lint and Rust formatting pass. All applicable Node unit/integration suites were covered; no live inference or real data.

ET passed: `tests/desktop-service-console.playwright.e2e.mjs` and console unit tests 5/5 after all UI fixes (`/tmp/shiqu-console-e2e.log`), plus existing real pnpm dev/browser settings E2E 1/1 (`/tmp/shiqu-console-dev-e2e.log`). In-app Vite preview at 1040/390 verified separately; native IPC fixture and actual desktop HTTP + temporary browser build are explicitly separate evidence. Browser-origin settings errors/retry/reopening, restart confirm/cancel, safe key submission/reset, current runtime summary, all native-only save fields, status failures and responsive QR layout pass. Test screenshots are `.data/e2e/desktop-service-console/console-running-{1040,390}.png` and `browser-provider-settings.png`.

Native packaging/preparation and OS opener/tray/WebView runtime smoke are intentionally unrun. No story schema, migration, dependency or CLI command/behavior change. The existing v2 store interop tests pass; no CLI skill change was required. The two Codex path fields remain under the original REQ; moving them to collapsed advanced controls was discussed as a recommendation, not implemented without a change request.

VR passed: all acceptance criteria complete
VR risk: non-low — coordinates native lifecycle and upgrade safety, shared settings, secret handling and browser access boundaries.
VR review round: 1; reviewer: reused (`console_review`).

All 25 REQ criteria and six AP tasks are complete. Full independent VR result is preserved verbatim in `.docs/done/2026/11/05/desktop-service-console.md`. DD complete; GC finalizes these acceptance/delivery documents without changing reviewed implementation.
