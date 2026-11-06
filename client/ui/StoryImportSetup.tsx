// Preview a local document and its complete automatic part plan before commissioning comics.
// Settings share the ordinary production editor; no manual source splitting or balloon placement is needed.
import {useState} from 'react';
import {Upload,FileText,ArrowRight} from 'lucide-react';
import type {ImportedSourceView,StoryImportPlan,StoryImportSettings} from '@/lib/story-import-contract';
import {storyImportTitleSchema} from '@/lib/story-import-contract';
import StoryProductionEditor,{StoryEditorTabs,type StoryEditorTab} from './StoryProductionEditor';
import './story-import.css';

type Props={source:ImportedSourceView|null;plan:StoryImportPlan|null;title:string;settings:StoryImportSettings;busy:string;error:string;planning:boolean;previewBusy:boolean;planReady:boolean;connected:boolean;onUpload:(file:File)=>Promise<unknown>;onTitle:(title:string)=>void;onSettings:(settings:StoryImportSettings)=>void;onCreate:()=>Promise<unknown>;onMoreSource:()=>Promise<unknown>;onConfigure:()=>void;onRetryPlan:()=>void};
export default function StoryImportSetup({source,plan,title,settings,busy,error,planning,previewBusy,planReady,connected,onUpload,onTitle,onSettings,onCreate,onMoreSource,onConfigure,onRetryPlan}:Props){
 const [tab,setTab]=useState<Exclude<StoryEditorTab,'script'>>('style'),[showTitleError,setShowTitleError]=useState(false),validTitle=storyImportTitleSchema.safeParse(title),locked=!!busy;
 return <section className="yu-story-import" aria-label="Upload a story">
  <p className="yu-sheet-intro">Give Shiqu your own story. Short stories become one comic; longer stories are divided into ordered parts at natural breaks.</p>
  <label className="yu-story-upload"><Upload size={24} aria-hidden="true"/><strong>{source?'Choose another document':'Choose your story'}</strong><span>Word (.docx) or a PDF with selectable text · up to 10 MB</span><input type="file" accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" aria-label="Choose Word or PDF story" disabled={locked} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void onUpload(file);}}/></label>
  {busy&&<p className="yu-import-status" role="status">{busy}…</p>}
  {error&&<p className="yu-import-error" role="alert">{error}</p>}
  {source&&<>
   <div className="yu-import-file"><FileText size={22} aria-hidden="true"/><div><strong>{source.fileName}</strong><p>{source.wordCount.toLocaleString('en-US')} words{source.pageCount!==null?` · ${source.pageCount} ${source.pageCount===1?'page':'pages'}`:''} · Saved locally</p></div></div>
   {source.warnings.length>0&&<ul className="yu-import-warnings" aria-label="Document notes">{source.warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul>}
   <label className="yu-revision-field">Comic title<input value={title} maxLength={140} disabled={locked} onBlur={()=>setShowTitleError(true)} onChange={event=>onTitle(event.target.value)}/></label>
   {showTitleError&&!validTitle.success&&<p role="alert" className="yu-import-error">{validTitle.error.issues[0].message}</p>}
   <details className="yu-import-source"><summary>Read extracted story</summary><p>Showing {source.preview.end.toLocaleString('en-US')} of {source.preview.total.toLocaleString('en-US')} characters. The complete saved story is used for the comics.</p><pre>{source.preview.text}</pre>{source.preview.hasMore&&<button type="button" disabled={previewBusy} onClick={()=>void onMoreSource()}>{previewBusy?'Loading source…':'Read more source'}</button>}</details>
   <details className="yu-import-preferences"><summary>Art style and story preferences</summary><StoryEditorTabs tab={tab} onChange={value=>{if(value!=='script')setTab(value);}} disabled={locked}/><StoryProductionEditor tab={tab} settings={{...settings,length:'auto'}} disabled={locked} creation onChange={patch=>{const {length,...fields}=patch;void length;onSettings({...settings,...fields});}}/></details>
   <section className="yu-import-plan" aria-label="Automatic comic parts" aria-busy={planning}>
    <h3>{planning?'Updating automatic parts…':!plan?'Automatic parts need an adjustment':plan.parts.length===1?'One complete comic':`${plan.parts.length} comic parts`}</h3>
    <p>Every section of your extracted story is assigned to a part, in its original order. Each part is reviewed against its own source before drawing.</p>
    {!plan&&!planning&&<p className="yu-import-help">Your complete source is saved. Adjust Narrative detail in Art style and story preferences to update the automatic parts.</p>}
    {error&&!planning&&!planReady&&validTitle.success&&<button type="button" className="yu-revision-open" disabled={locked} onClick={onRetryPlan}>Retry automatic parts</button>}
    {plan&&<ol>{plan.parts.map(part=><li key={part.number}><strong>{part.title}</strong><span>{part.wordCount.toLocaleString('en-US')} words</span></li>)}</ol>}
   </section>
   <p className="yu-import-privacy">Reading the file and dividing it into parts happen locally. Creating comics sends story text to your selected generation service. You can pause the series at any time.</p>
   {connected?<button type="button" className="yu-primary yu-import-create" disabled={locked||planning||!planReady||!validTitle.success} onClick={()=>void onCreate()}>{busy==='Creating comic series'?'Creating…':plan?.parts.length===1?'Create comic':'Create all parts'}<ArrowRight size={18}/></button>:<div className="yu-import-configure"><p>Your story is saved. Configure a generation service before creating its comics.</p><button type="button" className="yu-primary" disabled={locked} onClick={onConfigure}>Configure generation service</button></div>}
  </>}
 </section>;
}
