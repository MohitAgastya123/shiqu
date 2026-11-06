# Shiqu desktop service console

The desktop app starts the local Node service and opens Shiqu in your browser. Stories, images, reading progress, and the production queue stay in the browser application and local library. The desktop window provides service controls, local paths, network access, and runtime status. It does not duplicate the shelf or generation settings form.

The app bundles Node 24.22.1. It validates the bundled executable and its SQLite support before starting; it does not silently substitute a system Node installation.

## Start and configure

1. Open Shiqu and click **Start service**. You can start and read existing stories before configuring a generation provider.
2. Click **Open in browser** to read, create stories, or manage the shelf.
3. On this computer, open **My space → Generation service and models** to choose text and image providers, models, reasoning effort, and API credentials. The console provides the same browser settings link while running.
4. Save settings, then use **Restart service** in the console to apply them. Restarting confirms that active generation will stop; saved progress can be continued in the browser.

Text and image providers can be configured separately. Codex requires a separately installed and signed-in Codex CLI; OpenAI API and Gemini require their respective credentials and use separate API billing. Read-only mode makes no generation calls. Native Windows uses API providers or read-only mode.

The desktop console owns the library directory, port, internet access, cloudflared executable, Codex executable, and Codex login directory. Stop the service before editing these fields. **Save local settings** preserves browser-managed generation settings and rejects stale settings revisions. Changing the library directory switches shelves without moving or merging existing data.

Desktop and CLI share the local `desktop.sqlite` settings database. API keys are stored as plaintext, protected by local filesystem permissions. The local browser settings endpoint accepts only loopback, same-origin requests and never returns saved key contents. LAN and public tunnel visitors cannot edit generation settings. An unreadable or missing configured settings store fails clearly rather than creating a replacement store.

## Library upgrades and recovery

The production `stories` table stores current stories and their revisions. Support tables keep their separate queue, reading, and ownership roles. Native code checks library format and recovery journals before ownership writes. The Node production initializer performs upgrades with a verified whole-library backup before access.

During an upgrade, the console shows progress and preserves the verified backup path. The normal startup timeout is suspended while upgrade progress is active. Keep the application open until recovery or startup finishes. Unknown or newer library formats are refused without modifying the library.

Use the shared maintenance commands for backups, recovery, and diagnostics:

```bash
pnpm library:maintain --help
```

Run maintenance against the intended library and follow the [user guide](../.docs/user-guide.md). Never restore an older backup over an active library. Older application versions may not support a newer library or settings database.

## Phone access

Start the service and scan the local-network QR code from a phone on the same trusted Wi-Fi. Devices that can connect share the shelf and generation permissions. Local network access uses HTTP.

Optional internet access uses a private Cloudflare temporary HTTPS tunnel and requires a separately installed `cloudflared` executable. Stop the service to enable it or change the executable path. Pairing lasts up to 12 hours, ends when the service stops, and requires scanning a new link after restarting. Keep the full link and QR code private. The computer must remain awake and the service running.

Closing the desktop window keeps Shiqu running in the tray. Stopping the service or quitting terminates its server, tunnel, and generation subprocesses.

## Development preview and checks

Use Node 24.22.1 and the pnpm version pinned in `package.json`:

```bash
pnpm install --frozen-lockfile
pnpm desktop:preview
```

Open `http://127.0.0.1:1420` in the in-app browser. This Vite preview supports hot reload, displays the English service console, and does not read the library or simulate a running native service. Native settings, service lifecycle, and path controls are unavailable in the plain browser preview.

For a browser reader link, start the reader separately with isolated test data and supply its loopback root URL:

```bash
SHIQU_DATA_DIR=/tmp/shiqu-reader-preview SHIQU_AI_PROVIDER=readonly pnpm dev
VITE_DESKTOP_READER_URL=http://127.0.0.1:3000 pnpm desktop:preview
```

Only a distinct `http://127.0.0.1:port` root is accepted; credentials, paths, queries, and fragments are rejected. Use isolated settings, synthetic credentials, and temporary libraries for verification.

```bash
pnpm typecheck
pnpm lint
pnpm test:changed --plan
pnpm test:changed
```

When the pinned Rust toolchain and platform dependencies are available, source/native tests can be run with `pnpm desktop:test`. Browser IPC fixtures do not establish native window, tray, packaging, or operating-system integration correctness. Do not run desktop preparation, build, bundle, or installer commands unless explicitly requested.
