// English interface: labels, accessibility text, and workflow messages use English.
// Keep every checkpoint on a shared icon axis, with navigation and feedback under its step.
// Review history belongs to the latest review checkpoint rather than the drawing footer.
import {Fragment} from 'react';
import StoryFlowAction from './StoryFlowAction';
import {generationDuration} from '@/lib/generation-progress';
import type {ReactNode} from 'react';
import {readerMaxAutomaticRepairs} from '../../lib/reader-limits';
import {Check,Loader2,Minus,Pause,X} from 'lucide-react';
import type {ProductionStage} from '../../lib/production-stages';
import './production-timeline.css';
type StageAction={label:string;onClick:()=>void};
export type ProductionTimelineNavigation={actions?:Record<string,StageAction>;links?:Record<string,StageAction[]>;detailActions?:Record<string,StageAction>};
export default function ProductionTimeline({stages,moving=false,queued=false,layout='vertical',actions={},links={},detailActions={},onHistory,stageContent={},stageDurations={},stageTimes={}}:{stages:ProductionStage[];moving?:boolean;queued?:boolean;layout?:'vertical'|'horizontal';onHistory?:()=>void;stageContent?:Record<string,ReactNode>;stageDurations?:Record<string,number>;stageTimes?:Record<string,ReactNode>;} & ProductionTimelineNavigation){
 const labels={pending:"Upcoming",current:queued?"Waiting":moving?"In progress":"Awaiting update",done:"Completed",skipped:"Not needed",unavailable:"Not enabled",failed:"Needs attention",paused:"Paused"};
 const stateLabel=(step:ProductionStage)=>step.id==='count'&&step.state==='current'&&!moving&&!queued?"Awaiting confirmation":labels[step.state];
 const focused=stages.find(step=>['current','failed','paused'].includes(step.state))||stages.find(step=>step.state==='pending')||stages.at(-1);
 const historyStage=[...stages].reverse().find(step=>['review','repair','recheck'].includes(step.id)&&!['pending','skipped','unavailable'].includes(step.state))||stages.find(step=>step.id==='review'&&step.state!=='unavailable');
 return <><ol className={'production-timeline'+(layout==='horizontal'?' production-timeline--horizontal':'')} aria-label="Full review workflow">{stages.map((step,index)=>{
 const done=layout==='vertical'&&step.state==='done',duration=stageDurations[step.id];
 const timing=done?(typeof duration==='number'&&Number.isFinite(duration)&&duration>=0?`Time: ${generationDuration(duration)}`:null):stageTimes[step.id];
 const history=layout==='vertical'&&onHistory&&step.id===historyStage?.id;
 const name=links[step.id]?.length?links[step.id].map((link,index)=><Fragment key={link.label}>{index>0&&<span aria-hidden="true"> and </span>}<StoryFlowAction onClick={link.onClick}>{link.label}</StoryFlowAction></Fragment>):actions[step.id]?<StoryFlowAction aria-label={actions[step.id].label} onClick={actions[step.id].onClick}>{step.label}</StoryFlowAction>:step.label;
 return <li key={step.id} className={[done?'production-stage-complete':'',layout==='vertical'&&stageContent[step.id]?'has-stage-content':''].filter(Boolean).join(' ')||undefined} data-stage={step.id} data-state={step.state} aria-current={['current','failed','paused'].includes(step.state)?'step':undefined} title={layout==='horizontal'?`${step.label} · ${stateLabel(step)}\n${step.detail}`:undefined}>
  <span className="production-stage-icon" aria-hidden="true">{step.state==='done'?<Check size={13}/>:step.state==='failed'?<X size={13}/>:step.state==='paused'?<Pause size={12}/>:step.state==='skipped'||step.state==='unavailable'?<Minus size={13}/>:step.state==='current'&&moving?<Loader2 size={14} className="production-stage-spin"/>:index+1}</span>
  <span className="production-stage-copy"><strong className={links[step.id]?.length?'production-stage-links':undefined}>{name}</strong><small>{detailActions[step.id]?<StoryFlowAction aria-label={detailActions[step.id].label} onClick={detailActions[step.id].onClick}>{step.detail}</StoryFlowAction>:step.detail}</small></span>
  {(!done||timing||history)&&<span className="production-stage-meta">{!done&&<span className="production-stage-state">{stateLabel(step)}</span>}{timing&&<span className="production-stage-timing">{timing}</span>}{history&&<StoryFlowAction onClick={onHistory}>Review history</StoryFlowAction>}</span>}
  {layout==='vertical'&&stageContent[step.id]&&<div className="production-stage-notice">{stageContent[step.id]}</div>}
 </li>;
 })}</ol>{layout==='vertical'&&!onHistory&&stages.some(step=>step.id==='review'&&step.state!=='unavailable')&&<p className="production-review-loop" aria-label="Review and repair loop">Review → repair → full recheck. Failed reviews return to repair, for up to {readerMaxAutomaticRepairs}  automatic rounds. Pauses if nothing changes or the limit is reached.</p>}{layout==='horizontal'&&focused&&<p className="production-stage-current" data-state={focused.state} role="status"><strong>{focused.label} · {stateLabel(focused)}</strong><span>{focused.detail}</span></p>}</>;
}
