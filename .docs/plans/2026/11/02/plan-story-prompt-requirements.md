# Story prompt requirements

Git base: ebd42ec813f21b44d21b7072558c6c87a9a780ba
Risk: non-low — persisted selection/document additions, three providers, review gate and version/image reuse contracts.

## Decisions
- acceptancePrompt is optional in stored selection/settings and normalized to empty at use sites, preserving legacy request hashes and typed call sites.
- Acceptance lines become individually numbered criteria; model output must cover each exactly once with status, evidence and related frame IDs. Failed criteria must map to actionable existing issues (including ending page 0). Unknown/conflicting criteria immediately block with a distinct requirements stop reason and a reason visible in acceptance results, without manufacturing repairable issues.
- Capture actual application instructions, serialized textual input and output schema at the shared call boundary and provider-specific full-plan/image paths. Store alongside existing usage records, fetch on demand through an owner-scoped endpoint; do not inflate shelf/polling payloads. Preserve inherited records with explicit origin version when reusing content; no fake historical reconstruction.
- Preview shows current shared rule sections before execution and labels them as preview; actual captures are authoritative and include stage-specific inputs. No secret/provider headers or image bytes are included.
- Acceptance-only changes fork and reset review, without forcing replan or image invalidation. Pending uncompleted plans continue using new requirements.

## Tasks
- [x] Add acceptance setting across schema/intake/revision and revision inheritance; retain legacy defaults and reuse.
- [x] Add numbered acceptance evaluation to review schema, strict parser validation and repair loop; pass criteria to production/repair stages.
- [x] Capture actual prompts for Codex/OpenAI/Gemini and engine/queued image persistence; add on-demand prompt and result read endpoint and preview.
- [x] Add sibling links and shared editable acceptance UI with expandable/copyable previews, captured records and evaluation results.
- [x] Add meaningful provider-contract, review-gate, revision persistence and UI regression coverage.
- [x] Run Node 24.22.1 / pnpm 11.25.0 typecheck, lint and all applicable test suites; no build/package.
- [x] Execute .docs/tests/test-story-prompt-requirements.md in the in-app browser using an isolated fixture. Desktop shell preview via pnpm desktop:preview if relevant; story UI runs in its existing reader/Vite session.

## Risks
Full textual snapshots add storage; use existing per-call retention without introducing global tracing, keep snapshots out of summaries. Strict criterion validation can reject malformed model replies, preserving the script and preventing drawing. Older records have no prompt captures and must say so.

## Reviews and evidence
AR passed: no blocking architecture flaws
AR risk: non-low — persisted settings, provider requests and review gating.
AR review round: 1; reviewer: new (requirements_review).
Review decision incorporated: unknown/conflicting criteria block immediately via requirements stop reason.

SS evidence: typecheck/lint passed on pinned Node/pnpm; 48 existing targeted checks, 13 provider/criteria checks and 11 focused UI/persistence checks passed. In-app browser confirmed sibling links, actual review capture, saved per-criterion outcomes, and acceptance-only revision showing 3 reused / 0 redraw. Remaining full TT and E2E are tracked above.

SS milestone: 3c0ce39 — implementation and focused checks passed; full TT/ET pending.

CR passed: no major findings
CR risk: non-low — persisted criteria/captures, review gating and image reuse.
CR review round: 1; reviewer: reused (requirements_review).

CR passed: no major findings
CR risk: non-low — shared blocked-review presentation and model boundary instructions.
CR review round: 2; reviewer: reused (requirements_review).

TT: pinned Node 24.22.1 / pnpm 11.25.0, typecheck and lint passed. Full `pnpm test` had 980 passes and one 80-frame completion timeout under default parallel load; the same test passed alone in 10.7s without changing its 15s bound. Full equivalent suite `pnpm exec node --experimental-strip-types --test --test-concurrency=2 tests/*.test.mjs` passed all 981 tests in 148.2s (80-frame case 13.6s). After the shared-stage/instruction correction, 16 focused checks passed. Final legacy missing-usage guard and stage/UI/persistence checks: 13 passed. No assertions/timeouts weakened.

ET: .docs/tests/test-story-prompt-requirements.md executed with tests/fixtures/story-requirements-preview.mjs in IAB at 127.0.0.1:3140. Two sibling links confirmed in creation, completed reading and paused pre-plan flows. Both creation drafts survived reload. Actual review call showed instructions/input/schema; copy succeeded and was verified by pasting the complete prompt into a temporary draft, then discarding it. Historical no-record display verified. Acceptance-only child submission showed 3 reusable / 0 redraw, completed audit and saved its own changed requirements/results/receipt. Failed→repair→passed and unknown→immediate stop are covered by real REST/SQLite/queue tests; status/result presentation is covered by shared UI rendering and stage parity tests. Screenshot: .docs/tests/evidence/story-prompt-requirements/acceptance.jpg. All data/providers were disposable and controlled; no live inference or user stories were changed.

Additional compatibility repair: prompt inspection treats legacy documents without a usage array as having no captures, matching existing story rendering; regression added.

## User correction: flow action hierarchy

User observes resume rendered as a link and shelf return sometimes absent. Inspection identifies the completed-script reading settings branch passes no primary flag to StoryGenerationControl and has no shelf-return button; the generation status branch styles shelf return as green primary, while discovery/legacy-count branches use a faint text action.

- [x] Add one shared secondary shelf-return button to generation status, unselected discovery, legacy count and reading flow settings; reuse a navigation handler that closes sheets and returns to the actual shelf.
- [x] Request primary resume styling only in flow/settings surfaces; retain compact shelf controls. Preserve explicit confirmation/resume and busy/paused semantics.
- [x] Verify affected shared UI controls/callbacks, typecheck/lint and browser confirmation, paused-before-plan and reading-settings branches; existing whole-suite evidence remains valid for unchanged provider/data behavior.

AR passed: no blocking architecture flaws
AR risk: low — localized, reversible action hierarchy/navigation changes.
AR review round: 2; reviewer: reused (requirements_review). This extension changes UI presentation/navigation only, not generation/persistence contracts.

User-correction verification: typecheck/lint passed; 10 existing shared-UI/revision checks and 17 UI/navigation checks passed. IAB verified paused pre-plan and paused reading-settings branches: resume has yu-primary, shelf exit has secondary yu-generation-back; both navigate to the actual shelf with URL / and no active dialog. The reading branch was missing this exit before. Screenshots flow-actions-paused.jpg and flow-actions-reading.jpg saved under .docs/tests/evidence/story-prompt-requirements/. Shared render tests cover discovery/choosing/confirming and idle/failed/running paused controls without auto-resume. No provider/data behavior changed; existing full981 plus focused16/13 results retained.

SS milestones: 5033753 — blocked acceptance status and historical usage guard; 1aa7888 — primary resume and consistent secondary shelf exits. Final typecheck/lint passed after source stabilized.

CR passed: no major findings
CR risk: low — final flow presentation/navigation and historical missing-usage guard.
CR review round: 3; reviewer: reused (requirements_review).

VR passed: all acceptance criteria complete

VR risk: non-low — the complete story changes persisted requirements, provider requests, review gates and version provenance.
VR review round: 1; reviewer: reused

| Criterion | Verdict and evidence |
|---|---|
| Two sibling requirement entries | Complete. Creation, paused and reading flows use the two shared editors; primary IAB evidence and shared UI tests cover their presence. |
| Independent per-story persistence | Complete. Optional schema preserves legacy records; intake draft/restart/confirmation and revision tests establish separate saved values and inheritance. |
| Inspectable actual prompts | Complete. Three-provider request/capture equality tests cover instructions, input and output contract. Owner-scoped retrieval preserves origin and reference links. IAB copy/paste and historical no-record evidence recorded. |
| Criteria govern review and repair | Complete. Strict validation rejects missing/duplicate/invalid results. Failed criteria enter repair and fresh audit; unknown criteria stop repair/drawing with evidence and an edit route. |
| Acceptance-only version reuse | Complete. Revision logic preserves scripts/images and resets review. Integration and IAB evidence show three reused, zero redraw, new review capture and unchanged original. |
| Results, legacy state and preserved behavior | Complete. Shared UI displays criterion evidence and missing history. Legacy missing-usage regression, provider contracts, queue/revision suites and shared timeline parity cover compatibility. |
| Primary resume and secondary shelf return | Complete. Shared controls cover all four rendering branches. Navigation tests and IAB evidence verify actual shelf navigation. Independently inspected both saved flow screenshots: green resume and outlined shelf exit are visible. |

Validation evidence: full suite passed **981/981** with concurrency 2; the default-concurrency 80-frame timeout and successful isolated/bounded reruns remain disclosed. Typecheck, lint and subsequent focused checks passed. No test assertions or timeout limits were weakened.

No remaining acceptance gaps. Browser interaction evidence is reused from the primary agent; screenshots and implementation were independently inspected. No tests were rerun during this review.
