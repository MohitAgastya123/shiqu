# 作品知识查漏与原文核实

## Summary

旧规则强调不能凭记忆补写情节，却没有明确要求模型利用作品知识主动发现原文范围和叙事衔接的缺口。新增共享的 `storyKnowledgeDirection`：允许作品知识和既有审核作为查漏线索，回查已提供原文后采用；原文不足时须先补齐可核对的文本与出处，不能把记忆、史实或其他版本当成本版原文。

规则接入提纲与分镜编排、数量审核、全面审核、结构修订和局部修订。建议幅数和旧报告仍不作为正确答案，既有事实边界与输出协议保持。

## Verification

- `pnpm exec node --experimental-strip-types --test tests/story-editorial.test.mjs tests/story-completeness.test.mjs tests/adaptive-storyboard-review.test.mjs`：21/21 通过。
- `pnpm typecheck`、针对三个修改文件的 `pnpm exec eslint`、`git diff --check` 通过。
- 当前三个源码文件与上述验证时的内容逐字一致，复用本会话有效验证。环境为 Node 24.22.1、pnpm 11.25.0。
- 实际文字请求回执确认新规则进入生成和审修阶段；这证明程序串接生效，不证明模型能稳定一次发现全部遗漏。

CR passed: no major findings

CR risk: low — 仅增加共享提示约束与阶段接入，没有修改 schema、依赖或持久化协议。

CR review round: 1; reviewer: not applicable

最终程序验收如下：

1. **共享规则完整**：作品知识与旧审核可用于查漏，事实仍须在本次已核原文中核实；不同版本和未经执行的查找不能冒充证据。
2. **阶段接入完整**：规划、分镜细化、数量审核、全面审核、结构修订和局部修订使用同一共享规则；实际请求已核对。
3. **兼容约束保留**：固定幅数、已有输出格式、原文引用及事实归属约束未放宽，没有新增字段、自动检索或自动扩章流程。
4. **验证完整**：相关用例、类型与静态检查通过；当前源码与被验证内容一致，没有未解决的程序问题。

VR passed: all acceptance criteria complete

VR risk: low — 修改局限于提示词程序，运行数据与外部协议不变。

VR review round: 1; reviewer: not applicable

## Notes

数量门仍使用原有离线入口，本次没有将它接入正式生产队列。提示词允许指出待补原文，不等于程序已经具备自动扩章能力。

本记录及 GC 仅包含程序修改与验证；不记录故事内容、画幅数、书架修订结果或媒体。未构建 Docker 或桌面安装包。
