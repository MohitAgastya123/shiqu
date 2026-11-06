// English product text and generation contracts; canonical source evidence remains unchanged.
// Present saved production checkpoints consistently without dispatching work or inferring review approval.
import {readerStoryboardBatchSize} from './reader-limits.ts';
export type ProductionStageState='pending'|'current'|'done'|'skipped'|'unavailable'|'failed'|'paused';
export type ProductionStage={id:string;label:string;state:ProductionStageState;detail:string};
export type ProductionCheckpoint={reviewOverridden?:boolean|number|null;intakePhase?:string;candidateBatches?:number;planReady:boolean;sourceReady?:boolean;frameCountConfirmed?:boolean;phase?:string;storyboardFrames?:number|null;storyboardBatch?:{first:number;last:number};reviewStatus?:'pending'|'repair'|'passed'|'blocked'|null;reviewPhase?:'frames'|'full'|null;reviewRound?:number;repairCompleted?:number;repairTotal?:number;reviewAudits?:number;repairBatches?:number;repairPasses?:number;reviewStopReason?:'limit'|'unchanged'|'replan'|'requirements'};
type Input=ProductionCheckpoint&{phase?:string;total:number|null;ready:number;activeState?:'current'|'failed'|'paused'};
export function productionStages(input:Input):ProductionStage[]{
 const {planReady,reviewStatus,reviewRound=0,repairCompleted=0,repairTotal=0,total,ready,activeState='current'}=input;
 const phase=input.phase||(!planReady?'plan':reviewStatus==='repair'?'repair':reviewStatus==='pending'||reviewStatus==='blocked'?'review':'image');
 const legacy=planReady&&!reviewStatus,passed=reviewStatus==='passed',blocked=reviewStatus==='blocked';
 const needsReplan=blocked&&input.reviewStopReason==='replan',requirementsBlocked=blocked&&input.reviewStopReason==='requirements';
 const requirementsRecheck=requirementsBlocked&&(input.reviewAudits??reviewRound)>1;
 const stoppedBeforeRepair=needsReplan||requirementsBlocked&&!requirementsRecheck;
 const rechecking=!needsReplan&&phase==='review'&&(reviewRound>0||!!input.repairPasses);
 const repaired=reviewStatus==='repair'||blocked||rechecking||!!input.repairPasses||passed&&reviewRound>1||!!input.reviewOverridden;
 const active=(at:boolean):ProductionStageState=>at?activeState:'pending';
 const reviewState:ProductionStageState=stoppedBeforeRepair?'failed':legacy?'unavailable':passed||repaired?'done':active(phase==='review');
 const repairState:ProductionStageState=requirementsBlocked?(input.repairPasses?'done':'skipped'):stoppedBeforeRepair?'skipped':blocked&&input.reviewStopReason==='unchanged'?'failed':legacy?'unavailable':passed&&!repaired?'skipped':blocked||rechecking||passed&&repaired?'done':active(phase==='repair');
 const recheckState:ProductionStageState=stoppedBeforeRepair?'pending':blocked&&input.reviewStopReason==='unchanged'?'pending':legacy?'unavailable':passed?(repaired?'done':'skipped'):blocked?'failed':active(rechecking);
 const count=total===null?'':` / ${total}`;
 const batch=input.storyboardBatch||(!planReady&&input.storyboardFrames!=null&&total!==null&&input.storyboardFrames<total?{first:input.storyboardFrames+1,last:Math.min(input.storyboardFrames+readerStoryboardBatchSize,total)}:null);
 return [
  {id:'plan',label:'Storyboard batches',state:planReady?'done':active(phase==='plan'||phase==='reflection'),detail:phase==='reflection'?'Storyboard saved; writing the ending':planReady?`${total===null?'Complete':total+' frames of'} storyboard saved`:batch?`Saved ${input.storyboardFrames||0}${count} frames; writing ${batch.first}–${batch.last}`:input.storyboardFrames!=null?`Saved ${input.storyboardFrames}${count} storyboard frames`:'Waiting for the complete storyboard'},
  {id:'review',label:input.reviewPhase==='frames'?'Frame-count review':'Full-story review',state:reviewState,detail:input.reviewOverridden?'You explicitly skipped the unfinished review':input.reviewPhase==='frames'?'Checking missing tasks, repetition and frame distribution':requirementsBlocked&&!requirementsRecheck?'Acceptance criteria conflict or cannot be judged':needsReplan?'The main event is incomplete and needs replanning':legacy?'Review was not enabled for this older story':reviewState==='done'?(passed&&!repaired?'Initial review passed':'Full-story review complete'):phase==='review'&&!rechecking?'Checking frames, batch continuity and ending':'Waiting for storyboard and ending'},
  {id:'repair',label:'Targeted repairs',state:repairState,detail:requirementsBlocked&&!input.repairPasses?(requirementsRecheck?'No automatic repairs before this recheck':'Waiting for criteria changes; no automatic repairs'):needsReplan?'Structure needs replanning; local repairs did not run':legacy?'Review was not enabled for this older story':repairState==='skipped'?'Initial review passed; repairs unnecessary':phase==='repair'?`Round ${(input.repairPasses||0)+1}: repaired ${repairCompleted} / ${repairTotal} issues`:repairState==='done'?typeof input.repairBatches==='number'?`Completed ${input.repairBatches} repair batches`:'Affected frames have been repaired':'Runs only when review finds issues'},
  {id:'recheck',label:'Recheck',state:recheckState,detail:requirementsBlocked?(requirementsRecheck?'Acceptance criteria conflict or cannot be judged':'Recheck after adjusting acceptance criteria'):needsReplan?'Review again after replanning':legacy?'Review was not enabled for this older story':blocked?`${repairTotal} issues remain; drawing is blocked`:input.reviewOverridden?'You explicitly approved unresolved issues':recheckState==='skipped'?'Initial review passed; no recheck needed':passed?`Recheck passed after ${input.reviewAudits??reviewRound} reviews`:rechecking?(input.reviewPhase==='frames'?'Rechecking frame count and narrative tasks':`Running full review ${(input.reviewAudits??reviewRound)+1}`):'Review again after repairs'},
  {id:'image',label:'Drawing',state:planReady&&(legacy||passed)&&total!==null&&total>0&&ready>=total?'done':active(phase==='image'&&planReady&&(legacy||passed)),detail:requirementsBlocked?'Waiting for criteria changes; drawing is blocked':needsReplan?'Waiting for replanning; drawing is blocked':blocked?'Waiting for repairs; drawing is blocked':reviewStatus&&!passed?'Waiting for review approval':total===null?`Saved ${ready} frames`:`${ready} / ${total} images saved`},
 ];
}

export function productionSteps(input:Input):ProductionStage[]{
 const sourceReady=input.sourceReady??input.planReady,countReady=input.frameCountConfirmed??input.planReady;
 const activeState=input.activeState||'current',phase=input.phase||(!input.planReady?'plan':undefined);
 return [
  {id:'source',label:'Prepare English source',state:sourceReady?'done':phase==='source'||phase==='recommend'?activeState:'pending',detail:sourceReady?'Saved':'Pending'},
  {id:'count',label:'Detail and length',state:countReady?'done':phase==='frame-count'||phase==='recommend'&&sourceReady?activeState:'pending',detail:countReady&&input.total!==null?`${input.total} frames`:'To be determined'},
  ...productionStages(input),
 ].map(step=>input.intakePhase&&step.id==='source'?{...step,label:'Discover story',state:input.intakePhase==='discovering'?activeState:'done',detail:input.intakePhase==='discovering'?'Finding and saving story candidates':`Saved ${input.candidateBatches||0} candidate batches`}:input.intakePhase&&step.id==='count'?{...step,label:'Production confirmation',state:input.intakePhase==='confirmed'?'done':input.intakePhase==='discovering'?'pending':activeState,detail:input.intakePhase==='choosing'?'Choose a story':input.intakePhase==='preparing'?'Saving English source and production suggestions':input.intakePhase==='confirming'?'Confirm story, style, detail and requirements':input.intakePhase==='confirmed'?'Production confirmed; planning and review determine frame count':'Waiting for story candidates'}:step) as ProductionStage[];
}
