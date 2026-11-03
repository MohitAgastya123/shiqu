// Plan revisions from actual image inputs. Captions/reflection never invalidate artwork;
// a changed anchor, cast, style or global image preference invalidates its dependants.
import {z} from 'zod';
import {acceptancePromptSchema} from './reader-acceptance.ts';
import {planSchema,ReaderError} from './reader-model.ts';
import type {Document,Plan,Selection} from './reader-model.ts';
import {artStyleIds} from './reader-styles.ts';
import {readerMinFrames,readerMaxFrames} from './reader-limits.ts';
import {narrativeDetailSchema} from './reader-frame-recommendation.ts';
import {localSourceSchema} from './reader-local-contract.ts';
import {reusableRevisionImages} from './reader-revision-images.ts';
import type {RevisionBase,RevisionRedraw} from './reader-revision-images.ts';
export {reusableRevisionImages};
export type {RevisionBase};

export const revisionChangesSchema=z.object({appendSource:localSourceSchema.optional(),productionPrompt:z.string().max(1200).optional(),acceptancePrompt:acceptancePromptSchema.optional(),artStyle:z.enum(artStyleIds).optional(),length:z.union([z.number().int().min(readerMinFrames).max(readerMaxFrames),z.literal('auto')]).optional(),narrativeDetail:narrativeDetailSchema.optional(),plan:planSchema.optional()}).strict();
export type RevisionChanges=z.infer<typeof revisionChangesSchema>;
export type RevisionInfo={parentId:string;rootId:string;number:number};
export type RevisionView=RevisionInfo&{redraw?:RevisionRedraw};
export type RevisionRecord=RevisionInfo&{kind?:'selection';selectionRequest?:string;baseToken:string;requestHash:string;handoff?:boolean;base:RevisionBase;previewedRedraw?:number;actualRedraw?:number;lostPages?:number[]};
export type RevisionSnapshot=RevisionBase&{token:string;epoch:number;revision?:RevisionInfo};
export type RevisionImpact={changed:boolean;replan:boolean;preserveScript:boolean;review:boolean;reused:number;redraw:number;total:number;reusePending:boolean;conflict:boolean};
export const revisionFrameCount=(base:RevisionBase)=>base.plan?.pages.length??(typeof base.selection.length==='number'?base.selection.length:base.frameRecommendation?.count??8);
export const preserveRevisionScript=(base:RevisionBase,changes:RevisionChanges)=>!base.plan&&base.savedFrameCount===revisionFrameCount(base)&&(changes.productionPrompt??base.selection.productionPrompt)===base.selection.productionPrompt&&(changes.narrativeDetail??base.selection.narrativeDetail??'balanced')===(base.selection.narrativeDetail||'balanced')&&(changes.length===undefined||changes.length===base.selection.length||changes.length===revisionFrameCount(base));
export function revisionImpact(base:RevisionBase,changes:RevisionChanges):RevisionImpact{
 const selection={...base.selection,productionPrompt:changes.productionPrompt??base.selection.productionPrompt,artStyle:changes.artStyle??base.selection.artStyle};
 const requirements=selection.productionPrompt!==base.selection.productionPrompt;
 const detail=changes.narrativeDetail!==undefined&&changes.narrativeDetail!==(base.selection.narrativeDetail||'balanced');
 const count=changes.length!==undefined&&(changes.length==='auto'?base.selection.length!=='auto':changes.length!==revisionFrameCount(base));
 const replan=!base.plan||requirements||detail||count,plan=changes.plan||base.plan;
 const manual=!!changes.plan&&JSON.stringify(changes.plan)!==JSON.stringify(base.plan);
 const acceptance=(changes.acceptancePrompt??base.selection.acceptancePrompt??'')!==(base.selection.acceptancePrompt||'');
 const changed=!!changes.appendSource||acceptance||requirements||detail||count||manual||selection.artStyle!==base.selection.artStyle;
 const total=changes.appendSource&&plan?plan.pages.length:typeof changes.length==='number'?changes.length:revisionFrameCount(base);
 const preserved=changes.appendSource?base.plan?.pages.length:base.preservedPages;
 const reusable=plan?reusableRevisionImages({...base,...(preserved?{preservedPages:preserved}:{})},selection,plan,preserved?plan.pages.map((_,i)=>i<preserved?i:null):undefined).filter(Boolean).length:0;
 return {changed,replan,preserveScript:preserveRevisionScript(base,changes),review:changed,reused:replan?0:reusable,redraw:replan?total:total-reusable,total,reusePending:!!base.plan&&replan&&!requirements&&selection.artStyle===base.selection.artStyle,conflict:replan&&manual};
}
export function checkedRevision(base:RevisionBase,changes:RevisionChanges){
 const parsed=revisionChangesSchema.safeParse(changes);
 if(!parsed.success){const issue=parsed.error.issues[0],page=issue.path.indexOf('pages');throw new ReaderError(400,page>=0?`第 ${Number(issue.path[page+1])+1} 幅内容长度不符合要求：旁白 8–90 字，画面提示词 20–1800 字。`:'请检查制作要求、人物设定及余味的内容长度。');}
 const impact=revisionImpact(base,changes);
 if(changes.plan&&!base.plan)throw new ReaderError(400,'完整分镜保存后才可手动修改分镜。');
 if(!impact.changed)throw new ReaderError(400,'尚未修改内容，无需创建新版。');
 if(impact.conflict)throw new ReaderError(400,'重新编排与手动分镜不能同时提交，请选择保留哪一类修改。');
 if(changes.appendSource){
  if(!base.plan||!base.selection.source||!changes.plan||impact.replan||changes.artStyle!==undefined&&changes.artStyle!==base.selection.artStyle||changes.length!==undefined||changes.narrativeDetail!==undefined)throw new ReaderError(400,'追加原文须提供完整续接分镜，并保留原画风、制作要求和叙事设置。');
  const plan=changes.plan;
  if(plan.pages.length<=base.plan.pages.length)throw new ReaderError(400,'追加原文须增加后续分镜。');
  assertPreservedPrefix({...base,preservedPages:base.plan.pages.length},plan);
 }else{
  if(changes.plan&&(['title','summary','sourceReference','adaptationNote'] as const).some(key=>changes.plan![key]!==base.plan![key]))throw new ReaderError(400,'本次仅修改分镜、人物与余味，原文出处和故事元信息保持不变。');
  if(changes.plan&&changes.plan.pages.length!==base.plan!.pages.length)throw new ReaderError(400,'请调整叙事详略，由模型重新编排数量，不要直接增删分镜。');
 }
 const selection:Selection={...base.selection,...(changes.acceptancePrompt!==undefined?{acceptancePrompt:changes.acceptancePrompt}:{}),productionPrompt:changes.productionPrompt??base.selection.productionPrompt,artStyle:changes.artStyle??base.selection.artStyle,narrativeDetail:changes.narrativeDetail??base.selection.narrativeDetail,length:changes.length??(impact.replan?'auto':base.selection.length)};
 return {impact,selection,plan:impact.replan?null:structuredClone(changes.plan||base.plan)};
}
export function syncRevisionImages(doc:Document,selection:Selection){
 if(doc.revision&&doc.plan){const base=doc.revision.base,count=base.preservedPages;doc.images=reusableRevisionImages(base,selection,doc.plan,count?doc.plan.pages.map((_,i)=>i<count?i:null):undefined);}
}
// Append revisions freeze the completed prefix; ordinary later revisions can deliberately edit it.
export function assertPreservedPrefix(base:RevisionBase,plan:Plan){
 const count=base.preservedPages;if(!count)return;
 const before=base.plan;
 if(!before||plan.pages.length<=count||plan.characters!==before.characters&&!plan.characters.startsWith(before.characters+'\n\n')||before.pages.slice(0,count).some((page,i)=>page.caption!==plan.pages[i]?.caption||page.prompt!==plan.pages[i]?.prompt))throw new ReaderError(409,'追加制作不能修改已保存的前段分镜或人物设定；请另建普通修订后再调整前段。');
}
