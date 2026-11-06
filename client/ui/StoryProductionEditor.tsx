// English interface: labels, accessibility text, and workflow messages use English.
// Share production fields across creation drafts and immutable story revisions.
// Callbacks only update their owner's local draft; recommending and submitting stay explicit.
import StoryPromptDetails from './StoryPromptDetails';
import StoryArtStylePicker from './StoryArtStylePicker';
import {narrativeDetails} from '@/lib/reader-frame-recommendation';
import type {NarrativeDetail} from '@/lib/reader-frame-recommendation';
import {StoryArtRecommendation} from './StoryArtRecommendation';
import type {ArtStyleId} from '@/lib/reader-styles';
import type {FrameRecommendation} from '@/lib/reader-frame-recommendation';
import type {ArtRecommendation} from '@/lib/reader-art-recommendation';
export type StoryEditorTab='requirements'|'acceptance'|'style'|'count'|'script';
export type ProductionSettings={artStyle:ArtStyleId;productionPrompt:string;acceptancePrompt?:string;length:number|'auto';narrativeDetail:NarrativeDetail};
const tabs:{id:StoryEditorTab;label:string}[]=[{id:'requirements',label:"Production instructions"},{id:'acceptance',label:"Acceptance criteria"},{id:'style',label:"Art style"},{id:'count',label:"Narrative detail"},{id:'script',label:"Storyboard"}];
export function StoryEditorTabs({tab,onChange,script=false,disabled=false}:{tab:StoryEditorTab;onChange:(tab:StoryEditorTab)=>void;script?:boolean;disabled?:boolean}){
 return <nav className="yu-revision-tabs" aria-label="Edit content">{tabs.filter(t=>script||t.id!=='script').map(t=><button type="button" key={t.id} disabled={disabled} aria-pressed={tab===t.id} onClick={()=>onChange(t.id)}>{t.label}</button>)}</nav>;
}
export default function StoryProductionEditor({tab,settings,disabled,onChange,sessionId,creation=false,recommendation,artRecommendation,onRecommend}:{tab:Exclude<StoryEditorTab,'script'>;settings:ProductionSettings;sessionId?:string;disabled:boolean;onChange:(patch:Partial<ProductionSettings>)=>void;creation?:boolean;recommendation?:FrameRecommendation|null;artRecommendation?:ArtRecommendation;onRecommend?:()=>void}){
 return <fieldset className="yu-revision-fields" disabled={disabled}>
  {tab==='requirements'&&<label className="yu-revision-field">Production instructions<textarea rows={7} maxLength={1200} value={settings.productionPrompt} onChange={e=>onChange({productionPrompt:e.target.value})}/><small>{creation?"Adaptation suggestions based on the source text. Edit or clear them. Used for storyboarding and illustrations after confirmation.":"Changing production instructions creates a new storyboard and illustrations. Source evidence is preserved."}</small></label>}
  {tab==='acceptance'&&<label className="yu-revision-field">Acceptance criteria<textarea rows={7} maxLength={1200} value={settings.acceptancePrompt||''} placeholder="One criterion per line. Example: Key reactions must appear as visible actions." onChange={e=>onChange({acceptancePrompt:e.target.value})}/><small>{creation?"Suggested acceptance criteria based on this adaptation. Edit or clear them. Used only for review, not storyboard generation.":''}One criterion per line, up to 20. Each receives a decision and evidence. Editing only these criteria keeps the storyboard and reusable images, then reviews again. Conflicts or criteria that cannot be judged from the script stop production with an explanation.</small></label>}
  {(tab==='requirements'||tab==='acceptance')&&<StoryPromptDetails sessionId={sessionId} kind={tab==='acceptance'?'acceptance':'production'} preferences={{...settings}}/>}
  {tab==='style'&&<>
   {artRecommendation&&<StoryArtRecommendation recommendation={artRecommendation} selected={settings.artStyle} disabled={disabled} onApply={()=>onChange({artStyle:artRecommendation.artStyle})}/>}
   <StoryArtStylePicker value={settings.artStyle} disabled={disabled} onChange={artStyle=>onChange({artStyle})}/>
  </>}
  {tab==='count'&&<section><h3>Narrative detail</h3><div className="yu-narrative-details" role="group" aria-label="Narrative detail">{narrativeDetails.map(detail=><button type="button" key={detail.id} aria-pressed={settings.narrativeDetail===detail.id} className={settings.narrativeDetail===detail.id?'selected':''} disabled={disabled} onClick={()=>onChange({narrativeDetail:detail.id,length:'auto'})}><strong>{detail.label}</strong><span>{detail.description.split(/(?<=[，, ])/).map((part,index)=><span key={index}>{part}</span>)}</span></button>)}</div><p className="yu-count-help">The model plans pages from the source and narrative detail. Review may change the count. Images follow once the script is stable.</p>{recommendation&&<p className="yu-count-help">Initial estimate: {recommendation.count}  pages. Storyboarding and review determine the final count.</p>}</section>}
  {onRecommend&&(tab==='count'||tab==='requirements')&&<><button type="button" className="yu-revision-open" onClick={onRecommend}>Prepare again with current instructions</button><p className="yu-count-help">Save settings and verify the source. Drawing waits for review approval.</p></>}
 </fieldset>;
}
