# English App E2E Scenarios

Run with isolated library/settings and controlled model responses. No real provider credentials or paid requests.

## Reader and discovery
Open the reader at desktop and 390px phone width. Verify English navigation, book names, source selection, themes, validation, empty states, provider settings and accessibility names. Search/select chapter labels without exposing Chinese preview text.

## Preparation and English source
Select a built-in story and run preparation with a controlled response containing complete English passage and chapter translation. Confirm English summary, requirements and source text are persisted. Reload and reopen Source: saved English text remains and no generation happens on GET. Missing/invalid translation must prevent confirmation with an English actionable error; never substitute Chinese text.

## Production, review and revision
Confirm creation, run controlled outline/storyboard, review/repair and image responses through production, and verify English title/captions/ending, progress and review records. Pause/resume/retry and edit a caption; compatible image reuse and stable book/source IDs remain intact.

## Reading and exports
Read the finished story, view source and review history, and export PDF/PNG/ZIP/offline HTML. Visible prose and saved source translation are English, citations and attribution remain, all frames are present and images readable. ZIP public filenames satisfy the existing archive parser. Read-only legacy content without a translation reports a clear English action rather than exposing Chinese passages.

## Desktop
Run pnpm desktop:preview and reuse its in-app browser tab. Verify English Overview, Queue, Settings, phone/service controls and previews at normal width; loading and unavailable-native-action messages are English. No desktop prepare/build/package commands.


## Acceptance verification

| Requirement | Evidence | Status |
| --- | --- | --- |
| English reader and accessibility | english-ui tests and English reading browser scenario; in-app reader inspection | Complete |
| English desktop and native copy | desktop overview tests, in-app desktop preview and native string review | Complete; native compilation unavailable |
| English book/chapter labels | 24-book HTTP selection tests and English source label projections | Complete |
| English production instructions/content | provider contract tests, English reading browser scenario through production | Complete |
| Complete English passage/chapter source | english-app chunk/restart/concurrency/stop tests, English Source browser view, no paid GET regression | Complete |
| English prose/layout | caption/schema tests and word-aware PDF/PNG wrap regression | Complete |
| English exports and archive compatibility | ZIP/PDF/PNG/native exporter tests, signed legacy WebP byte-preservation regression, shared theme labels | Complete |
| Current English documentation | README, user/development/desktop/CLI/skill/data guides | Complete |
| Checks and final review | Exact final suite counts and review evidence in completion record | Complete: 1,325 passing tests and two passing browser scenarios |

Browser evidence is retained under `.data/e2e/`; the English desktop preview screenshot is `.docs/assets/english-desktop.png`. Browser tests use controlled provider replies, not a claim of live model translation quality. No user library was used. The original download bytes/canonical IDs and legacy protocol archive paths remain implementation contracts, while source reading/new product prose are English.
