# Comic bubbles implementation plan

## Goal

Implement the complete comic balloon workflow described in [the requirement](../../../../reqs/2026/11/06/req-comic-bubbles.md), from source-grounded generation through editable revisions, reader display and production exports.

## Current Context

Branch `feature/comic-bubbles` starts at `7080e79` in `shiqu-fork`. Saved plans currently store caption/prompt only. Generation contracts, storyboard batches and repair schemas share page definitions; some repair/history projections whitelist fields. The reader uses a filmstrip and bottom narration. Revisions already have local drafts, CAS, idempotent requests and image reuse by illustration inputs. Exporters share a canvas runtime, with WebP encoding before watermark/hash/XMP validation. Public ZIP conversion must preserve the resulting bytes. There is no current desktop package requirement.

## Decisions

- Add optional `bubbles` to persisted page objects; missing means the legacy page has none. New generation JSON requires an array. Keep page schemas as extensible Zod objects.
- Canonical `ComicBubble`: `id`, `kind: speech|thought`, `speaker`, `text`, normalized `x,y,width,height,tailX,tailY`, optional `sourceQuote`. Maximum four, unique IDs, bounded finite coordinates and positive in-image bounds. Text maximum 220 characters; speaker maximum 80. Generated balloons require an exact quotation from saved English source; manual content is checked by the normal production review. Empty narration is valid.
- `lib/reader-bubbles.ts` owns types, schemas and source evidence; `lib/reader-revision.ts` owns editorial comparison. `lib/comic-bubble-layout.ts` owns deterministic wrapped lines and shape geometry shared by SVG and canvas. Use ordinary SVG text/path, not foreignObject or a second renderer.
- Keep mutable balloon coordinates/text out of image-generation inputs. Shared prompts request textless illustrations with usable space, while the storyboard model plans characters, composition and balloons together. This preserves artwork when users adjust balloons. Reject a separate vision/face detector pipeline.
- The mandatory default is a finished comic, with no placement step. A shared automatic placement function packs generated balloons in a reserved upper image area, using text length for size and preserving model-provided speaker tail targets. Position fitted rows near their speaker targets within the safe area, avoiding unnecessarily long needle-like tails. Validate non-overlap and in-image bounds after packing; production generation and repairs both call this function. Illustration prompts stage speakers below this reserved area and coordinate targets through the storyboard scene prompt. The optional editor is a correction tool, never a prerequisite.
- Automatic fitting uses the shared layout at a canonical 900×1350 portrait, with a minimum 26px font and explicit character breaks for overlong words. Search a bounded set of ordered non-overlapping upper-area row layouts (one through four balloons), then allow additional upper-area height within 60% of the image. Preserve text, evidence and speaker tail targets; keep tail connectors away from other balloon bodies. If no readable layout fits, reject the generated page with a specific density error through the existing bounded generation/repair retry path so the provider must shorten/rebalance the dialogue. Never silently drop text, shrink below the minimum or request user placement. Tests cover capacity exhaustion, four maximum-length balloons, long words, multiple thoughts and crossing/obstructed tail targets. Actual shared renderer must also reject unrenderable content rather than clip it.
- Treat geometry and IDs as layout; text, kind, speaker and reading order are editorial content. Layout-only revisions retain review and artwork. Editorial changes trigger existing review but do not independently invalidate artwork.
- Reader/editor use the image rectangle as their coordinate system, preserve full artwork and leave narration outside it for balloon pages. Reading array order determines accessible transcript order. Editor retains existing explicit save/discard/conflict semantics.
- Shared canvas painter composites balloons before production watermarking and hashes. Raster exports with balloons carry `bubbleRendering: embedded` metadata; ZIP conversion preserves existing WebPs and only serializes metadata. JSON/Markdown retain text and speakers. Legacy exports omit new optional fields.
- No DB migration, feature flag, provider switch, new environment variable, separate paid pipeline or unrelated refactor.

AR fixed: automatic fitting now has a minimum readable font, bounded capacity and retry/failure policy; independent rerun passed with no blocking architecture flaws. User clarified that placement must be automatic and the editor optional.

## Phased Tasks

### Phase 1 - Discovery and architecture gate

- [x] Inspect generation, schema, repair, revision, reader and export paths and record their preservation boundaries.
- [x] Create the REQ, AP and human-readable E2E spec with source-fidelity, legacy, persistence and export acceptance points.
- [x] Complete independent AR of all three docs and resolve blocking findings before editing source.

### Phase 2 - Shared contract and production generation

- [x] Add `lib/reader-bubbles.ts` and update `lib/content.ts`/`lib/reader-model.ts` with bounded optional persisted balloons and empty narration support.
- [x] Update generation JSON/instructions and storyboard/review/repair/history/structural-edit projections to retain attributed balloons and exact source evidence.
- [x] Reject invalid generated evidence and prevent invented thoughts or duplicate narration through the production generation/review contracts.
- [x] Automatically fit and pack new/repair balloons in production, preserve speaker targets and reading order, and stage illustration negative space so finished comics need no manual placement.
- [x] Add deterministic geometry/text layout and shared canvas painting in `lib/comic-bubble-layout.ts` for both client and exporters.

### Phase 3 - Revisions and usable UI

- [x] Update `lib/reader-revision.ts` to distinguish layout-only and editorial changes and provide clear balloon validation errors.
- [x] Verify existing revision server flow persists balloons, retains reviewed status without model calls for layout-only edits, preserves CAS and reuses images.
- [x] Add reader SVG layer and accessible ordered transcript; integrate filmstrip and narration layout without image cropping or faded balloon text.
- [x] Add editor controls for content/kind/speaker/order, add/remove, pointer drag/resize/tail, keyboard and numeric placement with local draft semantics.

### Phase 4 - Production exports and verification wiring

- [x] Integrate the shared painter into PNG/PDF/ZIP/offline HTML; retain balloon metadata, embedded rendering markers, attribution and reading order in public/internal serialization.
- [x] Add focused production generation, validation, revision, UI and export tests; register each new test and its actual direct imports in `tests/manifest.json`.
- [x] Add isolated Playwright scenarios for responsive reading, editor interaction and save/reload behavior, with artifact screenshots.
- [x] Run changed-test planning and its selected suite, typecheck/lint, applicable native checks and E2E; fix regressions without weakening source or export invariants.

### Phase 5 - Review, documentation and completion

- [x] Perform independent CR of generation/revisions, UI and exports; fix blocking defects and rerun relevant checks.
- [x] Update user/CLI documentation and `skills/shiqu/SKILL.md` if CLI output contracts change.
- [x] Record the VR acceptance matrix here, and completion evidence and limitations in `.docs/done/2026/11/06/comic-bubbles.md`; update REQ/AP/spec checkboxes truthfully.
- [x] Commit only this feature on `feature/comic-bubbles` with a conventional message after verification passes; leave main unchanged.

## Validation

Use `PATH=/Users/mohitagastya/.nvm/versions/node/v24.22.1/bin:$PATH` for pinned tooling. Inspect scripts first. Run `pnpm test:changed --plan` followed by `pnpm test:changed` and honor any full fallback/native checks. Run `pnpm typecheck` and `pnpm lint` (or exact repository script names if different). Run focused Node tests via the repository loader and new Playwright E2E through its documented command. Start UI with `pnpm desktop:preview`, reuse an in-app tab if available; if unavailable, record the tool limitation and use automated Chromium screenshots of the same Vite preview. Check desktop/mobile balloon bounds, speech/thought distinction, editor keyboard/pointer/numeric controls, explicit save and reload. Export tests must inspect raster pixels/geometry, PDF pages, ZIP WebPs and metadata, legacy archive shape and byte-preserving public conversion. All test databases/images/providers are isolated fixtures; no user library migration or billed model calls. Do not run desktop preparation/build/package commands.

## Review evidence

Independent AR passed after adding minimum font, bounded packing and density retry/failure behavior. CR passed after correcting the scene list for dialogue-only/silent panels. A subsequent review confirmed the intentional prompt-contract test updates (empty narration plus stricter required balloon evidence) and restored style-only redraw explanation. Production interfaces were unchanged by these final fixes. Final focused checks: 12/12 prompt/UI regressions, 11/11 browser/UI/English checks; final typecheck and lint passed. Source-only native CI checks passed 24 tests plus formatting; only the designated prepared-bundle test was filtered, using the CI resources override.

## VR acceptance matrix

VR passed: all acceptance points are complete in code, tests and documentation. Independent final CR passed, including the scene-list correction and LAN HTTP UUID fix.

| Criterion | Status | Concrete evidence |
| --- | --- | --- |
| AC1: Automatic source-grounded dialogue/thoughts | Complete | 11 production generation tests: exact evidence, automatic fitting, batches, repair/history/structure, connector collisions, long words, bounded density feedback and failure before artwork. Shared prompt contracts preserve source fidelity and optional separated narration across providers. |
| AC2: Responsive finished reader | Complete | Production browser test at 1280×1000 and 390×844, plus in-app browser inspection. Full image, distinct shapes, ordered transcript and narration outside artwork. Durable screenshots in `.docs/assets/comic-bubbles-{desktop,mobile}.png`. |
| AC3: Optional corrections | Complete | Five UI unit tests and production E2E exercise add/remove/reorder/content/type/speaker, numeric/keyboard/pointer/touch, validation and local draft close/reopen. Final E2E disables randomUUID to cover LAN HTTP. Scene navigation and repair history retain dialogue-only content. |
| AC4: Review/revision/image boundaries | Complete | Three revision tests verify semantic versus layout impact and production REST/SQLite/CAS/restart/idempotency/media preservation. Browser layout save invokes no paid review or drawing; previous versions remain intact. |
| AC5: Persistence and legacy | Complete | Additive optional saved JSON, no migration. Existing schema, generation, revision, copying and export regression suite passed. No read-time backfill. |
| AC6: Production exports | Complete | Eight focused export tests plus existing export regressions inspect PNG/PDF/ZIP/HTML raster pixels, JSON/Markdown attribution, embedded flags, signed WebP hash/XMP, public conversion byte equality, no double paint and silent panels. |
| AC7: Verification and documentation | Complete | Final full `pnpm test:changed`: 181 files, 1490 passed, zero failures/skips/cancellations; typecheck/lint; 24 native source tests and rustfmt; 11 final UI/browser/English checks and six final LAN/UI checks. README, user guide and CLI skill agree with implementation. |

Final full-suite receipt: `.data/test-plans/2026-11-06T17-53-27-866Z-4949c6a0/run.json` (exit 0, full batch of 181 files). Log `/tmp/shiqu-comic-bubbles-full-final.log`. The initial full run found two stale assertions (mandatory caption wording and style-only explanatory copy); both were resolved and the full suite rerun. Final LAN compatibility correction used the existing UUID helper and passed a subsequent six-test browser/UI run, typecheck, lint and independent CR. No paid models, personal library fixtures or desktop packaging were used.

Native reproduction uses isolated Rust 1.93.0 and the CI source-only override: `TAURI_CONFIG='{"bundle":{"resources":[]},"build":{"frontendDist":["../desktop/index.html"]}}' cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- --skip runtime::tests::desktop_uses_verified_bundle_and_ignores_saved_system_path`; `cargo fmt --manifest-path src-tauri/Cargo.toml --check`. The designated prepared-bundle test remains in packaging CI; no desktop preparation was run.

## Rollback / Risk

Additive optional JSON avoids migration, but old code may drop fields if used to edit new revisions; document minimum app requirement for editing balloons. Shared schema changes can select the full test suite. Text metrics vary between browser and native fonts; share line breaks with conservative fitting and verify real renders. Full-image reader/PDF layout changes are scoped to balloon pages to preserve old stories. Never repaint WebPs in public ZIP-input conversion. No schema downgrade or user-library restoration is required to revert this branch; existing revisions and original artwork remain preserved.
