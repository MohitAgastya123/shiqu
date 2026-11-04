# One story store; studio and demo fully removed

The unused studio runtime has been retired, but its `stories`, `jobs` and `progress` tables, its rows, and the demo stories and artwork remain in existing libraries. Their names still suggest a second supported story model. Future development must have one clear place to read and write stories.

Remove the retired studio and the demo completely, including their data, and make the current production story table the only story store under the permanent name `stories`. Old studio and demo content is not migrated, archived or exported. Only current production stories must survive, and they must be backed up before any destructive change.

## Definitions

- **Current stories**: every row in the current production story table (today `reader_sessions`) for any owner, in any state: completed, unfinished, paused, failed, deleted-but-recoverable, and every historical revision. These rows remain protected even when an ID or title matches a demo identity.
- **Retired studio data**: all rows in the old `stories`, `jobs` and `progress` tables; `library_deletions` records of kind `published`; studio-era analytics events whose story is not a current story; and saved media referenced only by retired studio rows.
- **Demo content**: the demo stories (`zhongli` 种梨 and `dongguo` 中山狼传), their artwork stored under `legacy-art/` (`pear-1…10.png`, `dongguo-1…30.png`), the demo source text and note left in the `liaozhai` book row by earlier seeds, and the `zhongshanlang` (中山狼传) book row. Demo content is identified by these identities and locations; no content comparison is needed. A demo book row that a current story uses is kept, minus its demo text.

## Required outcome

- [ ] `stories` is the sole authoritative table for story records and their versions, using the current production model. Creation, reading, revisions, progress, favorites, deletion/recovery and exports use it. `production_jobs`, `books` and the other supporting tables keep their names and distinct responsibilities.
- [ ] Retired studio data and demo content are deleted from every library that is opened, upgraded, restored or imported. The final schema has no old studio `stories`/`jobs`/`progress` tables, no `reader_sessions` table, and no alias, view or fallback for retired names.
- [ ] Deletion never touches anything a current story uses. Media referenced by any current story, revision, book-image reference, export or saved original is kept with its bytes unchanged. Media with an uncertain owner is kept.
- [ ] Book-image reference records that point to a retired studio story or demo artwork are removed. The affected books simply have no saved reference. This is the explicit exception to reference-state preservation: no current story or other current reference is changed, and underlying media bytes are retained whenever a current story uses them.
- [ ] Current stories survive the change unchanged: identities, ownership, revision relationships, selected versions, text, frames, saved originals and citations, production requirements, review results, prompt/model history, publication credits, AI disclosures, reading position, favorites, deletion/recovery state, book-image references other than the explicitly removed records above, and generation authorization. The change generates no content, duplicates no paid task, and resumes no paused, stopped or blocked work.
- [ ] Before any destructive change, a verified, restorable backup of the current library exists and its location is reported. No separate archive or export of studio or demo content is made.
- [ ] Removal, purge and rename happen together in one upgrade. A failed or interrupted upgrade leaves the library exactly as it was before the upgrade, reports the error and the backup location, and never presents a partly consolidated library as usable. Reopening or retrying completes the same upgrade without losing or duplicating current stories.
- [ ] New installations end with the same final schema as upgraded libraries, contain no stories, and contain no demo content in any table or in media. How the schema is reached for a new library is not prescribed.
- [ ] Restored backups and legacy imports reach the same final schema through the normal upgrade before use, which also removes any studio or demo data they contain.
- [ ] The library records its schema version. Versions that include this change refuse, with a clear message and before changing anything, to open a library whose schema is newer than they support. Desktop app and CLI share a library by default, so the minimum compatible desktop and CLI versions are stated in release notes. Already released versions cannot be made to refuse; they are documented as incompatible with the consolidated library, and rollback means restoring the pre-upgrade backup with the matching app version.
- [ ] Desktop startup, library summaries, book names, reading access, queue controls and saved settings keep their current behavior with the renamed table. Browser and CLI access, current reader API paths, story IDs, media URLs and exports keep working. `books` keeps the metadata desktop summaries use.
- [ ] The reader's client-side caches (reading history, last-read story and offline story data) drop entries for stories that are not current stories. Cleanup uses an authoritative owner-scoped inventory that includes historical revisions and recoverable deleted stories; absence from the visible bookshelf is not evidence that a story is retired. Failed or unavailable inventory reads do not trigger destructive cache cleanup.
- [ ] Database definitions, active code and repository guidance name one story table, `stories`. Retired names appear only where the upgrade removes them and in its test fixtures.
- [ ] Isolated verification covers: a new library; a library with only current stories; a library holding studio rows, demo stories, demo art and studio-only media together with current stories, including media shared between them; an interrupted upgrade and its retry; restoring an older backup; legacy import; the version-refusal check; and desktop, browser and CLI behavior after the rename. Before/after evidence accounts for every current story ID and version, saved state and media hash, shows that no removable retired or demo data remains, and identifies media retained because it is shared with current stories or has an uncertain owner. Tests use the production upgrade and workflow implementations.

## Constraints and non-goals

- Rename the database table and its schema definition only. Reader API paths (`/api/reader/sessions…`) and in-code type and module names are not renamed in this change.
- Do not move old studio generation history into `production_jobs` or any active queue.
- Analytics events for current stories, and whether to keep collecting them, are outside this change.
- Do not redesign storage, reintroduce the studio, or build a separate migration-only story pipeline.
- This supersedes the earlier retirement requirement that kept studio tables, rows and demo artwork intact. It does not authorize deleting current stories or their media, purging unrelated backups, rewriting Git history, pushing, publishing, or building desktop/Docker packages.

## Blocking questions

None.
