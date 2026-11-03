# 无服务 CLI、技能分发与书库恢复

## Summary

拾趣 CLI 现在可直接初始化、选题、准备、制作、编辑版本、预览、导出和维护书库，使用同一生产状态机，不需要 HTTP、桌面或前端。首次访问自动建立书库数据库，init --data-dir 可显式指定目录。无子命令仍启动现有服务；只有显式 run 执行指定故事。命令目录和 JSON 回执供 Codex 使用，随 npm 包提供技能读取及显式项目/全局安装。

书库增加完整快照校验、新目录恢复与迁移前自动备份；CLI/桌面/开发服务共用排他锁及私有有界脱敏诊断。现有 E2E 接入本地发布检查，开发命令验收使用一次性源码目录。

## Verification

完整单元/集成 1151/1151，最终 CLI 聚焦 6/6，最终 E2E 79/79，typecheck、lint 和技能校验通过。本地 tarball 的隔离实际安装验证默认服务、24本书籍、原生 ZIP/PDF/PNG、离线预览、备份恢复、诊断及项目/全局技能复制。日志位于 `.data/verification/library-recovery-diagnostics-release/`；E2E 证据 `.data/e2e/2026-11-03T15-06-40-372Z-9152e1e7`。

自动建库增量通过32项CLI/共用书库/维护聚焦测试及实际npm包冒烟；指定数据库目录（包含空格）、保存路径与默认路径、已有数据保留和坏库拒绝均由真实CLI子进程验证。提供纯提示词用户指南，35个可复制任务；文档链接、技能格式及差异空白检查通过。

## Notes

- SS 本地提交：`a088e0725d9d7b1624c625c5fd42a693e9afebc6`、`c4fde96c6ae86180649e173f17fd272af1a71c14`、`4446067`。并行 UI/选题条件改动不纳入。CLI自动建库、技能与文档的剩余改动按用户明确要求完成本地交付；未推送或发布。
- 新命令尚未发布到 npm；源码入口为 `pnpm cli help --json`。实际验证产物为 `outputs/npm/apprun-shiqu-0.6.6.tgz`，不是注册表发布。
- `skill install --scope project` 写当前目录 `.agents/skills/shiqu/SKILL.md`；`--scope global` 写用户 home 下同一路径。均独立复制且拒绝不同内容覆盖/符号链接。本轮未安装到真实项目或全局技能目录。技能副本不固定 npx 运行版本。
- 原生导出采用 `@napi-rs/canvas@1.0.13` 与随包 Noto CJK 字体，许可见 `data/export-fonts/OFL.txt`。共享布局、水印与元数据规则，不承诺不同编码器生成相同字节；公共 ZIP 转换继续保留已有 WebP 原字节。
- 验证为 Node24.22.1、pnpm11.25.0、macOS arm64 和受控提供方。未执行真实 AI、其他 OS 原生验收、桌面/Docker 打包，也未修改真实书库或凭据。

## Final VR result

VR passed: all acceptance criteria complete

本轮只读核对 REQ R1–R19、AP、匹配规格、实现、CR round 2 结论及最终日志；未修改文件或运行验证。全部 AP 任务 S1–S6、H1–H7 已完成。

证据：[完整单元/集成日志](/Users/esun/Documents/Projects/shiqu-docker/.data/verification/library-recovery-diagnostics-release/unit.log) 1151/1151；[最终 CLI 聚焦日志](/Users/esun/Documents/Projects/shiqu-docker/.data/verification/library-recovery-diagnostics-release/headless.log) 6/6；[最终 E2E 日志](/Users/esun/Documents/Projects/shiqu-docker/.data/verification/library-recovery-diagnostics-release/e2e.log) 79/79；[实际 npm 包冒烟日志](/Users/esun/Documents/Projects/shiqu-docker/.data/verification/library-recovery-diagnostics-release/npm-smoke.log) 通过。类型检查、lint、技能校验通过。

| 验收项 | 状态 | 具体依据 |
|---|---|---|
| R1 完整备份与验证 | complete | `VACUUM INTO` 一致数据库快照、媒体原字节复制和大小/SHA-256 清单；维护测试验证篡改、缺失、额外文件、越界路径、重复项及符号链接全部拒绝。 |
| R2 安全恢复 | complete | 验证后在同级暂存目录构建并发布至不存在的目标；已有目录、嵌套目标及坏备份拒绝且无半成品。真实生产库恢复测试比较故事完整记录、进度与媒体字节；只读应用不启动制作。 |
| R3 迁移前备份 | complete | `openDatabase` 在可写连接与迁移前检查待迁移项并调用升级快照；测试验证旧结构可恢复、无新迁移不重复备份、快照失败不执行新 SQL。新库跳过，旧备份不自动删除。 |
| R4 服务锁与维护隔离 | complete | 实际开发、CLI、桌面启动及维护复用书库排他锁；维护测试确认忙库拒绝、释放后成功。维护入口不进入提供方配置或服务启动流程。 |
| R5 私有有界诊断 | complete | 白名单安全事件与字段投影，私有目录/文件权限及两份 128 KiB 轮换；单元测试覆盖敏感内容剔除、恶意存量记录、写入失败和符号链接。真实 CLI、桌面生命周期记录通过。 |
| R6 脱敏诊断导出 | complete | 报告只含版本、运行时、数据库状态/计数和安全事件；正常、缺失及损坏数据库均有受限结果。测试确认不泄露路径、正文、密钥或原始异常，已有输出拒绝覆盖。 |
| R7 发布 E2E 门禁 | complete | `release:check`、`npm:check` 接入现有 E2E；测试确认准确 tag 快照隔离检查、失败阻止实际 tag push、清理临时 worktree。未将完整回归重复加入平台构建。 |
| R8 文档与适用验证 | complete | [使用指南](/Users/esun/Documents/Projects/shiqu-docker/.docs/user-guide.md) 已包含备份、校验、恢复、诊断、升级回退及独立凭据边界。完整 TT、类型、lint、匹配 ET 通过；验证使用隔离数据，无 Rust 改动，无桌面/Docker 打包。 |
| R9 完整无服务入口 | complete | 子命令在默认服务分支前分流，经进程内生产 Request 执行目录、故事操作、生产控制、导出及维护；子进程测试禁止网络监听仍通过。实际 npm 包验证无子命令 HTTP 启动、持久化、重启和退出。 |
| R10 可发现 JSON 协议 | complete | `help --json` 给出版本、命令、输入、效果和阶段结果；子进程测试直接解析唯一 stdout 信封并验证稳定错误码/非零退出。支持文件/stdin、显式 requestId/generation/token/faultId；日志走 stderr，配置输出隐藏密钥。 |
| R11 有界目标执行 | complete | dormant coordinator 无自动调度；显式 run 的需求、恢复及执行门限定当前目标。测试确认其他已排队故事记录不变、审核边界零生图、暂停/失败不隐式恢复、超时后可继续；最终聚焦覆盖历史画幅确认、已确认阶段及不适用边界。中断清理复用停止、取消与回执保存路径。 |
| R12 生产校验与推理边界 | complete | 动作复用正式 reader API、版本/CAS/故障协议；重放及过期 generation、旧版、错误 fault 测试通过。普通 API 使用非推理白名单；建议、画风推荐、advance、历史 admin 生成和未知路由均返回 `EXECUTION_REQUIRED`，提供方调用计数为零。 |
| R13 离线预览 | complete | 静态 HTML 嵌入已保存图片，文本转义并限制执行内容；恶意 `<script>` 标题测试只出现转义文本。实际安装包无需服务生成可读预览。 |
| R14 共享原生导出 | complete | JSON/Markdown 及 ZIP/PDF/PNG 使用共享序列化、绘图、水印、署名、哈希/XMP 核心，浏览器与 native adapter 分担环境 IO，无全局 DOM 伪造。测试验证 ZIP 元数据、PDF 页数、PNG 可解码及源图未变化；实际 tarball 原生导出通过。 |
| R15 完整导出约束 | complete | 当前版本、完整画幅及可读图片检查，无旧版回退；公开 ZIP 使用共享公共转换器，内部提示词需显式选择。未署名默认拒绝，显式允许才导出；输出新路径且不覆盖、不提交或发布，公共 WebP 转换保留原字节。 |
| R16 配置与提供方边界 | complete | 读库/预览/导出使用只读提供方，init 无需配置；run 明确加载已保存配置或显式环境并检查可用性，无静默提供方回退。禁止网络的真实子进程读取/初始化/维护测试通过。 |
| R17 完整 CLI 与包验收 | complete | 同一正式 dispatcher 和受控 provider 完成初始化、选题、准备、确认、审核、生图、编辑版本、预览导出及备份恢复；覆盖重放、目标隔离、故障和超时。最终安装包在隔离 HOME 下通过 24 书籍、1983 文件、默认服务及 native 导出验收。 |
| R18 项目技能分发 | complete | npm 包携带完整技能；show 与包内字节一致，project 安装为独立文件复制；同内容幂等、不同内容不覆盖、逐级符号链接拒绝、未指定 scope 拒绝。单元与实际包安装均通过，无数据库或推理副作用。 |
| R19 全局技能安装 | complete | 显式 global 以用户 home 为根，复用相同安全复制逻辑；注入临时 home 的测试验证跨 cwd 路径及幂等，实际包在隔离 HOME 下安装通过，未写真实全局技能目录。 |

完整 TT 后的修改限 CLI 请求身份、阶段边界及说明，受影响流程已通过最终 6 项聚焦测试、实际 npm 包复验和最终 ET；既有全面验证证据继续有效。无未完成或阻塞验收项。

本次结论覆盖 story 提交 `a088e07`、`c4fde96`、`4446067`；并行 UI/选题条件改动不纳入。运行证据为 Node 24.22.1、pnpm 11.25.0、macOS arm64、受控提供方；未宣称真实 AI 或其他操作系统验证通过。

VR risk: non-low — 涉及数据恢复、迁移、锁、诊断隐私、生产执行隔离及发布契约。
VR review round: 1; reviewer: reused

VR passed: all acceptance criteria complete
