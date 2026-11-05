# Separate text and image providers

One provider currently performs every text task and every illustration. Users need to combine them, for example Codex or OpenAI for storyboards and Gemini for images, without a second production pipeline.

The existing provider selection remains the text provider. An optional image provider defaults to the text provider. Read-only mode remains a whole-service choice.

- [x] Settings accept an optional image provider (Gemini, OpenAI API or Codex). Existing saved settings, credentials and environment variables keep their current behavior without migration; an unset image provider follows the text provider and is not written back.
- [x] The production provider composes text work from the text provider and `generator().image` from the image provider. Queue, review, image jobs, prompt records, references, storage and timeouts use the existing workflow; image errors use the image provider's safe messages; status reports both providers/models and is configured only when both are ready.
- [x] Each API provider uses its own saved credential. Runtime variables include keys for the active text and image providers only. `SHIQU_IMAGE_PROVIDER` overrides the saved image provider for one invocation without saving or importing credentials.
- [x] CLI `--configure`, `config set`, desktop settings and connection checks can choose the image provider, its credential and model; Enter/keep retains saved values. Reset clears the image provider with other provider settings.
- [x] Native desktop settings, credentials and private runtime input support the image provider. Older settings remain readable; an unset image provider does not change the stored JSON.
- [x] Documentation covers the new option. Verification uses controlled transports, isolated settings/libraries and in-app browser preview; no live inference, packaging or publication.

No schema migration of story data, no provider fallback, no change to discovery caches or text-task reasoning. Codex/OpenAI text restrictions (no URL sources) remain unchanged. Desktop builds that predate this change cannot open settings that set a separate image provider.
