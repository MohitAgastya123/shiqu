# English App

## Problem
The app is written for Chinese readers. English-speaking users cannot use its interfaces, read source passages, or obtain English comics throughout the production workflow.

## Requirement
Convert the application to English throughout: reader, desktop console, CLI, errors, accessibility text, built-in book display metadata, newly generated story content, source reading, production prompts, exports, and current user documentation. Source passages shown or exported must be English translations, not Chinese passages accompanied by English controls. English is the sole product language, with no language switch.

## Acceptance Criteria
- [x] Reader creation, discovery, bookshelf, reading, settings, review/revision, recovery, and export controls and accessibility labels are English.
- [x] Desktop overview, queue, provider settings, service controls, native dialogs and CLI guidance are English.
- [x] All 24 built-in books have English display titles, author names, eras and descriptions; chapter selection has English labels.
- [x] Production discovery, preparation, storyboarding, review and revision request English titles, summaries, captions, character descriptions, reasons, requirements and endings.
- [x] Selected source passages and complete chapter context are translated into English through the production preparation workflow and saved; reader and exports expose English source text. No raw Chinese source passage is used as a visible fallback.
- [x] English prose fits schemas, UI layouts and export wrapping; 1–80 story frames and source fidelity checks still work.
- [x] PDF, PNG, ZIP and offline preview content, credits and disclosures are English; English-readable archives retain round-trip compatibility.
- [x] Current README and entry-point user documentation describe the English product and how source translation works.
- [x] Typecheck, lint, relevant unit tests and isolated browser checks provide recorded evidence; remaining Chinese runtime literals are classified as internal identifiers, source evidence, compatibility rules or defects.

## Constraints
Use Node 24.22.1 and pnpm 11.25.0. Preserve production workflows and verified source evidence, source hashes and canonical IDs; source evidence is implementation data and must not leak into English reading/export text. Preserve APIs, SQLite schema, command identities, original attribution and mandatory public ZIP layout. Never mutate the user's library or call real AI during tests. Do not package desktop or publish. No Git metadata exists in the supplied folder; record source review against an external baseline and report that a commit cannot be made.

## Non-Goals
New book uploads, additional providers, new UI design, multiple languages, rewriting historical engineering reports, translating third-party license text, changing external websites, or silently replacing previously generated user-owned artwork/content.
