// English interface: labels, accessibility text, and workflow messages use English.
// Edit the extraction target with one contextual hint above its action; typing never starts a search.
import {useEffect,useState} from 'react';
import './story-discovery.css';

export default function StoryExtractionSearch({sessionId,title,local,busy,hasCandidates,onSearch}:{sessionId:string;title?:string;local:boolean;busy:boolean;hasCandidates:boolean;onSearch:(title:string)=>Promise<boolean>}){
 const [draft,setDraft]=useState(title||'');
 const [mode,setMode]=useState<'auto'|'input'>(title?'input':'auto');
 useEffect(()=>{setDraft(title||'');setMode(title?'input':'auto');},[sessionId,title]);
 const target=draft.trim();
 const invalid=busy||mode==='input'&&(!local||!target);
 return <form className="yu-extraction-query" aria-label="Story discovery criteria" onSubmit={event=>{event.preventDefault();if(!invalid)void onSearch(mode==='input'?target:'');}}>
  <div className="yu-choice-label">Title mode</div>
  <div className="yu-options" role="group" aria-label="Title mode"><button type="button" disabled={busy} aria-pressed={mode==='auto'} className={mode==='auto'?'selected':''} onClick={()=>setMode('auto')}>Automatic title</button><button type="button" disabled={busy||!local} aria-pressed={mode==='input'} className={mode==='input'?'selected':''} onClick={()=>setMode('input')}>Enter title</button></div>
  {mode==='input'&&<label className="yu-custom-input">Story title<input disabled={busy||!local} required maxLength={100} value={draft} placeholder="Example: Song Jiang's three victories over Gao Qiu" onChange={event=>setDraft(event.target.value)}/></label>}
  <p className="yu-extraction-help">{hasCandidates?"Searching again replaces the current candidates.":mode==='input'?"Find a complete story by title. The theme guides its emphasis.":"Find stories in the selected source and theme, with automatically suggested titles."}</p>
  <button type="submit" className="yu-primary yu-discovery-submit" disabled={invalid} aria-busy={busy}>{busy?"Saving search criteria…":mode==='input'?"Find by title":"Start discovery"}</button>
 </form>;
}
