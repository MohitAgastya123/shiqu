# Saved paused comparison drafts and consolidated the report

Added explicit `stories copy --draft` to the existing production copy service. It preserves unpassed review checkpoints and model provenance as paused text-only copies, retains normal reviewed-copy guards and rejects image copying. No schema migration or provider-setting change.

Claude's 67-frame and DeepSeek's 50-frame drafts are saved in the configured desktop library, labelled by model, with exact original/text/review-history checks. The idle backend released its lease for the CLI imports, then its existing watcher restarted it; API and in-app browser shelf verification confirmed both saved drafts. The user's later pause instruction was rechecked: both remain idle/paused with zero images and no running production. Sources remain unchanged.

The [single comparison report](../../../../reports/2026/11/05/model-comparison-huoyanshan.md) retains all 244 captions across five models, distinguishes passed results from drafts, and includes saved desktop-copy receipts. Superseded public reports and the private DeepSeek comparison were removed, links updated. Implementation/report commits: `2b8b4f4`, `04d56e7`; no push.

Node 24.22.1 / pnpm 11.25.0: 16 focused and 55 related checks pass, along with typecheck, scoped lint and whitespace/link checks. Private verification receipts and copied test logs remain under the respective `.data/comparisons/huoyanshan-{claude,deepseek}-.../` directories. Independent CR passed without findings.

VR passed: all acceptance criteria complete.

- Explicit production draft copying preserves text, source, unpassed review and provenance in paused independent stories; default reviewed-copy guards remain.
- Desktop copies verified: Claude **67 frames / repair**, DeepSeek **50 frames / pending**; both paused, zero images, no override or model calls. Sources and provider settings remain unchanged; service restored.
- One consolidated report retains all **244 captions** and unfinished-status distinctions; superseded reports and links removed.
- Scoped commits verified: `2b8b4f4` and `04d56e7`. Unrelated recovery/release changes remain outside these commits; no push.
- Validation reused: 16 focused checks, 55 related checks, typecheck, scoped lint and live copy/pause evidence.

The original generation-to-`reviewed` objective remains incomplete. Both desktop drafts stay paused under the user’s latest instruction.

VR risk: non-low — cross-library persistence and review-preservation boundary.
VR review round: 1; reviewer: reused.
