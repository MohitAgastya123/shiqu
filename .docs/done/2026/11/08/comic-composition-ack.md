# Filled comic pages and ACK comics

## Summary

- Compose up to six ordered panels with tighter gutters, protected-aware art fitting and mixed portrait/wide rows; incomplete rows finish a story only.
- Automatically fit compact comic speech/thought balloons with short attached tails, whole-word lettering and safe text bands. Keep optional touch controls usable with smaller balloons.
- Add **ACK comics** to ordinary/import/revision creation and carry validated scene canvases/staging through providers, repairs, reuse, reader and production exports.

## Verification

- `pnpm test:changed --plan` selected full/native coverage: 195 source files. Final `pnpm test:changed`: **1,602 passed, zero failed/skipped**. `pnpm typecheck`, `pnpm lint`, and `git diff --check` passed; independent AR and final CR passed.
- Source-only `cargo test --locked --lib` with the documented prepared-bundle filter: **24 passed**; `cargo fmt --check` passed. No installer was prepared.
- Production browser flows passed, including ACK persistence, actual page reflow, reflection/series navigation and touch revisions. Inspected Vite/IAB desktop and 390px zoom, all six synthetic production PDF pages, PNG/ZIP/offline output and signed WebP byte preservation. The user's separately started ACK comic completed 10 images; all four actual comic pages were inspected.

## Notes

- Protection uses planned staging, not pixel face recognition. Unknown legacy or crowded scenes may use conservative text bands/containment; baked lettering and signed archives remain intact. Verification started no paid redraw or personal-library migration.
- Delivery uses `feature/comic-composition-ack`, including the existing upload-story ancestry (`a2ad538`, `8f23d07`). Feature source commit `ee517a1` was pushed and verified against origin by full hash; main remains `5624163`. Private QA artifacts are excluded.
