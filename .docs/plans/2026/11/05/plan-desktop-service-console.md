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
- [ ] Verify focused Node/Rust behavior, full applicable unit/integration tiers, typecheck/lint/Rust format and matching E2E including in-app Vite console at multiple sizes. Use isolated settings/homes/libraries and synthetic keys, no inference or packaging.

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
