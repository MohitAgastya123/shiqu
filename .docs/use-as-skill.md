# Use Shiqu through Codex

[Overview](../README.md) · [User guide](user-guide.md) · [CLI task contract](../skills/shiqu/SKILL.md)

The Shiqu skill lets Codex discover stories, prepare English comics, revise saved work, export artifacts, and maintain your local library. It calls the same production CLI used by the application. You do not need to start the desktop app, browser frontend, or HTTP service for direct CLI tasks.

## Install

Requires Node 24. Install for your user or the current project:

```bash
pnpm dlx @apprun/shiqu skill install --scope global
pnpm dlx @apprun/shiqu skill install --scope project
```

Source checkouts use `pnpm cli` instead of `pnpm dlx @apprun/shiqu`. Installed global commands can use `shiqu`. Keep the selected entry point and package version consistent throughout a task. If a newly installed skill is not listed in Codex, restart Codex. `skill show` prints the contract without installing it.

Choose a generation provider once in desktop Settings or with the CLI:

```bash
pnpm dlx @apprun/shiqu --configure
```

Codex subscription mode requires a separately installed and signed-in Codex CLI on macOS/Linux. OpenAI API and Gemini use their own keys and separate billing. Read-only mode requires no credentials. The app and skill share saved provider profiles and library location. Explicit environment overrides apply only to that invocation.

## Start with a candidate checkpoint

```text
$shiqu Use the library /absolute/private/library. Find a story in Zhuangzi
about kindness and misunderstanding. Use ink wash and balanced narrative detail.
Show me the candidates, English source summary, and proposed production settings.
Wait for my choice before drawing.
```

Shiqu includes 24 books. Their English display titles do not change canonical source IDs. Chapter browsing uses English indexed chapter/story labels. Original Chinese evidence stays internal, while explicitly requested preparation translates the selected passage and full chapter context into English and saves it. No translation is triggered merely by reading a story.

Custom book-name and public URL discovery have limited source verification; URLs require Gemini. General book-file upload and pasted-story input are not currently available. Ask Codex to inspect supported commands rather than inventing an import path.

## Approve text before illustrations

```text
$shiqu Continue the selected story through storyboard review, then stop before
illustrations. Export an offline HTML text preview so I can review the pacing.
Keep the event's actual ending and show the listener's decisive response.
```

The CLI supports `run --until candidates`, `prepared`, `reviewed`, or `completed`. Those are requested boundaries; Codex must inspect the actual returned stop reason and saved state. A blocked review or paused story does not count as reaching the requested boundary. Text approval and image approval are separate when your request makes them separate.

To authorize the remaining stages:

```text
$shiqu The reviewed storyboard is approved. Create all illustrations, credit
“My Name”, and export an offline preview and public ZIP to /absolute/output.
```

Each story contains 1–80 illustrated frames. The production workflow saves checkpoints, reviews and repairs the storyboard, and generates images only after review passes or an explicit override. Drawing uses the selected provider and may consume its quota or incur API charges.

## Revise an existing story

```text
$shiqu Find “The Butterfly Dream” in my saved library. Keep the original source
and reusable images. Change the acceptance criteria to require that the final
reflection stays within what the source supports. Explain the revision impact
before running production for the new version.
```

Saved revision tokens and current-family IDs prevent stale edits. Renaming changes only the display title. Changes to captions or an ending can preserve compatible art; changing the first reference image, characters, art style, or global visual instructions can require more redraws. Pause remains paused unless you authorize resuming. Failures require recovery of the current fault, not blind reruns.

## Copy approved text and decide about images

```text
$shiqu Copy the reviewed text and review records for STORY_ID from
/absolute/source-library to /absolute/target-library. Leave the copy paused.
Show me the text result and available image count before copying images.
```

Copying text and copying existing images are separate actions unless you explicitly requested both. Codex first records the new target ID, then attaches images to that same copy after your decision. It must not recreate the text copy, substitute image generation, or reuse old images after changing style. Unreviewed text can be copied only through explicit draft mode and cannot receive copied images until formal review passes.

## Inspect and organize without generation

```text
$shiqu List current stories in /absolute/private/library. Group them by source
book and report completed, paused, and failed stories. Include actual missing
image counts and save the report outside the private library. Do not generate.
```

Inspection, filtering, grouping, comparison, favorites, renaming, deletion/restoration, previews, and exports do not authorize inference. Codex can write task-specific orchestration programs, but database mutations, generation, review, revision, and image/archive rendering must use Shiqu's production implementation.

## Export

```text
$shiqu Export the latest complete revision of “The Butterfly Dream” as a public
ZIP and PDF to /absolute/output. Use my saved credit and reuse settings.
Verify every frame and report the output paths. Do not publish or commit.
```

ZIP/PDF/PNG require every image of the current revision. Missing images are reported; older complete revisions are not substituted. HTML previews and JSON/Markdown can deliver clearly labeled intermediate work. Exports run locally without new AI calls.

Public archives retain the stable collection filenames `故事.json`, `分镜.md`, `署名与转载.txt`, and numbered WebPs under `图片/`. New story prose, saved source translations, credits, and disclosures are English. Full internal prompt history is included only when explicitly requested for direct public CLI export. Existing signed archive conversion preserves WebP bytes and metadata rather than re-encoding them.

Use your own author credit. Unsigned export requires explicit consent through `--allow-unsigned`; Codex must never invent a credit. Keep artifacts outside private libraries and served app directories. Project-specific export rules and canonical paths take precedence. Exporting does not authorize Git commits, pushes, or publication.

## Back up and restore

```text
$shiqu Back up the stopped library /absolute/private/library to a new private
directory /absolute/private/backup. Verify it and report the saved path.
```

```text
$shiqu Verify /absolute/private/backup and restore it to a new directory
/absolute/private/restored-library. Do not overwrite or switch my active library.
```

Stop services before backup. Restore only to a new explicit directory. Upgrades use the verified whole-library backup gate; preserve the reported safety path. A diagnostic report contains redacted metadata and cannot restore the library. Settings backups contain API keys and must stay private.

## Skill updates

On activation, the skill runs `skill check` through the selected CLI. Checks normally cache for 24 hours; `--refresh` performs a fresh check. The default is to report updates without replacing the skill. Enable automatic updates only with an explicit request:

```bash
pnpm dlx @apprun/shiqu skill check --scope global --auto-update on
pnpm dlx @apprun/shiqu skill check --scope global --auto-update off
```

When permitted, Codex uses the returned pinned update command and working directory. Locally modified, unknown, or version-locked installations are not overwritten automatically. `skill update` copies the skill bundled with the running package; it does not itself discover/download the newest package. After updating, Codex rereads the skill and checks the matching version's `help --json`. Skill management does not change the story library or generation credentials.

## Direct command reference

```bash
pnpm cli help --json
pnpm cli stories list --data-dir /absolute/private/library
pnpm cli books contents zhuangzi --data-dir /absolute/private/library
pnpm cli run STORY_ID --until reviewed --data-dir /absolute/private/library
pnpm cli preview STORY_ID --output /absolute/preview.html --data-dir /absolute/private/library
```

Commands take private JSON through `--input FILE` or `--input -`. Subcommands return one JSON envelope; logs go to stderr. Use argument arrays rather than shell interpolation for user text and paths. Serialize calls against one library and retain original UUID/generation/token/faultId/input for exact replay. A successful command or exit status is not proof that the story is complete: inspect `reason`, review/fault state, and media integrity.
