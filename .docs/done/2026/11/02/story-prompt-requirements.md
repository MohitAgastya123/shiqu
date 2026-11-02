# 故事要求显形与流程操作修正

## Summary

制作要求与验收要求成为每篇故事的并列入口。系统规则可展开预览，实际制作/审核提示词随版本留存，沿用旧记录明确标记来源，未留存的历史不补造。验收逐条给出结果与依据；可修项进入修订，冲突或无法判断项停止绘图。仅改验收保留分镜与可复用图片。

流程页恢复生成使用绿色主按钮，返回书架统一为次级按钮；补齐阅读后的制作流程出口，并统一导航关闭弹窗、退出读页和显示书架。

## Verification

- Node 24.22.1 / pnpm 11.25.0：typecheck、lint 通过。
- 完整单元/集成套件限并发2运行：981/981通过；默认并发曾有一个80幅用例超时，同用例独立及限并发运行均在原15秒限制内通过，未放宽断言或超时。
- 修改后的针对性验证：审核/提供方/流程16项、兼容性/持久化/UI13项，以及操作修正后的UI/修订10项、UI/导航17项通过；复用未受影响的完整套件证据。
- IAB受控真实界面验证：双入口、两套草稿保存/刷新、完整提示词复制并粘贴核对、历史未留存、只改验收复用3幅重绘0幅、暂停与阅读流程的主次按钮及真实返回书架。失败修订与未知阻断由REST/SQLite/队列集成验证。
- AR两轮、CR三轮和VR独立审查通过。以下保留完整VR结果。

VR passed: all acceptance criteria complete

VR risk: non-low — the complete story changes persisted requirements, provider requests, review gates and version provenance.
VR review round: 1; reviewer: reused

| Criterion | Verdict and evidence |
|---|---|
| Two sibling requirement entries | Complete. Creation, paused and reading flows use the two shared editors; primary IAB evidence and shared UI tests cover their presence. |
| Independent per-story persistence | Complete. Optional schema preserves legacy records; intake draft/restart/confirmation and revision tests establish separate saved values and inheritance. |
| Inspectable actual prompts | Complete. Three-provider request/capture equality tests cover instructions, input and output contract. Owner-scoped retrieval preserves origin and reference links. IAB copy/paste and historical no-record evidence recorded. |
| Criteria govern review and repair | Complete. Strict validation rejects missing/duplicate/invalid results. Failed criteria enter repair and fresh audit; unknown criteria stop repair/drawing with evidence and an edit route. |
| Acceptance-only version reuse | Complete. Revision logic preserves scripts/images and resets review. Integration and IAB evidence show three reused, zero redraw, new review capture and unchanged original. |
| Results, legacy state and preserved behavior | Complete. Shared UI displays criterion evidence and missing history. Legacy missing-usage regression, provider contracts, queue/revision suites and shared timeline parity cover compatibility. |
| Primary resume and secondary shelf return | Complete. Shared controls cover all four rendering branches. Navigation tests and IAB evidence verify actual shelf navigation. Independently inspected both saved flow screenshots: green resume and outlined shelf exit are visible. |

Validation evidence: full suite passed **981/981** with concurrency 2; the default-concurrency 80-frame timeout and successful isolated/bounded reruns remain disclosed. Typecheck, lint and subsequent focused checks passed. No test assertions or timeout limits were weakened.

No remaining acceptance gaps. Browser interaction evidence is reused from the primary agent; screenshots and implementation were independently inspected. No tests were rerun during this review.

## Notes

提示词记录会增加本地存储，仅按需读取，未加入书架/进度轮询响应。文字分镜验收不会声称检查了实际成图。所有模型回执和演示故事均为受控测试；不代表真实模型的语义质量。未构建Docker或桌面安装包，未触发真实模型调用。临时预览已关闭。

实现提交：3c0ce39、5033753、1aa7888。并行修改的AGENTS.md不属于本次交付。
