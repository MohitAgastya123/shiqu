// Edit the extraction target beside its results; typing stays local until an explicit search command.
import {useEffect,useState} from 'react';
import './story-discovery.css';

export default function StoryExtractionSearch({sessionId,title,local,busy,searching,onSearch}:{sessionId:string;title?:string;local:boolean;busy:boolean;searching:boolean;onSearch:(title:string)=>Promise<boolean>}){
 const [draft,setDraft]=useState(title||'');
 const [mode,setMode]=useState<'auto'|'input'>(title?'input':'auto');
 useEffect(()=>{setDraft(title||'');setMode(title?'input':'auto');},[sessionId,title]);
 const target=draft.trim();
 const invalid=busy||mode==='input'&&(!local||!target);
 return <form className="yu-extraction-query" aria-label="故事提取条件" onSubmit={event=>{event.preventDefault();if(!invalid)void onSearch(mode==='input'?target:'');}}>
  <div className="yu-choice-label">标题方式</div>
  <div className="yu-options" role="group" aria-label="标题方式"><button type="button" disabled={busy} aria-pressed={mode==='auto'} className={mode==='auto'?'selected':''} onClick={()=>setMode('auto')}>自动标题</button><button type="button" disabled={busy||!local} aria-pressed={mode==='input'} className={mode==='input'?'selected':''} onClick={()=>setMode('input')}>输入标题</button></div>
  {mode==='input'&&<label className="yu-custom-input">故事标题<input disabled={busy||!local} required maxLength={100} value={draft} placeholder="例如：宋公明三败高俅" onChange={event=>setDraft(event.target.value)}/></label>}
  <p className="yu-choice-footnote">{mode==='input'?'按输入标题核对完整故事；主题用于讲述重点。':'从所选原文中寻找故事，并自动生成标题。'}</p>
  <button type="submit" className="yu-primary yu-discovery-submit" disabled={invalid} aria-busy={busy}>{busy?'正在保存查找条件…':mode==='input'?'按标题提取':'开始提取'}</button>
  {searching&&<p className="yu-choice-footnote">可以修改标题并重新提取，新结果会替换当前候选。</p>}
 </form>;
}
