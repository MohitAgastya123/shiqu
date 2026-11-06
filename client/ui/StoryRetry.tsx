// English interface: labels, accessibility text, and workflow messages use English.
'use client';
// Pending faults expose recovery actions; timelines can place those actions in their footer.
// Active recoveries keep their old error in a disclosure.
import StoryFlowAction from './StoryFlowAction';
import {useState} from 'react';
import type {SessionView} from '@/lib/reader-model';
import type {FaultView} from '@/lib/reader-recovery';

function label(fault:FaultView){
 if(fault.stage==='redraw')return fault.page===null?"Redraw image":`Redraw page ${fault.page+1}`;
 return {prepare:"Retry preparation",source:"Retry source lookup",publication:"Retry image save",review:"Continue automatic repair",generation:"Retry generation"}[fault.stage];
}
function recoveryLabel(fault:FaultView){
 if(fault.stage==='redraw')return fault.page===null?"Redrawing image":`Redrawing page ${fault.page+1}`;
 return {prepare:"Preparing again",source:"Looking up source again",publication:"Saving image again",review:"Continuing revisions",generation:"Resuming generation"}[fault.stage];
}
export default function StoryRetry({session,busy,onRetry,primary=false,link=false,display='all'}:{session:SessionView;busy:boolean;onRetry:(faultId?:string)=>void|Promise<void>;primary?:boolean;link?:boolean;display?:'all'|'feedback'|'actions'}){
 const [pending,setPending]=useState<string[]>([]);
 function recover(id:string){setPending(ids=>[...ids,id]);void Promise.resolve(onRetry(id)).finally(()=>setPending(ids=>ids.filter(value=>value!==id)));}
 const paused=!!session.generationControl&&session.generationControl!=='active';
 const action=(fault:FaultView)=>fault.state==='pending'&&fault.retryAllowed&&!paused&&<StoryFlowAction key={fault.id} asLink={link} type="button" className={primary?'yu-primary':undefined} disabled={pending.includes(fault.id)} onClick={()=>recover(fault.id)}>{pending.includes(fault.id)?"Requesting…":label(fault)}</StoryFlowAction>;
 if(session.faults?.length&&display==='actions')return session.faults.some(fault=>fault.state==='pending'&&fault.retryAllowed&&!paused)?<div className="yu-retry-actions">{session.faults.map(action)}</div>:null;
 if(session.faults?.length)return <div className="yu-fault-list" aria-label="Issues to resolve">{session.faults.map(fault=><div className="yu-retry-control" key={fault.id}>
  {fault.state==='recovering'?<div className="yu-recovery-status"><small>{recoveryLabel(fault)}</small><details className="yu-recovery-detail"><summary>Previous error</summary><p>{fault.page===null?'':`Page ${fault.page+1}: `}{fault.message}</p></details></div>:<small>{paused?"Paused; other issues: ":''}{fault.page===null?'':`Page ${fault.page+1}: `}{fault.message}</small>}
  {fault.stage==='redraw'&&fault.state==='pending'&&<small>Redraws this page and may use your generation allowance. Other saved images are kept.</small>}
  {fault.stage==='publication'&&fault.state==='pending'&&<small>Retries saving the generated image without drawing it again.</small>}
  {display!=='feedback'&&action(fault)}
 </div>)}</div>;
 if(!session.retryAllowed||paused)return null;
 const stage=session.retryStage;
 const retry=<StoryFlowAction asLink={link} className={primary?'yu-primary':undefined} disabled={busy} onClick={()=>onRetry()}>{busy?"Requesting…":stage==='review'?"Continue automatic repair":stage==='source'?"Retry source lookup":stage==='publication'?"Retry image save":stage==='prepare'?"Retry preparation":stage==='redraw'?"Redraw image":"Retry generation"}</StoryFlowAction>;
 return display==='actions'?<div className="yu-retry-actions">{retry}</div>:<div className="yu-retry-control"><small>Completed content is kept. Refresh the current issue before resuming.</small>{display!=='feedback'&&retry}</div>;
}
