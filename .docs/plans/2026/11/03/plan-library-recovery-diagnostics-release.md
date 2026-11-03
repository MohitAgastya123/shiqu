# 实现计划

## !! 范围修订：完整无服务 CLI

先前 AR 仅覆盖维护功能，不作为本次扩展的通过依据。REQ R9–R17 与下列任务/规格为新的审核输入。

- 命令解析在 `runCli` 的默认服务分支前路由。无命令不变；headless 使用共享 `createApplication`/`createReaderApi` 的进程内 Request，不监听 HTTP。CLI 命令目录说明各动作、JSON输入与副作用，通用 `api METHOD route` 只白名单开放 reader 持久化/观察动作。直接 suggestions/art-recommendation/advance、历史admin推理及未知路由拒绝为 EXECUTION_REQUIRED；目录/API参数输入同生产校验，生成由显式scoped run推进。
- Coordinator 新增真正的 dormant 模式（无 timer/wake），动作与执行解耦。显式 run 才启用，所有候选/执行门再次限定 target session；已存在其他背景制作不得派发。选题以受限 demand/heartbeat 运行，停止后清需求；审核边界阻止派发图片，超时/信号先停派发再中断/保存并退出。
- 读/维护/导出用只读 provider，不执行 readiness 云端调用；需要生成的命令读取共用配置（不输出密钥），复用当前 provider/queue/engine。默认保存目录只读解析，init 显式创建，不调用配置问答。
- 通过可注入图片读取、canvas/decode/encode、fontsReady 提取 ZIP/PDF/PNG 共享核心；浏览器 wrapper 与原生 canvas adapter 只负责环境IO。拟采用 `@napi-rs/canvas`；先隔离探针确认 Node24 WebP、中文署名、图片decode及包加载，失败则更新架构再审。ZIP 共用原有公共序列化/XMP/水印与历史规则。预览为转义文本和嵌入已保存图片的静态HTML。
- 不启动浏览器或 DOM shim 做离线导出。未署名要CLI显式确认；缺图/旧版拒绝完整导出。支持纯文字JSON/Markdown用于中间稿检查。
- 新增测试使用同一 command dispatcher 和真实本地状态机，仅注入受控 provider，不增加可被消费者启用的假模型环境。CLI 子进程验证stdout、帮助、初始化/读取/维护与零监听；运行路径同入口以注入适配器覆盖生产阶段。npm产物验证不发布。

追加有序任务：

- [x] H1：AR 后验证 native canvas 能力并锁定运行依赖，更新锁文件。
- [x] H2：实现命令目录、JSON协议、解析与默认服务兼容；提供 in-process API 和初始化/状态/目录/故事动作。
- [x] H3：实现 dormant/target/stage 调度与 bounded run、需求/信号清理；验证不支付其他故事，不损坏幂等和故障协议。
- [x] H4：抽取导出环境适配器，共享现有 ZIP/PDF/PNG 和署名规则；实现离线预览及输出。
- [x] H5：增加完整 CLI 正式流程验收、npm资源探针与agent使用文档；对并行UI改动只修必要测试定位，不纳入其产品实现。
- [x] H6：最终适用单元/集成、现有E2E、CLI流程与安装产物复验通过。按最新范围停在DD；SS独立里程碑本地提交，不推送。

AR risk: non-low — 无服务生产命令、付费调度隔离、私有数据恢复、共享导出和原生依赖分发。
AR review round: 4; reviewer: reused
AR fixed: restricted generic API dispatch to allowlisted non-inference actions and added zero-call boundary verification; rerun result passed.
AR passed: no blocking architecture flaws

追加技能分发（R18）：npm files 包含 `skills/shiqu/SKILL.md`，新增 `skill show` 原文输出和 `skill install --scope project` 私有目录复制；同内容幂等，不同内容拒绝覆盖，拒绝符号链接。安装仅写显式 scope 对应目录，不做 postinstall。JSON 命令保留既有信封，show 默认原文便于代理直接读取，`--json` 返回正文及包版本。由 skill-creator 编写自包含操作指导，命令示例引用同版本 help，不把 npm 缓存路径写入技能。

- [x] H7：实现技能随包分发、读取/项目安装、隔离测试与使用文档；不自动安装到用户工作区。

AR risk: non-low — 项目技能安装与工作目录写入。
AR review round: 5; reviewer: reused
AR passed: no blocking architecture flaws

实现约束：拒绝目标文件和 .agents/skills/shiqu 各组件的符号链接，安装后独立于缓存。

用户追加 R19：显式 `--scope global` 以 `os.homedir()` 为安装根，project 仍为 cwd，共用同一复制实现；不使用 npm 缓存链接、不通过 npm postinstall 写全局。测试注入临时 home，验证跨 cwd 与实际路径、安全/幂等及零副作用。本轮不执行真实全局安装。H7 同时涵盖两范围。AR risk: non-low — 显式用户级技能目录写入。
AR review round: 6; reviewer: reused
AR passed: no blocking architecture flaws

Git base: `f753d3a5ae2233900a1b7edbb6ee8ce7f2a59de1`。本轮开始已有 client、generation、production-queue 及相关测试的并行改动，不纳入提交；公共文件只提交本轮片段。

## 架构与关键约束

- 共享 `server/library-backup.ts`：同步核心用于开库前的升级备份，异步维护入口使用 `ownDesktopData` 排他锁。SQLite `VACUUM INTO` 生成可读快照；源库必须通过只读检查。临时同级目录收集文件、校验清单后原子改名。备份和恢复目标必须不存在，拒绝源/目标互相包含、符号链接和未列出的文件。
- `openDatabase` 先只读判定已有迁移，快照完成后才打开可写连接执行原迁移；初次空库与无待迁移库跳过。升级备份位于书库同级 `<书库名>-backups/`，不被下一轮快照递归纳入。
- 所有真实服务启动持有既有书库排他锁；维护操作直接解析显式/已保存书库，不进入 provider setup。恢复强制显式新 `--data-dir`。备份/诊断输出禁止位于应用静态发布目录。
- `server/diagnostics.ts` 写入独立私有 `.diagnostics`，容量限制与轮换；服务生命周期安装限定事件的 console 捕获，不保存任意 stderr。导出重新投影白名单；直接持久化安全事件避免桌面 stderr 丢弃导致没有记录。日志失败不能中断制作；导出报告诊断可用性。
- 在现有 `release:check` 增加 `pnpm test:e2e`，npm 发布检查也使用同一 E2E 入口。现有 tag pre-push 已使用准确提交的隔离 checkout，继续复用。
- C007 当前实际写 checkout 的 `.data/dev-local`，须改为复制必要源码/静态资源至一次性测试根目录（依赖只读复用，排除 .env/.data/真实配置），在那里运行真实 `pnpm dev local`。直接 E2E、npm 检查与发布检查均不得触碰用户 dev-local。

## 顺序任务

- [x] S1：受控 Node24 探针验证 `VACUUM INTO` 与只读检查、不创建用户库；失败返回 AR。
- [x] S2：实现备份/验证/恢复和迁移前备份；加入字节、损坏、路径、锁、迁移失败及可恢复性测试。
- [x] S3：接入维护 CLI 和统一服务锁，维护命令拒绝冲突选项与非新恢复路径；加入真实 CLI 子进程集成测试。
- [x] S4：实现私有有界白名单诊断、服务启动/停止/错误记录和 CLI 导出；测试轮换、敏感内容、异常库和桌面生命周期入口。
- [x] S5：隔离 C007 的真实开发启动探针，再接入发布 E2E，更新故障阻断和发布入口测试；更新 README、使用/开发/桌面/测试文档。
- [x] S6：完成全套适用单元/集成、typecheck、lint、cargo fmt（若更改 Rust）、本轮及现有生命周期 E2E；保存输出证据，仅构建获准的npm验证产物，不打包桌面/Docker。

## 验证

匹配规格：`.docs/tests/test-library-recovery-diagnostics-release.md`。TT 运行 `pnpm test`、`pnpm typecheck`、`pnpm lint`，ET 运行 `pnpm test:e2e` 和维护子进程场景；测试调用同一生产实现、隔离临时库、禁用联网和生成。保留原有迁移事务与付费回执身份约束。

风险：备份大库有同步IO与磁盘占用；升级时明确等待并报告备份路径，失败不开库。目录快照仅在停服锁下完成；不承诺热备份或对抗本机恶意进程。诊断只记录白名单元数据，详细创作历史仍留在私有原库。自动快照不提供加密或防篡改签名。

AR risk: non-low — 数据恢复、迁移快照、排他锁、诊断隐私与发布门禁。
AR review round: 2; reviewer: reused
AR fixed: corrected restore execution semantics and isolated the development-command E2E probe; rerun result passed.
AR passed: no blocking architecture flaws

以上通过仅为维护范围历史记录，!! 扩展后失效。

## SS 证据与里程碑

- `a088e0725d9d7b1624c625c5fd42a693e9afebc6`：已验证书库恢复和私有诊断；聚焦维护/锁/迁移测试通过。
- Node24.22.1 / pnpm11.25.0：native WebP 编码/解码与 Noto CJK 绘制探针通过；字体 SHA-256 固定校验。
- `/tmp/shiqu-headless-focused.log`：6项CLI/技能测试通过（正式状态机、幂等/CAS、目标隔离含已排队任务、故障/timeout、共享导出、无监听子进程与技能路径）。
- `/tmp/shiqu-cli-package.log`：本地 npm tarball 构建通过，仅用于实际产物验证，无发布。
- `/tmp/shiqu-cli-smoke.log`：安装后原生ZIP/PDF/PNG、默认HTTP服务、持久化与维护通过；全局技能范围在隔离HOME追加重验通过。
- `/tmp/shiqu-cli-e2e.log`：现有79项E2E通过，证据 `.data/e2e/2026-11-03T14-56-13-597Z-8f8ffb2a`。
- 已存在的并行生产流程改动由 `ad9f253` 单独提交，非本story。本轮并行选题条件UI/服务改动仍不纳入；`lib/reader-api.ts` 仅 commandOnly guard 属于本轮。

- `c4fde96`：无服务CLI、共享导出、Codex技能分发（项目/全局显式范围）与发布E2E门禁里程碑；聚焦6项、类型/lint、本地npm安装冒烟通过。SS实现已完成，进入独立CR；全套TT仍运行中。

CR发现与修复：命令从当前状态补 generation/faultId 会改变同请求重放的身份，改为 intake 操作显式 generation、retry/override 显式 faultId；编辑沿用原 token。新增 search/choose/confirm/控制重放与过期generation验证，帮助/技能同步。TT首次1147项中3处旧测试适配失败：SQL计时字段改变故障注入匹配，组件CSS引入需静态测试loader；修复测试适配后31项通过，重跑完整suite。

CR阶段边界修复：等待旧画幅确认立即返回 frame_count_required；已确认故事的 prepared 返回 already_prepared；不适用的旧模式边界 BOUNDARY_UNAVAILABLE，不再等待超时。CLI复用reviewPassed判断历史已审核计划，正常coordinator行为不改。聚焦验收含上述三种情形。

CR risk: non-low — 涉及数据恢复、锁、诊断隐私、生产调度与发布契约。
CR review round: 2; reviewer: reused
CR fixed: 幂等身份及阶段停止边界问题已修复；rerun result passed。

TT：1151/1151通过（/tmp/shiqu-cli-unit-final.log）；CLI最终边界聚焦6/6（/tmp/shiqu-headless-boundaries.log），新增修改限CLI，既有全面证据与最新聚焦合并使用。类型/lint通过（/tmp/shiqu-cli-types-reviewed.log、/tmp/shiqu-cli-lint-reviewed.log），技能验证通过。最终ET及tarball复验执行中。

## 最终验证证据

- `4446067`：独立CR通过后的命令身份、阶段边界与测试适配修复里程碑；不包含并行UI/提取条件产品改动。
- TT：1151/1151；最终CLI重放/阶段/技能聚焦6/6；typecheck、lint、skill quick_validate通过。完整TT后变更限CLI边界/说明，已重验受影响CLI流程与实际npm产物。
- ET：79/79（.data/e2e/2026-11-03T15-06-40-372Z-9152e1e7），最终headless用同dispatcher的正式状态机/受控provider覆盖规格9–12、14–16。
- npm产物 outputs/npm/apprun-shiqu-0.6.6.tgz：隔离离线安装到临时目录、24书籍1983文件、默认HTTP启动/存储/退出、无服务读取/预览/native ZIP-PDF-PNG/备份恢复/脱敏诊断、project/global技能安装均通过；未发布。
- 持久化日志：.data/verification/library-recovery-diagnostics-release/{unit,headless,typecheck,lint,npm-build,npm-smoke,e2e}.log。Node24.22.1，pnpm11.25.0，macOS arm64；无真实AI、Windows/Linux原生运行或跨平台安装承诺。
- 无Rust实现改动；未运行桌面/Docker打包。未修改真实书库、凭据或全局技能目录。

VR risk: non-low — 数据恢复、生产执行隔离及发布契约。
VR review round: 1; reviewer: reused
VR passed: all acceptance criteria complete

R1–R19全部完成，独立VR完整结论原样载入 `.docs/done/2026/11/03/library-recovery-diagnostics-release.md`。此前源码由三个SS里程碑保存，完成记录停在DD；本次按用户明确要求提交CLI、技能和文档的剩余改动，不推送、不发布。

交付增量：普通书库命令自动初始化，init --data-dir 可指定新目录且不改默认位置；备份仍拒绝缺失数据库。32项聚焦和实际npm包冒烟通过，新增指定目录子进程回归通过。README/用户指南已补充技能入口；独立用户指南仅含35条自然语言提示词，安装提示词包含GitHub技能来源。上述增量经过低风险本地CR，未纳入并行界面或生成逻辑改动。
