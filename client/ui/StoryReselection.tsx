// English interface: labels, accessibility text, and workflow messages use English.
// Keep the current book visible while a separate, off-shelf draft discovers replacements.
// Only choosing commits; cancel reads the authoritative family without restarting old work.
import {useEffect,useRef,useState} from 'react';
import {request,randomId} from './shared';
import Sheet from './StorySheet';
import StoryCreationSetup from './StoryCreationSetup';
import type {SessionView} from '@/lib/reader-model';
import type {IntakeCommand} from '@/lib/reader-intake';
import type {ProductionSettings} from './StoryProductionEditor';
import {readerBooks} from '@/lib/reader-books';
import {observeStoryGeneration} from '@/lib/reader-production-client';

export default function StoryReselection({parentId,onSubmitted,onCancelled}:{parentId:string;onSubmitted:(session:SessionView)=>void;onCancelled:(session:SessionView|null,error?:string)=>void}){
 const [draft,setDraft]=useState<SessionView|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const openId=useRef(randomId()),closed=useRef(false),lock=useRef(false);
 const pending=useRef<{signature:string;body:unknown}|null>(null);
 async function open(){
  setLoading(true);setError('');
  try{const s:SessionView=await request(`reader/sessions/${parentId}/reselection`,'POST',{requestId:openId.current});if(!closed.current){if(s.reselection)setDraft(s);else{closed.current=true;onSubmitted(s);}}}
  catch(e){if(!closed.current)setError(e instanceof Error?e.message:"Could not open story selection.");}
  finally{if(!closed.current)setLoading(false);}
 }
 useEffect(()=>{closed.current=false;void open();return()=>{closed.current=true;};},[parentId]);
 useEffect(()=>{
  if(!draft?.id)return;
  let cancelled=false;
  void observeStoryGeneration({sessionId:draft.id,request,isActive:()=>!cancelled&&!closed.current,onSession:s=>setDraft(s),focus:{viewerId:randomId(),page:()=>0},watchChoices:true}).then(message=>{if(!cancelled&&!closed.current&&message)setError(message);});
  return()=>{cancelled=true;};
 },[draft?.id]);
 async function act(action:IntakeCommand){
  if(!draft?.intake||lock.current)return;
  const signature=JSON.stringify([draft.id,action]);
  if(pending.current?.signature!==signature)pending.current={signature,body:{...action,requestId:randomId(),generation:draft.intake.generation}};
  lock.current=true;setBusy(true);setError('');
  try{const s:SessionView=await request(`reader/sessions/${draft.id}/setup`,'POST',pending.current.body);pending.current=null;if(!closed.current)setDraft(s);}
  catch(e){setError(e instanceof Error?e.message:"Search did not complete. Try again.");throw e;}
  finally{lock.current=false;setBusy(false);}
 }
 async function replace(batch:number,index:number,settings:ProductionSettings){
  if(!draft||lock.current)return;
  const signature=JSON.stringify([draft.id,batch,index,settings]);
  if(pending.current?.signature!==signature)pending.current={signature,body:{requestId:randomId(),batch,index,settings:{artStyle:settings.artStyle,productionPrompt:settings.productionPrompt,acceptancePrompt:settings.acceptancePrompt,narrativeDetail:settings.narrativeDetail}}};
  lock.current=true;setBusy(true);setError('');
  try{const next:SessionView=await request(`reader/sessions/${parentId}/reselection/${draft.id}`,'POST',pending.current.body);pending.current=null;closed.current=true;onSubmitted(next);}
  catch(e){setError(e instanceof Error?e.message:"Replacement did not complete. Your draft and previous results are kept.");}
  finally{lock.current=false;setBusy(false);}
 }
 async function cancel(){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{
   let current:SessionView;
   try{current=await request(`reader/sessions/${parentId}/reselection/${draft?.id||openId.current}`,'DELETE');}
   catch(e){if((e as {status?:number}).status!==404)throw e;current=await request(`reader/sessions/${parentId}/current`);}
   closed.current=true;onCancelled(current);
  }catch(e){
   const status=(e as {status?:number}).status;
   if(status===404||status===403){closed.current=true;onCancelled(null,"This story was deleted or is unavailable.");}
   else setError("Could not read the latest status. Try canceling again; the previous snapshot will not be restored.");
  }finally{lock.current=false;setBusy(false);}
 }
 return <Sheet title="Replace story selection" busy={busy} onClose={()=>void cancel()}>
  <p className="yu-sheet-intro">Keep one shelf card and preserve earlier results in history. Selection prepares the source before production confirmation. The current pause state is kept.</p>
  {loading?<p role="status">Opening story selection…</p>:draft?<StoryCreationSetup session={draft} book={readerBooks.find(book=>book.id===draft.selection.bookId)?.title||draft.selection.customBook||'Custom book'} busy={busy} onAction={act} onReplace={replace} progress={{busy:false,controlBusy:busy,error:'',onControl:async()=>{},onRetry:()=>{},onBack:()=>void cancel()}}/>:<button type="button" onClick={()=>void open()}>Reopen story selection</button>}
  {error&&<p role="alert">{error}</p>}
  <button type="button" disabled={busy} onClick={()=>void cancel()}>Cancel replacement</button>
 </Sheet>;
}
