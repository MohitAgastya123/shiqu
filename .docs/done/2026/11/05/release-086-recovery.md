# 0.8.6 recovery fix and release

## Summary

Blocked style-only revisions now atomically receive their own recovery authorization. Migration 0020 also backfills stranded revisions after the normal verified whole-library backup. Explicit acceptance and retry use the existing production workflow.

Published [Shiqu v0.8.6](https://github.com/yysun/shiqu/releases/tag/v0.8.6) from `f1451e35c9e7c70e7a004cca9f0fd05635bd4d3e`; recovery milestone `81f5d9c`. Curated notes cover Gemini and other shipped fixes and retain the user's exclusions. npm publication was handed back to the user after their instruction.

## Verification

Pinned Node 24.22.1 / pnpm 11.25.0. Typecheck, ESLint and Rust formatting passed. Production regressions first reproduced the missing fault, then covered explicit acceptance/retry, pause, replay/restart, isolated migration/backfill, verified backup and rollback of failed fault writes. Exact-commit gates and installed-artifact smoke passed. [Native CI](https://github.com/yysun/shiqu/actions/runs/42044996683) published both installers and checksums; downloaded checksum entries match GitHub's uploaded-asset digests. Evidence summary: `/tmp/shiqu-086-delivery.json`.

VR passed: all acceptance criteria complete.

- Blocked style-only revisions retain one child-owned recovery fault; replay/restart causes no duplicate authorization or inference.
- Explicit acceptance and retry complete once, preserve the parent, and prevent replay from purchasing additional calls.
- Migration 0020 repairs stranded revisions after a verified backup while preserving healthy, overridden, and already-authorized records.
- Committed 0.8.6 source passes release checks **50/50**, affected regressions **68/68**, tag pre-push checks **50/50**, and installed npm artifact smoke checks.
- Both native builds and desktop publication succeeded. The public release contains both installers and checksums; checksum entries match uploaded asset digests.
- Published notes match the curated text and satisfy the requested exclusions.
- The tested npm artifact is ready for user publication at `/Users/esun/Documents/Projects/shiqu-docker/outputs/releases/0.8.6/apprun-shiqu-0.8.6.tgz`, SHA-256 `d813a1eaa30ffad4effc0bfef19ffe6096249865e794d8732297f277df5d9871`. The user’s replacement artifact remains untouched. npm publication remains with the user as instructed.

VR risk: non-low — library migration and public release.
VR review round: 2; reviewer: reused (`release_review`).

## Notes

The initial Windows build compiled successfully but encountered GitHub HTTP 504 downloading NSIS. Rerunning failed jobs resolved the external download failure without source changes or replacing the tag. Both platforms then passed their installer/runtime checks; release publication completed at `2026-11-05T14:51:37Z`.

Unrelated commits, working edits and staged changes were preserved. Final evidence documentation is committed locally without pushing those unrelated commits. No user library or paid model was used for verification, and npm authentication was cancelled without entering credentials.
