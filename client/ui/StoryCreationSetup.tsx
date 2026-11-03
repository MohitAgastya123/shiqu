// Keep discovery in the story picker; a chosen story enters one continuous production flow.
// Edits are saved as a draft on the side; only a recommendation or final confirmation starts work.
// Discovery continues one story at a time while open, and stops when a story is chosen or the picker closes.
import StoryFlowAction from './StoryFlowAction';
import {readingChapterLabel} from '@/lib/reader-suggestions';
import {useEffect,useRef,useState} from 'react';
import type {ComponentProps} from 'react';
import {ArrowLeft,Loader2} from 'lucide-react';
import type {SessionView} from '@/lib/reader-model';
import type {IntakeCommand} from '@/lib/reader-intake';
import {getArtStyle} from '@/lib/reader-styles';
import {generationProgress} from '@/lib/generation-progress';
import StoryProductionEditor,{StoryEditorTabs} from './StoryProductionEditor';
import type {StoryEditorTab,ProductionSettings} from './StoryProductionEditor';
import Sheet from './StorySheet';
import StoryBackToShelf from './StoryBackToShelf';
import StorySource from './StorySource';
import StoryGenerationStatus from './StoryGenerationStatus';
import StoryGenerationControl from './StoryGenerationControl';
import StoryRetry from './StoryRetry';
import StoryExtractionSearch from './StoryExtractionSearch';
import StoryExtractionContext from './StoryExtractionContext';
import './story-revision.css';
type SetupTab=Exclude<StoryEditorTab,'script'>;
type Props={session:SessionView;book:string;busy:boolean;onAction:(command:IntakeCommand)=>Promise<void>;onBackToDiscovery?:()=>void;progress:Omit<ComponentProps<typeof StoryGenerationStatus>,'session'|'timeline'|'stages'|'children'|'compact'>};
// Stable titles prevent the initial discovery snapshot from flashing a production screen.
export function storyCreationTitle(session:SessionView){return session.intake?(session.intake.selected?'故事流程':'选择故事'):session.story?.title||session.selection.storyTitle||'你的故事，正在展开';}
const savedSettings=(session:SessionView)=>session.intake!.draft||{artStyle:session.selection.artStyle,productionPrompt:session.selection.productionPrompt,...(session.selection.acceptancePrompt!==undefined?{acceptancePrompt:session.selection.acceptancePrompt}:{}),narrativeDetail:session.selection.narrativeDetail||'balanced' as const,length:'auto' as const};
export default function StoryCreationSetup({session,book,busy,onAction,onBackToDiscovery,progress,onReplace}:Props&{onReplace?:(batch:number,index:number,settings:ProductionSettings)=>Promise<void>}){
 const intake=session.intake!,saved={...savedSettings(session),length:'auto' as const},savedKey=JSON.stringify(saved);
 const targetTitle=session.selection.discovery?.mode==='title'?session.selection.discovery.title:undefined;
 const [error,setError]=useState('');
 const [finding,setFinding]=useState(false);
 const [editing,setEditing]=useState<SetupTab|null>(null),[choosing,setChoosing]=useState(false),[sourceOpen,setSourceOpen]=useState(false);
 const [settings,setSettings]=useState({...saved,length:'auto' as const}),[remote,setRemote]=useState(false);
 const baseline=useRef(savedKey),own=useRef(false),shown=useRef(session.id);
 useEffect(()=>{
  const mine=own.current,same=shown.current===session.id;own.current=false;shown.current=session.id;
  // Another device changed what is saved. Unsaved edits stay until the reader decides between them.
  if(same&&!mine&&JSON.stringify(settings)!==baseline.current){setRemote(true);return;}
  baseline.current=savedKey;setSettings({...saved,length:'auto'});setRemote(false);
  if(!same||mine){setSourceOpen(false);setEditing(null);setError('');}
 },[session.id,intake.generation,savedKey]);
 const search=intake.search,paused=!!session.generationControl&&session.generationControl!=='active';
 const searching=finding||search.state==='searching';
 const locked=busy||session.state==='running'&&!paused,ready=intake.phase==='confirming';
 const editable=ready||paused&&intake.phase==='preparing';
 const candidates=intake.batches.flatMap((saved,batchIndex)=>saved.stories.map((candidate,index)=>({candidate,batchIndex,index})));
 const selected=intake.selected?intake.batches[intake.selected.batch]?.stories[intake.selected.index]:null;
 const showExtractionStatus=search.state==='searching'&&(paused||!candidates.length||!!intake.progress?.currentChapters?.length||!!intake.progress?.completedChars);
 const preparable=!!selected&&intake.phase==='choosing'&&session.state!=='failed';
 const preferences={artStyle:settings.artStyle,productionPrompt:settings.productionPrompt,...(settings.acceptancePrompt!==undefined?{acceptancePrompt:settings.acceptancePrompt}:{}),narrativeDetail:settings.narrativeDetail};
 async function act(command:IntakeCommand){
  setError('');
  if(command.action==='more'||command.action==='search')setFinding(true);else own.current=true;
  try{await onAction(command);return true;}
  catch(e){own.current=false;setError(e instanceof Error?e.message:'操作暂未保存，请重试。');return false;}
  finally{if(command.action==='more'||command.action==='search')setFinding(false);}
 }
 const isSelected=(batchIndex:number,index:number)=>intake.selected?.batch===batchIndex&&intake.selected.index===index;
 async function select(batchIndex:number,index:number){
  if(onReplace){await onReplace(batchIndex,index,{...settings,length:'auto'});return;}
  // The story already being prepared or waiting here has nothing to redo.
  if(isSelected(batchIndex,index)&&['preparing','confirming'].includes(intake.phase)){setChoosing(false);return;}
  if(await act({action:'choose',batch:batchIndex,index,...(selected?{settings:preferences}:{})}))setChoosing(false);
 }
 function closeEditor(){setEditing(null);if(JSON.stringify(settings)!==baseline.current&&!busy&&!remote)void act({action:'draft',settings});}
 function adoptRemote(){baseline.current=savedKey;setSettings({...saved,length:'auto'});setRemote(false);}
 function keepEdits(){baseline.current=savedKey;setRemote(false);void act({action:'draft',settings});}
 const remoteChoice=remote&&<div className="yu-revision-conflict-note" role="status"><p>另一台设备更新了制作内容。你的修改还没有保存。</p><div className="yu-revision-buttons"><StoryFlowAction disabled={busy} onClick={adoptRemote}>采用最新内容</StoryFlowAction><StoryFlowAction disabled={busy} onClick={keepEdits}>保留我的修改</StoryFlowAction></div></div>;
 const findMore=(!targetTitle||search.state==='failed')&&<StoryFlowAction asLink={!!selected} type="button" className="yu-refresh-batch" aria-busy={searching&&!paused} disabled={busy||searching||intake.batches.length>=40} onClick={()=>void act({action:'more'})}>{searching&&!paused&&<Loader2 size={14} className="spin" aria-hidden="true"/>}{searching?(paused?'恢复后继续查找':'正在查找…'):search.state==='failed'?'重试查找':'继续找故事'}</StoryFlowAction>;
 const terminalBatch=intake.batches.at(-1),terminalNote=terminalBatch?.stories.length===0?terminalBatch.note:'';
 const candidateList=<>
  <div className="yu-batch-heading"><h3>已找到 {candidates.length} 篇故事</h3>{findMore}</div>
  <div className="yu-candidate-list">{candidates.map(({candidate,batchIndex,index})=><button type="button" key={`${batchIndex}:${index}`} aria-pressed={isSelected(batchIndex,index)} className={isSelected(batchIndex,index)?'selected':''} disabled={(busy||session.state==='running'&&intake.phase==='preparing')&&!isSelected(batchIndex,index)} onClick={()=>void select(batchIndex,index)}><strong>{candidate.title}</strong><span className="yu-candidate-description">{candidate.description}</span>{candidate.sourceLabel&&<small>{candidate.sourceLabel}</small>}<span className="yu-candidate-action">{isSelected(batchIndex,index)?'已选这篇':onReplace?'选择并替换':'选择这篇'}</span></button>)}</div>
  {!searching&&search.state!=='failed'&&(!candidates.length||terminalBatch?.stories.length===0)&&<p className="yu-candidate-note">{terminalNote||(candidates.length?'暂时没有找到更多故事，已找到的故事都在上方。':'还没有找到符合主题的故事，可以继续查找，或换个主题。')}</p>}
  {intake.batches.length>=40&&<p className="yu-candidate-note">已达到候选保存上限，请从已找到的故事中选择，或换个主题。</p>}
 </>;
 const stages=generationProgress(session,Date.now()).steps.map(step=>{
  if(ready&&step.id==='source')return {...step,label:'原文',detail:`画风：${getArtStyle(settings.artStyle).label}`};
  if(ready&&step.id==='count')return {...step,detail:`${settings.narrativeDetail==='brief'?'简短':settings.narrativeDetail==='detailed'?'详细':'适中'} · 画幅数由编排与审核确定`};
  return step;
 });
 const extractionStatus=showExtractionStatus&&<div className="yu-extraction-status" role="status">{(paused||!candidates.length)&&<p>{paused?'提取已暂停，恢复后继续。':'正在提取，找到的故事会逐篇显示。'}</p>}{!paused&&(!!intake.progress?.currentChapters?.length||!!intake.progress?.completedChars)&&<p className="yu-extraction-status-detail">{intake.progress.currentChapters?.length?`正在阅读：${readingChapterLabel(intake.progress.currentChapters)}`:''}{intake.progress.completedChars?` 已读 ${intake.progress.completedChars.toLocaleString('zh-CN')} 字。`:''}</p>}</div>;
 const extractionError=search.state==='failed'&&<div className="yu-batch-error" role="alert"><p>提取未完成。{search.error}</p><p>已找到的故事会保留，可以重试或直接选择。</p>{selected&&findMore}</div>;
 return <section className="yu-creation-setup" aria-label={selected?'故事流程':'选择故事'}>
  {!selected&&onBackToDiscovery&&<StoryFlowAction disabled={busy} onClick={onBackToDiscovery}><ArrowLeft size={14} aria-hidden="true"/>返回修改书籍、原文和主题</StoryFlowAction>}
  {selected?<p className="yu-sheet-intro">《{book}》 · {session.selection.theme==='原典故事'?'不限定主题':`主题：${session.selection.theme}`}{session.selection.discoverySources?.length?` · 已选 ${session.selection.discoverySources.length} 段原文`:''}</p>:<StoryExtractionContext selection={session.selection} book={book}/>}
  {!selected&&<StoryExtractionSearch sessionId={session.id} title={targetTitle} local={session.selection.bookId!=='other'} busy={busy} hasCandidates={candidates.length>0} onSearch={title=>act({action:'search',title})}/>}
  {selected&&progress.showSummary!==false&&<div className="yu-batch-heading"><h3>{session.selection.storyTitle}</h3></div>}
  {!selected&&extractionStatus}
  {!selected&&extractionError}
  {!selected&&!editing&&remoteChoice}
  {!selected&&(intake.batches.length>0||search.state==='failed')&&candidateList}
  {selected?<StoryGenerationStatus session={session} {...progress} compact={ready} control={ready?null:undefined} stages={stages} stageContent={{source:<>{extractionStatus}{extractionError}</>,count:<>
   {!editing&&remoteChoice}
   {error&&<p className="yu-batch-error" role="alert">{error}</p>}
   {ready&&<StoryFlowAction type="button" className="yu-primary" disabled={busy||session.state==='running'} onClick={()=>void act({action:'confirm',settings})}>{busy?'正在保存…':'开始制作'}</StoryFlowAction>}
   {preparable&&<StoryFlowAction type="button" className="yu-primary" disabled={busy||session.state==='running'} onClick={()=>void act({action:'choose',batch:intake.selected!.batch,index:intake.selected!.index,settings:preferences})}>准备这篇</StoryFlowAction>}
  </>}} navigation={{source:{onClick:()=>setSourceOpen(true),disabled:!ready||busy},reselect:{onClick:()=>setChoosing(true),disabled:busy}}} timeline={{
   links:{source:editable?[{label:'制作要求（可选）',onClick:()=>setEditing('requirements')},{label:'验收要求（可选）',onClick:()=>setEditing('acceptance')}]:[]},
   detailActions:editable?{source:{label:'修改画风',onClick:()=>setEditing('style')}}:undefined,
   actions:editable?{count:{label:'修改叙事详略',onClick:()=>setEditing('count')}}:undefined
  }}/>:<>
   {(session.error||progress.error)&&<p className="yu-batch-error" role="alert">{progress.error||session.error}</p>}
   {(session.state==='failed'||!!progress.error)&&<StoryRetry session={session} busy={progress.busy} onRetry={progress.onRetry}/>}
   {paused&&<StoryGenerationControl session={session} busy={progress.controlBusy} onControl={progress.onControl} primary/>}
   {!onReplace&&!progress.hideBack&&<StoryBackToShelf onBack={progress.onBack}/>}
  </>}
  {!selected&&error&&<p className="yu-batch-error" role="alert">{error}</p>}
  {choosing&&<Sheet title="重新选择故事" busy={busy} onClose={()=>setChoosing(false)}>{candidateList}{error&&<p role="alert">{error}</p>}</Sheet>}
  {sourceOpen&&<Sheet title="故事原文" onClose={()=>setSourceOpen(false)}><StorySource sessionId={session.id} book={book}/></Sheet>}
  {editing&&<Sheet title="修改故事" busy={busy} onClose={closeEditor}>
   {remoteChoice}
   <StoryEditorTabs tab={editing} disabled={locked} onChange={tab=>{if(tab!=='script')setEditing(tab);}}/>
   <StoryProductionEditor sessionId={session.id} tab={editing} settings={settings} creation disabled={locked} recommendation={session.frameRecommendation} artRecommendation={selected?.artRecommendation} onChange={patch=>setSettings(s=>({...s,...patch,length:'auto'}))} onRecommend={ready&&session.state!=='running'?()=>void act({action:'recommend',settings:preferences}):undefined}/>
   {error&&<p className="yu-batch-error" role="alert">{error}</p>}
   <button type="button" className="yu-primary" disabled={busy} onClick={closeEditor}>完成编辑</button><p className="yu-revision-note">设置会保存在这里，离开后也保留；确认制作后才开始生成。</p>
  </Sheet>}
 </section>;
}
