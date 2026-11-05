# Separate text and image providers

## Summary

The saved provider remains the text provider for discovery, storyboards, review and repair. A new optional image provider (Gemini, OpenAI API or Codex) draws the illustrations. Unset means "same as text", which keeps existing settings, credentials and environment behaviour unchanged.

`createReaderProvider` composes the two existing providers by replacing only `generator().image`. The production queue, references, prompt records, storage and review loop are unchanged. Image errors and timeouts follow the image provider. Status keeps text-derived cache identity, reports both models, and is configured only when both sides are ready.

Settings (TS and native Rust) store `imageProvider` only when it differs from the text provider. Each API provider keeps its own credential, and runtime variables include keys only for the active providers. `SHIQU_IMAGE_PROVIDER` overrides the image provider for one run. CLI `--configure`, `config set`, desktop settings, connection checks, reset and docs cover the new choice.

## Verification

Node 24.22.1 / pnpm 11.25.0: typecheck and lint pass. New `tests/separate-providers.test.mjs` covers:
- composition, error routing through `withLocalBooks`, status and timeouts
- the real production queue with Codex text and Gemini images
- the settings store, invocation overrides, CLI configure and desktop checks

PTY and settings fixtures were updated for the image question. Rust tests cover the image credential, readiness, env overrides and TS↔Rust interop. Remaining failures (6 JS, 1 Rust) are pre-existing and identical on the base; details are in the plan. Playwright checked the desktop preview.

## Notes

Settings with a separate image provider need this version or later of the desktop app and CLI; older builds refuse them. No live inference, story-data migration, Docker/desktop packaging or publication.
