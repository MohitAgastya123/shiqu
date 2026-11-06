// English interface: labels, accessibility text, and workflow messages use English.
// Choose original scope before theme; restore saved source receipts when returning from extraction.
import {themeLabel} from '../english-labels';
import {useState} from 'react';
import {ArrowRight} from 'lucide-react';
import type {Selection} from '@/lib/reader-model';
import type {LocalSourceReference} from '@/lib/reader-local-contract';
import {localSourceKey} from '@/lib/reader-source-key';
import type {BookContentEntry} from '@/lib/reader-contents';
import {promptAfterThemeChange} from '@/lib/reader-prompts';
import StoryChapterPicker from './StoryChapterPicker';
import './story-discovery.css';

export const discoveryThemes=['给我一个反转','人情冷暖','放下执念','聪明与糊涂','善意与误解','命运与选择','欲望与代价','勇气与成长','爱情与错过','幽默与讽刺','因果与报应','其他'];
export default function StoryDiscoveryForm({selection,books,busy,error,onBookChange,onSubmit}:{selection:Selection;books:{id:string;title:string}[];busy:boolean;error:string;onBookChange:(bookId:string)=>void;onSubmit:(selection:Selection)=>Promise<void>}){
 const custom=selection.theme!=='原典故事'&&!discoveryThemes.includes(selection.theme);
 const [draft,setDraft]=useState({...selection,theme:custom?'其他':selection.theme});
 const [sources,setSources]=useState<LocalSourceReference[]>(selection.discoverySources||[]),[limited,setLimited]=useState(!!selection.discoverySources?.length);
 const [rangeOpen,setRangeOpen]=useState(false);
 const [customTheme,setCustomTheme]=useState(custom?selection.theme:'');
 const local=draft.bookId!=='other';
 function changeBook(bookId:string){
  setDraft(old=>({...old,bookId,storyTitle:undefined,source:undefined,discoverySources:undefined}));
  setSources([]);setLimited(false);setRangeOpen(false);onBookChange(bookId);
 }
 function select(entry:BookContentEntry){
  if(entry.kind==='chapter'){
   setDraft(old=>({...old,storyTitle:undefined,source:undefined}));
   setSources(old=>old.some(chapter=>localSourceKey(chapter)===localSourceKey(entry.source!))?old.filter(chapter=>localSourceKey(chapter)!==localSourceKey(entry.source!)):old.length<24?[...old,entry.source!]:old);
  }else{setSources([]);setDraft(old=>({...old,storyTitle:entry.title,source:entry.source}));}
 }
 const theme=draft.theme==='其他'?customTheme.trim():draft.theme;
 const rangeSummary=sources.length?`Selected ${sources.length} source sections`:draft.source?`Selected passage: ${draft.storyTitle}`:"Choose source chapters or story passages";
 const invalid=draft.bookId==='other'&&!draft.customBook?.trim()||draft.theme==='其他'&&!theme||limited&&!draft.source&&!sources.length;
 async function submit(){
  if(busy||invalid)return;
  await onSubmit({...draft,discovery:{mode:'auto'},theme:theme||'原典故事',storyTitle:undefined,source:undefined,discoverySources:limited?(sources.length?sources:draft.source?[draft.source]:undefined):undefined,length:'auto',voice:false});
 }
 return <>
  <p className="yu-sheet-intro">Theme and source scope are optional. You can search by title in the story discovery window.</p>
  <div className="yu-choice-label">Which book will you begin with?</div>
  <div className="yu-options" role="group" aria-label="Choose book">{books.map(book=><button type="button" key={book.id} disabled={busy} aria-pressed={draft.bookId===book.id} className={draft.bookId===book.id?'selected':''} onClick={()=>changeBook(book.id)}>{book.title}</button>)}</div>
  {!local&&<label className="yu-custom-input">Book title or public webpage URL<input disabled={busy} maxLength={500} value={draft.customBook||''} placeholder="Example: a book title, or https://…" onChange={event=>setDraft(old=>({...old,customBook:event.target.value}))}/></label>}
  {local&&<><div className="yu-choice-label">Source scope (optional)</div><div className="yu-options" role="group" aria-label="Source scope"><button type="button" disabled={busy} aria-pressed={!limited} className={!limited?'selected':''} onClick={()=>{setLimited(false);setRangeOpen(false);}}>Automatic</button><button type="button" disabled={busy} aria-pressed={limited} className={limited?'selected':''} onClick={()=>{setLimited(true);setRangeOpen(true);}}>Choose chapters or existing story passages</button></div>{limited&&<details className="yu-scope-selection" open={rangeOpen} onToggle={event=>setRangeOpen(event.currentTarget.open)}><summary>{rangeSummary}<span>{rangeOpen?"Collapse":"Click to edit"}</span></summary><StoryChapterPicker key={draft.bookId} bookId={draft.bookId} selected={draft.source?.firstUnit} sources={sources} disabled={busy} onSelect={select}/><button type="button" className="yu-scope-complete" disabled={busy||!draft.source&&!sources.length} onClick={()=>setRangeOpen(false)}>Done choosing source</button></details>}</>}
  <div className="yu-choice-label">Theme (optional)</div>
  <div className="yu-options" role="group" aria-label="Story theme">{['原典故事',...discoveryThemes].map(value=><button type="button" key={value} disabled={busy} aria-pressed={draft.theme===value} className={draft.theme===value?'selected':''} onClick={()=>setDraft(old=>({...old,theme:value,productionPrompt:promptAfterThemeChange(old.productionPrompt,old.theme==='其他'?customTheme:old.theme,value)}))}>{value==='原典故事'?"Any theme":themeLabel(value)}</button>)}</div>
  {draft.theme==='其他'&&<label className="yu-custom-input">Enter a theme to explore<input disabled={busy} maxLength={100} value={customTheme} placeholder="Example: How kind people maintain their boundaries" onChange={event=>setCustomTheme(event.target.value)}/></label>}
  <p className="yu-choice-footnote">Find stories by theme, or choose “Any theme” to explore freely.</p>
  <button type="button" className="yu-primary yu-discovery-submit" disabled={busy||!!invalid} onClick={()=>void submit()}>{busy?"Saving task…":"Find stories"}<ArrowRight size={19}/></button>
  <p className="yu-choice-footnote">“{local?books.find(book=>book.id===draft.bookId)?.title:draft.customBook||"Custom book"}” · {limited?(sources.length?`Selected ${sources.length} source sections`:`Selected passage: ${draft.storyTitle||"Not selected"}`):"Automatic"}{theme&&theme!=='原典故事'?` · ${themeLabel(theme)}`:''}</p>
  {error&&<div className="yu-unavailable" role="alert"><strong>Task not saved</strong><p>{error}</p></div>}
 </>;
}
