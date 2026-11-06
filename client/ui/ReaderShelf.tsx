// English shelf: keep production tasks separate from readable stories, preserve priority and saved filters.
// Pending style tags follow saved setup drafts; finished stories restart at page one.
// Stateful groups are child components so the shelf remains directly testable without hooks.
// Imported series retain explicit numeric reading order beside ordinary shelf grouping.
import {useState,type ReactNode} from 'react';
import {themeLabel} from '../english-labels';
import {ArrowRight,Bookmark,BookOpen,ChevronDown,ChevronRight,Feather,Plus,RefreshCw,RotateCcw,Search,Trash2,X} from 'lucide-react';
import type {Story} from '@/lib/content';
import type {GeneratedStory,SessionView,ProductionAction} from '@/lib/reader-model';
import StoryGenerationControl from './StoryGenerationControl';
import type {ReadingProgress} from '@/lib/reader-home';
import {getArtStyle} from '@/lib/reader-styles';
import {groupShelfItems,matchesShelfSearch,shelfGroupings,type ShelfGrouping} from '@/lib/shelf-browser';
import {shelfGenerationStatus,shelfNeedsUserGroups,sortShelfProductions} from '@/lib/shelf-generation';
import './ReaderShelf.css';
import type {StorySeriesView} from '@/lib/story-import-contract';
import {StorySeriesShelf} from './StorySeriesOverview';

const productionLimit=5;
// Remember group expansion across filters, reading and refreshes.
function usePersistentOpen(id:string){
 const storageKey='shiqu-shelf-group:'+id;
 const [open,setOpen]=useState(()=>{try{return localStorage.getItem(storageKey)!=='0';}catch{return true;}});
 return [open,(next:boolean)=>{setOpen(next);try{localStorage.setItem(storageKey,next?'1':'0');}catch{}}] as const;
}
function ShelfGroup({id,children}:{id:string;children:ReactNode}){
 const [open,setOpen]=usePersistentOpen(id);
 return <details className="yu-shelf-book-group" open={open} onToggle={event=>setOpen(event.currentTarget.open)}>{children}</details>;
}
// Priority ordering keeps tasks needing attention visible; showing all rows is temporary.
function ProductionGroup({needs,limit,children}:{needs:number;limit:number|null;children:ReactNode[]}){
 const [open,setOpen]=usePersistentOpen('production'),[all,setAll]=useState(false);
 const hidden=limit===null?0:Math.max(0,children.length-limit);
 return <details className="yu-production" open={open} onToggle={event=>setOpen(event.currentTarget.open)}>
  <summary><ChevronRight size={16} aria-hidden="true"/><h2>In production</h2><span>{children.length} tasks</span>{needs>0&&<em>{needs} need attention</em>}</summary>
  <ul>{hidden&&!all?children.slice(0,limit!):children}</ul>
  {hidden>0&&<button type="button" className="yu-production-more" aria-expanded={all} onClick={()=>setAll(!all)}>{all?'Show less':`Show all ${children.length} tasks`}</button>}
 </details>;
}

type ShelfItem={processingStatus:string;id:string;title:string;book:string;theme:string;artStyleLabel:string;story:Story|null;session?:SessionView;page:number;saved:boolean};
type Props={series?:StorySeriesView[];onOpenSeries?:(id:string)=>void;seriesError?:string;onControl:(id:string,action:ProductionAction)=>Promise<void>;controlBusy:string;stories:Story[];pending:SessionView[];sessions:SessionView[];progress:ReadingProgress[];loading:boolean;refreshing:boolean;onRefresh:()=>void;error:string;tab:string;onTab:(tab:string)=>void;query:string;onQuery:(query:string)=>void;grouping:ShelfGrouping;onGrouping:(grouping:ShelfGrouping)=>void;bookName:(story:Pick<Story,'id'|'bookId'>)=>string;onOpen:(story:Story,restart?:boolean)=>void;onResume:(session:SessionView)=>void;onRetry:(session:SessionView)=>void;onDelete:(id:string,title:string)=>void;onFavorite:(id:string,saved:boolean)=>void;favoriteBusy:string;onCreate:()=>void;onDiscover:()=>void};
export default function ReaderShelf({series=[],onOpenSeries,seriesError,onControl,controlBusy,stories,pending,sessions,progress,loading,refreshing,onRefresh,error,tab,onTab,query,onQuery,grouping,onGrouping,bookName,onOpen,onResume,onRetry,onDelete,onFavorite,favoriteBusy,onCreate,onDiscover}:Props){
 const progressById=new Map(progress.map(row=>[row.storyId,row]));
 const sessionById=new Map(sessions.map(session=>[session.id,session]));
 const processingStatus=(story:Story)=>{const session=sessionById.get(story.id);return session?shelfGenerationStatus(session).group:story.pages.every(page=>!!page.image)?'Complete':'Paused';};
 const items:ShelfItem[]=[
  ...pending.map(session=>({processingStatus:shelfGenerationStatus(session).group,id:session.id,title:session.selection.displayTitle||session.story?.title||session.selection.storyTitle||(session.intake?'Story awaiting selection':'A story still unfolding'),book:bookName({id:session.id,bookId:session.selection.bookId}),theme:themeLabel(session.selection.theme),artStyleLabel:getArtStyle((session.intake?.phase!=='confirmed'?session.intake?.draft?.artStyle:undefined)??session.selection.artStyle).label,story:null,session,page:session.page,saved:!!(progressById.get(session.id)?.saved??session.saved)})),
  ...stories.map(story=>({processingStatus:processingStatus(story),id:story.id,title:story.title,book:bookName(story),theme:themeLabel(story.theme),artStyleLabel:(story as GeneratedStory).generated?((story as GeneratedStory).artStyleLabel||'Art style not recorded'):'Art style not recorded',story,page:progressById.get(story.id)?.page||0,saved:!!progressById.get(story.id)?.saved})),
 ];
 const visible=items.filter(item=>(tab!=='saved'||item.saved)&&matchesShelfSearch(item,query));
 const productions=sortShelfProductions(visible.filter(item=>!item.story),item=>item.processingStatus),readable=visible.filter(item=>item.story);
 const needs=productions.filter(item=>(shelfNeedsUserGroups as readonly string[]).includes(item.processingStatus)).length;
 const visibleSeries=series.filter(item=>(tab!=='saved'||item.parts.some(part=>part.sessionId&&!!(progressById.get(part.sessionId)?.saved??sessionById.get(part.sessionId)?.saved)))&&matchesShelfSearch({title:item.title+' '+item.parts.map(part=>part.title).join(' '),book:item.source.fileName,theme:'',artStyleLabel:getArtStyle(item.settings.artStyle).label},query));
 const filtered=!!query.trim()||tab==='saved',busyAny=refreshing||!!favoriteBusy;
 function resetFilters(){onQuery('');onTab('recent');}
 function edition(item:ShelfItem,session?:SessionView){
  const number=session?.revision?.number||item.story?.revision||1;
  return number>1||sessions.some(s=>s.revision?.rootId===item.id)?`${number}`:'';
 }
 function actions(item:ShelfItem){
  return <div className="yu-shelf-card-actions"><button type="button" className={'yu-shelf-favorite'+(item.saved?' is-saved':'')} aria-label={(item.saved?'Remove favorite':'Favorite')+' “'+item.title+'”'} title={item.saved?'Remove favorite':'Favorite'} aria-pressed={item.saved} disabled={busyAny} onClick={()=>onFavorite(item.id,!item.saved)}><Bookmark size={17} fill={item.saved?'currentColor':'none'}/><span>{favoriteBusy===item.id?'Saving…':item.saved?'Remove favorite':'Favorite'}</span></button><button className="yu-delete-story" aria-label={'Delete “'+item.title+'”'} title="Delete story" disabled={busyAny} onClick={()=>onDelete(item.id,item.title)}><Trash2 size={17}/></button></div>;
 }
 // Failed tasks show a single retry action; other states keep pause/resume controls.
 function control(session:SessionView,group:string){
  if(group==='Failed')return session.retryAllowed?<button type="button" className="yu-generation-control" disabled={busyAny||!!controlBusy} onClick={()=>onRetry(session)}>Retry generation</button>:null;
  return <StoryGenerationControl session={session} busy={!!controlBusy} onControl={onControl}/>;
 }
 function productionRow(item:ShelfItem){
  const session=item.session!,generation=shelfGenerationStatus(session),number=edition(item,session);
  const tone=generation.group==='Failed'?'failed':(shelfNeedsUserGroups as readonly string[]).includes(generation.group)?'needs':generation.group==='Paused'?'paused':'active';
  // Automatically paused tasks can retry; tasks needing a decision use the row as their primary action.
  const autoRetry=generation.group==='Paused'&&session.retryAllowed&&(!session.generationControl||session.generationControl==='active');
  const side=autoRetry?<button type="button" className="yu-generation-control" disabled={busyAny} onClick={()=>onRetry(session)}>Continue generating</button>:tone==='needs'?null:control(session,generation.group);
  return <li className={'yu-production-row '+tone} key={item.id}>
   <button className="yu-pending-story" aria-label={generation.action+' “'+item.title+'”'} onClick={()=>onResume(session)}>
    <span className="yu-production-title"><strong>{item.title}</strong><em role="status">{generation.message}{session.story&&` · ${session.ready} / ${session.story.pages.length} pages`}</em></span>
    <small className="yu-shelf-tags">{[item.book,themeLabel(item.theme),item.artStyleLabel].filter(Boolean).map(text=><span key={text} title={text}>{text}</span>)}{number&&<span>Version {number}</span>}</small>
    {generation.group==='Failed'&&session.error?<small className="yu-production-error">{session.error}</small>:<span className="sr-only">{generation.detail}</span>}
   </button>
   <div className="yu-production-side">{side}{actions(item)}</div>
  </li>;
 }
 function card(item:ShelfItem){
  const story=item.story!,session=sessionById.get(item.id),generation=session?shelfGenerationStatus(session):null,number=edition(item,session);
  const total=story.pages.length,finished=total>0&&item.page+1>=total;
  const feedback=session&&session.state!=='completed'&&<div className="yu-shelf-generation-progress"><span role="status">{generation!.message}{session.story&&` · ${session.ready} / ${session.story.pages.length} pages`}</span>{control(session,generation!.group)}</div>;
  return <div className="yu-shelf-row yu-shelf-row-readable" key={item.id}>
   <div className="yu-shelf-cover-wrap">
    <button className="yu-shelf-cover" aria-label={'Open “'+item.title+'”'} title={item.book} onClick={()=>onOpen(story)}>{story.pages[0].image?<img src={story.pages[0].image} alt="" loading="lazy"/>:<span className="yu-shelf-pending"><Feather size={25}/></span>}</button>
    <div className="yu-shelf-cover-overlay"><small className="yu-shelf-book-badge">{item.book}</small>{actions(item)}</div>
   </div>
   <div className="yu-shelf-card-body">
    <button className="yu-shelf-card yu-shelf-card-details" aria-label={'Read “'+item.title+'”'} onClick={()=>onOpen(story)}><h2>{item.title}</h2><span className="yu-shelf-tags"><span title={themeLabel(item.theme)}>{themeLabel(item.theme)}</span><span title={item.artStyleLabel}>{item.artStyleLabel}</span>{number&&<span>Version {number}</span>}</span></button>
    {feedback}
    <button className={'yu-shelf-reading-footer'+(finished?' finished':'')} aria-label={(finished?'Read again “':'Continue reading “')+item.title+'”'} onClick={()=>finished?onOpen(story,true):onOpen(story)}>
     <span className="yu-shelf-progress" aria-hidden="true"><i style={{width:`${total?Math.min(100,Math.round((item.page+1)/total*100)):0}%`}}/></span>
     <span className="yu-shelf-reading-meta">{finished?<><span>Finished · {total} pages</span><span className="yu-shelf-continue">Read again <RotateCcw size={14}/></span></>:<><span>Page {item.page+1} / {total}</span><span className="yu-shelf-continue">Continue reading <ArrowRight size={15}/></span></>}</span>
    </button>
   </div>
  </div>;
 }
 const savedCount=items.filter(item=>item.saved).length;
 const readableView=grouping!=='none'?<div className="yu-shelf-groups">{groupShelfItems(readable,grouping).map(({label,items})=><ShelfGroup key={grouping+':'+label} id={grouping+':'+label}><summary><ChevronRight size={16}/>{grouping==='book'&&<BookOpen size={16}/>}<h2>{label}</h2><span>{items.length} stories</span></summary><div className="yu-shelf-grid">{items.map(card)}</div></ShelfGroup>)}</div>:<div className="yu-shelf-grid">{readable.map(card)}</div>;
 return <section className="yu-shelf">
  <h1>My shelf</h1>
  <div className="yu-shelf-search"><Search size={18} aria-hidden="true"/><input type="search" aria-label="Search shelf" placeholder="Search stories, books, themes, or art styles" value={query} onChange={event=>onQuery(event.target.value)}/>{query&&<button aria-label="Clear search" onClick={()=>onQuery('')}><X size={16}/></button>}</div>
  <div className="yu-shelf-tabs"><button className={tab==='recent'?'active':''} aria-pressed={tab==='recent'} onClick={()=>onTab('recent')}>All stories <span>{items.length}</span></button><button className={tab==='saved'?'active':''} aria-pressed={tab==='saved'} onClick={()=>onTab('saved')}>My favorites <span>{savedCount}</span></button><button type="button" className="yu-shelf-create" onClick={onCreate}><Plus size={15} aria-hidden="true"/>New story</button></div>
  <div className="yu-shelf-view"><div className="yu-shelf-result"><span role="status" aria-live="polite">{filtered?`Found ${visible.length} / ${items.length} stories`:`Total: ${items.length} stories`}</span>{filtered&&<button type="button" onClick={resetFilters}>Clear filters</button>}</div><button type="button" className="yu-shelf-refresh" onClick={onRefresh} disabled={refreshing||loading||!!favoriteBusy} aria-label="Refresh shelf" title={refreshing?'Refreshing…':'Refresh shelf'} aria-busy={refreshing}><RefreshCw size={16} className={refreshing?'spin':undefined} aria-hidden="true"/></button><label><span className="sr-only">Shelf groups</span><select aria-label="Shelf groups" value={grouping} onChange={event=>onGrouping(event.target.value as ShelfGrouping)}>{shelfGroupings.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown size={14} aria-hidden="true"/></label></div>
  {loading?<p className="yu-inline-status" role="status">Opening your shelf…</p>:error?<div className="yu-inline-status" role="alert">{error}<button onClick={onRefresh} disabled={refreshing}>Retry refresh</button></div>:null}
  {seriesError&&<p className="yu-inline-status" role="alert">{seriesError}</p>}
  {onOpenSeries&&<StorySeriesShelf items={visibleSeries} onOpen={onOpenSeries}/>}
  {productions.length>0&&<ProductionGroup needs={needs} limit={query.trim()?null:Math.max(productionLimit,needs)}>{productions.map(productionRow)}</ProductionGroup>}
  {readable.length?<>{productions.length>0&&<h2 className="yu-shelf-region-title">Ready to read<span>{readable.length} stories</span></h2>}{readableView}</>
   :productions.length?(!filtered&&<p className="yu-shelf-region-empty">Completed stories will appear here when production finishes.</p>)
   :loading||error?null:visibleSeries.length&&!query.trim()?<p className="yu-shelf-region-empty">Open a series to follow its parts. Readable comics appear here as they are created.</p>:query.trim()?<div className="yu-empty"><Search size={32} strokeWidth={1.2}/><h2>No matching story</h2><p>Try another story title, book, theme, or art style.</p><button className="yu-primary" onClick={()=>onQuery('')}>Clear search</button></div>:<div className="yu-empty"><BookOpen size={35} strokeWidth={1}/><h2>{tab==='recent'?'Your stories begin here':'Keep the stories you love'}</h2><p>{tab==='recent'?'Saved stories and stories waiting for generation stay here.':'Tap the bookmark while reading to find a story again.'}</p><button className="yu-primary" onClick={onDiscover}>Create your first story <ArrowRight size={17}/></button></div>}
 </section>;
}
