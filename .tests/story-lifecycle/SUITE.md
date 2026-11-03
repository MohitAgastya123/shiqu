---
schema: test-manager/suite/v1
suite: story-lifecycle
title: 故事新建、编辑与状态机
risk: HIGH
state: ACTIVE
owner: UNASSIGNED
planned_start: UNPLANNED
planned_end: UNPLANNED
---
# 故事新建、编辑与状态机

目的：验证开发数据库上新建、编辑、重选、失败恢复的真实用户流程和状态机边界。风险R1/R2/R3/R4/R5分别由C001/C002/C003-C004/C005/C007覆盖，协议C006补充幂等、重启、竞态与媒体核对。

依赖：Node24、pnpm、Playwright Chromium、生产SQLite/媒体和受控模型adapter；无外部账号/密钥。构建6c791fa起的工作区，实现完成后记录hash/diff。

数据：独占`.data/e2e/<run>`，两段合成原文及控制图片；UI状态由真实命令生成，不直接伪造持久状态来证明UI路径。媒体丢失等故障只在协议场景注入。UTC记录时间。

Entry：7例READY，启动隔离探针通过。Exit：7例当前有效PASS，无P0/P1缺陷；无法执行的路径记录FAIL/BLOCKED并影响判定。复跑追加而非覆盖。用户未授权发布或真实库修改。

回归：pnpm test及test:e2e覆盖；修改启动目录要重测local/默认兼容和私有文件，改状态机要回归重试/版本隔离。

已知限制：受控回执不能证明真实AI内容/图片质量；Playwright是独立会话。UI没有停止按钮时以协议覆盖，不声称UI支持停止。
