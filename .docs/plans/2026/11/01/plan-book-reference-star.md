# 每本书一幅星标参考图

Git base: `2004f3dc275af9765013454aac973b394d86cbe1`。入口工作区干净。风险non-low：新增持久化/API及协调三provider、UI和付费图片输入边界。按普通实现完成到DD，SS里程碑本地提交，不自动push/最终GC。

当前每篇后续生图只传本篇首图，provider在page>0时才装载参考；参考文件严格限制本篇namespace。保持此防线，通过服务端复制已授权星标快照到目标故事的不可变artifact，再传同namespace引用。书级星优先，无星用原有reference；不增加第二张图或生成调用。

新增`book_image_references`，以owner_id/book_key为主键，存source_story_id/page、源图标识、每次设星新建的选择token及不可变媒体快照key。服务端从owned生成任务或published故事解析book；已知目录ID/标题使用同一key，other按trim后的自选书名/URL独立识别。媒体只接受现有reader/media、api/media和明确历史art映射，校验12MB、真实栅格类型及尺寸；将字节按内容哈希存到book-reference内部目录，引用不接收客户端URL。

API `GET/POST reader/library/:id/reference`从故事导出所属书；POST严格{page,starred,token?}，取消必须带GET返回的选择token。设星在读到实际图片并复制成功后单条UPSERT保证唯一；取消用book+source_story+page+token匹配删除，迟到取消不删后来同页重设（ABA）的新星。删除源故事由新增迁移的library_deletions AFTER INSERT触发器原子清除owner星标，GET/派发额外核查可见来源，避免并发删除后被旧提交复活。替换时验证源故事/页图片仍一致，通过INSERT SELECT保护检查到写入间变化。

共享`resolveBookReference(database,media,owner,id,fallback)`先读取服务端确认的目标故事/所属书，再解析当前星标并复制到目标story artifacts；无星返回原fallback。coordinator.image先解析实际参考，再只检查将使用的图片，避免有效星标被未使用的丢失首图阻挡；保持无星时原有lost-image错误和恢复。legacy API advance以同一helper包装generator.image，两个入口共用解析规则，不改变app provider实例或其它阶段。派发时确定的图片字节固定；不把全局星变动加入已有job版本，已有保存图与回执保持，星更换只改变将来的调用。三provider移除page>0限制，有reference即装载；共享提示词不再假定参考一定是本篇首图，身份优先、新场景和所选画风约束绘制。

导入兼容：将`server/import-legacy.ts`中的本地迁移豁免从0009扩展到新增0010；旧库只须具备历史旧版必需迁移，新表由导入后的openDatabase创建且为空，不要求旧D1有本地新迁移。

Reader顶部收藏旁加入独立星标控件，与整篇收藏分开。独立组件从GET加载书级选中信息，按storyId/page判定；同书页面切换刷新，组件卸载/翻页后旧异步响应不覆盖新页。图未就绪/状态未加载/请求中禁用按钮，使用aria-pressed和具体label，成功提示每书一幅/取消，失败toast并重读真实状态。

- [x] SS有界探测：备份实际SQLite并确认新增迁移可加装；探测in-app浏览器。如禁用，记录缺口，以静态React渲染、组件状态逻辑与实际服务E2E覆盖，不切换浏览器或设置。
- [x] 新增迁移及schema、book引用存储/媒体校验、严格API和删除源清理，保证唯一、所有权、CAS和无图/坏图防线。
- [x] coordinator/legacy统一参考解析与三adapter、共享图像提示词接线；保留同篇首图fallback与任务身份/付费回执，覆盖第一幅及后续、legacy路径。
- [x] Reader每页星标按钮及服务状态处理，更新README/使用与开发文档。
- [ ] 增加服务及provider/迁移/UI回归，执行typecheck、lint、完整TT与匹配ET。无新依赖或打包。

验证重点是实际图片字节是否进入新书故事第一幅/后续请求，替换后只改新调用、取消恢复本篇首图，跨owner/book隔离、无状态串页、可复用成功回执不重复付费。真实模型脸部一致性不由受控测试证明。


AR blocked: 取消缺少选择版本校验，且新增迁移与参考优先级尚有兼容缺口
AR risk: non-low — persistent ownership, concurrent selection changes, media authorization, legacy import and paid-generation dispatch.
AR review round: 1; reviewer: reused

已按三项发现收口：每次设星新token，取消必须匹配token，覆盖ABA；0010加入旧库导入本地迁移豁免；共享helper在coordinator选择/校验实际参考，并供legacy调用包装复用，有星不校验未使用fallback。返回AR2；尚无源代码修改。


AR fixed: 选择token防止迟到取消、旧库导入豁免及实际参考优先级缺口已补齐；rerun result passed
AR risk: non-low — persistent ownership, concurrent selection changes, media authorization, legacy import and paid-generation dispatch.
AR review round: 2; reviewer: reused

SS探测：实际库74任务/2118作业，一致性备份位于`library-backups/book-reference-star-20261102T001345Z/before.sqlite`。in-app浏览器返回`Local browser use is disabled in Work settings`，不切换浏览器或修改设置；UI采用React渲染与状态逻辑验证，服务使用真实REST/SQLite/FileMedia和受控三provider。新增迁移仅CREATE新表，无历史数据重写。

SS：存储/API/共享参考解析、三provider首幅附件、UI及文档已实现。55项组合回归通过；删除触发器与旧库导入空表断言完善后，最新26项（含6服务E2E）通过，日志`/tmp/shiqu-star-final-subset.log`，三provider与页面乱序hook均有直接回归。typecheck/lint通过，diff检查通过。in-app禁用，无视觉验收。

实际dev库在开发中先装载空0010表，最终触发器确定后已补建同一DDL，与最终0010对齐；无历史迁移改写。74任务、2118作业、0星标保持（`/tmp/shiqu-star-live-upgrade.json`），备份已先完成。GET原《黛玉剪香囊》reference返回200/null，未自动替用户选图。完整TT和独立CR/VR待执行。

SS milestone: `a82ea25` (`feat: star one page per book as a shared image reference`)。

CR passed: no major findings
CR risk: non-low — persistent ownership, concurrent selection changes, media authorization, legacy import and paid-generation dispatch.
CR review round: 1; reviewer: reused

CR1完整覆盖base至a82ea25，主要边界无重大问题。随后自查UI旧token取消响应：服务端保留新星时不能提示“已取消”；窄修提示为已更换并同步，添加同页迟到取消响应测试，返回CR2影响复核。
