---
name: shiqu
description: Use Shiqu's production data contracts and business rules to discover, create, edit, analyze, organize, preview, export, and maintain illustrated stories. Apply only when the user explicitly requests Shiqu work.
---

# Shiqu task contract

Choose actions from the user's objective and saved state. Write task-specific programs for filtering, grouping, comparison, reporting, or batch orchestration when helpful; simple requests can call the existing operations directly.

Use Shiqu's existing production entry points for all reads, mutations, inference, review, revision, media encoding, and exports. Never rewrite the state machine or modify SQLite/media files directly. The public entry is the CLI subcommands; there is no public SDK. Do not depend on npm cache paths or private internal modules. Direct commands do not need the HTTP service, desktop, or frontend. Running without a subcommand starts the browser service.

## Runtime and protocol

- Use Node 24. Source projects use `pnpm cli`; installed commands use `shiqu`; other environments can use `pnpm dlx @apprun/shiqu`. Honor user-selected entry points and version locks. Read `help --json` first to confirm appVersion, available operations, and current schemas.
- Use the same absolute library path for all operations. Explicit `--data-dir` wins over `SHIQU_DATA_DIR` and saved locations. Respect ownership locks; do not bypass a service using the library. Initial access initializes/upgrades through the production initializer without changing saved provider preferences.
- Launch subprocesses with executable and argument arrays. Pass JSON through `--input -` stdin or a private file. Never interpolate titles, paths, originals, or prompts into shell commands. Preserve the entry point and working directory; check stdout, stderr, exit status, and bounded timeouts. Serialize CLI calls against one library.
- Subcommands return one JSON envelope: success `{schemaVersion:1,ok:true,data:...}` or failure `{schemaVersion:1,ok:false,error:{code,message,details?}}`; logs go to stderr. `skill show` is Markdown unless `--json` is given. Preserve failure envelopes and do not confuse exit code 0 or `ok:true` with completed production.
- Commands are noninteractive. Handle conversation checkpoints yourself; do not send terminal keystrokes or wait for CLI prompts.
- Reuse the saved provider/model. Inspect current `config` help if setup is missing. Credentials enter only through existing environment, private files, or stdin, never argv, chat, reports, or logs. Never switch billing/provider implicitly.
- Text and drawing may use different saved services. Source translation, discovery, storyboard and review belong to the text service; only drawing uses the image service. Preserve this composition and each provider's own credentials.

## Data contracts

Use the current returned schema. Optional absent fields are unknown, not invented. Read objects and write inputs differ; never write back an entire snapshot.

| Object | Meaning |
| --- | --- |
| `selection` | `bookId`, `theme`, catalog `artStyle` ID, `narrativeDetail` (`brief\|balanced\|detailed`), `productionPrompt`, `acceptancePrompt`, and `length` (normally `auto`; 1–80 when fixed). `storyTitle` identifies the source story; `displayTitle` is independent and changed through rename. |
| `source` | Exact `{edition,sectionId,firstUnit,lastUnit,continuations?}` returned by catalog/candidates. Preserve the edition hash and ranges; never guess them from a title or summary. |
| `session` | Version UUID `id`, `selection`, `state`, `generationControl`, optional `intake`, `revision`, `superseded`, `faults`, and `story`. `state` and control are separate; `stage` is display prose, not a logic contract. |
| Progress | `generationProgress.phase/frameCount/storyboardFrames/reviewStatus`; `productionState` is `running\|queued\|paused`. A null story can still have partial storyboard progress. Unknown counts are not zero. |
| `intake` | `discovering\|choosing\|preparing\|confirming\|confirmed`, concurrency `generation`, saved candidate batches, zero-based `{batch,index}` selection, settings draft, and search state/error. |
| `story` | Title, pages, English `sourceText`, source attribution, publication metadata, and optional original record. Historical `pages` are source panels, not composed comic sheets. Frames contain `caption` (may be empty), `prompt`, `image`, optional ordered `bubbles`, and optional `panel` emphasis (`normal\|wide\|large\|splash`). An image URL is not proof of readable media. Shelf list deliberately omits full original/source text; read get/source when needed. |
| Revision | `stories current` resolves the family current version. `stories revisions` returns the token required by `{token,changes}`. Never infer current version from a timestamp or title. |
| Fault | `id`, message, page, stage, state, and retry permission. Recovery uses the current `faultId`. `run` returns `{reason,session}`; inspect both. |

New production is English, including source translations saved during preparation. Verified Chinese text and canonical IDs are internal evidence, not English reading content. Do not rewrite source hashes or substitute a free-form translation outside the production workflow. Reading/exporting does not start a paid translation. Existing content without English source must be explicitly prepared.

New production automatically selects source-supported dialogue and explicit thoughts, attributes them and places compact comic balloons with planned character staging. Visible balloons contain only dialogue, without speaker labels; preserve attribution in saved data and transcripts. Optional `bubbles` entries contain `id`, `kind` (`speech|thought`), `speaker`, `text`, normalized `x,y,width,height,tailX,tailY`, and optional `sourceQuote` evidence. Preserve array order and source evidence. At most four balloons per source panel, 220 characters per text and 80 per speaker; generated evidence must match saved English source. Do not invent unspoken motives. Existing panels without balloons need no automatic rewrite.

The shared presentation composes panels into comic sheets, normally four per sheet, with automatic larger spans and density promotion. New generated frames include `panel`; old saved plans may omit it. Panel hints alone are layout metadata and reuse review/artwork. Reader/server progress and image APIs retain original frame indices; never send a comic-sheet index as a frame index. Phone zoom/transcripts support full-size reading. Font assets are bundled, and artwork-toned palettes preserve strong contrast.

For optional balloon revisions, read `stories revisions ID` and submit the complete edited plan through `stories edit` with its token. Geometry/ID/panel-emphasis changes reuse review/artwork; text/kind/speaker/evidence/order changes require review and a subsequent explicit `run`. Artwork is reused unless illustration inputs change. Source evidence must be cleared/rechecked when editing dialogue. PDF/PNG/offline HTML share the page plan. New ZIP frame images embed complete panel presentation and carry `comicRendering:{width,height,minFontSize}` plus layout metadata (`minFontSize:null` preserves unknown legacy lettering as a splash); older `bubbleRendering: embedded` means balloon-only baking. Do not draw baked narration/balloons again or repaint WebPs during public ZIP conversion. Preserve source prose and attribution metadata independently of uppercase visible comic lettering.

## Uploaded stories and comic series

The browser's **Upload a story** accepts Word `.docx` and selectable-text PDF files, up to 10 MiB/500 PDF pages/2 million extracted characters. Extraction and automatic part planning are local and do not perform inference. One **Create all parts** action authorizes shared settings and sequential production, with up to 200 natural parts named `Title — Part N`; short stories stay one comic. Do not ask the reader to split sources or place balloons.

Canonical comics/revisions remain ordinary `stories` sessions. Optional `story.series` contains `{id,title,part,parts}` only for an owner-reserved part root or its revisions. An independent copy retains source evidence but is detached from series controls/reference/navigation. Imported `original` provenance binds the complete document hash and exact source span. Never replace it with a web lookup or expand it into other chapters. All required current-part evidence units must pass independent full review before illustration; prior-part continuity is context, not additional source evidence.

Series creation and parent controls use the browser flow; existing CLI `stories get`, revision, recovery and export commands still inspect or operate on actual child sessions subject to parent/source-order gates. Reading or opening a next-part link must not call resume, demand or paid inference. Parent pause blocks new claims, while already dispatched results may finish saving. Retry the failed current part through the normal fault-ID/request-ID recovery flow; keep completed earlier parts and do not skip ahead. Original upload bytes and extraction checkpoints are private library data included in verified backups. Legacy `.doc`, encrypted/scanned PDFs and OCR are unsupported; report the format/limit problem instead of truncating a source.

## Business rules

- Saved originals, candidates, summaries, storyboards, images, and review history are authoritative. Analysis and suggestions are not completed production results.
- Only explicit `run` advances inference and may incur usage. Inspecting, organizing, comparing, previewing, and exporting do not authorize generation. Honor requested candidate, source, plan, text-review, or pre-image checkpoints. Continue previously authorized stages without redundant confirmation.
- Persist a UUID and original input before operations supporting requestId. Replay uses that same requestId and original generation/token/faultId. New actions use new UUIDs. On CONFLICT, stop that item and reload; do not hide a conflict with a new request ID.
- Search/choose/confirm/setup carry the read `intake.generation`. Revisions and replacements return a new version ID; use it or resolve current. Old versions cannot continue production or supply complete current exports.
- Keep paused work paused. Inspect faults and paid saved results before recovery. Recovery needs authorization for the current fault. Review override requires explicit intent and must never be described as a passed review. After interruption/timeout, inspect saved state rather than looping reruns.
- Batch reports record target ID, request identity, result, and stop reason. Stop items requiring user decisions, conflicts, pause, or fault handling. Continue independent items only within scope; distinguish success, failure, skipped, and untouched items.

## Operations and stop conditions

| Objective | Production operation |
| --- | --- |
| Discover data | `books/themes/styles`, `books contents`; `stories list/get/current`; `source/prompts/review-history/revisions` |
| Create/select | `stories create` accepts selection or `{selection,intake:true}`; search saves discovery intent, choose saves candidate indexes, confirm saves production approval, setup saves other intake actions. These do not run inference. |
| Run | `run ID --until candidates\|prepared\|reviewed\|completed`; inspect the actual reason/session before continuing. `reviewed` stops after approval and before drawing. |
| Explain a stop | `choice` needs selection; `frame_count_required` is a legacy confirmation gate; `already_prepared/already_selected` means move to the next applicable stage; paused stays paused; blocked needs fault inspection; superseded needs current. Never spin on the same boundary. |
| Edit/control | `stories edit` uses token/changes; rename affects only display. pause/resume/stop control intent; retry/override target current faults. reselect/replace/cancel-reselection follow saved draft contracts. |
| Selected redraw | For a completed, passed story, `stories edit` accepts `{token,paused:true,changes:{redrawPages:[1,3]}}` with one-based frames. Do not mix this with other edits. Text, style, review and unselected images remain; only explicit `run` redraws. |
| Copy | `stories copy SOURCE_ID --from-data-dir SOURCE --data-dir TARGET` normally copies approved text/review as a paused independent story. `stories copy-images TARGET_ID` with input `{sourceId:"SOURCE_ID"}` adds images to that same copy. Do not copy old images with a changed style. |
| Preview/export | preview writes standalone offline HTML; export supports zip/pdf/png/json/md through shared production serialization, encoding, watermark, and metadata helpers. Never rebuild the artwork archive yourself. |
| Maintain | backup creates a private full snapshot; verify-backup verifies; restore writes only to a new explicit data-dir without changing defaults; diagnostics writes redacted metadata. |

## Production checkpoints

The skill chooses the next stage; the CLI executes an explicit action. Text and images are separately deliverable. Completing text is not implicit permission to draw.

- Use `run --until` boundaries as needed. At reviewed, preview the text and obtain required decisions before drawing. Do not run to completed merely to inspect text. Already authorized image generation can continue; unapproved recovery/override cannot.
- For a copy, first copy text without images and record source library/ID, target library/ID, original creation UUID and input. Verify text and review records, report that text is copied, and ask whether to copy existing images, including available/total counts. A prior explicit request to include images remains sufficient authorization.
- After image-copy approval, call `copy-images` for that same target with the same source. Do not alter the original creation request or copy text again. If no approval arrives, keep the text and wait.
- If the source has no images or the style changes, explain why images cannot be reused. New drawing requires the intended style/scope and proceeds through target recovery/run. Copying text/images does not re-review or call a model. Partial image-copy failure retains text and retries the same target/source input; stop on input conflict.
- With explicit draft-copy approval, use `stories copy --draft` and preserve complete saved source, storyboard and actual review state as a paused draft. Copy no images, do not mark review passed, and do not run review or drawing without the requested scope.
- For image-only redraw, save a paused revision from the current token and selected one-based frame list, then run only when drawing was authorized. Preserve every unselected saved image even when frame 1 changes. Record the new revision rather than mutating the original completed version.

## Acceptance and delivery

- Reports name the library, filters, and current revision. Count missing images from actual pages. Distinguish no storyboard, partial storyboard, and completed frames; unknown is not zero.
- Before declaring completion, reread current, inspect state/review/faults and every expected frame. ZIP/PDF/PNG must pass the existing exporter media checks. Preview and JSON/Markdown may deliver intermediate drafts with incomplete work clearly identified.
- Public ZIPs contain `故事.json`, `分镜.md`, `署名与转载.txt`, and numbered WebP files under `图片/`. Those filenames are a stable collection protocol. Keep saved English source, source attribution, author credit, and AI disclosures. Exclude internal prompts unless explicitly requested with `--include-prompts`.
- Use the user's author credit. If absent, ask or report it; use `--allow-unsigned` only after explicit choice. Never invent an author, skip missing images, or export an older revision instead.
- Put outputs outside private libraries and served asset directories. Ordinary export writes a new path without overwrite. Honor project-specific production export scripts and their canonical destination/replacement rules.
- Deliver actual paths and verified results, including incomplete items and reasons. Keep temporary programs/private inputs in temporary directories and clean them up; retain requested reports/artifacts. Export, organization, or backup does not authorize commits, pushes, or publication. Never place private backups in a public collection.

## Skill version checks

- On activation, run `skill check` through the selected entry. It discovers the nearest project or global installation; verify the returned path matches this skill. `not_installed` does not authorize installation. With multiple copies, specify the intended scope/root; do not update another copy. Checks cache for 24 hours; use `--refresh` only when requested. Offline/unsupported checks do not block the user's task or justify retry loops.
- Default behavior only reports updates. Enable/disable automatic updates with `skill check --auto-update on|off` only on explicit request.
- If no version lock exists and `autoUpdateReady` is true, execute the returned pinned updateCommand argument array in updateCwd. It rechecks preferences and never overwrites modified/unknown copies. An explicitly requested one-time update can also use that command.
- After success, reread the returned skill path and use `pnpm dlx @apprun/shiqu@<version> help --json` for that version. Otherwise preserve source/custom entry choices and compatibility checks. Failed updates retain the installation; never remove state to bypass protections.
- `skill update --scope project|global` copies the skill bundled with the running package; it does not discover/download the newest version. Missing installation records can be established only for identical content. Skill checks/updates do not mutate libraries or provider settings.
