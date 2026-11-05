# Claude Code 文本生产与火焰山对比

Claude 必须走拾趣正式的编排、结语、数量审核、全篇审核与修订流程；单次自由写作不能与已保存的 Gemini/Codex 成稿等同比较。

- [x] `SHIQU_AI_PROVIDER=claude` 从正式 CLI/server 入口可用，不改变桌面保存配置；支持 `CLAUDE_BIN`、`CLAUDE_MODEL` 与现有各任务推理档位。
- [x] 只使用 Claude Code 已有订阅登录；未登录、API 认证、异常退出、超时和无效输出可诊断，不切换计费方式。禁用工具、MCP、插件、技能、hooks 和会话持久化；不泄露原始错误或凭证。
- [x] 使用共享生产提示词、schema、本地校验与生产状态机，保留实际模型、用量、请求标识和任务档位；图片调用明确拒绝。
- [ ] 用独立新书库与已保存的同一 selection、选定原文和章节上下文制作《路阻火焰山》，保持 balanced/auto，运行到 reviewed；验证原文哈希和零图片，不复用其他模型分镜。
- [x] 保存 Claude 分镜、审核历史、输入一致性和比较报告；按具体内容比较完整性、忠实度、节奏与清晰度，说明单案例和运行历史差异。

不新增桌面提供方设置、不安装/升级 Claude、不生成图片、不改用户书库、不发布或推送。认证或服务不可用时完成适配和验证，保留可继续执行的输入与真实阻塞证据，不伪造成稿。

实际阻塞：Claude 五小时订阅额度耗尽，CLI 报告 2026-11-05 13:20 America/Toronto 重置。已保存 67 幅待审稿、4 次数量审核和 3 批结构修订，原文与章节上下文哈希相同，0 图片、无豁免。第 4 次复核建议的 65 幅尚未执行，全篇审核未开始；“运行到 reviewed”仍未完成。证据、固定恢复输入和报告位置见对应计划。

Follow-up user instruction (2026-11-05): comparison reports consolidated into `model-comparison-huoyanshan.md`; Claude and DeepSeek drafts saved as separate paused desktop-library copies. User explicitly requested both stories remain paused. Do not resume generation automatically when quota resets; wait for an explicit resume request. Exact copy/pause evidence is recorded in `plan-copy-comparison-drafts.md` and the consolidated report.
