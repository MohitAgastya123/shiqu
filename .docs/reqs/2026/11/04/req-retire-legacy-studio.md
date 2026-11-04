# Retire the legacy studio

The reader still loads a second, unused studio library. Retire that runtime and make the current generated-story library the sole source for discovery, reading and progress. The desktop apps must retain their existing behavior.

- [ ] Remove the unmounted admin workbench, its prompts and production/analytics APIs.
- [ ] Reader startup, refresh, favorites, restore and reading progress use current reader APIs only; loading remains visible until library and deletion state are ready.
- [ ] Retired studio content cannot reappear through shelf, deep links or recovery.
- [ ] Current generation, revision, exports, media, favorites, progress and recovery continue to work.
- [ ] Desktop lifecycle, settings, library summaries, direct/LAN access and internet access retain their contracts.
- [ ] Verification uses isolated data and production implementations; no desktop or Docker packaging/builds.

Historical SQLite tables and migrations remain intact for safe upgrades, imports and backups. Shared saved-media access stays available. No destructive schema migration or changes to the user's generated stories. Prior demo cleanup and loading changes in this session are part of this work.
