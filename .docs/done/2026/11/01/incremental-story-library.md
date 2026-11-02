# 无摘要提取、原文批量匹配与选中后摘要

## Summary

寻找阶段只识别故事名、简介和真实原文范围，故事及未完事件不再生成摘要。主题匹配直接批量读取完整原文，严格返回yes/no和一句理由，每批最多4篇、按输入预算缩批。判断单独缓存，符合项供逐个消费；旧通用库保留可信范围/游标/跨章证据，不复用旧摘要判断或重扫已识别范围。

Codex/OpenAI匹配独立使用Luna/low，Gemini沿用自身文本模型/low，其他阶段保留原模型。选中后、首次分镜前才依据原文生成并保存summary；新摘要优先2–3句、尽量80–150字，含起因、关键行动和实际结果。分镜依原文编排，审核借摘要查漏。旧摘要及已完成故事不强制重写。

## Verification

- 完整`pnpm test`877/877，约43.5秒；最终服务E2E17/17，约6.8秒；主定向与书库定向分别78/78。typecheck、lint及diff检查通过。
- 日志：`/tmp/shiqu-deferred-all-tests.log`、`/tmp/shiqu-deferred-e2e.log`、`/tmp/shiqu-deferred-focused.log`、`/tmp/shiqu-deferred-library-tests.log`及typecheck/lint日志。Node24.22.1/pnpm11.25.0。
- 单次Codex订阅探测：实际gpt-6-luna/low，2篇短原文，3166ms返回二元判断和理由，无摘要。证据`/tmp/shiqu-luna-match-probe.json`。初次沙箱子进程退出、端口测试EPERM均在同一脚本/测试获准所需权限后通过，未改断言。
- 独立AR8/AR9、完整CR6、VR5通过。受控测试不代表真实主题准确率；单次探测不代表稳定提速。

## Notes

- 故事base e51429b；本轮SS里程碑`5b03678`。用户已授权DD GC收尾，本次仅提交本故事四份收尾文档，保留实现里程碑，不push。后续独立书籍参考图星标功能未改。
- 本轮不改真实书库、历史故事或三份《黛玉剪香囊》对照，不重新迁移SQL/媒体或改付费图片回执，不打包。未做浏览器视觉验收。
- awesome-shiqu是独立阅读器，已只读确认ZIP解析、公开清单和显示仍使用hook，需要另外同步summary及旧作品兼容；本轮没有修改它。

## Final VR

VR passed: all acceptance criteria complete

对照当前 REQ、AP、E2E、`e51429b..5b03678` 本故事实现、CR6 及最终证据，现行16项验收标准全部 complete：

1. **无摘要中性提取：complete。** catalog 不接收主题或制作偏好，只输出标题、简介和可核对原文范围。故事及 pendingEvents 均不生成摘要；未完事件依靠名称、ID、范围和真实原文续读。主故事、子故事及范围冲突约束保留。
2. **增量发现：complete。** 优先匹配已有库，必要时继续识别原文，不预扫描全书。阅读游标、跨章证据、选中停止和离开取消保持，有章节、原文及服务回归。
3. **原文二元匹配：complete。** 第一次请求即带完整原文，输出严格为 ID、yes/no 和简短理由，不读取或生成摘要，也无 review 复核分支。非法类型、ID 缺漏重复、调用失败及原文问题不会缓存成 no。
4. **缓存复用与升级：complete。** 故事库与主题回执分层持久化。冻结旧 catalog 指纹定位已有库，在共享锁内校验并投影保留可信范围、游标和 pending 证据；旧文件保留，旧摘要回执不冒充新原文判断。重启、旧媒体接续和写失败重试均有回归。
5. **历史游标与并发：complete。** 不沿用无法证明完整覆盖的旧主题游标。主题间共享提取，同主题共享匹配；单个读者取消不终止其他读者所需工作。迁移与提取使用同一锁，现有缓存命中不等待新扩展。
6. **三provider及Luna路由：complete。** Codex/OpenAI 主题匹配使用 `gpt-6-luna/low`，明确返回其他模型时失败，不静默降级；Gemini 使用自身文本模型/low。提取、摘要、分镜及审核沿用原配置，匹配身份独立参与主题缓存。受控路由、runner 和错误身份测试通过；实际订阅探测证实 Luna/low 可返回两篇原文的二元判断。
7. **选中后准备摘要：complete。** 新候选没有 summary/storyBrief，只携带服务器匹配理由和原文定位。选中后复用准备/画幅建议调用，依据真实原文生成摘要并核对理由，保存 verified 检查点后才确认或编排；简介不充当摘要。主题、原典、重选、重启及失败重试均有覆盖。
8. **原文编排、摘要审核：complete。** 短篇、outline/batch、标题/结语及 repair 不接收独立 storyBrief 或嵌套 summary；保留原文、节点、已有分镜及其他元数据，原对象不变。审核保留摘要，先独立对照原文，再检查范围、阶段和结局遗漏；冲突服从原文。显式未核对摘要仍在模型调用前被拒绝。
9. **开场与既有叙事规则：complete。** 第一页直接从原文提取必要背景、人物关系与处境，不把摘要当开场、不提前泄露结局，无独立设局字段。节奏、因果、静态画面及连续性规则保留。
10. **最终验证：complete。** 完整 `pnpm test` 877/877 通过，约43.5秒；最终服务E2E 17/17 通过，约6.8秒；主定向和书库定向分别78/78通过。typecheck、lint及diff检查通过，CR6无未解决发现。
11. **summary字段统一：complete。** shiqu-docker 的类型、输出、SQLite、API、编辑展示、版本保护和ZIP继续统一使用 summary，无运行时 hook 别名；准备摘要由 engine 保存为归档元数据。
12. **历史迁移与付费回执安全：complete。** 既有 SQL9、媒体JSON、幂等重试、失败回滚、旧库导入和图片身份/依赖迁移的审查与测试证据继续有效。本轮未改变这些边界，也未重新迁移真实书库或改写图片回执。
13. **实际书库升级证据：complete。** 复用此前一致性备份及 `/tmp/shiqu-summary-live-migration.json`：升级当时72任务、3故事、2118作业数量保持，828作业身份映射、4份JSON转换、1144个二进制文件大小及mtime保持、9篇中性摘要保留，无新增verified标记。该证据描述此前升级，本轮未重复执行。
14. **首次编排缺摘要兜底：complete。** 旧式短篇/长篇入口仍先保存原文和摘要，再调用 plan/outline；失败不进入编排或绘图，重试复用检查点。确认状态和选定幅数保持，已有提纲续编不重复提纲，成品及普通读取不自动生成。
15. **有界批量、预算与取消：complete。** 每批最多4篇，按完整 prompt/schema/payload 输入预算缩批，不等待凑满、不截原文；单篇超预算在付费前失败。合法整批按 ID 核验后保存，符合项供逐个消费，同批剩余项复用。取消后保留已完成合法回执，不启动下一批，其他读者继续。
16. **简短完整摘要：complete。** 准备及归档共享提示词要求优先2–3句、尽量80–150字，保留起因、关键行动与实际结果；简单故事不凑字，复杂故事为完整性适当加长。1200字符兼容上限不变，不截断或强制重写历史摘要，不增加调用。

本轮 AP 七项任务全部完成。最终证据为 `/tmp/shiqu-deferred-all-tests.log`、`/tmp/shiqu-deferred-e2e.log`、`/tmp/shiqu-deferred-focused.log`、`/tmp/shiqu-deferred-library-tests.log`、typecheck/lint日志及 `/tmp/shiqu-luna-match-probe.json`。本次终验只读，未执行验证或修改文件。

受控测试证明契约、隔离和恢复行为；单次约3.1秒的 Luna 探测证明模型可用，不代表古文主题准确率或稳定提速。未做浏览器视觉验收、打包、push或历史故事重做。awesome-shiqu 仍使用 hook，本轮只读确认且未同步，不属于本次验收交付范围。

VR risk: non-low — discovery and candidate contracts, persistent cache compatibility and concurrency, per-task model routing, and source-bound paid-generation prerequisites.
VR review round: 5; reviewer: reused
