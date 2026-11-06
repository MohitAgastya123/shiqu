# Comic speech and thought bubbles

## Problem

The English app tells stories through artwork and bottom captions but cannot reliably present character dialogue or thoughts as editable comic balloons. Readers need a complete comic experience, including saved revisions and exports.

## Requirement

The user gives a story and receives a finished comic with source-grounded speech and thought balloons automatically placed where they make sense. Show speech with a pointed tail and thoughts with a cloud and circular trail. Keep narration separate. No manual positioning, approval or extra step is required. Optional revision controls can adjust the result and save a version with the same balloons in reading and exports.

## Acceptance Criteria

- [x] AC1: Newly generated storyboard pages automatically contain appropriate attributed English speech and thought balloons, supported by the saved English source. Thoughts require explicit source evidence. Narration does not repeat balloon dialogue, and may be empty. The finished production comic needs no manual placement: initial balloons are fitted in bounds, avoid each other, follow reading order and aim at the planned speaker location, with illustration composition leaving space for them.
- [x] AC2: Reader pages show legible speech and thought shapes aligned to the full artwork at desktop and mobile sizes, without clipping balloons or hiding them behind narration. Reading order and accessible text are available.
- [x] AC3: Optional revision controls support adding, removing and reordering balloons; editing text, speaker and kind; and moving, resizing and aiming tails. Pointer, touch, keyboard and numeric controls provide usable alternatives. Invalid geometry and excessive content show clear errors. The ordinary story-to-comic flow never requires opening these controls.
- [x] AC4: Draft edits stay local until explicitly saved. Saving uses existing conflict protection and preserves prior revisions. Layout-only changes reuse artwork and the existing review without paid model calls. Content changes undergo the production review and reuse artwork unless illustration inputs change.
- [x] AC5: Saved pages and revisions preserve balloon fields. Existing stories without balloons remain readable and editable without automatic paid backfill or a library migration.
- [x] AC6: PNG, PDF, ZIP and offline HTML exports visibly include balloons. Exported JSON and storyboard text retain attribution and reading order. Public ZIP conversion preserves image bytes, watermarks, hashes and XMP metadata and cannot render balloons twice.
- [x] AC7: Production-path tests cover generation, evidence, validation, revision reuse, legacy stories, editor and responsive reader behavior, and export rendering/serialization. Documentation explains using balloons and their limits.

## Constraints

- Work on a new branch in the fork. Preserve the English interface and production source-fidelity rules.
- Keep canonical story storage, reader APIs and existing optimistic concurrency stable. Use isolated verification data and no live paid generation.
- Use the shared production workflow and exporters; preserve the established public ZIP filenames and watermark/hash pipeline.
- Maximum four balloons per page; keep text concise enough for readable comic panels. Reject out-of-bounds geometry rather than silently losing content.
- Preserve the entire image for pages with balloons. Automatic placement uses planned speaker locations and illustration composition; do not claim pixel-level face detection.
- Follow pinned pnpm/Node tooling. Verify UI in desktop preview; do not package the desktop app.

## Non-Goals

Online book import, automated facial detection, changing story selection or page-count policies, paid backfill of old stories, new providers, feature flags, new configuration variables, desktop installers, and publishing or merging this feature into main.
