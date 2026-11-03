# 开发数据库与Playwright故事全流程

Git base: `6c791fa`

风险non-low：开发入口选择数据目录并启动真实服务；跨界面、队列和持久状态验证。已有未提交完成文档保留且不纳入本任务提交。

选择：`pnpm dev local`强制checkout内`.data/dev-local`，原dev保留桌面兼容；显式local不可被.env的SHIQU_DATA_DIR覆盖。测试使用`.data/e2e/<run>/data`独占目录，不复用人工开发库。最小扩展productionFixture允许指定全新root与保留结果；同一生产createApplication/queue/provider adapter，受控回执只在测试fixture注入。Vite使用正式developmentServerOptions/protectDevelopmentLibrary及developmentAccess。测试不向产品加入假模型开关，不维护第二条生成管线。

- [x] 首个SS探针：以readonly提供方实际运行`pnpm dev local`在独立端口，确认打印/SQLite位置为`.data/dev-local`、空书架可访问、私有文件不被Vite提供；退出后服务端口释放。成功后再实施完整harness。
- [x] 实现local参数解析/验证和文档，保留原dev行为；新增可保留的独立开发测试库fixture和Playwright启动/证据基础设施，增加pnpm test:e2e入口。
- [ ] 实现并运行.tests/story-lifecycle的7类浏览器/协议场景，按状态机观察状态和负向副作用，保留失败及重跑证据；补足既有8组合浏览器回归及协议边界。
- [ ] 运行typecheck、lint、pnpm test与目标E2E；整理测试报告/覆盖矩阵及状态机文档，发现产品缺陷不通过隐藏写路径制造通过。

证据位于`.data/e2e/<run>`（数据库、截图、trace、状态流），`.tests/story-lifecycle/evidence`保存精简JSON/Markdown及运行账本，自动化代码维护在tests。不复制凭据。浏览器选择：用户明确要求Playwright，因此使用独立无头Playwright会话，区别于用户现有标签。

AR risk: non-low — 开发入口的数据目录选择及跨 UI、队列、SQLite 的验证涉及隔离边界。
AR review round: 1; reviewer: reused
AR passed: no blocking architecture flaws

完整TT/ET待执行。

首个探针已通过：readonly实际pnpm dev local在43101/43102启动，冲突目录未创建，.data/dev-local/shiqu.sqlite存在且空书架200，直接数据库下载被拒绝；停止后进程退出0。日志/tmp/shiqu-dev-local-probe.log。

实现与验证进度：已新增开发启动入口、可保留的独占测试库、Playwright trace/截图/状态采样、统一pnpm test:e2e证据目录与工作区指纹。新建、8类编辑提交（含旁白/局部画面/人物设定/结语）、暂停恢复、失败重试、重选与审核手动修订/放行均已在浏览器通过。首轮组合回归78/79；失败为旧组合测试在异步重选加载完成前断言，已补等待真实提取按钮，非产品缺陷。失败证据保留，最终组合回归进行中。完整pnpm test1107/1107、typecheck通过，lint最终检查进行中。
