# Shiqu

Turn Chinese classics into your own illustrated comic books in English. Shiqu includes 24 source books and 15 art styles, supports computer and phone reading, and exports PDF, PNG overview images, and ZIP archives. Stories, images, and reading progress are saved on your computer.

New stories are written in English. During preparation, the production workflow translates the selected source passage and its chapter context into English. The verified Chinese originals remain internal evidence for source checks; they are not rewritten. Previously saved content is not silently translated or regenerated.

[Read the community collection](https://yysun.github.io/awesome-shiqu/) · [User guide](.docs/user-guide.md) · [Development](.docs/development.md)

This English fork is maintained at [MohitAgastya123/shiqu](https://github.com/MohitAgastya123/shiqu). Run this checkout with `pnpm dev` to use its English changes. Published packages and installers linked below are upstream releases; they do not automatically include this fork's customizations.

The `english-app` branch preserves the original English conversion. `english-upstream` combines it with upstream 0.9.0. The `upstream` Git remote points to the original project so future updates can be fetched, reviewed, merged and tested.

## Start creating

Choose a generation provider: a signed-in Codex CLI, OpenAI API, or Gemini. API providers use their own keys and billing. Codex subscription mode requires macOS or Linux and a separately installed Codex CLI. Read-only mode needs no AI credentials.

Text and image providers can be selected independently. The text service handles discovery, English source preparation, storyboarding and review; the image service draws illustrations. **Same as text** uses the text provider for both. Each API service requires its own configured credentials.

### English fork from source

From this checkout, use the pinned Node and pnpm versions:

```bash
nvm use
pnpm install --frozen-lockfile
pnpm dev
```

Open the printed local address and keep the terminal running. Provider changes take effect after restarting the service.

### Upstream command-line package

Install Node 24, then run:

```bash
pnpm dlx @apprun/shiqu
```

Choose a library directory and provider, then open the printed address. Keep the terminal running; Ctrl+C stops the service. On the same trusted Wi-Fi, scan the phone QR code to continue reading.

The service listens on the local network by default, and connected devices share reading and generation permissions. Use `--host 127.0.0.1` for local-only access. API keys are stored as plaintext in the local settings database, protected by operating-system file permissions.

### Desktop

The desktop app includes Node. It supports Apple Silicon Macs with macOS 13.5+ and Windows 10/11 x64.

[macOS download](https://github.com/yysun/shiqu/releases/latest/download/shiqu-standard-macos-arm64.dmg) · [Windows download](https://github.com/yysun/shiqu/releases/latest/download/shiqu-standard-windows-x64-setup.exe) · [Releases and checksums](https://github.com/yysun/shiqu/releases/latest)

The desktop app is a service console with local and phone links, service controls, and advanced connection options. Open the reader in your browser; **My space → Generation service and models** manages text/image providers and saved credentials. See the [desktop guide](desktop/README.md) for installation and development details. Published installers are separate release artifacts; changes in this source folder do not update them automatically.

### Codex skill

Install the task skill once:

```bash
pnpm dlx @apprun/shiqu skill install --scope global
```

Then ask Codex:

```text
$shiqu Find a story in Zhuangzi about kindness and misunderstanding.
Use ink wash and balanced narrative detail. Show me candidates and the production
plan first. After I confirm, create the illustrations and export an offline
preview and a public ZIP.
```

The skill uses the same production core through CLI commands, without starting the desktop app or HTTP service.

## Create, review, and read

Choose a book, optional chapters and theme, then select a story. Preparation saves verified source evidence, an English translation, a checked English summary, and production recommendations. Confirm the art style, narrative detail, instructions, and acceptance criteria before starting.

The production core creates a storyboard, reviews it against the original, makes targeted revisions, and checks it again before drawing. Each story supports 1–80 illustrated frames. The first illustration normally becomes the reference for later frames; a starred reference from the same book can be used instead. Stories can be paused, revised, resumed, and recovered without discarding completed work.

The redesigned shelf separates active production from readable stories. A selective image redraw creates a revision that preserves reviewed text and redraws only the explicitly chosen frames.

New comics automatically include speech balloons and thought clouds when the source supports them. The app chooses dialogue, attributes it to speakers, fits the balloons, and places their tails with the planned characters. Start production as usual and read the finished comic; no balloon-placement step is required. Narration remains separate. Optional storyboard revision controls let you adjust the result later. Moving or resizing a balloon preserves artwork and its review; changing dialogue or attribution runs the normal source review.

## Export and share

When every frame is ready, export a PDF, PNG overview, or ZIP. Export runs locally without new AI calls. Set your author credit and reuse terms before sharing. Images include a visible author signature and metadata; exports retain source attribution and AI disclosures.

Balloon text and shapes are included in image/PDF/ZIP exports and offline previews; JSON and storyboard text also preserve their speakers and reading order. Existing stories retain their saved captions and artwork. To add balloons to an existing story, make an explicit storyboard revision. Use this version or later when editing balloon stories: older apps may discard fields they do not understand.

Public archives retain the collection-compatible filenames `故事.json`, `分镜.md`, `署名与转载.txt`, and numbered WebP images under `图片/`. Their generated prose is English. Full browser downloads can include saved production prompts; inspect the archive before sharing.

[Export instructions](.docs/user-guide.md#exports) · [Community collection](https://github.com/yysun/awesome-shiqu)

## Develop from source

Use Node **24.22.1** and pnpm **11.25.0**, as pinned in `.nvmrc` and `package.json`.

```bash
nvm install
nvm use
corepack enable pnpm
pnpm install --frozen-lockfile
pnpm dev
```

Use `pnpm desktop:preview` for desktop UI work. Use `pnpm cli help --json` for the production command contract. Do not prepare or package desktop resources for routine interface checks.

## License and sources

Original code and documentation are [Apache-2.0](LICENSE); see [NOTICE](NOTICE). Classical texts and third-party resources retain their own source terms, recorded in [source notices](data/library/source-notices.md) and the [catalog](data/library/catalog.json).

The project does not claim ownership of user-generated stories or illustrations. Their rights depend on applicable law, source material, and provider terms; they do not automatically inherit the code license.
