// Edit the extraction target beside its results; typing stays local until an explicit search command.
import {useEffect,useState} from 'react';
import './story-discovery.css';

export default function StoryExtractionSearch({sessionId,title,local,busy,searching,onSearch}:{sessionId:string;title?:string;local:boolean;busy:boolean;searching:boolean;onSearch:(title:string)=>Promise<boolean>}){
 const [draft,setDraft]=useState(title||'');
 useEffect(()=>setDraft(title||''),[sessionId,title]);
 const target=draft.trim();
 return <form className="yu-extraction-query" aria-label="故事提取条件" onSubmit={event=>{event.preventDefault();if(!busy)void onSearch(target);}}>
  <label className="yu-custom-input">故事标题（可选）<input disabled={busy||!local} maxLength={100} value={draft} placeholder="例如：宋公明三败高俅" onChange={event=>setDraft(event.target.value)}/></label>
  <p className="yu-choice-footnote">{local?'填写或修改标题后，点击按钮按标题提取；留空则按当前主题和原文范围自动发现。':'自选书籍按当前主题自动发现；按标题核对需要选择书库中的书。'}</p>
  <button type="submit" className="yu-primary yu-discovery-submit" disabled={busy} aria-busy={busy}>{busy?'正在保存查找条件…':target?'按标题提取':'自动提取故事'}</button>
  {searching&&<p className="yu-choice-footnote">可以修改标题并重新提取，新结果会替换当前候选。</p>}
 </form>;
}
