// English interface: labels, accessibility text, and workflow messages use English.
// Resolve saved source receipts through the book directory so reopened and replacement pickers name the originals.
import {themeLabel} from '../english-labels';
import {useEffect,useState} from 'react';
import type {Selection} from '@/lib/reader-model';
import type {BookContents,BookContentEntry} from '@/lib/reader-contents';
import {localSourceKey} from '@/lib/reader-source-key';
import {request} from './shared';
import './story-discovery.css';

export default function StoryExtractionContext({selection,book}:{selection:Selection;book:string}){
 const sources=selection.discoverySources||[],bookId=selection.bookId==='other'?selection.customBook||selection.bookId:selection.bookId;
 const key=JSON.stringify([bookId,...sources.map(localSourceKey)]);
 const [loaded,setLoaded]=useState<{key:string;entries:BookContentEntry[];error?:string}|null>(null),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!sources.length)return;
  let live=true;
  request('reader/books/'+encodeURIComponent(bookId)+'/contents').then((contents:BookContents)=>{
   const directory=new Map(contents.entries.filter(entry=>entry.source).map(entry=>[localSourceKey(entry.source!),entry]));
   const entries=sources.flatMap(source=>{const entry=directory.get(localSourceKey(source));return entry?[entry]:[];});
   if(live)setLoaded({key,entries,...(entries.length!==sources.length?{error:"Some selected source text has changed. Go back and verify the source scope."}:{})});
  }).catch(()=>{if(live)setLoaded({key,entries:[],error:"Could not load the selected source titles. Try again."});});
  return()=>{live=false;};
 },[key,retry]);
 const current=loaded?.key===key?loaded:null;
 return <section className="yu-extraction-context" aria-label="Selected source and theme">
  <p className="yu-extraction-book">“{book}”</p>
  <dl><dt>Source scope</dt><dd>{!sources.length?"Automatic (no chapter or passage limit)":!current?<span role="status">Loading selected source…</span>:<>
   {!!current.entries.length&&<ul>{current.entries.map(entry=><li key={entry.id}><strong>{entry.title}</strong>{entry.kind==='story'&&<p>{entry.excerpt}</p>}</li>)}</ul>}
   {current.error&&<div role="status"><p>{current.error}</p><button type="button" className="yu-context-retry" onClick={()=>setRetry(value=>value+1)}>Reload source titles</button></div>}
  </>}</dd><dt>Theme</dt><dd>{selection.theme==='原典故事'?"Any theme":themeLabel(selection.theme)}</dd></dl>
 </section>;
}
