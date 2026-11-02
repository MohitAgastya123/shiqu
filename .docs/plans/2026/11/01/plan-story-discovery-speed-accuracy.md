# 故事提取与主题匹配的速度和准确度

需求：[REQ](../../../../reqs/2026/11/01/req-story-discovery-speed-accuracy.md)。执行场景：[E2E规范](../../../../tests/test-story-discovery-speed-accuracy.md)。

Git base: `8463bd5abb27b9452da11650107afad6f547ea93`

风险 non-low：改变付费调用调度、跨范围缓存身份、并发写入和阅读位置迁移。当前入口只有本故事REQ未跟踪，无既有源码变更。此次仅修订REQ、编写AP和执行AR；不实现、不运行测试、不调用真实模型。

## 已核对的现状

- `server/story-theme-matching.ts` 在库命名空间内整批校验、整批写入；单篇超预算或回执ID异常使后续故事无法继续。提取配置/章节范围也进入判断命名空间，导致相同原文重复判断。
- `server/local-story-discovery.ts` 将全部故事和pending的有效性作为整份缓存读取条件；`mergePending`失败时尚未保存本次合法故事；有任意拒绝就不推进本块。
- `server/story-reading-inputs.ts` 每块12,000本地估算token，额外限制两章；`readingPlanKey`进入故事库键。Gemini估算使用UTF-8字节数。`lib/reader-suggestions.ts`进度schema也限制两章，不能只改分块器。
- 三适配器都先做完整匹配schema解析，合法部分到不了协调层。catalog的schema及运行时目前最多5篇，实际冷1/续4；OpenAI/Gemini扫描输出上限10,000，Codex有schema、120秒期限和32MiB流量上限，没有现成的逐请求输出token选项。
- 提供商内部已有usage，但发现接口丢弃；Codex将多数运行故障压为宽泛错误码，不能可靠地把它们判成故事错误。
- `StoryDiscoveryCache.shared`是单次共享执行，不是每个调用者都执行的互斥锁；`FileMedia.put`原子替换文件，但不保护读改写。`MediaStore`没有列目录接口；迁移应按已知旧键读取，不能假设能枚举历史主题。
- 自动继续会增加`IntakeSearch.round`，所以不能拿round或HTTP请求当隔离预算周期。现有持久document可加内部可选字段，无需数据库表迁移。

## 设计决定

### 缓存、回执和原文边界

保留范围独立的中性故事库，不合并全书/章节库。主题判断另以原典ID/版本、规范化标题、规范化范围、解析出的完整原文内容指纹、规范化主题、匹配提供商/有效模型/档位及语义契约版本定位。不能使用scope裁切后的`book.input.text`作为可移植原典身份。提取模型、档位、提示词、分块和范围不进入判断键。语义契约显式版本化，不把JSON属性顺序或短编号当语义变更；旧摘要判断不导入。

内部故事仍用稳定完整ID。三提供商线上请求改用批内1–4短编号，序列化为稳定原文列表在前、主题在后；每项输出reason后verdict。适配器公共解析器先验证外壳，再逐项解析并映射回内部ID；重复编号的全部冲突项、未知编号和非法项不缓存，其余合法项立即返回协调层。缺失项进入隔离，不能在适配器整批parse时提前丢掉合法项。整份JSON无法解析才视为整批非法。保持完整原文和4篇/输入预算上限，不新增摘要或审核调用。

catalog路径也重排`localSuggestionPayload`：book/edition及稳定的本块text放在前面，已排除标题/范围、pending、contextText等变化字段在后。保留原有字段语义，不将变化的scan/context混进稳定原文前缀；三适配器对实际序列化请求检查顺序，不能只验证构造对象。旧主题scan、自选书籍与制作路径不借此重构。

缓存增加短时按键串行的`update`读改写能力，每个排队修改都执行，写前重新读最新值；模型等待不能占写锁。匹配记录逐篇合并，读到yes可直接返回，不等待其他在途批次。并发保障限定现有单服务进程，不引入跨进程锁；旧文件保留，不承诺旧二进制读到新格式或并行写同一数据目录。

故事库先校验状态外壳与覆盖，再逐条解析故事/pending；单条无效只删该条，其余与游标保留，修复写回失败则报持久化错误，不调用模型。无法解析的整份JSON/状态外壳仍走既有损坏处理。迁移读取旧文件时仅在新目标键写修复结果，不改旧源文件。跨章回执先暂存独立合法故事，再尝试原子更新pending和位置；pending不一致时只保存不依赖该错误证明的故事及诊断，保留全部旧pending/位置。有新故事先匹配，无进展再报可重试错误。不能把模型的resolved声明当作服务器已核对的续完证明。

修复回执中的后续pending收束不能只查本次新accepted：请求附上相关已存完整故事的标题/定位作为既有完成证据，并明确允许resolvedEventIds确认它们收束的旧事件，不再输出/插入该故事。服务器重新校验该缓存故事仍有效、当前回执明确对应旧事件且覆盖该事件全部旧证据，再原子移除pending；未知ID、覆盖不足或不一致仍保留旧pending，不仅凭缓存范围包含自动清除。pending减少或合法推进本块同样算进展，不能因accepted=0再报无进展；容量满额和其他原文错误仍禁止推进。

80%仅为按sourceUnitIds计算的疑似重叠诊断。真正拒绝仍按REQ的同范围、同名重叠、无新证据交叉规则；不增加语义去重调用或按名字特判。仅重复拒绝且回执未满并明确完成可推进，原文/续完错误及满额优先阻止推进。

### 有界失败与并发

新增可选内部`search.cycleId`，创建/显式手动more产生新ID；automatic more、租约离开/重开和重启沿用。旧任务缺字段时用session ID和首次兼容round生成并持久化，再开始调用；不能每次恢复生成新ID。独立建议请求生成请求周期，不改外部接口。`StoryReading`/`ReadingObserver`携带内部周期上下文，`withLocalBooks`转发；不向模型发送周期信息。

周期预算及已隔离故事ID放媒体缓存独立周期记录，通过`update`在调用前预留；最多8次，不能因HTTP请求或取消释放已消耗预算，崩溃后未能确认是否发送的预留不返还。按周期去重共享调用的收费标记；加入已有隔离调用前也须预留，否则只能使用其完成后已保存的判断，不能触发新调用。持久记录只存受限计数、调用标识、故事指纹与失败枚举，不含主题或原文。

一批故事错误后，先保留合法部分，对剩余至多逐篇隔离一次，不递归拆分；新增调用≤未判断篇数且受周期8次上限约束。隔离失败/预算不足持久标为unknown，跳过并继续正常未尝试故事和未读原文；原文未读完前不为旧unknown重付费。只有启动时已穷尽当前范围且无未展示yes的新手动周期可重试旧unknown。超预算仅重新检查可调用性，不发送请求。unknown不能写no；原文已读完时返回明确不完整说明。

错误采用白名单分类：可识别的拒答、合法传输后的非法输出、确认进入推理后的超时才可隔离；鉴权、配置、额度/速率、网络、5xx、CLI启动/协议/退出及未知运行故障停止派发。Codex不能从不明`GENERATION_FAILED`猜测拒答；未进入turn的超时属服务故障。取消信号单独传递，不吞成unknown。日志和安全错误只用固定枚举，不带提供商原始消息。

同进程共享匹配调度器最多3个在途调用，包含隔离；按稳定故事判断身份占用在途槽，跨章节库/读者不重复请求。正常待判按原文顺序组至多4篇，预算缩批；只为有活跃需求的读者派发。任一批有yes先保存后返回；其他最多两批完成后保存。服务故障关闭该失败查找的派发，其他读者不受其取消影响；同服务故障影响的等待工作不继续撞请求。锁、预算预留、槽位领取均为短操作，不跨模型等待；槽位在真实调用完成后释放，避免取消后超发。缓存yes不排队。

### 提取容量、分块和升级

冷库请求1篇；后续先以最多32篇作为有限扩批上限，受每次输出容量进一步缩小，schema与运行时一致。OpenAI/Gemini输出预算采用`min(32768, 1024 + 768 × maxStories)`；冷1保持现有10,000容量，不借容量缩减改变首篇行为。Codex只使用已支持的schema/期限/流量限制，不虚构token限制或新增未经验证的协议参数。任何截断/非法外壳不标记读完、不自动扩大上限；容量不足要通过首个SS探测回到AR。

分块保留12,000/400,000现有预算，删除两章限制；Gemini使用已安装`o200k_base`本地容量估算并明确是估算，实际usage另计，不新增计数API/依赖。合并仅连续原文单元，保留chapter粒度完整单元与超大章节拆分防线。进度schema允许实际多章；现有两处进度展示以“首章至末章（共N章）”压缩多章文字，1–2章保持现状，不新增流程/设置。

更改键前冻结当前v3分块器、catalog提示词/schema和命名空间计算，也冻结旧原文匹配prompt/schema、themeDecisionKey序列化和旧`themeStoryId`的原始标题/localSourceKey算法。必须能从任意请求主题及已知有效匹配配置重新计算旧文件键、将旧ID映射至新故事身份，不只保存几个fixture常量。不用新算法校验旧cursor。升级按当前原典、范围及提取模型/档位读取旧无摘要库与已有摘要兼容路径，不枚举未知配置的历史缓存。新键下已有状态优先，迁移与新提取共用同一个写锁，不能晚到覆盖。

从旧manifest中cursor之前的完成块推导最后已完整覆盖的原文单元：新块全在覆盖前沿之前则跳过；只有跨越该前沿的新块可重读一次，原有故事用于排除；旧库exhausted且覆盖完整则新库仍exhausted。pending原范围和有效故事原样保留，旧readThrough不能冒充完成。新状态保存来源版本/前沿后才采用新cursor；写失败不触发提取，重启仍可重试。无可信旧manifest则不采信旧游标，不引入凭空覆盖。匹配旧键按当前请求主题惰性读取，仅接受相同语义的原文yes/no契约与有效匹配身份并核对故事指纹；没有可证明兼容的旧回执就重新判断，保留旧文件。

### 测量和离线评测

在三适配器的发现调用边界记录一次受限测量事件，覆盖传输成功后解析失败和取消后的完成。共享调用在实际执行者计一次；缓存命中不伪装成模型调用。事件含stage/provider/model/effort/duration/status/requestedCount/acceptedCount和白名单输入输出token；缺字段为null，usage中的其他字段不整包写日志。Codex/HTTP错误在安全分型前截断为枚举，不新增原始响应采集。

查找级聚合按周期记录首个新故事持久化与首个符合项返回两个时间，另列冷/热、无结果、unknown、失败、取消、实际调用数/隔离数和已知/未知usage。早返回后继续归属同周期的在途调用，按调用ID去重；无符合项的耗时不能当成首个符合项耗时。只输出受控时序或标注来源的录制耗时，不估算真实提速。

新增`data/evals/story-discovery/`版本化标注草稿和离线回执：30–50对覆盖≥3书及≥3章完整预期范围。已有捕获回执可复用；合成回执必须标controlled，不伪称真实录制。标注元数据明确版本、正负例及争议、模型/档位/契约、录制来源；没有真实结果时显示不可比较。草稿只验证评测工具，用户确认前不调模型/档位。

`scripts/eval-story-discovery.mjs`默认仅读本地输入，不导入会启动CLI/网络的provider；本轮不提供隐式live模式。新增`pnpm eval:discovery`脚本输出JSON及简短文本。P=TP/(TP+FP)，端到端R=TP/全部标注正例，覆盖率=合法yes/no数/全部样本；已判断R的分母为有合法判断的标注正例，另报unknown和各失败数。分母0为null/不适用，缺失回执计unknown，重复结果不挑有利项；不同模型只有输入/标注/语义契约相同才并列。

边界评分先把每个范围规范化为有序原文单元集，按固定样本顺序一对一精确配对，命中率=精确配对数/预期数；重复预测不能增加命中。未配对预测数和同范围重复数分别列出，预期与所有预测均无交集才记漏提。对剩余未精确配对范围，预测完整覆盖至少两个互不包含且各有独有单元的预期记合并；至少两个严格位于同一预期内的预测、其并集覆盖该预期记拆分；预测严格位于某预期内且缺预期首/尾单元，分别记缺首/缺尾。多重关系时按预期ID排序列明对应集合，不挑最有利配对；诊断可重叠计数，不能求和当总错误数。完整事件可共享背景/存在包含关系，这些规则只是定位诊断，不推断“缺起因/结局”等语义事实。

## 执行任务（SS按顺序）

- [x] **先做有界离线可行性探测。** 在临时目录、假transport/runner中保存当前旧分块/catalog/原文匹配prompt与schema、全部旧键序列化/旧故事ID算法及manifest/缓存fixture，验证任意非硬编码主题的旧判断键能恢复；记录5本书的块数/中位估算及冷1/续4调用基线。不读取用户实际媒体库、不调用CLI或网络。按真实同版世说新语建立1129条预期定位清单，逐条验证现有原文防线并显式记录57条拒绝；用计划的上限32、输出预算和分块模拟，验证9篇≤2调用、1129条≤60、1072篇恰好入库一次且57条拒绝可核算、块数阈值、完整请求预算及三适配器schema/解析容量一致。Codex仅探测捕获协议/替身的有限schema和既有期限，不宣称真实容量已验证。任一目标不能在保留原文/输出防线下达到，或旧键不能精确恢复，停止依赖任务、更新REQ/AP并重新AR；不得隐藏任何预期条目或造回执跳过失败。
- [x] **先修缓存保留。** `server/story-discovery-cache.ts`增加串行update；`server/local-story-discovery.ts`按项恢复有效记录、拆开accepted/pending/位置提交，保存诊断并处理仅重复可推进，允许后续合法回执引用已存完成证据结清旧pending且不重复入库；`server/local-source-ranges.ts`复用单位集合做重叠诊断。扩充`tests/story-discovery-cache.test.mjs`和`tests/story-continuation-overlap.test.mjs`，覆盖单条坏数据、写失败、部分保存后合法收束/推进、未知resolved及高重叠合法事件。
- [x] **统一三提供商匹配回执与故障/用量。** 修改`lib/reader-theme-match.ts`、`lib/reader-provider.ts`、`lib/reader-gemini.ts`、`server/generation.ts`、`server/openai-provider.ts`，让短编号批次经逐项解析返回稳定内部判断；增加只用于发现的可选安全测量上下文/错误分类。`server/codex-runner.ts`仅补充已知状态/usage的安全传递，不改认证、工具隔离、模型路由或启动方式。三提供商fixture验证单个非法/重复/遗漏不丢合法项，reason在verdict之前，无摘要，失败/用量缺失不泄露原始正文。
- [x] **拆出可移植判断身份。** `server/story-theme-matching.ts`使用原典与故事内容指纹替代提取namespace，正常判断/unknown分开存储，用update合并；调用首任务冻结的旧匹配键与旧ID映射，支持当前任意请求主题的可信旧原文回执惰性迁移。扩充`tests/incremental-story-library.test.mjs`、`tests/selected-chapter-extraction.test.mjs`、`tests/story-matching-models.test.mjs`，证明全书/重叠章节/提取配置变化复用，匹配配置或原文变化失效，同名不同范围不混用，旧摘要不导入；用非硬编码主题的固定旧fixture证明旧付费判断可定位且不重判。
- [x] **加周期与有界调度。** `lib/reader-intake.ts`、`server/reader-intake.ts`、`server/reader-production.ts`保存/传递cycleId；`server/local-generation.ts`及reading observer转发。`server/story-theme-matching.ts`实现进程共享3槽、在途身份、8次持久预留、单篇隔离及unknown重试资格，`server/local-story-discovery.ts`在unknown后仍继续原文并给不完整说明。使用可控promise与计数，不用真实计费时序；验证跨自动round/重开/重启不重置、多个读者共享收费去重、cache hit立即返回、yes早返后保存在途结果、服务故障停止派发、取消不超发且其他读者继续。
- [x] **再扩批、合块及迁移。** `lib/reader-local-contract.ts`解除catalog固定5上限并绑定本次有限容量，重排catalog payload使本块稳定原文先于排除项、pending及上下文；三适配器绑定同一容量函数并捕获实际请求验证字段顺序。`server/story-token-budget.ts`、`server/story-reading-inputs.ts`实现新分块和估算；`server/local-story-discovery.ts`采用新旧manifest前沿迁移，旧序列化按首任务固定fixture保存到明确的legacy helper，不能重定义旧导出改变历史键。更新`lib/reader-suggestions.ts`和`client/ui/StoryReadingState.tsx`、`client/ui/StoryCreationSetup.tsx`多章进度。相应书库/首篇/范围/连续查找测试去掉旧“两章/续4”断言，替换为完整覆盖、有限容量和当前REQ阈值；测试已读完、跨前沿及迁移失败重启。
- [x] **完成测量聚合与离线评测。** 增加`server/story-discovery-metrics.ts`受限事件与周期聚合（适配器边界接入前项），新增上述eval数据、脚本及`tests/story-discovery-eval.test.mjs`、`tests/story-discovery-metrics.test.mjs`；仅package scripts变动，无依赖/锁文件变动。用手算小样本覆盖TP/FP/FN/unknown、空分母、不可比身份、缺失/冲突回执、边界一对一和失败覆盖。新增调用预算/块数专项回归`tests/story-discovery-speed-accuracy.test.mjs`；文档说明受控回放与真实质量的边界。
- [x] **补足服务与现有界面验收。** 按[E2E规范](../../../../tests/test-story-discovery-speed-accuracy.md)新增`tests/story-discovery-speed-accuracy.e2e.mjs`，复用productionFixture的真实REST/SQLite/FileMedia、隔离数据和假模型；所有自动round/重启/迟到写围栏走真实服务入口。复用既有原文准备与选中防线，不调用分镜/图片。新增测试专用`tests/fixtures/story-discovery-preview.mjs`：临时书库中将productionFixture的`app.handle`绑定到loopback HTTP服务，假provider拒绝外部网络，使用`developmentServerOptions`程序化启动代理至该服务的reader Vite；不运行会加载.env并启动真实后端的`pnpm dev`。桌面preview只提供shell，设置同一临时`SHIQU_DATA_DIR`和`VITE_DESKTOP_READER_URL`再运行`pnpm desktop:preview`。复用相关现有in-app browser标签，从桌面阅读入口进入该受控reader，检查多章进度压缩、不完整提示、选中后停止。该harness只作测试，不增加产品开关；若本机IAB不可用，记录具体缺口，不换浏览器冒充当前页验证。
- [x] **验证。** Node24.22.1、pnpm11.25.0；有需要才`pnpm install --frozen-lockfile`。先运行受影响定向测试；TT执行`pnpm typecheck`、`pnpm lint`、`pnpm test`。ET执行`pnpm exec node --experimental-strip-types --test tests/story-discovery-speed-accuracy.e2e.mjs tests/incremental-story-library.e2e.mjs`。执行`pnpm eval:discovery`确认默认离线、草稿状态和不可比较输出。不得运行Docker/桌面prepare/build、真实评测或改实际用户库。

## 风险与证据边界

- 扩批/合块可能让首个符合项更慢；三批并发可能多付最多两个已派发批次。固定调度与覆盖测试证明行为，真实延迟和质量仍须另行授权、同输入实测。
- 本地o200k估算不是Gemini实际计数；保留预算、输出/超时防线并把实际usage未知显式暴露，不能拿块数达标证明不会超模型上下文。
- 旧命名空间包含提示词和分块，必须保留旧计算快照。只迁移能定位且能证明覆盖的旧状态，不搜集任意历史配置、不删除旧文件；回滚旧代码只会看到其旧文件快照，不能宣称新写入会倒灌。
- 并发和周期预留正确性比并发收益优先；受控promise覆盖竞态，不以测试耗时证明实际模型收益。取消、写失败和未知服务故障必须保守停派发。
- 标注尚未由用户确认，现有捕获回执不足时明确缺失。交付的是离线工具与草稿，真实模型质量、容量及速度不在本轮AP/AR证据内。

## AR

AR risk: non-low — 涉及付费调度、缓存迁移、并发及阅读位置。

AR review round: 2; reviewer: reused

独立只读审查第一轮发现三项阻塞：部分保存后的pending无法收束、旧匹配键快照不完整、catalog原文前置未进入任务。已同步修正REQ/AP/E2E；另补齐边界评分分母/定位诊断、隔离受控reader预览及测试专用harness。第二轮由同一独立reviewer复核上述修改及交叉影响，未发现剩余阻塞。

AR fixed: pending恢复、旧匹配键迁移及提取payload顺序已明确；rerun result passed

AR passed: no blocking architecture flaws

容量/完整覆盖与旧键恢复的有界离线探测仍是首个SS任务，不把规划当运行证据。本轮未执行SS、TT、ET、UI验证或真实模型调用。

## SS离线探测

Node24.22.1 / pnpm11.25.0，Git base保持上述提交。探测仅加载仓库原典与本地估算，未读取用户媒体库、启动CLI或发送网络请求。已冻结`lib/reader-discovery-v1.json`及`tests/fixtures/story-discovery-v1.json`，含旧prompt/schema、五书manifest与键/故事ID样例；生产旧键函数尚未更改。

| 原典 | 旧Codex块数 | 旧Gemini块数 | 去两章上限后块数 |
|---|---:|---:|---:|
| 战国策 | 251 | 251 | 17（中位11,553估算token） |
| 世说新语 | 19 | 33 | 10 |
| 庄子 | 17 | 32 | 10 |
| 搜神记 | 12 | 30 | 10 |
| 三国演义 | 74 | 239 | 74 |

世说新语原文共有1129条；按上限32模拟约43次调用，但现有`LocalBooks.resolve`拒绝其中57条：56条少于20字符，另有`shishuo-10-026`含未审核原文异常。全部1129条均入库与“原文防线保持”不能同时满足。首任务保持未完成，依赖实现未启动；已向用户请求确认保留防线并显式核算被拒条目，或扩展短文本规则的审查范围。决定后同步REQ/AP/E2E并重新AR，不隐藏/减少原文覆盖，不放宽异常字防线。

其余有界探测通过：九篇假模型fixture当前确为4次提取；32篇真实有效定位样本经临时扩容schema解析成功，输出约1974本地估算token，低于拟定25,600容量；五书旧键/故事ID及两个非硬编码主题的旧判断键均与当前实现一致。容量报告位于`/tmp/shiqu-story-discovery-capacity.json`，原典/短条目清单保存在上述仓库fixture。尚未声称三适配器32篇真实推理容量已验证。

用户已确认保留原文防线：1129条完整覆盖、1072篇各入库一次、57条拒绝按定位/原因核算。已同步REQ/E2E，重新AR后继续SS；不放宽短文或异常字规则。

AR risk: non-low — 付费调度、缓存迁移、并发及阅读位置。
AR review round: 3; reviewer: reused
用户确认的1129条核算修正已由同一独立reviewer复核；保留全部原文防线。
AR passed: no blocking architecture flaws

SS里程碑：`fe2d25c`保留有效缓存/跨章部分结果；新增3项针对性用例通过。后续核心调度/回执/分块/评测实现的typecheck与23项新/适配器定向用例通过（`/tmp/shiqu-discovery-milestone.log`）。旧整批失败、续4和两章断言仍待按新REQ更新并执行完整回归，不作为已通过。未调用真实模型、未打包、未改用户库。


## SS执行证据

- 里程碑 `3c461b4`：有界匹配调度、短编号回执、v4合块/前沿迁移、发现测量及离线评测核心。后续补齐真实REST/SQLite/FileMedia假模型E2E、兼容回归断言和受控预览。
- `tests/story-discovery-speed-accuracy.test.mjs`实际调用协调层扫描世说新语全部1129条，保存1072个唯一有效故事，显式逐定位核算56条短文及`shishuo-10-026`异常；提取≤60次。九篇实际提取2次，容量满额不推进；固定五书块数/完整有序覆盖、任意旧主题回执及跨前沿迁移通过。
- 三适配器实际序列化替身覆盖32篇容量、原文前置、reason先于verdict、逐项匹配解析、用量缺失和日志隐私。新增catalog逐项恢复，非法pending外壳不丢有效故事且不推进旧位置。
- CR发现并修复：HTTP传输超时和响应外壳解析错误保守归类服务故障；服务故障同步关闭同匹配服务的活跃查找，派发前再次确认；隔离额度绑定判断身份及原文指纹；生命周期等待在途匹配与全部排队测量落盘。各项均有确定性回归。
- IAB沿桌面`pnpm desktop:preview`入口进入临时假模型reader，已检查四章压缩进度、存在候选与零候选时的不完整说明，以及选择故事后到制作确认。未点击开始制作，未生成分镜/图片。截图：`/tmp/shiqu-discovery-progress.jpg`、`/tmp/shiqu-discovery-incomplete.jpg`、`/tmp/shiqu-discovery-no-match.jpg`、`/tmp/shiqu-discovery-selection.jpg`。
- ET两文件26/26通过（`/tmp/shiqu-discovery-et-final.log`）；最新派发防线修改后再次执行。默认`pnpm eval:discovery`离线40组草稿受控回放通过，明确不代表真实模型准确度/速度。静态检查通过后续改动正在复核。
- 完整TT首次在沙箱内因startup PTY测试无法绑定loopback而失败；允许本地socket后924项中921通过，3项仍为旧续4/两章断言，已替换为32篇容量及完整有序覆盖/短章不拆分，针对3项均通过。完整TT最终重跑中。

## CR

CR risk: non-low — 涉及付费调度、持久缓存、并发及迁移。
CR review round: 2; reviewer: reused

独立只读审查覆盖Git base以来的全部代码、配置、数据和测试。已修复传输故障分类、catalog部分回执保留、同步停止派发、隔离费用身份、取消/共享调用费用归属及迟到落盘；补充初始未展示yes禁止自动重试旧unknown、只有预留成功的读者才归属隔离费用、旧manifest缺失时保留有效故事/pending但覆盖归零。新增确定性回归均通过。未发现外部集成、隐私泄漏、破坏迁移或无关生产范围。

CR fixed: 调用隔离、部分结果保留、费用归属及迁移边界已修复；rerun result passed

CR passed: no major findings

最终实现里程碑：`4ccaff0`，含CR修复、服务/界面测试harness、回归及草稿评测数据。提交前typecheck、lint及所有新增故障/归属/重试/迁移定向回归通过；完整TT/ET仍以其下方最终证据为准。


## 最终验证

- Node24.22.1 / pnpm11.25.0；`pnpm typecheck`、`pnpm lint`通过。
- `pnpm test`最终931/931通过，0失败/取消/跳过（`/tmp/shiqu-discovery-tt-complete.log`），包含全部原典、缓存/预算/并发/迁移及费用归属回归。
- 其中真实协调层全世说扫描满足1129条覆盖、1072篇唯一有效故事、57条显式拒绝及≤60次提取；九篇2次提取，五书完整有序覆盖及块数阈值通过。
- E2E与完整TT并行时，一项真实红楼原典fixture的5秒等待窗口耗尽，观察到受控任务取消而非错误结果；完整TT结束后顺序重新执行两个E2E文件，以最终结果为准。

- 最终ET顺序运行`pnpm exec node --experimental-strip-types --test tests/story-discovery-speed-accuracy.e2e.mjs tests/incremental-story-library.e2e.mjs`，26/26通过，0失败/取消/跳过（`/tmp/shiqu-discovery-et-complete.log`）。
- `pnpm eval:discovery`默认离线输出40组draft/controlled样本及3章边界；真实模型录制缺失时不可比较。此回放只验证工具，不作为准确度基线。
- IAB证据保留四张截图；所有交互使用临时假模型任务，经桌面入口进入reader，未开始制作。未调用真实模型、Docker/桌面打包或操作用户实际库。全部AP任务已完成，等待独立VR。


## VR首轮补齐

独立VR指出评测草稿的原40组虽覆盖同人物，但没有两个共享原文背景的不同完整事件，REQ标注集要求尚未满足。补充固定同版红楼“娇杏一顾结奇缘”与“甄士隐资助贾雨村进京”真实范围，二者共享`honglou-001-023/024`中秋怀人诗，各有独立行动及自然收束；为两个相同主题各设yes/no，共44组、4书，仍保留3章完整边界。原文由`LocalBooks.resolve`核对并保存版本/定位，标注升为draft-2，受控回执同步身份哈希；不是模型质量证据。新增回归检查原文逐字一致、真实交集与各自独有原文，以及不能借共享背景转移另一事件结局。5项eval测试通过，默认离线回放可比较；真实模型结果仍缺失。


CR risk: non-low — inherits discovery/cache boundaries.
CR review round: 3; reviewer: reused
新增draft-2重叠原文标注、受控回执/哈希、README及源文件核验测试已由独立reviewer复核；没有生产行为变化。
CR passed: no major findings

补充实现里程碑：`222ea0a`（共享背景评测样本及原文核验），提交时5/5定向测试及默认离线回放通过。最终全量TT再次通过932/932（`/tmp/shiqu-discovery-tt-delivery.log`），typecheck/lint通过（`/tmp/shiqu-discovery-static-delivery.log`）；ET沿用最终顺序26/26结果，补充数据不影响服务/界面行为。


## VR与完成

VR risk: non-low — 涉及付费调用、持久缓存、并发及阅读位置迁移。
VR review round: 2; reviewer: reused
独立reviewer逐项确认27项REQ与9项AP任务全部完成；补齐共享背景标注后复核通过。REQ已据此全部勾选。完整最终VR逐字保存在DD。
VR passed: all acceptance criteria complete

DD：`.docs/done/2026/11/01/story-discovery-speed-accuracy.md`。SS里程碑已本地提交，按工作流止于DD，未执行GC或push；最终验收文档保留工作区变更。
