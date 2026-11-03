# 审核记录与制作入口

Git基线：`dd1f449c0be320b3fc55b959a428ed328b54ae6f`。
进入时已有他处文档改动：`.docs/development.md`、`.docs/story-creation-editing-queue.md`、未跟踪`.docs/story-generation-state-machine.md`；保留且不纳入本任务提交。

风险non-low：新增按需历史接口及正式JSON检查点的可选记录元数据，涉及版本归属、记录真值和权限；无SQL迁移、无生成流程改序。

## 设计

- 在既有数量报告、全篇报告和修订history上可选记录`step`与`recordedAt`；局部修订存`before`，结语存`previousReflection`。结构本来已有removed/edits/previousCharacters，沿用。所有内容仍由正式engine保存，不另建测试流程或历史数据库。
- 纯投影`lib/reader-review-history.ts`将现有记录组成事件。按本版本usage的step定位实际顺序；新元数据优先，旧记录按明确的round/step规则匹配，不能唯一定位就单列顺序未留存。局部旧前文可从对应留存请求JSON的plan恢复，仅作为实际输入证据，不用当前稿回填。继承originId不同的调用不计本版本。
- `GET reader/sessions/:id/review-history`仅repo.get当前用户的可见故事，显式选择展示字段；不调用production、模型或写入。返回本版本信息、上一版ID、已保存事件、当前阻断/人工放行状态，不返回整份原文、usage原始载荷或密钥。
- `StoryReviewHistory`按需加载，Sheet呈现事件、数量决策、问题、修法、验收结果与对照。上一版按钮只切换记录目标，不切换阅读页/书架版本；可返回当前版。未保存的时间/前文不推算。
- Reader设置及无图制作流程均由ProductionTimeline接入同一历史入口；按钮文案改为“开始制作”，不改提交动作和图片复用。

## 实施

- [x] SS有界探针：从当前真实记录只读构造投影，确认混合count/full/repair可依usage定位、局部旧前文可用或准确缺失。若证据不足，只显示已留存部分，不能推测补齐。
- [x] 实现类型与engine最小记录增强、纯历史投影及GET接口。
- [x] 实现手机可读的历史Sheet和版本导航、现有入口与开始制作文案。
- [x] 验证正式引擎新增before/step/time与原审修结果原子保存；API隔离、GET零副作用、版本归属、排序不确定、旧稿缺失、局部/结构/结语/人物对照和无变化记录。
- [x] UI受控渲染/接口集成测试、相关ET、typecheck/lint；应用内浏览器核验实际历史和手机宽度，只读不触发制作。
- [x] 保留进入时无关文档，不纳入本任务提交。

ET见`.docs/tests/test-story-review-history.md`。新能力直接接正式引擎/API，测试复用该实现。

AR passed: no blocking architecture flaws

AR risk: non-low — 新增按需历史接口和持久化记录元数据，涉及权限、版本归属与历史真值。

AR review round: 1; reviewer: new

SS探针：只读投影真实三个版本，数量/全篇/修订依本版本usage定位；上一版34→31的结构及第6幅修订旧配文均有真实输入证据。没有写入真实故事或调用模型。

受控正式引擎/API验证：`tests/review-history-flow.test.mjs`完成数量调整→结构修订→数量通过→全篇问题→局部修订→全篇通过，重启后GET一致且会话、任务和调用数不变。历史相关15项测试通过。

用户追加：原文入口移到重新选择故事旁；采用同一标题行的操作组，去掉source节点重复原文按钮，只改导航位置。

- [x] 调整设置标题行原文入口及响应布局，核验原文Sheet只读打开。

SS里程碑：`ff668ae`保存历史正式实现、按钮文案与新增回归；当时聚焦测试/typecheck/lint已通过，全量TT发现两处结语测试的旧对象断言未包含新增字段，随后已加强为校验step/time/changed/previousReflection，并通过13项结语测试。

原文导航已在应用内浏览器验证：打开完整章节、关闭回设置，390px标题行332px宽无溢出；历史明细展开prompt也无溢出。截图位于会话visualizations下story-flow-links.jpg与review-history.jpg。

CR fixed: 已补齐正式 production queue 驱动的历史接口验证，覆盖六步审修顺序、修改前文本、重启一致性及 GET 零额外生成调用。复核通过。

CR passed: no major findings

CR risk: non-low — 历史接口与记录元数据涉及权限、版本归属和证据真值。

CR review round: 2; reviewer: reused

SS后续里程碑：`d9275ab`保存原文导航位置、正式队列ET及结语记录断言。

TT：Node24.22.1/pnpm11.25.0，全量1045通过，0失败；日志`/tmp/shiqu-history-full-tests2.log`。typecheck与lint通过（`/tmp/shiqu-history-{typecheck,lint}-final2.log`）。

ET：审核、数量、结构与人物设定相关4个既有E2E文件26项通过（`/tmp/shiqu-history-et.log`）。本任务正式队列flow/API/旧记录/UI证据见`tests/review-history*.test.mjs`及应用内浏览器。

VR passed: all acceptance criteria complete

VR risk: non-low — 历史接口与持久化记录涉及权限、版本归属及证据真值。

VR review round: 1; reviewer: reused

完整VR逐项结果见`.docs/done/2026/11/03/story-review-history.md`。用户已追加DD与GC，执行最终本地交付，不推送。

## 最终界面收口

- [x] 审核记录替代流程末尾说明并右对齐，去掉标题行与书架按钮下方的重复入口；制作标题行保留原文与重新选择故事。
- [x] 移除重绘数量/预览说明，仅改展示，保留正式图片复用与暂停控制。
- [x] 将验收unknown提示与原修改入口放入实际失败的审核/复核节点，复用同一ProductionTimeline；以实际报告数量区分初审和复核，保留已完成的修订。
- [x] 45项相关回归、typecheck和lint通过，覆盖初审/复核归属、未留修订、旧原生/预览一致性；只读浏览器验证旧v2提示位于复核，390px无溢出，入口仍可打开验收编辑页。

这些后续调整仅影响展示与只读状态投影，不新增持久化字段或改变正式队列执行条件。证据：`/tmp/shiqu-inline-acceptance-checks.log`及会话截图`acceptance-in-review-step.jpg`、`story-review-right-aligned.jpg`。

## DD / GC最终核验

最终代码全量1046/1046通过，types/lint通过；复用26项ET及45项显示回归。增量独立CR第3轮及VR第2轮通过，完整终结语和逐项结果记录于DD。

用户已要求本地GC，提交本任务剩余界面、回归与交付文档，保留ff668ae及d9275ab里程碑和进入时其他三处文档。制作确认页与故事设置的重新选择入口位置差异已只读定位，未扩展本次设置页调整范围。
