// Active steps show only their deadline; saved final durations stay on completed checkpoints.
// Failed work offers recovery in the control slot; only active work offers pause.
import {useEffect,useState} from 'react';
import type {ReactNode} from 'react';
import {Check,Clock3,Feather,Pause,X} from 'lucide-react';
import type {ProductionAction,SessionView} from '@/lib/reader-model';
import {shelfGenerationStatus} from '@/lib/shelf-generation';
import {generationProgress} from '@/lib/generation-progress';
import StoryBackToShelf from './StoryBackToShelf';
import StoryProductionTimeline from './StoryProductionTimeline';
import type {ProductionTimelineNavigation} from './ProductionTimeline';
import type {ProductionStage} from '@/lib/production-stages';
import StoryGenerationControl from './StoryGenerationControl';
import StoryFlowHeader from './StoryFlowHeader';
import type {StoryFlowNavigation} from './StoryFlowHeader';

export default function StoryGenerationStatus({session,busy,controlBusy,error,onControl,onRetry,onBack,onHistory,onAcceptance,navigation,timeline,stages,control,compact=false,reviewTools,stageContent,children}:{reviewTools?:ReactNode;stageContent?:Record<string,ReactNode>;compact?:boolean;children?:ReactNode;control?:ReactNode;timeline?:ProductionTimelineNavigation;stages?:ProductionStage[];session:SessionView;busy:boolean;controlBusy:boolean;error:string;onControl:(id:string,action:ProductionAction)=>Promise<void>;onRetry:(faultId?:string)=>void;onBack:()=>void;onHistory?:()=>void;onAcceptance?:()=>void;navigation?:StoryFlowNavigation}){
 const status=shelfGenerationStatus(session),stopped=status.group==='生成失败'||status.group==='生成已暂停';
 const [,setNow]=useState(Date.now);
 const progress=generationProgress(session,Date.now()),moving=progress.running&&!error&&!stopped;
 useEffect(()=>{
  if(!moving)return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);
  return()=>clearInterval(timer);
 },[session.id,session.generationProgress?.startedAt,moving]);
 const title=busy&&stopped?(session.state==='failed'?'正在重试生成':'正在请求生成'):error&&session.state!=='failed'?'暂时无法确认生成状态':status.message;
 const failed=!!error||status.group==='生成失败';
 const paused=!!session.generationControl&&session.generationControl!=='active';
 const generationControl=control===undefined?(paused||!failed?<StoryGenerationControl session={session} busy={controlBusy} onControl={onControl} primary={paused} link/>:null):control;
 return <div className={'yu-generation-stage has-progress'+(compact?' is-compact':'')+(moving?' is-generating':'')+(failed?' has-error':'')+(session.reviewIssues?.length?' has-review-issues':'')}>
  {(!compact||failed)&&<div className="yu-generation-summary">
   <span className="yu-generation-mark" aria-hidden="true">{failed?<X size={23}/>:stopped?<Pause size={23}/>:session.state==='completed'?<Check size={23}/>:<Feather size={23}/>}</span>
   <div><p className="yu-generation-kicker">{failed?'需要处理':stopped?'进度已保留':session.state==='completed'?'制作完成':'把故事变成画面'}</p><h3>{title}</h3></div>
  </div>}
  <StoryFlowHeader title={progress.measured?'画面生成进度':'制作流程'} {...navigation}/>
  <section className="yu-generation-progress" aria-label="生成进展">
   {progress.measured&&<progress aria-label="画面生成进度" max={progress.total!} value={progress.ready}/>}
   <StoryProductionTimeline session={session} busy={busy||controlBusy} error={error} onRetry={onRetry} onAcceptance={onAcceptance} reviewTools={reviewTools} stageContent={stageContent} onHistory={onHistory} stages={stages||progress.steps} moving={moving} queued={progress.queued} {...timeline} currentTiming={moving?<><Clock3 size={12} aria-hidden="true"/>{progress.remaining===null?'超时信息待同步':progress.remaining>0?`距超时 ${progress.remaining} 秒`:'已达超时，等待状态更新'}</>:undefined} currentContent={session.state!=='completed'?generationControl:null}/>
  </section>
  {children}
  <StoryBackToShelf onBack={onBack} link/>
  {(!session.intake||session.intake.phase==='confirmed')&&<p className="yu-generation-exit-note">{session.state==='completed'?'完整故事已保存在书架。':stopped||failed?'已保存的内容会保留，可在书架中管理和继续生成。':'离开后继续生成整篇，可随时暂停或从书架查看进度。'}</p>}
 </div>;
}
