// English interface: labels, accessibility text, and workflow messages use English.
// Hydrate the owner library once, preserve current reading caches, and coordinate reader actions.
'use client';
// Coordinate story discovery, resumable generation, and the reading sheets.
// Display-name editing uses a saved session even before a generated story exists.
// Swipe offsets live in a drag store and frames render through a memoized filmstrip, so pointer moves
// do not re-render Reader. Identical poll snapshots keep their previous story and progress references.

import {themeLabel} from '../english-labels';
import {pruneReadingCaches,type LibraryInventory} from '../reading-cache.ts';
import StoryExportControl from './StoryExportControl';
import StoryPublicationEditor,{StoryPublicationDetails,StoryPublicationDefaults} from './StoryPublication';
import {storyExportKey} from '@/lib/story-publication';
import BookReferenceStar from './BookReferenceStar';
import ProviderSettings,{ProviderRuntimeSummary} from './ProviderSettings';
import type {ProviderSettingsView} from '@/lib/provider-settings';
import {useBookReference} from '../useBookReference';
import {useCallback, useEffect, useRef, useState} from 'react';
import {ArrowLeft, ArrowRight, Bookmark, BookOpen, Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Compass, Feather, Leaf, List, Moon, Play, RotateCcw, ImageDown, Settings2, Sparkles, UserRound, X, Loader2, FileDown, FileArchive, RefreshCw, Trash2} from 'lucide-react';
import {randomId, request} from './shared';
import type {Story} from '@/lib/content';
import type {GeneratedStory,Selection,SessionView} from '@/lib/reader-model';
import {readerBooks,type ReaderBook} from '@/lib/reader-books';
import {useStoryGeneration} from './useStoryGeneration';
const isGenerated=(s:Story|null):s is GeneratedStory=>!!s&&'generated'in s&&s.generated===true;
import {getArtStyle} from '@/lib/reader-styles';
import StoryRevisionEditor,{StoryRevisionActions,revisionDraftSteps} from './StoryRevisionEditor';
import {useStoryRevision} from './useStoryRevision';
import {defaultProductionPrompt,promptAfterThemeChange} from '@/lib/reader-prompts';
import {recentHeroes,mergeReadingProgress,reconcileReadingProgress} from '@/lib/reader-home';
import RecentStories from './RecentStories';
import ReaderShelf from './ReaderShelf';
import {shelfGroupings,type ShelfGrouping} from '@/lib/shelf-browser';
import DeletedStories,{type DeletedStory} from './DeletedStories';
import StorySource from './StorySource';
import StoryTitleEditor from './StoryTitleEditor';
import StoryScript from './StoryScript';
import StorySceneList from './StorySceneList';
import StoryDiscoveryForm,{discoveryThemes} from './StoryDiscoveryForm';
import StoryCreationSetup from './StoryCreationSetup';
import StoryReselection from './StoryReselection';
import StoryReviewTools from './StoryReviewTools';
import StoryReviewHistory from './StoryReviewHistory';
import StoryPausedEditing from './StoryPausedEditing';
import Sheet from './StorySheet';
import StorySettingsPanel from './StorySettingsPanel';
import StoryFrameCount from './StoryFrameCount';
import {narrativeDetailSchema} from '@/lib/reader-frame-recommendation';
import StoryRetry from './StoryRetry';
import StoryGenerationStatus from './StoryGenerationStatus';
import StoryPageSurface from './StoryPageSurface';
import StoryEndingSurface from './StoryEndingSurface';
import StoryFilmstrip from './StoryFilmstrip';
import {createDragOffset} from './useDragOffset';
import {keepSnapshot,shareRows} from '@/lib/reader-snapshots';
import {newWheelGesture,wheelPageDirection,swipePageDirection} from '@/lib/reader-navigation';
import './reader.css';

type Book = ReaderBook;
type Progress = {storyId:string; page:number; saved?:number; updatedAt?:string|null};
type ExportFormat='pdf'|'png'|'zip';
const exportOptions={
 pdf:{label:"Download PDF",description:"Read page by page",Icon:FileDown},
 png:{label:"Download PNG",description:"Single image overview",Icon:ImageDown},
 zip:{label:"Download ZIP",description:"Source text and complete prompts",Icon:FileArchive},
};
const choices:Book[] = [...readerBooks,{id:'other',sourceTitle:'Other',title:"Other",author:"Book title or URL",era:"Custom",genre:"Custom",note:"Bring your own book"}];
const moods=discoveryThemes;

// Restore preferences before the first render so opening creation immediately cannot save a default book.
function initialReaderSelection():Selection{
 const initial:Selection={bookId:'liaozhai',theme:'原典故事',artStyle:'ink-pencil',productionPrompt:defaultProductionPrompt(),length:'auto',narrativeDetail:'balanced',voice:false};
 try{
  const saved=JSON.parse(localStorage.getItem('yiyu-preferences')||'null');
  if(saved&&typeof saved.bookId==='string')return {...initial,...saved,artStyle:getArtStyle(saved.artStyle).id,productionPrompt:promptAfterThemeChange(typeof saved.productionPrompt==='string'?saved.productionPrompt:'',saved.theme||initial.theme,saved.theme||initial.theme),discovery:{mode:'auto'},storyTitle:undefined,source:undefined,discoverySources:undefined,length:'auto',narrativeDetail:narrativeDetailSchema.safeParse(saved.narrativeDetail).success?saved.narrativeDetail:'balanced',voice:false};
 }catch{}
 return initial;
}


export default function Reader(){
 const [progress,setProgress]=useState<Progress[]>([]);
 const startupDeletions=useRef<Promise<LibraryInventory>|null>(null);
 const authoritativeProgress=useRef<Progress[]>([]);
 const [shelfQuery,setShelfQuery]=useState(()=>{try{return localStorage.getItem('shiqu-shelf-query')||'';}catch{return '';}}),[shelfGrouping,setShelfGrouping]=useState<ShelfGrouping>(()=>{
  try{const saved=localStorage.getItem('shiqu-shelf-grouping');return shelfGroupings.find(option=>option.value===saved)?.value||'book';}catch{return 'book';}
 });
 const [shelfRefreshing,setShelfRefreshing]=useState(false);
 const [tab,setTab]=useState<string>(()=>{
  try{const saved=localStorage.getItem('shiqu-last-tab');return saved==='shelf'||saved==='me'?saved:'discover';}catch{return 'discover';}
 }),[shelfTab,setShelfTab]=useState(()=>{try{return localStorage.getItem('shiqu-shelf-tab')==='saved'?'saved':'recent';}catch{return 'recent';}}),[story,setStory]=useState<Story|null>(null),[page,setPage]=useState(0),[ended,setEnded]=useState(false),[saved,setSaved]=useState(false);
 useEffect(()=>{try{localStorage.setItem('shiqu-last-tab',tab);}catch{}},[tab]);
 const [loading,setLoading]=useState(true),[loadError,setLoadError]=useState(''),[toast,setToast]=useState(''),[source,setSource]=useState(false),[configure,setConfigure]=useState(false),[unavailable,setUnavailable]=useState(''),[settings,setSettings]=useState(false);
 const [workflowTarget,setWorkflowTarget]=useState<string|null>(null),[workflowError,setWorkflowError]=useState('');
 const [script,setScript]=useState(false),[requirements,setRequirements]=useState(false);
 const [discoveryTarget,setDiscoveryTarget]=useState<string|null>(null);
 const [reselectTarget,setReselectTarget]=useState<string|null>(null);
 const [imageIssues,setImageIssues]=useState<Record<string,string>>({}),[imageReloads,setImageReloads]=useState<Record<string,number>>({});
 const [reviewHistoryId,setReviewHistoryId]=useState<string|null>(null);
 const [publicationTarget,setPublicationTarget]=useState<Story|null>(null),[publicationDefaultsOpen,setPublicationDefaultsOpen]=useState(false);
 const [providerRuntime,setProviderRuntime]=useState<ProviderSettingsView['runtime']|null>(null);
 const [sceneList,setSceneList]=useState(false);
 const [selection,setSelection]=useState<Selection>(initialReaderSelection),[largeText,setLargeText]=useState(false),[motion,setMotion]=useState('forward'),[creating,setCreating]=useState(false);
 const [deletedIds,setDeletedIds]=useState<string[]>([]),[deleteTarget,setDeleteTarget]=useState<{id:string;title:string}|null>(null),[deleting,setDeleting]=useState(false),[deleteError,setDeleteError]=useState('');
 const [favoriteBusy,setFavoriteBusy]=useState('');
 const [renameTarget,setRenameTarget]=useState<{id:string;title:string}|null>(null);
 const [deletedStories,setDeletedStories]=useState<DeletedStory[]>([]),[recoveryOpen,setRecoveryOpen]=useState(false),[recoveryLoading,setRecoveryLoading]=useState(false),[recoveryError,setRecoveryError]=useState(''),[restoring,setRestoring]=useState(''),[undoTarget,setUndoTarget]=useState<DeletedStory|null>(null);
 const restoreLock=useRef(false),recoveryLoad=useRef(0),pendingRestores=useRef(new Map<string,DeletedStory>());
 const favoriteLock=useRef(false);
 const deleted=useRef(new Set<string>());
 const [exporting,setExporting]=useState<ExportFormat|null>(null),[exportProgress,setExportProgress]=useState(''),[pdfDownload,setPdfDownload]=useState<{url:string;filename:string;storyId:string;key:string}|null>(null),[pngDownload,setPngDownload]=useState<{url:string;filename:string;storyId:string;key:string}|null>(null),[zipDownload,setZipDownload]=useState<{url:string;filename:string;storyId:string;key:string}|null>(null);
 useEffect(()=>()=>{if(pdfDownload)URL.revokeObjectURL(pdfDownload.url);},[pdfDownload]);
 useEffect(()=>()=>{if(pngDownload)URL.revokeObjectURL(pngDownload.url);},[pngDownload]);
 useEffect(()=>()=>{if(zipDownload)URL.revokeObjectURL(zipDownload.url);},[zipDownload]);
 const exportLock=useRef(false),reselectLock=useRef(false);
 const [drag]=useState(createDragOffset),setDrag=drag.set,[lastReadId,setLastReadId]=useState('');
 const [metadataVisible,setMetadataVisible]=useState(true);
 useEffect(()=>{setMetadataVisible(true);setImageIssues({});setImageReloads({});},[story?.id]);
 const readerRef=useRef<HTMLElement>(null),endingRef=useRef<HTMLElement>(null);
 const wheelGesture=useRef(newWheelGesture());
 function acceptServerProgress(rows:Progress[]){
  authoritativeProgress.current=reconcileReadingProgress(authoritativeProgress.current,rows);
  setProgress(old=>{
   let raw='[]',cached:Progress[]=[];try{raw=localStorage.getItem('yiyu-reading')||'[]';cached=JSON.parse(raw);}catch{}
   // Shelf polls repeat the same rows; keep the old array so Reader skips the render and the storage write.
   const retained=reconcileReadingProgress(mergeReadingProgress(old,cached),authoritativeProgress.current);
   const merged=shareRows(old,retained.filter(p=>!deleted.current.has(p.storyId)),p=>p.storyId);
   const text=JSON.stringify(retained);if(text!==raw)try{localStorage.setItem('yiyu-reading',text);}catch{}
   return merged;
  });
 }
 const gen=useStoryGeneration(page,{onStory:(s,p,b)=>{if(deleted.current.has(s.id))return;setStory(old=>keepSnapshot(old,s));if(p!==undefined){setPage(p);setSaved(!!b);}},onProgress:acceptServerProgress},!loading&&tab==='shelf'&&!story&&!configure&&!favoriteBusy&&!deleting&&!restoring&&!shelfRefreshing);
 // Keep the same panel open when the first image arrives underneath it.
 useEffect(()=>{if(gen.active&&!story&&!configure&&!workflowTarget)setWorkflowTarget(gen.active.id);},[gen.active?.id,story?.id,configure,workflowTarget]);
 function openWorkflow(id:string){
  setSettings(false);setWorkflowError('');setWorkflowTarget(id);
  if(story?.id!==id)setStory(null);
  if(gen.active?.id!==id)void gen.resume(id,story?.id===id?page:undefined).catch(error=>setWorkflowError(error instanceof Error?error.message:"Could not open the production workflow. Try again."));
 }
 function openStorySettings(next:Story){openWorkflow(next.id);}
 function closeWorkflow(){
  setWorkflowTarget(null);setWorkflowError('');
  if(!story){gen.leave();history.replaceState(null,'','/');}
 }
 async function retryWorkflow(faultId?:string){
  setWorkflowError('');
  try{await gen.retryStep(faultId);}catch(error){setWorkflowError(error instanceof Error?error.message:"Retry did not complete. Please try again later.");}
 }
 // The id stays the same when the first image arrives, so a draft written before it survives.
 const historyOwner=story?.id||gen.active?.id;
 useEffect(()=>{setReviewHistoryId(null);},[historyOwner]);
 const revision=useStoryRevision(story?story.id:gen.active&&(!gen.active.intake||gen.active.intake.phase==='confirmed')?gen.active.id:undefined,async next=>{await switchVersion(next.id);});
 async function switchVersion(id:string){
  const previous={story,page,saved,ended,drag:drag.get(),motion,seen:seen.current,session:session.current,workflowTarget};setWorkflowTarget(id);setWorkflowError('');setSettings(false);setSource(false);setRequirements(false);setScript(false);revision.setTab(null);setStory(null);setPage(0);setEnded(false);setSaved(false);setDrag(0);setMotion('forward');seen.current=new Set();session.current=randomId();gen.leave();
  try{await gen.resume(id,0,false,true);}catch{setPage(previous.page);setSaved(previous.saved);setEnded(previous.ended);setDrag(previous.drag);setMotion(previous.motion);seen.current=previous.seen;session.current=previous.session;setStory(previous.story);setWorkflowTarget(previous.workflowTarget);setWorkflowError("Could not open the new version. Reload the production workflow.");void gen.refreshLibrary().catch(()=>{});notify("Could not open this version. Continue with the saved version from your shelf.");}
 }
 const visitor=useRef(''),session=useRef(''),seen=useRef(new Set<number>()),noticeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const notify=(text:string)=>{setToast(text);if(noticeTimer.current)clearTimeout(noticeTimer.current);noticeTimer.current=setTimeout(()=>setToast(''),4000);};
 const bookReference=useBookReference(story?.id,page,story?.pages[page]?.image,notify);
 function changeShelfQuery(query:string){
  setShelfQuery(query);
  try{localStorage.setItem('shiqu-shelf-query',query);}catch{}
 }
 function changeShelfTab(tab:string){
  setShelfTab(tab);
  try{localStorage.setItem('shiqu-shelf-tab',tab);}catch{}
 }
 function changeShelfGrouping(grouping:ShelfGrouping){
  setShelfGrouping(grouping);
  try{localStorage.setItem('shiqu-shelf-grouping',grouping);}catch{}
 }
 async function refreshShelf(){
  if(shelfRefreshing)return;setShelfRefreshing(true);
  try{
   await gen.refreshLibrary();setLoadError('');
  }catch(error){notify(error instanceof Error?error.message:"Could not refresh the shelf. Try again.");}
  finally{setShelfRefreshing(false);}
 }

 function track(kind:string,s:Story|null=story,index:number|null=null){if(!s||!visitor.current||!session.current)return;request('reader/sessions/'+s.id+'/events','POST',{id:session.current+':'+s.id+':'+kind+(index===null?'':':'+index),visitor:visitor.current,session:session.current,storyId:s.id,kind,page:index,mode:'manual',cohort:'internal'}).catch(()=>{});}
 function remember(s:Story,index:number,isSaved:boolean){if(deleted.current.has(s.id))return;authoritativeProgress.current=reconcileReadingProgress(authoritativeProgress.current,[{storyId:s.id,page:index,saved:isSaved?1:0,updatedAt:new Date().toISOString()}]);setLastReadId(s.id);try{localStorage.setItem('shiqu-last-read',s.id);}catch{}setProgress(pr=>{const rows=[{storyId:s.id,page:index,saved:isSaved?1:0,updatedAt:new Date().toISOString()},...pr.filter(p=>p.storyId!==s.id)];localStorage.setItem('yiyu-reading',JSON.stringify(rows));return rows;});request('reader/sessions/'+s.id+'/progress','POST',{storyId:s.id,page:index,saved:isSaved}).catch(()=>{});}
 function open(s:Story,restart=false){if(deleted.current.has(s.id))return;setWorkflowTarget(null);setDrag(0);gen.resume(s.id,restart?0:undefined).catch(e=>notify(e.message));setConfigure(false);setUnavailable('');const pr=progress.find(p=>p.storyId===s.id);const index=restart?0:Math.min(pr?.page||0,s.pages.length-1);setPage(index);setStory(s);setSaved(!!pr?.saved);setEnded(false);setMotion('forward');seen.current=new Set();session.current=randomId();history.replaceState(null,'','/read?id='+encodeURIComponent(s.id));track('start',s);window.scrollTo(0,0);}
 function home(){setWorkflowTarget(null);setWorkflowError('');setDrag(0);gen.leave();setStory(null);setEnded(false);setSource(false);history.replaceState(null,'','/');}
 function backToShelf(){setSettings(false);setSource(false);setRequirements(false);setScript(false);revision.setTab(null);home();setTab('shelf');window.scrollTo({top:0,behavior:'instant'});}
 function turn(delta:number){if(!story)return;if(!ended&&page===0&&delta<0)return;if(ended){if(delta<0){setDrag(0);setPage(story.pages.length-1);setEnded(false);setMotion('back');}else if(delta>0)home();return;}if(delta>0&&!story.pages[page]?.image){notify("This illustration is still being drawn. Please wait.");return;}setMotion(delta>0?'forward':'back');if(page+delta>=story.pages.length){setEnded(true);if(seen.current.size===story.pages.length)track('complete');}else setPage(p=>Math.max(0,p+delta));}
 function goToPage(index:number){if(!story)return;setDrag(0);setMotion(index>page?'forward':'back');setEnded(false);setPage(Math.max(0,Math.min(index,story.pages.length-1)));}
 function choose(bookId:Selection['bookId']=selection.bookId,theme:Selection['theme']='原典故事'){setDiscoveryTarget(null);setSelection(s=>({...s,bookId,theme,productionPrompt:promptAfterThemeChange(s.productionPrompt,s.theme,theme),discovery:{mode:'auto'},storyTitle:undefined,source:undefined,discoverySources:undefined}));setConfigure(true);setUnavailable('');}
 useEffect(()=>{visitor.current=localStorage.getItem('yiyu-visitor')||randomId();localStorage.setItem('yiyu-visitor',visitor.current);try{setLargeText(localStorage.getItem('yiyu-large-text')==='1');}catch{}if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
 let active=true;
 startupDeletions.current??=request('reader/deletions?inventory=1');
 startupDeletions.current.then(async inventory=>{
  const cleaned=await pruneReadingCaches(inventory,localStorage,typeof caches==='undefined'?undefined:caches);
  const {deletions}=cleaned;
  if(!active)return;
  setDeletedStories(deletions);deletions.forEach(item=>deleted.current.add(item.storyId));setDeletedIds([...deleted.current]);
  const local=cleaned.progress;setLastReadId(cleaned.lastReadId);
  const merged=reconcileReadingProgress(local,authoritativeProgress.current).filter(p=>cleaned.ids.has(p.storyId));
  setProgress(old=>reconcileReadingProgress(mergeReadingProgress(old,merged),authoritativeProgress.current).filter(p=>cleaned.ids.has(p.storyId)&&!deleted.current.has(p.storyId)));
  try{localStorage.setItem('yiyu-reading',JSON.stringify(merged));}catch{}
  const id=new URLSearchParams(location.search).get('id');
  if(id&&!deleted.current.has(id))gen.resume(id).catch(()=>{if(active)setLoadError("This story could not be opened.");});
 }).catch(()=>{if(active)setLoadError("Could not load the story. Check your connection and try again.");}).finally(()=>{if(active)setLoading(false);});
 return()=>{active=false;if(noticeTimer.current)clearTimeout(noticeTimer.current);};},[]);
 useEffect(()=>{if(story){if(!session.current)session.current=randomId();track('start',story);}},[story?.id]);
 useEffect(()=>{if(!story||ended||!story.pages[page]?.image)return;seen.current.add(page);track('page',story,page);remember(story,page,saved);const next=story.pages[page+1]?.image;if(next){const img=new Image();img.src=next;}},[story?.id,story?.pages[page]?.image,page,ended]);
 useEffect(()=>{function key(e:KeyboardEvent){if(!story||source||settings||workflowTarget||configure||sceneList)return;if(e.key==='ArrowRight'||e.key==='ArrowDown'){e.preventDefault();turn(1);}if(e.key==='ArrowLeft'||e.key==='ArrowUp'){e.preventDefault();turn(-1);}if(e.key==='Escape')home();}window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[story,page,ended,source,settings,workflowTarget,configure,sceneList]);
 useEffect(()=>{
  const reader=readerRef.current;if(!reader||!story||source||settings||workflowTarget||configure||sceneList)return;
  const gesture=wheelGesture.current;
  function wheel(e:WheelEvent){
   if(e.ctrlKey||e.metaKey)return; // Preserve browser zoom and trackpad pinch.
   const horizontal=Math.abs(e.deltaX)>Math.abs(e.deltaY);
   if(ended&&!horizontal)return; // The closing page keeps its native vertical scroll.
   const raw=horizontal?e.deltaX:e.deltaY;if(!raw)return;
   e.preventDefault();
   const direction=wheelPageDirection(gesture,{x:e.deltaX,y:e.deltaY,mode:e.deltaMode,time:performance.now(),height:reader!.clientHeight});
   if(direction)turn(direction);
  }
  reader.addEventListener('wheel',wheel,{passive:false});
  return()=>reader.removeEventListener('wheel',wheel);
 },[story,page,ended,source,settings,workflowTarget,configure,sceneList]);
 useEffect(()=>{
  const ending=endingRef.current;if(!ending||!ended||source||settings||workflowTarget||configure)return;
  let start:{x:number;y:number}|null=null;
  const touchStart=(e:TouchEvent)=>{const target=e.target as HTMLElement;start=ending.scrollTop<=1&&e.touches.length===1&&!target.closest('button,a')?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null;};
  const touchMove=(e:TouchEvent)=>{if(!start||e.touches.length!==1)return;const dx=e.touches[0].clientX-start.x,dy=e.touches[0].clientY-start.y;if(dy>0&&Math.abs(dy)>Math.abs(dx)*1.3){e.preventDefault();if(swipePageDirection(dx,dy)===-1){start=null;turn(-1);}}};
  ending.addEventListener('touchstart',touchStart,{passive:true});ending.addEventListener('touchmove',touchMove,{passive:false});
  return()=>{ending.removeEventListener('touchstart',touchStart);ending.removeEventListener('touchmove',touchMove);};
 },[ended,story,source,settings,workflowTarget,configure]);
 useEffect(()=>{localStorage.setItem('yiyu-preferences',JSON.stringify(selection));},[selection]);
 function bookmark(){if(!story)return;const value=!saved;setSaved(value);remember(story,page,value);if(value)track('save');notify(value?"Bookmarked. Continue reading later.":"Removed from favorites");}
 async function favoriteFromShelf(id:string,value:boolean){
  if(favoriteLock.current||deleted.current.has(id))return;
  favoriteLock.current=true;setFavoriteBusy(id);
  try{
   const result:Progress=await request('reader/library/'+encodeURIComponent(id)+'/favorite','POST',{saved:value});
   acceptServerProgress([result]);
   notify(value?"Added to favorites. Continue reading later.":"Removed from favorites");
  }catch(error){notify(error instanceof Error?error.message:"Could not save your favorite. Try again.");}
  finally{favoriteLock.current=false;setFavoriteBusy('');}
 }


 async function exportStory(format:ExportFormat,output:Story){
  if(exportLock.current)return;
  exportLock.current=true;setExporting(format);setExportProgress("Preparing "+format.toUpperCase());
  try{
   const key=storyExportKey(output),cached=format==='zip'?zipDownload:format==='png'?pngDownload:pdfDownload;
   if(cached?.storyId===output.id&&cached.key===key){
    const link=document.createElement('a');link.href=cached.url;link.download=cached.filename;(document.querySelector('dialog[open]')||document.body).appendChild(link);link.click();link.remove();return;
   }
   if(format==='zip'){
    const {downloadStoryZip}=await import('@/lib/reader-zip');
    const result=await downloadStoryZip(output,setExportProgress);setZipDownload({...result,storyId:output.id,key});
    notify("The ZIP includes saved prompts and production instructions. Review custom content before sharing.");
   }else if(format==='png'){
    const {downloadStoryPng}=await import('@/lib/reader-png');
    const result=await downloadStoryPng(output,setExportProgress);setPngDownload({...result,storyId:output.id,key});
    notify("Your PNG overview is ready to download again.");
   }else{
    const {downloadStoryPdf}=await import('@/lib/reader-pdf');
    const result=await downloadStoryPdf(output,setExportProgress);setPdfDownload({...result,storyId:output.id,key});
    notify("Your PDF is ready to download again.");
   }
  }catch(e){notify(e instanceof Error?e.message:"Export failed. Stay connected and try again.");}
  finally{exportLock.current=false;setExporting(null);setExportProgress('');}
 }
 async function generate(input:Selection){
  if(creating)return;
  setCreating(true);setUnavailable('');
  try{
   if(discoveryTarget){
    if(gen.active?.id!==discoveryTarget)throw Error("The current task has changed. Reopen it before editing.");
    await gen.setup({action:'conditions',conditions:{bookId:input.bookId,customBook:input.customBook,theme:input.theme,discoverySources:input.discoverySources,productionPrompt:input.productionPrompt}});
    setSelection(input);setDiscoveryTarget(null);setConfigure(false);return;
   }
   setSelection(input);gen.leave();session.current=randomId();seen.current=new Set();setPage(0);setSaved(false);setStory(null);setEnded(false);await gen.start({...input,length:'auto',narrativeDetail:input.narrativeDetail||'balanced',voice:false},true);setConfigure(false);}
  catch(e){setUnavailable(e instanceof Error?e.message:"The task was not saved. Try again.");}finally{setCreating(false);}
 }

 function reselectStory(){
  const originId=story&&isGenerated(story)?story.id:gen.active?.id;
  if(!originId||reselectLock.current||creating||revision.busy||gen.active?.superseded)return;
  reselectLock.current=true;setReselectTarget(originId);
 }
 function finishReselection(next:SessionView,readOnly=false){
  const previousId=story?.id||gen.active?.id,changed=next.id!==previousId;
  reselectLock.current=false;setReselectTarget(null);if(changed||!settings)setWorkflowTarget(next.id);
  if(changed){setStory(null);setPage(0);setSaved(false);setEnded(false);setDrag(0);setMotion('forward');seen.current=new Set();session.current=randomId();setSettings(false);setSource(false);setRequirements(false);setScript(false);revision.setTab(null);}
  gen.adopt(next,readOnly||!changed,readOnly||!changed?next.page:0);
 }
 async function inspectImage(storyId:string,index:number,image:string,reload=false){
  setImageIssues(old=>({...old,[image]:"Checking image…"}));
  try{
   const next=await gen.checkImage(storyId,index,image),fault=next.faults?.find(f=>f.page===index);
   setImageIssues(old=>({...old,[image]:fault?fault.message:"The image file is readable and can be reloaded."}));
   if(!fault&&reload)setImageReloads(old=>({...old,[image]:(old[image]||0)+1}));
  }catch(e){setImageIssues(old=>({...old,[image]:e instanceof Error?e.message:"Could not check the image. Try again."}));}
 }
 // Memoized frames need stable handlers; the error handler reads the current story through a ref.
 const frameError=useRef((_index:number,_image:string)=>{});
 frameError.current=(index,image)=>{if(story&&isGenerated(story))void inspectImage(story.id,index,image);};
 const onFrameError=useCallback((index:number,image:string)=>frameError.current(index,image),[]);
 const onFrameLoad=useCallback((image:string)=>setImageIssues(old=>{if(!old[image])return old;const next={...old};delete next[image];return next;}),[]);

 async function deleteStory(){
  if(!deleteTarget||deleting)return;const target=deleteTarget;setDeleting(true);setDeleteError('');
  try{
   const result=await request('reader/library/'+encodeURIComponent(target.id),'DELETE');
   const record:DeletedStory={storyId:target.id,title:target.title,deletedAt:result.deletedAt,kind:'generated'};
   setDeletedStories(rows=>[record,...rows.filter(row=>row.storyId!==record.storyId)]);setUndoTarget(record);setRecoveryError('');setToast('');
   deleted.current.add(target.id);setDeletedIds([...deleted.current]);gen.remove(target.id);
   setProgress(old=>{const rows=old.filter(p=>p.storyId!==target.id);try{localStorage.setItem('yiyu-reading',JSON.stringify(rows));}catch{}return rows;});
   if(lastReadId===target.id){setLastReadId('');try{localStorage.removeItem('shiqu-last-read');}catch{}}
   try{const cache=await caches.open('yiyu-offline-v1');await cache.delete('/offline-data/'+target.id);}catch{}
   if(story?.id===target.id)home();setDeleteTarget(null);
  }catch(e){setDeleteError(e instanceof Error?e.message:"Could not delete the story. Try again.");}finally{setDeleting(false);}
 }
 async function loadDeletedStories(){
  const attempt=++recoveryLoad.current;setRecoveryLoading(true);setRecoveryError('');
  try{
   // A restore may have committed before its snapshot reload failed; keep that recovery retryable.
   for(const target of pendingRestores.current.values())await restoreStory(target);
   if(pendingRestores.current.size)return;
   const rows:DeletedStory[]=await request('reader/deletions');if(attempt===recoveryLoad.current)setDeletedStories(rows);
  }
  catch(error){if(attempt===recoveryLoad.current)setRecoveryError(error instanceof Error?error.message:"Could not load deleted stories. Try again.");}
  finally{if(attempt===recoveryLoad.current)setRecoveryLoading(false);}
 }
 async function restoreStory(target:DeletedStory){
  if(restoreLock.current)return;restoreLock.current=true;setRestoring(target.storyId);setRecoveryError('');
  try{
   pendingRestores.current.set(target.storyId,target);
   await request('reader/library/'+encodeURIComponent(target.storyId)+'/restore','POST');
   const sessions=await gen.refreshLibrary(target.storyId);
   deleted.current.delete(target.storyId);setDeletedIds([...deleted.current]);
   acceptServerProgress(sessions.map(s=>({storyId:s.id,page:s.page,saved:s.saved?1:0,updatedAt:s.lastReadAt||s.createdAt})));
   pendingRestores.current.delete(target.storyId);
   setDeletedStories(rows=>rows.filter(row=>row.storyId!==target.storyId));setUndoTarget(old=>old?.storyId===target.storyId?null:old);
   notify("Restored “"+target.title+"”. Continue from your shelf.");
  }catch(error){setRecoveryError(error instanceof Error?error.message:"Restoration did not complete. Try again.");}
  finally{restoreLock.current=false;setRestoring('');}
 }
 function askDelete(id:string,title:string){setDeleteError('');setDeleteTarget({id,title});}
 function exportControl(format:ExportFormat,className:string,target:Story|null=story){
  const {label,description,Icon}=exportOptions[format];
  const busy=exporting===format;
  const content=<>{busy?<Loader2 size={20} className="spin"/>:<Icon size={20}/>}<span>{busy?(format==='zip'?"Creating archive…":"Exporting…"):label}<small>{description}</small></span></>;
  if(!target)return <button key={format} type="button" className={className} disabled>{content}</button>;
  return <StoryExportControl key={target.id+':'+format} story={target} format={format} className={className} busy={busy} disabled={!!exporting||!target.pages.length||target.pages.some(p=>!p.image)} onExport={output=>exportStory(format,output)} onEdit={isGenerated(target)?()=>setPublicationTarget(target):undefined}>{content}</StoryExportControl>;
 }
 function exportStatus(showReadiness=true){
  if(!story)return null;
  return <p className="yu-export-status" role="status">{exportProgress||(showReadiness&&story.pages.some(p=>!p.image)?`Illustrations ready: ${story.pages.filter(p=>p.image).length} / ${story.pages.length}. Download when all illustrations are ready.`:'')}</p>;
 }
 // Session lists contain only the newest submission; cached artwork must not resurrect older editions.
 const latestIds=new Set(gen.sessions.map(session=>session.id));
 const allStories=gen.sessions.flatMap(s=>s.story?[s.story]:[]).filter(s=>!deletedIds.includes(s.id));
 const heroes=recentHeroes(allStories,deletedIds.includes(lastReadId)?'':lastReadId,progress.filter(p=>!deletedIds.includes(p.storyId)));
 const bookName=(s:Pick<Story,'id'|'bookId'>)=>(s.bookId==='other'?gen.sessions.find(session=>session.id===s.id)?.selection.customBook:'')||choices.find(b=>b.id===s.bookId)?.title||s.bookId;
 const current=story?.pages[page];
 const activeProgress=mergeReadingProgress(progress,gen.sessions.map(s=>({storyId:s.id,page:s.page,saved:s.saved?1:0,updatedAt:s.lastReadAt||s.createdAt}))).filter(p=>!deletedIds.includes(p.storyId)&&latestIds.has(p.storyId));
 const readingSession=story?(gen.active?.id===story.id?gen.active:gen.sessions.find(session=>session.id===story.id)):undefined;
 const workflowSession=workflowTarget?(gen.active?.id===workflowTarget?gen.active:null):settings?readingSession:!story?gen.active:null;
 const scriptStory=story||gen.active?.story||null;
 const revisionSession=readingSession||(!story?gen.active:null);
 const revisionResuming=!!revisionSession&&revisionSession.state!=='completed'&&!!revisionSession.generationControl&&revisionSession.generationControl!=='active';
 const GenerationSurface=revisionResuming?StoryPausedEditing:StoryGenerationStatus;
 const revisionPending=!!revision.impact?.changed;

 const workflowContent=(workflowSession?<>
   {workflowSession.intake&&workflowSession.intake.phase!=='confirmed'?<StoryCreationSetup
    session={workflowSession} book={bookName({id:workflowSession.id,bookId:workflowSession.selection.bookId})} busy={gen.setupBusy} onAction={gen.setup}
    onBackToDiscovery={()=>{setDiscoveryTarget(workflowSession.id);setSelection(workflowSession.selection);setUnavailable('');setConfigure(true);}}
    progress={{busy:gen.busy,controlBusy:!!gen.controlBusy,onControl:gen.control,error:workflowError||gen.error,onRetry:retryWorkflow,onBack:backToShelf,hideBack:true,showSummary:false}}
   />:!revisionResuming&&workflowSession.awaitingFrameCount&&workflowSession.frameRecommendation?<>
    <StoryFrameCount key={workflowSession.id} recommendation={workflowSession.frameRecommendation} disabled={gen.busy} onConfirm={gen.confirmFrameCount}/>
    {gen.error&&<p className="yu-batch-error" role="alert">{gen.error}</p>}
   </>:<GenerationSurface
    session={workflowSession} busy={gen.busy} controlBusy={!!gen.controlBusy||creating} onControl={gen.control} error={workflowError||gen.error} onRetry={retryWorkflow} onBack={backToShelf} hideBack showSummary={false}
    navigation={{source:{onClick:()=>setSource(true),disabled:!workflowSession.generationProgress?.sourceReady},reselect:{label:"Replace story selection",onClick:()=>void reselectStory(),disabled:creating||revision.busy||!!gen.controlBusy,title:"Replace the selected story, keep one shelf card, and preserve previous results in history"},reselecting:creating}}
    onAcceptance={()=>revision.open('acceptance')} onHistory={()=>setReviewHistoryId(workflowSession.id)}
    timeline={!revisionResuming?{
     links:{source:[{label:"Production instructions",onClick:()=>revision.open('requirements')},{label:"Acceptance criteria",onClick:()=>revision.open('acceptance')}]},
     detailActions:{source:{label:"Change art style",onClick:()=>revision.open('style')}},
     actions:{count:{label:"Change narrative detail",onClick:()=>revision.open('count')},...(workflowSession.story?{plan:{label:"View storyboard",onClick:()=>setScript(true)}}:{})}
    }:undefined}
    stages={revisionPending&&revision.base&&!revisionResuming?revisionDraftSteps(revision.base,revision.changes):undefined} editor={revision} onReselect={()=>void reselectStory()}
    reviewTools={!revisionPending&&<StoryReviewTools onReplan={()=>revision.open('requirements')} session={workflowSession} busy={gen.busy||!!gen.controlBusy} error={gen.controlError} onScript={()=>setScript(true)} onEdit={page=>revision.open('script',page)} onRetry={()=>void retryWorkflow(workflowSession.faults?.find(f=>f.stage==='review')?.id)} onDrawAnyway={()=>void gen.drawAnyway(workflowSession.id)}/>}
   />}
   {revisionPending&&!revisionResuming&&<StoryRevisionActions editor={revision} link/>}
  </>:<div role="status">{workflowError?<><p role="alert">{workflowError}</p><button type="button" onClick={()=>openWorkflow(workflowTarget!)}>Reload production workflow</button></>:<p>Opening production workflow…</p>}</div>);

 const panelOpen=!!(workflowTarget||(!story&&gen.active)||(settings&&story));
 const panelStory=workflowSession?.story||story;
 const pendingStories=gen.sessions.filter(s=>!deletedIds.includes(s.id)&&!s.story?.pages[0]?.image);
 const shelf=activeProgress.flatMap(p=>{const s=allStories.find(s=>s.id===p.storyId);return s&&s.pages[0]?.image?[s]:[];});

 const shelfCount=shelf.length+pendingStories.length;
 const progressById=new Map(activeProgress.map(p=>[p.storyId,p]));
 const favoriteCount=shelf.filter(s=>progressById.get(s.id)?.saved).length+pendingStories.filter(s=>progressById.get(s.id)?.saved??s.saved).length;

 return <div className={'yu-world'+(story?' yu-reading-world':'')}><div className={'yu-app'+(story?' yu-immersive':'')}>
 {story?<main className={'yu-reader'+(!metadataVisible&&!ended?' yu-metadata-hidden':'')} ref={readerRef} aria-label={"Read "+story.title}>
 {!ended&&<StoryFilmstrip pages={story.pages} page={page} drag={drag} reloads={imageReloads} onImageError={onFrameError} onImageLoad={onFrameLoad}/>}
 {ended&&<div className="yu-scene-shade"/>}
 {!!readingSession?.reviewIssues?.length&&!settings&&<button type="button" className="yu-reader-review-notice" onClick={()=>openWorkflow(story.id)}>Review has {readingSession.reviewIssues.length}  issues remaining. Drawing has stopped. View and resolve them</button>}
 {!ended&&!current?.image&&<div className="yu-drawing" role="status"><div className="yu-drawing-orbit"><Feather size={35} strokeWidth={1}/></div><span>{gen.error?"Drawing is paused":"This scene is unfolding"}</span><small>{gen.error||gen.active?.stage||"Drawing your illustration"}</small>{gen.error&&gen.active&&<StoryRetry session={gen.active} busy={gen.busy} onRetry={gen.retryStep}/>}</div>}
 <header className="yu-reader-top"><div className="yu-progress" aria-label={`Page ${page+1} of ${story.pages.length} pages`}>{story.pages.map((_,i)=><span key={i} className={i<=page?'read':''}/>)}</div><div className="yu-reader-heading"><button className="yu-glass" onClick={home} aria-label="Back to Discover"><ArrowLeft size={21}/></button><div className="yu-reader-title"><div><strong>{story.title}</strong><span>{bookName(story)}{isGenerated(story)?" · AI generated":''}</span></div><div className="yu-style-label" aria-label="Story theme and art style">{story.theme&&<span>{themeLabel(story.theme)}</span>}<span>{isGenerated(story)?(story.artStyleLabel||"Art style not recorded"):"Art style not recorded"}</span></div></div>{!ended&&<BookReferenceStar selected={bookReference.selected} disabled={bookReference.disabled} busy={bookReference.busy} onClick={bookReference.toggle}/>}<button className="yu-glass" onClick={bookmark} aria-label={saved?"Remove from favorites":"Favorite story"}><Bookmark size={20} fill={saved?'currentColor':'none'}/></button><button className="yu-glass" onClick={()=>openStorySettings(story)} aria-label="Story settings"><Settings2 size={19}/></button></div></header>
 {ended?<StoryEndingSurface surfaceRef={endingRef} onTurn={turn} onDrag={setDrag} drag={drag}><div className="yu-ending-mark"><Leaf size={32} strokeWidth={1.3}/></div><p className="yu-kicker">The story ends. The reflection is yours.</p><h1>{story.reflection}</h1><div className="yu-end-line"/><p>Some stories find their final page<br/>in your own life.</p><button className="yu-primary" onClick={()=>open(story,true)}><RotateCcw size={18}/>Read again<ArrowRight size={19}/></button><div className="yu-ending-navigation"><button onClick={()=>turn(-1)}><ChevronLeft size={17}/>Previous illustration</button><button onClick={()=>{home();setTab('shelf');window.scrollTo({top:0,behavior:'instant'});}}><BookOpen size={16}/>Shelf</button><button onClick={()=>{home();choose();}}><Sparkles size={16}/>Start another story</button></div><section className="yu-ending-downloads" aria-label="Download story"><h2>Take the story with you</h2><div className="yu-ending-formats">{exportControl('pdf','yu-ending-download')}{exportControl('png','yu-ending-download')}{exportControl('zip','yu-ending-download yu-download-zip')}</div>{exportStatus()}</section><StoryPublicationDetails story={story}/><button className="yu-end-source" onClick={()=>setSource(true)}>Read the source <ChevronRight size={13}/></button></StoryEndingSurface>:<>
 <StoryPageSurface onTurn={turn} onDrag={setDrag} onToggleMetadata={()=>setMetadataVisible(visible=>!visible)}/>
 <div className={'yu-scene-caption '+(largeText?'large':'')} key={'caption-'+page}><div className="yu-scene-number"><span>{String(page+1).padStart(2,'0')}</span><i/><span>{String(story.pages.length).padStart(2,'0')}</span>{isGenerated(story)&&gen.busy&&<span className="yu-scene-generation" role="status"><Loader2 size={12} className="spin"/>{gen.active?.stage||"Generating"}</span>}</div><p>{current?.caption}</p>{current?.image&&(gen.error||imageIssues[current.image]||!!readingSession?.faults?.length)&&<div className="yu-reader-error">{gen.error||imageIssues[current.image]}{isGenerated(story)&&imageIssues[current.image]&&<button type="button" onClick={()=>void inspectImage(story.id,page,current.image,true)}>Recheck image</button>}{readingSession&&<StoryRetry session={readingSession} busy={gen.busy} onRetry={gen.retryStep}/>}</div>}</div>
 <footer className="yu-reader-bottom"><button className="yu-source-button" onClick={()=>setSource(true)} aria-label="Source" title="Source"><BookOpen size={17}/><span>Source</span></button><button className="yu-glass" onClick={()=>setSceneList(true)} aria-label="Scene list" title="Scene list"><List size={20}/></button><div className="yu-arrows" role="group" aria-label="Turn page"><button className="yu-glass" disabled={page===0} onClick={()=>goToPage(0)} aria-label="First page" title="First page"><ChevronsLeft size={22}/></button><button className="yu-glass" disabled={page===0} onClick={()=>turn(-1)} aria-label="Previous page" title="Previous page"><ChevronLeft size={22}/></button><button className="yu-next" onClick={()=>turn(1)} aria-label={page===story.pages.length-1?"Finish and reflect":"Next page"} title={page===story.pages.length-1?"Finish and reflect":"Next page"}><ChevronRight size={23}/></button><button className="yu-glass" disabled={page===story.pages.length-1} onClick={()=>goToPage(story.pages.length-1)} aria-label="Last page" title="Last page"><ChevronsRight size={22}/></button></div></footer>
 </>}
 </main>:<>
 <header className="yu-header"><button className="yu-logo" onClick={()=>setTab('discover')} aria-label="Shiqu, back to Discover"><span><Feather size={22}/></span><strong>Shiqu</strong><i/></button><span className="yu-header-note">Step into a story. Carry it with you.</span><button className="yu-avatar" onClick={()=>setTab('me')} aria-label="My space"><UserRound size={19}/></button></header>
 <main className="yu-home">
 {tab==='discover'?<>
 <section className="yu-intro"><div><p className="yu-kicker">Make time for a good story</p><h1>What story will you<br/>discover <span>today?</span></h1></div><span className="yu-stamp">Classic tales<br/>reimagined</span></section>
 <RecentStories key={heroes.map(h=>h.story.id).join('|')} items={heroes} loading={loading||gen.libraryLoading} bookName={bookName} onOpen={open}/>
 <button className="yu-new-story-link" onClick={()=>choose()}><Sparkles size={16}/><span>Create my story</span><ArrowRight size={16}/></button>
 <section className="yu-section"><div className="yu-section-title"><h2>Begin with a book</h2><span>Familiar classics, new encounters</span></div><div className="yu-books">{choices.map((b,i)=><button key={b.id} onClick={()=>choose(b.id)} aria-label={"Choose "+b.title}><span className={'yu-book-cover book-'+(i%3)}><span className="yu-book-border"/><small>{b.era} · {b.author}</small><strong className={b.title.length>5?'yu-book-title-long':undefined}>{b.title}</strong><i>{b.genre}</i><span className="yu-book-ornament">{i===0?<Moon size={44} strokeWidth={.7}/>:i===1?<Leaf size={52} strokeWidth={.7}/>:<Feather size={48} strokeWidth={.7}/>}</span></span><strong>{b.title}</strong><small>{b.note}</small></button>)}</div></section>
 <section className="yu-section yu-theme-section"><div className="yu-section-title"><h2>Or follow your curiosity</h2><Sparkles size={17}/></div><div className="yu-moods">{moods.map((m,i)=><button key={m} className={selection.theme===m?'selected':''} onClick={()=>{choose(selection.bookId,m);}}>{i===0&&<Sparkles size={13}/>} {themeLabel(m)}</button>)}</div></section>
 <button className="yu-surprise" onClick={()=>{const b=choices[Math.floor(Math.random()*(choices.length-1))];choose(b.id,moods[Math.floor(Math.random()*(moods.length-1))]);}}><span><Feather size={24}/></span><div><strong>Surprise me with a story</strong><small>Let chance turn the first page</small></div><ArrowRight size={19}/></button>
 <div className="yu-generation-note"><Sparkles size={13}/><p>Stories, illustrations, and words are generated by AI for your reading.</p></div>
 {loading?<p className="yu-inline-status" role="status">Opening the book…</p>:loadError?<div className="yu-inline-status" role="alert">{loadError}<button onClick={()=>location.reload()}>Reload</button></div>:null}
 </>:tab==='shelf'?<ReaderShelf onControl={gen.control} controlBusy={gen.controlBusy} stories={shelf} pending={pendingStories} sessions={gen.sessions} progress={activeProgress} refreshing={shelfRefreshing||gen.libraryRefreshing} onRefresh={()=>{void refreshShelf();}} loading={loading||gen.libraryLoading} error={loadError||gen.libraryError} tab={shelfTab} onTab={changeShelfTab} query={shelfQuery} onQuery={changeShelfQuery} grouping={shelfGrouping} onGrouping={changeShelfGrouping} bookName={bookName} onOpen={open} onResume={session=>openWorkflow(session.id)} onRetry={session=>{setWorkflowTarget(session.id);setWorkflowError('');setStory(null);gen.retrySession(session.id).catch(e=>setWorkflowError(e.message));}} onDelete={askDelete} onFavorite={favoriteFromShelf} favoriteBusy={favoriteBusy} onCreate={()=>choose()} onDiscover={()=>setTab('discover')}/>:<section className="yu-profile" aria-label="My space">
  <section className="yu-profile-group" aria-labelledby="profile-overview"><h2 id="profile-overview">Story overview</h2>
  <div className="yu-profile-stats"><div><strong>{shelfCount}</strong><span>Stories on your shelf</span></div><div><strong>{favoriteCount}</strong><span>Favorites</span></div><div><strong>{deletedStories.length}</strong><span>Deleted</span></div></div>
  </section>
  <section className="yu-profile-group" aria-labelledby="profile-stories"><h2 id="profile-stories">Manage stories</h2><div className="yu-preferences">
   <button onClick={()=>setPublicationDefaultsOpen(true)}><Feather size={20}/>Credits and reuse<ChevronRight size={18}/></button>
   <button onClick={()=>{setRecoveryOpen(true);void loadDeletedStories();}}><Trash2 size={20}/>Deleted stories<ChevronRight size={18}/></button>
  </div></section>
  <section className="yu-profile-group" aria-labelledby="profile-preferences"><h2 id="profile-preferences">Preferences and services</h2><div className="yu-preferences">
   <button onClick={()=>setSettings(true)}><Settings2 size={20}/>Reading preferences<ChevronRight size={18}/></button>
   <ProviderSettings onRuntime={setProviderRuntime}/>
  </div></section>
  <ProviderRuntimeSummary runtime={providerRuntime}/>
 </section>}
 </main>
 <nav className="yu-tabbar" aria-label="Main navigation">{[{id:'discover',title:"Discover",Icon:Compass},{id:'shelf',title:"Shelf",Icon:BookOpen},{id:'me',title:"My space",Icon:UserRound}].map(({id,title,Icon})=><button key={id} className={tab===id?'active':''} aria-current={tab===id?'page':undefined} onClick={()=>{setTab(id);window.scrollTo({top:0,behavior:'instant'});}}><Icon size={22} strokeWidth={tab===id?2:1.6}/><span>{title}</span>{tab===id&&<i/>}</button>)}</nav>
 </>}
 {configure&&<Sheet title="How would you like to read this story?" busy={creating} onClose={()=>{setConfigure(false);setDiscoveryTarget(null);}}><StoryDiscoveryForm selection={selection} books={choices} busy={creating} error={unavailable} onBookChange={bookId=>setSelection(old=>({...old,bookId,storyTitle:undefined,source:undefined,discoverySources:undefined}))} onSubmit={generate}/></Sheet>}

 {reselectTarget&&<StoryReselection key={reselectTarget} parentId={reselectTarget} onSubmitted={next=>finishReselection(next)} onCancelled={(next,error)=>{if(next)finishReselection(next,true);else{reselectLock.current=false;setReselectTarget(null);backToShelf();void gen.refreshLibrary().catch(()=>{});if(error)notify(error);}}}/>}
 {panelOpen&&!configure&&<StorySettingsPanel
  story={panelStory} session={workflowSession} busy={gen.setupBusy||revision.busy||creating} disabled={creating}
  onClose={()=>{setSettings(false);closeWorkflow();}} onBack={backToShelf}
  onRename={workflowSession||isGenerated(panelStory)?(id,title)=>setRenameTarget({id,title}):undefined}
  downloads={(['pdf','png','zip'] as const).map(format=>exportControl(format,'yu-settings-download',panelStory))}
  exportStatus={exportProgress} exporting={!!exporting} onPublicationEdit={isGenerated(panelStory)?()=>setPublicationTarget(panelStory):undefined}
  workflow={workflowSession||workflowTarget?workflowContent:undefined}
 />}

 {reviewHistoryId&&<Sheet title="Review history" onClose={()=>setReviewHistoryId(null)}><StoryReviewHistory key={reviewHistoryId} sessionId={reviewHistoryId}/></Sheet>}
 {source&&(story||gen.active)&&<Sheet title="Story source" onClose={()=>setSource(false)}>{story?<><StorySource key={story.id} story={story} book={bookName(story)}/><StoryPublicationDetails story={story}/></>:<StorySource key={gen.active!.id} sessionId={gen.active!.id} book={bookName({id:gen.active!.id,bookId:gen.active!.selection.bookId})}/>}</Sheet>}
 {sceneList&&story&&<Sheet title="Scene list" onClose={()=>setSceneList(false)}><StorySceneList story={story} page={page} onSelect={index=>{goToPage(index);setSceneList(false);}}/></Sheet>}
 {script&&scriptStory&&<Sheet title="Storyboard script" onClose={()=>setScript(false)}>{isGenerated(scriptStory)&&<button type="button" className="yu-revision-open" onClick={()=>revision.open('script')}>Edit storyboard</button>}<StoryScript story={scriptStory} standalone/></Sheet>}
 {requirements&&story&&<Sheet title="Production instructions" onClose={()=>setRequirements(false)}>{isGenerated(story)&&<button type="button" className="yu-revision-open" onClick={()=>revision.open('requirements')}>Edit production instructions</button>}<section className="yu-saved-prompt" aria-label="Story production instructions"><h3>{story.title}</h3><p>{isGenerated(story)?(story.productionPrompt||"No custom production instructions were saved for this story."):"This sample has no custom reader instructions."}</p>{isGenerated(story)&&story.productionPrompt&&<small>Instructions used for generation are saved with this story.</small>}</section></Sheet>}
 {recoveryOpen&&<Sheet title="Deleted stories" onClose={()=>{if(!restoring)setRecoveryOpen(false);}}><DeletedStories items={deletedStories} loading={recoveryLoading} error={recoveryError} busy={restoring} onRestore={item=>void restoreStory(item)} onRetry={()=>void loadDeletedStories()}/></Sheet>}
 {undoTarget&&!recoveryOpen&&<div className="yu-undo-notice" role="status"><div><span>Deleted “{undoTarget.title}”</span>{recoveryError&&<small role="alert">{recoveryError}</small>}</div><button type="button" disabled={!!restoring} onClick={()=>void restoreStory(undoTarget)}><RotateCcw size={17}/>{restoring?"Restoring…":"Undo deletion"}</button><button type="button" className="yu-undo-dismiss" aria-label="Dismiss undo notice" disabled={!!restoring} onClick={()=>setUndoTarget(null)}><X size={18}/></button></div>}
 {deleteTarget&&<Sheet title="Delete this story?" onClose={()=>{if(!deleting)setDeleteTarget(null);}}><div className="yu-delete-confirm"><h3>{deleteTarget.title}</h3><p>Removes it from Discover, your shelf, and favorites. Story files and reading progress are kept. Undo the deletion or restore it in My space → Deleted stories.</p>{deleteError&&<p role="alert">{deleteError}</p>}<div><button className="yu-delete-cancel" disabled={deleting} onClick={()=>setDeleteTarget(null)}>Keep story</button><button className="yu-delete-submit" disabled={deleting} onClick={deleteStory}>{deleting?"Deleting…":"Delete story"}</button></div></div></Sheet>}
 {gen.controlError&&<div className="yu-toast" role="alert">{gen.controlError}</div>}
 {settings&&!story&&!workflowTarget&&!gen.active&&<Sheet title="Reading comfort" onClose={()=>setSettings(false)}><div className="yu-setting-row"><div><strong>Larger text</strong><p>Make illustration captions easier to read</p></div><button className={'yu-switch '+(largeText?'on':'')} role="switch" aria-checked={largeText} aria-label="Larger text" onClick={()=>{setLargeText(!largeText);localStorage.setItem('yiyu-large-text',largeText?'0':'1');}}><i/></button></div></Sheet>}

 {revision.tab&&<Sheet title="Edit story" busy={revision.busy} onClose={()=>{if(!revision.busy)revision.setTab(null);}}><StoryRevisionEditor editor={revision} reviewIssues={revisionSession?.reviewIssues} resuming={revisionResuming} onDone={workflowTarget||settings||revisionResuming?()=>revision.setTab(null):undefined}/></Sheet>}
 {publicationDefaultsOpen&&<StoryPublicationDefaults onClose={()=>setPublicationDefaultsOpen(false)} onSaved={()=>notify("Defaults saved. Exports use them for any story fields left blank.")}/>}
 {publicationTarget&&<StoryPublicationEditor key={publicationTarget.id} story={publicationTarget} onClose={()=>setPublicationTarget(null)} onSave={async(value,expected)=>{
  await gen.savePublication(publicationTarget.id,value,expected);notify("Credits and reuse information saved.");
 }}/>}
 {renameTarget&&<StoryTitleEditor key={renameTarget.id} title={renameTarget.title} onClose={()=>setRenameTarget(null)} onSave={async title=>{
  await gen.renameTitle(renameTarget.id,title);
  setPdfDownload(value=>value?.storyId===renameTarget.id?null:value);setPngDownload(value=>value?.storyId===renameTarget.id?null:value);setZipDownload(value=>value?.storyId===renameTarget.id?null:value);
  notify("Story title saved.");
 }}/>}
 {toast&&<div className="yu-toast" role="status"><Check size={16}/>{toast}</div>}
 </div></div>;
}
