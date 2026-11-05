# Copy comparison drafts and consolidate the report

Base: `f1451e3` (inspect HEAD again before implementation; concurrent commits may be unrelated). Preserve pre-existing `server/reader-commands.ts` and `tests/story-flow-control.test.mjs` changes.

Risk: non-low — additive cross-library persistence behavior, explicit review-preservation boundary and exclusive desktop library ownership.

1. [x] Extend the existing production copy service/CLI with explicit `stories copy --draft`. Default copy continues requiring non-overridden passed review. Draft copy requires a stopped current source with original, complete saved plan and a review checkpoint; preserves pending/repair review state and provenance, creates paused independent text only, rejects images and incompatible replay intent. Reuse existing database initializer, ownership and repository writes; no schema migration or direct task SQL.
2. [x] Verify isolated draft copying, same-request replay, default rejection, no images/inference, exact plan/original/review history and rejected source/image cases. Run relevant copy/headless/provider/flow regressions, typecheck and scoped lint; independent review.
3. [x] Preserve current source snapshots/identities. Confirm the desktop queue idle. Gracefully stop only its current Node backend (owned by the existing Node watcher), import both drafts with stable saved request IDs via source CLI, rename copies to include model/draft, then touch the observed dev server output to restart the existing watcher. Verify HTTP library availability, both copies, model identities, text/source/review equality and zero images. Restore service in finally even if an import fails. Never bypass a live library lock.
4. [x] Merge all story comparison reports into `.docs/reports/2026/11/05/model-comparison-huoyanshan.md`, incorporating the existing private DeepSeek comparison, and remove superseded report documents after preserving their content. Update README and implementation-document links. Validate all 244 saved captions (16+41+70+67+50) and local links.
5. [ ] Commit only this work, including the previously uncommitted Claude implementation/report records. Record evidence and any remaining generation blocker; do not claim the drafts passed review or push.

Runtime feasibility: live API on port 3000 currently reports no running production stories. Desktop configured library is `/Users/esun/Library/Application Support/com.shiqu.desktop/library`. Current owner PID 43528 runs Node24 `--env-file-if-exists=.env dist/dev/server.js`, parent 66162 is the dev watcher. Resolve current owner afresh before stopping, and check the parent command before the controlled stop/restart.

AR passed: no blocking architecture flaws.
AR risk: non-low — additive cross-library persistence behavior with review preservation and exclusive library ownership.
AR review round: 1; reviewer: reused (`claude_review`). Persist draft intent, reject image continuation, resolve current ownership immediately before the copy window, and restore the watcher in finally.

TT: Node24.22.1 / pnpm11.25.0 typecheck, scoped ESLint and diff checks pass. Focused copy/headless suite 16/16; related copy/revision/review-history/library ownership suite 55/55 (`/tmp/shiqu-draft-copy-regressions.log`). The explicit test fixtures verify exact saved review/plan/original and source immutability; no user's data is used for tests.

CR passed: no major findings.
CR risk: non-low — cross-library persistence and review-preservation boundary.
CR review round: 1; reviewer: reused (`claude_review`).

Implementation milestone: `2b8b4f4` (draft-copy service/CLI, tests and development documentation).

Live ET: both explicit paused draft copies saved and verified via restored production API. Claude target `a768aa6f-5a11-4e2d-bcd5-28eecc13b5db`, 67 frames, repair review; DeepSeek target `e51c0444-f250-426d-a6fa-af802b0c4cb2`, 50 frames, pending review. Zero model calls/images, no override. Exact plan text/original/reflection/model list/review-history equality and unchanged sources verified. Backend graceful stop released ownership; existing watcher restarted it, provider status unchanged. In-app browser shelf visibly shows both titles, paused, 0/67 and 0/50 images. User explicitly requested pause again; both paused states reverified without restarting generation. Per-source private `desktop-draft-verified.json`, lifecycle and pause verification receipts preserve evidence.

Consolidation: one five-model report with all 244 exact captions; deleted two superseded public comparison reports and the private DeepSeek comparison.md, retaining original JSON/history evidence. Updated README and Claude implementation links.
