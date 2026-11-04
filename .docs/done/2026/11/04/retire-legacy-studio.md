# Retire the legacy studio

## Summary

Remove the unused admin workbench and its runtime APIs. Reader startup now loads the current session library once, waits for deletion hydration, and uses current progress/recovery paths. Existing database schema, imports, shared media and desktop production code remain intact.

Implementation: `af4542b` (local only).

## Verification

Node24.22.1:1169 unit/integration tests;44 focused reader-generation tests;18 browser checks;20 Rust desktop tests. Typecheck, ESLint and diff checks pass. No desktop or Docker packaging. Logs are under `.data/maintenance/retire-legacy-studio/`.

## Notes

Historical studio tables are retained for safe upgrades and backups. Old HTTP contracts are deliberately retired. Browser evidence comes from isolated Playwright sessions; the Work in-app browser was unavailable. Initial global-pnpm unit run selected Node22 and was superseded by the explicit pinned Node24 run.

## Final verification review

VR risk: non-low — intentional retirement of studio HTTP contracts with desktop compatibility preserved.
VR review round: 1; reviewer: reused.

1. **Complete — Remove the old workbench and production APIs.** `Admin.tsx`, studio prompts, studio-only helpers and validation are removed. `lib/server.ts` routes current reader APIs and shared saved-media reads only. Retirement tests verify old endpoints return 404.

2. **Complete — Use current reader APIs and wait for startup data.** Reader startup, refresh, progress, favorites and restoration use current APIs. The hero remains a placeholder while the session list or deletion hydration is pending. Browser regressions verify one initial list under StrictMode and no retired API requests.

3. **Complete — Prevent retired content from returning.** Shelf membership comes exclusively from current sessions. Retired studio IDs cannot be removed, restored or favorited through current library actions; historical deletion records are excluded. Raw historical rows remain unchanged.

4. **Complete — Preserve current story functionality.** The pinned Node 24 suite passes **1169/1169**; focused reader generation passes **44/44**. Browser startup/reference checks pass **8/8** and existing lifecycle checks pass **10/10**, covering progress, favorites, reload, delete/restore, uploaded-media references and generation/revision controls. Existing export tests pass in the full suite.

5. **Complete — Preserve desktop contracts.** Desktop production files, native commands, schemas and migrations are unchanged. Current-session desktop lifecycle/access tests pass in the full suite; Rust passes **20/20**. Health and smoke callers now use current APIs.

6. **Complete — Verify through isolated production implementations without packaging.** Tests use isolated data and the production app/workflow. Typecheck, lint and diff checks pass. No desktop or Docker packaging/build was performed. Work browser access was disabled; deliberate response-delay checks used an isolated Playwright session rather than the user’s existing tab or a packaged desktop binary.

All AP tasks are complete. The final NOTICE correction accurately removes attribution for the deleted hardcoded excerpt.

**VR passed: all acceptance criteria complete**
