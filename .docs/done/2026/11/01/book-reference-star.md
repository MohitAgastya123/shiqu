# 每本书一幅星标参考图

## Summary

阅读画面顶部新增星形按钮，与整篇收藏分开。每个用户、每本书最多一幅参考图，可替换、取消并在重启后保留；无图与结语页不可设星。

同书之后实际发起的生图优先使用星标快照，包括新故事第一幅。没有星标时首幅无参考，后续仍用本篇首图。已保存图片、在途请求及已付费结果保留，不自动重绘。三个provider及legacy入口均接入实际图片附件。

## Verification

- `pnpm test`867/867，约45.3秒；服务E2E6/6；typecheck、lint、diff检查通过。日志`/tmp/shiqu-star-all-tests.log`、`/tmp/shiqu-star-e2e-final.log`及`/tmp/shiqu-star-typecheck.log`、`/tmp/shiqu-star-lint.log`。
- 独立AR2、完整CR1/影响CR2、VR1通过。请求捕获验证三provider首幅与后续附件；回归覆盖唯一、token/ABA、源删除、所有权、坏图、重启、在途/回执保留与UI乱序。
- 先一致性备份实际书库，新增空表及原子删除触发器。74任务、2118作业、0星保持；`/tmp/shiqu-star-live-upgrade.json`。未替用户自动选图。

## Notes

- Git base`2004f3d`；本地实现里程碑`a82ea25`、提示修正`f362b18`。按用户“DD GC”完成交付收尾，保留两次实现里程碑；不push。
- 服务与UI状态契约已验证；in-app浏览器被设置禁用，未做视觉验收或真实模型人物一致性评测。没有付费生图或打包。
- 建议选择主要人物面貌清楚的画面。每书只有一张参考，未出现在图中的人物仍依照该篇设定绘制；当前故事所选画风和新场景继续生效。

## Final VR

VR passed: all acceptance criteria complete

对照REQ、AP、E2E、`2004f3d..f362b18`实现、CR1/CR2及最终证据，六项标准全部complete：

1. **每页星标与异步状态：complete。** 星标与收藏分离，具有明确label、pressed和busy状态；无图禁用，独立结语页不显示。共享操作锁和请求序号阻止重复提交及迟到响应串页；失败重新读取真实状态。旧token取消返回新星时，提示准确说明已同步最新选择。静态渲染及hook乱序回归覆盖。
2. **每用户每书唯一并持久化：complete。** owner/book联合主键保证唯一，设星替换、token取消、重启及已知书名归一有回归。同书故事及版本共享选择，其他书隔离；图片只从服务端确认的生成故事或已发布故事读取，不接收客户端媒体地址。
3. **实际生图参考与fallback：complete。** coordinator和legacy共用解析逻辑，将授权快照复制到目标namespace。三provider首幅和后续均捕获到真实图片附件；无星时首幅无参考、后续使用本篇首图。有效星不受未使用首图文件丢失阻挡；提示词保留选定画风和新场景约束。
4. **在途及付费结果保留：complete。** 星变化不改变job版本或身份，也不触发编排、摘要修改或自动重绘。在途请求保持原字节，后续调用使用新选择；服务E2E验证替换、取消、已保存图片及回执身份保留。既有队列恢复回归继续通过。
5. **授权、竞态及失败防线：complete。** 所有权、所属书、可见性、页码及本地栅格校验在服务端执行；严格API拒绝伪造地址和跨站写入。设置CAS阻止删除期间复活，删除触发器原子清星，token保护迟到取消及ABA。缺失或损坏快照在模型前失败，仍可取消；目标namespace防线保持。
6. **迁移与最终验证：complete。** 0010新增空表及删除触发器，旧库导入正确豁免本地迁移。备份后的实际升级记录显示74任务、2118作业、0星标保持，没有自动选图。最终TT867/867通过，约45.3秒；服务E2E6/6、typecheck、lint及diff检查通过。

全部AP任务完成，CR1/CR2无未解决发现。最终证据包括`/tmp/shiqu-star-all-tests.log`、`/tmp/shiqu-star-e2e-final.log`、typecheck/lint日志及`/tmp/shiqu-star-live-upgrade.json`。

浏览器设置禁用，证据仅覆盖UI渲染与交互契约、真实REST/SQLite/FileMedia和受控provider请求；不声称视觉验收或真实模型人物一致性。未付费生图或打包。

VR risk: non-low — persistent ownership, concurrent selection changes, media authorization, legacy import and paid-generation dispatch.
VR review round: 1; reviewer: reused
