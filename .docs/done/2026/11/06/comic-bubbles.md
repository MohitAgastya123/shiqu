# Automatic comic bubbles

## Summary

- New production creates source-grounded English speech and thought bubbles, attributes speakers and fits/places them automatically. No placement step is required.
- Shared SVG/canvas geometry keeps reader and PNG/PDF/ZIP/offline previews consistent. JSON/Markdown preserve dialogue and reading order; public ZIP conversion retains signed WebP bytes.
- Optional corrections use existing local drafts, conflicts and saved revisions. Layout-only edits preserve review/artwork without AI calls. Dialogue-only scenes and repair history display correctly; existing stories remain usable.

## Verification

- `pnpm test:changed --plan` selected the full **181-file** suite; `pnpm test:changed` passed **1490/1490**, with zero skips/cancellations. Receipt: `.data/test-plans/2026-11-06T17-53-27-866Z-4949c6a0/run.json`. Initial stale caption/copy assertions were corrected and the entire suite rerun.
- `pnpm typecheck`, `pnpm lint` and `git diff --check` passed. Final browser/UI/English checks passed 11 tests; the subsequent LAN HTTP UUID regression run passed six tests. Native CI source-only checks passed **24 tests** plus rustfmt; only the designated prepared-bundle test was filtered using the CI resources override.
- `pnpm desktop:preview` and in-app browser inspection verified desktop/phone reading. Automated production E2E exercised pointer/touch/keyboard/numeric corrections, save/reload and artwork/review reuse. [Desktop fixture preview](../../../../assets/comic-bubbles-desktop.png) · [Phone fixture preview](../../../../assets/comic-bubbles-mobile.png).
- Independent AR and CR passed. The [AP](../../../../plans/2026/11/06/plan-comic-bubbles.md) contains the complete acceptance matrix, commands and evidence.

## Notes

- Placement follows planned speaker locations and reserved image space; it does not detect faces in final pixels. Crowded dialogue gets bounded feedback/retry and an explicit production failure if it still cannot fit. Real model artwork varies; verification used isolated controlled providers without paid requests or personal library data.
- No migration or desktop package is needed. Edit balloon stories with this version or later; older apps can discard unfamiliar fields. The external awesome-shiqu checkout was unavailable, so its separate parser was not run; local archive/signature/byte-preservation regressions passed.
- Committed locally on `feature/comic-bubbles` in `shiqu-fork`. Online book import remains separate. Main is unchanged.
