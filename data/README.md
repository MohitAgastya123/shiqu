# Source library and local data

`library/` is the versioned read-only corpus of 24 classical works. The [catalog](library/catalog.json) records each download, pinned edition, SHA-256, included range and known limitations. [Source notices](library/source-notices.md) record attribution, text licenses and processing rules; third-party source terms are separate from the code's Apache-2.0 license.

The corpus contains 16 Wikisource works, six Kanripo works and two Project Gutenberg books. Downloaded originals are kept byte-for-byte for reproducible source checks. The English production workflow translates selected passages and their chapter context and saves those translations with stories; the reader and exports use English text. It does not rewrite the provenance-checked downloads or translate the entire corpus during startup.

The server parses local originals without executing HTML scripts, verifies manifest hashes and adds deterministic citation identifiers. Source bodies are not truncated or silently repaired. Unknown glyphs, missing text and unresolved transcription problems remain recorded and can make affected story ranges unavailable. A verified transcription is not a claim of a fully collated scholarly edition.

All 24 books support local source-grounded discovery. Longer books are read in bounded ordered blocks rather than replaced with summaries. Storyboarding receives the chosen evidence and its saved English translation. Chapter browsing uses English indexed labels while source selections retain the original edition/ranges internally.

Some editions have specific limits: Six Records of a Floating Life includes the four surviving records; Strategies of the Warring States uses Kanripo's 501 chapters; Miscellaneous Morsels from Youyang includes 20 main and 10 continuation volumes; Journey to the West includes its 100 chapters and the Chen Guangrui appendix. Historical tables and empty cells in Records of the Grand Historian are retained. Extensive Records of the Taiping Era includes documented glyph/missing-text limitations. Consult the catalog for the exact edition and scope.

Only documentation and the source corpus are versioned here. User SQLite databases, generated media, caches, research and backups belong in private runtime directories excluded from version control. Desktop/CLI release resources copy the read-only corpus; they do not bundle personal libraries or credentials. New libraries start empty, without generated sample stories.
