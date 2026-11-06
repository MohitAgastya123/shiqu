# Comic page design plan

## Goal

Turn the current slide-like comic presentation into automatically composed comic pages with connected compact balloons, comic lettering and cohesive colours, then push the verified feature branch.

## Current Context

`feature/comic-bubbles` is clean at `6979e65`. Current balloon geometry uses a rounded rectangle plus a separate stroked triangle and includes speaker labels in fitted text. Saved balloon coordinates are normalized to artwork; all image providers currently draw portrait art. PDF is frame-per-page; PNG is an overview. Reader navigation/progress currently identify source frames. Production exporters share a canvas runtime and ZIP conversion preserves signed WebPs. The user supplied visual references and explicitly requested removing visible speaker labels.

## Decisions

- Keep `Story.pages` as ordered source frames. Add optional frame `panel: normal|wide|large|splash`; new generation requests it and uses semantic scene emphasis, while legacy stories use deterministic text-density/beat defaults. `normal` occupies one cell, `wide` two horizontal cells, `large` two vertical cells and `splash` a whole 2×2 page. Default to four normal panels per page, using ordered mixed templates for two/three panels and justified splashes. Do not invent extra story frames.
- `lib/comic-page-layout.ts` owns one deterministic logical-page plan and source-frame mappings. A shared panel presentation function exposes page/panel/art/narration geometry and presentation balloons to both SVG and canvas. Fit captions and dialogue at final canonical 900×1350 page size and density-promote a panel when necessary; do not scale source balloons into unreadable thumbnails. A full page that cannot fit fails explicitly rather than losing text.
- The minimum reflowed dialogue and caption font is **24 units on the finished 900×1350 sheet**, excluding small publication credits. Attempt the requested/default span, then the two-cell wide/large candidates, then a four-cell splash; the search is finite. Preserve top-to-bottom/left-to-right visual reading order with ordered templates and never backfill a later frame above a previous one. A splash that still cannot fit raises a panel-numbered density error without clipping or dropping text.
- Already-embedded raster balloons cannot reflow. Bare legacy `bubbleRendering` does not identify its original font and is opaque: conservatively assign it a full-page panel, without claiming to improve baked typography or repainting it. New full-panel `comicRendering` records dimensions and lettering size; validate actual artwork dimensions and promote until its effective lettering meets the floor. If known lettering remains below the floor at full page, report the panel as unrenderable. Public ZIP-input conversion retains bytes.
- Freeze the shared contract as `layoutComicPages(frames)` returning ordered source-frame-index panel rectangles and `layoutComicPanel(frame, panelRect, imageSize)` returning the exact artwork/narration/presentation-balloon geometry and fitted lines. SVG and canvas consume these same outputs. Page dimensions and canonical source-frame mappings remain explicit.
- Preserve full existing portrait illustrations with contain transforms. Use sampled artwork-tone matte/paper for aspect-ratio differences; never stretch or crop away faces/actions. Larger span choices change presentation only, not the image provider or paid image-size contract. New illustration composition stops reserving a blanket upper 60% and instead leaves modest local space near speakers.
- Redesign shared `comic-bubble-layout.ts` as true ellipse speech with an integrated curved tail in a single closed path, bounded short tail geometry, compact thought clouds and content-sized lettering. Fit actual dialogue only. Use planned speaker targets transformed through the same artwork rectangle; saved body positions are soft preferences when responsive panel composition reflows them. The single-frame optional preview still uses the same renderer and validators.
- Bundle unmodified Comic Neue Bold TTF and its OFL, load it explicitly for browser/canvas/native/offline export, and use uppercase comic lettering for visible dialogue. Retain original prose/speakers in saved JSON/transcripts. Use shared glyph/line metrics to avoid distorted text scaling.
- Sample original image pixels before overlays to derive light artwork-toned page/bubble fills and dark ink with strong contrast. Use the same deterministic sampling and palette rules in native and browser rendering. Do not make remote font requests or mutate saved image bytes.
- Root owns data/generation/revision contracts, manifest/docs/verification/push. Balloon agent owns shared balloon geometry, palette/font assets and font readiness plus `reader-bubbles.ts` placement helpers. Page/export agent owns shared page plan/painter, PDF/PNG/offline HTML/ZIP layout serialization and export tests. UI agent owns grouped reader/optional editor/transcripts/zoom/navigation adapters and affected browser tests. Freeze shared APIs before parallel implementation.
- Reader stores canonical source-frame progress. Group arrows move between comic-page group starts; direct panel selection selects its containing group. Distinguish panels from comic pages in labels. Retain source-frame APIs, drawing/health callbacks and production demand. Provide explicit page zoom/pan plus ordered accessible narration/dialogue on phones; no manual balloon step.
- Keep numbered ZIP frame WebPs and their watermark/hash/XMP pipeline. For new exports each WebP encodes its complete shared panel presentation (contained artwork, matte, balloons and narration) before existing signature/metadata handling. Add optional `comicRendering:{width,height,minFontSize:number|null}` to identify a fully composed panel, separate from older balloon-only `bubbleRendering`; a reader uses it as a complete panel without drawing narration or balloons twice. Preserve the source caption/dialogue as metadata and derive the archived layout map from the raw story before rasterization. Actual display scaling must preserve a known recorded story-text minimum. `minFontSize:null` explicitly means legacy baked lettering of unknown size; require a splash for this marker and never certify a 24-unit floor for it. A complete-panel marker still prevents repainting narration/balloons. Public ZIP-input conversion validates markers/maps and keeps WebPs byte for byte. This rendering marker is required artifact semantics, not a new feature flag. Reserve signature-safe space so watermarking does not cover narration. Older archives stay unchanged.
- Measured 80-frame/four-balloon stress exposed repeated synchronous fitting while image dimensions arrive. Reuse shared panel presentations through a bounded per-frame weak cache keyed by current content fingerprint, rectangle and actual dimensions. Cache successes/failures without exposing mutable cached results; in-place content edits and dimension changes invalidate the corresponding result. Verify output equality/mutation safety and rerun the real Reader stress scenario. This changes computation reuse only, with no parallel renderer or generation path.
- No DB migration, feature flag, new production environment variable, provider change, external publication other than the explicitly requested branch push, or merge to main.

AR fixed: final-sheet minimum font, bounded promotion, exact shared geometry and embedded-raster rules added; independent rerun passed with no blocking architecture flaws before source edits. Targeted AR during CR passed for the nullable rendering marker (unknown legacy lettering retains conservative splash placement) and bounded shared geometry reuse after a measured Reader stress stall. Independent CR passed after navigation, marker validation and cache fixes.

## Phased Tasks

### Phase 1 - Scope and architecture

- [x] Inspect current balloon geometry, fitting, PDF/PNG/page navigation and image-size contracts against the references.
- [x] Record the no-visible-speaker requirement, automatic page spans, full-art containment, font licence and density/phone constraints.
- [x] Review this REQ/AP and E2E spec independently; resolve blockers and explicitly pass AR before source edits.

### Phase 2 - Shared contracts and rendering foundation

- [x] Add optional `panel` metadata to saved/generated frames and preserve it through production planning, repair, history, revision and export projections.
- [x] Implement shared deterministic page plans, frame/group mapping and density promotion with stable reading order and explicit overflow errors.
- [x] Replace separate rectangle/triangle geometry with connected oval speech and compact thought rendering; remove speaker text from visible fitting.
- [x] Bundle Comic Neue Bold/OFL, implement browser/native/offline font readiness and deterministic readable text metrics.
- [x] Implement shared adaptive palette sampling and artwork transform/presentation geometry for SVG and canvas.

### Phase 3 - Production integration

- [x] Update production instructions to plan panel emphasis and local speaker space without forced empty upper-page bands; maintain source fidelity.
- [x] Integrate shared page/panel painting into PDF, PNG and offline HTML, keeping all narration and credits.
- [x] Preserve ZIP frame encoding/signatures and add validated layout metadata through internal/public serializers and byte-preserving conversion.
- [x] Adapt reader filmstrip/navigation/progress, panel selection, accessible transcripts and phone page zoom to the shared logical pages.
- [x] Update optional balloon editing/preview to the same typography/palette/shape rules, without adding a required workflow step.

### Phase 4 - Verification and review

- [x] Add shared geometry, compact fitting, short-tail, no-visible-speaker, palette contrast, font/offline and density tests.
- [x] Verify bounded panel-fit reuse against in-place content/dimension edits and assess the real 80-frame/four-balloon Reader after the measured startup stall.
- [x] Add page-plan order/coverage/span/overflow tests and production PDF/PNG/ZIP/HTML pixel/metadata regressions; register actual direct imports in the test manifest.
- [x] Adapt affected reader/E2E assertions to intentional panel-versus-page behavior and verify desktop/mobile zoom, source selection and revision persistence.
- [x] Run focused checks, `pnpm test:changed --plan`, its selected `pnpm test:changed` suite, typecheck/lint and any selected native checks; fix blocking failures.
- [x] Generate a PDF through the production exporter, render it to PNG, inspect actual multi-panel pages and correct visual defects. Use the PDF skill operation marker before first authored verification PDF.
- [x] Inspect the desktop Vite preview in the in-app browser and perform independent CR of rendering, exports, data and UI.

### Phase 5 - Completion and push

- [x] Update README, user guide, CLI skill, existing bubble docs and the E2E spec to match comic pages and export contracts.
- [ ] Complete the VR acceptance matrix and concise completion doc with actual evidence, limitations and any pre-existing failures.
- [ ] Commit only this feature, push `feature/comic-bubbles` to origin and verify its remote head matches; leave main unchanged.

## Validation

Use pinned Node24.22.1/pnpm11.25.0. Run focused tests with `SHIQU_TEST_TIER=full node --experimental-strip-types --test <changed test files>`, `pnpm typecheck`, `pnpm lint`, `pnpm test:changed --plan`, then `pnpm test:changed` and honor full/native fallback. Native uses the existing CI source-only TAURI_CONFIG override, Rust1.93.0, `cargo test --locked --lib` filtering only the designated prepared-bundle test, and rustfmt. No desktop preparation/build/package.

Use `pnpm desktop:preview` and the in-app browser, plus isolated Playwright desktop/390px phone cases. Test one to eighty frames, normal/wide/large/splash combinations, dense 500-character narration, long dialogue/words, missing frames, malformed hints, old stories and embedded images. Verify every source frame once, stable order/progress, all text retained, no double paint, palette contrast and offline font. Generate actual production PDF/PNG examples and inspect rendered pages with Poppler or the bundled PDF renderer; do not infer visual quality solely from assertions. Read-only preview of the existing completed user story is allowed, without modifying or regenerating it. Verify branch push with `git ls-remote` after commit.

## Rollback / Risk

The change is presentation plus optional JSON hints, so no library migration is needed. Old editors may drop unknown metadata; document the version requirement. Portrait art in wide panels can leave matte space: preserve it with cohesive colour instead of hiding source actions. Multi-panel phone text requires zoom; whole-page thumbnails must not be claimed to provide full-size reading. Dense text can require splash pages; impossible density must fail clearly. Keep per-frame ZIP assets stable and separate them from logical page layout. Font files must ship with licence and work offline. Review/new tests may reveal legacy assertions tied to single-frame pages; update only expectations intentionally changed by this requirement.


## Verification evidence and acceptance matrix

Independent CR passed after fixing stale image-metadata navigation subscriptions, unknown baked-font provenance, canonical splash-map validation and repeated fitting. Targeted AR passed before both material corrections. The maximum-density 80-frame browser probe improved worst heartbeat delay from 2.31s to 367ms and longest task from 1.19s to 340ms; arrow response improved from 309ms to 156ms. The identical probe used the real Reader and isolated production fixture without inference.

| Criterion | Status | Evidence |
| --- | --- | --- |
| AC1 | complete | `comic-bubble-design`, generation and UI tests; connected closed paths, cloud trail, dialogue-only fitting and speaker transcripts; rendered PDF and IAB inspection. |
| AC2 | complete | Bundled OFL Comic Neue, verified native SHA and explicit browser FontFace loading; shared palette/font tests and export pixels; offline preview is self-contained raster sheets. |
| AC3 | complete | Page-layout coverage/order tests for 1–80 frames; normal/wide/large/splash production PDF sheets inspected. |
| AC4 | complete | `comic-panel-contract` production fixture verifies generation, repair/history and panel-only revision persistence without review or redraw. |
| AC5 | complete | Actual dimension-regroup keyboard/wheel regression, canonical jump/reload E2E, phone zoom/pan/initial position/transcripts and visible incomplete-panel unit checks. |
| AC6 | complete | Production PDF/PNG/ZIP/HTML tests; full-panel marker and unknown legacy provenance; canonical-map/dimension validation, signed XMP/hash checks and public ZIP byte equality. |
| AC7 | complete | Final-sheet 24-unit minimum, finite promotion and numbered density errors; full-art containment tests; explicit PNG size limits; cached result/edit/mutation regressions. |
| AC8 | incomplete | Focused checks, desktop/phone IAB, all six production-PDF renders and independent CR passed. Final full selected suite passed 1,514/1,514; Git commit/push remain to be recorded. |

Visual verification: `pnpm desktop:preview` at 1420, isolated reader, IAB desktop and 390×844 phone, zoom and speaker-preserving transcript. PDF `/tmp/shiqu-comic-page-design.pdf` was generated through the production exporter and all six Poppler renders inspected: four mixed comic sheets plus two complete English ending/credit/source-note sheets. Test artwork is synthetic and does not claim paid-provider visual fidelity. [Desktop preview](../../../../assets/comic-pages-desktop.png) · [Phone preview](../../../../assets/comic-pages-phone.png).

The first full regression run found five failures: one controlled image-route setup and four assertions tied to the intentional frame/page presentation changes (media preflight count, PDF page grouping, script labels and editor labels). Those expectations were updated without removing source/hash/byte/progress assertions; focused reruns passed. The final selected suite passed **1,514/1,514**, with zero failures, skips or cancellations across **186 JS test files**. Receipt: `.data/test-plans/2026-11-06T20-38-32-197Z-ece76ee9/run.json`. `pnpm typecheck`, `pnpm lint` and `git diff --check` passed. Selected native source-only CI checks passed **24 tests** plus rustfmt; only the designated prepared-bundle test was filtered with the CI resource override. The complete Comic Neue copyright/OFL text is included in root `NOTICE`, already shipped by desktop and npm packaging; no desktop package was built.
