// Audit source-to-frame coverage and pacing; adaptive scripts may repair structure before a fresh audit.
import {normalizeProductionPrompt} from './reader-prompts.ts';
import {z} from 'zod';
import {planSchema,reflectionCandidatesSchema} from './reader-model.ts';
import type {Plan,Selection,StoryboardOutline,ReflectionCandidates} from './reader-model.ts';
import {verifiedOriginalPayload} from './reader-source-types.ts';
import {storyBriefPayload,assertStoryBriefReady,withoutStorySummary} from './reader-story-brief.ts';
import type {OriginalSource} from './reader-source-types.ts';
import type {Generated} from './reader-engine.ts';
import {getArtStyle} from './reader-styles.ts';
import {storyPageDirection} from './reader-generation-contract.ts';
import {promptSections,inputBoundaryDirection,sourceFidelityDirection,storyboardDirection,narrativeMeaningDirection,reflectionMeaningDirection,editorialDirection,storyEditorialContext,storyScopeDirection,storyOpeningDirection,storySourceDirection,storyReviewDirection,storyKnowledgeDirection} from './reader-prompts.ts';
import {readerStoryboardBatchSize,readerMinFrames,readerMaxFrames} from './reader-limits.ts';
import {localPlanConstraint} from './reader-local-contract.ts';
import {editorialAuditDirection,editorialCoverageSchema,editorialCoverageJson,validateEditorialCoverage} from './reader-editorial.ts';
import type {EditorialCoverage} from './reader-editorial.ts';
import {structuralEditsSchema,structuralEditsJson} from './reader-structure.ts';
import type {StructuralEdits} from './reader-structure.ts';
import type {ReasoningTask} from './reader-reasoning.ts';

// Zero identifies the separate ending, never a frame. Positive saved frame IDs stay unchanged.
const categories=['caption','action','composition','progression','continuity','source','style','reflection'] as const;
const issueSchema=z.object({page:z.number().int().min(0),category:z.enum(categories),problem:z.string().trim().min(1).max(180),instruction:z.string().trim().min(1).max(400),requiresReplan:z.boolean().optional()});
export type ReviewIssue=z.infer<typeof issueSchema>;
export type ReflectionChoice={index:number;reason:string};
export type TitleReview={title:string;reason:string};
export const frameCountReviewSchema=(count:number)=>z.object({decision:z.enum(['keep','expand','reduce','redistribute']),proposedCount:z.number().int().min(readerMinFrames).max(readerMaxFrames),reason:z.string().trim().min(1).max(400)}).strict().superRefine((value,ctx)=>{
 if((value.decision==='keep'||value.decision==='redistribute')&&value.proposedCount!==count||value.decision==='expand'&&value.proposedCount<=count||value.decision==='reduce'&&value.proposedCount>=count)ctx.addIssue({code:z.ZodIssueCode.custom,message:'Frame-count verdict and proposed direction disagree'});
});
export type FrameCountReview=z.infer<ReturnType<typeof frameCountReviewSchema>>;
export const frameRequirementSchema=(count:number)=>z.object({page:z.number().int().min(1).max(count),quote:z.string().trim().min(2).max(120),task:z.string().trim().min(1).max(120),captionEvidence:z.string().trim().min(1).max(180),visualEvidence:z.string().trim().min(1).max(180),loss:z.string().trim().min(1).max(180),instruction:z.string().trim().min(1).max(400)}).strict();
export type FrameRequirement=z.infer<ReturnType<typeof frameRequirementSchema>>;
export type FrameCountReport={frameCountReview:FrameCountReview;requirements:FrameRequirement[];issues:ReviewIssue[];coverage:EditorialCoverage[]};
export type FrameCountContext=Pick<FrameCountReport,'frameCountReview'|'requirements'>;
export type ReviewReport={frameCountReview?:FrameCountReview;issues:ReviewIssue[];titleReview:TitleReview;reflectionChoice?:ReflectionChoice;coverage?:EditorialCoverage[]};
// Historical review reports remain readable without title audit metadata.
export type ReviewCheckpoint={overridden?:boolean;stopReason?:'limit'|'unchanged'|'replan';history?:{round:number;requested:number[];changes:RepairedPage[];reflection?:string;structure?:StructuralEdits&{before:number;after:number;sourcePages:(number|null)[];removed:RepairedPage[];previousOutline?:StoryboardOutline;previousCharacters?:string}}[];status:'pending'|'repair'|'passed'|'blocked';round:number;repairs:number;issues:ReviewIssue[];repaired:number[];reports:{round:number;frameCountReview?:FrameCountReview;issues:ReviewIssue[];coverage?:EditorialCoverage[];titleReview?:TitleReview&{previousTitle:string};reflectionChoice?:ReflectionChoice&{candidates:ReflectionCandidates}}[]};
export type RepairedPage={page:number;caption:string;prompt:string};
export function reviewReportSchema(count:number,candidates?:ReflectionCandidates){return z.object({frameCountReview:frameCountReviewSchema(count).optional(),titleReview:z.object({title:planSchema.shape.title.trim().min(1),reason:z.string().trim().min(1).max(400)}),issues:z.array(issueSchema.extend({page:z.number().int().min(0).max(count)})).max(count+1),coverage:z.array(editorialCoverageSchema).min(1).max(32).optional(),reflectionChoice:z.object({index:z.number().int().min(1).max(3),reason:z.string().trim().min(1).max(400)}).optional()}).superRefine((report,ctx)=>{
 if(report.frameCountReview&&(report.frameCountReview.decision!=='keep')!==report.issues.some(issue=>issue.requiresReplan))ctx.addIssue({code:z.ZodIssueCode.custom,message:'Frame-count adjustment must correspond to concrete structural issues'});
 if(new Set(report.issues.map(issue=>issue.page)).size!==report.issues.length)ctx.addIssue({code:z.ZodIssueCode.custom,message:'Duplicate review page'});
 if(report.issues.some(issue=>(issue.page===0)!==(issue.category==='reflection')))ctx.addIssue({code:z.ZodIssueCode.custom,message:'Reflection issues must target the ending; frame issues require positive pages'});
 if(report.issues.some(issue=>issue.requiresReplan&&(issue.page===0||!['progression','continuity'].includes(issue.category))))ctx.addIssue({code:z.ZodIssueCode.custom,message:'Global revisions must identify a positive frame and progression or global continuity problem'});
 if(!!candidates!==!!report.reflectionChoice)ctx.addIssue({code:z.ZodIssueCode.custom,message:'An ending choice is required only when candidates are supplied'});
 for(const item of report.coverage||[]){
  if(item.pages.some(page=>page>count)||new Set(item.pages).size!==item.pages.length||item.issuePage>count||item.assessment==='adequate'&&(!item.pages.length||item.issuePage!==0)||item.assessment==='needs-change'&&(!item.issuePage||!report.issues.some(issue=>issue.page===item.issuePage)))ctx.addIssue({code:z.ZodIssueCode.custom,message:'Editorial coverage must identify valid frames and its corresponding issue'});
 }
});}
export function parseFrameCountReport(count:number,value:unknown):FrameCountReport{
 const parsed=z.object({frameCountReview:frameCountReviewSchema(count),requirements:z.array(frameRequirementSchema(count)).max(readerStoryboardBatchSize)}).strict().parse(value);
 if((parsed.frameCountReview.decision==='keep')!==!parsed.requirements.length)throw Error('FRAME_COUNT_REVIEW_SCOPE');
 const pages=[...new Set(parsed.requirements.map(item=>item.page))];
 const issues:ReviewIssue[]=pages.map(page=>{const related=parsed.requirements.filter(item=>item.page===page);return {page,category:'progression',problem:related.map(item=>item.loss).join('；').slice(0,180),instruction:related.map(item=>item.instruction).join('；').slice(0,400),requiresReplan:true};});
 const coverage:EditorialCoverage[]=parsed.requirements.map(item=>({quote:item.quote,task:item.task,pages:[item.page],assessment:'needs-change',reason:item.loss,issuePage:item.page}));
 return {...parsed,issues,coverage};
}
export function repairOutputSchema(pages:number[]){return z.object({pages:z.array(planSchema.shape.pages.element.extend({page:z.number().int().min(1)})).length(pages.length)}).superRefine((result,ctx)=>{
 const actual=result.pages.map(page=>page.page);
 if(new Set(actual).size!==pages.length||actual.some(page=>!pages.includes(page)))ctx.addIssue({code:z.ZodIssueCode.custom,message:'Repair page set differs from requested pages'});
});}
export function pendingRepairs(review:ReviewCheckpoint){
 const pending=[...new Set(review.issues.map(issue=>issue.page))].filter(page=>!review.repaired.includes(page));
 const pages=pending.filter(page=>page>0).sort((a,b)=>a-b).slice(0,readerStoryboardBatchSize);
 return pages.length?pages:pending.includes(0)?[0]:[];
}
export const storyReplanMessage='故事主线或结局不完整，请修改制作要求或画幅数，重新编排故事。';
export function newReview():ReviewCheckpoint{return {history:[],status:'pending',round:0,repairs:0,issues:[],repaired:[],reports:[]};}

const string=(maxLength:number)=>({type:'string',minLength:1,maxLength});
const frameCountReviewJson={type:'object',properties:{decision:{type:'string',enum:['keep','expand','reduce','redistribute']},proposedCount:{type:'integer',minimum:readerMinFrames,maximum:readerMaxFrames},reason:{type:'string',minLength:1,maxLength:400}},required:['decision','proposedCount','reason'],additionalProperties:false};
const sourceRoleAndRecognitionDirection='逐段逐人先辨别独立作用，再按详略筛轻重。关系作用也包括认同、回忆与共同反应显露既有亲疏，不必使核心冲突升级；不能因发生在冲突之前或由次要人物承担就自动略去。环境不只是壮观布景：人物据此辨认身份、层级或规矩，可以形成、确认或修正认识；须有原文依据，不补造心理转变。有独立作用不等于必须独占一幅，仍以实质理解损失判断。';
export const frameCountReviewDirection=`本次必须审核画幅数是否足够，但数量是以下四步的结果，不能先定一个新数量再凑内容：
1. 从完整原文找出有独立作用的言行、回应和停顿，说明谁对谁做/说了什么、对方如何承受或回应，关系、期待、立场或处境因此如何改变或显露；环境也须有叙事作用。${sourceRoleAndRecognitionDirection}不能只按旧稿已有事件列清单。原文叙述、内心独白、诗词和人物讲述也须辨别不同认识、处境、矛盾与推论的独立作用，不能把整段统称为一种情绪或主题，只留最熟悉的结论；重复表达可以压缩。按narrativeDetail判断轻重，不把所有有据可画的细节都升级为必需画幅。
2. 找这些任务在旧稿中的对应幅，分别检查caption说了什么、prompt实际定格并突出什么。提到了整场对答不等于每层作用已经表现；泪痕、笑容、物件已放下等事后状态，也不能自动替代此前发生的关键过程。画面主要定格一个动作，不等于caption附带的多层转念或推论也获得了空间；要分别判断其作用能否由已有反应、停顿或场景承接，不能只列一串结论便算表现，也不机械逐句拆分或另造事实来配图。
3. 判断压缩损失：是否只交代结果，却省掉关系变化发生时的交锋、承受、误读、转圜或余波？能合在同一可见瞬间的保留合理合并；若先后任务作用不同或需要转换焦点，必须说明挤在同幅失去了什么，不以加长旁白或换景别糊过去。不是每句对白都要独占一幅。也要查重复、无独立作用的过细拆分，或主事件完成后又强塞的新交锋；有原文依据不等于必须纳入，应有据合并、删除或重分配。
4. 将损失写成具体补戏要求，说明补/拆/合的原范围及各幅不同任务，才重编和计数。现有幅数不是目标，不能默认只能原幅内修清；确需增删或重分配时列入补戏清单。修法仍须有原文依据，保留有效对白及人物判断的归属，不自行补心理解说。
只将有实质作用损失、重复或范围失衡的任务写进requirements修订清单，每条包括：page为原稿中需重编的锚点幅号；quote为原文连续短句；task为这段言行/回应/停顿的独立作用；captionEvidence说明旧稿配文交代了什么；visualEvidence说明旧稿画面实际定格、突出什么；loss说明压掉了什么过程，或重复、范围失衡怎样损害主事件；instruction写具体补/拆/合/删要求及各幅不同任务。不要为了列问题而要求每句对白分幅，合理合并保留作用就不列需求。缺整段可锚定最接近的原幅。quote只选原文一个连续短句，逐字照引，允许简繁与标点差别，不拼接、不用省略号；长段选最能定位的一句，不将改写当原引。
最后返回frameCountReview：decision=keep/expand/reduce/redistribute，proposedCount为完成这些任务需要的1–80幅整数，reason根据具体关键戏说明取舍。keep仅在当前分配已足够时使用，建议数等于当前数且requirements为空；expand增加，reduce减少；redistribute数量不变但重新分配结构。任何非keep结论必须有具体补戏需求。建议数不是新硬锁，分批修订后仍须全篇复核并重新判断；不因较多就通过，不为增幅拆散有效瞬间。proposedCount只计plan.pages中的剧情画幅，不含封面或系统另页展示的plan.reflection。若现有pages夹入了复制结语、独立结束页或纯装饰占位，应有据删除，不能再为结束页增加剧情画幅；原文已有的安歇、离开等自然收束仍是剧情任务。本阶段不审核或改写结语文本。只返回requirements及frameCountReview，后续系统把需求交给结构修订；本阶段不输出全面审片表。`;

const reflectionChoiceDirection='本次结语有三个候选（reflectionCandidates），按数组顺序编号1、2、3；plan.reflection 只是尚未选定时的占位，不表示推荐。先对照完整原文和分镜逐句判断成立与否，再在合格句中比较所保留的意味、准确程度、表达功能与语言取舍，选出最值得留下的一句。不要默认选第一句，不按长短、故事名词数量、修辞华丽或固定寓意排名；也不因覆盖更多情节、人物或支线，就优先选择更宽泛的一句。先比较判断是否明确、关系与分寸是否有原文依据、读完能带走什么，再结合入口规则选择表达角度。完整理解全篇不等于成句概括全篇；有据的不同读法可以成立，择优不等于只认可一种寓意。返回 reflectionChoice:{index,reason}，index 必须为现有候选编号，reason 简述所选句的原文依据及相对其余两句的具体优势；不能拼接、改写或另造第四句。有合格候选时，选定其中最优，不因淘汰句有问题或还能想到另一种说法而要求修订。结语的 reflection 问题只针对最终所选句；三个都不合格时也先选最接近要求的一句，并报告其具体问题，交给结语修订阶段处理。分镜仍按完整审核要求检查，择优不能跳过分镜审核。';
export const reviewSystemPrompt=promptSections(
 ['任务与边界','你是独立的静态连环画审片编辑。完整阅读已核原文，连读全篇 caption 并结合 prompt，独立检查核心含义、分镜轻重、事实与连续性、语言；再参考主题/原典模式及核对摘要检查范围、关键阶段与结局遗漏。保护原稿有效表达，理解不等于把潜台词都写进旁白。审核文字分镜的可执行性，不能声称看过未生成图片。'],
 ['作品知识与补文',storyKnowledgeDirection],
 ['主题与摘要审核',storyReviewDirection],
 ['故事范围与开场',storyScopeDirection+'\n'+storyOpeningDirection],
 ['完整性与重新编排','独立依据原文确定主事件的起因和自然终点，再检查 plan.pages 是否覆盖关键行动及结果；有 outline 时也检查其是否截早，不把错误提纲当正确边界。原文已有结果、分镜却停在铺垫、分离或中途冲突时必须报告，不能用改编说明自称节选、定位名偏窄、改标题或结语补情节来通过；不机械要求全章或所有支线。整段重要阶段或结果缺失、必须重新分配全篇画幅时：category="progression"，requiresReplan=true，page 标出截断或失衡最明显的一幅；problem 指明原文遗漏的关键行动与结果，instruction 说明完整范围和可压缩的次要过程。此标记停止局部修补，不能要求末幅补一句结局。局部开场不足或一句衔接可修时 requiresReplan=false；背景已清楚不强加介绍。每条问题均返回该布尔值。'],
 ['共同叙事标准',narrativeMeaningDirection],
 ['原文覆盖与节奏核对',editorialAuditDirection],
 ['逐幅事实边界',sourceFidelityDirection],
 ['配文与语义','只读配文并结合前后语境，普通成年读者应无须古文注释就能理解；不依赖画面提示词或读者翻译古文来补关键意思。按共同标准核对字面意思、说话者、指代、条件、范围与力度；有效原句和必要归属保留，不以词频判错。回忆或故事在入口交代归属与时间，连续语境自然承接，切回当下或更换讲述者再提示，避免每幅机械起头。逐幅核对对象、用途、操作、尺寸、位置、容器与承受能力，不能将操作受限误写成无处存放。即使已发现机械转述，也要检查删标签后是否仍含混；补最少关系，不靠增加代词、照搬古文或猜事实修补。自然省略与可由画面承担的细节可以保留。caption 正常目标8至55字，必要时可到90字硬上限；不因超过目标而机械判错。配文应匹配可见瞬间；纯文字问题保留无问题的 prompt。'],
 ['动作、构图、推进与连续性','检查静态单瞬间、可读的身体施力和接触、景别主次与空间关系，不以抽象情绪代动作，不塞入连续动作或不必要全员。逐对比较相邻画面的瞬间、主要动作、接触、物件状态、视线与第一焦点，不能因配文有新论点或已发现语言问题跳过。不同论点仍用同一姿势、对象与焦点且无独立停顿时，按 composition 指出重复，保留论点，指定已有动作结束、回应或新焦点，不能只要求换角度。配文和画面都无新任务时用 progression。有依据的关系、幽默、反应与停顿要保留，不强求威胁升级、反转、回忆或每幅悬念。核对诱因、关键言行、回应和收尾是否真正获得画幅；被概括或次要流程挤掉时指出原文依据及理解损失。按 continuity 检查人物朝向与位置、物件持有者与状态、时间和已揭信息，尤其每20幅边界；技术批次不是剧情分幕。按 style 检查 artDirection 冲突。'],
 ['标题与入口',editorialDirection+'\n标题准确、可识别且符合实际范围时保留，不为风格偏好改名。有范围不符、误导或无据扣题时直接修正。返回 titleReview:{title,reason}，说明保留依据或具体问题与修正收益，再核对事实；不改其他元数据，也不将标题问题记作某幅问题。'],
 ['结语标准',reflectionMeaningDirection],
 ['结语审核与改进','读者先读全部配文，再在独立结束页读 plan.reflection；制作要求中“最后一句”的感想针对结语，不能因末幅停在对白、动作或停顿就判缺总结。候选存在时按本次择优规则确定审核对象。将所选结语与末幅及前文连读，分别检查事实与立意、提炼或解说、语言铺垫。若解释正确却重复已说清的动机或只是重排情节，引用结语与重复配文，指出哪层意思重复，要求重新提炼而非补细节。立意成立而铺垫冗余时只删解释；误读才校准认识，不把所有语言问题升级为重写寓意。再检查有无明确更好的表达：当前句是否错过结局的重要意味、将有力量的关系稀释成标签或绕说削弱判断。须指出原文或配文依据、值得保留的判断、具体损失及修法收益；不接受“不够深刻、还可更好”，不为华丽、长短、更多故事词或另一种同等读法改写。若要更换立意，须证明哪个关键关系或收尾意味被实质削弱。已准确、有意味且凝练时保留；抽象而保留关系和限定的句子不因没点名细节而判错。不得指定最终金句、强加唯一寓意或把结语问题转嫁给末幅。'],
 ['报告契约','只报告有具体依据的实质表达损失、阅读障碍或事实错误，不凑问题，不按个人口味重写。病句、指代不清及打断连读的机械重复仍需修订。issues 为空才表示通过，需重编的问题也必须列入。幅号从1开始；独立结语用 category="reflection"、page=0，可与画幅问题同时报告。同一幅或结语的全部问题合为一条。problem 引用原文、配文或画面指令并说明误读或损失；instruction 说明删改哪句、保留哪句有效对白、补哪层条件或归属，或谁在什么动作后作什么可见回应。不能只写“抓住核心、加强冲突、更有感染力”，不能靠心理解说修事实。需要两幅配合时逐幅列出不同任务；只需后幅改时只报后幅。修订不得改变未列出的幅、增删幅号或靠一幅加解释掩盖结构缺失。'],
 ['输入与输出',inputBoundaryDirection]);
const repairDirection=`只修订 issues 指出且列在 requestedPages 中的画幅，返回 {pages:[{page,caption,prompt}]}，编号从1开始，与指定幅号一一对应，不增删、重复或改其他页。保留选定故事、总幅数、事件顺序、人物身份、画风和全部元数据。
默认沿用提纲对应事件；只有问题明确要求相邻幅协同调整时，才在本批指定幅号内重新分配原有事件与反应，不丢关键言行或改范围外画幅。依据原文和全篇理解每幅作用，逐项解决同幅全部问题，保留有效对白的口气、条件、力度及反差、回应、停顿和收尾；不将潜台词翻译成心理解说，不靠新增事件、动机或转移问题通过。
画面重复修完后，对照相邻幅的动作、接触、状态、视线和第一焦点确认差异可见；不能只换“安坐、端坐、松放”等近义词或景别，有效停顿仍保留。类比允许压缩重复例证，保留独立论证层次，不能换常用字后留下原有歧义。去掉机械转述后继续核对对象、指代、用途、操作、尺寸与空间关系，不能只删标签、加代词或抄含混原话。真有歧义用准确对白、最少语境或回应解决，不添加“借此讥讽、其实因为”等动机说明。
纯配文问题只改 caption，原样返回无问题的 prompt；涉及画面才修改可见瞬间与动作空间。修后连读全篇配文，消除病句、含混与生硬衔接；入口与必要转场保留说法归属，后续自然承接。reflection 在独立结束页，不复制或改写进末幅，末幅可自然停在对白、动作或停顿。只返回指定 JSON，不输出解释、评分或完整重写。`;
const repairSystemPrompt=promptSections(['任务','你是静态连环画修订编辑，本次仅定向修复指定画幅，不重新编排全篇。'],['作品知识与补文',storyKnowledgeDirection],['开场要求',storyOpeningDirection],['叙事标准',narrativeMeaningDirection],['事实边界',sourceFidelityDirection],['静态画面',storyboardDirection],['逐幅要求',storyPageDirection],['修订范围与输出',repairDirection],['输入边界',inputBoundaryDirection]);

type Call=(task:ReasoningTask,instructions:string,payload:unknown,schema:unknown,maxOutputTokens:number,original?:OriginalSource)=>Promise<Generated<unknown>>;
export function storyboardReviewGenerator(call:Call){
 function payload(selection:Selection,plan:Plan,original:OriginalSource,outline?:StoryboardOutline,reviewing=true){assertStoryBriefReady(original);return {book:selection.customBook||selection.bookId,chosenStory:selection.storyTitle,editorialContext:storyEditorialContext(selection.theme),...(reviewing?storyBriefPayload(original):{}),exactPageCount:plan.pages.length,narrativeDetail:selection.narrativeDetail||'balanced',countPolicy:selection.length==='auto'?'adaptive':'fixed',productionPrompt:normalizeProductionPrompt(selection.productionPrompt||'',selection.theme),artDirection:getArtStyle(selection.artStyle).prompt,verifiedOriginal:verifiedOriginalPayload(original),plan:reviewing?plan:withoutStorySummary(plan),...(outline?{outline:reviewing?outline:withoutStorySummary(outline)}:{})};}
 return {
  async reviewFrameCount(selection:Selection,plan:Plan,original:OriginalSource){
   if(selection.length!=='auto')throw Error('FRAME_COUNT_REVIEW_MODE');
   const count=plan.pages.length,schema={type:'object',properties:{requirements:{type:'array',maxItems:readerStoryboardBatchSize,items:{type:'object',properties:{page:{type:'integer',minimum:1,maximum:count},quote:{type:'string',minLength:2,maxLength:120},task:string(120),captionEvidence:string(180),visualEvidence:string(180),loss:string(180),instruction:string(400)},required:['page','quote','task','captionEvidence','visualEvidence','loss','instruction'],additionalProperties:false}},frameCountReview:frameCountReviewJson},required:['requirements','frameCountReview'],additionalProperties:false};
   const instructions=promptSections(['任务','你是连环画叙事空间与幅数编辑，这是第一道审核门。只判断关键戏有没有获得足够空间，先补戏再计数；事实细查、语言润色、构图和连续性检查、标题与结语择优留给下一道原有全面审片。原文仍是依据，不凭改编说明或旧审核通过来放行。'],['作品知识与补文',storyKnowledgeDirection],['故事范围',storyScopeDirection],['审核顺序',frameCountReviewDirection],['输入边界',inputBoundaryDirection]);
   const result=await call('review',instructions+(original.localSource?'\n'+localPlanConstraint:''),payload(selection,plan,original,undefined,false),schema,24000,original);
   const value=parseFrameCountReport(count,result.value);validateEditorialCoverage(value.coverage,original);return {...result,value};
  },
  async review(selection:Selection,plan:Plan,original:OriginalSource,outline?:StoryboardOutline,reflectionCandidates?:ReflectionCandidates){
   const candidates=reflectionCandidates?reflectionCandidatesSchema.parse(reflectionCandidates):undefined;
   const count=plan.pages.length,schema={type:'object',properties:{coverage:editorialCoverageJson(count),titleReview:{type:'object',properties:{title:string(40),reason:string(400)},required:['title','reason'],additionalProperties:false},issues:{type:'array',maxItems:count+1,items:{type:'object',properties:{page:{type:'integer',minimum:0,maximum:count},category:{type:'string',enum:categories},problem:string(180),instruction:string(400),requiresReplan:{type:'boolean'}},required:['page','category','problem','instruction','requiresReplan'],additionalProperties:false}},...(candidates?{reflectionChoice:{type:'object',properties:{index:{type:'integer',enum:[1,2,3]},reason:string(400)},required:['index','reason'],additionalProperties:false}}:{})},required:['issues','titleReview','coverage',...(candidates?['reflectionChoice']:[])],additionalProperties:false};
   const result=await call('review',reviewSystemPrompt+(original.localSource?'\n'+localPlanConstraint:'')+'\n\n'+promptSections(['本次数量约束',selection.length==='auto'?'countPolicy=adaptive：exactPageCount仅记录当前数量，不是必须保持的目标。需要增幅、减幅、补阶段或合并重复时，以具体依据标requiresReplan=true，随后由结构修订处理；不能要求读者手定数量。':'countPolicy=fixed：兼容旧数值稿，需要改变全篇结构时仍标requiresReplan=true，不伪造局部修法。'],['本次结语对象',candidates?reflectionChoiceDirection:'审核 plan.reflection，不输出 reflectionChoice。'],['身体与环境的作用','核对原文明确写出的身体和环境处境：若它支撑人物的承受、选择或行动代价，须在现有caption或prompt中具体保留，不能只剩泛化情绪或无作用的布景。说明原文依据与实际理解损失，不把所有景物描写都升级为必补细节，不添加原文没有的天气、病情或伤害。现有空间足够时，按局部source/action/composition/caption问题修原幅，不强制加幅。'],['逐人言行与取舍','从原文逐人核对触发、回应和立场取舍，不只沿主人公的现有分镜检查。次要人物有独立作用的言行不能自动归为寒暄或背景。已保留对白须核对否定、比较、选择条件和另一侧取舍，不把完整判断缩成单一结论；须指出实质理解损失，不强制每句对白分幅。人物设定、摘要和提示词里的解释不等于读者已从caption及画面看到。'+sourceRoleAndRecognitionDirection],['全局人物连续性','plan.characters是全篇绘图输入。若它的幅号或状态说明与原文、正确pages冲突，不能要求改错正确画幅去迎合它。需要修全局characters时用category=continuity、requiresReplan=true，page锚定首处冲突，并在instruction明确只修人物说明、保留正确pages；随后由全局修订路径处理。普通相邻位置或物件状态错误仍按局部continuity修。只有具体矛盾或无据设定才要求全局修，不为文风重写人物说明。']),{...payload(selection,plan,original,outline),editorialContext:storyEditorialContext(selection.theme),...(candidates?{reflectionCandidates:candidates}:{})},schema,24000,original);
   const value=reviewReportSchema(count,candidates).parse(result.value);if(selection.length==='auto'&&!value.coverage)throw Error('EDITORIAL_COVERAGE_REQUIRED');if(value.coverage)validateEditorialCoverage(value.coverage,original);
   return {...result,value};
  },
  async restructure(selection:Selection,plan:Plan,original:OriginalSource,issues:ReviewIssue[],coverage?:EditorialCoverage[],frameCountContext?:FrameCountContext){
   if(selection.length!=='auto'||!issues.some(issue=>issue.requiresReplan))throw Error('INVALID_STRUCTURAL_SCOPE');
   const direction=`按完整原文和本轮issues修订结构，返回{edits:[{from,to,pages:[{caption,prompt}]}]}。from/to均指修改前plan.pages的1起始幅号，按from严格递增，范围不得重叠；替换from至to的原幅，from=k,to=k-1表示在原第k幅之前插入，from=原幅数+1可末尾追加；pages为空表示删除。只改需要协同的连续段落，不改无关幅，不回传完整稿或除必要characters外的元数据。一次所有edits合计最多${readerStoryboardBatchSize}个新/替换画幅，总幅数仍在1至80内；保留原有有效对白、因果、人物设定和自然结局。缺失的关键言行与回应各有任务，合并或删除无独立任务的重复，不以长旁白替代关键戏，也不为多幅重演动作。完整原文才是事实依据，coverage是核对线索，不当作事实。结构修订后还将全篇复核；超过单次上限时先完成一个有据的局部，不用截断结局来凑预算。仅修改结构相关画幅，结语和其他局部问题留待复核后的定向修订。edits.pages只含剧情画幅，不输出封面、纯装饰占位或独立结束页，不将plan.reflection复制为某幅caption；结语由系统在剧情之后另页展示。若重排使plan.characters中的固定幅号或动态状态过期，可返回可选characters替换人物连续性说明；只需改全局说明时edits可为空。保留正确pages、稳定身份与服色，动态痕迹/服饰按实际剧情阶段描述，不固定过期幅号，不新编事件。缺省或null保留旧characters；不得要求改错正确画幅来迎合旧说明。`;
   const instructions=promptSections(['任务','你是古典静态连环画结构修订编辑。'],['原文编排',storySourceDirection],['作品知识与补文',storyKnowledgeDirection],['叙事标准',narrativeMeaningDirection],['静态画面',storyboardDirection],['逐幅要求',storyPageDirection],['结构输出',direction+(frameCountContext?'\n本次数量审核的完整requirements逐项保留，不能只照截短的issues修订。frameCountReview是基于任务的建议数，不是新硬锁；先补各项有据任务，再计数。':'')],['输入边界',inputBoundaryDirection]);
   const result=await call('repair',instructions+(original.localSource?'\n'+localPlanConstraint:''),{...payload(selection,plan,original,undefined,false),issues,...(coverage?{coverage}:{}),...(frameCountContext?{frameCountContext}:{})},structuralEditsJson(plan.pages.length),16000,original);
   return {...result,value:structuralEditsSchema.parse(result.value)};
  },
  async repair(selection:Selection,plan:Plan,original:OriginalSource,issues:ReviewIssue[],outline?:StoryboardOutline){
   const requestedPages=issues.map(issue=>issue.page);
   if(issues.some(issue=>issue.requiresReplan)||requestedPages.some(page=>page<1)||!requestedPages.length||requestedPages.length>readerStoryboardBatchSize||new Set(requestedPages).size!==requestedPages.length)throw Error('INVALID_REPAIR_SCOPE');
   const schema={type:'object',properties:{pages:{type:'array',minItems:requestedPages.length,maxItems:requestedPages.length,items:{type:'object',properties:{page:{type:'integer',enum:requestedPages},caption:{type:'string',minLength:8,maxLength:90},prompt:{type:'string',minLength:20,maxLength:1800}},required:['page','caption','prompt'],additionalProperties:false}}},required:['pages'],additionalProperties:false};
   const result=await call('repair',repairSystemPrompt+'\n\n'+storySourceDirection+(original.localSource?'\n\n## 本地原文\n'+localPlanConstraint:''),{...payload(selection,plan,original,outline,false),issues,requestedPages},schema,Math.max(8192,requestedPages.length*800),original);
   return {...result,value:repairOutputSchema(requestedPages).parse(result.value).pages};
  },
 };
}
