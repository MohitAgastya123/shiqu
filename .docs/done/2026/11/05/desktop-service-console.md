# Desktop service console

## Summary

The desktop window now runs the local service from one console. Story browsing, production queues and generation settings use the browser. Native-only paths and networking retain validation, pickers and stop-before-change behavior. Fresh installs can start without configuring a provider; generation requests fail before creating partial work.

The desktop child uses the exact native settings store and shared provider resolver. Library upgrades finish before serving, report verified backups and remain safe across all stop/exit paths. Browser settings keep loopback/socket/origin restrictions, reject tunnel access, preserve native fields, expose safe store failures with retry, and offer saved-effective connection checking and confirmed reset.

## Verification

Implementation milestones: `e6c089e`, `bc7e74c`; unrelated concurrent commit `eed3629` was preserved. Full provider/heavy Node tier passed 1323 tests with no skips. Localized final fixes passed 33 focused tests; console/browser E2E passed 5 tests; existing pnpm dev settings E2E passed. Rust passed 24 tests with the absent prepared-bundle test filtered. Typecheck, lint and Rust formatting passed. Detailed commands and logs are in the plan.

## Notes

The in-app browser verified the Vite preview. Native IPC simulation and actual production desktop HTTP verification ran in a separate Playwright session because in-app CDP does not support initialization-script injection. No personal settings/library, real keys, live inference, packaging or push. Native OS opener, tray and packaged WebView smoke remain unrun. Codex executable/login paths remain optional native overrides as required; the recommendation to collapse them under advanced settings was not a scope change.

## Final VR result

VR passed: all acceptance criteria complete

VR risk: non-low — coordinates native lifecycle and upgrade safety, shared settings, secret handling and browser access boundaries.

VR review round: 1; reviewer: reused.

All 25 acceptance criteria are complete:

| # | Criterion | Result and evidence |
|---|---|---|
| 1 | Single operational console and required controls | Complete — desktop source, IPC E2E and inspected 1040/390 screenshots. |
| 2 | Remove desktop story controls and provider form | Complete — tabs, summaries, queue and credential form removed; render/E2E assertions pass. |
| 3 | Remove native/preview story access; preserve format refusal | Complete — query/tombstone paths removed; native schema/journal refusal tests pass. |
| 4 | Accurate read-only summary and fixed deep link | Complete — startup snapshot, saved key-presence summary and strict native opener tests; browser deep-link E2E passes. |
| 5 | Preserve native-only settings, validation and pickers | Complete — six-field native patch, retained validators/pickers and running-state locks; stale-save tests pass. |
| 6 | Upgrade/recover before service startup without interruption | Complete — production initializer precedes application creation; observable progress and deadline-free upgrade wait covered by Node/Rust tests. |
| 7 | Verified backup and safe upgrade/recovery failures | Complete — isolated legacy, pending-recovery and current-format migration tests; console backup rendering verified. |
| 8 | First-run startup, reading and host setup prompt | Complete — no-provider production desktop startup and browser E2E; remote prompt follows denied settings access. |
| 9 | Reject generation before partial production creation | Complete — production HTTP test returns clear setup error and unchanged empty sessions. |
| 10 | Preserve configured generation and override precedence | Complete — shared resolver reused; settings/separate-provider tests and complete production regression tier pass. |
| 11 | Browser edits existing provider/model/reasoning fields | Complete — shared form retained; desktop HTTP E2E and provider-settings tests pass; native paths excluded. |
| 12 | Exact native store; safe missing/unreadable failure | Complete — explicit private path handoff, existing-only store opening, API tests and visible error/retry E2E. |
| 13 | Key keep/replace/remove and no saved-secret disclosure | Complete — provider tests cover all actions and response absence; E2E verifies saved key absent from DOM. |
| 14 | Saved-effective metadata/login connection check | Complete — strict action schema excludes drafts; metadata-only transport and existing Codex checks covered. |
| 15 | Confirmed reset preserves native/story state | Complete — browser confirmation and production reset tests preserve paths/network/library fields; reset touches settings only. |
| 16 | Exact restart-needed and override-name reporting | Complete — shared signature reused by browser and supervisor; model/key/override drift tests pass. |
| 17 | One-action confirmed restart; saving leaves generation running | Complete — IPC confirmation/cancel sequencing and immutable runtime HTTP tests pass. |
| 18 | Preserve concurrent fields or reject stale saves | Complete — revision-checked browser patches and native merges; Node/Rust concurrency tests pass. |
| 19 | Loopback peer/Host/origin and normalized-path restrictions | Complete — real HTTP and guarded-handler boundary tests pass. |
| 20 | Deny settings through internet tunnel | Complete — explicit tunnel refusal and forwarding-spoof tests pass. |
| 21 | Preserve remote reader/generation; hide settings entry | Complete — remote listener still delegates reader API; internet regressions and access-driven entry logic verified. |
| 22 | No HTTP native-control/path mutation | Complete — provider-only strict schemas and negative HTTP field/route tests pass. |
| 23 | Unchanged settings format and story schema | Complete — v2 interoperation tests pass; no migration, schema or dependency changes. |
| 24 | Updated desktop/user guidance and HTTP key disclosure | Complete — desktop README and user guide describe console/browser workflow and loopback key submission; CLI contracts unchanged. |
| 25 | Isolated verification and in-app preview; no packaging | Complete — isolated fixtures and synthetic keys; documented in-app Vite checks plus separate IPC/HTTP E2E; no preparation or packaging. |

All six AP tasks are complete. CR round 2 passed.

Verification evidence: full provider/heavy Node tier **1323/1323**, no failures or skips; final focused fixes **33/33**; console/E2E **5/5**; existing dev settings E2E **1/1**; Rust **24 passed**, with one absent prepared-bundle test filtered. Typecheck, lint and Rust formatting passed.

Evidence limits remain explicit: native OS opener, tray, packaged runtime and WebView smoke were not executed. These are distinct from the verified in-app preview, native IPC simulation and production desktop HTTP behavior.
