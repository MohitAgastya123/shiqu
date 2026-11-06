// English interface: labels, accessibility text, and workflow messages use English.
// Read saved audit and repair evidence on demand; version navigation never starts production.
import {useEffect,useState} from 'react';
import {request} from './shared';
import type {StoryReviewHistory as History,ReviewHistoryEntry,ReviewTextChange} from '@/lib/reader-review-history';
import type {RepairedPage} from '@/lib/reader-review';
import './story-review-history.css';

const outcomeLabels={passed:"Passed",'needs-change':"Needs changes",unknown:"Cannot determine",changed:"Revised",unchanged:"No change"};
const acceptanceLabels={passed:"Passed",failed:"Failed",unknown:"Cannot determine"};
const pageLabel=(page:number)=>page===0?"Ending":`Page ${page}`;
const range=(from:number,to:number)=>from===to?`Page ${from}`:`Pages ${from}–${to}`;
function TextDiff({label,change}:{label:string;change:ReviewTextChange}){
 return <section className="yu-review-history-change"><h5>{label}</h5><div className="yu-review-history-diff"><div><strong>Before</strong><p>{change.before??"Previous content was not recorded."}</p></div><div><strong>After</strong><p>{change.after}</p></div></div></section>;
}
function Frames({label,pages}:{label:string;pages:RepairedPage[]|null}){
 return <section className="yu-review-history-frames"><h5>{label}</h5>{pages===null?<p>Previous content for this section was not recorded.</p>:!pages.length?<p>No pages</p>:pages.map(page=><div key={page.page}><strong>{pageLabel(page.page)}</strong><p>{page.caption}</p><details><summary>Image instructions</summary><p>{page.prompt}</p></details></div>)}</section>;
}
export function ReviewHistoryEvent({entry,expanded=false}:{entry:ReviewHistoryEntry;expanded?:boolean}){
 const repair=entry.repair;
 return <details className="yu-review-history-event" open={expanded}>
  <summary><strong>{entry.title}</strong><span className={'yu-review-history-outcome is-'+entry.outcome}>{outcomeLabels[entry.outcome]}</span></summary>
  <div className="yu-review-history-body">
   <p className="yu-review-history-meta">{entry.recordedAt?new Date(entry.recordedAt).toLocaleString('en-US',{hour12:false}):"Timestamp not recorded"}{entry.model&&` · ${entry.model}`}</p>
   {entry.countReview&&<section><h4>Page count assessment</h4><p>{({keep:"Keep current allocation",expand:"Add necessary pages",reduce:"Reduce repeated pages",redistribute:"Reallocate pages"})[entry.countReview.decision]}  · Suggested pages: {entry.countReview.proposedCount}</p><p>{entry.countReview.reason}</p></section>}
   {!!entry.requirements?.length&&<section><h4>Adjustment requirements</h4><ol>{entry.requirements.map((item,index)=><li key={index}><strong>{pageLabel(item.page)} · {item.task}</strong><blockquote>{item.quote}</blockquote><p>Previous caption: {item.captionEvidence}</p><p>Previous image: {item.visualEvidence}</p><p>Issue: {item.loss}</p><p>Fix: {item.instruction}</p></li>)}</ol></section>}
   {!entry.requirements?.length&&!!entry.issues.length&&<section><h4>Review notes</h4><ol>{entry.issues.map((issue,index)=><li key={index}><strong>{pageLabel(issue.page)}{issue.requiresReplan?" · Structural change":''}</strong><p>{issue.problem}</p><p><strong>Revision instructions: </strong>{issue.instruction}</p></li>)}</ol></section>}
   {!!entry.acceptance?.length&&<section><h4>Acceptance items</h4><ol>{entry.acceptance.map(result=><li key={result.criterion}><strong>Criterion {result.criterion} · {acceptanceLabels[result.status]}</strong><p>{result.text??"Previous acceptance criteria were not recorded."}</p><p>{result.evidence}</p>{!!result.pages.length&&<small>{result.pages.map(pageLabel).join(', ')}</small>}</li>)}</ol></section>}
   {entry.titleChange&&<details><summary>Title review</summary><p>{entry.titleChange.before===null?`“${entry.titleChange.after}” (previous title not recorded)`:entry.titleChange.before===entry.titleChange.after?`Keep “${entry.titleChange.after}”`:`“${entry.titleChange.before}” → “${entry.titleChange.after}”`}</p><p>{entry.titleChange.reason}</p></details>}
   {entry.reflectionChoice&&<details><summary>Ending selection</summary><p>{entry.reflectionChoice.text??"The selected ending text was not recorded."}</p><p>{entry.reflectionChoice.reason}</p></details>}
   {!!entry.coverage?.length&&<details><summary>Source verification evidence ({entry.coverage.length} items)</summary><ol>{entry.coverage.map((item,index)=><li key={index}><strong>{item.task}</strong><blockquote>{item.quote}</blockquote><p>{item.reason}</p>{!!item.pages.length&&<small>{item.pages.map(pageLabel).join(', ')}</small>}</li>)}</ol></details>}
   {repair&&<>
    <p>This batch covers: {repair.requested.map(pageLabel).join(', ')||"Global character definitions"}</p>
    {entry.outcome==='unchanged'&&<p>The returned content made no actual changes.</p>}
    {repair.structure&&<section><h4>Structural revision · {repair.structure.before} → {repair.structure.after}  pages</h4>{repair.structure.edits.map((edit,index)=><details key={index}><summary>{edit.to<edit.from?`Insert before original page ${edit.from} `:edit.after.length?`Replace original ${range(edit.from,edit.to)}`:`Delete original ${range(edit.from,edit.to)}`}{!!edit.after.length&&` → New ${range(edit.newFrom,edit.newFrom+edit.after.length-1)}`}</summary><div className="yu-review-history-diff"><Frames label="Before" pages={edit.before}/><Frames label="After" pages={edit.after}/></div></details>)}</section>}
    {repair.pages.map(page=><section className="yu-review-history-page" key={page.page}><h4>{pageLabel(page.page)} revision</h4>{page.before?.caption===page.after.caption?<p>Caption unchanged: {page.after.caption}</p>:<TextDiff label="Caption" change={{before:page.before?.caption??null,after:page.after.caption}}/>}<details><summary>{page.before?.prompt===page.after.prompt?"Image instructions unchanged":"Compare image instructions"}</summary>{page.before?.prompt===page.after.prompt?<p>{page.after.prompt}</p>:<TextDiff label="Image instructions" change={{before:page.before?.prompt??null,after:page.after.prompt}}/>}</details></section>)}
    {repair.reflection&&<TextDiff label="Ending revision" change={repair.reflection}/>}
    {repair.characters&&<details><summary>Character definition revision</summary><TextDiff label="Character definitions" change={repair.characters}/></details>}
   </>}
  </div>
 </details>;
}
export function ReviewHistoryContent({data}:{data:History}){
 const ordered=data.entries.filter(x=>x.position!==null),unordered=data.entries.filter(x=>x.position===null);
 return <div className="yu-review-history-content">
  <h3>{data.title}</h3><p className="yu-review-history-note">Version {data.revision} · Page numbers refer to the draft reviewed at that time.</p>
  {data.overridden?<p className="yu-review-history-notice">You confirmed skipping the unfinished review. This does not mean the review passed.</p>:data.status&&<p className="yu-review-history-notice">Current: {({pending:"Review incomplete",repair:"Awaiting revision",passed:"Review passed",blocked:"Review blocked"})[data.status]}</p>}
  {data.error&&<p className="yu-review-history-error">{data.error}</p>}
  {!data.entries.length?<p className="yu-review-history-empty">No saved review history for this version yet.{data.parentId?"You can view the previous version's records.":''}</p>:<>
   <p className="yu-review-history-note">Page count reviews: {data.entries.filter(x=>x.kind==='count').length}  · Full reviews: {data.entries.filter(x=>x.kind==='review').length}  · Repair batches: {data.entries.filter(x=>x.kind==='repair').length}  </p>
   {ordered.map((entry,index)=><ReviewHistoryEvent key={entry.id} entry={entry} expanded={index===ordered.length-1}/>)}
   {!!unordered.length&&<section><h4>Records without saved execution order</h4><p className="yu-review-history-note">Grouped by record type below; no execution order is inferred.</p>{unordered.map(entry=><ReviewHistoryEvent key={entry.id} entry={entry}/>)}</section>}
  </>}
 </div>;
}
export default function StoryReviewHistory({sessionId}:{sessionId:string}){
 const [target,setTarget]=useState(sessionId),[attempt,setAttempt]=useState(0),[data,setData]=useState<History|null>(null),[error,setError]=useState('');
 useEffect(()=>{setTarget(sessionId);},[sessionId]);
 useEffect(()=>{let active=true;setData(null);setError('');void request(`reader/sessions/${encodeURIComponent(target)}/review-history`).then(value=>{if(active)setData(value);}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Could not load review history.");});return()=>{active=false;};},[target,attempt]);
 return <section className="yu-review-history" aria-label="Review, repair, and recheck history">
  <div className="yu-review-history-nav">{target!==sessionId&&<button type="button" className="yu-revision-open" onClick={()=>setTarget(sessionId)}>Back to current version</button>}{data?.parentId&&<button type="button" className="yu-revision-open" onClick={()=>setTarget(data.parentId!)}>View previous version</button>}<button type="button" className="yu-revision-open" onClick={()=>setAttempt(n=>n+1)}>Refresh history</button></div>
  {error?<div role="alert"><p>{error}</p><button type="button" className="yu-revision-open" onClick={()=>setAttempt(n=>n+1)}>Reload history</button></div>:!data?<p role="status">Loading review history…</p>:<ReviewHistoryContent data={data}/>}
 </section>;
}
