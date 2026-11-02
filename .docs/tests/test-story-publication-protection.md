# Story publication protection E2E

Use the in-app browser when enabled (otherwise the disclosed independent test browser) and an isolated test library with synthetic complete images, saved original and private prompt sentinel. Never write user stories or call a live provider.

1. Open an existing generated story without publication metadata. It reads normally, identifies AI participation, and never invents creator ownership. Open reading settings and edit publication information; save credit, source/license note, contact, work URL and reuse terms. Reopen/reload and verify all fields persist. Test narrow viewport layout and keyboard access.
2. Download the updated ZIP. Decode it in browser: expected numbered WebPs, exact frame counts, original text and captions, and valid ZIP. It excludes private prompt/requirements sentinels, retains saved attribution/AI/source/version, and includes rights text. Decode every WebP and inspect the bottom-right12px credit and absence of interior text, with unchanged dimensions and no crop. Inspect source dimensions/pixels to verify local originals remain untouched.
3. Keep an actual newly exported synthetic ZIP as temporary evidence for the following awesome-shiqu RPD, where the actual destination parser and rendering are verified.
4. Change credit/terms, download again, and verify new contents rather than a cached older URL. Missing credit exports without an invented creator; a story missing a frame prevents all complete exports.
5. Download PDF and PNG and verify available credit plus AI disclosure.

API tests additionally cover owner/deletion/latest-version guards, invalid inputs, compare-and-swap conflicts, persistence after restart, late worker saves and revision inheritance.

6. Extract XMP from every real exported WebP, verify the original-file and explicitly scoped image-payload hashes, then verify its final whole-file hash against `故事.json`. Changing XMP changes the file hash, not the image-payload hash. Both source and watermarked WebPs decode; original file bytes are unchanged.

7. Long credits use a bounded visible name with full author in metadata. Unit tests cover Unicode/control handling and XML escaping, RIFF odd padding/flags/duplicate XMP, and SHA-256 with no WebCrypto. Payload hash scope: ICCP/ALPH/VP8/VP8L complete RIFF chunks including headers/padding in file order.

Invisible-watermark scenarios were withdrawn on 2026-11-02. The active export has only the bottom 12px credit, XMP and hashes. Verification of the rollback is recorded in the completion document.
