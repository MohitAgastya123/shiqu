// English interface: labels, accessibility text, and workflow messages use English.
// Edit owner defaults and independent story snapshots; render public notices as untrusted text.
import {useEffect,useRef,useState} from 'react';
import type {Story} from '@/lib/content';
import {aiDisclosure,emptyPublication,hasPublicationAuthor,publicationSchema,rightsBoundary,watermarkFontSize,withPublicationDefaults} from '@/lib/story-publication';
import type {StoryPublication} from '@/lib/story-publication';
import Sheet from './StorySheet';
import {request} from './shared';
import './story-publication.css';

export function StoryPublicationDetails({story}:{story:Story}){
 const p=story.publication;
 return <section className="yu-publication" aria-label="Credits and reuse"><h3>Credits and reuse</h3><p>Created by: {p?.author||"Uncredited"}</p><p>{aiDisclosure(story)}</p>{p?.workUrl&&<p>Work link: {p.workUrl}</p>}{p?.contact&&<p>Contact: {p.contact}</p>}{p?.sourceNote&&<p>Source and license: {p.sourceNote}</p>}<p>Reuse and redistribution: {p?.reuse||"No additional permission granted. Check the source license and contact the rights holder if needed."}</p><small>{rightsBoundary}</small></section>;
}

export function StoryPublicationSummary({story,onEdit,disabled=false}:{story:Story;onEdit?:()=>void;disabled?:boolean}){
 const needsDefaults='generated'in story&&story.generated===true&&!hasPublicationAuthor(story.publication);
 const [current,setCurrent]=useState<{storyId:string;publication:StoryPublication|null;loading:boolean;error:boolean}>({storyId:'',publication:null,loading:true,error:false}),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!needsDefaults)return;
  let live=true,read=0;
  async function refresh(){
   const attempt=++read;setCurrent({storyId:story.id,publication:null,loading:true,error:false});
   try{
    const result=await request('reader/publication-defaults'),publication=result.publication===null?null:publicationSchema.parse(result.publication);
    if(live&&attempt===read)setCurrent({storyId:story.id,publication,loading:false,error:false});
   }catch{if(live&&attempt===read)setCurrent({storyId:story.id,publication:null,loading:false,error:true});}
  }
  const focus=()=>{void refresh();},visible=()=>{if(document.visibilityState==='visible')void refresh();};
  void refresh();window.addEventListener('focus',focus);document.addEventListener('visibilitychange',visible);
  return()=>{live=false;window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',visible);};
 },[story.id,needsDefaults,retry]);
 const loading=needsDefaults&&(current.storyId!==story.id||current.loading),error=needsDefaults&&current.storyId===story.id&&current.error;
 const publication=withPublicationDefaults(story,current.publication).publication;
 const author=loading?"Loading credits…":error?"Could not load":hasPublicationAuthor(publication)?publication!.author:"Uncredited";
 return <div className="yu-publication-summary" aria-busy={loading}><p aria-live="polite">Created by: {author}</p>{error&&<button type="button" className="yu-revision-open" onClick={()=>setRetry(value=>value+1)}>Reload credits</button>}{onEdit&&<button type="button" className="yu-revision-open" disabled={disabled} onClick={onEdit}>Edit credits and reuse information</button>}</div>;
}

export function StoryPublicationDefaults({onClose,onSaved}:{onClose:()=>void;onSaved:()=>void}){
 const [loaded,setLoaded]=useState(false),[publication,setPublication]=useState<StoryPublication|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{
  let live=true;setError('');
  request('reader/publication-defaults').then(result=>{if(live){setPublication(result.publication);setLoaded(true);}}).catch(error=>{if(live)setError(error instanceof Error?error.message:"Could not load default credits. Try again.");});
  return()=>{live=false;};
 },[retry]);
 if(!loaded)return <Sheet title="Default credits and reuse" onClose={onClose}>{error?<div className="yu-batch-error" role="alert">{error}<button type="button" className="yu-revision-open" onClick={()=>setRetry(value=>value+1)}>Reload</button></div>:<p role="status">Loading defaults…</p>}</Sheet>;
 return <StoryPublicationEditor publication={publication} onClose={onClose} onSave={async(value,expected)=>{await request('reader/publication-defaults','POST',{publication:value,expected});onSaved();}}/>;
}

export default function StoryPublicationEditor({story,publication=null,onSave,onClose}:{story?:Story;publication?:StoryPublication|null;onSave:(value:StoryPublication,expected:StoryPublication|null)=>Promise<void>;onClose:()=>void}){
 const [initial]=useState(story?.publication??publication),[draft,setDraft]=useState<StoryPublication>(initial||{...emptyPublication});
 const [busy,setBusy]=useState(false),[restoring,setRestoring]=useState(false),[error,setError]=useState(''),[restoreNote,setRestoreNote]=useState('');const lock=useRef(false);
 const parsed=publicationSchema.safeParse(draft),changed=JSON.stringify(parsed.success?parsed.data:draft)!==JSON.stringify(initial||emptyPublication);
 async function save(){
  if(lock.current||!parsed.success||!changed)return;
  lock.current=true;setBusy(true);setError('');
  try{await onSave(parsed.data,initial);onClose();}catch(e){setError(e instanceof Error?e.message:"Credits were not saved. Try again.");}finally{lock.current=false;setBusy(false);}
 }
 async function restoreDefaults(){
  if(!story||lock.current)return;
  lock.current=true;setBusy(true);setRestoring(true);setError('');setRestoreNote('');
  try{
   const result=await request('reader/publication-defaults');
   setDraft(publicationSchema.parse(result.publication??emptyPublication));
   setRestoreNote(result.publication?"Loaded the current defaults from My space. Save to apply them to this story.":"No defaults are set in My space. Blank information loaded; save to apply it to this story.");
  }catch(e){setError(e instanceof Error?e.message:"Could not load default credits. Try again.");}
  finally{lock.current=false;setBusy(false);setRestoring(false);}
 }
 function field(key:Exclude<keyof StoryPublication,'watermarkFontSize'>,label:string,maxLength:number,placeholder:string,multiline=false){
  const props={value:draft[key],maxLength,placeholder,disabled:busy,onChange:(event:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>{setDraft(old=>({...old,[key]:event.target.value}));setError('');}};
  return <label className="yu-custom-input">{label}{multiline?<textarea rows={3} {...props}/>:<input {...props}/>}</label>;
 }
 return <Sheet title={story?"Credits and reuse":"Default credits and reuse"} onClose={onClose} busy={busy}><form className="yu-publication-editor" onSubmit={event=>{event.preventDefault();void save();}}>
  {story&&<div className="yu-publication-heading"><p className="yu-publication-work">{story.title}</p><button type="button" className="yu-revision-open" disabled={busy} onClick={()=>void restoreDefaults()}>{restoring?"Loading defaults…":"Restore defaults"}</button></div>}
  {restoreNote&&<p className="yu-count-help" role="status">{restoreNote}</p>}
  <p className="yu-count-help">{story?"Changes only this story. Filled fields take priority; blank fields use the current My space defaults when exporting.":"New stories save these defaults. Blank story fields also use the current defaults during export. Filled story fields take priority."}</p>
  <p className="yu-count-help">This information is public in your work and downloads. Use a public creator name and contact details.</p>
  {field('author',"Creator credit",80,"Your name, pen name, or team name")}
  <label className="yu-watermark-size"><span>WebP credit watermark size<output>{draft.watermarkFontSize??watermarkFontSize.default} px</output></span><input type="range" aria-label="WebP credit watermark size" min={watermarkFontSize.min} max={watermarkFontSize.max} step={1} value={draft.watermarkFontSize??watermarkFontSize.default} disabled={busy} onChange={event=>{setDraft(old=>({...old,watermarkFontSize:Number(event.target.value)}));setError('');}}/><small>In original image pixels, {watermarkFontSize.min}–{watermarkFontSize.max}  px; default {watermarkFontSize.default}  px. Applies only to WebP images in ZIP archives.</small></label>
  {field('workUrl',"Public work link",1000,"Work page or personal website, e.g. https://example.com")}
  {field('contact',"Public contact",200,"Public email or account (optional)")}
  {field('sourceNote',"Source edition and license",1200,"Specify the source, edition, and license. Credit any translations you use.",true)}
  {field('reuse',"Reuse and redistribution terms",1200,"Example: Credit the creator and link to the work when sharing. Contact me for other uses.",true)}
  <p className="yu-count-help">Original attribution and AI disclosures are kept automatically. State only permissions you can grant; public domain material and existing licenses keep their own terms.{story?"Saving does not regenerate the story.":"Edit individual stories when links, source editions, or licenses differ."}</p>
  {(!parsed.success||error)&&<p role="alert">{error||parsed.error?.issues[0].message}</p>}
  <div className="yu-revision-buttons"><button className="yu-primary" type="submit" disabled={busy||!parsed.success||!changed}>{restoring?"Loading defaults…":busy?"Saving…":story?"Save story credits":"Save defaults"}</button><button type="button" disabled={busy} onClick={onClose}>Cancel</button></div>
 </form></Sheet>;
}
