# 统一正式审核流程

Git基线：`0ceeb2635c824d771521bada3db1e3fe62564967`。进入时已有未提交的提示词优化与回归断言，属于已接受输入，保留；本轮接通执行路径，不改提示词的语义标准。

风险non-low：改变正式审核顺序、可恢复JSON检查点和队列键，须验证付费调用不重复、旧稿兼容和绘图门禁。使用RPD非低风险流程，独立AR/CR；接入实施阶段不提交Git、不恢复真实故事。用户随后以“DD GC”授权本地提交，仍不推送或恢复生成。

## 实现决策

在`advanceStory`内执行两阶段，不把`scripts`适配器搬入服务。沿用现有review/repair任务种类和会话锁，无SQL迁移。`ReviewCheckpoint`可选增加phase及frameCountReports数组；旧字段/全篇round语义保留。自动稿待审核且无phase从数量门开始；通过数量门单独保存phase=full，再用下一队列检查点做全篇审核。固定幅数和已通过旧稿不新增调用。

保留现有“跳过问题并绘图”的明确人工例外，它从任一blocked阶段跳过尚未完成的审核，仍保存overridden并显示人工放行，不能算两门通过。不改变该按钮/API的语义，也不把非法报告或能力错误转换成可跳过的blocked；验证暂停及重复请求不恢复或重复生成。

数量报告持有完整requirements，结构修订仅在数量阶段传该上下文；真实结构修改后phase回frames，纯局部/结语修订保留full。自动稿的数量、全篇和修订key均使用含phase、数量报告轮次及全篇round的新命名空间；固定数值稿保留旧key。避免同一全篇round多次数量修订，及部署前queued旧key被略过后标成功而吞掉新full调用。全篇round、报告格式和候选结语处理不被数量门冒充。

## 执行与验证

- [x] SS有界探针：正式引擎已完成reduce→结构删除→keep→full，2个完整requirements均传到结构修订，映射复用已有图；4次调用独立保存usage，full才处理候选结语。恢复/非法输出/能力缺失/无变化/20轮共享的受控探针通过。日志`/tmp/shiqu-unified-focused.log`，相关26项通过。
- [x] 扩展review检查点及nextStep键，在正式引擎处理数量门、合法性和完整需求、结构回退及共享修复上限。保留映射、图像复用与进度原子保存。
- [x] 移除`createFrameCountGate`独立状态机；测试和评估只使用正式引擎状态，保留非流程的隔离/回执工具并修正过期注释和文档。
- [x] 更新阅读器和桌面SQL摘要中的阶段标识，沿用现有进度组件，兼容旧稿和原有固定幅数显示。
- [x] 受控正式队列测试覆盖减幅、增幅、重分配、候选标题/结语延后、暂停/重启、失败恢复、非法报告、无变化、上限、结构回退、局部复核、已有图复用及固定/旧稿。
- [x] 完成相关单元/集成与匹配ET，类型检查和lint；用应用内浏览器核对暂停稿显示数量审核且没有触发生成。
- [x] 更新开发说明与项目约定；核实真实稿最终暂停，当前复用图片未覆盖，原稿保留。

ET见`.docs/tests/test-unified-story-review.md`。不做付费语义盲测来替代流程正确性；今后真实回归也必须复用此正式引擎。

AR passed: no blocking architecture flaws
AR risk: non-low — 正式审核顺序、持久化检查点及队列恢复涉及付费调用与绘图门禁。
AR review round: 1; reviewer: new
独立复核已采纳auto新键命名空间与人工override例外的明确标记要求。


CR fixed: 数量阶段实际修订后，首次全篇审核通过曾被误显示为“无需修订”；现已将repairPasses纳入阶段判断，并加入reader/desktop一致性回归。复核通过。
CR passed: no major findings
CR risk: non-low — 正式阶段、持久化检查点及队列恢复涉及付费调用和绘图门禁。
CR review round: 2; reviewer: reused

TT最终全量1029/1029通过，日志`/tmp/shiqu-unified-full-tests-final.log`；后续新增跨阶段上限及自动旧稿兼容检查在30/30专项中通过，日志`/tmp/shiqu-unified-delivery-tests.log`。typecheck/lint日志`/tmp/shiqu-unified-{typecheck,lint}-final.log`。首次沙箱端口/PTY失败不算产品回归；批准重跑后仅剩旧批次提示词断言，已按提纲管幅数、批次不改幅数的实际职责修正并通过完整重跑。原adaptive ET的自动任务键断言已更新为真实两门顺序，并通过恢复检查。

ET完成：应用内浏览器使用`pnpm desktop:preview`核对实际桌面队列，显示31幅/19图、paused与验收unknown阻断；reader当前复用图可读。进入时34/22/paused与后来active变更的来源未确认，未声称内容全程不变；已按既有暂停要求重新暂停。当前19张图SHA256全匹配前存图，无running任务，未主动恢复或新发绘图。

VR passed: all acceptance criteria complete
