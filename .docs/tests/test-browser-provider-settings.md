# Browser provider settings E2E

1. Isolated actual pnpm dev: save fake Google provider/key/models/reasoning, open 我的 → 生成服务与模型, verify saved and running sections. Change saved model/reasoning; save/reload shows persistence and restart required while /api/reader/status remains on old running model. Restart fixture and verify runtime uses new settings.
2. Provider profiles/key handling: switch Google/OpenAI/Codex/readonly, preserve inactive models, use password input for a new fake key, save clears input, reads never return the key. Keep and remove actions behave explicitly. No inference or connection test runs.
3. Concurrent edit: modify the saved revision through the fixture's production store, submit stale UI, verify safe conflict and preserved draft, reload latest then save. Invalid model/effort/unrelated field requests do not mutate settings.
4. Actual CLI browser mode: settings API reads/writes the same saved store, uses startup/runtime status, preserves normal explicit overrides and full explicit corrupt-store startup compatibility. A CLI/skill config read sees browser-saved values after the browser stops.
5. Access boundary: fake socket contexts and real listeners verify remote peers/foreign or LAN Host/cross-origin/forwarded-header spoof requests are denied. Vite guard checks original remote peers before proxy including normalized dot-path variants; LAN reader requests still succeed. Development settings require private proxy proof, so a legacy/unguarded Vite proxy and direct internal API-port access fail closed; CLI loopback settings remain available. The nonce is absent from responses. Native desktop/generic app settings route is unavailable.
6. In-app browser: inspect desktop and narrow layouts, dialog focus/close, visible status, validation feedback, save/reload and cleared fake credential input. Use only an isolated fixture; stop and remove it after verification.

## 独立图片密钥切换回归

- 自动化状态回归与正式保存处理器：`tests/browser-provider-settings.test.mjs` 随 `pnpm test` 执行。覆盖 Gemini/OpenAI 的替换与移除草稿、切换文本服务后合并为共用密钥、切回时不恢复已清空草稿，以及独立图片服务未变时保留操作。旧请求须返回 400 且配置不变，清理后的请求须保存成功且不误改已存密钥。
- 浏览器验收步骤（需要单独执行，不由以上处理器测试代替）：在隔离配置中保存两个假 API 密钥，选择不同文本/图片服务，分别输入新的图片假密钥或选择移除，再把文本切到图片服务。图片密钥字段应隐藏，保存应成功；切回独立服务时应处于保留状态且没有旧输入。Gemini/OpenAI 双向重复，并检查切到只读、返回、放弃、关闭后重开。
- 已保存配置的连接检查不提交草稿，不属于本次保存阻塞修复的复现范围；测试不调用真实模型或付费服务。
