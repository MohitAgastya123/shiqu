# Shiqu

Create English illustrated stories from Chinese classics. Read on a computer or phone, and export PDF, PNG overviews, or ZIP archives. Stories, images, and reading progress stay on your computer. AI generation sends the required source passages, prompts, and references to your selected provider.

## Quick start

Requires Node 24:

```bash
pnpm dlx @apprun/shiqu
```

Choose a library directory and AI provider, then open the printed address. Keep the terminal running; Ctrl+C stops the service. For local-only access, add `--host 127.0.0.1`. Local-network devices otherwise share your bookshelf and generation permissions.

Choose Codex subscription mode (macOS/Linux, separate signed-in Codex CLI required), OpenAI API, Gemini, or read-only mode. API keys are billed separately and stored as plaintext in the local settings database, protected by OS permissions. Use `--configure` to change provider settings; restart the running service to apply them.

Text and image services may be selected separately; **Same as text** uses one provider for both. This English fork is a source customization. Published upstream packages and installers do not automatically contain its changes; run the fork checkout with `pnpm dev` for the English experience described here.

The app includes 24 books and 16 art styles. New story titles, summaries, captions, character descriptions, reviews, and endings are English. Production preparation saves an English source translation while preserving verified original evidence internally. A story contains 1–80 illustrated frames. In this fork, **Upload a story** accepts local Word `.docx` and text PDFs and automatically creates ordered parts for a long story; one Create-all action starts the existing production workflow. Upload limits are 10 MiB, 500 PDF pages, 2 million extracted characters and 200 parts; OCR and legacy `.doc` are not supported.

## Desktop and Codex

[Desktop releases](https://github.com/yysun/shiqu/releases/latest) include Node for Apple Silicon macOS 13.5+ and Windows 10/11 x64. The desktop console manages configuration and the service; the reader opens in your browser.

Install the Codex skill:

```bash
pnpm dlx @apprun/shiqu skill install --scope global
```

Example request:

```text
$shiqu Find a Zhuangzi story about kindness and misunderstanding. Use ink wash.
Show candidates and a production plan before drawing. After confirmation,
export an offline HTML preview and a public ZIP.
```

## CLI commands

Prefix these commands with `pnpm dlx @apprun/shiqu`. Source checkouts use `pnpm cli`. Stop any service using the same library before running direct library commands.

| Command | Purpose |
| --- | --- |
| `help --json` | Current commands, arguments, schemas, and examples |
| `init`, `status` | Initialize or inspect a library |
| `books`, `themes`, `styles`, `books contents BOOK_ID` | Browse book, theme, style, and chapter catalogs |
| `stories list`, `stories get ID`, `stories current ID` | Inspect stories and their current revisions |
| `stories create --input FILE` | Save a new story request |
| `stories setup`, `stories search`, `stories choose`, `stories confirm` | Save discovery and production decisions |
| `run ID --until candidates\|prepared\|reviewed\|completed` | Advance production for one story |
| `stories edit ID --input FILE` | Create a revision using a current revision token |
| `stories pause`, `stories resume`, `stories stop` | Control production |
| `stories retry`, `stories override` | Explicitly recover a fault or override review |
| `stories rename`, `delete`, `restore`, `favorite`, `reference` | Organize stories and select book references |
| `stories revisions`, `prompts`, `review-history`, `source` | Inspect saved evidence |
| `stories reselect`, `replace`, `cancel-reselection` | Replace a story selection within its family |
| `preview ID --output FILE` | Write a standalone offline HTML preview |
| `export ID --format FORMAT --output FILE` | Export JSON, Markdown, ZIP, PDF, or PNG |
| `skill show`, `install`, `check`, `update` | Manage the Codex skill |
| `config get`, `set`, `reset` | Manage shared provider configuration |
| `backup DIR`, `verify-backup DIR`, `restore DIR`, `diagnostics FILE` | Maintain a library |

Only explicit `run` performs inference. Other commands inspect or save state. JSON input is read with `--input FILE` or `--input -` for stdin. Mutation replay requires the same request ID and original inputs; see `help --json`.

ZIP/PDF/PNG exports require all current-revision images. Ordinary exports write a new path and do not overwrite. Public ZIPs retain collection-compatible filenames, English prose, source attribution, author credit, and AI disclosures. Restores require a new explicit `--data-dir`; they never overwrite the active library.

## Startup options

Use `--port PORT`, `--host ADDRESS`, `--data-dir DIR`, or `--config FILE` to override the current invocation. Default HTTP port: 3000; default bind: 0.0.0.0. Environment and config overrides do not automatically change saved settings. Project `.env` files are not loaded automatically. `--reset-providers` clears provider profiles and keys while retaining stories.

## Development

Use Node 24.22.1 and pnpm 11.25.0:

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm desktop:preview
pnpm cli help --json
```

[User guide](https://github.com/yysun/shiqu/blob/main/.docs/user-guide.md) · [Source](https://github.com/yysun/shiqu) · [License](https://github.com/yysun/shiqu/blob/main/LICENSE) · [Source notices](https://github.com/yysun/shiqu/blob/main/data/library/source-notices.md)
