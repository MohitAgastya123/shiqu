// English interface: labels, accessibility text, and workflow messages use English.
// Inspect saved call receipts without enlarging production polling; preview edits are never history.
import {useEffect,useState} from 'react';
import {request} from './shared';
import {promptRecordText} from '@/lib/reader-prompt-records';
import type {PromptRecord} from '@/lib/reader-prompt-records';
import {acceptanceCriteria} from '@/lib/reader-acceptance';
import type {AcceptanceResult} from '@/lib/reader-acceptance';
type Receipt={step:string;model:string;originId:string;index:number;record:PromptRecord};
export type PromptDetails={records:Receipt[];criteria:string[];results:AcceptanceResult[];overridden:boolean;previews:{production:PromptRecord;acceptance:PromptRecord}};
function PromptText({record}:{record:PromptRecord}){
 const [status,setStatus]=useState(''),text=promptRecordText(record);
 async function copy(){try{await navigator.clipboard.writeText(text);setStatus("Copied");}catch{setStatus("Could not copy. Select and copy the text below.");}}
 return <><button type="button" className="yu-revision-open" onClick={()=>void copy()}>Copy complete prompt</button>{status&&<small role="status">{status}</small>}<pre tabIndex={0} className="yu-prompt-text">{text}</pre></>;
}
export function PromptDetailsContent({data,kind,sessionId,preferences}:{data:PromptDetails;kind:'production'|'acceptance';sessionId:string;preferences:Record<string,unknown>}){
 const records=data.records.filter(item=>(item.step.startsWith('review'))===(kind==='acceptance'));
 const previewInput=kind==='production'?Object.fromEntries(Object.entries(preferences).filter(([key])=>!['acceptancePrompt','acceptanceCriteria'].includes(key))):preferences;
 const preview={...data.previews[kind],input:JSON.stringify(previewInput,null,2)};
 const labels={passed:"Passed",failed:"Failed",unknown:"Cannot determine"};
 return <section className="yu-prompt-details" aria-label={kind==='acceptance'?"Acceptance rules and results":"Production prompts"}>
  {kind==='acceptance'&&<section aria-label="Saved acceptance results"><h3>Previous acceptance results</h3><p className="yu-count-help">These results belong to the saved version. Edits to criteria require another review.</p>{data.overridden&&<p role="status">You previously chose to skip review issues and draw. Skipping does not mean acceptance passed.</p>}{data.results.length?<ol>{data.results.map(result=><li key={result.criterion}><strong>Criterion {result.criterion} · {labels[result.status]}</strong><p>{data.criteria[result.criterion-1]}</p><p>{result.evidence}</p>{result.pages.length>0&&<small>{result.pages.map(page=>page===0?"Ending":`Page ${page}`).join(', ')}</small>}</li>)}</ol>:<p>No review results for this story's acceptance criteria yet.</p>}</section>}
  <details><summary>View current system rules (preview)</summary><p className="yu-count-help">Shows current rules and edited story instructions. Execution also includes source text, storyboard, batch, or review notes. Saved execution records contain the actual complete inputs.</p><PromptText record={preview}/></details>
  <details><summary>View complete prompts actually used ({records.length}  calls)</summary>{!records.length?<p>Not recorded. The next production or review saves this stage's prompt. History is never invented for older versions.</p>:<>{records.map(item=><details key={`${item.originId}:${item.index}`}><summary>{item.step} · {item.originId===sessionId?"Used by this version":"Inherited from an older version"} · {item.model}</summary><PromptText record={item.record}/></details>)}</>}</details>
 </section>;
}
export default function StoryPromptDetails({sessionId,kind,preferences}:{sessionId?:string;kind:'production'|'acceptance';preferences:Record<string,unknown>}){
 const [data,setData]=useState<PromptDetails|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let active=true;setData(null);setError('');if(sessionId)void request(`reader/sessions/${sessionId}/prompts`).then(value=>{if(active)setData(value);}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Could not load prompts.");});return()=>{active=false;};},[sessionId,attempt]);
 if(!sessionId)return <p className="yu-count-help">No prompt history for this story yet.</p>;
 if(error)return <div role="alert"><p>{error}</p><button type="button" onClick={()=>setAttempt(n=>n+1)}>Reload prompts</button></div>;
 if(!data)return <p role="status">Loading rules and prompt history…</p>;
 return <PromptDetailsContent data={data} kind={kind} sessionId={sessionId} preferences={{...preferences,acceptanceCriteria:acceptanceCriteria(preferences.acceptancePrompt as string)}}/>;
}
