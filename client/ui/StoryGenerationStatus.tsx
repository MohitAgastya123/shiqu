// English interface: labels, accessibility text, and workflow messages use English.
// Active steps show only their deadline; saved final durations stay on completed checkpoints.
// Failed work offers recovery in the control slot; only active work offers pause.
// Standalone flows name the story; embedded settings reuse the title already shown above.
// Changing progress shares the navigation row in both presentations.
// Creation may split saved preparation timing from its separate confirmation gate.
import {useEffect,useState} from 'react';
import type {ComponentProps,ReactNode} from 'react';
import {Check,Clock3,Feather,Pause,X} from 'lucide-react';
import type {ProductionAction,SessionView} from '@/lib/reader-model';
import {shelfGenerationStatus} from '@/lib/shelf-generation';
import {generationDuration,generationProgress} from '@/lib/generation-progress';
import StoryBackToShelf from './StoryBackToShelf';
import StoryProductionTimeline from './StoryProductionTimeline';
import type {ProductionTimelineNavigation} from './ProductionTimeline';
import type {ProductionStage} from '@/lib/production-stages';
import StoryGenerationControl from './StoryGenerationControl';
import StoryFlowHeader from './StoryFlowHeader';
import type {StoryFlowNavigation} from './StoryFlowHeader';

export default function StoryGenerationStatus({session,busy,controlBusy,error,onControl,onRetry,onBack,onHistory,onAcceptance,navigation,timeline,stages,control,compact=false,reviewTools,stageContent,children,hideBack=false,showSummary=true}:{reviewTools?:ReactNode;stageContent?:Record<string,ReactNode>;compact?:boolean;children?:ReactNode;control?:ReactNode;timeline?:ProductionTimelineNavigation&Pick<ComponentProps<typeof StoryProductionTimeline>,'stageDurations'>;stages?:ProductionStage[];session:SessionView;busy:boolean;controlBusy:boolean;error:string;onControl:(id:string,action:ProductionAction)=>Promise<void>;onRetry:(faultId?:string)=>void;onBack:()=>void;hideBack?:boolean;showSummary?:boolean;onHistory?:()=>void;onAcceptance?:()=>void;navigation?:StoryFlowNavigation}){
 const status=shelfGenerationStatus(session),stopped=status.group==='Failed'||status.group==='Paused';
 const [,setNow]=useState(Date.now);
 const progress=generationProgress(session,Date.now()),moving=progress.running&&!error&&!stopped;
 useEffect(()=>{
  if(!moving)return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);
  return()=>clearInterval(timer);
 },[session.id,session.generationProgress?.startedAt,moving]);
 const title=session.selection.displayTitle||session.story?.title||session.selection.storyTitle||"Your story";
 const message=busy&&stopped?(session.state==='failed'?"Retrying generation":"Requesting generation"):error&&session.state!=='failed'?"Generation status could not be confirmed":status.message;
 const failed=!!error||status.group==='Failed';
 const paused=!!session.generationControl&&session.generationControl!=='active';
 const generationControl=control===undefined?(paused||!failed?<StoryGenerationControl session={session} busy={controlBusy} onControl={onControl} primary={paused} link/>:null):control;
 return <div className={'yu-generation-stage has-progress'+(compact||!showSummary?' is-compact':'')+(moving?' is-generating':'')+(failed?' has-error':'')+(session.reviewIssues?.length?' has-review-issues':'')}>
  {showSummary&&(!compact||failed)&&<div className="yu-generation-summary">
   <span className="yu-generation-mark" aria-hidden="true">{failed?<X size={23}/>:stopped?<Pause size={23}/>:session.state==='completed'?<Check size={23}/>:<Feather size={23}/>}</span>
   <div><p className="yu-generation-kicker">{failed?"Needs attention":stopped?"Progress kept":session.state==='completed'?"Production complete":"Turn the story into illustrations"}</p><h3>{title}</h3></div>
  </div>}
  <StoryFlowHeader title={progress.measured?"Illustration progress":"Production workflow"} status={message} {...navigation}/>
  <section className="yu-generation-progress" aria-label="Generation progress">
   <StoryProductionTimeline session={session} busy={busy||controlBusy} error={error} onRetry={onRetry} onAcceptance={onAcceptance} reviewTools={reviewTools} stageContent={stageContent} onHistory={onHistory} stages={stages||progress.steps} moving={moving} queued={progress.queued} {...timeline} currentTiming={moving?<><Clock3 size={12} aria-hidden="true"/>{progress.remaining===null?"Timeout details are syncing":progress.remaining>0?`Time until timeout: ${generationDuration(progress.remaining)}`:"Timed out. Waiting for a status update"}</>:undefined} currentContent={session.state!=='completed'?generationControl:null}/>
  </section>
  {children}
  {!hideBack&&<StoryBackToShelf onBack={onBack} link/>}
  {!hideBack&&(!session.intake||session.intake.phase==='confirmed')&&<p className="yu-generation-exit-note">{session.state==='completed'?"The complete story is saved on your shelf.":stopped||failed?"Saved content is kept. Manage it and continue generation from your shelf.":"Generate the full story after leaving. Pause anytime or check progress on your shelf."}</p>}
 </div>;
}
