// Search full originals on the server; debounce typing and discard stale results without dropping the chosen receipt.
import {useEffect,useState} from 'react';
import type {LocalSourceReference} from '@/lib/reader-local-contract';
import {localSourceKey} from '@/lib/reader-source-key';
import type {BookContents,BookContentEntry} from '@/lib/reader-contents';
import {request} from './shared';
export default function StoryChapterPicker({bookId,selected,sources,disabled,onSelect}:{bookId:string;selected?:string;sources:LocalSourceReference[];disabled:boolean;onSelect:(entry:BookContentEntry)=>void}){
 const [contents,setContents]=useState<BookContents|null>(null),[error,setError]=useState(''),[query,setQuery]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{
  let live=true;setContents(null);setError('');
  const timer=setTimeout(()=>{
   request('reader/books/'+encodeURIComponent(bookId)+'/contents?q='+encodeURIComponent(query)).then(value=>{if(live)setContents(value);}).catch(e=>{if(live)setError(e instanceof Error?e.message:'目录暂未加载，请重试。');});
  },query.trim()?200:0);
  return()=>{live=false;clearTimeout(timer);};
 },[bookId,query,retry]);
 const entries=contents?.bookId===bookId?contents.entries:[];
 const isSelected=(entry:BookContentEntry)=>selected===entry.id||!!entry.source&&sources.some(source=>localSourceKey(source)===localSourceKey(entry.source!));
 return <section className="yu-source-picker" aria-label="选择故事或章节">
  {!!sources.length&&<p className="yu-candidate-count">已选 {sources.length} 段原文（最多24段），将从这些原文提取故事。</p>}
  <label className="yu-custom-input">搜索故事或章节<input type="search" maxLength={200} value={query} disabled={disabled} placeholder="如：黄忠 定军山（空格分隔）" onChange={e=>setQuery(e.target.value)}/></label>
  {error?<div role="alert"><p>{error}</p><button type="button" disabled={disabled} onClick={()=>setRetry(n=>n+1)}>重试加载目录</button></div>:!contents?<p role="status">{query.trim()?'正在搜索原文…':'正在加载目录…'}</p>:<>
   <p className="yu-candidate-count" role="status">{entries.length?`${entries.length} 项${selected||sources.length?' · 已选内容保留':''}`:'没有匹配的故事或章节，请换个关键词。'}</p>
   <div className="yu-source-entries">{entries.map(entry=>{
    const selectedEntry=isSelected(entry),locked=disabled||!entry.source||entry.kind==='chapter'&&sources.length>=24&&!selectedEntry;
    const details=<><strong>{entry.title}</strong>{entry.chapter!==entry.title&&<small>{entry.chapter}</small>}<span>{entry.excerpt}</span>{entry.unavailable&&<small>{entry.unavailable}</small>}</>;
    return entry.kind==='chapter'?<label key={entry.id} className={'yu-source-chapter'+(selectedEntry?' selected':'')}><input type="checkbox" aria-label={entry.title} checked={selectedEntry} disabled={locked} onChange={()=>onSelect(entry)}/><span className="yu-source-chapter-copy">{details}</span></label>:<button type="button" key={entry.id} className={selectedEntry?'selected':''} aria-pressed={selectedEntry} disabled={locked} onClick={()=>onSelect(entry)}>{details}{selectedEntry&&<b>已选这篇</b>}</button>;
   })}</div>
  </>}
 </section>;
}
