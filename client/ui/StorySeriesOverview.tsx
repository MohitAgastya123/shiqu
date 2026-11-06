// Present numeric source order, durable progress and explicit series controls above ordinary story workflows.
// Opening a part only reads its saved session; recovery and generation remain explicit production actions.
import type {StorySeriesView,StorySeriesPartView,StorySeriesControl} from '@/lib/story-import-contract';
import {ArrowRight,BookOpen,Pause,Play,Square} from 'lucide-react';
import './story-import.css';
export const seriesStateLabel=(state:StorySeriesView['state'])=>({active:'In production',paused:'Paused',stopped:'Stopped',completed:'Complete','needs-attention':'Needs attention'})[state];
export const seriesPartLabel=(part:StorySeriesPartView)=>part.state==='waiting'?'Waiting for earlier parts':part.state==='failed'?'Needs attention':part.state==='completed'?'Ready to read':part.state==='paused'?'Paused':part.stage||'In production';
export function StorySeriesPartList({series,busy=false,onOpenPart}:{series:StorySeriesView;busy?:boolean;onOpenPart:(part:StorySeriesPartView)=>void}){
 return <ol className="yu-series-parts" aria-label="Parts in reading order">{[...series.parts].sort((a,b)=>a.number-b.number).map(part=><li key={part.rootId} data-part-number={part.number}><div><strong>{part.title}</strong><p role="status">{seriesPartLabel(part)}{part.total!==null?` · ${part.ready} / ${part.total} illustrations`:''}</p>{part.error&&<p className="yu-import-error">{part.error}</p>}</div><button type="button" disabled={busy||!part.sessionId} onClick={()=>onOpenPart(part)} aria-label={`${part.state==='completed'?'Read':'Open'} Part ${part.number}`}>{part.state==='completed'?'Read':'Open'}<ArrowRight size={16}/></button></li>)}</ol>;
}
export default function StorySeriesOverview({series,busy,error,onControl,onOpenPart,onRefresh}:{series:StorySeriesView|null;busy:string;error:string;onControl:(action:StorySeriesControl['action'])=>Promise<unknown>;onOpenPart:(part:StorySeriesPartView)=>void;onRefresh:()=>Promise<unknown>}){
 if(!series)return <div className="yu-series-overview">{error?<><p role="alert" className="yu-import-error">{error}</p><button type="button" disabled={!!busy} onClick={()=>void onRefresh()}>Retry opening series</button></>:<p role="status">Opening comic series…</p>}</div>;
 const preparationBlocked=series.state==='needs-attention'&&!!series.error&&!series.parts.some(part=>part.state==='failed');
 return <section className="yu-series-overview" aria-label="Comic series overview"><p className="yu-series-kicker">{seriesStateLabel(series.state)}</p><h3>{series.title}</h3><p className="yu-series-source">{series.source.fileName} · {series.source.wordCount.toLocaleString('en-US')} words</p><p className="yu-series-progress" role="status">{series.completedParts} of {series.totalParts} parts complete</p><progress max={series.totalParts||1} value={series.completedParts} aria-label="Series completion"/>
  <p>Parts are created in reading order. Completed comics stay saved while the next part is prepared.</p>
  <div className="yu-series-controls" role="group" aria-label="Series production controls">{series.state==='active'&&<button type="button" disabled={!!busy} onClick={()=>void onControl('pause')}><Pause size={16}/>Pause series</button>}{(series.state==='paused'||series.state==='stopped'||preparationBlocked)&&<button type="button" disabled={!!busy} onClick={()=>void onControl('resume')}><Play size={16}/>{preparationBlocked?'Retry preparation':'Resume series'}</button>}{series.state!=='completed'&&series.state!=='stopped'&&<button type="button" disabled={!!busy} onClick={()=>void onControl('stop')}><Square size={15}/>Stop series</button>}</div>
  {(error||series.error)&&<p role="alert" className="yu-import-error">{error||series.error}</p>}
  {series.state==='needs-attention'&&<p className="yu-import-help">{preparationBlocked?'Retry preparation to continue creating the next part. Earlier completed parts will be kept.':'Open the part that needs attention to review or retry its saved issue. Earlier completed parts will be kept.'}</p>}
  <StorySeriesPartList series={series} busy={!!busy} onOpenPart={onOpenPart}/>
 </section>;
}
export function StorySeriesShelf({items,onOpen}:{items:StorySeriesView[];onOpen:(id:string)=>void}){
 if(!items.length)return null;
 return <section className="yu-series-shelf" aria-label="Comic series"><h2>Comic series</h2><div className="yu-series-cards">{items.map(series=><article key={series.id}><button type="button" className="yu-series-card" onClick={()=>onOpen(series.id)} aria-label={`Open series “${series.title}”`}><BookOpen size={24}/><span><strong>{series.title}</strong><small>{series.completedParts} / {series.totalParts} parts complete · {seriesStateLabel(series.state)}</small></span><ArrowRight size={19}/></button><details><summary>Parts in reading order</summary><ol>{[...series.parts].sort((a,b)=>a.number-b.number).map(part=><li key={part.rootId}><span>{part.title}</span><small>{seriesPartLabel(part)}</small></li>)}</ol></details></article>)}</div></section>;
}
