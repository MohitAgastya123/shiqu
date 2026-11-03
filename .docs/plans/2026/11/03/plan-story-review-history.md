# 审核记录与制作入口

Git基线：`dd1f449c0be320b3fc55b959a428ed328b54ae6f`。
进入时已有他处文档改动：`.docs/development.md`、`.docs/story-creation-editing-queue.md`、未跟踪`.docs/story-generation-state-machine.md`；保留且不纳入本任务提交。

风险non-low：新增按需历史接口及正式JSON检查点的可选记录元数据，涉及版本归属、记录真值和权限；无SQL迁移、无生成流程改序。

## 设计

- 在既有数量报告、全篇报告和修订history上可选记录`step`与`recordedAt`；局部修订存`before`，结语存`previousReflection`。结构本来已有removed/edits/previousCharacters，沿用。所有内容仍由正式engine保存，不另建测试流程或历史数据库。
- 纯投影`lib/reader-review-history.ts`将现有记录组成事件。按本版本usage的step定位实际顺序；新元数据优先，旧记录按明确的round/step规则匹配，不能唯一定位就单列顺序未留存。局部旧前文可从对应留存请求JSON的plan恢复，仅作为实际输入证据，不用当前稿回填。继承originId不同的调用不计本版本。
- `GET reader/sessions/:id/review-history`仅repo.get当前用户的可见故事，显式选择展示字段；不调用production、模型或写入。返回本版本信息、上一版ID、已保存事件、当前阻断/人工放行状态，不返回整份原文、usage原始载荷或密钥。
- `StoryReviewHistory`按需加载，Sheet呈现事件、数量决策、问题、修法、验收结果与对照。上一版按钮只切换记录目标，不切换阅读页/书架版本；可返回当前版。未保存的时间/前文不推算。
- Reader设置与StoryReviewTools接入同一入口；按钮文案改为“开始制作”，不改提交动作和图片复用。

## 实施

- [x] SS有界探针：从当前真实记录只读构造投影，确认混合count/full/repair可依usage定位、局部旧前文可用或准确缺失。若证据不足，只显示已留存部分，不能推测补齐。
- [x] 实现类型与engine最小记录增强、纯历史投影及GET接口。
- [x] 实现手机可读的历史Sheet和版本导航、现有入口与开始制作文案。
- [x] 验证正式引擎新增before/step/time与原审修结果原子保存；API隔离、GET零副作用、版本归属、排序不确定、旧稿缺失、局部/结构/结语/人物对照和无变化记录。
- [ ] UI受控渲染/接口集成测试、相关ET、typecheck/lint；应用内浏览器核验实际历史和手机宽度，只读不触发制作。
- [ ] 独立CR、VR及DD；保留无关文档，不进行最终GC，等待用户指令。

ET见`.docs/tests/test-story-review-history.md`。新能力直接接正式引擎/API，测试复用该实现。

AR passed: no blocking architecture flaws

AR risk: non-low — 新增按需历史接口和持久化记录元数据，涉及权限、版本归属与历史真值。

AR review round: 1; reviewer: new

SS探针：只读投影真实三个版本，数量/全篇/修订依本版本usage定位；上一版34→31的结构及第6幅修订旧配文均有真实输入证据。没有写入真实故事或调用模型。

受控正式引擎/API验证：`tests/review-history-flow.test.mjs`完成数量调整→结构修订→数量通过→全篇问题→局部修订→全篇通过，重启后GET一致且会话、任务和调用数不变。历史相关15项测试通过。
