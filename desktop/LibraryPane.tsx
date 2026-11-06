// English interface: labels, accessibility text, and workflow messages use English.
// Browse the shared shelf and queue; only explicit deletion writes reversible reader tombstones.
import {themeLabel} from '../client/english-labels';
import {useEffect,useRef,useState} from 'react';
import {invoke} from '@tauri-apps/api/core';
import {BookOpen,Check,ChevronRight,Clock3,Heart,Layers3,RefreshCw,Search,Sparkles,Trash2,Undo2} from 'lucide-react';
import {getArtStyle} from '../lib/reader-styles';
import {groupShelfByBook,matchesShelfSearch} from '../lib/shelf-browser';
import {productionSteps} from '../lib/production-stages';
import type {StorySummary} from './library-summary';
import {useLibrarySummary} from './useLibrarySummary';
import ProductionTimeline from '../client/ui/ProductionTimeline';

const states:Record<string,string>={idle:"Ready to continue",running:"Generating",failed:"Paused",completed:"Completed"};
function waitingLabel(story:StorySummary){return story.production?.intakePhase==='discovering'?"Awaiting discovery":story.production?.intakePhase==='choosing'?"Awaiting story selection":story.production?.intakePhase==='confirming'?"Awaiting production confirmation":states[story.state]||"Ready to continue";}
function date(value:string){return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(new Date(value));}
function StoryTags({story}:{story:StorySummary}){
 return <div className="story-tags"><span>Theme · {themeLabel(story.theme||"Not recorded")}</span><span>Art style · {getArtStyle(story.artStyle).label}</span></div>;
}
export function LibraryPane({tab,native,revision}:{tab:'library'|'queue';native:boolean;revision:string}){
 const {summary,error,loading,refresh}=useLibrarySummary(native,revision);
 const [search,setSearch]=useState(''),[filter,setFilter]=useState('all'),[groupBy,setGroupBy]=useState('book');
 const [deleteTarget,setDeleteTarget]=useState<StorySummary|null>(null),[undo,setUndo]=useState<StorySummary|null>(null),[mutating,setMutating]=useState(false),[mutationError,setMutationError]=useState('');
 const dialog=useRef<HTMLDialogElement>(null),mutationLock=useRef(false),refreshButton=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(deleteTarget){if(!dialog.current?.open)dialog.current?.showModal();}else dialog.current?.close();},[deleteTarget]);
 useEffect(()=>{setUndo(null);setDeleteTarget(null);setMutationError('');},[revision]);
 async function changeDeleted(story:StorySummary,deleted:boolean){
  if(mutationLock.current)return;
  mutationLock.current=true;setMutating(true);setMutationError('');
  try{
   if(native)await invoke('set_library_story_deleted',{id:story.id,deleted});
   else{
    const response=await fetch('/__desktop/library/'+encodeURIComponent(story.id),{method:deleted?'DELETE':'PUT'});
    if(!response.ok)throw Error("Could not update the story. Try again.");
   }
   setDeleteTarget(null);setUndo(deleted?story:null);refresh();refreshButton.current?.focus();
  }catch(e){setMutationError(String(e instanceof Error?e.message:e));}
  finally{mutationLock.current=false;setMutating(false);}
 }
 const stories=summary?.stories||[],queue=stories.filter(story=>story.jobs>0||story.state!=='completed');
 const needsAttention=(story:StorySummary)=>story.failed>0||story.state==='failed';
 const pending=(story:StorySummary)=>!needsAttention(story)&&(story.running>0||story.queued>0||story.state==='running');
 const completed=(story:StorySummary)=>story.state==='completed'&&!needsAttention(story)&&!pending(story);
 const activeCount=queue.filter(pending).length,failedCount=queue.filter(needsAttention).length;
 const source=tab==='library'?stories:queue;
 const visible=source.filter(s=>tab==='library'?(filter!=='saved'||s.saved)&&matchesShelfSearch({...s,artStyleLabel:getArtStyle(s.artStyle).label},search):filter==='active'?pending(s):filter==='failed'?needsAttention(s):true);
 // Partition by status while preserving source order and each group's native disclosure state.
 const queueGroups=[
  {id:'attention',label:"Needs attention",items:visible.filter(needsAttention),Icon:Layers3},
  {id:'active',label:"In progress",items:visible.filter(pending),Icon:Clock3},
  {id:'paused',label:"Ready to continue",items:visible.filter(story=>!needsAttention(story)&&!pending(story)&&!completed(story)),Icon:BookOpen},
  {id:'completed',label:"Completed stories",items:visible.filter(completed),Icon:Check},
 ];
 function storyCard(story:StorySummary,index:number){
  return <article className="desktop-story" key={story.id}>
   <div className={'story-spine tone-'+index%4} aria-hidden="true"><BookOpen size={25} strokeWidth={1.3}/><span>{story.book}</span></div>
   <div className="story-description">
    <div className="story-meta"><span>{story.book}</span>{!!story.saved&&<Heart size={12} fill="currentColor" aria-label="Favorites"/>}</div>
    <h3>{story.title}</h3><StoryTags story={story}/>
    <div className="story-bottom"><span className={'story-state state-'+story.state}>{waitingLabel(story)}</span><span>{story.total?`${story.ready} / ${story.total} pages`:"Awaiting storyboard"}<i>·</i>{date(story.updatedAt)}</span></div>
   </div>
   <button className="story-delete" type="button" aria-label={"Delete “"+story.title+'”'} title="Remove from shelf" disabled={mutating} onClick={()=>{setMutationError('');setDeleteTarget(story);}}><Trash2 size={15}/></button>
  </article>;
 }
 function queueCard(story:StorySummary){
  return <article className="desktop-queue-item" key={story.id}>
    <div className="queue-item-heading"><div><h3>{story.title}</h3><p>{story.book}</p></div><span className={'story-state state-'+(needsAttention(story)?'failed':story.running?'running':story.state)}>{needsAttention(story)?"Paused":story.running?"Generating":story.queued?"Waiting for generation":waitingLabel(story)}</span></div>
    <StoryTags story={story}/>
    <div className="queue-production-flow"><ProductionTimeline layout="horizontal" stages={productionSteps({...story.production,planReady:story.production?.planReady??story.total>0,total:story.total||null,ready:story.ready,activeState:needsAttention(story)?'failed':story.running||story.queued||['frame-count','story-choice','production-confirmation'].includes(story.production?.phase||'')?'current':'paused'})} moving={!needsAttention(story)&&story.running>0} queued={!story.running&&story.queued>0}/></div>
    <div className="queue-detail"><span>{story.succeeded} / {story.jobs}  tasks completed</span><span>{story.ready} / {story.total}  illustrations</span></div><div className="queue-task-counts"><span>Waiting: {story.queued}</span><span>Generating: {story.running}</span>{story.failed>0&&<span className="error">Paused: {story.failed}</span>}</div>
   </article>;
 }
 return <section className="collection-pane">
  <div className="collection-heading"><div><p className="pane-kicker">{tab==='library'?"Your saved stories":"Stories are unfolding"}</p><h2>{tab==='library'?"Shelf":"Generation queue"}<span>{source.length}</span></h2><p>{tab==='library'?"Stories you have read, loved, and have yet to finish.":"View each story's production progress and task status."}</p></div><button ref={refreshButton} className="refresh-button" aria-label="Refresh local data" onClick={()=>refresh()} disabled={loading}><RefreshCw size={16}/></button></div>
  {tab==='library'?<>
   <div className="library-search"><Search size={16}/><input aria-label="Search shelf" placeholder="Search stories, sources, themes, or art styles" value={search} onChange={event=>setSearch(event.target.value)}/></div>
   <div className="library-view-controls"><div className="collection-filters" aria-label="Shelf filters">{[['all',"All stories"],['saved',"My favorites"]].map(([value,label])=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}</div><label className="group-control"><span className="sr-only">Shelf groups</span><select aria-label="Shelf groups" value={groupBy} onChange={event=>setGroupBy(event.target.value)}><option value="book">Group by book</option><option value="none">No grouping</option></select></label></div>
  </>:<>
   <div className="queue-metrics"><div><Clock3 size={16}/><strong>{activeCount}</strong><span>Waiting / Generating</span></div><div><Layers3 size={16}/><strong>{failedCount}</strong><span>Needs attention</span></div><div><Check size={16}/><strong>{queue.filter(completed).length}</strong><span>Completed stories</span></div></div>
   <div className="collection-filters" aria-label="Queue filters">{[['all',"All"],['active',"In progress"],['failed',"Needs attention"]].map(([value,label])=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}</div>
  </>}
  {undo&&<div className="library-undo" role="status"><span>Removed from shelf: “{undo.title}”</span><button type="button" onClick={()=>void changeDeleted(undo,false)} disabled={mutating}><Undo2 size={14}/>{mutating?"Restoring…":"Undo"}</button></div>}
  {(error||mutationError&&!deleteTarget)&&<div className="collection-error" role="alert">{error||mutationError}<button className="text-button" onClick={()=>{setMutationError('');refresh();}}>Reload</button></div>}
  {loading&&!summary?<div className="collection-empty" role="status"><RefreshCw size={28}/><h3>Opening {tab==='library'?"Shelf":"queue"}…</h3></div>:visible.length?
   tab==='library'?groupBy==='book'?<div className="book-groups">{groupShelfByBook(visible).map(({book,items:rows})=><details className="book-group" key={book} open><summary><ChevronRight size={15}/><BookOpen size={15}/><h3>{book}</h3><span>{rows.length}  stories</span></summary><div className="story-list">{rows.map(storyCard)}</div></details>)}</div>:<div className="story-list">{visible.map(storyCard)}</div>:
   <div className="queue-list">{queueGroups.filter(group=>group.items.length>0).map(({id,label,items,Icon})=><details key={id} className={"queue-group queue-group-"+id+(id==='completed'?' queue-completed':'')} open={id!=='completed'?true:undefined}><summary><ChevronRight size={15} aria-hidden="true"/><Icon size={15} aria-hidden="true"/><strong>{label}</strong><span>{items.length}  stories</span></summary><div>{items.map(queueCard)}</div></details>)}</div>:
   !error&&<div className="collection-empty">{tab==='library'?<BookOpen size={34} strokeWidth={1.2}/>:<Sparkles size={34} strokeWidth={1.2}/>}<h3>{source.length?"No matching stories":tab==='library'?"Your first story is waiting.":"No generation tasks right now."}</h3><p>{source.length?"Try different filters or keywords.":tab==='library'?"Start a story in the reader and it will appear on this shelf.":"Start or continue a story in the reader to see its progress here."}</p></div>}
  <p className="collection-footnote">{tab==='library'?"Shares the reader's local shelf":"Task status refreshes every 4 seconds. Continue or retry in the reader."}</p>
  <dialog ref={dialog} className="library-delete-dialog" aria-labelledby="delete-story-heading" aria-describedby="delete-story-description" onCancel={event=>{if(mutating)event.preventDefault();else setDeleteTarget(null);}}>
   <div className="delete-dialog-icon"><Trash2 size={23}/></div><h2 id="delete-story-heading">Delete “{deleteTarget?.title}”?</h2>
   <p id="delete-story-description">Removes the story from the desktop and reader shelves. Story files are kept, and you can undo the deletion.</p>
   {mutationError&&<p className="error" role="alert">{mutationError}</p>}
   <div className="delete-dialog-actions"><button type="button" className="secondary" disabled={mutating} onClick={()=>setDeleteTarget(null)} autoFocus>Cancel</button><button type="button" className="delete-confirm" disabled={mutating||!deleteTarget} onClick={()=>deleteTarget&&void changeDeleted(deleteTarget,true)}>{mutating?"Deleting…":"Delete story"}</button></div>
  </dialog>
 </section>;
}
