# 故事流程用例

## STORY-LIFECYCLE-C001 — 新建、提取、准备与确认制作

- State: READY
- Priority: P0
- Type: BUSINESS_E2E
- Requirement / Risk: R1
- Automation: AUTOMATED
- Owner: UNASSIGNED

### Objective

UI中完成新建至成品，验证手动启动、条件保留与确认门槛。

### Preconditions

全新独占书库，受控原文和模型可用。

### Test Data

合成原文A/主题/标题、3幅受控图片。

### Runner Instructions

使用Playwright语义定位操作UI；C006允许正式协议命令，C007允许启动子进程。其余API/SQLite仅只读核对。禁止访问真实书库。失败先留证，不能用隐藏写接口替代缺失UI。

### Expected Outcome

刷新前后条件及草稿一致，确认前零分镜/绘图，确认后分镜/审核/首图/余图/完成均有记录，阅读可用。

### Negative Assertions

切换标题或打开窗口不启动；未确认不绘图。

### Evidence Required

Run ID、构建、数据库位置、实际状态序列及断言；UI例含截图和trace，协议例含日志和具体对象状态。失败保存异常及分类。

## STORY-LIFECYCLE-C002 — 已生成故事的各编辑入口

- State: READY
- Priority: P0
- Type: BUSINESS_E2E
- Requirement / Risk: R2
- Automation: AUTOMATED
- Owner: UNASSIGNED

### Objective

UI改名及制作要求、验收、画风、叙事、分镜、结语编辑可提交，验证复用和历史。

### Preconditions

通过UI创建完成的同一家族故事。

### Test Data

编辑标记、另一画风、简短/详细、修改旁白和结语。

### Runner Instructions

使用Playwright语义定位操作UI；C006允许正式协议命令，C007允许启动子进程。其余API/SQLite仅只读核对。禁止访问真实书库。失败先留证，不能用隐藏写接口替代缺失UI。

### Expected Outcome

改名不生成；草稿丢弃不改版本；每类提交保留单卡片及历史，保存后刷新可读，结语/旁白无绘图输入变化时复用图。

### Negative Assertions

未提交不生成；旧版本/原文不变，不多一张卡片。

### Evidence Required

Run ID、构建、数据库位置、实际状态序列及断言；UI例含截图和trace，协议例含日志和具体对象状态。失败保存异常及分类。

## STORY-LIFECYCLE-C003 — 暂停、恢复与检查点

- State: READY
- Priority: P0
- Type: BUSINESS_E2E
- Requirement / Risk: R3
- Automation: AUTOMATED
- Owner: UNASSIGNED

### Objective

UI挂起首图时暂停，完成在途后不派后续；刷新保持暂停，明确恢复才继续。

### Preconditions

UI确认制作后，首图受控挂起。

### Test Data

3幅故事，首图独立闸门。

### Runner Instructions

使用Playwright语义定位操作UI；C006允许正式协议命令，C007允许启动子进程。其余API/SQLite仅只读核对。禁止访问真实书库。失败先留证，不能用隐藏写接口替代缺失UI。

### Expected Outcome

暂停持久且在途结果保存，后续等待；恢复后复用首图最终完成。

### Negative Assertions

只读观察/刷新不恢复、不重复首图。

### Evidence Required

Run ID、构建、数据库位置、实际状态序列及断言；UI例含截图和trace，协议例含日志和具体对象状态。失败保存异常及分类。

## STORY-LIFECYCLE-C004 — 失败与显式恢复

- State: READY
- Priority: P0
- Type: BUSINESS_E2E
- Requirement / Risk: R3
- Automation: AUTOMATED
- Owner: UNASSIGNED

### Objective

UI显示失败，刷新不重试，显式恢复只执行失败工作；审核无变化阻断后，分别验证手动修订重审和明确放行绘图。

### Preconditions

首图模型人为报错，其他生产流程真实。

### Test Data

一次失败、一次成功回执。

### Runner Instructions

使用Playwright语义定位操作UI；C006允许正式协议命令，C007允许启动子进程。其余API/SQLite仅只读核对。禁止访问真实书库。失败先留证，不能用隐藏写接口替代缺失UI。

### Expected Outcome

失败及故障标识持久；点击恢复后完成，已保存分镜/审核不重做。审核阻断时零图片；手动修订提交新版本重审，人工放行保留overridden记录。

### Negative Assertions

刷新和重复观察不买重试，旧失败回执不会被迟到保存清除。

### Evidence Required

Run ID、构建、数据库位置、实际状态序列及断言；UI例含截图和trace，协议例含日志和具体对象状态。失败保存异常及分类。

## STORY-LIFECYCLE-C005 — 重选取消与提交

- State: READY
- Priority: P0
- Type: BUSINESS_E2E
- Requirement / Risk: R4
- Automation: AUTOMATED
- Owner: UNASSIGNED

### Objective

UI打开重选等待，取消保留原版；明确提取并选择后切换同一家族新版本。

### Preconditions

已完成的UI故事和第二原文候选。

### Test Data

原文B、独立标题。

### Runner Instructions

使用Playwright语义定位操作UI；C006允许正式协议命令，C007允许启动子进程。其余API/SQLite仅只读核对。禁止访问真实书库。失败先留证，不能用隐藏写接口替代缺失UI。

### Expected Outcome

取消不改变当前版/控制，提交后需确认制作且完成，单卡片与旧版本历史保留。

### Negative Assertions

打开不提取，替换不复用旧故事图片。

### Evidence Required

Run ID、构建、数据库位置、实际状态序列及断言；UI例含截图和trace，协议例含日志和具体对象状态。失败保存异常及分类。

## STORY-LIFECYCLE-C006 — 状态机协议及媒体恢复

- State: READY
- Priority: P0
- Type: CONTRACT
- Requirement / Risk: R1/R2/R3/R4
- Automation: AUTOMATED
- Owner: UNASSIGNED

### Objective

复用正式REST/生产测试验证停止、重放、过期命令、重启、并发、图片丢失/恢复。

### Preconditions

独占数据库及既有状态机测试可执行。

### Test Data

受控失败、同命令ID、过期token、缺失媒体。

### Runner Instructions

使用Playwright语义定位操作UI；C006允许正式协议命令，C007允许启动子进程。其余API/SQLite仅只读核对。禁止访问真实书库。失败先留证，不能用隐藏写接口替代缺失UI。

### Expected Outcome

被拒绝状态转换不产生新工作；明确授权后恢复；媒体失效不会冒充完成，恢复原文件可核对复用。

### Negative Assertions

旧版本/旧回执不激活当前任务，不产生多余家族卡片。

### Evidence Required

Run ID、构建、数据库位置、实际状态序列及断言；UI例含截图和trace，协议例含日志和具体对象状态。失败保存异常及分类。

## STORY-LIFECYCLE-C007 — 开发入口与库隔离

- State: READY
- Priority: P0
- Type: BUSINESS_E2E
- Requirement / Risk: R5
- Automation: AUTOMATED
- Owner: UNASSIGNED

### Objective

实际启动pnpm dev local，证明local独立目录和默认兼容、私有文件拒绝访问。

### Preconditions

独立端口可用，readonly模型不调用外部。

### Test Data

开发空库；冲突SHIQU_DATA_DIR指向未创建哨兵目录。

### Runner Instructions

使用Playwright语义定位操作UI；C006允许正式协议命令，C007允许启动子进程。其余API/SQLite仅只读核对。禁止访问真实书库。失败先留证，不能用隐藏写接口替代缺失UI。

### Expected Outcome

local使用.data/dev-local；E2E每运行独占.data/e2e；原dev解析行为保留，退出释放服务。

### Negative Assertions

不读取桌面凭据、不写哨兵目录；HTTP不暴露SQLite。

### Evidence Required

Run ID、构建、数据库位置、实际状态序列及断言；UI例含截图和trace，协议例含日志和具体对象状态。失败保存异常及分类。

