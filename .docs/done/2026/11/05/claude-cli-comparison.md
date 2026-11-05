# Claude Code adapter; live comparison blocked by subscription quota

The invocation-only Claude Code text provider now runs the shared production planning/review/repair workflow with subscription-only login, disabled tools/customizations, actual model receipts, safe diagnostics and subprocess cleanup. Images are explicitly rejected.

The preserved fire-mountain inputs produced a 78-frame draft, then three structural repairs saved 67 frames. Four count audits ran; the fourth proposed 65 frames, but its repair hit the five-hour Claude subscription limit. CLI reported reset at 2026-11-05 13:20 America/Toronto. No full-story review, override or images occurred. The [comparison report](../../../../reports/2026/11/05/model-comparison-huoyanshan.md) is explicitly preliminary.

Node 24.22.1 / pnpm 11.25.0 typecheck and scoped ESLint pass. 169 applicable integration checks passed; 18 focused quota/diagnostic checks passed after runtime quota handling was corrected. Independent CR round 3 passed. Live source/context hashes, selection, all 14 saved prompt inputs and all 67 report captions were verified. No build, publication or push.

Private evidence and frozen recovery identity: `.data/comparisons/huoyanshan-claude-2026-11-05T13-21-32.932Z/`. After quota reset, resume the current fault using `resume-input.json` / `resume.md`, continue the same story to reviewed, then update the comparison. Do not recreate the draft, change billing/provider, bypass review or generate images.

CR passed: no major findings.
CR risk: non-low — subscription subprocess integration affects production routing and shutdown.
CR review round: 3; reviewer: reused.

VR incomplete: the Claude story has not reached `reviewed`.

- **Complete:** Invocation-only Claude provider, model/path overrides, shared task effort settings and unchanged desktop profile.
- **Complete:** Subscription-only authentication, disabled tools/customizations, bounded subprocess execution, shutdown cleanup and safe diagnostic errors.
- **Complete:** Shared production prompts, schemas, validation and workflow; actual model/usage/request receipts; explicit image rejection.
- **Incomplete:** Independent live comparison to `reviewed`. Saved state is `failed` / `active` at the fourth structural repair. There are **67 saved draft frames**, four count audits, three applied structural repairs, **zero full-story audits**, no override and **zero images**. The proposed 65-frame result has not been applied.
- **Complete:** Preserved inputs, current draft, history, prompts, comparison report and fixed recovery identity. Selection and both source hashes match the prior inputs; the 14 prompt records carry the same originals. All 67 report captions match the saved draft, and refreshed snapshots contain no UTF-8 replacement characters.

The report accurately identifies the quota interruption and unfinished result. Continue the same saved story after quota reset, then verify the passed review boundary and zero images.

Follow-up user instruction (2026-11-05): comparison reports consolidated into `model-comparison-huoyanshan.md`; Claude and DeepSeek drafts saved as separate paused desktop-library copies. User explicitly requested both stories remain paused. Do not resume generation automatically when quota resets; wait for an explicit resume request. Exact copy/pause evidence is recorded in `plan-copy-comparison-drafts.md` and the consolidated report.
