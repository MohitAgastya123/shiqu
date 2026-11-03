# 技能升级计划

Git base: `13837181f492bfeda8cf23bd088ea9408bb42b52`
Risk: non-low，涉及正式发布发现、安装内容持久化及跨 CLI/技能版本契约。

CLI 只查询固定 npm registry 的 latest 元数据，不下载或执行远端代码。check 返回分离参数数组，由 Codex 按技能和已保存偏好执行固定版本 CLI 的 update。check 返回 updateCommand 参数数组及 updateCwd，版本仅允许稳定数字版本；路径、范围和命令由本地发现结果计算，registry 不提供执行指令。update 始终写自身包中的技能，版本与运行包一致。状态文件 `.shiqu-skill.json` 保存在技能目录，仅含版本、SHA256 与偏好。registry 查询缓存单独保存在用户缓存目录，不在项目产生每日时间戳 diff。缺失状态且文件相同可认领，否则视为未管理。错误缓存短暂退避，正常缓存 24 小时；显式 --refresh 绕过缓存。自动发现从 cwd 向上至 Git 根，之后全局；显式 project 指当前目录。

- [x] 在 server/cli-skill.ts 实现安装状态、安全路径校验、检查/更新、受限且超时的 registry 读取，保持安装幂等和无书库副作用。
- [x] 在 server/headless-cli.ts 添加 skill check/update 与 --auto-update on|off、--refresh，帮助和结构化结果；测试注入 registry transport/clock 仅用于隔离。
- [x] 更新 skills/shiqu/SKILL.md、README.md、npm/README.md、.docs/user-guide.md 与仅提示词 use-as-skill.md。
- [ ] tests/cli-skill.test.mjs 覆盖配套版本更新、缓存离线、偏好、修改拒绝、旧版认领、降级、软链接及嵌套项目发现；运行适用单元集、typecheck、lint，按 E2E 规格验证。

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
