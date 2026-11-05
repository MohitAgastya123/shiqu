# Browser provider settings plan

Base: `f0466fbbbb681070b97556a7c6f7976a6dfc60c1` (clean checkout).
Risk: non-low — new local credential mutation API crosses the Node transport, Vite proxy, shared settings store and browser UI.

## Design

Add strict shared provider-only request/view contracts. A server handler opens the existing settings store per request, sends only the allowed non-secret provider subset/key presence, and saves through existing revision-checked transactions. Keep secrets server-side, clear browser input after saves, never send full system paths/settings, and reject unrelated fields. Validate the merged shared schema (including Gemini effort restrictions) before saving. Invalid/stale updates are safe errors with no partial writes.

Expose `/api/local/provider-settings` only from shared dev/browser-CLI startup. Extend the Node HTTP adapter with transport peer metadata; the settings handler trusts socket peer identity, never headers. Require a loopback address, one of the actual loopback host/ports and same-origin JSON mutations; deny cross-site reads. Add a Vite pre-proxy middleware that checks the original socket for this normalized endpoint before any proxy. The launcher generates a private per-run nonce, the guard stamps it only onto original-loopback settings requests, and the development backend requires that proof. Legacy or unguarded Vite processes cannot expose the endpoint during watched backend reloads; direct development-backend requests without proof are denied. CLI browser mode has no proxy and continues to use its real socket identity. The nonce is never sent to browser responses or included in public configuration. This prevents remote LAN clients from being transformed into trusted loopback requests; existing LAN reader APIs remain unchanged. The native desktop listener/remote routes stay uninvolved.

Pass invocation-only overrides separately from resolved startup variables, preserving current provider precedence and CLI's corrupt-settings explicit bypass. Report running status via the production provider, overrides by known variable name, and restart drift by comparing effective saved/provider variables against the immutable startup variables (secrets compared only server-side). Saving never swaps the live provider or invokes generation. Explicit overrides remain effective after restart and are explained in UI.

Reader entry lives under 我的. Reuse StorySheet with a responsive form, running-status block, provider-specific models/key controls, task reasoning, reload/conflict recovery and saved/restart messages. No connection-test button. Hide unavailable local-only entry from remote/unsupported listeners; show recoverable read failures for local stores.

## Tasks

- [x] First SS feasibility probe: isolated store plus real Node/Vite request path confirms original socket identity and normalized endpoint guarding can be enforced before proxy; no inference.
- [x] Implement shared contracts, local settings handler and HTTP peer context; use the existing provider resolver/store with bounded strict requests, revision conflicts and non-secret responses.
- [x] Wire shared dev and both CLI startup branches with explicit override context; add Vite pre-proxy guard while retaining existing reader boundaries. No exposure on native desktop/remote or generic app routes.
- [x] Add reader entry/form/styles for saved vs running settings, provider/model/reasoning editing, key presence/actions, temporary override explanation and restart feedback.
- [x] Add meaningful API/security/transaction/credential-leak tests and actual dev/CLI process regressions. Add a durable isolated browser test/fixture for the actual form and verify manually through the in-app browser; save/reload/conflict/mobile flows use fake keys only.
- [x] Update current user/development docs and stale statements that all browser settings/credential editing are unavailable; keep saved keys unreadable.
- [x] Ran 211 applicable unit/integration tests, typecheck/lint and 4 matching actual dev E2E scenarios; all passed. In-app UI checks completed and the disposable preview/temporary inputs were cleaned up; viewport reset.

## Verification

Matching E2E spec: `.docs/tests/test-browser-provider-settings.md`.
API tests cover real Node peer extraction, same-origin/loopback Host rules, LAN/spoofed-header denial, Vite normalization guard, safe strict body failures, revision conflicts, matching key actions, unchanged unrelated fields and no secret responses/logs. Process tests use temporary homes and fake keys; fixture CLI disables external network. Vite browser fixture is isolated and uses production server/handler/UI. In-app browser is the default UI verifier; separate Playwright only if needed for automated capabilities, with explicit disclosure.
No production library is opened, migrated or modified for validation. No dependency/schema changes or packaging are required.

## Stages

- AR passed: no blocking architecture flaws. AR risk: non-low — credential mutation spans transport/proxy/shared store/UI. AR review round: 1; reviewer: reused (`settings_review`).
- SS probe passed: disposable Vite listener confirmed original socket identity and encoded-dot normalization before proxying; no credentials/inference.
- Implementation complete: existing store/resolver, strict provider subset, atomic snapshot, revision-checked saves, socket+Host+Origin/fetch-site guard, and Vite original-peer middleware. Dev + both CLI branches expose the local route; generic/native readers do not.
- Focused API/CLI/native isolation tests: 10/10 passed. Typecheck and lint passed with pinned Node 24.22.1/pnpm 11.25.0. A stale existing recharts link required frozen/offline reinstall; no dependency/lock changes.
- Actual process E2E: 4/4 passed in `tests/browser-provider-settings.e2e.mjs` and `tests/development-local.e2e.mjs`; log `/tmp/shiqu-browser-settings-et.log`. Includes real LAN-interface requests with forged Host/forwarding headers and encoded proxy paths. New settings E2E is registered in default user-flow selection; existing release gate size remains unchanged.
- In-app browser: actual disposable pnpm dev fixture verified entry, separate saved/runtime models, named override, fake-key save/input clearing, immutable runtime/restart notice, preserved draft on concurrent-edit conflict, reload, per-task reasoning save, invalid-model feedback, provider-specific fields and focus return after closing. Narrow viewport 390x844: document scroll width 390, sheet fits width 390; screenshot inspected. Temporary viewport reset and fixture cleaned up.
- CR round 1 found omitted-field defaults could reset inactive profiles. Corrected the write contract to strict partial provider/nested reasoning patches and merge/validate before projecting a full allowed save; final focused 11-case regression covers provider/model/per-task/key-only omission preservation.
- Development fixtures now retain pnpm workspace configuration and disable pre-run dependency installation because symlinked dependency stores must remain immutable. Actual dev E2E asserts the live dependency link is unchanged.
- AR addendum (round 2, reused reviewer) passed for proxy proof: a watched backend may update while the original Vite launcher remains alive; the backend must require a nonce proving the original-peer guard ran. Otherwise forged loopback Host/Origin through a legacy proxy could bypass the intended local-only guarantee. No native/CLI direct transport changes.
- Proxy-proof addendum implemented: a per-launch UUID stays in the Vite guard closure/backend environment. Only original-loopback settings requests receive the stamped proof; development entry always requires it (missing/empty fails closed), including internal-port direct access. CLI direct mode retains the existing socket boundary. No proof value is returned or exposed in public configuration.
- Focused API suite: 12/12 passed after omission/proxy-proof fixes; actual dev E2E: 4/4 passed with direct internal-port denial, LAN forged headers/normalized paths, and unchanged live dependency links. Typecheck/lint passed; package.json and lockfile unchanged. Additional POST proof assertions are included in final broad TT.
- SS milestones: `788af97` (local browser settings) and `0e2d599` (partial merge/proxy proof/fixture isolation).
- CR fixed: partial updates now preserve saved profiles and nested reasoning; development requests require per-launch proxy proof. Rerun result passed. CR risk: non-low — credential writes and proxy authorization. CR review round: 2; reviewer: reused (`settings_review`). No source changes after this review.
- TT passed: 211/211 in 16 applicable settings/transport/proxy/CLI/native compatibility/release-selection suites. Node 24.22.1, `--experimental-strip-types --test --test-concurrency=2`; log `/tmp/shiqu-browser-settings-tt.log`. Final run includes new nested omission and GET/POST proof cases. No package/dependency/lockfile changes.
- ET passed: 4/4 actual guarded dev scenarios; log `/tmp/shiqu-browser-settings-et.log`. Browser UI evidence remains applicable after compatible patch/proof plumbing corrections (frontend unchanged).
- VR passed: all acceptance criteria complete. VR risk: non-low — local credential mutation, shared persistence, and proxy authorization. VR review round: 1; reviewer: reused (`settings_review`). Full final result preserved in DD.
- DD: `.docs/done/2026/11/05/browser-provider-settings.md` records behavior, validation, and startup limitations.
- GC: implementation milestones `788af97` and `0e2d599`; final evidence/acceptance documentation committed separately. No push or publication.
