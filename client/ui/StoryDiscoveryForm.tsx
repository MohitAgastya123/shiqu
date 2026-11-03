// Keep the requested title, source scope and theme independent until the creation intent is saved.
// A filled title infers targeted extraction; every combination of title, theme and scope is optional.
import {useState} from 'react';
import {ArrowRight} from 'lucide-react';
import type {Selection} from '@/lib/reader-model';
import type {BookContentEntry} from '@/lib/reader-contents';
import {promptAfterThemeChange} from '@/lib/reader-prompts';
import StoryChapterPicker from './StoryChapterPicker';

export const discoveryThemes=['给我一个反转','人情冷暖','放下执念','聪明与糊涂','善意与误解','命运与选择','欲望与代价','勇气与成长','爱情与错过','幽默与讽刺','因果与报应','其他'];
export default function StoryDiscoveryForm({selection,books,busy,error,onSubmit}:{selection:Selection;books:{id:string;title:string}[];busy:boolean;error:string;onSubmit:(selection:Selection)=>Promise<void>}){
 const [draft,setDraft]=useState(selection);
 const [title,setTitle]=useState(selection.discovery?.mode==='title'?selection.discovery.title:'');
 const [chapters,setChapters]=useState<BookContentEntry[]>([]),[limited,setLimited]=useState(false);
 const [customTheme,setCustomTheme]=useState('');
 const local=draft.bookId!=='other',titleMode=local&&!!title.trim();
 function changeBook(bookId:string){
  setDraft(old=>({...old,bookId,storyTitle:undefined,source:undefined,discoverySources:undefined}));
  setChapters([]);setLimited(false);setTitle('');
 }
 function select(entry:BookContentEntry){
  if(entry.kind==='chapter'){
   setDraft(old=>({...old,storyTitle:undefined,source:undefined}));
   setChapters(old=>old.some(chapter=>chapter.id===entry.id)?old.filter(chapter=>chapter.id!==entry.id):old.length<24?[...old,entry]:old);
  }else{setChapters([]);setDraft(old=>({...old,storyTitle:entry.title,source:entry.source}));}
 }
 const theme=draft.theme==='其他'?customTheme.trim():draft.theme;
 const direct=limited&&!titleMode&&!!draft.source;
 const invalid=draft.bookId==='other'&&!draft.customBook?.trim()||draft.theme==='其他'&&!theme||limited&&!draft.source&&!chapters.length;
 async function submit(){
  if(busy||invalid)return;
  await onSubmit({...draft,discovery:titleMode?{mode:'title',title:title.trim()}:{mode:'auto'},theme:theme||'原典故事',storyTitle:direct?draft.storyTitle:undefined,source:direct?draft.source:undefined,discoverySources:limited?(chapters.length?chapters.map(chapter=>chapter.source!):titleMode&&draft.source?[draft.source]:undefined):undefined,length:'auto',voice:false});
 }
 return <>
  <p className="yu-sheet-intro">故事标题、主题、原文范围都可选，也可自由组合。都不填，就从书中自动发现故事。</p>
  <div className="yu-choice-label">从哪本书出发</div>
  <div className="yu-options" role="group" aria-label="选择书籍">{books.map(book=><button type="button" key={book.id} disabled={busy} aria-pressed={draft.bookId===book.id} className={draft.bookId===book.id?'selected':''} onClick={()=>changeBook(book.id)}>{book.title}</button>)}</div>
  {!local&&<label className="yu-custom-input">书名或公开网页 URL<input disabled={busy} maxLength={500} value={draft.customBook||''} placeholder="例如：三言二拍，或 https://…" onChange={event=>setDraft(old=>({...old,customBook:event.target.value}))}/></label>}
  <label className="yu-custom-input">故事标题（可选）<input disabled={busy||!local} maxLength={100} value={title} placeholder="例如：宋公明三败高俅" onChange={event=>setTitle(event.target.value)}/><small>{local?'填写后只提取指定故事；留空则自动发现。标题与主题分别生效。':'按标题核对需要选择书库中的书；自选书籍可按主题发现。'}</small></label>
  <div className="yu-choice-label">主题（可选）</div>
  <div className="yu-options" role="group" aria-label="故事主题">{['原典故事',...discoveryThemes].map(value=><button type="button" key={value} disabled={busy} aria-pressed={draft.theme===value} className={draft.theme===value?'selected':''} onClick={()=>setDraft(old=>({...old,theme:value,productionPrompt:promptAfterThemeChange(old.productionPrompt,old.theme==='其他'?customTheme:old.theme,value)}))}>{value==='原典故事'?'不限定主题':value}</button>)}</div>
  {draft.theme==='其他'&&<label className="yu-custom-input">写下想看的主题<input disabled={busy} maxLength={100} value={customTheme} placeholder="例如：善良的人如何守住底线" onChange={event=>setCustomTheme(event.target.value)}/></label>}
  <p className="yu-choice-footnote">{titleMode||direct?'主题用于讲述重点，不改变指定故事与原文情节。':'按主题筛选故事；选择“不限定主题”可自由发现。'}</p>
  {local&&<><div className="yu-choice-label">原文范围（可选）</div><div className="yu-options" role="group" aria-label="原文范围"><button type="button" disabled={busy} aria-pressed={!limited} className={!limited?'selected':''} onClick={()=>setLimited(false)}>整本书</button><button type="button" disabled={busy} aria-pressed={limited} className={limited?'selected':''} onClick={()=>setLimited(true)}>选择章节或已有故事段落</button></div>{limited&&<StoryChapterPicker key={draft.bookId} bookId={draft.bookId} selected={draft.source?.firstUnit} chapters={chapters} disabled={busy} onSelect={select}/>}</>}
  <button type="button" className="yu-primary" disabled={busy||!!invalid} onClick={()=>void submit()}>{busy?'正在保存任务…':titleMode?'按标题核对并提取':direct?'选择这篇并准备制作':'开始发现故事'}<ArrowRight size={19}/></button>
  <p className="yu-choice-footnote">《{local?books.find(book=>book.id===draft.bookId)?.title:draft.customBook||'自选书籍'}》 · {limited?(chapters.length?`已选 ${chapters.length} 章`:`已选段落：${draft.storyTitle||'待选择'}`):'整本书'}{theme&&theme!=='原典故事'?` · ${theme}`:''}</p>
  {error&&<div className="yu-unavailable" role="alert"><strong>任务暂未保存</strong><p>{error}</p></div>}
 </>;
}
