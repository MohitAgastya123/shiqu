// English interface: labels, accessibility text, and workflow messages use English.
// Open a saved storyboard while no image exists, and answer a blocked review in any version of a story.
// Looking and editing start no work. Drawing past the review stays the reader's explicit choice.
import StoryFlowAction from './StoryFlowAction';
import type {SessionView} from '@/lib/reader-model';
import {readerMaxAutomaticRepairs} from '@/lib/reader-limits';

export default function StoryReviewTools({session,busy,error,onScript,onEdit,onReplan,onRetry,onDrawAnyway}:{session:SessionView;busy:boolean;error:string;onScript:()=>void;onEdit?:(page:number)=>void;onReplan?:()=>void;onRetry:()=>void;onDrawAnyway:()=>void}){
 const issues=session.reviewIssues||[];
 const meta=session.generationProgress,paused=!!session.generationControl&&session.generationControl!=='active';
 const replan=meta?.reviewStopReason==='replan',acceptanceBlocked=meta?.reviewStopReason==='requirements';
 const canRetry=session.retryAllowed&&!paused;
 const reason=replan?"The main story or ending is incomplete and needs replanning. Local repairs and drawing have stopped.":meta?.reviewStopReason==='unchanged'?"The previous revision made no actual changes. Automatic repair has stopped.":meta?.reviewStopReason==='limit'?(typeof meta.repairPasses==='number'?`Completed ${meta.repairPasses} automatic repair rounds; recheck still failed.`:"Automatic repair reached its limit; recheck still failed."):"Review has not passed. Drawing has stopped.";
 if(!session.story||!(session.story.original||session.generationProgress?.sourceReady)||session.story.pages[0]?.image&&!issues.length&&!acceptanceBlocked)return null;
 return <section className={'yu-review-tools'+(issues.length?' has-issues':'')} aria-label="Storyboard and review issues">
  {issues.length>0&&<>
   <header className="yu-review-heading"><span>Review needs attention</span><h3>There are {issues.length}  issues to revise</h3><p>{reason}</p>{meta&&<p className="yu-review-counts">{typeof meta.repairPasses==='number'&&`Repaired for ${meta.repairPasses} rounds`}{typeof meta.repairPasses==='number'&&typeof meta.reviewAudits==='number'&&' · '}{typeof meta.reviewAudits==='number'&&`Reviewed ${meta.reviewAudits} times`}</p>}</header>
   {acceptanceBlocked?<p>Read the acceptance results, edit the criteria, then review again.</p>:replan?<div className="yu-review-repair">{onReplan&&<StoryFlowAction type="button" className="yu-primary" disabled={busy} onClick={onReplan}>Edit production instructions</StoryFlowAction>}<p>Use the suggestions below to edit production instructions or narrative detail, then start production.</p></div>:<div className="yu-review-repair"><StoryFlowAction type="button" className="yu-primary" disabled={busy||!canRetry} aria-busy={busy} onClick={onRetry}>{busy?"Requesting repairs…":"Continue automatic repair"}</StoryFlowAction><p>{paused?"Production is paused. Resume generation before continuing automatic repair.":`Continue revising saved issues and draw after passing, for up to ${readerMaxAutomaticRepairs} rounds. Stops if nothing changes.`}</p></div>}
   <ul>{issues.map((issue,index)=><li key={index}><div className="yu-review-issue-heading"><strong>{issue.requiresReplan?"Full story structure":issue.category==='reflection'?"Ending":`Page ${issue.page}`}</strong>{onEdit&&!issue.requiresReplan&&<StoryFlowAction type="button" disabled={busy} aria-label={issue.category==='reflection'?"Edit ending manually":`Edit page ${issue.page}`} onClick={()=>onEdit(issue.page)}>Edit manually</StoryFlowAction>}</div><span>{issue.problem}</span><details><summary>Revision suggestions</summary><p>{issue.instruction}</p></details></li>)}</ul>
  </>}
  <div className="yu-review-inspect"><StoryFlowAction type="button" onClick={onScript}>View storyboard</StoryFlowAction>{onEdit&&!issues.length&&<StoryFlowAction type="button" disabled={busy} onClick={()=>onEdit(1)}>Edit manually</StoryFlowAction>}</div>
  {issues.length>0&&<div className="yu-review-skip"><StoryFlowAction type="button" className="yu-review-override" disabled={busy} onClick={onDrawAnyway}>{paused?"Skip issues and stay paused":"Skip issues and draw"}</StoryFlowAction><p>{paused?"Records the override and stays paused. Resume to draw the current storyboard.":"Draw the current storyboard without revising these issues."}</p></div>}
  {error&&<p className="yu-batch-error" role="alert">{error}</p>}
 </section>;
}

export function StoryAcceptanceNotice({busy,onAcceptance}:{busy:boolean;onAcceptance?:()=>void}){
 return <div role="alert" className="production-acceptance-notice"><strong>Acceptance criteria need changes</strong><p>Some criteria conflict with the source or production instructions, or cannot be judged from the written storyboard. Drawing has stopped.</p>{onAcceptance&&<StoryFlowAction type="button" className="yu-revision-open" disabled={busy} onClick={onAcceptance}>View and edit acceptance criteria</StoryFlowAction>}</div>;
}
