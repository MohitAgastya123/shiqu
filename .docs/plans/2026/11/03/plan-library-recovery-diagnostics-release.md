# 实现计划

Git base: `f753d3a5ae2233900a1b7edbb6ee8ce7f2a59de1`。本轮开始已有 client、generation、production-queue 及相关测试的并行改动，不纳入提交；公共文件只提交本轮片段。

## 架构与关键约束

- 共享 `server/library-backup.ts`：同步核心用于开库前的升级备份，异步维护入口使用 `ownDesktopData` 排他锁。SQLite `VACUUM INTO` 生成可读快照；源库必须通过只读检查。临时同级目录收集文件、校验清单后原子改名。备份和恢复目标必须不存在，拒绝源/目标互相包含、符号链接和未列出的文件。
- `openDatabase` 先只读判定已有迁移，快照完成后才打开可写连接执行原迁移；初次空库与无待迁移库跳过。升级备份位于书库同级 `<书库名>-backups/`，不被下一轮快照递归纳入。
- 所有真实服务启动持有既有书库排他锁；维护操作直接解析显式/已保存书库，不进入 provider setup。恢复强制显式新 `--data-dir`。备份/诊断输出禁止位于应用静态发布目录。
- `server/diagnostics.ts` 写入独立私有 `.diagnostics`，容量限制与轮换；服务生命周期安装限定事件的 console 捕获，不保存任意 stderr。导出重新投影白名单；直接持久化安全事件避免桌面 stderr 丢弃导致没有记录。日志失败不能中断制作；导出报告诊断可用性。
- 在现有 `release:check` 增加 `pnpm test:e2e`，npm 发布检查也使用同一 E2E 入口。现有 tag pre-push 已使用准确提交的隔离 checkout，继续复用。
- C007 当前实际写 checkout 的 `.data/dev-local`，须改为复制必要源码/静态资源至一次性测试根目录（依赖只读复用，排除 .env/.data/真实配置），在那里运行真实 `pnpm dev local`。直接 E2E、npm 检查与发布检查均不得触碰用户 dev-local。

## 顺序任务

- [ ] S1：受控 Node24 探针验证 `VACUUM INTO` 与只读检查、不创建用户库；失败返回 AR。
- [ ] S2：实现备份/验证/恢复和迁移前备份；加入字节、损坏、路径、锁、迁移失败及可恢复性测试。
- [ ] S3：接入维护 CLI 和统一服务锁，维护命令拒绝冲突选项与非新恢复路径；加入真实 CLI 子进程集成测试。
- [ ] S4：实现私有有界白名单诊断、服务启动/停止/错误记录和 CLI 导出；测试轮换、敏感内容、异常库和桌面生命周期入口。
- [ ] S5：隔离 C007 的真实开发启动探针，再接入发布 E2E，更新故障阻断和发布入口测试；更新 README、使用/开发/桌面/测试文档。
- [ ] S6：完成全套适用单元/集成、typecheck、lint、cargo fmt（若更改 Rust）、本轮及现有生命周期 E2E；保存输出证据，不打包。

## 验证

匹配规格：`.docs/tests/test-library-recovery-diagnostics-release.md`。TT 运行 `pnpm test`、`pnpm typecheck`、`pnpm lint`，ET 运行 `pnpm test:e2e` 和维护子进程场景；测试调用同一生产实现、隔离临时库、禁用联网和生成。保留原有迁移事务与付费回执身份约束。

风险：备份大库有同步IO与磁盘占用；升级时明确等待并报告备份路径，失败不开库。目录快照仅在停服锁下完成；不承诺热备份或对抗本机恶意进程。诊断只记录白名单元数据，详细创作历史仍留在私有原库。自动快照不提供加密或防篡改签名。

AR risk: non-low — 数据恢复、迁移快照、排他锁、诊断隐私与发布门禁。
AR review round: 2; reviewer: reused
AR fixed: corrected restore execution semantics and isolated the development-command E2E probe; rerun result passed.
AR passed: no blocking architecture flaws
