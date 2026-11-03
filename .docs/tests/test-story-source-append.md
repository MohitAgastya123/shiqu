# Story source append production scenarios

1. Given a completed local story, append later same-edition source plus script pages through `stories edit`. The new family version has combined original/citation, unchanged prefix, copied byte-identical old media, and only additional missing images. Running production reviews it and generates only missing scenes.
2. Replay the exact request: return the same version without extra copies or inference. Changed payload with the same request ID, stale token, backwards/overlapping source or wrong edition: reject without changing the current family.
3. Submit append mode with changed old pages, characters, style/preferences, no new pages, or missing script: reject. Ordinary revisions still cannot change source metadata or count.
4. Given an append revision, a reviewer repair/structural edit that changes the preserved prefix must stop before applying that change; edits solely after the prefix remain valid.
5. On the real Wusong family, compare old/new first 38 page objects and downloaded source image hashes, inspect combined source range through shuihu-031-014, and confirm actual review/production state before reporting completion.
