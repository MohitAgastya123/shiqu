# Comic page design E2E

- [x] Open an existing complete story without generating anything. See multiple ordered panels per page, compact oval speech, connected short tails, cloud thoughts, comic lettering and artwork-toned fills. No visible speaker labels; accessible transcript retains them.
- [x] Generate a controlled storyboard with normal/wide/large/splash hints through the production workflow. Verify repairs/revisions retain hints, and frame order/source fidelity are unchanged.
- [x] Turn comic pages forward/back, jump to a panel through the scene list, reload saved progress and verify production APIs still identify original source frames. Check incomplete images remain visible placeholders rather than omitted panels.
- [x] At desktop and 390px phone sizes, read the page, use zoom/pan and accessible transcript, and open optional corrections. No required manual positioning step appears. Verify actual bundled font and themed colours.
- [x] Export the same story to PDF, PNG, ZIP and offline HTML. Render PDF pages and inspect typography, panel gutters, variable spans, complete captions/dialogue, connected tails and palette. Compare SVG/canvas geometry and source-frame coverage.
- [x] Verify old missing hints, all span types, long narration/dialogue, long tokens, overflow promotion and explicit impossible-content errors. Test one and eighty frames. No lost/duplicated/reordered frames or silently clipped text.
- [x] Assert a 24-unit final-sheet minimum for narration/dialogue across normal, two-cell and splash layouts. Include a new composed frame with recorded lettering too small at a proposed display scale; reject or promote it rather than repainting. Verify known impossible splash density yields a panel-numbered error and unknown embedded lettering remains a full-page preserved raster.
- [x] Convert a ZIP and verify signed WebP bytes and metadata are preserved. Embedded balloons do not render twice; offline preview loads comic lettering without network access.
- [x] Run production-focused tests, selected regression/native checks and independent review, then commit/push the feature branch and verify the remote commit.

Production/browser/export tests and independent review passed; full selected suite: 1,514 tests, zero skips/cancellations. Typecheck/lint/diff checks passed, native source-only checks: 24 tests and rustfmt. All six production-PDF renders were inspected; desktop Vite preview and IAB desktop/390px phone zoom/transcript checks passed. See the AP acceptance matrix and final completion document for evidence.
