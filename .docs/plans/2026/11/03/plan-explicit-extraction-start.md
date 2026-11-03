# 点击按钮才开始提取

Git base: `65938b7`

范围包含本会话尚未提交、已验证的书籍偏好、范围顺序/摘要、提取条件摘要及标题方式按钮；保留上两项工作的未提交完成文档，不纳入实现提交。风险non-low：新建intake和重选的初始调度意图发生改变，需要验证API、观察客户端与生产队列一致。

决定：新建未选中intake使用现有 `phase=choosing`、`search={round:0,state:idle}`、空batches表达等待开始。生产graph在该状态不安排搜索；不增加延迟标志或新数据库状态。保留显式source直接选择准备行为与已保存searching旧任务。观察客户端不为无候选、无查找的窗口续写production需求。开始按钮仍发已有search命令；点击后自动连续发现保持原逻辑。

- [x] 修改createIntake的初始状态，验证重复demand、tick、重启不产生查找；用现有search命令开始后才有结果。
- [x] 新建入口改为“进入故事提取”；初始提取与书架给出等待开始提示，观察客户端保持只读；重选同样等待按钮。
- [x] 将既有测试中确实需要启动的流程改为显式提交生产search命令，新增初始/重开/重启/重选零推理与观察只读回归，不在fixture的demand中暗中启动。
- [ ] 运行受影响unit/integration、typecheck和lint；独立Playwright验证所有条件组合开始前零调用，自动/标题按钮后正常查找，包含重选、真实三章名称与390px布局。

首个探针：隔离生产API创建intake，重复请求观看与tick并重启，检查search仍idle、无discover任务且suggestions调用为零；随后提交search并验证有结果。该探针通过后接入界面与批量调整旧测试。

浏览器仍使用独立Playwright测试会话；此前Work设置禁用了内置浏览器。只验证网页，不打包桌面或Docker。

AR risk: non-low — 初始调度意图改变，涉及队列和观察客户端。
AR review round: 1; reviewer: reused
AR passed: no blocking architecture flaws

首个API探针2/2通过：创建、重复demand/tick、重启和只读观察都没有提取调用；显式search后有结果且重放不重复；重选草稿等待并保持父版本。既有连续查找5/5、流程控制33/33、暂停版本8/8通过。独立浏览器已验证8种条件组合，按钮前无discover任务、首个任务模型调用为0，按钮后候选实际显示；包含重选、三章原文摘要、持久书籍选择和390px布局。完整单测/集成及REST E2E正在执行。

日志：`/tmp/shiqu-manual-start-probe.log`、`/tmp/shiqu-manual-start-flow.log`、`/tmp/shiqu-manual-start-continuous.log`、`/tmp/shiqu-manual-start-paused.log`、`/tmp/shiqu-manual-start-e2e.log`、`/tmp/shiqu-manual-start-full.log`、`/tmp/shiqu-manual-start-rest-e2e.log`。

实现里程碑待记录；CR/VR待完成。
