// English interface: labels, accessibility text, and workflow messages use English.
// Edit a local draft; saving review corrections submits directly to the existing review-and-draw flow.
// Automatically placed balloons have optional draft controls; layout-only edits keep artwork and review.
import StoryBubbleEditor from './StoryBubbleEditor';
import StoryFlowAction from './StoryFlowAction';
import StoryProductionEditor,{StoryEditorTabs} from './StoryProductionEditor';
import type {StoryRevisionEditorState} from './useStoryRevision';
import type {Plan} from '@/lib/reader-model';
import type {ReviewIssue} from '@/lib/reader-review';
import {revisionFrameCount,revisionImpact} from '@/lib/reader-revision';
import type {RevisionChanges,RevisionSnapshot} from '@/lib/reader-revision';
import {productionSteps} from '@/lib/production-stages';
import {getArtStyle} from '@/lib/reader-styles';
import {normalizeProductionPrompt} from '@/lib/reader-prompts';
import './story-revision.css';
export function revisionDraftSteps(base:RevisionSnapshot,changes:RevisionChanges){
 const impact=revisionImpact(base,changes);
 const reviewStatus=impact.review?'pending':base.reviewStatus;
 const phase=impact.replan?'frame-count':reviewStatus==='repair'?'repair':reviewStatus&&reviewStatus!=='passed'?'review':'image';
 return productionSteps({sourceReady:true,frameCountConfirmed:!impact.replan,planReady:!impact.replan,reviewStatus,phase,total:impact.total,ready:0}).map(step=>{
  if(step.id==='source')return {...step,label:"Source and production instructions",detail:`Art style: ${getArtStyle(changes.artStyle??base.selection.artStyle).label}`};
  if(step.id==='count'&&impact.replan)return {...step,detail:"Planned by narrative detail · Count confirmed after review"};
  if(step.id==='review'&&!impact.review)return {...step,detail:"Keep existing review progress"};
  if(step.id==='plan'&&changes.plan&&impact.review&&!impact.replan)return {...step,detail:"Storyboard edited · Awaiting review"};
  return step;
 });
}
export function StoryRevisionActions({editor,onDone,resuming=false,reviewOnSave=false,link=false}:{editor:StoryRevisionEditorState;onDone?:()=>void;resuming?:boolean;reviewOnSave?:boolean;link?:boolean}){
 const Action=link?StoryFlowAction:'button';
 const impact=editor.impact;if(!impact)return null;
 const finish=reviewOnSave?undefined:onDone;
 return <section className="yu-revision-impact" aria-label="Impact of these changes">
  <p role="status">{!impact.changed?(reviewOnSave?"Save storyboard edits and review again. Drawing continues after approval.":resuming?"Finish editing, then resume generation to continue production.":"Adjust production settings and confirm to begin."):impact.replan?impact.preserveScript?`Keep the saved storyboard and drafts, finish remaining planning, then review. Pages to draw: ${impact.total}.`:`Replan and review using the narrative detail. Page count is confirmed after review.${impact.reusePending?"Image reuse is checked page by page after the new storyboard is complete.":"Images will be checked after the new storyboard is complete."}`:`Keep storyboard planning; ${impact.review?"review again":"Keep existing review progress"}; estimated reuse: ${impact.reused} pages, redraw: ${impact.redraw}.`}</p>
  {impact.changed&&!impact.replan&&<small>Image reuse is checked again when image instructions or the first reference page change.</small>}
  {impact.conflict&&<div role="alert"><p>Production instructions or narrative detail changes require replanning and replace manual storyboard edits. Choose which to keep:</p><div className="yu-revision-conflict"><Action type="button" disabled={editor.busy} onClick={()=>editor.setChanges(c=>({...c,plan:undefined}))}>Keep replanning settings</Action><Action type="button" disabled={editor.busy} onClick={()=>editor.setChanges(c=>({...c,productionPrompt:undefined,length:undefined,narrativeDetail:undefined}))}>Keep manual storyboard edits</Action></div></div>}
  {editor.error&&<p role="alert">{editor.error}</p>}
  {editor.conflict&&<div className="yu-revision-conflict-note" role="alert"><p>This storyboard, its instructions, or its version changed elsewhere. Your draft remains here and will not merge automatically. Copy anything you need before reloading.</p><Action type="button" className="yu-revision-reload" disabled={editor.busy} onClick={()=>void editor.load()}>Discard draft and load latest</Action></div>}
  <div className="yu-revision-buttons"><Action type="button" className="yu-primary" disabled={editor.busy||!finish&&(!impact.changed||impact.conflict||editor.conflict)} onClick={()=>{if(finish)finish();else void editor.submit();}}>{editor.busy?"Submitting…":finish?"Done editing":resuming?"Apply changes and resume":reviewOnSave?(impact.review?"Save and review again":"Save changes"):"Start production"}</Action><Action type="button" disabled={editor.busy} onClick={editor.discard}>Discard draft</Action></div>
  <small>{impact.changed&&!impact.review?"Layout-only balloon edits keep review and artwork. An art style change keeps review progress. If review passed, images are redrawn directly. Your shelf shows the latest version; the previous story is kept.":reviewOnSave?"Saving starts another review. Drawing follows approval. Your shelf shows the latest version; the previous story is kept.":resuming?(finish?"Return to production after editing, then click “Apply changes and resume”.":"Apply changes when resuming generation. Saved content is kept."):finish?"Return to production after editing. Nothing starts until you confirm.":"Production automatically plans, reviews, and draws. Your shelf shows the latest version; the previous story is kept."}</small>
 </section>;
}
export default function StoryRevisionEditor({editor,onDone,resuming=false,reviewIssues=[]}:{editor:StoryRevisionEditorState;onDone?:()=>void;resuming?:boolean;reviewIssues?:ReviewIssue[]}){
 const {base,changes,busy,loading}=editor;
 if(loading)return <p role="status">Loading saved production content…</p>;
 if(!base)return <div><p role="alert">{editor.error||"Production content has not loaded."}</p><button type="button" onClick={()=>void editor.load()}>Reload</button></div>;
 const plan=changes.plan||base.plan;
 const target=Math.max(0,Math.min(editor.scriptPage??1,plan?.pages.length??1)),page=Math.max(0,target-1);
 const issues=reviewIssues.filter(issue=>issue.page===target);
 const updatePlan=(update:(plan:Plan)=>void)=>editor.setChanges(c=>{const next=structuredClone(c.plan||base.plan);if(!next)return c;update(next);return {...c,plan:next};});
 return <div className="yu-revision-editor">
  <StoryEditorTabs tab={editor.tab!} onChange={editor.setTab} script={!!plan} disabled={busy}/>
  {editor.tab&&editor.tab!=='script'&&<StoryProductionEditor sessionId={editor.sessionId} tab={editor.tab} settings={{artStyle:changes.artStyle??base.selection.artStyle,productionPrompt:changes.productionPrompt??normalizeProductionPrompt(base.selection.productionPrompt,base.selection.theme),acceptancePrompt:changes.acceptancePrompt??base.selection.acceptancePrompt,length:changes.length??base.selection.length,narrativeDetail:changes.narrativeDetail??base.selection.narrativeDetail??'balanced'}} recommendation={base.frameRecommendation} disabled={busy} onChange={patch=>editor.setChanges(c=>({...c,...patch}))}/>}
  <fieldset disabled={busy} className="yu-revision-fields">
   {editor.tab==='script'&&plan&&<section className="yu-revision-script">
    <label className="yu-revision-field">Choose storyboard page<select value={target} onChange={e=>editor.setScriptPage(Number(e.target.value))}>{plan.pages.map((_,index)=><option key={index} value={index+1}>Page {index+1}</option>)}<option value={0}>Ending</option></select></label>
    {issues.length>0&&<details key={target} open className="yu-revision-review" aria-label={target===0?"Ending review notes":`Page ${target} review notes`}>
     <summary>{target===0?"Ending":`Page ${target}`}  · Previous review notes</summary>
     {issues.map((issue,index)=><dl key={index}><dt>Review issue</dt><dd>{issue.problem}</dd><dt>Revision suggestions</dt><dd>{issue.instruction}</dd></dl>)}
    </details>}
    {target>0&&<><section aria-label={`Edit page ${page+1}`}><h3>Page {page+1}</h3><label className="yu-revision-field">Caption (optional narration)<textarea rows={3} maxLength={500} value={plan.pages[page].caption} onChange={e=>updatePlan(p=>{p.pages[page].caption=e.target.value;})}/></label><label className="yu-revision-field">Image prompt<textarea rows={5} minLength={20} maxLength={4000} value={plan.pages[page].prompt} onChange={e=>updatePlan(p=>{p.pages[page].prompt=e.target.value;})}/></label><StoryBubbleEditor key={page} image={base.images[page]||''} bubbles={plan.pages[page].bubbles} disabled={busy} onChange={bubbles=>updatePlan(p=>{p.pages[page].bubbles=bubbles;})}/></section>
    <details><summary>Character definitions (changes redraw all pages)</summary><label className="yu-revision-field">Character definitions<textarea rows={4} minLength={20} maxLength={6000} value={plan.characters} onChange={e=>updatePlan(p=>{p.characters=e.target.value;})}/></label></details></>}
    <label className="yu-revision-field">Reflection<textarea rows={3} minLength={1} maxLength={400} value={plan.reflection} onChange={e=>updatePlan(p=>{p.reflection=e.target.value;})}/></label>
   </section>}

  </fieldset>
  <StoryRevisionActions editor={editor} onDone={onDone} resuming={resuming} reviewOnSave={reviewIssues.length>0}/>
  <p className="yu-revision-note">Closing this window keeps the draft. Leaving this story clears it.</p>
 </div>;
}
