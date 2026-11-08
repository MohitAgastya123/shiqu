# Filled comic panels and ACK comics

## Problem

The generated comic looks like small portrait illustrations placed inside oversized boxes. Large empty mattes, excessive bottom padding and oversized balloons weaken the page composition. Automatic balloons can hide faces and decisive action. The user supplied Marvel and Amar Chitra Katha page references and wants finished comics rather than manual layout work.

## Requirement

Compose tightly arranged comic pages whose artwork fills the panel viewport, with varied scene-appropriate spans, compact narration strips and proportionate English comic lettering. Automatically place speech/thought balloons in clear areas, keeping faces and important scene content visible. Add a selectable art style named **ACK comics**, inspired by classic Indian adventure-comic ink drawing, flat colours and warm printed-paper character. Use the same production composition in the reader and exports. Commit and push the verified result to the user's fork.

## Acceptance Criteria

- [x] AC1: Raw-art panels have edge-to-edge artwork within their viewport, narrow gutters/margins and compact narration/credit space. The portrait-in-wide-box regression visibly improves. No image is stretched; scene-important content is retained through bounded protected-aware cropping or an alternate aspect-aware panel arrangement. Historical art with unknown subject geometry stays uncropped; an occasional last-resort safe contain result is preferable to losing content, but the reported story must materially improve rather than fall back to oversized single-image pages throughout.
- [x] AC2: Speech and thought balloons fit their actual text at a consistent comfortable comic-lettering size, with compact oval/cloud bodies and bounded attached tails. Automatic placement preserves reading order and avoids protected faces/actions, including non-speaking characters. If a safe overlay cannot fit, automatic text-band placement or finite panel promotion preserves both scene and text; no manual balloon positioning is required.
- [x] AC3: Production storyboards supply validated composition geometry and suitable image canvas intent, and providers receive matching aspect/size/staging directions. Caption/dialogue/source evidence, frame identities and every frame's original order remain intact through planning, repair, revisions, series and export.
- [x] AC4: Existing saved raw-art comics improve immediately without paid inference or changing saved images. New image inputs participate correctly in explicit revision reuse/paid-job identity, while presentation-only edits continue to reuse eligible artwork. Already baked comic archives remain readable without cropping lettering or painting it twice; public ZIP conversion preserves signed WebP bytes and metadata.
- [x] AC5: **ACK comics** is available in the ordinary creation/import/revision style picker and all current selection/recommendation/provider contracts. Its prompt produces the intended expressive ink, rich flat colours, restrained shading and detailed classic-comic atmosphere while retaining source culture, era, ages and clothing. Existing styles/defaults and frozen historical discovery contracts remain valid.
- [x] AC6: Reader, PDF, PNG, ZIP panels and offline preview consume the shared image transforms, narration and balloon geometry. Phone zoom/transcripts and canonical frame progress still work. Long titles/credits/signatures do not overlap panels or narration; no source text is dropped or silently clipped.
- [x] AC7: Production-path geometry, source/repair/revision, provider size/style, legacy archive, actual desktop/phone browser and rendered-export checks demonstrate the requested improvements, including the user-reported portrait layout and faces near speech targets. Required selected/full/native/typecheck/lint checks pass and independent reviews have no blockers.
- [x] AC8: Requirements, plan, E2E and user/CLI documentation match the finished behavior. The verified work is committed and pushed to a feature branch on origin, and its remote head is verified. Main is not merged as part of this request.

## Constraints

Keep the app English and preserve canonical stories, source evidence, production receipts, publication credit/signature/hash/XMP rules and the private library. Use pinned pnpm/Node and the production workflow rather than an alternate renderer or evaluation-only pipeline. Geometry is planned staging, not pixel-level face detection; avoid claiming otherwise. When reliable clear space is unavailable, choose conservative placement rather than obscuring content. No silent paid redraw of existing comics, no manual layout prerequisite, and no migration or desktop installer build is required. Verify with isolated fixtures and read-only use of the user's existing story; do not publish private library data or their screenshots to Git.

## Non-Goals

Copying reference characters or exact page artwork, relocating every story to ancient India, adding a new provider or paid vision stage, OCR/face-recognition dependencies, new feature flags/environment variables, an export-only functional pipeline, uploading personal stories, unrelated refactors, or merging main.
