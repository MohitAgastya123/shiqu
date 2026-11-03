# Project Instructions

## Package Manager

- Use pnpm for dependency management, scripts, documentation examples, and Docker setup.
- Follow the pnpm version pinned in `package.json` (`packageManager`) and the Node version in `.nvmrc`.
- Use `pnpm install --frozen-lockfile` for reproducible installs, and `pnpm add` / `pnpm remove` to change dependencies.
- Run scripts with `pnpm run <script>` (for example, `pnpm run codex:login`) or shorthand such as `pnpm dev` and `pnpm test`.
- Use `pnpm exec` for installed command-line tools instead of `npx`.
- Keep `pnpm-lock.yaml` in sync with dependency changes. Do not introduce npm or Yarn lockfiles.

## Docker Builds

- Build or package Docker images only when the user explicitly requests it.
- Do not automatically build Docker images after code changes or as part of routine verification. Use the applicable local checks instead.

## Desktop Development

- Develop and verify the desktop UI in the in-app browser using `pnpm desktop:preview` (Vite). Reuse the relevant existing tab.
- Bundle or package the desktop application only when the user explicitly requests it. Do not run desktop preparation or build commands as routine verification; use local checks and browser verification instead.

## Repository Hygiene

- Delete `.DS_Store` files whenever encountered, including capitalization variants such as `.DS_store`. Do not move them aside or keep backups.

## Production Workflow

- Improvements to generation, review, or revision must ship through the production workflow; do not stop at an implementation that only works in an evaluation tool.
- Tests and evaluation tools must call the same workflow implementation as production. Use isolated data for verification, without maintaining a separate functional pipeline.

## Story Export

- When the user asks to output/export stories, default to ZIP archives saved in `../awesome-shiqu/works/yysun`.
- When the user names a story to export, run `pnpm export:story '<story name>'` against the running app (default `http://localhost:3000`, override with `--url`). The script reads the latest complete bookshelf revision through the app API, calls the production Node exporter, then verifies and saves the public archive in awesome-shiqu. No browser or Playwright is required. It also accepts an already downloaded ZIP. Do not manually reconstruct the story or create a separate renderer.
- Match the public structure of `官渡之战.zip`: `故事.json`, `分镜.md`, `署名与转载.txt`, and numbered WebP files under `图片/`, with no production/acceptance prompts, per-frame prompts, or internal prompt-history files. Preserve the production exporter's WebPs byte for byte during public conversion, including their visible signature/watermark and XMP metadata; the script verifies image hashes and metadata. ZIP-input mode must not re-encode images. Node and browser encoding need not produce identical bytes.
- Reuse the app's production Node export runtime and shared ZIP serialization, filename, credit, WebP hash and XMP helpers in export scripts. Image encoding and watermarking stay in the shared production exporters; do not maintain a second implementation of those rules in a script.
- Export the latest selected bookshelf revisions using the reader ZIP layout: `故事.json`, `分镜.md`, and all numbered WebP images under `图片/`. Include the saved original text and retain source, author, and AI disclosures.
- Require every selected frame to have an image for a complete export. Report missing frames instead of silently omitting them or exporting an older revision.
- Keep one ZIP per story in the output directory. For an updated work, replace its existing ZIP path and keep the filename to preserve sharing links, even if the story title changed. Use temporary backups during replacement, then remove temporary ZIPs and backups after verification; do not retain duplicate story exports elsewhere.
- Verify frame counts, image readability, ZIP integrity, and compatibility with the destination collection's archive parser. Follow that repository's instructions for content validation.
- Remove temporary exports/downloads and replacement backups after verification, retaining only the canonical story ZIP in the output directory. Story-name mode resolves existing archive IDs through the app's current-version API to preserve filenames across revisions and title changes. For ZIP-input mode with a changed story ID, use `--output` with the existing ZIP path.
- Saving exports does not authorize Git commits, pushes, or publication.
