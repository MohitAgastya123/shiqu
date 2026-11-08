# Comic composition and ACK comics E2E

- [x] Open the reported portrait-heavy story read-only. Reflow its existing raw images without inference; confirm image viewports are filled, mattes are removed where safe, and aspect changes retain faces, the kitten and decisive actions.
- [x] In isolated production fixtures, render a wide establishing scene plus two normal scenes, portrait-heavy frames and a large/splash beat. Check thin gutters, varied panel sizes, exact source order and matching browser/PDF/PNG geometry.
- [x] Place speech and thought balloons near multiple faces, including a silent character, and a central action object. Bodies/strokes/connectors must avoid protected areas and keep short logical tails. Verify short text produces compact bodies, with no speaker labels.
- [x] Provide no safe overlay space and a legacy frame without composition metadata. Verify automatic lettering bands/promotion keep the scene and all text visible; no drag/drop or manual placement is required.
- [x] Exercise dense narration/dialogue, unusual words and 80 frames. Verify readable bounded fitting, complete text, finite layout, responsive navigation and a frame-numbered impossible-density error.
- [x] Select **ACK comics** in ordinary and Word-import creation, save/reopen preferences and create through the production workflow with controlled inference. Verify canonical ID/label, exact source setting/ages, source review, panel/canvas staging and provider art/size requests without a pencil/portrait override.
- [x] Publish explicit panel-only and composition-staging revisions. Panel-only edits reuse eligible art/review; changed real image inputs correctly update redraw previews/anchor dependants without a read-triggered redraw.
- [x] Export actual production PDF, PNG, ZIP and offline preview. Inspect every page and maximum credits/signatures for overlap; compare transforms/balloons and retain source/part labels. Old baked lettering is not cropped/repainted; public conversion keeps signed WebP bytes/hashes/XMP unchanged.
- [x] Inspect desktop Vite preview/IAB and 390px phone zoom/transcripts. Read/select/navigate saved comics without starting paid work. Run independent CR/VR and required selected/full/native/typecheck/lint checks.
- [ ] Commit and push the feature to origin, verify its remote head and preserve main.

- [x] Repair a historical caption-only frame without composition metadata: retain its 9:16 canvas, eligible artwork and review; do not invent staging. Retain existing composition on unchanged scene prompts and replace/clear it when scene staging changes.
- [x] Verify a known legacy baked 24px minimum cannot be downscaled to 20–23px merely because new raw-art pages use a 20px floor. Unknown baked text remains splash-only and new 20px exports are validated against their own declared bound.
- [x] Verify initial pre-image balloon fitting does not reject a storyboard that can be safely rendered through the automatic final lettering band.

## Execution evidence

Production browser scenarios passed: mixed-canvas ACK creation/navigation/phone zoom (2), Word/PDF series including selected ACK draft reopening and durable production (4), and compact automatic balloons with actual mouse/touch revision controls (1). Root IAB inspected the Vite desktop preview, then the same isolated production reader at desktop and 390px. Geometry/pixel tests covered silent/speaking faces, action, protected legacy art, all 80 ordered frames and dense failure errors.

Six production PDF pages (three comic sheets plus notes) were rendered and inspected along with PNG, ZIP and offline output. The private reported ten-frame story was reviewed through shared production page painting; its lazy shelf snapshot omitted full source, so it was not misrepresented as a complete PDF export. Synthetic exports independently exercised the complete source/credit path. Public signed images remained byte-for-byte identical.

Independent architecture and final code reviews passed. Scoped tests and fixes are recorded in the plan. The complete source/native gates and publication result are recorded at final handoff.

- [x] Block image metadata, then reveal a regrouped page map and traverse every actual comic page before reflection. Confirm the ending and next series part remain reachable without skipping scenes or starting inference.

Final complete qualification: 195 source files / 1,602 tests passed with zero skipped; native 24 passed with the planned prepared-bundle filter, rustfmt/typecheck/full lint/diff passed. Independent final CR passed. The completed actual ACK comic was inspected across all four pages in IAB and left open at its beginning.
