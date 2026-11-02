# Story publication settings

## Summary

Story settings now put the story name and downloads first, with the actual production credit and a per-story editing link below. The title uses 20px text. Large-text preferences stay under “我的 → 阅读偏好”, and “我的” no longer lists offline stories.

“我的 → 署名与转载” saves owner-scoped defaults. New stories copy those defaults at creation. Display and every PDF/PNG/ZIP download resolve currently blank work fields against the latest defaults; explicit work fields win, existing saved metadata stays intact, and shared samples never acquire the reader's name. Settings refresh the displayed author when opened or when the page regains focus/visibility.

Single-story editing includes field examples and “恢复默认说明”, which loads the latest defaults into the draft and requires an explicit save. Unsigned exports require confirmation after checking current defaults. Cached downloads go through the same check and are reused only when their resolved content identity matches. Failed default reads stop export and offer retry.

WebP signature size is configurable from 12–48 original-image pixels, defaulting to 24px. It follows the existing defaults/per-story flow and is retained in archive metadata. PDF/PNG credit layout stays unchanged.

## Verification

- Environment: Node 24.22.1 and pnpm 11.25.0, matching the repository pins.
- `pnpm typecheck` passed after the final source changes; full `pnpm lint` and `git diff --check` passed at delivery.
- 42/42 focused tests passed across `story-publication-ui`, `story-publication-defaults`, `story-publication`, `story-webp-metadata`, `reader-zip`, `reader-png`, and `reader-pdf`. Coverage includes owner/CAS guards, restart and additive migration, both creation paths, revision inheritance, draft restore/error handling, live names and stale-response guards, all three export controls, unsigned consent, cache identity, and watermark size validation/rendering.
- In-app browser verification confirmed the redesigned settings, actual “制作：yysun” display, default/per-story editing, unsigned prompts, the 12–48px slider at 24px, and removal of “离线故事”.
- An actual export of “林黛玉初进贾府” produced a 55-page PDF whose author metadata is `yysun`, while the saved work's author remained blank. This verifies runtime default resolution without rewriting the story.
- Earlier creation/generation/revision regression checks passed 114/114 during implementation. Final delivery reran the focused suites above; it does not claim a full-repository test run.

## Notes

Delivery base: `999016ace48b451d43574fc8910ddcdeb1e743e8`. Scope includes the reader UI, publication defaults/API/repository and additive migration, WebP rendering, focused tests, and user guide. The separately committed prompt-export work remains outside this delivery diff.

The optional watermark-size field preserves historical publication object shapes for CAS comparisons. The new defaults table does not rewrite existing library content. Production story exports and source images are not replaced by this change. This delivery creates a local commit; no push or publication is included.

## Final verification review

| Acceptance criterion | Result and evidence |
| --- | --- |
| Simplified story settings, larger story name, personal preferences in “我的” | Complete; source inspection and in-app screenshots verify order, 20px name, the single large-text preference location, and offline-entry removal. |
| Persisted default publication settings and independent work edits | Complete; real SQLite/API tests cover both creation paths, restart, owner/CAS guards, revision inheritance, and preserved existing snapshots. |
| Restore defaults and understandable fields | Complete; real editor-handler tests cover fresh reads, all-field draft replacement, cancellation, save expectations, failures, and retry; browser verification confirms the five placeholders. |
| Display the actual resolved producer | Complete; settings show `yysun`; tests cover focus/visibility refresh, explicit work credits, unsigned/default-read-error states, retry, and out-of-order responses. |
| Live credit checks for PDF/PNG/ZIP and repeated downloads | Complete; all controls fetch current defaults before output or unsigned consent, preserve explicit fields, fail without exporting on read errors, and use the resolved cache identity. The actual PDF reports author `yysun`. |
| Configurable WebP signature size | Complete; 12–48px integer validation, 24px default, default/per-story persistence, draft restore, cache identity, WebP canvas sizing, and archive metadata are covered. PDF/PNG layout is unaffected. |

CR risk: low — localized reader behavior, an additive defaults table, and optional metadata preserve existing story contracts.

CR review round: 8; reviewer: not applicable

CR passed: no major findings

VR risk: low — existing saved content is preserved; focused persistence, export, and browser evidence covers the final behavior.

VR review round: 1; reviewer: not applicable

VR passed: all acceptance criteria complete
