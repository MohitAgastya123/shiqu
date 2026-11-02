// Edit public attribution independently of generation; render notices as text, including untrusted credits.
import {useRef,useState} from 'react';
import type {Story} from '@/lib/content';
import {aiDisclosure,emptyPublication,publicationSchema,rightsBoundary} from '@/lib/story-publication';
import type {StoryPublication} from '@/lib/story-publication';
import Sheet from './StorySheet';
import './story-publication.css';

export function StoryPublicationDetails({story}:{story:Story}){
 const p=story.publication;
 return <section className="yu-publication" aria-label="署名与转载"><h3>署名与转载</h3><p>制作：{p?.author||'未署名'}</p><p>{aiDisclosure(story)}</p>{p?.workUrl&&<p>作品链接：{p.workUrl}</p>}{p?.contact&&<p>联系：{p.contact}</p>}{p?.sourceNote&&<p>来源与许可：{p.sourceNote}</p>}<p>转载与再使用：{p?.reuse||'未另行提供授权；请先核对来源许可，必要时联系相应权利人。'}</p><small>{rightsBoundary}</small></section>;
}

export default function StoryPublicationEditor({story,onSave,onClose}:{story:Story;onSave:(value:StoryPublication,expected:StoryPublication|null)=>Promise<void>;onClose:()=>void}){
 const [initial]=useState(story.publication??null),[draft,setDraft]=useState<StoryPublication>(story.publication||{...emptyPublication});
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const lock=useRef(false);
 const parsed=publicationSchema.safeParse(draft),changed=JSON.stringify(parsed.success?parsed.data:draft)!==JSON.stringify(initial||emptyPublication);
 async function save(){
  if(lock.current||!parsed.success||!changed)return;
  lock.current=true;setBusy(true);setError('');
  try{await onSave(parsed.data,initial);onClose();}catch(e){setError(e instanceof Error?e.message:'署名说明暂未保存，请重试。');}finally{lock.current=false;setBusy(false);}
 }
 function field(key:keyof StoryPublication,label:string,maxLength:number,multiline=false){
  const props={value:draft[key],maxLength,disabled:busy,onChange:(event:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>{setDraft(old=>({...old,[key]:event.target.value}));setError('');}};
  return <label className="yu-custom-input">{label}{multiline?<textarea rows={3} {...props}/>:<input {...props}/>}</label>;
 }
 return <Sheet title="署名与转载" onClose={onClose} busy={busy}><form className="yu-publication-editor" onSubmit={event=>{event.preventDefault();void save();}}>
  <p className="yu-count-help">这些信息会随作品和下载文件公开。填写用于公开展示的署名与联系方式。</p>
  {field('author','制作署名',80)}{field('workUrl','公开作品链接',1000)}{field('contact','公开联系方式',200)}{field('sourceNote','来源版本与许可说明',1200,true)}{field('reuse','转载与再使用条件',1200,true)}
  <p className="yu-count-help">原作出处和 AI 生成说明会自动保留。这里只声明你有权决定的部分；公版材料和已有许可按各自规则使用。保存不会重新生成故事。</p>
  {(!parsed.success||error)&&<p role="alert">{error||parsed.error?.issues[0].message}</p>}
  <div className="yu-revision-buttons"><button className="yu-primary" type="submit" disabled={busy||!parsed.success||!changed}>{busy?'正在保存…':'保存说明'}</button><button type="button" disabled={busy} onClick={onClose}>取消</button></div>
 </form></Sheet>;
}
