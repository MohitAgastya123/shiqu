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
- [ ] Run Node 24.22.1 / pnpm 11.25.0 typecheck, lint and all applicable test suites; no build/package.
- [ ] Execute .docs/tests/test-story-prompt-requirements.md in the in-app browser using an isolated fixture. Desktop shell preview via pnpm desktop:preview if relevant; story UI runs in its existing reader/Vite session.

## Risks
Full textual snapshots add storage; use existing per-call retention without introducing global tracing, keep snapshots out of summaries. Strict criterion validation can reject malformed model replies, preserving the script and preventing drawing. Older records have no prompt captures and must say so.

## Reviews and evidence
AR passed: no blocking architecture flaws
AR risk: non-low — persisted settings, provider requests and review gating.
AR review round: 1; reviewer: new (requirements_review).
Review decision incorporated: unknown/conflicting criteria block immediately via requirements stop reason.

SS evidence: typecheck/lint passed on pinned Node/pnpm; 48 existing targeted checks, 13 provider/criteria checks and 11 focused UI/persistence checks passed. In-app browser confirmed sibling links, actual review capture, saved per-criterion outcomes, and acceptance-only revision showing 3 reused / 0 redraw. Remaining full TT and E2E are tracked above.
