# Illustrated balloon backgrounds and PDF cache ownership

## Goal

Remove the reported plain lettering band through safe illustrated scenery continuation and restore actual PDF download without changing the story or subject proportions.

## Current Context

`comic-page-layout.ts` deliberately moves dense dialogue into an opaque band; SVG/canvas both paint it plain. The actual 1122×1402 frame has forest/sky above its heads. Joint protected overlay probes at 22, 21 and 20px fail, so changing font size alone is insufficient. A bounded background crop may enlarge canopy details and needs real visual acceptance. `scripts/dev.mjs` uses the checkout's shared default Vite cache. An isolated second forced optimizer on an occupied port reproduces missing dependency files and a first-instance lazy PDF HTTP 504. `reader-pdf.ts` already uses the correct production exporter; replacing it or only eagerly importing pdf-lib would mask cache ownership.

## Decisions

- Continue the authorized RPD work from verification with this follow-up slug; reuse `feature/comic-composition-ack`. No new worktree, dependency, migration, flags, production environment variables or main merge.
- Freeze `scenicBackdrop?: {art: ComicRect; viewport: ComicRect; source: NormalizedRect}` on the shared panel presentation. `art` is the full source image under one positive uniform scale; `viewport` is the independently clipped empty space from the lettering top through the actual first original-image row, including a missing top subset or contained-art gap, and `source` records the normalized scenery crop used for geometric checks. The renderer uses the existing frame image; there is no new image asset or canonical story/schema field.
- Select only a full-width top source strip for validated, non-baked composition with at least one declared face/action region. Include every existing speaker halo in the exclusion set. For sampling only, extend each declared face exclusion upward by one full face-rectangle height to reserve hair/headroom; action regions and existing speaker halos keep their current bounds. Its height is `min(.20, min(face y-height, action y, halo y)-.04)`: apply the .04 guard exactly once, not once by expansion and again by subtraction. Require normalized height at least .08 and at least 64 source pixels. Verify no intersection with the sampling-only head envelopes, action regions and speaker halos plus the single guard; reject degenerate/out-of-bounds geometry. Use isotropic cover, cap absolute source upscaling at 1 and scale relative to the unchanged foreground at 3.25. No top strip is assumed safe in unknown legacy art.
- Preserve the current foreground fitting transform, placement, protected-area result and layout scoring. After lettering placement, an original image that already covers the full band width may reveal only its existing unprotected upper pixels by extending its final `artViewport` upward. Any positive missing gap through the true first original-image row receives `scenicBackdrop` (plus a one-pixel underlap), even if contained artwork starts below the band bottom; when original art already safely covers the whole band, clear `letteringBand` instead of creating a degenerate backdrop. If original art does not cover full band width, fill the complete band with a valid backdrop or retain conservative prior rendering. The actual reported scene reveals about 85px at its exact existing scale and fills only the remaining roughly 135px. Its final head-protected .13 strip gives about 2.96 times the foreground scale, within the 3.25 cap; all six actual PDF pages and phone zoom passed visual review.
- Paint scenery and unchanged subject art with independent clipping, then captions/balloons; suppress the opaque band only where scenery or safe revealed original pixels cover it. Balloon protection stays tied to the original foreground bounds, not the enlarged scenery viewport. Never tile, mirror, blur, distort scale or duplicate declared subjects. This is conservative planned geometry, not semantic background or pixel recognition; actual visual QA remains the hard gate.
- Keep sampling and placement finite, reject degenerate strips and invalid geometry, and clone/cache the new presentation fields. Use the same transforms in SVG, canvas and all production exports. Improve generation direction to describe illustrated environmental headroom with dialogue, without a blank placeholder or a new generation operation.
- Visual quality is a hard gate: inspect the actual reported frame at reading size and zoom. If enlargement/seam looks artificial, stop this implementation path and refine this plan for a persisted production image-edit workflow; do not claim seamless outpainting or ship a bad substitute.
- Freeze `createDevelopmentCache(root=process.cwd()): Promise<{directory: string; remove(): Promise<void>}>` in `scripts/development-server.mjs`. Use `mkdtemp` under the checkout's `node_modules/.cache` with an owned `shiqu-dev-` prefix; cleanup closes over the exact allocated path and is idempotent. Never remove the cache parent, a shared `.vite` directory or another allocation.
- Pass that directory explicitly to the actual dev frontend. On normal Ctrl+C (SIGINT) stop and occupied-port/server-creation failure, await frontend close before its cache removal; an absent frontend may release its unused cache immediately. Build disposal and exit status must still settle when another cleanup step rejects. If frontend close cannot be confirmed, preserve its potentially active cache and report the cleanup error rather than delete it while in use. Track asynchronous cache/frontend/listen acquisition and stop before starting any later resource or backend. Vite 8 separately handles SIGTERM by closing and forcing process exit (143); if it preempts confirmed cleanup, retain only this launch's owned cache rather than overriding private framework signal hooks. A forced exit may leave disposable owned cache files; it must never remove another cache or open a late backend/library. Retain the current public-path validation/frontend-bind-before-backend/library ordering and test that the failed second launch starts no second backend/library.
- Root owns docs/manifest/verification/publication; scenery owner owns shared layout/SVG and scenery tests plus prompt direction; PDF owner owns dev cache helper/launcher and cache/download tests. Freeze exact presentation fields before parallel edits. Independent AR must pass before source edits.

## Phased Tasks

### Phase 1 - Diagnosis and architecture gate

- [x] Inspect the actual raw panel, protected geometry, lettering solver and shared rendering paths; confirm font-size changes alone do not fit the two balloons.
- [x] Reproduce the missing Vite dependency and failed concurrent-start cache collision without accessing a personal library.
- [x] Independently review REQ/AP/E2E together, freeze backdrop/cache interfaces and pass AR before SS.

### Phase 2 - Safe scenic presentation

- [x] Add a bounded background source selection and optional shared backdrop geometry in `lib/comic-page-layout.ts`, excluding expanded protected areas/targets and preserving the original subject art transform.
- [x] Add independently clipped scenery painting to canvas and `client/ui/StoryComicPage.tsx`; retain safe handling for unknown/baked/no-safe-background cases and malformed geometry.
- [x] Update immutable presentation copies/cache fingerprints and add production pixel/geometry/SVG/export regressions for subject preservation, uniform scale, short safe tails and zero inference.
- [x] Clarify fresh image direction so environmental scenery continues behind planned dialogue, while retaining source culture and image-input identity rules.
- [x] Render the actual panel through production painting and inspect scenery scale/seams and foreground integrity at desktop/zoom; refine AP before any broader image-edit alternative if it fails.

### Phase 3 - Isolated development cache

- [x] Add a unique owned-cache helper in `scripts/development-server.mjs` and use it in `scripts/dev.mjs` before Vite creation; remove its cache only after confirmed frontend closure, preserving the owned cache on unconfirmed closure or Vite-forced SIGTERM.
- [x] Keep public-path/frontend-bind ordering and ensure an occupied-port second launch never opens a backend/library or removes another server's cache.
- [x] Extend `tests/development-cache.test.mjs` to reproduce lazy PDF behavior with owned concurrent caches and actual PDF browser download after second-start failure; cover cleanup and independent versioned modules.

### Phase 4 - Verification and live repair

- [x] Register direct source coverage/new tests in `tests/manifest.json`; run focused production and browser regressions, typecheck, full lint and diff checks.
- [x] Run `pnpm test:changed --plan` and its selected/full suite, honoring native fallback and source-only native/rustfmt checks without packaging.
- [x] Independently CR the final diff and fix blockers, then rerun relevant verification and review.
- [x] Restart only the existing completed local dev service using the fixed launcher, reload the existing IAB tab, and download/inspect its actual PDF; verify the reported panel and export agree without AI calls.
- [x] Use `pnpm desktop:preview` for required desktop UI checking; inspect final PDF pages with the PDF skill/Poppler and actual reader on desktop/390px zoom. Keep all private artifacts ignored.

### Phase 5 - Completion

- [x] Reconcile user/CLI documentation with illustrated scenic bands and cache ownership; complete a five-point acceptance matrix and concise DD.
- [ ] Commit scoped changes, push the existing feature branch, verify exact remote head and leave the user's reader open with main preserved.

## Validation

Pinned Node24.22.1/pnpm11.25.0. Focused `pnpm exec node --experimental-strip-types --test` suites for shared composition/UI/export and development cache/browser PDF, followed by `pnpm typecheck`, `pnpm lint`, `git diff --check`, `pnpm test:changed --plan` and `pnpm test:changed`. Honor full/native selection. No paid provider calls for tests. Use synthetic protected coloured subject pixels and the privately copied actual artwork with the production compositor/export runtime. Browser tests must really click download, save a PDF, and parse its page count; a mocked export function or bare dependency HTTP200 alone is insufficient. The browser cache regression must import the actual production PDF exporter (or use the ordinary Reader download control); the live IAB check must use the ordinary Reader control.

## Rollback / Risk

No library migration or saved-image mutation is required. Revert this feature commit to restore prior presentation. Background reuse is limited by trustworthy staging and may magnify scenery; actual visual QA decides acceptability. Unknown/baked content remains conservative. Cache cleanup must be ownership-scoped and ordered after Vite close; mkdtemp avoids PID collisions/reused directories. Vite-forced SIGTERM or hard termination can retain a uniquely owned disposable cache; this does not invalidate another running reader. Restarting the currently broken cache requires one reload but preserves saved stories/settings. Do not delete a shared cache or another service's directory.

## Architecture review

AR fixed: exact backdrop/cache interfaces, one-time geometric guard, bounded sampling/scale, reveal-before-extension optimization, original placement/metric preservation, close-before-cleanup failure handling and actual production PDF download evidence were made explicit. The top strip is a conservative staging heuristic, not semantic pixel certification. The reported panel must pass real appearance review; an artificial seam/scale result fails AC1 and returns the work to planning. Independent rerun passed: no blocking architecture flaws. This review edited only REQ/AP/E2E documentation; no source, tests, configs or generated artifacts were changed and no tests were run.

Full actual-PDF QA caught a P1 missed by the original first-page visual gate: frame 8's planned face rectangle began below its hair, so the first canopy crop repeated silver hair in its backdrop. Sampling now excludes an additional face height above every declared face (including silent figures), before the one .04 guard. The reported frame 3 retains a .13 top strip within scale limits; unsafe frame 8 rejects sampling and preserves its original figure. Foreground geometry/balloons remain unchanged. The coloured-hair regression passed, and independent review inspected all six pages of the newly downloaded final PDF and passed the renewed visual gate. This remains conservative planned staging, not semantic pixel classification.

## Verification and acceptance matrix

| Criterion | Status | Concrete evidence |
| --- | --- | --- |
| AC1 | complete | Actual panel 3 and all six final downloaded PDF pages passed independent visual review. Its .13 canopy strip fills the previous blank band; original figures stay natural. Desktop and 390px-wide 100% zoom passed. |
| AC2 | complete | Shared SVG/canvas geometry and real PDF/PNG/ZIP production tests pass. Protected foreground pixels and signed public WebP bytes remain identical. Read-only API comparison confirmed all ten saved frames/images, source, dialogue, model records, revision and timestamp unchanged. |
| AC3 | complete | Ten scenic regressions cover single guard, head envelopes, min strip size, absolute/relative scale caps, partial/full/narrow original-art coverage, immutable copies, malformed/baked/unknown and unsafe geometry. Hair above frame 8's face box is not duplicated; unsafe frame 8 and the dense final scene retain conservative bands. |
| AC4 | complete | Twelve focused development/cache/browser checks pass, including real production PDF download after a competing optimizer failure, first versioned modules still HTTP 200, no second backend/library, immutable cache ownership and cleanup/signal failure cases. |
| AC5 | incomplete: publication only | Final full 196-file selection passes 1,618/1,618, zero failures/skips, 269.3s. Typecheck, full lint, diff check, native 24/24 with one prepared-bundle filter and rustfmt pass. Actual ordinary-control PDF download parsed six pages and all six rendered pages passed visual review. AR/renewed CR passed; scoped commit/push verification remains. |

Exact source commands: `pnpm test:changed --plan`, `pnpm test:changed`, `pnpm typecheck`, `pnpm lint`, `git diff --check`, with pinned Node24.22.1/pnpm11.25.0. The plan reported `full:true` and `native:true`; full source coverage was honored. Source-only native verification used Rust1.93.0 and `TAURI_CONFIG='{"bundle":{"resources":[]},"build":{"frontendDist":["../desktop/index.html"]}}' cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- --skip runtime::tests::desktop_uses_verified_bundle_and_ignores_saved_system_path --test-threads=1`, followed by `cargo fmt --manifest-path src-tauri/Cargo.toml --check`. The initial parallel native run hit the existing exclusive-directory-lock race; the complete serial rerun passed 24 tests. The one prepared-bundle contract was filtered because no packaging/build was authorized. No native source changed.

Desktop preview was checked with `pnpm desktop:preview` and stopped before the full suite. The repaired ordinary `pnpm dev` reader remains running at port3000. Private screenshots/renders/logs are ignored; no provider request, library migration, saved-image rewrite or desktop package build was performed. E2E and doc wording were reconciled after the hair regression; renewed CR and independent all-page visual gate passed.
