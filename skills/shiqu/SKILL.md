---
name: shiqu
description: 根据拾趣的数据契约与业务规则，自主编写任务程序，完成故事选题、制作、编辑、书库分析和批量整理，并预览、导出或维护作品。适用于明确使用拾趣的任务。
---

# 拾趣任务契约

根据用户目标和已保存状态决定操作，自主编写并运行本次任务需要的程序。筛选、分组、比较、报告和批量调度由你实现，不必为每种任务寻找专用命令；简单任务可以直接调用现有操作。

程序通过拾趣现有生产入口读取、保存和执行，不重写状态机、模型调用、审核、版本管理、媒体编码或导出逻辑，不直接改 SQLite 或媒体文件。当前公开入口是 CLI 子命令；没有公开 SDK，不依赖 npm 缓存路径或未导出的内部模块。无需启动 HTTP 服务、桌面或前端；不带子命令会启动浏览器服务。

## 执行环境与协议

- 使用 Node 24。源码项目沿用 `pnpm cli`，已安装命令沿用 `shiqu`，其他环境可用 `pnpm dlx @apprun/shiqu`。用户指定入口、版本或项目版本锁优先。先读取该入口的 `help --json`，核对 appVersion、当前输入与可用操作；下面是稳定语义，不是完整输入 Schema。
- 所有书库操作使用同一绝对路径：显式 `--data-dir` 优先，其次 `SHIQU_DATA_DIR`、已保存位置和默认书库。首次访问自动建库并迁移，无需先 init；不因此更改默认位置或模型配置。书库被其他服务占用时报告占用，不绕过锁。
- 自主程序使用进程 API 的可执行文件与参数数组，JSON 经 `--input -` 的 stdin 或私有文件传入；不要把标题、路径、原文、提示词拼接成 shell 命令。沿用入口及其工作目录，处理 stdout 与 stderr，设置有限超时。同一书库的 CLI 调用串行执行，避免独占开库冲突。
- 子命令 stdout 为一个 JSON 信封：成功 `{schemaVersion:1,ok:true,data:...}`，失败 `{schemaVersion:1,ok:false,error:{code,message,details?}}`；日志在 stderr。检查退出码、信封及业务结果。`skill show` 默认是 Markdown，带 `--json` 才是信封。不要把非零退出的 JSON 丢弃，也不要把退出码 0 或 `ok:true` 当作故事完成。
- 继续使用已保存的提供方与模型；缺配置时查当前 `config` 帮助。密钥仅经已有环境、私有 JSON 文件或 stdin 传入，不进入 argv、对话、报告或日志；不自行切换提供方或计费方式。

## 数据契约

以当前版本实际返回为准；缺失的可选字段表示未提供，不补造。读取结果和操作输入是不同结构，不把整个读取对象直接回写。

| 对象 | 字段与含义 |
| --- | --- |
| 制作选择 `selection` | `bookId`、`theme`；`artStyle` 使用目录中的 id；`narrativeDetail` 为 `brief\|balanced\|detailed`，表示详略而非固定幅数；`productionPrompt` 为制作要求，`acceptancePrompt` 为验收要求；`length` 默认 `auto`，固定数量范围查当前协议。`storyTitle` 是选中的源故事，`displayTitle` 是独立显示名，改显示名用 rename。 |
| 本地来源 `source` | `{edition,sectionId,firstUnit,lastUnit,continuations?}`；`edition` 是版本哈希，续段包含章节和起止单元。引用目录或候选返回的真实范围，不能按标题或摘要猜造。 |
| 故事快照 `session` | `id` 是版本 UUID；`selection`、`state`、`generationControl`、`intake?`、`revision?`、`superseded?`、`faults?`、`story`。`state` 为 `idle\|running\|failed\|completed`，`generationControl` 为 `active\|paused\|stopped`，两者分别检查。`stage` 是展示文案，逻辑判断使用结构化字段。 |
| 生产进度 | `generationProgress?` 含 `phase`、`frameCount`、`storyboardFrames?`、`reviewStatus?` 等；`productionState?` 为 `running\|queued\|paused`。正文为 null 时仍可能已有部分分镜，结合进度区分“未编排”和“编排中”；未知数量不当作 0。 |
| 选题 `intake` | `phase` 为 `discovering\|choosing\|preparing\|confirming\|confirmed`；`generation` 是动作的并发前提；`batches[].stories[]` 是已保存候选，`selected` 为 `{batch,index}`，两者从 0 开始；`draft` 是制作设置；`search.state/error` 表示提取状态。 |
| 故事正文 `story` | 编排未完成时可为 null；已有正文含 `title`、`pages[]`、`sourceText`、`original?`、`sourceReference`、`publication?`。每幅含 `caption`、`prompt`、`image`；空 image 表示缺图，非空地址仍可能不可读。`ready` 不是媒体完整性证明。书架 list 省略 original 并清空 sourceText，要查看原文需 get/source，不能据 list 判定原文丢失。 |
| 版本 | `stories current` 返回该家族当前快照；`revision` 包含 `parentId/rootId/number`。编辑前读取 `stories revisions` 返回的 `token`，输入为 `{token,changes}`；不根据时间或标题猜当前版本。 |
| 故障 | `faults[]` 含 `id`、`message`、`page`、`stage`、`state`、`retryAllowed`；恢复输入 `faultId` 取其 id。`run` 返回 `{reason,session}`，reason 表示本次停止原因。 |

## 业务规则

- 原文、候选、摘要、分镜、图片和审核历史以保存结果为依据。自由生成的内容用于分析或建议；正式故事的生成、审核和修订通过同一生产实现执行，不另建一条模型流水线或伪造完成记录。
- 保存意图不调用模型，只有显式 `run` 推进生产，可能产生费用。用户只要求查看、整理、比较、预览或导出时，不运行生产。用户要求的候选、方案确认和生图前检查点必须保留；已有授权足够时继续，缺少影响结果的选择时再询问。
- 创建、选题动作、编辑、控制和恢复等支持 requestId 的操作，发出前保存 UUID 与原始输入。重放沿用同一 requestId 及原 generation/token/faultId，不能重新取当前值。跨步骤重新读取状态；新动作使用新 UUID。CONFLICT 时停止该项并重新读取，不通过换 requestId 自动重试原动作来掩盖冲突。
- search/choose/confirm/setup 携带读取时的 `intake.generation`。编辑和重选会创建版本，后续使用操作返回的新 id 或 current 返回的 id；旧版不能继续制作或完整导出。
- 暂停保持暂停，失败先检查 faults 和已保存依据。恢复必须有用户授权，且针对当前 faultId；审核越过需要明确 override 意图，不能把越过说成审核通过。超时或中断后先读取保存状态，不循环重跑。
- 批量程序逐项记录目标 id、请求身份、结果和停止原因；遇到需要用户决定、冲突、暂停或故障时停止该项。其他独立项仅在原授权内继续；报告成功、失败、跳过和未处理项，不能把部分完成称为全部完成。

## 可用操作与停止条件

按任务和当前快照组合操作，不机械执行整条流程。具体参数、可编辑字段和输入示例查同版本 help；`api` 仅提供已有持久化/观察白名单，不是任意 HTTP 或推理入口。

| 目的 | 生产入口与判断 |
| --- | --- |
| 发现数据 | `books/themes/styles` 查目录，`books contents` 查章节；`stories list/get/current` 查书库与当前版本；`source/prompts/review-history/revisions` 查保存依据。 |
| 新建或选题 | `stories create` 接收 selection 或 `{selection,intake:true}`，默认进入选题；search 保存提取意图，choose 保存候选索引，confirm 保存制作确认，setup 保存其他选题动作。它们不执行生成。 |
| 执行生产 | `run <id> --until candidates\|prepared\|reviewed\|completed`。candidates 后按用户目标选择或等待；prepared 后检查原文、摘要和方案并确认；reviewed 在审核通过且生图前停止；默认 completed。每次检查返回 reason 和 session，不假定达到了请求边界。 |
| 解释停止原因 | `choice` 需选题；`frame_count_required` 是旧故事等待幅数确认，按 help 的 frameCount 输入处理；`already_prepared/already_selected` 表示已越过该边界，改用下一步；`paused` 保持暂停，`blocked` 检查故障，`superseded` 查当前版本。不能在同一停止边界空转。 |
| 修改与控制 | `stories edit` 使用 token/changes 创建新版；rename 仅改显示名。pause/resume/stop 控制制作；retry/override 针对当前故障。reselect/replace/cancel-reselection 按现有草稿协议处理。 |
| 追加后续原文 | 已完成的本地故事可用 `stories edit` 提交 `changes.appendSource`（同版本且严格位于旧范围之后的真实引用）及完整 `changes.plan`。保留全部旧 pages，再追加新分镜；可更新标题、摘要、改编说明和结语，出处由服务端核定。characters 保持原文或在两个换行后追加续篇阶段说明，不重写旧设定；画风和制作设置保持不变。旧图须全部可读，自动修订不能改动受保护前段。随后 `run` 使用正常审核和绘图。普通编辑仍不能直接增删分镜。 |
| 预览与交付 | preview 输出独立离线 HTML；export 支持 zip/pdf/png/json/md，使用共享序列化、图片编码、水印和元数据规则。自主程序可组织导出清单，不能自己重建作品包。 |
| 维护 | backup 创建完整私有快照，verify-backup 验证；restore 仅恢复到新的 data-dir，不覆盖原库或自动切换默认位置。diagnostics 输出脱敏诊断；它与私有完整备份用途不同。 |

## 验收与交付

- 整理报告：说明使用的书库、筛选范围与当前版本；缺图数量来自实际 pages，尚无分镜时报告“未编排”，部分分镜报告“编排中”，不当作 0 幅完成。分析字段不全时补读 get/current/source，仍缺失则标注未知。
- 制作完成：重新读取当前版本，核对状态、审核/故障与所有预期画幅。完整 ZIP/PDF/PNG 还必须由现有导出入口验证图片全部可读；不因有 image 地址就宣称可完整导出。预览和 JSON/Markdown 可以交付中间稿，明确未完成部分。
- 公开 ZIP 默认只含 `故事.json`、`分镜.md`、`署名与转载.txt` 和 `图片/` 下编号 WebP。保留已保存原文、来源、作者与 AI 披露；不包含内部提示词，只有用户明确需要内部记录时使用 `--include-prompts`。
- 使用用户署名；未提供时说明，只有明确选择不署名才用 `--allow-unsigned`。不伪造作者、不跳过缺图、不改用旧版。产物放在私有书库和应用静态目录之外；普通导出写新路径，不覆盖已有文件。项目若有专用导出约定，沿用其生产导出脚本。
- 交付实际文件路径和已核实结果；报告未完成项及原因，不承诺尚未验证的生成或媒体完整性。临时程序和私有输入保存在临时目录，清理本次临时输入；保留用户要求的报告和作品。导出、整理或备份不代表授权 Git 提交、推送或发布；不把私有备份存到公开作品目录。

## 版本检查与更新

- 每次启用技能，用上述入口执行 `skill check`。它自动发现当前项目祖先目录（截至 Git 根）或全局安装；确认返回的 path 是本次加载的技能。返回 `not_installed` 时，说明未发现安装副本，沿用已读取的正文和当前入口，不为原任务隐式安装技能。若同名副本并存而发现结果不匹配，明确指定 `--scope project|global` 和安装根目录，不更新其他副本。查询缓存 24 小时，用户要求立即检查时加 `--refresh`。离线、旧 CLI 不支持检查或检查失败时简短说明，沿用可用版本继续原任务，不循环重试。
- 默认只报告新版。仅用户明确要求开启/关闭自动更新时，执行 `skill check --auto-update on|off`（必要时指定范围）；不要从一次故事任务推断自动更新授权。
- 无版本锁且 `autoUpdateReady` 为 true 时，以返回的 updateCwd 为工作目录执行 updateCommand 参数数组；它固定 npm 正式发布版本并带 `--automatic`，更新时会再次检查偏好。本地修改或未知来源副本不自动覆盖。用户明确要求单次更新但未开启自动更新时，也可执行返回的 updateCommand。
- 更新成功后重新读取返回 path 的技能，用返回 version 对应的 `pnpm dlx @apprun/shiqu@<version> help --json`，后续任务沿用该固定版本。未更新且无用户/项目版本锁、非源码入口时，已管理副本优先用 check 返回的 installedVersion 对应 CLI；自定义副本或源码入口沿用用户选择并核对兼容性。更新失败保留现状，不手工覆盖或删除状态以绕过保护。
- `skill update --scope project|global` 只安装正在运行的 CLI 包自带技能，不自行寻找最新包。安装记录缺失时，仅与运行包正文完全相同的旧副本可用该版本 `skill install` 建立记录；不同内容需人工比较合并。检查/更新不操作书库或生成配置。
