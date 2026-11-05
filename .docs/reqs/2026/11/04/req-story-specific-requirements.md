# Story-specific production and acceptance requirements

Generic editorial rules belong to system prompts. Setup currently presents the same generic production text for every story and no suggested acceptance criteria, while generation consumes validation criteria.

The selected original must drive editable adaptation guidance and corresponding checks before production begins. Production uses 制作要求; validation uses 验收要求. The summary remains a separate factual synopsis.

- [ ] Preparation proposes story-specific 制作要求 and 2–4 corresponding, observable 验收要求 from the complete original in the existing production preparation call.
- [ ] Both appear in the setup editors, persist across restart, and apply only after explicit production confirmation. User edits, including intentional empty fields and concurrent drafts, win over suggestions.
- [ ] Reselecting a story discards unchanged generated guidance from the old story and preserves authored overrides.
- [ ] Generic defaults live in system prompts; fresh/cleared production fields stay empty instead of receiving generic fallback text. Recognized historical automatic presets normalize to empty without changing historical captures or authored text.
- [ ] Creation, pacing, images and revisions use production direction, without receiving acceptance criteria. Full review receives acceptance criteria and returns evidence per criterion; repair receives specific failed findings and production direction. Validation-only revisions continue to reuse scripts/images.
- [ ] All existing providers use the same shared production contracts; verification uses isolated libraries and controlled model transports.

No schema migration, provider/configuration changes, extra model round trip, Docker/desktop packaging, or changes to saved historical prompt records.
