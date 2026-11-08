# Illustrated balloon backgrounds and reliable PDF downloads

## Problem

The reported ACK panel puts two balloons on a plain light band above the picture. The reader wants illustrated scenery behind the balloons, with natural subject proportions. PDF download also fails because a versioned lazy pdf-lib dependency returns HTTP 504 after concurrent development optimizers invalidate a shared cache.

## Requirement

Continue the scene's illustrated background behind automatic lettering, retaining visible faces, key action, complete dialogue and original subject proportions. Fix development cache ownership so a failed second launch cannot break lazy PDF downloads in the existing reader. Deliver both through the same production reader/export workflows and update the existing feature branch under the authorized RPD follow-up.

## Acceptance Criteria

- [x] AC1: The reported panel 3 has natural illustrated forest/sky behind its balloons, without the visible blank band. Subjects are not stretched, mirrored, duplicated or obscured; background scale/seams pass actual visual review.
- [x] AC2: Shared reader, PDF, PNG, ZIP and offline output use the same scenery transform and foreground geometry. Saved images, source, dialogue/evidence, frame order and signed public archive rules remain intact; opening/exporting starts no inference.
- [x] AC3: Scenic reuse is bounded to the top scenery outside validated planned face/action regions and speaker halos, with explicit safety margins and scale limits. This is geometric staging, not pixel-level background recognition. Unknown/baked/no-safe-region frames retain conservative subject protection. Malformed metadata and dense text never cause sampling into declared protected regions or silent loss.
- [x] AC4: Every development launch owns its cache. A second optimizer/startup failure and cleanup leave the first server's versioned dependencies and actual browser PDF download working. Public-path validation/frontend binding still precede backend/library startup.
- [x] AC5: The running app downloads a readable, complete PDF through its ordinary controls after controlled restart/reload. Required selected/full/native/typecheck/lint checks and independent review pass. Reconciled docs and verified branch push complete delivery.

## Constraints

Use pinned pnpm/Node, shared production composition/exporters and isolated tests. Preserve the personal library; the current comic is complete, and a local service restart is allowed to repair its broken cache. No migration or desktop package build. The first approach reuses existing illustrated scenery with a uniform-scale crop; never misrepresent that as newly invented or seamless AI outpainting. If actual output looks artificial, refine the architecture before shipping.

## Non-Goals

Paid inference on read/export, CSS blur/gradient/solid fill presented as scenery, tiling/mirroring or subject duplication, a separate renderer, new provider/flags/environment variables, automatic personal-story regeneration, main merge, or unrelated refactors.
