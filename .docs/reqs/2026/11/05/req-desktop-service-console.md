# Desktop app as a service console

The desktop app has grown three tabs (概览, 生成队列, 设置). Reading and authoring already happen only in the browser, and the browser now covers the shelf, the production region and loopback-only provider settings. The desktop still repeats both: its queue and library glance read the library through a separate native query of the story documents (including a tombstone write path), and its provider form duplicates the browser form for the same shared settings database. Every change to story states or provider options must be made twice, and the two copies drift.

Reduce the desktop app to running and exposing the local service. Story browsing, queue management and generation provider/model setup move to the browser frontend for desktop users as well.

## Outcome

A desktop user installs the app, starts the service without configuring anything first, opens the browser, and does all story work and generation setup there. The desktop window only answers "is the service running, where is my data, how do I open it on this computer or my phone", plus the few local paths a browser must not set.

## Acceptance criteria

### Desktop console scope

- [ ] The desktop window is a single console view with no tabs. It shows: service state (running / stopped / starting / upgrading library / failed / unknown), start, stop and restart, open in browser, built-in runtime status, story data directory, service port, phone access (LAN QR, optional internet access with cloudflared path), Codex executable path and Codex login directory, and quit.
- [ ] The desktop window no longer shows a generation queue, library statistics, recent stories, story delete/undo, or any generation provider, model, reasoning or API key field.
- [ ] The desktop no longer reads or writes story records itself: the native library summary and story tombstone paths, and the browser-preview stand-in that served them, are removed. The native refusal of a newer-schema or unknown-journal library before any ownership write stays.
- [ ] The console shows the generation provider and text/image models as read-only text: the running configuration while the service runs, and the saved configuration, labelled as saved, while it is stopped ("只读" / "未配置生成服务" when applicable). An action opens the local browser directly at the generation settings screen through one fixed deep link; no other path, query or fragment becomes openable.
- [ ] Data directory, port, internet access, cloudflared path, Codex executable path and Codex login directory stay native-only, keep the native file picker, and keep their existing validation, stop-before-change rule and save behavior.

### Library upgrade and startup

- [ ] Starting the service runs any required library upgrade or pending-journal recovery to completion before the service accesses the library. Startup timeouts do not interrupt it, and the console shows the upgrading state while it runs.
- [ ] A successful upgrade shows its verified backup path in the console. A failed upgrade or recovery shows a safe message that includes the backup path when one exists. Covered by an automated test with an isolated legacy library.
- [ ] On a fresh install with no provider configured, the user can start the service from the console without visiting any settings first. The library opens and reading works; a browser on the computer running the service shows that generation needs setup and links to the settings screen, while LAN/internet browsers are told to configure it on the computer running the service.
- [ ] Generation actions attempted while no provider is configured fail with a clear "configure a generation service" message and do not create half-started productions.
- [ ] Existing installs with a configured provider start and generate exactly as before, using the saved provider, models, reasoning, Codex paths and keys. Environment overrides (`SHIQU_AI_PROVIDER`, `SHIQU_IMAGE_PROVIDER`, keys, models, Codex options, reasoning) keep their current precedence for a desktop-started service.

### Generation settings in the browser

- [ ] When the desktop app runs the service, a browser on the same computer can open 我的 → 生成服务与模型 and load/save provider, image provider, provider-specific models, Codex model and reasoning, and per-task reasoning, with the same fields and behavior already shipped for dev/CLI browser mode. Codex paths are not editable there.
- [ ] In desktop mode the browser settings screen, connection check and reset operate on exactly the settings database the console reads at start, regardless of the platform's configuration-directory overrides. If that database is missing or unreadable they report a safe failure and never create a new store.
- [ ] API keys support keep/replace/remove from the browser. Saved keys are never returned over HTTP, written to logs, or shown in the DOM; the screen shows presence only.
- [ ] The browser screen can run a connection check of the saved configuration with invocation overrides applied: API model metadata only, or Codex login status, with no content generation and no unsaved draft values.
- [ ] The browser screen can reset all provider configuration after confirmation, preserving library location, network settings, Codex paths, stories and reading progress.
- [ ] Restart-needed is true exactly when the saved configuration plus invocation overrides, including key changes, differs from what the running service started with. The browser screen and the console agree on it, and the browser lists active override names (never values) as in dev/CLI mode.
- [ ] The console restarts the service in one action. When productions are generating, it asks for confirmation first and states that they stop and can be resumed from the browser. Saving settings never restarts or interrupts generation by itself.
- [ ] Concurrent edits are either merged or rejected as stale, never silently overwritten: a browser provider save and a native console save each keep the other's fields, and a save based on an outdated revision fails with a message telling the user to reload.

### Access boundaries

- [ ] Generation settings read/write, connection check and reset are available only to a browser on the computer running the service at the loopback address: real loopback peers, loopback Host, same-origin mutations. LAN devices, the same computer using its LAN address, cross-site pages, spoofed forwarding headers and normalized path variants are denied.
- [ ] Requests arriving through the internet tunnel are denied even though the tunnel reaches the service through a loopback socket.
- [ ] LAN and internet browsers keep reading and generating as today and show no generation settings entry.
- [ ] No HTTP route can set or run an executable path, the data directory, port, network settings, runtime, start/stop or quit.

### Compatibility and documentation

- [ ] The shared settings database format is unchanged; CLI, skill, dev and older 0.8.x desktop builds keep reading and writing it. No story schema or migration change.
- [ ] User-visible text that points desktop users to "桌面设置" for generation settings, or says keys are never sent over HTTP, is updated. Desktop README and user guide describe the console-only desktop and the browser settings path, including that keys are submitted over loopback HTTP in desktop mode. If any CLI command, input or behavior changes, `skills/shiqu/SKILL.md` and its examples are updated in the same change.
- [ ] Verification uses isolated settings, homes and libraries; no real keys, live inference or the user's library. Desktop UI is verified in the in-app browser via `pnpm desktop:preview`; first-run start, upgrade-before-start, settings-store identity and access boundaries are covered by automated Rust/Node tests. Native packaging is not run unless explicitly requested.

## Constraints

- Reuse the existing shared settings store, provider resolver, browser settings screen and access checks; no second settings store or form.
- Keys remain stored as today (plain text protected by OS file permissions); this change only alters which screen submits them.
- Desktop-started services keep their startup configuration snapshot until restarted; no hot reload of providers.

## Non-goals

- Changing the browser shelf, production region or story workflow beyond the first-run setup prompt.
- Exposing generation settings to LAN or internet devices, or adding multi-user isolation.
- Editing executable or directory paths from the browser.
- New providers, new settings fields, or encrypted key storage.
- Changing CLI startup, packaging, release workflow or tray behavior (tray item wording may change).

## Blocking questions

None. Decisions taken: the console keeps a read-only provider summary, Codex paths and a restart action; reset and connection check move to the browser rather than being dropped.
