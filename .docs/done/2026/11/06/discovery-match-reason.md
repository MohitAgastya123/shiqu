# Discovery match reason validation

## Summary

- Fixed live story discovery rejecting valid English theme explanations: suggestions now reuse the matching contract's 480-character reason schema instead of a separate 120-character limit.
- Complete explanations, verified source receipts and existing caches are preserved. Old candidates without reasons remain valid; 481-character text is still rejected.

## Verification

- Full-tier focused tests: **10 passed**, covering 480/481 boundaries, cold/warm production REST streaming and browser parsing, exact saved intake/source data and zero extra warm model calls.
- `pnpm test:changed --plan` selected the full 181-file/native fallback after test ownership updates. Final `pnpm test:changed`: **1492 passed**, zero failures/skips/cancellations. Receipt: `.data/test-plans/2026-11-06T19-35-41-841Z-4bc8aa18/run.json`.
- `pnpm typecheck`, `pnpm lint`, `git diff --check`, native source-only CI tests (**24 passed**, designated prepared-bundle test filtered) and rustfmt passed. No desktop packaging was run.
- Independent AR, CR and the AP acceptance matrix passed. Controlled providers and isolated test libraries were used; the live provider/search status and retained cache were inspected read-only.

## Notes

- An unrelated evaluation-owner race failed once in the initial full run; its isolated four-test file and the complete full rerun passed. No owner implementation or tests were changed.
- No login, model, prompt, cache key or database migration changed. The dev watcher loaded the fix. The preserved failed search needs the user's explicit **Retry search** action; diagnostics did not start inference or rewrite user search/settings.
- Fixed on `feature/comic-bubbles`. The source change is local and does not publish or merge the branch.
