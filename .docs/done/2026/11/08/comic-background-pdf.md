# Illustrated balloon backgrounds and reliable PDF downloads

## Summary

- Panel 3 now places its balloons over bounded reused forest scenery, revealing original canopy first and preserving the original foreground transform. Shared reader/PDF/PNG/ZIP/offline presentation uses independent scenery clipping.
- Sampling reserves headroom above every face, respects protected action/targets, and caps scale. The actual-PDF review caught duplicated hair; the corrected guard and regression preserve the one original head.
- Each development frontend owns a unique Vite optimizer cache. Failed competing launches preserve the first reader's lazy PDF dependencies; cleanup waits for confirmed frontend closure.

## Verification

- Pinned `pnpm test:changed --plan` selected full/native scope, 196 files; `pnpm test:changed` passed 1,618 tests with zero failures/skips. Focused scenic/shared checks passed 62/62 and development/browser checks 12/12; `pnpm typecheck`, `pnpm lint` and `git diff --check` passed.
- Native source checks passed 24 tests and rustfmt. Initial parallel lock-race failure resolved in a complete serial rerun; one prepared-bundle contract was filtered because no package build was requested.
- The retained reader downloaded a readable six-page PDF through ordinary controls after restart/reload. All six pages passed independent visual review; panel 3 passed desktop and 390px phone zoom. Saved source/dialogue/images/model records/revision are unchanged. Desktop preview was checked without packaging.
- Independent AR and renewed CR passed; REQ/AP/E2E/user/development/CLI docs agree. Source commit and verified branch publication are the remaining delivery step.

## Notes

- This reuses saved scenery rather than generating outpainted artwork. Unsafe/unknown/baked or crowded scenes keep conservative lettering bands; frame 8 and the final dense scene demonstrate that protection. No personal-story generation, migration or saved-image mutation occurred.
- Vite-forced SIGTERM can leave only that launch's disposable owned cache. Normal Ctrl+C confirms closure and cleans it; another launch's cache is never removed.
