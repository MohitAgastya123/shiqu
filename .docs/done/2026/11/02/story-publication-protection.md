# Story publication protection

Stories save public attribution/reuse terms independently of generation. The single ZIP excludes private prompts and retains original text, public notices, numbered WebPs, XMP and scoped hashes. Images have only the 12px bottom-right credit. PDF/PNG retain credit and AI disclosure.

The user withdrew invisible watermarking on 2026-11-02. Its model assets, runtime dependency, detector, token metadata and adaptive retries have been removed. Unpublished trial archives are restored to the reader repository's committed versions. Source-library images, including the completed latest 梨香院 revision, are retained. The hero QR is retained.

Rollback verification: Node24.22.1/pnpm11.25.0 full996/996 tests, typecheck, lint, frozen offline install and ordinary build pass. The actual default browser encoder produced a two-frame19,354-byte synthetic ZIP with 12px credits, XMP and hashes; the reader parsed and decoded both1152×2048 images at390px without overflow or watermark UI. Reader67/67 tests and build pass. Trial servers, model copies and experiment caches are removed. No push or remote-history rewrite has occurred.

Local history cleanup follows the reviewed bounded plan: consolidate only unpublished feature commits onto the verified shared base; preserve other refs and original source data. No remote push.

## Final independent review

AR passed: no blocking architecture flaws. CR fixed: stale reader fixture/model claims reconciled with the ordinary export; rerun result passed.

两项 RPD 的保留功能验收如下：

| 本站 REQ | 状态与证据 |
|---|---|
| 独立保存公开声明及并发保护 | 完成；CAS、所有者、删除、重启、迟到 checkpoint 和版本继承测试通过。 |
| 阅读设置编辑且不触发生成 | 完成；保留原实现及有效保存、重开证据。 |
| 单一完整 ZIP、原文与公开声明 | 完成；正式普通编码导出 19,354 字节合成包，完整两幅，无内部提示词。 |
| 原尺寸、12px 署名、原图不改 | 完成；两幅 1152×2048 解码，导出独立处理，没有隐形像素处理。 |
| PDF/PNG 与声明一致 | 完成；实现未回退，既有有效证据及本轮回归保留。 |
| 归档合同与缓存更新 | 完成；实际目的站解析通过，内容及声明参与缓存身份。 |
| 检查和浏览器验证 | 完成；996/996、类型检查、lint、冻结离线安装及普通构建通过。 |
| XMP 与明确范围的哈希 | 完成；RIFF/XML、载荷、原文件及最终文件哈希测试保留并通过。 |

| 阅读站 REQ | 状态与证据 |
|---|---|
| 制作人与投稿者分离、旧格式兼容 | 完成；真实新包及旧格式测试通过。 |
| 原字节保留及最终 SHA 校验 | 完成；ZIP、导入、构建和独立 manifest 路径均覆盖。 |
| 安全显示署名、来源与使用条件 | 完成；安全 DOM 与授权边界保留，检测入口已移除。 |
| 白名单、恶意输入和路径限制 | 完成；字段、链接、重复路径、预算和释放测试通过。 |
| 真实导出与子路径验证 | 完成；新 fixture 两幅在 390px 解码，无溢出；67/67 与构建通过。 |
| 文档和生产作品边界 | 完成；10 份试验 ZIP 已恢复，17篇/567幅生产集合保留，无推送。 |
| 用户追加二维码位置 | 完成；二维码位于作品集链接上方，桌面及窄屏证据有效。 |

VR risk: non-low — persisted publication data and untrusted archive/manifest contracts.
VR review round: 2; reviewer: reused.
VR passed: all acceptance criteria complete.

以上 VR 对应撤回隐形水印后的两项功能 RPD。历史清理尚待执行并记录结果；最新17篇/551幅重导出与发布仍是独立待办。

## Delivery boundary

The user explicitly authorized DD/GC and removal of failed feature history. Only unpublished local feature commits are consolidated onto verified remote main; unrelated refs and pre-existing dangling objects are preserved. GC independently checks forbidden blobs/commits are absent and other refs/remote unchanged. The latest17-story export and publication are separate work.
