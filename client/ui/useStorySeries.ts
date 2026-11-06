// Read imported sources and ordered comic series without commissioning work during polling.
// Retain write identities across lost replies; local plan updates never request model inference.
import {useEffect,useRef,useState} from 'react';
import {request,randomId} from './shared';
import {defaultStoryImportSettings,storyImportLimits,storyImportTitleSchema,storyImportSettingsSchema,storySeriesCreateSchema} from '@/lib/story-import-contract';
import type {ImportedSourceView,StoryImportPlan,StoryImportResult,StoryImportSettings,StorySeriesView,StorySeriesControl,StorySeriesCreate} from '@/lib/story-import-contract';
import {keepSnapshot,shareRows} from '@/lib/reader-snapshots';

const message=(error:unknown,fallback:string)=>error instanceof Error?error.message:fallback;
const signature=(sourceId:string,title:string,settings:StoryImportSettings)=>JSON.stringify([sourceId,title.trim(),settings]);
const sourceTitle=(fileName:string)=>fileName.replace(/\.(docx|pdf)$/i,'').slice(0,140).trim()||'My story';
const uploadKey='shiqu-import-pending-upload',creationKey='shiqu-import-pending-create',draftKeyName='shiqu-import-draft';
function readSaved(key:string):unknown{try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}}
function save(key:string,value:unknown){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify(value));}catch{/* In-memory identities still protect retries during this visit. */}}
const rejected=(error:unknown)=>{const status=(error as {status?:number}).status;return status!==undefined&&status>=400&&status<500;};
export function useStorySeries(watch=false){
 const [items,setItems]=useState<StorySeriesView[]>([]),[active,setActive]=useState<StorySeriesView|null>(null),[selectedId,setSelectedId]=useState('');
 const [source,setSource]=useState<ImportedSourceView|null>(null),[plan,setPlan]=useState<StoryImportPlan|null>(null),[title,setTitle]=useState(''),[settings,setSettings]=useState<StoryImportSettings>({...defaultStoryImportSettings});
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[error,setError]=useState(''),[listError,setListError]=useState(''),[planning,setPlanning]=useState(false),[planRetry,setPlanRetry]=useState(0),[previewBusy,setPreviewBusy]=useState(false);
 const alive=useRef(true),writeLock=useRef(false),listChanges=useRef(0),planAttempt=useRef(0),selectionAttempt=useRef(0),sourceAttempt=useRef(0);
 const uploaded=useRef<{key:string;requestId:string}|null>(null),creation=useRef<{key:string;body:StorySeriesCreate}|null>(null),controlCommand=useRef<{key:string;body:StorySeriesControl}|null>(null);
 const newestSource=useRef(source);newestSource.current=source;
 function collect(value:StorySeriesView){if(!alive.current)return;listChanges.current++;setItems(old=>shareRows(old,[value,...old.filter(item=>item.id!==value.id)],item=>item.id));setActive(old=>old?.id===value.id?keepSnapshot(old,value):old);}
 async function refresh(){
  const changes=listChanges.current;
  try{const rows:StorySeriesView[]=await request('reader/series');if(alive.current&&changes===listChanges.current){setItems(old=>shareRows(old,rows,item=>item.id));setActive(old=>old?rows.find(row=>row.id===old.id)||old:null);setListError('');}return rows;}
  catch(e){if(alive.current)setListError(message(e,'Could not refresh comic series. Try again.'));throw e;}
 }
 const refreshRef=useRef(refresh);refreshRef.current=refresh;
 async function openSource(id:string){
  const attempt=++sourceAttempt.current;setBusy('Opening source');setError('');
  try{const saved:ImportedSourceView=await request('reader/imports/'+encodeURIComponent(id));if(!alive.current||attempt!==sourceAttempt.current)return;
   const draft=readSaved(draftKeyName) as {sourceId?:string;title?:unknown;settings?:unknown}|null,savedTitle=storyImportTitleSchema.safeParse(draft?.title),savedSettings=storyImportSettingsSchema.safeParse(draft?.settings),restoring=draft?.sourceId===id&&savedTitle.success&&savedSettings.success;
   // A valid source remains available even when its current detail level exceeds the part limit.
   // The ordinary draft effect plans after displaying the saved preview and editable settings.
   setSource(saved);setPlan(null);setTitle(restoring?savedTitle.data:sourceTitle(saved.fileName));setSettings(restoring?savedSettings.data:{...defaultStoryImportSettings});
  }catch(e){if(alive.current&&attempt===sourceAttempt.current)setError(message(e,'Could not open this uploaded source.'));}
  finally{if(alive.current&&attempt===sourceAttempt.current)setBusy('');}
 }
 async function openSeries(id:string){
  const attempt=++selectionAttempt.current;setSelectedId(id);setActive(old=>old?.id===id?old:null);setError('');setBusy('Opening series');
  try{const saved:StorySeriesView=await request('reader/series/'+encodeURIComponent(id));if(!alive.current||attempt!==selectionAttempt.current)return;setActive(saved);collect(saved);return saved;}
  catch(e){if(alive.current&&attempt===selectionAttempt.current)setError(message(e,'Could not open this comic series.'));}
  finally{if(alive.current&&attempt===selectionAttempt.current)setBusy('');}
 }
 const openSourceRef=useRef(openSource),openSeriesRef=useRef(openSeries);openSourceRef.current=openSource;openSeriesRef.current=openSeries;
 useEffect(()=>{alive.current=true;void refreshRef.current().catch(()=>{}).finally(()=>{if(alive.current)setLoading(false);});const query=new URLSearchParams(location.search),importId=query.get('import'),seriesId=query.get('series');if(importId)void openSourceRef.current(importId);if(seriesId)void openSeriesRef.current(seriesId);return()=>{alive.current=false;planAttempt.current++;selectionAttempt.current++;sourceAttempt.current++;};},[]);
 useEffect(()=>{
  if(!watch&&!selectedId)return;let stopped=false,inFlight=false;
  async function update(){if(stopped||inFlight||document.visibilityState==='hidden')return;inFlight=true;try{await refreshRef.current();}catch{/* Keep saved series and expose a retry. */}finally{inFlight=false;}}
  const timer=setInterval(()=>void update(),selectedId?1500:4000);window.addEventListener('focus',update);return()=>{stopped=true;clearInterval(timer);window.removeEventListener('focus',update);};
 },[watch,selectedId]);
 useEffect(()=>{if(source&&storyImportTitleSchema.safeParse(title).success)save(draftKeyName,{sourceId:source.id,title,settings});},[source?.id,title,settings]);
 const draftKey=source?signature(source.id,title,settings):'',planKey=plan?signature(plan.sourceId,plan.title,plan.settings):'',planReady=!!source&&!!plan&&draftKey===planKey;
 useEffect(()=>{
  const attempt=++planAttempt.current;if(!source||!storyImportTitleSchema.safeParse(title).success||draftKey===planKey){setPlanning(false);return;}
  setPlanning(true);const timer=setTimeout(()=>{void request(`reader/imports/${encodeURIComponent(source.id)}/plan`,'POST',{title,settings}).then((value:StoryImportPlan)=>{if(alive.current&&attempt===planAttempt.current){setPlan(value);setError('');}}).catch(e=>{if(alive.current&&attempt===planAttempt.current)setError(message(e,'Could not update the automatic parts.'));}).finally(()=>{if(alive.current&&attempt===planAttempt.current)setPlanning(false);});},250);
  return()=>clearTimeout(timer);
 },[draftKey,planKey,planRetry]);
 async function upload(file:File){
  if(writeLock.current)return;setError('');
  if(!/\.(docx|pdf)$/i.test(file.name)){setError('Choose a Word (.docx) or PDF file. For an older .doc file, save it as .docx first.');return;}
  if(file.size>storyImportLimits.fileBytes){setError('This file is too large. Choose a Word or PDF file of 10 MB or less.');return;}
  if(!file.size){setError('This file is empty. Choose a document containing your story.');return;}
  const key=JSON.stringify([file.name,file.size,file.lastModified]);if(uploaded.current?.key!==key){const pending=readSaved(uploadKey) as {key?:string;requestId?:string}|null;uploaded.current={key,requestId:pending?.key===key&&typeof pending.requestId==='string'?pending.requestId:randomId()};}save(uploadKey,uploaded.current);
  writeLock.current=true;setBusy('Reading document');
  try{const form=new FormData();form.set('requestId',uploaded.current.requestId);form.set('file',file);const result:StoryImportResult=await request('reader/imports','POST',form);if(!alive.current)return;
   sourceAttempt.current++;planAttempt.current++;setSource(result.source);setPlan(result.plan);setTitle(result.plan?.title||sourceTitle(result.source.fileName));setSettings(result.plan?.settings||{...defaultStoryImportSettings});setError(result.planningError||'');uploaded.current=null;creation.current=null;save(uploadKey,null);
   try{history.replaceState(null,'','/?import='+result.source.id);}catch{}return result;
  }catch(e){if(rejected(e)){uploaded.current=null;save(uploadKey,null);}if(alive.current)setError(message(e,'The document could not be read. Your previous upload is kept.'));}
  finally{writeLock.current=false;if(alive.current)setBusy('');}
 }
 async function create(){
  if(writeLock.current||!source||!planReady)return;const checked=storyImportTitleSchema.safeParse(title);if(!checked.success){setError(checked.error.issues[0].message);return;}
  const key=signature(source.id,checked.data,settings);if(creation.current?.key!==key){const pending=storySeriesCreateSchema.safeParse(readSaved(creationKey));creation.current={key,body:pending.success&&signature(pending.data.sourceId,pending.data.title,pending.data.settings)===key?pending.data:{sourceId:source.id,title:checked.data,settings,requestId:randomId()}};}save(creationKey,creation.current.body);
  writeLock.current=true;setBusy('Creating comic series');setError('');
  try{const value:StorySeriesView=await request('reader/series','POST',creation.current.body);if(!alive.current)return;creation.current=null;save(creationKey,null);setActive(value);setSelectedId(value.id);collect(value);return value;}
  catch(e){if(rejected(e)){creation.current=null;save(creationKey,null);}if(alive.current)setError(message(e,'The comic series was not created. Try again.'));}
  finally{writeLock.current=false;if(alive.current)setBusy('');}
 }
 async function control(action:StorySeriesControl['action']){
  if(writeLock.current||!active)return;const key=JSON.stringify([active.id,active.version,action]);if(controlCommand.current?.key!==key)controlCommand.current={key,body:{requestId:randomId(),version:active.version,action}};
  writeLock.current=true;setBusy('Saving series action');setError('');
  try{const value:StorySeriesView=await request(`reader/series/${active.id}/control`,'POST',controlCommand.current.body);controlCommand.current=null;if(alive.current){setActive(value);collect(value);}return value;}
  catch(e){if((e as {status?:number}).status!==undefined){controlCommand.current=null;void openSeries(active.id);}if(alive.current)setError(message(e,'The series action was not saved. Refresh and try again.'));}
  finally{writeLock.current=false;if(alive.current)setBusy('');}
 }
 async function moreSource(){
  const saved=newestSource.current;if(!saved?.preview.hasMore||previewBusy)return;setPreviewBusy(true);
  try{const next:ImportedSourceView=await request(`reader/imports/${saved.id}?offset=${saved.preview.end}&limit=6000`);if(!alive.current||newestSource.current?.id!==saved.id)return;setSource(old=>old?.id===saved.id?{...next,preview:{...next.preview,start:old.preview.start,text:old.preview.text+next.preview.text}}:old);}
  catch(e){if(alive.current)setError(message(e,'Could not load the next source section.'));}finally{if(alive.current)setPreviewBusy(false);}
 }
 function closeSeries(){selectionAttempt.current++;setSelectedId('');setError('');}
 return {items,active,selectedId,source,plan,title,settings,loading,busy,error,listError,planning,previewBusy,planReady,setTitle,setSettings,upload,create,control,openSeries,openSource,refresh,moreSource,closeSeries,retryPlan:()=>{setError('');setPlanRetry(value=>value+1);},clearError:()=>setError('')};
}
