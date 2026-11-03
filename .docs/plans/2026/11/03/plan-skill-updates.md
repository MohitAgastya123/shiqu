# 技能升级计划

Git base: `13837181f492bfeda8cf23bd088ea9408bb42b52`
Risk: non-low，涉及正式发布发现、安装内容持久化及跨 CLI/技能版本契约。

CLI 只查询固定 npm registry 的 latest 元数据，不下载或执行远端代码。check 返回分离参数数组，由 Codex 按技能和已保存偏好执行固定版本 CLI 的 update。check 返回 updateCommand 参数数组及 updateCwd，版本仅允许稳定数字版本；路径、范围和命令由本地发现结果计算，registry 不提供执行指令。update 始终写自身包中的技能，版本与运行包一致。状态文件 `.shiqu-skill.json` 保存在技能目录，仅含版本、SHA256 与偏好。registry 查询缓存单独保存在用户缓存目录，不在项目产生每日时间戳 diff。缺失状态且文件相同可认领，否则视为未管理。错误缓存短暂退避，正常缓存 24 小时；显式 --refresh 绕过缓存。自动发现从 cwd 向上至 Git 根，之后全局；显式 project 指当前目录。

- [x] 在 server/cli-skill.ts 实现安装状态、安全路径校验、检查/更新、受限且超时的 registry 读取，保持安装幂等和无书库副作用。
- [x] 在 server/headless-cli.ts 添加 skill check/update 与 --auto-update on|off、--refresh，帮助和结构化结果；测试注入 registry transport/clock 仅用于隔离。
- [x] 更新 skills/shiqu/SKILL.md、README.md、npm/README.md、.docs/user-guide.md 与仅提示词 use-as-skill.md。
- [x] tests/cli-skill.test.mjs 覆盖配套版本更新、缓存离线、偏好、修改拒绝、旧版认领、降级、软链接及嵌套项目发现；运行适用单元集、typecheck、lint，按 E2E 规格验证。

文件替换使用同目录临时文件再 rename；无 force。状态损坏时保守拒绝。自动命令附 --automatic，在执行更新时再次读取已保存偏好，防止检查后关闭偏好仍被自动写入。更新跨两个文件无法事务，崩溃后视为未管理/修改过并停止更新，不覆盖用户内容。并发写使用目录锁并 finally 释放，避免互相覆盖。

## 来源核查与约束

- https://github.com/vercel-labs/skills/blob/main/docs/commands.md ：check 与 update 分离；npm packaged skills 同依赖更新，但 sync 仍为实验功能。
- https://github.com/vercel-labs/skills/blob/main/src/local-lock.ts ：来源、包版本与内容哈希；项目锁文件去除时间戳以减少 diff。
- https://agentskills.io/specification ：版本仅可选 metadata，没有统一的自动升级协议。
- 本项目只管理拾趣自身副本，不写其他管理器 skills-lock.json，不引入实验依赖或迁移插件。当前只有一个 SKILL.md，哈希覆盖全部已分发指令；未来添加资源须扩展为目录哈希。
- 用户指定版本、源码入口或项目锁定版本优先；SKILL 不自动越过版本锁。check 缓存不覆盖技能文件，偏好需显式设置。

AR risk: non-low — 远端版本发现与持久化契约。
AR review round: 2; reviewer: reused
AR passed: no blocking architecture flaws

## 实现与验证证据

- SS milestone: afb26ec7ee40d46f2a92f94d9d07a6fa2cd21548，安装/检查/升级、技能和文档。修复 milestone: 8ee6b79，失败缓存不携带版本且命令目标须重新校验成功状态和完整稳定版本；并行 UI 文档内容已从累计提交中拆出并保留工作区。
- CR risk: non-low — 技能写入、缓存信任、自动更新授权及兼容。
- CR review round: 2; reviewer: reused
- CR fixed: 失败或畸形缓存可能错误授权自动更新的问题已修复；rerun result passed。
- TT: Node 24.22.1 / pnpm 11.25.0，pnpm test 1164/1164，/tmp/shiqu-skill-updates-unit.log。全量启动后新增缓存回归并修复实现，针对最终代码重跑 9/9 技能流程，/tmp/shiqu-skill-updates-e2e.log；其余套件影响不变。
- ET: tests/cli-skill.test.mjs 按 .docs/tests/test-skill-updates.md 的跨命令/子进程场景执行，最终 9/9；隔离 cwd/HOME、模拟可控 registry，正式 executeHeadless/CLI 路径。
- 真实 npm registry 通过正式 check + 临时目录/HOME 验证，latest 0.6.5 / 本地 0.6.6，不建议降级；/tmp/shiqu-skill-updates-registry.log。无下载执行、真实全局技能写入或生成调用。
- pnpm typecheck / pnpm lint 通过，/tmp/shiqu-skill-updates-{typecheck,lint}.log；skill-creator quick_validate 通过；提示词指南 39 段，仅标题与 text 提示，无 CLI/pnpm/JSON；38 个本地文档链接有效；git diff --check 通过。
- 未运行桌面/Docker 构建，未打包发布或推送。发布后的真实跨 npm 版本安装暂不能验证，隔离旧/新 bundle 完成配套升级路径。
