// English product text and generation contracts; canonical source evidence remains unchanged.
// Describe persisted milestones and real image counts; model planning has no measurable percentage.
import type {SessionView} from './reader-model.ts';
import {shelfGenerationStatus} from './shelf-generation.ts';
import {readerStoryboardBatchSize,readerMaxAutomaticRepairs} from './reader-limits.ts';
import {productionSteps} from './production-stages.ts';
import type {RevisionRedraw} from './reader-revision-images.ts';

export function generationProgress(session:SessionView,now:number){
 const status=shelfGenerationStatus(session),meta=session.generationProgress;
 const running=status.group==='Generating',queued=status.group==='Queued',failed=status.group==='Failed';
 const total=meta?.frameCount??session.story?.pages.length??(typeof session.selection.length==='number'?session.selection.length:null);
 const ready=Math.max(0,Math.min(session.ready,total??session.ready));
 const phase=meta?.phase??(session.awaitingFrameCount?'frame-count':session.story?'image':session.frameRecommendation?'plan':'recommend');
 const sourceReady=meta?.sourceReady??!!session.story?.original;
 const countReady=meta?.frameCountConfirmed??(!!session.story||!!session.frameRecommendation&&!session.awaitingFrameCount);
 const activeState=failed?'failed' as const:running||queued||session.awaitingFrameCount||session.intake&&['choosing','confirming'].includes(session.intake.phase)?'current' as const:'paused' as const;
 const steps=productionSteps({intakePhase:session.intake?.phase,candidateBatches:session.intake?.batches.length,planReady:!!session.story,sourceReady,frameCountConfirmed:countReady,storyboardFrames:meta?.storyboardFrames,storyboardBatch:meta?.storyboardBatch,reviewOverridden:meta?.reviewOverridden,reviewStatus:meta?.reviewStatus,reviewPhase:meta?.reviewPhase,reviewRound:meta?.reviewRound,repairCompleted:meta?.repairCompleted,repairTotal:meta?.repairTotal,reviewAudits:meta?.reviewAudits,repairBatches:meta?.repairBatches,repairPasses:meta?.repairPasses,reviewStopReason:meta?.reviewStopReason,phase,total,ready,activeState});
 if(!session.intake&&!countReady&&session.frameRecommendation)steps[1].detail=`Suggested: ${session.frameRecommendation.count} frames`;
 const elapsed=running&&meta?.startedAt!==null&&meta?.startedAt!==undefined&&Number.isFinite(meta.startedAt)?Math.max(0,Math.floor((now-meta.startedAt)/1000)):null;
 const remaining=elapsed!==null&&meta?.timeoutAt!==null&&meta?.timeoutAt!==undefined&&Number.isFinite(meta.timeoutAt)?Math.max(0,Math.ceil((meta.timeoutAt-now)/1000)):null;
 const measured=phase==='image'&&total!==null;
 const note=phase==='reflection'?'The complete storyboard is saved. Writing a source-grounded ending before review.':phase==='review'?(meta?.reviewPhase==='frames'?'Checking source-based narrative tasks, frame distribution, omissions and repetition before full review.':'Checking the complete script, action, progression, continuity and ending. Drawing starts after approval.'):phase==='repair'?`Review → targeted repairs → full recheck. Up to ${readerMaxAutomaticRepairs} automatic repair rounds; unchanged drafts stop for your attention.`:phase==='plan'?(meta?.storyboardBatch?`Outline saved. Writing frames ${meta.storyboardBatch.first}–${meta.storyboardBatch.last} in batches of at most ${readerStoryboardBatchSize}; every batch is saved.`:session.selection.length==='auto'||typeof session.selection.length==='number'&&session.selection.length>readerStoryboardBatchSize?`Create the complete outline, then write and save batches of at most ${readerStoryboardBatchSize} frames.`:'The completed storyboard returns together; no percentage is available.'):phase==='image'?'Counts include only generated and saved images.':'Completed steps update automatically.';
 return {running,queued,steps,elapsed,remaining,attempt:meta?.attempt||0,measured,total,ready,note,slow:phase==='plan'&&elapsed!==null&&elapsed>=90};
}

const redrawReasons:Record<RevisionRedraw['reason'],string>={'first-lost':'The first reference image is missing; all frames need redrawing','first-changed':'Review changed the first reference image; all frames need redrawing',lost:'Some original images are missing and need redrawing',review:'Review changed some scene prompts'};
export function redrawNotice(redraw:RevisionRedraw){return `Redraw ${redraw.actual} frames (preview: ${redraw.previewed}): ${redrawReasons[redraw.reason]}. The original version is retained. You can pause at any time.`;}

export function generationDuration(seconds:number){
 const minutes=Math.floor(seconds/60),remaining=seconds%60;
 return `${minutes}m ${String(remaining).padStart(2,'0')}s`;
}
