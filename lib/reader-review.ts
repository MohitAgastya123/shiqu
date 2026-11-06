// English product text and generation contracts; canonical source evidence remains unchanged.
// Audit source-to-frame coverage and pacing; adaptive scripts may repair structure before a fresh audit.
import {acceptanceInput} from './reader-acceptance.ts';
import {normalizeProductionPrompt} from './reader-prompts.ts';
import {z} from 'zod';
import {acceptanceCriteria,acceptanceReviewDirection,acceptanceResultSchema,acceptanceResultsJson} from './reader-acceptance.ts';
import type {AcceptanceResult} from './reader-acceptance.ts';
import {planSchema,reflectionCandidatesSchema} from './reader-model.ts';
import type {Plan,Selection,StoryboardOutline,ReflectionCandidates} from './reader-model.ts';
import {verifiedOriginalPayload} from './reader-source-types.ts';
import {storyBriefPayload,assertStoryBriefReady,withoutStorySummary} from './reader-story-brief.ts';
import type {OriginalSource} from './reader-source-types.ts';
import type {Generated} from './reader-engine.ts';
import {getArtStyle} from './reader-styles.ts';
import {storyPageDirection,storySceneDirection} from './reader-generation-contract.ts';
import {promptSections,inputBoundaryDirection,reflectionMeaningDirection,titleDirection,storyEditorialContext,storyScopeDirection,storyOpeningDirection,storyReviewDirection,storyKnowledgeDirection,storyRoleDirection} from './reader-prompts.ts';
import {readerStoryboardBatchSize,readerMinFrames,readerMaxFrames} from './reader-limits.ts';
import {localPlanConstraint} from './reader-local-contract.ts';
import {editorialAuditDirection,editorialCoverageSchema,editorialCoverageJson,validateEditorialCoverage} from './reader-editorial.ts';
import type {EditorialCoverage} from './reader-editorial.ts';
import {structuralEditsSchema,structuralEditsJson} from './reader-structure.ts';
import type {StructuralEdits} from './reader-structure.ts';
import type {ReasoningTask} from './reader-reasoning.ts';
import {narrativeDetailInstructions} from './reader-frame-recommendation.ts';

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
export type ReviewReport={acceptanceResults?:AcceptanceResult[];frameCountReview?:FrameCountReview;issues:ReviewIssue[];titleReview:TitleReview;reflectionChoice?:ReflectionChoice;coverage?:EditorialCoverage[]};
// Historical review reports remain readable without title audit metadata.
export type ReviewRecordMeta={step?:string;recordedAt?:string};
export type ReviewRepairRecord=ReviewRecordMeta&{round:number;requested:number[];changes:RepairedPage[];changed?:boolean;before?:RepairedPage[];reflection?:string;previousReflection?:string;structure?:StructuralEdits&{before:number;after:number;sourcePages:(number|null)[];removed:RepairedPage[];previousOutline?:StoryboardOutline;previousCharacters?:string}};
export type ReviewCheckpoint={phase?:'frames'|'full';frameCountReports?:(FrameCountReport&ReviewRecordMeta)[];overridden?:boolean;stopReason?:'limit'|'unchanged'|'replan'|'requirements';history?:ReviewRepairRecord[];status:'pending'|'repair'|'passed'|'blocked';round:number;repairs:number;issues:ReviewIssue[];repaired:number[];reports:(ReviewRecordMeta&{round:number;acceptanceResults?:AcceptanceResult[];frameCountReview?:FrameCountReview;issues:ReviewIssue[];coverage?:EditorialCoverage[];titleReview?:TitleReview&{previousTitle:string};reflectionChoice?:ReflectionChoice&{candidates:ReflectionCandidates}})[]};
export type RepairedPage={page:number;caption:string;prompt:string};
export function reviewReportSchema(count:number,candidates?:ReflectionCandidates,acceptancePrompt=''){return z.object({acceptanceResults:z.array(acceptanceResultSchema).max(20).optional(),frameCountReview:frameCountReviewSchema(count).optional(),titleReview:z.object({title:planSchema.shape.title.trim().min(1),reason:z.string().trim().min(1).max(400)}),issues:z.array(issueSchema.extend({page:z.number().int().min(0).max(count)})).max(count+1),coverage:z.array(editorialCoverageSchema).min(1).max(32).optional(),reflectionChoice:z.object({index:z.number().int().min(1).max(3),reason:z.string().trim().min(1).max(400)}).optional()}).superRefine((report,ctx)=>{
 const criteria=acceptanceCriteria(acceptancePrompt),results=report.acceptanceResults||[];
 if(criteria.length&&(results.length!==criteria.length||new Set(results.map(r=>r.criterion)).size!==criteria.length||results.some(r=>r.criterion>criteria.length)))ctx.addIssue({code:z.ZodIssueCode.custom,message:'Acceptance results must cover each criterion exactly once'});
 if(!criteria.length&&results.length)ctx.addIssue({code:z.ZodIssueCode.custom,message:'Unexpected acceptance results'});
 for(const result of results){if(result.pages.some(page=>page>count)||new Set(result.pages).size!==result.pages.length||result.status==='failed'&&!result.pages.some(page=>report.issues.some(issue=>issue.page===page)))ctx.addIssue({code:z.ZodIssueCode.custom,message:'Failed acceptance criteria require valid pages and corresponding repair issues'});}
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
export const storyReplanMessage="The main event or ending is incomplete. Adjust production requirements or frame count and replan the story.";
export function newReview():ReviewCheckpoint{return {history:[],status:'pending',round:0,repairs:0,issues:[],repaired:[],reports:[]};}

const string=(maxLength:number)=>({type:'string',minLength:1,maxLength});
const frameCountReviewJson={type:'object',properties:{decision:{type:'string',enum:['keep','expand','reduce','redistribute']},proposedCount:{type:'integer',minimum:readerMinFrames,maximum:readerMaxFrames},reason:{type:'string',minLength:1,maxLength:400}},required:['decision','proposedCount','reason'],additionalProperties:false};
export const frameCountReviewDirection="Review narrative space and distribution only: never choose a desired total and invent content to fill it.\n1. Read the complete original and identify distinct words, actions, responses, pauses and natural outcomes at the selected narrativeDetail. Consider narration, inner speech, poems and reported stories as well as visible actions; do not retain only familiar conclusions or require every detail to have a frame.\n2. Locate each task in the current draft and distinguish caption evidence from the scene prompt. Mentioning an entire exchange or showing its aftermath does not prove its decisive process has been developed. A list of conclusions does not express several layers of changing thought. Do not mechanically split sentence by sentence. No rendered images exist at this stage.\n3. Identify actual compression losses in exchange, experience, recognition or aftermath. Allow valid combinations retaining their role; combine, delete or redistribute repetition, overly fine subdivision and imbalanced scope. Preserve consequences that change the main event's meaning. Do not impose an ending ratio or preset total, chase unrelated sequel hooks or close genuine open endings.\n4. Turn each omission, repetition or imbalance into specific add/split/combine/delete/reallocate instructions with exact old ranges and distinct frame tasks, then count again. Existing count is not a target. Preserve valid dialogue and attribution; do not mask structural loss with longer narration, psychological explanation or a different crop.\nrequirements lists only material losses: page anchors the old draft; quote is one exact continuous short quotation from supplied verifiedOriginal (English when a saved translation exists), never joined, paraphrased or abbreviated. task states its independent role, captionEvidence/visualEvidence cite their fields, loss explains comprehension or pacing damage and instruction gives a concrete repair. Anchor missing sections at the nearest old frame; multiple tasks may use the same frame. Never claim to inspect rendered images.\nframeCountReview returns decision/proposedCount/reason: keep requires no requirements; expand/reduce/redistribute requires concrete requirements. Total is 1–80 and excludes a cover or separately displayed plan.reflection. Remove decorative or duplicated-ending placeholders while retaining source-grounded natural resolution. The proposed count is guidance, not a new hard lock. Full review follows repair. Do not review the title or ending here. Write all explanations in English."+storyRoleDirection;

const reflectionChoiceDirection="Candidates are numbered 1, 2, 3; plan.reflection is a placeholder. First judge validity, then compare grounded meaning, accuracy and expression. Return reflectionChoice:{index,reason}, explaining the source basis and concrete benefit over the others in English. Never default to the first, rank by length/ornament, combine candidates or invent a fourth. If any is valid, choose the best without demanding repairs to rejected candidates. If all fail, choose the nearest and report only that selected ending's reflection issue. Still review the complete storyboard.";
const storyEndingReviewDirection="Identify the main event from the complete original, check the actual title's promise, and locate natural resolution and necessary consequences. Test removing final frames: remove unrelated sequel hooks that launch new goals while leaving answers outside the work, but preserve unresolved necessary outcomes of the selected event. Report the actual completed/incomplete event, unresolved additions and specific repair boundaries. An original chapter endpoint or previous approval alone cannot justify passing. Preserve genuine open endings and do not expand indefinitely to chase new suspense.";
const storyPacingReviewDirection="Check what each frame adds: information, relationship change, consequence, distinct response or necessary pause. Test deleting/combining preparation, gifts, question-and-answer, messages and procedure. If cause, choice, response and outcome remain clear without loss of meaningful contrast or progression, a separate frame may be unnecessary. Merely changing action, dialogue or crop and having source evidence does not prove an independent task. Identify exact frame ranges, repetition, essential information and representative instants with a concrete merge plan. Do not impose totals or ratios or replace key drama with long narration.";
export const reviewSystemPrompt=promptSections(
 ['Task and boundaries','You independently review English illustrated-story scripts. Read the complete original, captions, prompts and characters before consulting summary and outline. Review only the written storyboard and its drawability; never claim to inspect rendered images or assert their actual style, expressions or injuries.'],
 ['Shared standards',storySceneDirection],
 ['Narrative detail',narrativeDetailInstructions],
 ['Per-frame requirements',storyPageDirection],
 ['Scope and opening',storyScopeDirection+'\n'+storyOpeningDirection],
 ['Main event and resolution',storyEndingReviewDirection],
 ['Deletion and combination check',storyPacingReviewDirection],
 ['Theme and summary audit',storyReviewDirection],
 ['Source coverage and pacing',editorialAuditDirection],
 ['Issue judgment','Read captions independently as an ordinary English-speaking adult: prompts, character notes or summary cannot repair missing narrative text. Review facts, meaning, action, composition, progression, continuity and artDirection. Report only demonstrable error, reading obstacle or material expressive loss. Valid compression, meaningful pauses and equivalent editorial preferences are not defects. Do not mechanically flag exceeding a target word count.'],
 ['Structural and local repair boundaries','For missing key stages/outcomes or structural redistribution use category=progression, requiresReplan=true, anchoring the cut or imbalance and specifying full insertion/deletion/replacement scope. Never hide missing drama with an ending sentence. Local issues use false and preserve other pages and numbering. A global character-bible conflict uses continuity/requiresReplan=true at its first conflict and explicitly preserves correct pages. Ordinary position, object or injury continuity is local; never rewrite global identity merely for style.'],
 ['Title standards',titleDirection],
 ['Title review','Return titleReview:{title,reason} in English. Retain an accurate title or directly correct misleading scope or an unsupported thematic claim with evidence and benefit. Do not attach title defects to a frame or alter other metadata.'],
 ['Ending standards',reflectionMeaningDirection],
 ['Ending review','The ending is displayed separately after the story. The last frame may end on action, dialogue or pause without a summary. If candidates exist review only the selected one. Read it with preceding text and identify factual misreading, repetition or meaning lost to overgeneralization. Trim redundant setup when insight is sound; a new interpretation needs source evidence and material benefit. Do not prescribe a final slogan or transfer its defect to the last frame.'],
 ['Acceptance criteria',acceptanceReviewDirection],
 ['Production and review responsibilities','Use productionPrompt to understand adaptation intent; do not turn every preference into an additional acceptance gate. Judge each custom acceptanceCriteria individually and continue applying the shared quality standards.'],
 ['Report contract','Prioritize factual/causal errors and missing decisive outcomes before evidenced continuity or expression loss. issues contains only required repairs, no scores or optional suggestions. Pass only with no issues and all acceptance criteria passed. Frames start at 1; the separate ending uses page=0/category=reflection. Merge all issues on one frame into one item and supply requiresReplan. problem cites source/caption/prompt and explains the actual loss; instruction gives the smallest executable repair and valid material to preserve. Coordinate distinct tasks per affected frame; report only a later frame if sufficient. Vague requests for depth, conflict or impact are not evidence. Preserve sound prompts for caption-only issues. All report prose must be English; exact internal source quotes remain original.'],
 ['Input and output',inputBoundaryDirection]);
const repairDirection="Repair only issues within requestedPages and return {pages:[{page,caption,prompt}]} in English. Match each original page number exactly; do not add/remove frames or alter unspecified pages or metadata. Resolve all issues on a frame while preserving valid voice, conditions, contrasts, responses and pauses. Retain outline events unless the issue explicitly requires coordination within requested pages. Do not move the problem elsewhere or invent motives. Distinguish repeated scenes through actual action, contact, state or focal point, not synonyms or crop alone. For caption-only issues change caption and return prompt unchanged. Check semantics and continuity against the complete story, add no psychological explanation as factual evidence and keep reflection out of the final frame. Return only JSON.";
export const repairSystemPrompt=promptSections(['Task','You repair only specified frames in an English illustrated-story script. Do not replan the whole story.'],['Shared standards',storySceneDirection],['Opening frame',storyOpeningDirection],['Per-frame requirements',storyPageDirection],['Repair scope and output',repairDirection],['Input boundary',inputBoundaryDirection]);

type Call=(task:ReasoningTask,instructions:string,payload:unknown,schema:unknown,maxOutputTokens:number,original?:OriginalSource)=>Promise<Generated<unknown>>;
export function storyboardReviewGenerator(call:Call){
 function payload(selection:Selection,plan:Plan,original:OriginalSource,outline?:StoryboardOutline,reviewing=true){assertStoryBriefReady(original);return {book:selection.customBook||selection.bookId,chosenStory:selection.storyTitle,editorialContext:storyEditorialContext(selection.theme),...(reviewing?storyBriefPayload(original):{}),exactPageCount:plan.pages.length,narrativeDetail:selection.narrativeDetail||'balanced',countPolicy:selection.length==='auto'?'adaptive':'fixed',...(reviewing?acceptanceInput(selection):{}),productionPrompt:normalizeProductionPrompt(selection.productionPrompt||'',selection.theme),artDirection:getArtStyle(selection.artStyle).prompt,verifiedOriginal:verifiedOriginalPayload(original),plan:reviewing?plan:withoutStorySummary(plan),...(outline?{outline:reviewing?outline:withoutStorySummary(outline)}:{})};}
 return {
  async reviewFrameCount(selection:Selection,plan:Plan,original:OriginalSource){
   if(selection.length!=='auto')throw Error('FRAME_COUNT_REVIEW_MODE');
   const count=plan.pages.length,schema={type:'object',properties:{requirements:{type:'array',maxItems:readerStoryboardBatchSize,items:{type:'object',properties:{page:{type:'integer',minimum:1,maximum:count},quote:{type:'string',minLength:2,maxLength:120},task:string(120),captionEvidence:string(180),visualEvidence:string(180),loss:string(180),instruction:string(400)},required:['page','quote','task','captionEvidence','visualEvidence','loss','instruction'],additionalProperties:false}},frameCountReview:frameCountReviewJson},required:['requirements','frameCountReview'],additionalProperties:false};
   const instructions=promptSections(['Task','You edit narrative space and frame count at the first review gate. Identify missing key drama, repetition and excessive subdivision, then count necessary tasks. Detailed fact checking, polish, composition, continuity, title and ending belong to the following full review. The original controls; adaptation notes or previous approval are insufficient.'],['Evidence and missing text',storyKnowledgeDirection],['Story scope',storyScopeDirection],['Main event and resolution',storyEndingReviewDirection],['Deletion and combination check',storyPacingReviewDirection],['Narrative detail',narrativeDetailInstructions],['Review order',frameCountReviewDirection],['Input boundary',inputBoundaryDirection]);
   const result=await call('review',instructions+(original.localSource?'\n'+localPlanConstraint:''),payload(selection,plan,original,undefined,false),schema,24000,original);
   const value=parseFrameCountReport(count,result.value);validateEditorialCoverage(value.coverage,original);return {...result,value};
  },
  async review(selection:Selection,plan:Plan,original:OriginalSource,outline?:StoryboardOutline,reflectionCandidates?:ReflectionCandidates){
   const candidates=reflectionCandidates?reflectionCandidatesSchema.parse(reflectionCandidates):undefined;
   const count=plan.pages.length,schema={type:'object',properties:{...(acceptanceCriteria(selection.acceptancePrompt).length?{acceptanceResults:acceptanceResultsJson}:{}),coverage:editorialCoverageJson(count),titleReview:{type:'object',properties:{title:string(160),reason:string(400)},required:['title','reason'],additionalProperties:false},issues:{type:'array',maxItems:count+1,items:{type:'object',properties:{page:{type:'integer',minimum:0,maximum:count},category:{type:'string',enum:categories},problem:string(180),instruction:string(400),requiresReplan:{type:'boolean'}},required:['page','category','problem','instruction','requiresReplan'],additionalProperties:false}},...(candidates?{reflectionChoice:{type:'object',properties:{index:{type:'integer',enum:[1,2,3]},reason:string(400)},required:['index','reason'],additionalProperties:false}}:{})},required:['issues','titleReview','coverage',...(acceptanceCriteria(selection.acceptancePrompt).length?['acceptanceResults']:[]),...(candidates?['reflectionChoice']:[])],additionalProperties:false};
   const result=await call('review',reviewSystemPrompt+(original.localSource?'\n'+localPlanConstraint:'')+'\n\n'+promptSections(
    ['Current count policy',selection.length==='auto'?'countPolicy=adaptive: exactPageCount is the current count, not a target. Mark justified insertion, deletion or redistribution requiresReplan=true for structural repair.':'countPolicy=fixed: when a fixed-count draft truly needs structural change, still mark requiresReplan=true rather than inventing a local repair.'],
    ['Ending under review',candidates?reflectionChoiceDirection:'Review plan.reflection; do not return reflectionChoice.']),
    {...payload(selection,plan,original,outline),...(candidates?{reflectionCandidates:candidates}:{})},schema,24000,original);
   const value=reviewReportSchema(count,candidates,selection.acceptancePrompt).parse(result.value);if(selection.length==='auto'&&!value.coverage)throw Error('EDITORIAL_COVERAGE_REQUIRED');if(value.coverage)validateEditorialCoverage(value.coverage,original);
   return {...result,value};
  },
  async restructure(selection:Selection,plan:Plan,original:OriginalSource,issues:ReviewIssue[],coverage?:EditorialCoverage[],frameCountContext?:FrameCountContext){
   if(selection.length!=='auto'||!issues.some(issue=>issue.requiresReplan))throw Error('INVALID_STRUCTURAL_SCOPE');
   const direction=`Return {edits:[{from,to,pages:[{caption,prompt}]}]} in English based on source and issues. from/to are original 1-based frame numbers, ascending and nonoverlapping. Replace inclusive from..to; from=k,to=k-1 inserts before k; from=old length+1 appends; empty pages deletes. Change only coordinated contiguous ranges, totaling at most ${readerStoryboardBatchSize} new/replacement frames and 1–80 overall. Preserve key actions, responses and outcomes, combine taskless repetition and never truncate the ending for budget. coverage is guidance, the original is evidence. A full review follows; leave ending/local issues for later. Do not return a full draft, cover or separate ending page. Optionally return characters to correct global conflicts or outdated frame-number/state references, preserving stable identity, clothing and correct pages. Describe dynamic marks by stage, invent no events. For characters-only edits may be empty; omitted/null characters preserves the old bible. Other metadata remains unchanged.`;
   const instructions=promptSections(['Task','You structurally repair English illustrated-story scripts.'],['Shared standards',storySceneDirection],['Story scope',storyScopeDirection],['Per-frame requirements',storyPageDirection],['Structural output',direction+(frameCountContext?'\nApply every complete frameCountContext requirement, not just truncated issue summaries. The proposed count is guidance; restore necessary tasks, then count.':'')],['Input boundary',inputBoundaryDirection]);
   const result=await call('repair',instructions+(original.localSource?'\n'+localPlanConstraint:''),{...payload(selection,plan,original,undefined,false),issues,...(coverage?{coverage}:{}),...(frameCountContext?{frameCountContext}:{})},structuralEditsJson(plan.pages.length),16000,original);
   return {...result,value:structuralEditsSchema.parse(result.value)};
  },
  async repair(selection:Selection,plan:Plan,original:OriginalSource,issues:ReviewIssue[],outline?:StoryboardOutline){
   const requestedPages=issues.map(issue=>issue.page);
   if(issues.some(issue=>issue.requiresReplan)||requestedPages.some(page=>page<1)||!requestedPages.length||requestedPages.length>readerStoryboardBatchSize||new Set(requestedPages).size!==requestedPages.length)throw Error('INVALID_REPAIR_SCOPE');
   const schema={type:'object',properties:{pages:{type:'array',minItems:requestedPages.length,maxItems:requestedPages.length,items:{type:'object',properties:{page:{type:'integer',enum:requestedPages},caption:{type:'string',minLength:8,maxLength:500},prompt:{type:'string',minLength:20,maxLength:4000}},required:['page','caption','prompt'],additionalProperties:false}}},required:['pages'],additionalProperties:false};
   const result=await call('repair',repairSystemPrompt+(original.localSource?'\n\n## Local source\n'+localPlanConstraint:''),{...payload(selection,plan,original,outline,false),issues,requestedPages},schema,Math.max(8192,requestedPages.length*800),original);
   return {...result,value:repairOutputSchema(requestedPages).parse(result.value).pages};
  },
 };
}
