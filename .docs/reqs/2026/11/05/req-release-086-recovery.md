# Release 0.8.6 with recoverable blocked revisions

Changing only a story's art style must retain its rejected script review without stranding the new version. The child currently starts failed without a recovery fault, so explicit acceptance and retry cannot proceed.

- [x] A style-only revision of a blocked story retains review results and starts failed with one pending, child-owned recovery fault; creation/replay and restart do not duplicate it or start inference.
- [x] Explicit acceptance of that fault draws the new revision to completion once, without rerunning review or modifying the parent; replay cannot buy another attempt.
- [x] Previously stranded blocked revisions acquire a pending recovery fault through the production library upgrade, after a verified backup; healthy and overridden revisions are unaffected.
- [ ] Release checks pass on the committed 0.8.6 source, version declarations agree, and npm plus desktop release delivery completes.
- [ ] Public release notes describe Gemini and other shipped fixes and omit DeepSeek and Claude.

Preserve unrelated working changes. Use isolated libraries for checks. Do not rewrite applied migrations, change reader API contracts, or access the user's library. Provider comparison work and unrelated review-history/attribution changes are outside this fix.
