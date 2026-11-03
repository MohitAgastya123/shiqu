# 开发数据库与Playwright故事全流程

Git base: `6c791fa`

风险non-low：开发入口选择数据目录并启动真实服务；跨界面、队列和持久状态验证。已有未提交完成文档保留且不纳入本任务提交。

选择：`pnpm dev local`强制checkout内`.data/dev-local`，原dev保留桌面兼容；显式local不可被.env的SHIQU_DATA_DIR覆盖。测试使用`.data/e2e/<run>/data`独占目录，不复用人工开发库。最小扩展productionFixture允许指定全新root与保留结果；同一生产createApplication/queue/provider adapter，受控回执只在测试fixture注入。Vite使用正式developmentServerOptions/protectDevelopmentLibrary及developmentAccess。测试不向产品加入假模型开关，不维护第二条生成管线。

- [x] 首个SS探针：以readonly提供方实际运行`pnpm dev local`在独立端口，确认打印/SQLite位置为`.data/dev-local`、空书架可访问、私有文件不被Vite提供；退出后服务端口释放。成功后再实施完整harness。
- [x] 实现local参数解析/验证和文档，保留原dev行为；新增可保留的独立开发测试库fixture和Playwright启动/证据基础设施，增加pnpm test:e2e入口。
- [x] 实现并运行.tests/story-lifecycle的7类浏览器/协议场景，按状态机观察状态和负向副作用，保留失败及重跑证据；补足既有8组合浏览器回归及协议边界。
- [x] 运行typecheck、lint、pnpm test与目标E2E；整理测试报告/覆盖矩阵及状态机文档，发现产品缺陷不通过隐藏写路径制造通过。

证据位于`.data/e2e/<run>`（数据库、截图、trace、状态流），`.tests/story-lifecycle/evidence`保存精简JSON/Markdown及运行账本，自动化代码维护在tests。不复制凭据。浏览器选择：用户明确要求Playwright，因此使用独立无头Playwright会话，区别于用户现有标签。

AR risk: non-low — 开发入口的数据目录选择及跨 UI、队列、SQLite 的验证涉及隔离边界。
AR review round: 1; reviewer: reused
AR passed: no blocking architecture flaws

完整TT/ET已通过，最终结果见下文。

首个探针已通过：readonly实际pnpm dev local在43101/43102启动，冲突目录未创建，.data/dev-local/shiqu.sqlite存在且空书架200，直接数据库下载被拒绝；停止后进程退出0。日志/tmp/shiqu-dev-local-probe.log。

实现与验证进度：已新增开发启动入口、可保留的独占测试库、Playwright trace/截图/状态采样、统一pnpm test:e2e证据目录与工作区指纹。新建、8类编辑提交（含旁白/局部画面/人物设定/结语）、暂停恢复、失败重试、重选与审核手动修订/放行均已在浏览器通过。首轮组合回归78/79；失败为旧组合测试在异步重选加载完成前断言，已补等待真实提取按钮，非产品缺陷。失败证据保留，最终组合回归79/79通过。完整pnpm test1107/1107、typecheck和lint通过。

实现里程碑：`19fcad3`；完整TT1107/1107、最终ET79/79、typecheck/lint及独立CR/VR均通过。

最终ET79/79通过（.data/e2e/2026-11-03T13-09-05-359Z-d346b706）；测试报告与不可改写历史已归.tests/story-lifecycle/evidence。独立CR passed: no major findings；已同步C007真实开发库启动例外的数据政策说明。

CR risk: non-low — 开发目录选择、真实服务启动与跨 UI/队列/SQLite 的验证涉及隔离边界。
CR review round: 1; reviewer: reused
CR passed: no major findings

VR risk: non-low — 开发库隔离、生产流程覆盖与测试证据完整性涉及持久数据和调度边界。
VR review round: 1; reviewer: reused

逐项验收结果：

1. **完成：`pnpm dev local` 隔离与兼容。** 参数测试验证 local 强制使用 checkout 的 `.data/dev-local`，普通 dev 保留原目录解析。C007 实际启动命令，验证冲突共享目录未创建、SQLite 可用、私有文件下载被拒绝，退出后两端口释放。
2. **完成：可重复的生产流程 Playwright 命令。** `pnpm test:e2e` 使用正式 Vite、访问保护、HTTP/API、队列、SQLite 和媒体存储；生命周期数据库独占 `.data/e2e/<run>`。受控回执在测试 fixture 的生产 adapter 中注入，不另建生成管线、不调用外部推理。C007 实际启动 `.data/dev-local` 的 readonly 提供方例外已在数据政策和报告中明确说明。
3. **完成：新建至阅读。** C001 通过浏览器完成新建、等待、手动提取、选择、准备、草稿修改、刷新、重新准备、确认制作及阅读；确认前分镜和图片调用均为零，保存的设置及成品有只读核对。
4. **完成：全部编辑入口与版本保持。** C002 覆盖改名、制作要求、验收、画风、详略、旁白、局部画面、人物设定和结语，以及草稿关闭/丢弃、提交和历史查看。断言验证单家族单卡片、旧版与原文保持、适用时图片复用，以及局部一幅或全篇重绘。
5. **完成：控制、恢复、重选及协议边界。** C003—C005 通过 UI 验证暂停/恢复、刷新不重试、显式故障恢复、重选取消和提交；附加场景验证审核阻断后的手动修改及人工放行。C006 补充停止、幂等、过期命令、重启、同家族竞态和媒体恢复，并明确标注为协议验证，不冒充 UI 点击证据。
6. **完成：证据、覆盖报告与状态机文档。** 最终运行保留构建指纹、数据库位置、截图、trace、命令和状态采样；报告区分受控模型、独立浏览器和未验证范围。28 条账本记录保留此前诊断 INVALID 与最终 7 例 PASS。状态机文档已更新手动提取入口，QA 状态为 7 Ready、7 PASS、无未执行或未解决阻塞项。

最终证据：完整 `pnpm test` **1107/1107**；`pnpm test:e2e` **79/79**，无跳过；typecheck、lint、QA validate/status 均通过。运行 `2026-11-03T13-09-05-359Z-d346b706` 的源码与已审提交 `19fcad3` 一致；CR 非阻塞文档不一致已修正，未引入新的代码变更。AP 四项任务全部完成。

验证限于独立 Chromium 和受控模型的流程正确性，不证明真实 AI 内容/图片质量、付费提供方连通性、打包或跨浏览器行为，也不构成发布批准。

VR passed: all acceptance criteria complete
