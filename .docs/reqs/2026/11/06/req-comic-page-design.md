# Finished comic page design

## Problem

The first exported comic looks like separate illustrated slides. Speech balloons are oversized rectangles with long, visibly detached tails, ordinary interface typography and stark white fills. Speaker labels repeat inside every balloon. A finished comic needs cohesive page composition, natural speech shapes and readable lettering, as illustrated by the user's references.

## Requirement

Automatically produce proper multi-panel comic pages in the reader and exports. Fit connected oval speech balloons and cloud thoughts tightly to their words, use comic lettering and artwork-compatible colours, and omit speaker names from visible balloons. Give important or text-heavy scenes more space, including wide, tall and full-page panels. Keep creating comics automatic; existing complete stories should receive the improved presentation without redrawing their illustrations.

## Acceptance Criteria

- [x] AC1: Speech has a compact oval body and attached short curved/pointed tail with no gap or seam; thoughts have a compact cloud and small-circle trail. Visible balloons contain dialogue only, without repeated speaker names. Source attribution and accessible transcripts retain speakers.
- [x] AC2: Reader, PDF, PNG, ZIP raster frames and offline preview use a bundled licensed comic font, consistent text fitting, shapes and high-contrast artwork-toned fills. No runtime external-font service is required.
- [x] AC3: Normal multi-frame stories compose several ordered panels per comic page, with clear gutters/borders and automatic larger spans for key or dense scenes. Every frame appears exactly once and in order; captions/dialogue remain complete and readable. A justified splash can occupy one page.
- [x] AC4: Newly generated storyboards express source-grounded panel emphasis and preserve it through repairs, revisions and exports. Existing stories get deterministic layout immediately without new AI calls, changing source facts or losing saved artwork.
- [x] AC5: Reader arrows navigate comic pages; saved progress and production API indices continue identifying original frames. Scene selection opens the containing comic page. Phone users can zoom/pan and read an accessible transcript. Missing images remain visibly incomplete.
- [x] AC6: PDF, page PNG/overview and offline HTML share the same page plan. ZIP keeps compatible numbered frame WebPs, source/credit/signature/hash/XMP rules and adds layout metadata without re-encoding ZIP-input images. Embedded raster balloons are never painted twice.
- [x] AC7: Automatic fitting promotes dense panels rather than shrinking text indefinitely, clipping or dropping dialogue. Impossible content fails clearly with its panel number. Whole illustrations remain intact and artwork-toned margins handle differing aspect ratios.
- [x] AC8: Production-path tests, desktop/phone browser inspection and rendered PDF inspection verify the result. Commit and push the completed changes to the user's existing feature branch.

## Constraints

Keep the app English, use pinned pnpm/Node, preserve canonical storage/source/revision contracts and the user's live library. Verification uses isolated fixtures; any private preview of the user's already-generated story uses read-only app APIs and the production exporter, without new inference. No library migration or desktop package is needed. Preserve original speaker metadata, frame order, source evidence and narration. Use freely distributable font assets with their licence. Explicitly retain automatic placement: optional editing is not a prerequisite.

## Non-Goals

Copying the reference comic's characters/art, changing providers or paid image size contracts, facial detection, new story import, regenerating an existing story automatically, merging into main, new feature flags or unrelated refactors.
