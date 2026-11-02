# Story publication protection

The local tool exposes internal prompts in its sole ZIP export, while sharing needs a clear credit, reusable rights notice and images that retain attribution outside the reader. Protect the creator's contribution without claiming ownership of public-domain or separately licensed sources.

- [x] Generated stories can save a production credit, public work URL, contact, source/license note and reuse conditions independently of generation. Old stories remain readable with no invented author; revisions inherit the saved information. Concurrent generation cannot erase it, and other owners/deleted stories cannot update it.
- [x] The reader displays saved credit, AI disclosure and reuse conditions, and offers editing from reading settings. Metadata edits trigger no generation and survive restart.
- [x] The existing single ZIP export keeps its filename and reader layout, excludes production/image prompts, private generation records and internal requirements, retains saved original text, captions, source, model attribution, version and explicit AI disclosure, and carries a human-readable rights file. Every frame is required and readable.
- [x] Every ZIP WebP preserves original dimensions with a user-selected 12px bottom-right creator/source and AI label without interior text labels. It does not crop or add a footer to the artwork. No platform/maintainer name is invented as creator; missing credit is visibly unspecified and does not block historical stories. Images on disk are untouched.
- [x] PDF and contact-sheet PNG carry available credit and AI disclosure; ZIP JSON/Markdown/rights text agree with saved metadata and distinguish code, sources and protected new contributions.
- [x] ZIP retains the existing archive contract; full destination parsing/rendering validation belongs to the following awesome-shiqu RPD, using a real newly exported ZIP. Metadata/content changes cannot reuse an earlier cached download.
- [x] Meaningful API/export tests, pinned-version local checks and browser verification (in-app preferred, disclosed fallback when unavailable) cover save/reopen, the updated ZIP, readable watermarks, missing-image failure and small-screen editing. No paid generation, Docker/desktop packaging, changes to existing story exports, push or deployment.

Scope: shiqu-docker only. awesome-shiqu follows as a separate RPD at the user's request. Not DRM, copyright registration, proof of ownership, or a claim that the visible label implements every jurisdiction's AI metadata standard. Preserve existing local evidence; do not publish it by default.

User correction: exactly one ZIP format. Update the existing export in place; do not add production/public modes, a second button or a second archive path. Destination compatibility is verified during the following reader-site implementation.

- [x] Each exported WebP embeds XMP with public attribution, work/source/version/AI information, original-file SHA-256 and an image-payload SHA-256 with explicit scope. Final WebP SHA-256 is recorded in the existing `故事.json` page entry, outside the hashed file. Do not claim hashes or editable metadata prove authorship.
