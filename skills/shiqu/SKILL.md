---
name: shiqu
description: 使用拾趣 CLI 从本地书籍选题、制作或编辑图文故事，预览与导出作品，并备份、恢复或诊断拾趣书库。适用于明确使用拾趣的任务。
---

# 拾趣 CLI

用 CLI 操作拾趣的正式生产流程。带子命令时无需启动 HTTP 服务、桌面或前端；不带子命令会启动浏览器服务。

先运行 `npx @apprun/shiqu help --json`，读取当前版本命令、输入示例与停止边界。使用随本技能安装的 CLI 版本；可固定为 `npx @apprun/shiqu@<version>`。项目若已锁定包版本，沿用其包管理器入口。不要猜测参数，查当前 help。命令返回单个 JSON 信封，检查 `ok` 和 `error.code`，不要把进程退出视为故事已经完成。

## 建库与选题

1. 按用户指定书库传 `--data-dir <directory>`；否则使用拾趣已保存的位置。`status` 检查，缺库时用 `init`。初始化不配置模型。
2. 用 `books`、`themes`、`styles` 查目录，`books contents <bookId>` 查本地章节。将选书、主题、画风、制作/验收要求保存为 JSON，`stories create --input <file> --request-id <UUID>`。默认创建选题流程。
3. `stories search <id>` 保存提取意图，`run <id> --until candidates` 执行；根据用户目标选择候选，用 `stories choose <id> --batch <n> --index <n>`。
4. `run <id> --until prepared` 准备摘要、原文和制作建议。检查返回内容，按用户授权确认或调整，`stories confirm <id>` 保存确认。缺少影响制作结果的用户选择时再询问。

## 制作与编辑

- 保存动作不调用模型；只有显式 `run <id>` 执行生产任务，可能产生提供方费用。`--until reviewed` 在审核通过后、生图前停下；默认完成整篇。`--timeout <seconds>` 限制执行时间。
- 每次检查 `reason` 和 `session`：需要选择/确认时完成对应动作；暂停保持暂停；失败先读 `stories get <id>` 的 faults，不要循环重试。只有用户授权恢复时，针对当前 `faultId` 用 `stories retry`；审核越过需要明确的 override 意图。
- 修改已制作故事：先 `stories revisions <id>` 读取 `token`，再提交 `{ "token": "...", "changes": { ... } }` 给 `stories edit <id> --input <file> --request-id <UUID>`。沿用同一 requestId 和同一输入重放，避免重复建版。发生 CONFLICT 时重新读取状态，不自动换 requestId 掩盖冲突。
- 编辑和重选会创建版本；后续操作使用返回的新 id，或 `stories current <id>` 查当前版本。旧版不可继续制作或完整导出。
- `stories prompts`、`stories review-history`、`stories source` 可检查已保存依据。`api` 只开放持久化/观察白名单，不能绕过 run 发起推理。按 help 使用其现有协议。

## 预览、导出与维护

- `preview <id> --output <new.html>` 输出独立离线页面，直接向用户提供文件路径，无需服务器。
- `export <id> --format zip|pdf|png|json|md --output <new-file>`。完整图片格式要求当前故事已完成、全部图片可读。JSON/Markdown 可检查中间稿。ZIP 默认公开格式；只有用户需要内部制作记录时用 `--include-prompts`。
- 使用用户的署名；未提供署名时先说明，只有明确选择不署名才传 `--allow-unsigned`。不要伪造作者或跳过缺图。输出不覆盖已有文件，导出不代表授权 Git 提交或发布。
- `backup <new-directory>` 创建私有完整书库快照，`verify-backup <directory>` 验证；`restore <backup> --data-dir <new-directory>` 只恢复到新位置，不覆盖原库、不自动切换默认位置。服务占用书库时先停止。
- `diagnostics --output <new.json>` 导出脱敏诊断。书库备份与故事公开 ZIP 用途不同，不向公开作品目录保存私有备份。
- 生成使用现有配置；若未配置，用 `config` 的当前帮助指导用户。密钥只通过 JSON 文件/stdin 或已有环境传入，不能写入 argv、对话或结果。不要自行切换提供方或计费方式。
