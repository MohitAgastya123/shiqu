// English interface: labels, accessibility text, and workflow messages use English.
// Save a display name independently of the story revision and production flows.
import {useRef,useState} from 'react';
import {displayTitleSchema} from '@/lib/reader-model';
import Sheet from './StorySheet';

export default function StoryTitleEditor({title,onSave,onClose}:{title:string;onSave:(title:string)=>Promise<void>;onClose:()=>void}){
 const [name,setName]=useState(title),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const lock=useRef(false);
 const parsed=displayTitleSchema.safeParse(name);
 async function save(){
  if(lock.current||!parsed.success||parsed.data===title)return;
  lock.current=true;setBusy(true);setError('');
  try{await onSave(parsed.data);onClose();}
  catch(e){setError(e instanceof Error?e.message:"Story title was not saved. Try again.");}
  finally{lock.current=false;setBusy(false);}
 }
 return <Sheet title="Edit story title" busy={busy} onClose={onClose}>
  <form onSubmit={event=>{event.preventDefault();void save();}}>
   <label className="yu-custom-input">Story title<input autoFocus maxLength={160} value={name} disabled={busy} onChange={event=>{setName(event.target.value);setError('');}}/></label>
   <p className="yu-count-help">Up to 160 characters. Saving updates the story title.</p>
   {error&&<p role="alert">{error}</p>}
   <div className="yu-revision-buttons"><button type="submit" className="yu-primary" disabled={busy||!parsed.success||parsed.data===title}>{busy?"Saving…":"Save story title"}</button><button type="button" disabled={busy} onClick={onClose}>Cancel</button></div>
  </form>
 </Sheet>;
}
