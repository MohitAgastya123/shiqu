# Local stories and automatic comic series

## Summary

- Added **Upload a story** for local Word `.docx` and selectable-text PDF, with complete extracted-source previews and automatic natural part plans before any AI calls.
- One confirmation creates ordered comics through the existing production workflow, with exhaustive source-unit review, cumulative character context, automatic series references, ordinary bubbles and PDF/PNG/ZIP exports.
- Added durable replay-safe series controls and targeted recovery across pause/restart, failed preparation/generation, completed-part revisions and lost images; completed later work remains saved.

## Verification

- `pnpm test:changed --plan` selected 192 files and native checks; final `pnpm test:changed` passed **1,567 tests**, with zero failures/skips. `pnpm typecheck`, `pnpm lint` and `git diff --check` passed on the final source.
- Four real Word/PDF browser cases passed, including lost-response/reload, four-part ordered recovery, phone layout and a 230-chapter upload replanned into 115 parts. Parser/text 23/23, backend/regression 63/63 and upgrade regressions 42/42 passed; shared production PDF/PNG/ZIP/public exporters were exercised.
- Native source-only Cargo checks passed **24 tests** and rustfmt. Independent AR, CR and final VR passed. Desktop Vite preview/IAB verified the interface; [automatic plan](../../../../assets/story-import-plan.png) and [phone overview](../../../../assets/story-import-phone.png) retain synthetic test evidence.

## Notes

- Committed locally on `feature/story-import-series` from main `5624163`; the running source checkout includes the feature.
- Limits: 10 MiB, 500 PDF pages, 2 million extracted characters and 200 parts. Legacy `.doc`, OCR/scanned or encrypted PDFs and unsupported/damaged Word content fail clearly instead of dropping source text. Story fidelity is reviewed; identical generated faces are not guaranteed.
- Additive migration 0022 uses normal verified whole-library backup protection. Normal development startup was restored after final checks and its exact backup path is retained locally in `.data/reviews/story-import-startup.json`. No migration probes or paid generation ran against the personal library.
- One prepared-bundle native test was filtered because no installer build was requested. Initial regression failures from migration expectations/legacy receipt handling were fixed; a previously seen concurrency flake passed its scoped rerun and the final full suite. No unresolved review blockers remain.
