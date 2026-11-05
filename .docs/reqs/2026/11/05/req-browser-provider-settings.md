# Browser provider and model settings

Desktop and CLI already share provider settings, but browser users cannot manage them without returning to native settings or a terminal. Add a local-computer settings screen to development and CLI browser mode using the same private settings database.

## Acceptance criteria

- [x] Under 我的 → 生成服务与模型, local dev and CLI browser users can load/save provider (Gemini/OpenAI/Codex/readonly), provider-specific text/image models, Codex request reasoning and per-task reasoning. Provider switching preserves other profiles.
- [x] Saved API keys are never returned to HTTP, logs or the DOM. API credentials support keep/replace/remove; input is cleared after successful save/provider switch. UI shows presence only. Mutations are strict provider-only patches with required revision checking, safe errors and transactional writes, preserving unrelated desktop/library/network settings.
- [x] Show actual running provider/models/reasoning separately from saved values, identify invocation overrides by name without their secret values, and clearly report restart requirements. Saving does not restart services or generate content; active generation continues with its startup configuration.
- [x] Settings reads/writes are limited to real loopback peers with loopback Host and same-origin mutations. Cross-site requests, LAN peers, and spoofed forwarded headers are denied, including LAN requests proxied through Vite and normalized path variants. Existing LAN reading remains available. Native desktop/public remote reader routes do not gain a credential API.
- [x] Production startup paths use the API: both actual pnpm dev and browser CLI expose it. Desktop/CLI/skill saved settings remain compatible. Fully explicit CLI startup still bypasses corrupt saved settings; opening a broken settings store reports a safe failure without breaking the reader.
- [x] Verify with isolated settings/homes/libraries, actual dev/CLI processes, API access-boundary tests and the in-app browser; no real key changes, live inference, user-library access, native/Docker packaging or schema changes.

## Scope

Use the existing settings store, provider resolver, model/reasoning contracts and reader sheet UI. No alternate config store, auto-apply/hot reload, provider connection tests, arbitrary file/runtime/library/network editing, or new provider support. Existing environment/config invocation precedence stays intact. Native settings remain available for their existing wider system controls.
