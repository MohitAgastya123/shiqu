---
name: shiqu
description: 使用拾趣 CLI 从本地书籍选题、制作或编辑图文故事，预览与导出作品，并备份、恢复或诊断拾趣书库。适用于明确使用拾趣的任务。
---

# 拾趣 CLI

用 CLI 操作拾趣的正式生产流程。带子命令时无需启动 HTTP 服务、桌面或前端；不带子命令会启动浏览器服务。

先运行 `npx @apprun/shiqu help --json`，读取 appVersion、命令、输入示例与停止边界。项目锁定包版本、用户指定版本或源码入口优先，沿用其入口，不自动越过版本锁。不要猜测参数，查对应版本的 help。命令返回单个 JSON 信封，检查 `ok` 和 `error.code`，不要把进程退出视为故事已经完成。

## 版本检查与更新

- 每次启用技能，用上述入口执行 `skill check`。它自动发现当前项目祖先目录（截至 Git 根）或全局安装；确认返回的 path 是本次加载的技能。若同名副本并存而发现结果不匹配，明确指定 `--scope project|global` 和安装根目录，不更新其他副本。查询缓存 24 小时，用户要求立即检查时加 `--refresh`。离线、旧 CLI 不支持检查或检查失败时简短说明，沿用可用版本继续原任务，不循环重试。
- 默认只报告新版。仅用户明确要求开启/关闭自动更新时，执行 `skill check --auto-update on|off`（必要时指定范围）；不要从一次故事任务推断自动更新授权。
- 无版本锁且 `autoUpdateReady` 为 true 时，以返回的 updateCwd 为工作目录执行 updateCommand 参数数组；它固定 npm 正式发布版本并带 `--automatic`，更新时会再次检查偏好。本地修改或未知来源副本不自动覆盖。用户明确要求单次更新但未开启自动更新时，也可执行返回的 updateCommand。
- 更新成功后重新读取返回 path 的技能，用返回 version 对应的 `npx @apprun/shiqu@<version> help --json`，后续任务沿用该固定版本。未更新时，已管理副本优先用 check 返回的 installedVersion 对应 CLI；自定义副本或源码入口沿用用户选择并核对兼容性。更新失败保留现状，不手工覆盖或删除状态以绕过保护。
- `skill update --scope project|global` 只安装正在运行的 CLI 包自带技能，不自行寻找最新包。安装记录缺失时，仅与运行包正文完全相同的旧副本可用该版本 `skill install` 建立记录；不同内容需人工比较合并。检查/更新不操作书库或生成配置。

## 建库与选题

1. 按用户指定书库传 `--data-dir <directory>`；否则使用拾趣已保存的位置或默认书库。首次访问时自动建立数据库，与桌面/服务共用开库和迁移逻辑；直接用 `status`、`stories list` 或 `stories create` 即可，无需先运行 `init`。如需显式提前建库，用 `init --data-dir <directory>`，目录下保存 `shiqu.sqlite` 和媒体。该参数不更改已保存的默认书库，后续继续传相同目录或使用 `SHIQU_DATA_DIR`；不配置模型。
2. 用 `books`、`themes`、`styles` 查目录，`books contents <bookId>` 查本地章节。将选书、主题、画风、制作/验收要求保存为 JSON，`stories create --input <file> --request-id <UUID>`。默认创建选题流程。
3. `stories get <id>` 读取 `intake.generation`；`stories search <id> --generation <n>` 保存提取意图，`run <id> --until candidates` 执行；根据用户目标选择候选，用 `stories choose <id> --batch <n> --index <n> --generation <当前代数>`。
4. `run <id> --until prepared` 准备摘要、原文和制作建议。检查返回内容，按用户授权确认或调整，`stories confirm <id> --generation <当前代数>` 保存确认。缺少影响制作结果的用户选择时再询问。

## 制作与编辑

- 保存动作不调用模型；只有显式 `run <id>` 执行生产任务，可能产生提供方费用。`--until reviewed` 在审核通过后、生图前停下；默认完成整篇。`--timeout <seconds>` 限制执行时间。
- search/choose/confirm/setup 必须携带读取时的 generation；同一请求重放沿用原代数，不能重新取当前值。跨步骤先重新读取。

- `frame_count_required` 表示旧故事等待画幅确认，按 help 的 frameCount 输入保存后继续；`already_prepared` / `already_selected` 表示阶段已越过，改用下一步，不能循环同一停止边界。
- 每次检查 `reason` 和 `session`：需要选择/确认时完成对应动作；暂停保持暂停；失败先读 `stories get <id>` 的 faults，不要循环重试。只有用户授权恢复时，针对当前 `faultId` 用 `stories retry`；审核越过需要明确的 override 意图。
- 修改已制作故事：先 `stories revisions <id>` 读取 `token`，再提交 `{ "token": "...", "changes": { ... } }` 给 `stories edit <id> --input <file> --request-id <UUID>`。沿用同一 requestId 和同一输入（generation/token/faultId）重放，避免重复建版。发生 CONFLICT 时重新读取状态，不自动换 requestId 掩盖冲突。
- 编辑和重选会创建版本；后续操作使用返回的新 id，或 `stories current <id>` 查当前版本。旧版不可继续制作或完整导出。
- `stories prompts`、`stories review-history`、`stories source` 可检查已保存依据。`api` 只开放持久化/观察白名单，不能绕过 run 发起推理。按 help 使用其现有协议。

## 预览、导出与维护

- `preview <id> --output <new.html>` 输出独立离线页面，直接向用户提供文件路径，无需服务器。
- `export <id> --format zip|pdf|png|json|md --output <new-file>`。完整图片格式要求当前故事已完成、全部图片可读。JSON/Markdown 可检查中间稿。ZIP 默认公开格式；只有用户需要内部制作记录时用 `--include-prompts`。
- 使用用户的署名；未提供署名时先说明，只有明确选择不署名才传 `--allow-unsigned`。不要伪造作者或跳过缺图。输出不覆盖已有文件，导出不代表授权 Git 提交或发布。
- `backup <new-directory>` 创建私有完整书库快照，`verify-backup <directory>` 验证；`restore <backup> --data-dir <new-directory>` 只恢复到新位置，不覆盖原库、不自动切换默认位置。服务占用书库时先停止。
- `diagnostics --output <new.json>` 导出脱敏诊断。书库备份与故事公开 ZIP 用途不同，不向公开作品目录保存私有备份。
- 生成使用现有配置；若未配置，用 `config` 的当前帮助指导用户。密钥只通过 JSON 文件/stdin 或已有环境传入，不能写入 argv、对话或结果。不要自行切换提供方或计费方式。
