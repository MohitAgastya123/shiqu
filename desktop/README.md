# Shiqu Desktop

The desktop application is a Tauri 2 console for the shared local Node production core. It manages provider settings, starts/stops the service, shows the bookshelf and generation queue, and opens the browser reader. Reading and creation use the same React interface as the CLI browser service.

The interface and new production output are English. Preparation saves English translations of selected source passages and chapter context, while verified Chinese originals remain internal source evidence. No translation or generation is started merely by opening the desktop overview.

[User guide](../.docs/user-guide.md) · [Project overview](../README.md)

## Supported releases

Desktop installers include Node 24.22.1 and run without a system Node installation. Supported published targets are Apple Silicon macOS 13.5+ and Windows 10/11 x64. Windows requires WebView2; the installer can download it when absent. Current installers are unsigned. Check the release origin and checksums before accepting OS prompts.

The app verifies the bundled executable's SHA-256, platform, architecture, actual Node version, and SQLite support. Missing or damaged runtime resources require reinstalling; the app never silently falls back to system Node.

## Use the app

1. Open Settings and choose Codex, OpenAI API, Gemini, or read-only mode. Codex requires a separately installed and signed-in CLI on macOS/Linux. API providers use independent keys and billing.
2. Choose the private library directory and save settings.
3. Start the service and open the reader in your browser. Generation and reading happen there.
4. Scan the LAN QR code on a phone connected to the same trusted Wi-Fi.

Overview reports current local stories, completed work, active production, items needing attention, and favorites. Unknown or failed reads are shown as unknown, not as an empty library. Queue and reader share the production stages and actual persisted jobs. Closing the desktop window leaves the app in the tray; Stop service or Quit terminates the backend, tunnel, and generation subprocesses.

## Settings and credentials

Desktop and CLI use the same `com.shiqu.desktop/desktop.sqlite` settings database, protocol version 2. Provider profiles and keys are separate from story data. API keys are stored as plaintext protected by OS file permissions (0700/0600 on Unix; user configuration ACLs on Windows). Keys are sent to the Node child through private stdin, not command arguments, logs, or HTTP responses.

Leaving a key unchanged retains its saved value; replacing and removing it are explicit actions. Changing providers preserves other profiles. Stop the service before saving settings or resetting all provider profiles. Reset retains library data and network preferences. Concurrent settings writes use revision checks; reload after a conflict.

Environment variables override a startup invocation without saving. The native app does not execute a shell, read `.zshrc`, or load the project's `.env`; Finder/Dock starts may not inherit terminal variables. Connection checks inspect model metadata or CLI sign-in without generating content, and do not verify remaining quota.

Default library: macOS `~/Library/Application Support/com.shiqu.desktop/library`, Windows `%APPDATA%\com.shiqu.desktop\library`, Linux `~/.local/share/com.shiqu.desktop/library`. Linux settings normally live under `~/.config/com.shiqu.desktop/`; XDG overrides apply. Switching directories opens another library without moving or merging it.

## Phone and internet access

The native service always provides LAN access. Anyone who can connect shares the bookshelf and generation permissions. Use only a trusted network. The desktop QR code includes the selected access address.

For internet access, install `cloudflared`, stop the service, enable internet access, save, and restart. The app uses a separately installed helper and a free Cloudflare Quick Tunnel; it does not download the helper. A private HTTPS URL and QR code pair the phone with a secure cookie. Pairing and sessions last 12 hours and are revoked when the service stops. Restarting changes the address. Never publish the complete private link.

The tunnel helper runs with isolated configuration and minimal environment, without AI credentials or Cloudflare tokens. Internet failure leaves local/LAN reading available and reports a separate error. The app does not silently expose the library during upgrade. Local, LAN, and internet routes validate their respective hosts and write origins; native credential commands are not HTTP endpoints.

## Library safety

Use the common production maintenance CLI:

```bash
pnpm library:maintain --help
```

Stop services before backup. Upgrades require a verified whole-library backup; the overview shows its path. Restore only into a new directory, then choose it explicitly. Never overwrite an active library or test migrations against personal data. Diagnostics are redacted metadata, not a full backup.

Consolidated libraries require desktop and CLI 0.8.0 or later. Older binaries are incompatible; 0.2–0.7 seed writes are rejected with `BACKUP_APP_TOO_OLD`. Rollback requires the pre-upgrade backup and its matching app restored into a new directory. A single directory cannot be owned by multiple CLI/desktop services concurrently.

## UI development

Use pinned Node 24.22.1, pnpm 11.25.0, and Rust 1.93.0 from the repository toolchain files.

```bash
pnpm install --frozen-lockfile
pnpm desktop:preview
```

Open `http://127.0.0.1:1420` in the in-app browser and reuse the relevant tab. Preview does not prepare resources, bundle Node, or package the app. Native service control and credential writes are unavailable in browser preview.

For an isolated reader-backed preview, run these in separate terminals:

```bash
SHIQU_DATA_DIR=/tmp/shiqu-reader-preview SHIQU_AI_PROVIDER=readonly pnpm dev
SHIQU_DATA_DIR=/tmp/shiqu-reader-preview VITE_DESKTOP_READER_URL=http://127.0.0.1:3000 pnpm desktop:preview
```

The preview reader URL must be a loopback HTTP root URL without credentials, query, or fragment and cannot point to preview itself. Use temporary libraries and isolated settings for write tests. Browser checks cannot prove native system-browser opening, tray behavior, or packaged runtime integrity.

## Local checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm desktop:test
```

Rust formatting: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`. Resource-dependent native tests may require an already prepared runtime. Run `pnpm desktop:smoke` only when those resources already exist or preparation was explicitly requested. It checks isolated copies and never generates paid content.

## Explicit development builds and releases

Only prepare or package when explicitly requested:

```bash
pnpm desktop:dev
pnpm desktop:build
```

Those commands perform resource preparation and are not routine interface verification. Build prerequisites include the platform Tauri dependencies. Windows needs MSVC C++ build tools, WebView2, Rust MSVC x64, and the complete official Node 24.22.1 x64 distribution with LICENSE. Builds require matching host architecture; cross-platform, universal, and musl packaging are unsupported.

Preparation builds the reader/server and desktop UI, copies production dependencies, migrations, source books, bundled Node, licenses, and its integrity manifest. Final signing must not invalidate the recorded Node hash. Installers use `shiqu-standard-*` names under `src-tauri/target/release/bundle/`.

The macOS/Windows release workflow builds on native runners and checks installed runtime resources. `vX.Y.Z` release tags must match package, Tauri, and Cargo versions. The versioned pre-push hook verifies the tagged commit in an isolated worktree with pinned tools; ordinary branch pushes do not run the tag gate. Release operations require separate explicit authorization; local English source changes do not publish an installer.
