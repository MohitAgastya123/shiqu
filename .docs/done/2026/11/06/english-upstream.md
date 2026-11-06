# English Upstream Integration

## Summary
- Integrated upstream 0.9.0 with the saved English application on `english-upstream`. Merge `7f2d1f1` has parents `e0d62bb` (English checkpoint) and `d9005d4` (upstream); both ancestry checks pass.
- Preserved the redesigned shelf/service console, separate text/image providers and selective redraw while retaining English interfaces, source preparation, generation, exports and recovery migration 0021.
- Registered English tests and their production consumers, adapted controlled English source/browser fixtures, and added cache-fence and translation/restart receipt regressions. Canonical source-book bytes remain unchanged.

## Verification
- Node 24.22.1 / pnpm 11.25.0: frozen install, typecheck, lint, whitespace and independent architecture/code reviews passed. Documentation-only finalization selected one integrity-smoke file; all four checks passed.
- `pnpm test:changed --plan` selected all 176 JS files with full flags and native coverage. `pnpm test:changed` passed **1,462 tests**, zero failures/cancellations/skips, in 233.5 seconds. Earlier extended-fixture and ownership failures were corrected without removing scenarios or assertions.
- Isolated Rust 1.93.0 with pinned Node: `cargo fmt --manifest-path src-tauri/Cargo.toml --check` passed; the CI source-only `cargo test --manifest-path src-tauri/Cargo.toml --locked --lib` passed **24 tests**, filtering only the designated prepared-bundle test. No desktop preparation or packaging was run.
- Automated browser coverage includes source reading, creation, revisions, recovery, replacement, provider save/check/reset and desktop/mobile console layouts. Local logs and source identities are retained under `.data/evidence/english-upstream/` and `.data/test-plans/2026-11-06T16-49-59-537Z-15736a5b/`.

## Notes
- The in-app browser surface was unavailable (`Browser is not available: iab`). Vite preview was started and stopped; automated browser screenshots were inspected separately. Native source checks ran on macOS; this did not qualify Windows or packaged installers.
- Providers and libraries used controlled isolated fixtures; no live AI calls or personal-library writes occurred. Online English-book import remains outside this task. The updated branch is local and ready for the user's publishing step; the previously published `english-app` checkpoint is preserved.
