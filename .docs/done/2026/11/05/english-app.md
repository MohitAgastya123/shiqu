# English App

## Summary
- Converted reader, desktop console, native/CLI copy, accessibility labels, book/style metadata, active guides and new generation prompts to English.
- Added complete English source/chapter translation as bounded production checkpoints, with saved progress, concurrency locks and stop/pause checks. Source reading and new exports use saved English text; GETs never commission translation.
- Widened English prose limits, added word-aware export wrapping and shared English theme labels, and fenced older Chinese discovery caches out of English discovery.
- Added migration 0021 for English image-recovery errors while preserving historical fault recognition and signed archive/WebP compatibility.

## Verification
- Node 24.22.1 / pnpm 11.25.0; frozen dependency install, typecheck and lint passed.
- `pnpm test --test-concurrency=4`: **1,325 passed, 0 failed, 0 cancelled** (143.2 s). Includes production, source, UI, export, cache, migration and queue regressions.
- `pnpm exec node --experimental-strip-types --test tests/release-smoke.playwright.e2e.mjs tests/english-reading.playwright.e2e.mjs`: **2 passed**. Both production browser scenarios passed: creation/edit/confirmation/reading and English comic/source reading with a read-only reload. In-app reader and desktop preview were inspected; screenshot: [English desktop](../../../../assets/english-desktop.png).
- Independent code review passed after correcting queue identities, source validation/locking/control interruption, export theme projection, cache locale identity and SQL recovery classification.

## Notes
- Provider responses in verification are controlled; no live paid generation or personal-library mutation was performed. Source translations are prepared when requested, not by bulk rewriting the pinned 24-book evidence corpus.
- Native Rust compile/format checks were unavailable because Rust tooling is absent. No desktop preparation, bundle, installer or publication was requested or performed.
- The supplied source folder has no Git metadata. Changes remain saved locally; no commit was created, and no repository was initialized.
