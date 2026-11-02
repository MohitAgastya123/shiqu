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

## Story Export

- When the user asks to output/export stories, default to ZIP archives saved in `../awesome-shiqu/works/yysun`.
- Export the latest selected bookshelf revisions using the reader ZIP layout: `故事.json`, `分镜.md`, and all numbered WebP images under `图片/`. Include the saved original text and retain source, author, and AI disclosures.
- Require every selected frame to have an image for a complete export. Report missing frames instead of silently omitting them or exporting an older revision.
- Keep one ZIP per story in the output directory. For an updated work, replace its existing ZIP path and keep the filename to preserve sharing links, even if the story title changed. Use temporary backups during replacement, then remove temporary ZIPs and backups after verification; do not retain duplicate story exports elsewhere.
- Verify frame counts, image readability, ZIP integrity, and compatibility with the destination collection's archive parser. Follow that repository's instructions for content validation.
- Saving exports does not authorize Git commits, pushes, or publication.
