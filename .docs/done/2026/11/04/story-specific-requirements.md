# Story-specific setup requirements

## Summary

Generic production text now lives in system instructions. After story selection, the existing 准备故事 call proposes editable source-specific 制作要求 and 2–4 corresponding 验收要求; the synopsis remains separate. Generation consumes production guidance, full review consumes acceptance criteria, and repair receives specific review findings.

Draft edits, intentional blanks and concurrent saves survive restart and reselection. Automatic guidance is replaced for a new story; provenance survives ordinary revisions and failed preparation. Implementation milestone: `28bfd84`.

## Verification

Node 24.22.1 / pnpm 11.25.0. Typecheck and lint passed. Controlled production adapters exercised all providers, isolated libraries and real persistence; the in-app browser verified both editors and save/reload without starting generation. The full workspace suite and isolated committed-provider results are detailed in the final VR below.

## Notes

No live inference, provider configuration changes, database migration, Docker/desktop packaging or publication. Concurrent Gemini grammar/evidence work remains untouched and excluded from this implementation commit. Final delivery preserves the implementation milestone and commits only the remaining completion and verification records.

## Final verification review

VR passed: all acceptance criteria complete

VR risk: non-low — coordinated provider contracts, editable setup persistence and reselection provenance.

VR review round: 1; reviewer: reused

1. **Complete — story-specific suggestions.** Shared preparation requests and validates production guidance plus 2–4 acceptance criteria in the existing call. The prompt requires the complete original and separates adaptation choices from the factual synopsis. Provider contract tests cover Codex, Gemini and OpenAI.

2. **Complete — editable, durable confirmation draft.** Production-backed cases verify populated fields, restart persistence, edits and intentional blanks, confirmation-only application, and concurrent drafts winning through progress/final checkpoints. The primary agent’s in-app browser verification confirms populated editors, edit/save/reload behavior and the production confirmation gate.

3. **Complete — reselection and authored overrides.** Regressions cover replacement of unchanged generated values, preserved authored text/blanks, ordinary revision provenance, open/committed reselection, and failed preparation followed by newer edits.

4. **Complete — generic rules moved to system prompts.** Fresh and cleared production fields stay empty; recognized historical presets normalize to empty while authored strings and historical captures remain intact.

5. **Complete — generation/validation separation.** Provider-boundary tests show acceptance lists reach full review only. Creation, frame review, reflection and repair omit them; repairs consume specific findings. Acceptance failure/recheck and acceptance-only revision tests preserve the existing repair and image reuse behavior.

6. **Complete — shared production implementation.** Changes ship through production providers, engine, persistence and UI. Tests use controlled transports and isolated libraries. Typecheck/lint pass. Final committed-provider routing verification completed **26/26**, source-specific cases **8/8**, reselection/revision cases **34/34**, and affected generation/flow cases **77/77**.

**Evidence limits:** The complete workspace suite passed **1,224/1,226**; its two failures arose from concurrent Gemini evidence-format edits. Both pass when loading the exact provider committed in `28bfd84`, without modifying the workspace. No live inference benchmark was performed, so these checks establish contract/routing/persistence behavior, not the quality of every future model-generated suggestion. No tests were executed or files edited during this VR.
