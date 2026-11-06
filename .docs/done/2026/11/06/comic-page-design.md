# Finished comic pages

## Summary

- Speech uses compact ovals with short attached tails; thoughts use clouds and circle trails. Visible lettering contains dialogue alone, with speaker attribution retained in metadata and transcripts.
- Bundled Comic Neue Bold and artwork-toned fills work across the reader, PDF, PNG, composed ZIP panels and offline HTML. The complete OFL notice ships with desktop and npm distributions.
- Comic pages automatically combine normal, wide, tall and splash panels, enlarging dense content at a 24-unit final-sheet minimum. Full artwork, complete narration, source-frame order and saved progress remain intact; no positioning step is required.
- Phone zoom opens on the selected scene, with native pan and an accessible transcript. Bounded shared geometry reuse removed repeated loading stalls in the 80-frame/four-balloon stress case.

## Verification

- `pnpm test:changed --plan` selected all **186 JS files**; `pnpm test:changed` passed **1,514/1,514**, zero skips/cancellations. Receipt: `.data/test-plans/2026-11-06T20-38-32-197Z-ece76ee9/run.json`. Initial route setup and obsolete frame/page assertions were corrected and the full suite rerun.
- `pnpm typecheck`, `pnpm lint`, staged diff checks, **24 native source-only CI tests** and rustfmt passed; only the designated prepared-bundle test was filtered using the CI resource override. Independent AR and CR passed, including navigation, embedded-font provenance, canonical ZIP layout validation, cache safety and font licence distribution.
- `pnpm desktop:preview` plus in-app browser desktop/390px phone checks passed. All six rendered production-PDF pages were inspected; production ZIP tests retained signatures, XMP, complete source text and public-conversion WebP byte equality. [Desktop](../../../../assets/comic-pages-desktop.png) · [Phone](../../../../assets/comic-pages-phone.png) · [Selected-panel zoom](../../../../assets/comic-pages-zoom-initial.png).

## Notes

- Verification used isolated controlled providers and synthetic artwork, with no paid inference or personal-library mutations. Placement follows planned speaker targets; it does not detect faces. Portrait artwork retains artwork-toned matte space in differing panel shapes, and old baked lettering remains conservatively full-page with unknown size explicitly recorded.
- Feature commit `2482803` was pushed to `origin/feature/comic-bubbles`; the remote head was verified. Main is unchanged. No database migration or desktop packaging was required. Refresh the reader and re-export existing comics to receive the new presentation.
