// Plan revisions from actual illustration inputs and separate balloon layout from editorial changes.
// Balloon positions and IDs retain review; text, attribution, kind, evidence and order require review.
// Captions/reflection never invalidate artwork;
// a changed anchor, cast, style or global image preference invalidates its dependants.
// Style and explicit image-only redraws preserve review; content and acceptance edits invalidate it.
import {z} from 'zod';
import {acceptancePromptSchema} from './reader-acceptance.ts';
import {planSchema,ReaderError} from './reader-model.ts';
import type {Document,Plan,Selection} from './reader-model.ts';
import type {ReviewCheckpoint} from './reader-review.ts';
import {artStyleIds} from './reader-styles.ts';
import {readerMinFrames,readerMaxFrames} from './reader-limits.ts';
import {narrativeDetailSchema} from './reader-frame-recommendation.ts';
import {reusableRevisionImages} from './reader-revision-images.ts';
import type {RevisionBase,RevisionRedraw} from './reader-revision-images.ts';
import {fitBubbleText,bubbleReferenceWidth,bubbleReferenceHeight} from './comic-bubble-layout.ts';
export {reusableRevisionImages};
export type {RevisionBase};

export const revisionChangesSchema=z.object({productionPrompt:z.string().max(1200).optional(),acceptancePrompt:acceptancePromptSchema.optional(),artStyle:z.enum(artStyleIds).optional(),length:z.union([z.number().int().min(readerMinFrames).max(readerMaxFrames),z.literal('auto')]).optional(),narrativeDetail:narrativeDetailSchema.optional(),plan:planSchema.optional(),redrawPages:z.array(z.number().int().min(1).max(readerMaxFrames)).min(1).max(readerMaxFrames).refine(pages=>new Set(pages).size===pages.length,'Redraw page numbers must be unique.').optional()}).strict();
export type RevisionChanges=z.infer<typeof revisionChangesSchema>;
export type RevisionInfo={parentId:string;rootId:string;number:number};
export type RevisionView=RevisionInfo&{redraw?:RevisionRedraw};
export type RevisionRecord=RevisionInfo&{kind?:'selection';selectionRequest?:string;baseToken:string;requestHash:string;handoff?:boolean;base:RevisionBase;previewedRedraw?:number;actualRedraw?:number;lostPages?:number[];redrawPages?:number[]};
export type RevisionSnapshot=RevisionBase&{token:string;epoch:number;reviewStatus?:ReviewCheckpoint['status'];revision?:RevisionInfo};
export type RevisionImpact={changed:boolean;replan:boolean;preserveScript:boolean;review:boolean;reused:number;redraw:number;total:number;reusePending:boolean;conflict:boolean};
export const revisionFrameCount=(base:RevisionBase)=>base.plan?.pages.length??(typeof base.selection.length==='number'?base.selection.length:base.frameRecommendation?.count??8);
export const preserveRevisionScript=(base:RevisionBase,changes:RevisionChanges)=>!base.plan&&base.savedFrameCount===revisionFrameCount(base)&&(changes.productionPrompt??base.selection.productionPrompt)===base.selection.productionPrompt&&(changes.narrativeDetail??base.selection.narrativeDetail??'balanced')===(base.selection.narrativeDetail||'balanced')&&(changes.length===undefined||changes.length===base.selection.length||changes.length===revisionFrameCount(base));
// Compare semantic fields explicitly: layout-only edits must not invoke a paid model review.
const editorialPlan=(plan:Plan|null)=>plan&&({...plan,pages:plan.pages.map(({bubbles,...page})=>({...page,bubbles:(bubbles||[]).map(({kind,speaker,text,sourceQuote})=>({kind,speaker,text,...(sourceQuote?{sourceQuote}:{})}))}))});
export function revisionImpact(base:RevisionBase,changes:RevisionChanges):RevisionImpact{
 const selection={...base.selection,productionPrompt:changes.productionPrompt??base.selection.productionPrompt,artStyle:changes.artStyle??base.selection.artStyle};
 const requirements=selection.productionPrompt!==base.selection.productionPrompt;
 const detail=changes.narrativeDetail!==undefined&&changes.narrativeDetail!==(base.selection.narrativeDetail||'balanced');
 const count=changes.length!==undefined&&(changes.length==='auto'?base.selection.length!=='auto':changes.length!==revisionFrameCount(base));
 const replan=!base.plan||requirements||detail||count,plan=changes.plan||base.plan;
 const manual=!!changes.plan&&JSON.stringify(changes.plan)!==JSON.stringify(base.plan);
 const editorial=manual&&JSON.stringify(editorialPlan(changes.plan!))!==JSON.stringify(editorialPlan(base.plan));
 const acceptance=(changes.acceptancePrompt??base.selection.acceptancePrompt??'')!==(base.selection.acceptancePrompt||'');
 const changed=acceptance||requirements||detail||count||manual||selection.artStyle!==base.selection.artStyle||!!changes.redrawPages?.length;
 const total=typeof changes.length==='number'?changes.length:revisionFrameCount(base);
 const reusable=plan?reusableRevisionImages(base,selection,plan).filter((image,index)=>image&&!changes.redrawPages?.includes(index+1)).length:0;
 return {changed,replan,preserveScript:preserveRevisionScript(base,changes),review:replan||acceptance||editorial,reused:replan?0:reusable,redraw:replan?total:total-reusable,total,reusePending:!!base.plan&&replan&&!requirements&&selection.artStyle===base.selection.artStyle,conflict:replan&&manual};
}
export function checkedRevision(base:RevisionBase,changes:RevisionChanges){
 const parsed=revisionChangesSchema.safeParse(changes);
 if(!parsed.success){const issue=parsed.error.issues[0],page=issue.path.indexOf('pages');throw new ReaderError(400,page>=0?issue.path.includes('bubbles')?`Frame ${Number(issue.path[page+1])+1} has an invalid comic bubble: ${issue.message}`:`Frame ${Number(issue.path[page+1])+1} has invalid text length: narration up to 500 characters; scene prompt 20–4000 characters.`:'Check the lengths of creative requirements, character descriptions and ending.');}
 for(const [index,page] of (changes.plan?.pages||[]).entries())for(const bubble of page.bubbles||[])if(!fitBubbleText(bubble.text,bubble.width*bubbleReferenceWidth,bubble.height*bubbleReferenceHeight,bubble.kind,bubble.speaker))throw new ReaderError(400,`Frame ${index+1} has a comic bubble that is too dense to read. Shorten its text or enlarge the bubble.`);
 if(changes.redrawPages){
  if(Object.keys(changes).some(key=>key!=='redrawPages'))throw new ReaderError(400,'Image-only redraw cannot also change text, storyboards or production settings.');
  if(!base.plan||changes.redrawPages.some(page=>page>base.plan!.pages.length))throw new ReaderError(400,'Redraw page numbers must belong to the saved complete storyboard.');
 }
 const impact=revisionImpact(base,changes);
 if(changes.plan&&!base.plan)throw new ReaderError(400,'Save the complete storyboard before editing frames manually.');
 if(!impact.changed)throw new ReaderError(400,'No content has changed; a new version is unnecessary.');
 if(impact.conflict)throw new ReaderError(400,'Replanning and manual storyboard edits cannot be submitted together. Choose which changes to retain.');
 if(changes.plan&&(['title','summary','sourceReference','adaptationNote'] as const).some(key=>changes.plan![key]!==base.plan![key]))throw new ReaderError(400,'This revision may change frames, characters and ending; source and story metadata must remain unchanged.');
 if(changes.plan&&changes.plan.pages.length!==base.plan!.pages.length)throw new ReaderError(400,'Adjust narrative detail to replan the count rather than directly adding or removing frames.');
 const selection:Selection={...base.selection,...(changes.acceptancePrompt!==undefined?{acceptancePrompt:changes.acceptancePrompt}:{}),productionPrompt:changes.productionPrompt??base.selection.productionPrompt,artStyle:changes.artStyle??base.selection.artStyle,narrativeDetail:changes.narrativeDetail??base.selection.narrativeDetail,length:changes.length??(impact.replan?'auto':base.selection.length)};
 return {impact,selection,plan:impact.replan?null:structuredClone(changes.plan||base.plan)};
}
export function syncRevisionImages(doc:Document,selection:Selection){
 if(doc.revision&&doc.plan)doc.images=reusableRevisionImages(doc.revision.base,selection,doc.plan).map((image,index)=>doc.revision!.redrawPages?.includes(index+1)?'':image);
}
