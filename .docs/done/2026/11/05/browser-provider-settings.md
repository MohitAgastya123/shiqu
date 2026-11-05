# Browser provider and model settings

## Summary

Local development and CLI browser users can open **我的 → 生成服务与模型** to manage the shared saved provider, models, task reasoning and API credentials. The screen separates running configuration from saved values, names invocation overrides without exposing their values, preserves drafts on revision conflicts, and reports restart requirements. Keys support explicit keep/replace/remove; saved keys are never returned and successful replacement clears the input.

Production dev and CLI startup use the existing settings store/resolver. Strict partial patches preserve inactive profiles and omitted task settings, with merged shared validation and transactional revision checking. The transport validates real loopback peers, allowed hosts, origins and fetch-site. Vite verifies the original peer and supplies private per-launch proof; development refuses missing/empty/wrong proof, including direct internal-port or legacy-proxy requests. Native desktop/remote/generic reader routes do not gain a credential API.

## Verification

- Node 24.22.1, pnpm 11.25.0; typecheck, lint and whitespace checks passed.
- **211/211 applicable tests**: settings/store/patch/key/transport/proxy/origin/native exclusion, CLI lifecycle and corrupt-store compatibility, startup/PTY, desktop compatibility and release selection. Log: `/tmp/shiqu-browser-settings-tt.log`.
- **4/4 real dev E2E scenarios**: shared saved configuration, persistence/restart, temporary overrides, local shelf isolation, private-file denial, LAN forged Host/forwarded headers and normalized paths, private proxy proof and stable live dependency links. Log: `/tmp/shiqu-browser-settings-et.log`.
- In-app browser on an actual disposable dev fixture: form entry, running vs saved models, override label, fake-key save/cleared input, restart notice, concurrent conflict with draft preserved, reload, per-task save, invalid-model feedback, provider-specific fields, and focus return. At 390×844, sheet/document widths were 390 with no horizontal overflow; screenshots inspected. Viewport reset, preview stopped and temporary root removed.
- Independent AR passed, including proxy-proof addendum; CR round 2 passed after patch-preservation correction. No source changes followed CR round 2.

## Final VR result

VR passed: all acceptance criteria complete.

VR risk: non-low — local credential mutation, shared persistence, and proxy authorization.

VR review round: 1; reviewer: reused.

- **Provider/model editing: complete.** 我的 → 生成服务与模型 supports the saved providers, models, Codex request reasoning, and per-task reasoning. Partial updates preserve inactive profiles.
- **Credential handling: complete.** Keep/replace/remove actions, input clearing, secret-free responses, strict patches, revision conflicts, transactional writes, and unrelated-setting preservation are covered.
- **Runtime clarity: complete.** Saved and running configuration remain distinct; override names and restart status are shown. Saving leaves live generation unchanged.
- **Local access boundary: complete.** Socket, Host, Origin, fetch-site, normalized-path, LAN-spoofing, and private proxy-proof checks pass. Missing proof fails closed; native/generic routes remain excluded.
- **Production compatibility: complete.** Actual dev and CLI paths use the shared store. CLI lifecycle, saved-settings compatibility, and explicit startup with a corrupt store pass.
- **Verification: complete.** 211/211 applicable tests and 4/4 actual dev E2E scenarios passed. Typecheck/lint passed. Recorded in-app checks cover save/reload, conflict recovery, fake-key clearing, validation, narrow layout, and focus return.

All AP tasks are complete. Implementation is unchanged since CR round 2. No real credentials, user libraries, inference, packaging, schema, or dependency changes were involved.

No edits or checks executed during VR.

## Notes

Restart the entire `pnpm dev` command once to load the new frontend guard and backend together. Saved changes require a service restart; invocation overrides remain higher priority until removed. Native desktop settings remain in the native app. Stored secrets are backend-only; new fake keys were used solely in disposable verification.

The reusable disposable dev fixture now copies workspace settings and disables pre-run dependency installation, preventing pnpm from rewriting symlinked live dependency stores. A frozen/offline reinstall repaired the previously stale local `recharts` link; no package or lockfile changes.

Local implementation commits: `788af97` (feature) and `0e2d599` (patch preservation, proxy proof and fixture isolation). Final evidence is a separate documentation commit. No push or publication.
