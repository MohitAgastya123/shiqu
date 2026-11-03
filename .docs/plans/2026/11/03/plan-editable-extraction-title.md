# 在提取窗口修改标题

Git base: `11268926a79bf4e9d4ddc4d2587f1e4912fee97d`

风险 non-low：新增保存查询意图的命令，需要与异步提取完成写入及重选草稿隔离协调。上次选题模式工作的未提交完成文档保留原样，不纳入本次实现提交。

决定：新界面选择单篇原文故事时也使用 discoverySources=[目录凭据] 进入未选中的提取阶段，而不直接准备制作，从而仍可组合标题；旧API直接选故事的source契约不变。保留已有两阶段流程，将标题输入从 StoryDiscoveryForm 移到未选中故事的 StoryCreationSetup。新增严格校验的 `search` intake命令，携带可为空的title；沿用generation作选择冲突检查，沿用单调search.round拒绝旧结果写回。提交在同一个session CAS中保存新discovery、清空候选、更新generation与round；生产队列原有searchRunnable及轮次围栏取消/忽略旧工作。只允许未选中且未确认制作状态；重选草稿开放search命令但不能开始制作，父版本保持不动。暂停/停止控制不变。

- [x] 扩展intake命令与服务端保存路径；title非空限制本地书库，空值映射auto，校验输入、重放和旧状态冲突，保持原范围/主题及控制状态。
- [x] 新建条件表单移除标题输入，加入“开始发现故事”按钮上方24px留白，范围及摘要“整本书”改为“自动”；提取窗口添加可选标题输入、提交/重提取按钮，初始/空结果/查找中均可编辑；重选复用同一组件。
- [x] 添加真实生产API回归：查找中改标题、旧结果晚到、重放/重启、空标题回自动、范围主题保留、已选/已确认拒绝、重选取消和原故事隔离。
- [x] 更新既有模式/UI回归以匹配标题位置；运行受影响的unit/integration suites、typecheck、lint。
- [x] 通过独立Playwright验证新建→提取→改标题→再提取，重开标题、重选草稿可用以及390px布局和按钮间距。

首个运行探针：在隔离生产fixture中阻塞旧suggestions，提交search使round递增，释放旧结果后确认只保存新标题的候选。若队列/轮次围栏不能满足该约束，先调整设计并重新AR，不继续UI接入。初始自动发现保持既有行为；用户提交标题后新轮次取代它，不引入额外的延迟启动标志。

浏览器：此前工具报告Work设置禁用了本地浏览器，若仍不可用，沿用独立Playwright测试会话。只修改网页UI，不打包桌面应用或Docker镜像。

AR risk: non-low — 查询意图、异步写入与重选草稿协同。
AR review round: 2; reviewer: reused
AR passed: no blocking architecture flaws

首个并发探针通过。命令回执复用现有search.requestId数据库触发器；不重复写lastAction以避免双重回执。搜索round拒绝晚到结果，generation拒绝旧选择，重放通过持久化回执返回最新状态。

验证：Node24.22.1 / pnpm11.25.0。85项受影响unit/integration测试通过（含5项新提取标题回归），typecheck和lint通过。独立Playwright E2E通过8种标题/主题/范围组合、新建标题位置、24px按钮留白、自动文案、修改/清空标题、单篇段落和重选草稿修改后取消保持原版本。390px截图已检查，未见横向溢出。日志：`/tmp/shiqu-editable-title-checks.log`、`/tmp/shiqu-editable-title-e2e.log`；截图：`/tmp/shiqu-editable-title/`。

实现里程碑待记录；CR/VR待完成。
