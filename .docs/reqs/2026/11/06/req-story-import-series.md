# Local stories and automatic comic series

## Problem

Readers currently must choose a bundled classic or locate an external source. They cannot give the app a local Word/PDF story. A long upload must not be squeezed into one bounded comic or silently lose later chapters, important events or its ending. Manually dividing a book and carrying character settings between separate stories defeats the automatic workflow.

## Requirement

Accept a local Word `.docx` or selectable-text PDF, preserve its complete extracted story and automatically propose ordered, natural-sized parts. A short story stays one comic; a long story becomes `Title — Part 1`, `Title — Part 2`, and so on, with a part count determined from the source. One explicit creation action commissions the whole series through the existing production workflow. Keep important source coverage, character continuity, ordered progress and safe restart/retry visible without requiring manual splitting or balloon positioning.

## Acceptance Criteria

- [x] AC1: A visible upload entry accepts actual `.docx` and text PDF files. Extraction preserves paragraph/page order and the complete canonical text, records source provenance and produces a readable preview before any AI work. Invalid, unsupported, encrypted, scanned/mixed-image-only, excessive and unreadable documents have clear English errors; content is never silently truncated.
- [x] AC2: Automatic parts cover every canonical source unit exactly once, contiguously and in order, including the final text. Prefer chapter/paragraph/sentence boundaries; do not hardcode four parts or split inside words. Short stories remain one comic. Show the proposed ordered parts and source size before creation.
- [x] AC3: One `Create all parts` action confirms shared art/detail/preferences and commissions the series. No classic-book discovery or per-part setup wizard is required. Stable request/part identities make upload/creation replays safe across lost responses and restart.
- [x] AC4: Every comic uses its exact uploaded source span as narrative evidence through existing recommendation, storyboard, review, repair, balloons, image jobs and exports. Independent source coverage checks account for all required source units before illustration; missing or unsupported evidence blocks drawing rather than completing with omitted content. Intermediate parts preserve continuing action without inventing an ending or adapting later parts.
- [x] AC5: Shared character descriptions, relevant prior-part state and a saved image reference carry forward. Continuity context is distinct from current-part source evidence; equal filenames/titles cannot cross-contaminate separate series.
- [x] AC6: Parts activate in numeric source order. Pause/resume, provider failures, process restart and targeted part recovery preserve completed work and do not duplicate generation or skip a part. Future unstarted parts remain paused, including when older app versions inspect them. Series reads do not start or retry inference.
- [x] AC7: The shelf and series overview display ordered parts with overall/per-part status and useful actions. Each part opens in the existing reader and has ordinary PDF/PNG/ZIP export with correct part titles, source attribution, narration and automatic bubbles. Previous/next-part links never silently start paid work. Desktop and phone flows remain English and usable.
- [x] AC8: Production-path import, complete-source/coverage, continuity, idempotency, ordering, failure/restart/revision and actual DOCX/PDF browser tests pass, along with required regression/typecheck/lint/native checks. Verify desktop Vite preview and in-app browser; document the finished feature on a new branch from main.

## Constraints

Use pinned pnpm/Node and preserve existing classic workflows, source-frame APIs, canonical stories/revisions and export signatures. Store uploads privately inside the library and include them in verified backups. Parsing must be bounded and run without external file access, document scripts or HTML injection. New schema changes use the production upgrade gate and verified safety backup; never test migrations against the personal library. Verify with isolated fixtures and controlled providers, without paid AI calls or publishing personal files. The default source language may be retained as evidence while authored comics stay English.

## Non-Goals

Legacy binary `.doc`, OCR of scanned pages, layout-perfect document rendering, arbitrary external URLs, manual source splitting or balloon placement, guaranteed identical generated faces, new providers, a second comic-generation pipeline, desktop packaging, merging this feature to main, or publicly publishing uploaded files or generated stories. The feature must fail clearly when source or generation limits prevent a complete adaptation; it must not claim perfect semantic coverage from AI alone.
