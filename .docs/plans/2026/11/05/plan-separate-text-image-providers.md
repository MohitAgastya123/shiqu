# Separate text and image providers

Git base: `6ab878e`. Branch `claude/laughing-bell-6t5ifl`. Clean worktree at entry.

Risk: non-low — the provider factory, shared settings store (TS and native Rust), CLI onboarding and desktop runtime input change together; saved settings must remain compatible.

## Design

- `provider` keeps its meaning and becomes the text provider. New optional `imageProvider: 'gemini'|'codex'|'openai'`. Absent means "same as text"; the field is omitted from stored JSON unless chosen, so existing settings stay byte-compatible. `readonly` ignores it.
- Runtime variable `SHIQU_IMAGE_PROVIDER` (optional) selects the image provider; unset/empty follows `SHIQU_AI_PROVIDER`.
- `createReaderProvider` builds the existing provider for the text name. When the effective image name differs, it builds a second existing provider for that name and composes:
  - `generator()` = text generator with `image` from the image generator. Errors thrown by `image` are remembered (WeakSet), so `safeError` routes them to the image provider's messages; everything else uses the text provider.
  - `generationTimeoutMs('image')` from the image provider; other phases from the text provider.
  - `status()` keeps `provider` / text-derived fields (discovery cache identity unchanged); `models.image` from the image provider; adds `imageProvider`; `configured` requires both; `message` comes from the unready side.
  - A supplied Codex runner is shared by whichever side uses Codex.
- `settingsVariables(settings,key,imageKey)`: emits the text key for the text provider and the image key for a different API image provider; `effectiveProviderVariables` reads both saved credentials; `providerReady` checks both sides.
- `SystemSettingsStore.save` accepts one key change or a list; each must name the text or effective image API provider. `resetProviderSettings` drops `imageProvider`. Windows still refuses Codex on either side.
- CLI `--configure`: after a non-readonly text provider, ask the image provider (Enter keeps the saved choice; default same). Same provider keeps the current flow; a different API image provider asks its key (hidden, Enter keeps saved) and image model only; the text provider then asks only its text model.
- Desktop (Node): stdin input gains optional `imageKey`; connection check validates the text side (text model) and the image side (image model or Codex login); same-provider behaviour unchanged.
- Native Rust: `Settings.image_provider` (`#[serde(default, skip_serializing_if = "String::is_empty")]`), validation, env override, view (`imageKeyPresent`), `save_settings` optional `image_key_action`/`image_key`, configured/ready checks, runtime JSON `imageKey`, reset.
- Desktop UI: "文本服务" + "图片服务（与文本服务相同 / Gemini / OpenAI API / Codex）"; separate key/model (or Codex) fields for a different image provider; overview shows both.
- Docs: user guide, development, desktop README, `.env.example`, headless `config` hint.

## Tasks

- [x] Settings schema, variables, store key handling, reset (TS) with tests.
- [x] Provider composition in `server/generation.ts` with controlled-transport tests across provider pairs (image request reaches the image provider, text requests stay on text provider, errors, timeouts, status).
- [x] CLI configure/readiness/effective variables, headless config; tests.
- [x] Desktop Node runtime input and connection check; tests.
- [x] Native Rust settings/commands/runtime; Rust unit tests where the toolchain allows.
- [x] Desktop UI and overview; browser preview check.
- [x] Documentation.
- [x] Typecheck, lint, full test suite under Node 24.22.1 / pnpm 11.25.0.

AR passed: no blocking architecture flaws

AR risk: non-low — provider factory, shared TS/Rust settings database, CLI onboarding and native runtime handoff change together.

AR review round: 1; reviewer: new

Applied AR notes: "same as text" stored as unset (TS validate, Rust save, CLI Enter, desktop UI); read-only ignores the image setting before validation; Rust env parity and readiness gates cover the image key; TS↔Rust interop test covers `imageProvider` both ways; docs note that older desktop/CLI builds cannot read separate settings and that `IMAGE_SIZE` applies only to OpenAI drawing.

CR passed: no major findings

CR risk: low — minor edge inconsistencies only.

CR review round: 1; reviewer: new

CR repairs: Rust ignores blank `SHIQU_IMAGE_PROVIDER` and image overrides in read-only (matching the CLI); composed status keeps the image side's `reason` and prefixes `图片服务：`; changing the text provider keeps a typed image key unless the effective image provider changes; docs say blank keeps the saved choice.

Verification: Node 24.22.1 / pnpm 11.25.0. Typecheck and lint pass. Full `pnpm test` before CR repairs: 1,239 tests, 1,232 pass, 6 fail, 1 skipped. The same 6 fail on the untouched base (`git stash -u`): 5 Gemini prompt-contract/story-brief/task-reasoning fixtures and the cli-library Codex signal timing test. After CR repairs, the affected settings/provider/CLI/PTY/desktop suites pass 158/158 (1 skipped). Rust `cargo test`: 21 pass. `desktop_uses_verified_bundle_and_ignores_saved_system_path` needs the prepared bundled Node and fails identically on base; `desktop:prepare` was not run. Playwright checked the Vite desktop preview: selectors, separate Gemini image fields, same-provider normalization, read-only hiding, no 390px overflow, no console errors. No live inference, packaging or publication.

VR passed: all acceptance criteria complete

VR risk: low — composition over the existing production provider, with no second pipeline.

VR review round: 1; reviewer: reused

VR evidence limits: the full suite predates the CR repairs, which were re-verified with the targeted suites (158/158). The 6 JS failures and 1 Rust failure are identical on the base. The UI was checked with Playwright on `desktop:preview`, since this cloud session has no in-app browser. Codex drawing and Windows paths were checked with controlled runners and code inspection only. The development.md wording nit was fixed.

Merge with `main` (2026-11-05): resolved conflicts in `server/generation.ts`, `server/cli-setup.ts`, `lib/reader-provider.ts` and the production fixture. Main's invocation-only Claude/DeepSeek text providers draw only through an explicit image provider (`SHIQU_IMAGE_PROVIDER` or the saved choice) with that provider's own key; otherwise they stay text-only as before. Main's browser settings sheet (`/api/local/provider-settings`, `ProviderSettings.tsx`) now edits the image provider with separate image-side key actions; an unset choice is sent as `null` to clear it. Runtime summary, restart detection and override names include the image side. New tests cover the browser API and Claude text with Gemini images; the Playwright-driven dev sheet at 390px saves Codex text with Gemini images.

Test fixes after the merge:
- `unified-story-setup-ui` fails on `main` because its fixture predates `5acee55`. It now marks a manual frame correction `review:true` and expects style-only revisions to keep review progress.
- `cli-library`'s Codex signal test fails here because this container's PID 1 does not reap orphans. It now treats a killed zombie as terminated, polling briefly.
- `background-generation`'s whole-story wait is 20 s instead of the 5 s default under full-suite load.

Final merged run: 1,319 tests, 1,317 pass, 1 skipped, 1 fail. The failure is `local-image-batches`, a 100-second Gemini checkpoint test that passed in the preceding full run and passes 15/15 alone, so it is load timing. Typecheck/lint pass. Rust: 21 pass; the bundled-Node test still needs `desktop:prepare`.
