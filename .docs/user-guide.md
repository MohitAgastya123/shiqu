# Shiqu User Guide

[Project overview](../README.md) · [Desktop guide](../desktop/README.md) · [Development](development.md)

## What Shiqu does

Shiqu turns stories from Chinese classics into English comics. Each frame contains an illustration, optional narration, and automatically placed speech or thought balloons where the source supports them. A complete story includes a title, summary, source attribution, character descriptions, and an ending reflection. New stories use English throughout discovery, preparation, storyboarding, review, revision, and export.

The 24 included books contain verified Chinese original texts. During explicitly requested preparation, the production workflow translates the selected passage and complete chapter context into English and saves the translation. The Chinese evidence stays internal for source verification and exact quotation checks. Reading or exporting does not silently start a paid translation. A saved story without an English translation must be prepared through production before its source can be read in English. Existing user-owned stories and images are not rewritten automatically.

## Choose an entry point

| Entry point | Use it for |
| --- | --- |
| Desktop app | Configure providers, start the service, inspect the queue, and open the browser reader |
| Browser service CLI | Start the same reader without installing the desktop app |
| Direct CLI commands | Create, inspect, run, edit, export, or maintain a library without an HTTP service |
| Codex skill | Delegate those CLI operations through natural-language instructions |

Desktop releases include Node for Apple Silicon macOS 13.5+ and Windows 10/11 x64. CLI use requires Node 24; source development pins Node 24.22.1 and pnpm 11.25.0. Linux, Intel Macs, and Windows ARM64 can use the CLI where their generation provider is supported.

## Choose a generation provider

| Provider | Requirements |
| --- | --- |
| Codex | macOS/Linux, separately installed Codex CLI signed in to a subscription account |
| OpenAI API | An API key and access to the selected text and image models; separate API billing |
| Gemini | A Gemini API key and access to the selected models; also supports webpage URL discovery |
| Read-only | No credentials; read and organize an existing library without AI generation |

Provider selection is explicit. Subscription mode does not fall back to API billing, and API providers do not borrow another provider's key. Text and image services can be configured separately. The text service handles discovery, English source translation, storyboards and review; an optional image service handles drawing. **Same as text** keeps them together. Claude Code and DeepSeek text-only adapters are available through explicit environment configuration; choose a supported image service before drawing, or stop after storyboard review.

The desktop app, browser CLI, source development service, and direct CLI share saved provider profiles. A running service keeps its startup configuration; restart it after changing settings. Explicit environment variables or `--config` apply to that invocation and are not automatically saved.

## Start the CLI browser service

```bash
pnpm dlx @apprun/shiqu
```

First use asks for a library directory and provider. Open the printed local address, normally `http://127.0.0.1:3000`. Keep the terminal running. Ctrl+C stops the service.

```bash
pnpm dlx @apprun/shiqu --data-dir /absolute/private/library
pnpm dlx @apprun/shiqu --port 3100 --host 127.0.0.1
pnpm dlx @apprun/shiqu --configure
pnpm dlx @apprun/shiqu --reset-providers
```

An explicit `--data-dir` takes precedence over `SHIQU_DATA_DIR`, then the saved library location. Choosing another directory opens another bookshelf; it does not move or merge data. Noninteractive first use requires an explicit directory and configured provider. The project `.env` is not loaded automatically; use `--config /absolute/private.env` when needed.

A library can be owned by only one running service or direct CLI process at a time. Stop the current service before switching entry points, even if you plan to use a different port. Use matching app versions.

On the local loopback address, **My space → Generation service and models** edits shared text/image provider settings for both CLI and desktop services. The page distinguishes saved settings from the running configuration and startup overrides, checks saved connections, and can reset provider settings. Switching providers discards hidden unsaved key drafts. Existing keys are never returned to the browser. Credential editing is not exposed to LAN or internet readers. Restart the running service after saving changes.

## Desktop setup

Install the appropriate release, choose a library directory and start the service from the single desktop service console. Choose **Open in browser** to create or read stories and configure providers through **My space**. The console shows service status, local/phone access and optional internet access; advanced settings include Codex executable and home paths. Closing its window keeps the app in the system tray; Stop service or Quit ends the backend and generation subprocesses. The old Overview, Generation queue and Settings tabs have been replaced by this console.

Release installers are unsigned. Windows may display a SmartScreen prompt; macOS may require allowing the app in Privacy & Security. Only open a release you trust, and compare its published SHA-256 checksums if needed. The bundled Node runtime is verified and never silently replaced with a system executable.

## Read on a phone

Connect the phone to the same trusted Wi-Fi and scan the local-network QR code. The computer must remain awake with Shiqu running. Phones use the computer's saved library and generation provider; no phone credentials or Node installation are needed.

LAN access is shared: anyone who can connect can read and request generation. CLI users can bind to `127.0.0.1` for local-only access. Native desktop service LAN access is always available.

For access from another network, install `cloudflared`, stop the desktop service, enable internet access, save, and restart. A free Cloudflare Quick Tunnel provides a temporary private HTTPS link. Scan the complete private QR code to establish a secure session. Pairing links and sessions expire after 12 hours or when the service stops. Restarting creates a new address and requires scanning again. Do not publish the full private link; it grants current bookshelf and generation access. A tunnel failure leaves local/LAN reading available.

## Create a story

1. Choose one of the built-in books. Optionally select chapters or an existing standalone story, or use a theme to discover candidates. English indexed chapter/story labels retain the exact source ranges internally.
2. Select a candidate. Preparation saves the original evidence, an English source translation, a checked English summary, and recommended production settings.
3. Review the source and summary. Choose an art style and narrative detail: Brief, Balanced, or Detailed. These describe storytelling depth, not fixed page counts.
4. Edit production instructions and acceptance criteria, then confirm production. No storyboard or illustration is generated before this confirmation.
5. Follow the timeline through storyboard, title/ending, review, targeted repairs, recheck, and illustration generation.

Each story supports **1–80 illustrated frames**. Automatic frame counts may change during review to fit the source. Long storyboards use an outline and batches of up to 20 frames. A source book can produce multiple independent comic stories.

Speech balloons have a pointed tail; thought clouds use a trail of circles. Production selects the important source-supported words, attributes them to characters and places the balloons automatically. You do not need to open an editor or position them. Illustration composition reserves space for text, and the fitting step keeps balloons readable and apart. A crowded page is retried through production rather than silently losing dialogue. Thoughts are only used when the source explicitly supports them; narration carries the remaining action.

Automatic placement follows the planned characters and scene composition. It does not inspect faces in the final image pixels. If you want to refine a result, open the storyboard revision editor: balloon controls are optional. Reading an old story does not generate or add balloons automatically.

Choose **Other** to enter a different book title or a public webpage URL. URL discovery requires Gemini. External source verification is limited; entering a title or URL does not guarantee a complete production. PDF/EPUB/Word/TXT uploads and a general pasted-story input are not currently available.

## Production and acceptance requirements

Production instructions guide how the source is adapted. They cannot replace source facts, the chosen story, art style, or output schema. Acceptance criteria are separate, one per line, up to 20. They are used during review and show Passed, Failed, or Cannot assess with supporting evidence.

Examples:

- Production: “Preserve the negotiation and the listener's response. Keep the wording natural.”
- Acceptance: “Show the decisive character response through a visible action.”

Conflicting or unverifiable requirements can block drawing. A written storyboard review is not an inspection of the final image pixels. You can inspect current system rules and recorded prompts; a preview of edited instructions is not an execution record. Historical prompts that were not saved are not fabricated.

## Review, pause, and recover

Review checks source fidelity, event completeness, pacing, visual feasibility, continuity, and your acceptance criteria. Repairs target specific problems, then the whole story is checked again. If review cannot resolve an issue, drawing stops. Revise the instructions or storyboard, continue the indicated repairs, or explicitly override review when that is your intent. An override is not a passed review.

Pause and Stop prevent new production work; saved progress remains. Resume does not implicitly retry failed work. Fault recovery uses the current fault instance and an explicit request. Refreshing, renaming, or restarting does not authorize a new paid attempt.

If an image cannot load, first choose **Check image again**. Checking does not redraw. Confirmed missing/damaged files offer an explicit redraw action for that frame. A failed save retries publication of the paid result when available. The first image is a reference dependency, so restore it before drawing dependent frames.

## Revisions and replacement stories

Rename changes the displayed title without new AI generation. Editing production instructions, narrative detail, art style, acceptance criteria, characters, or frame content may create a revision. The app previews what can be reused. Caption-only and ending changes do not invalidate otherwise compatible images. Changes to the first reference, character identity, style, or global image instructions may require broader redraws.

Replace story opens a draft without adding another bookshelf card. Selecting and applying a different story switches the current revision in the same family and preserves prior results as history. Canceling a draft does not roll back a newer revision. A replacement preserves the current paused/stopped control state and still requires production confirmation after preparation.

Selective image redraw accepts one-based frame numbers through `stories edit`: `{token,paused:true,changes:{redrawPages:[1,3]}}`. It requires a completed story with passed review and cannot be combined with text or settings edits. It preserves the source, storyboard, art style and review; only the listed images are regenerated after an explicit `run`. Unselected saved images remain even when frame 1 is redrawn.

## Reading and organization

Balloon pages show the complete artwork with narration below it. The accessible transcript identifies each speaker and whether they speak or think, in the saved reading order. Optional balloon editing supports text, speaker, kind, order, position, size and tail. Pointer, keyboard and percentage inputs provide alternate controls. Closing the editor keeps its local draft for the current story; save explicitly to create a version, or discard the draft. Position-only changes reuse the existing review and artwork. Dialogue and attribution changes go through the ordinary source review; changing a scene's illustration prompt can also redraw that artwork.

The bookshelf separates active production from readable stories and contains current revisions, favorites, recent reading, and generation status. Reading progress is saved locally and shared by browsers connected to that library. You can inspect English source text, storyboard, production notes, review history, and revision history. Deleted stories can be restored.

Star a suitable illustration as the reference for its source book. Later image tasks use that reference, including the first frame of another story from the same book. Existing images are not redrawn automatically. Removing the source story removes its reference selection.

## Exports

Speech and thought balloons appear in the exported images, PDF, ZIP and offline HTML preview. JSON and Markdown preserve their text, speakers and reading order. Raster archive pages are marked as already containing balloons to prevent a second overlay. Public ZIP conversion keeps the existing signed WebP bytes intact. Use this app version or later to edit balloon stories; older apps may omit unfamiliar fields when saving.

Exports run locally and do not call AI. Complete PDF, PNG, and ZIP exports require every current-revision image to exist and be readable. Missing images must be completed; an older revision is not substituted.

| Format | Contents |
| --- | --- |
| PDF | A paginated illustrated story for reading or printing |
| PNG | A long overview image for sharing |
| ZIP | Story metadata, saved English source, storyboard, credits, and all WebP images |
| Offline preview | A standalone HTML file for text or illustrated review, including unfinished drafts when clearly labeled |
| JSON / Markdown | Saved story data or storyboard; may be exported as intermediate work |

Set your author credit and reuse terms in the publication settings before exporting. Unsigned export requires an explicit choice. Visible WebP signatures and metadata carry authorship and AI disclosure. Source attribution remains in the work.

Public ZIP filenames remain collection-compatible: `故事.json`, `分镜.md`, `署名与转载.txt`, and numbered files in `图片/`. The names are an archive protocol; the document prose and new story content are English. Full browser ZIPs can also include saved system/per-frame prompts and history. Inspect the entire archive before sharing. Public conversion removes internal prompt records while preserving signed WebP bytes and metadata.

From a source checkout with a running app:

```bash
pnpm export:story 'Story title'
pnpm export:story 'Story title' --url http://localhost:3100
pnpm export:story /absolute/downloaded.zip --output /absolute/existing-work.zip
```

The script uses the current complete bookshelf revision and production Node exporter. It verifies ZIP structure, images, hashes, metadata, and collection compatibility. Default output: `../awesome-shiqu/works/yysun`. Updated works keep one canonical ZIP filename. Exporting does not commit, push, or publish.

## Direct CLI and Codex skill

```bash
pnpm cli help --json
pnpm cli stories list --data-dir /absolute/private/library
pnpm cli books --data-dir /absolute/private/library
pnpm cli run STORY_ID --data-dir /absolute/private/library --until reviewed
pnpm cli preview STORY_ID --data-dir /absolute/private/library --output /absolute/preview.html
```

Installed usage replaces `pnpm cli` with `shiqu` or `pnpm dlx @apprun/shiqu`. Only explicit `run` performs inference. Other commands save or inspect state. Use `--until candidates`, `prepared`, `reviewed`, or `completed` to honor review checkpoints. Always inspect the returned `reason` and `session`; a successful command is not proof that the story is complete.

Mutation replay keeps the same UUID, generation/token/faultId, and original input. Concurrent changes require reloading and reassessing rather than silently changing the request identity. Use the current revision returned by the API, not a title or timestamp guess.

Install the skill with `skill install --scope global` or `--scope project`. `skill check` reports updates; automatic updating is disabled unless explicitly enabled. A skill update copies the version bundled with the running CLI and preserves locally modified or unknown installations. No skill operation changes the library or generation configuration by itself.

## Data and backups

The story library contains `shiqu.sqlite`, local media, and production checkpoints. `stories` stores current and historical revisions. Separate `desktop.sqlite` stores global settings and API keys. Changing library directories does not copy settings or merge stories.

Default library directories:

- macOS: `~/Library/Application Support/com.shiqu.desktop/library`
- Windows: `%APPDATA%\com.shiqu.desktop\library`
- Linux: `~/.local/share/com.shiqu.desktop/library` (XDG overrides apply)

API keys are plaintext protected by local file permissions, not encrypted. A settings database backup includes keys; a story export does not automatically include global credentials. Keep complete backups private and outside served asset directories.

```bash
pnpm library:maintain --help
pnpm cli backup /absolute/new-backup --data-dir /absolute/private/library
pnpm cli verify-backup /absolute/new-backup
pnpm cli restore /absolute/new-backup --data-dir /absolute/new-library
pnpm cli diagnostics /absolute/diagnostics.json --data-dir /absolute/private/library
```

Stop all services before a backup. Restore only to a new directory; select that directory explicitly afterward. Diagnostics contain redacted metadata rather than a complete restorable library.

## Upgrade and compatibility

Library upgrades create and verify a whole-library safety backup before modification. Keep the reported backup path. Pending upgrade recovery completes before library access. Never restore an older backup over an active library.

Consolidated libraries require desktop and CLI 0.8.0 or later. Older 0.2–0.7 applications are incompatible and seed protection can return `BACKUP_APP_TOO_OLD`. Rolling back requires the pre-upgrade backup and its matching app version restored to a new directory. Later migrations retain the same backup protection. Keep desktop, CLI, and installed skill versions compatible. This branch integrates upstream 0.9.0 and English recovery migration 0021; it does not publish a new installer or npm release. Use the English fork's source checkout for its customizations.

## Troubleshooting

If the provider check succeeds but generation fails, check model permissions, quota, and billing: connection checks do not generate content or prove quota is sufficient. If settings differ from the running service, restart after saving and inspect explicit environment overrides. If the library is busy, stop the other service. If source translation is unavailable, explicitly prepare the story; reading does not start inference. If a generation fails, inspect the saved fault and recover that stage rather than recreating the entire story.
