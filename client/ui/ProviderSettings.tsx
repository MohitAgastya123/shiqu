// Edit shared generation settings with English status cards, accessible provider choices and saved-key presence.
// Keep text/image credentials separate, clear hidden drafts when providers change, and preserve the running service until restart.
import {useEffect,useRef,useState} from 'react';
import {AlertTriangle,ChevronRight,Cpu,Image as ImageIcon,KeyRound,RefreshCw,RotateCcw,SlidersHorizontal,Type} from 'lucide-react';
import Sheet from './StorySheet';
import {request} from './shared';
import {imageKeyDraftForProviderChange,type ProviderSettings as Settings,type ProviderSettingsSave,type ProviderSettingsView} from '@/lib/provider-settings';
import {codexReasoningEfforts} from '@/lib/codex-settings';
import {reasoningTasks,taskReasoningLabels,taskReasoningDefaults,geminiReasoningEfforts} from '@/lib/reader-reasoning';
import {effectiveImageProvider,isApiProvider} from '@/lib/system-settings';
import './ProviderSettings.css';

const labels:Record<string,string>={gemini:'Google / Gemini',openai:'OpenAI API',codex:'Codex · ChatGPT subscription',readonly:'Read only',claude:'Claude Code',deepseek:'DeepSeek API'};
type Runtime=ProviderSettingsView['runtime'];
type Tone='ok'|'warn'|'idle';
type KeyAction=ProviderSettingsSave['keyAction'];
type Option<T extends string>={value:T;label:string;hint?:string;badge?:{tone:Tone;text:string};disabled?:boolean};

// Runtime summaries use the active process configuration, independently of saved drafts.
function runtimeState(runtime:Runtime|null):{tone:Tone;label:string}{
 if(!runtime)return {tone:'idle',label:'Loading'};
 if(runtime.provider==='readonly')return {tone:'idle',label:'Read only'};
 return runtime.configured===false?{tone:'warn',label:'Not connected'}:{tone:'ok',label:'Running'};
}
function RuntimeRows({runtime}:{runtime:Runtime}){
 return <dl className="yu-provider-runtime">
  <dt><Type size={14}/>Text</dt><dd title={runtime.models.text}><span>{labels[runtime.provider]||runtime.provider}</span><code>{runtime.models.text||'Default model'}</code></dd>
  <dt><ImageIcon size={14}/>Images</dt><dd title={runtime.models.image}><span>{labels[runtime.imageProvider||runtime.provider]||runtime.imageProvider}</span><code>{runtime.models.image||'Default model'}</code></dd>
 </dl>;
}
export function ProviderRuntimeSummary({runtime}:{runtime:Runtime|null}){
 const state=runtimeState(runtime);
 return <section className="yu-provider-summary" aria-label="Active configuration"><div><span>Currently running</span><em className={`yu-provider-pill ${state.tone}`}>{state.label}</em></div>
  {!runtime?<p role="status">Loading generation configuration…</p>:runtime.provider==='readonly'?<p>Read only. No content will be generated.</p>:<RuntimeRows runtime={runtime}/>}
  {runtime?.configured===false&&runtime.provider!=='readonly'&&<p>The generation service is not connected.</p>}
 </section>;
}
// Native radios retain arrow-key navigation and inherit the surrounding fieldset disabled state.
function Choices<T extends string>({name,label,value,options,onChange,variant='cards'}:{name:string;label:string;value:T;options:Option<T>[];onChange:(value:T)=>void;variant?:'cards'|'segments'}){
 return <div role="radiogroup" aria-label={label} className={variant==='cards'?'yu-provider-cards':'yu-provider-segments'}>{options.map(option=><label key={option.value} className={option.value===value?'selected':undefined}>
  <input type="radio" name={name} value={option.value} checked={option.value===value} disabled={option.disabled} onChange={()=>onChange(option.value)}/>
  <strong>{option.label}</strong>{option.hint&&<small>{option.hint}</small>}{option.badge&&<em className={`yu-provider-pill ${option.badge.tone}`}>{option.badge.text}</em>}
 </label>)}</div>;
}
function Group({icon,title,label,changed,children}:{icon:React.ReactNode;title:string;label:string;changed:boolean;children:React.ReactNode}){
 return <section className="yu-provider-group" aria-label={label}><header>{icon}<h3>{title}</h3>{changed&&<i className="yu-provider-changed">Changed</i>}</header>{children}</section>;
}
function KeyField({name,title,present,action,onAction,value,onValue}:{name:string;title:string;present:boolean;action:KeyAction;onAction:(action:KeyAction)=>void;value:string;onValue:(value:string)=>void}){
 return <div className="yu-provider-key">
  <div className="yu-provider-key-head"><span><KeyRound size={14}/>{title}</span><em className={`yu-provider-pill ${present?'ok':'warn'}`}>{present?'Saved':'Not set'}</em></div>
  <Choices name={name} label={`${title} action`} variant="segments" value={action} onChange={onAction} options={[{value:'keep',label:present?'Keep':'Not now'},{value:'replace',label:present?'Replace':'Enter key'},{value:'remove',label:'Remove',disabled:!present}]}/>
  {action==='replace'&&<label className="yu-provider-field">New {title}<input type="password" autoComplete="off" spellCheck={false} value={value} onChange={e=>onValue(e.target.value)} required maxLength={4096} placeholder="Paste and save. The saved key will stay hidden."/></label>}
  <p className={action==='remove'?'danger':undefined}>{action==='remove'?'Saving removes the local key. Restart to stop using it.':present||action==='replace'?'Saved keys are never displayed or returned to the browser.':'No key is set. This service cannot generate content yet.'}</p>
 </div>;
}
export default function ProviderSettings({onRuntime,onAvailability,openRequest=0,showEntry=true,showPrompt=false}:{onRuntime?:(runtime:Runtime|null)=>void;onAvailability?:(allowed:boolean)=>void;openRequest?:number;showEntry?:boolean;showPrompt?:boolean}){
 const [access,setAccess]=useState<'unknown'|'allowed'|'denied'>('unknown');
 const [open,setOpen]=useState(false),[view,setView]=useState<ProviderSettingsView|null>(null),[draft,setDraft]=useState<Settings|null>(null);
 const [runtime,setRuntime]=useState<ProviderSettingsView['runtime']|null>(null);
 useEffect(()=>{onRuntime?.(runtime);},[runtime,onRuntime]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[key,setKey]=useState(''),[keyAction,setKeyAction]=useState<ProviderSettingsSave['keyAction']>('keep');
 const [imageKey,setImageKey]=useState(''),[imageKeyAction,setImageKeyAction]=useState<ProviderSettingsSave['imageKeyAction']>('keep');
 const live=useRef(true),saving=useRef(false),readVersion=useRef(0);
 function adopt(result:ProviderSettingsView){setAccess('allowed');setView(result);setDraft(result.settings);setRuntime(result.runtime);setKey('');setKeyAction('keep');setImageKey('');setImageKeyAction('keep');}
 async function load(){
  const version=++readVersion.current;
  setBusy(true);setError('');setMessage('');
  try{const result=await request('local/provider-settings');if(live.current&&version===readVersion.current){adopt(result);}}
  catch(e){
   if(live.current&&version===readVersion.current){
    const status=(e as {status?:number}).status;
    if(status===403||status===404){setAccess('denied');setOpen(false);setView(null);setDraft(null);setError('Open generation settings using a loopback address on the computer running the service.');}
    else {if(status===503){setAccess('allowed');setView(null);setDraft(null);}setError(e instanceof Error?e.message:'Could not load generation settings.');}
   }
   // Public runtime metadata remains readable independently of local settings permission.
   try{const status=await request('reader/status');if(live.current&&version===readVersion.current)setRuntime({provider:status.provider,imageProvider:status.imageProvider,models:status.models,configured:status.configured,taskReasoningEfforts:status.taskReasoningEfforts});}catch{}
  }
  finally{if(live.current&&version===readVersion.current)setBusy(false);}
 }
 useEffect(()=>{live.current=true;void load();return()=>{live.current=false;};},[]);
 useEffect(()=>{onAvailability?.(access==='allowed');},[access,onAvailability]);
 useEffect(()=>{if(openRequest&&access==='allowed')setOpen(true);},[openRequest,access]);
 function update<K extends keyof Settings>(field:K,value:Settings[K]){setDraft(old=>old?{...old,[field]:value}:old);setMessage('');}
 function selectProvider(provider:Settings['provider']){
  if(!draft)return;
  // Store only separate image providers and keep a key draft only while it belongs to the same provider.
  const imageProvider=draft.imageProvider===provider?undefined:draft.imageProvider;
  const nextKey=imageKeyDraftForProviderChange(draft,{provider,imageProvider},{imageKeyAction,imageKey});
  setImageKey(nextKey.imageKey);setImageKeyAction(nextKey.imageKeyAction);
  setDraft({...draft,provider,imageProvider,...(provider==='gemini'?{taskReasoningEfforts:Object.fromEntries(reasoningTasks.map(task=>[task,(geminiReasoningEfforts as readonly string[]).includes(draft.taskReasoningEfforts[task])?draft.taskReasoningEfforts[task]:taskReasoningDefaults[task]])) as Settings['taskReasoningEfforts']}:{})});setKey('');setKeyAction('keep');setError('');setMessage('');
 }
 async function save(){
  if(!draft||!view||saving.current)return;saving.current=true;readVersion.current++;setBusy(true);setError('');setMessage('');
  try{
   // null clears a previous separate image provider; omitted fields keep their saved values.
   const result:ProviderSettingsView=await request('local/provider-settings','POST',{settings:{...draft,imageProvider:draft.imageProvider??null},expectedRevision:view.revision,keyAction,key,imageKeyAction,imageKey});
   if(live.current){adopt(result);setMessage(result.restartRequired?'Settings saved. Restart the service to apply them.':'Settings saved to the shared local database.');}
  }catch(e){if(live.current)setError(e instanceof Error?e.message:'Settings were not saved. Reload and try again.');}
  finally{saving.current=false;if(live.current)setBusy(false);}
 }
 const provider=draft?.provider,api=provider==='gemini'||provider==='openai',efforts=provider==='gemini'?geminiReasoningEfforts:codexReasoningEfforts;
 const imageProvider=draft?effectiveImageProvider(draft):null,separateImage=!!imageProvider&&imageProvider!==provider,imageApi=separateImage&&isApiProvider(imageProvider)?imageProvider:null;
 const dirty=!!draft&&!!view&&(JSON.stringify(draft)!==JSON.stringify(view.settings)||keyAction!=='keep'||imageKeyAction!=='keep');
 const notice=message||(view?.restartRequired?'Saved settings have not been applied. Restart the service to apply them.':'');
 const state=runtimeState(runtime),codexBlocked=view?.platform==='win32';
 const changed=(...fields:(keyof Settings)[])=>!!draft&&!!view&&fields.some(field=>JSON.stringify(draft[field])!==JSON.stringify(view.settings[field]));
 const textModelField=provider==='openai'?'openaiTextModel':provider==='codex'?'codexModel':'textModel',imageModelField=imageProvider==='openai'?'openaiImageModel':'imageModel';
 const keyBadge=(name:'gemini'|'openai'):Option<string>['badge']=>view?(view.keyPresent[name]?{tone:'ok',text:'Key saved'}:{tone:'warn',text:'Key missing'}):undefined;
 const providerOptions:Option<NonNullable<Settings['imageProvider']>>[]=[{value:'gemini',label:'Gemini',hint:'Google API billing',badge:keyBadge('gemini')},{value:'openai',label:'OpenAI',hint:'OpenAI API billing',badge:keyBadge('openai')},{value:'codex',label:'Codex',hint:codexBlocked?'Unavailable on Windows':'ChatGPT subscription usage',disabled:codexBlocked}];
 function discard(){if(view){adopt(view);setError('');setMessage('');}}
 function selectImageProvider(value:NonNullable<Settings['imageProvider']>|''){
  if(!draft)return;
  // Sharing the text provider clears the independent image-provider setting and hidden key draft.
  const next=value&&value!==provider?value:undefined;
  const nextKey=imageKeyDraftForProviderChange(draft,{provider:draft.provider,imageProvider:next},{imageKeyAction,imageKey});
  setImageKey(nextKey.imageKey);setImageKeyAction(nextKey.imageKeyAction);
  update('imageProvider',next);
 }
 async function savedAction(action:'check'|'reset'){
  if(!view||saving.current)return;
  if(action==='reset'&&!window.confirm('Reset all generation settings and keys? Stories, local paths and network settings are kept. Active generation continues unchanged.'))return;
  saving.current=true;setBusy(true);setError('');setMessage('');
  try{const result=await request('local/provider-settings','POST',{action,expectedRevision:view.revision});if(action==='reset'){adopt(result);setMessage('Generation settings reset. Restart the service to apply them.');}else setMessage(result.message);}
  catch(e){setError(e instanceof Error?e.message:'The action failed. Reload settings and try again.');}
  finally{saving.current=false;setBusy(false);}
 }
 return <>{showPrompt&&runtime?.configured===false&&!open&&<aside className="yu-provider-setup" role="status">Configure a generation service first.{access==='allowed'?<a href="#provider-settings">Open generation service and models</a>:<span>On the computer running the service, open a loopback address and go to My space → Generation service and models.</span>}</aside>}{showEntry&&access==='allowed'&&<button type="button" onClick={()=>{setOpen(true);void load();}}><Cpu size={20}/>Generation service and models<ChevronRight size={18}/></button>}
 {open&&<Sheet title="Generation service and models" busy={saving.current} onClose={()=>{setOpen(false);if(location.hash==='#provider-settings')history.replaceState(null,'',location.pathname+location.search);setKey('');setKeyAction('keep');setImageKey('');setImageKeyAction('keep');}}>
  <div className="yu-provider-settings">
   <p className="yu-provider-intro">Shared with the desktop, CLI and skill. Restart the service after saving to apply changes.</p>
   <section className={`yu-provider-status ${state.tone}`} aria-label="Service status">
    <header><i className="yu-provider-dot"/><strong>{runtime?.provider==='readonly'?'Read-only mode':`Generation service: ${state.label}`}</strong>
     {view?.restartRequired&&<em className="yu-provider-pill warn">Restart required</em>}
     {!!view?.overrides.length&&<em className="yu-provider-pill warn">{view.overrides.length} startup overrides</em>}
    </header>
    {runtime&&runtime.provider!=='readonly'?<RuntimeRows runtime={runtime}/>:<p>{runtime?'No generation service is currently being called.':'Loading active configuration…'}</p>}
    {!!view?.overrides.length&&<details className="yu-provider-overrides"><summary><AlertTriangle size={14}/>View overrides</summary><ul>{view.overrides.map(name=><li key={name}><code>{name}</code></li>)}</ul><p>Remove the corresponding startup overrides to apply the saved values.</p></details>}
   </section>
   {error?<p className="yu-batch-error" role="alert">{error}</p>:notice&&<p className="yu-provider-message" role="status">{notice}</p>}
   <form onSubmit={e=>{e.preventDefault();void save();}}>
    {draft?<fieldset disabled={busy} aria-label="Generation service settings">
     <Group icon={<Type size={16}/>} title="Text service" label="Provider and model" changed={changed('provider',textModelField)||keyAction!=='keep'}>
      <Choices name="provider" label="Text service" value={provider!} onChange={selectProvider} options={[...providerOptions,{value:'readonly',label:'Read only',hint:'No generation requests'}]}/>
      {provider!=='readonly'&&<label className="yu-provider-field">Text model<input value={draft[textModelField]} onChange={e=>update(textModelField,e.target.value)} placeholder={provider==='codex'?'Leave blank to use the CLI default model':undefined} spellCheck={false} required={api}/></label>}
      {api&&<KeyField name="key-action" title="API key" present={!!view?.keyPresent[provider]} action={keyAction} onAction={value=>{setKeyAction(value);setKey('');setMessage('');}} value={key} onValue={setKey}/>}
     </Group>
     {provider!=='readonly'&&<Group icon={<ImageIcon size={16}/>} title="Image service" label="Image service settings" changed={changed('imageProvider',imageModelField)||imageKeyAction!=='keep'}>
      <Choices name="image-provider" label="Image service" value={draft.imageProvider||''} onChange={selectImageProvider} options={[{value:'',label:'Same as text',hint:labels[provider!]},...providerOptions.filter(option=>option.value!==provider)]}/>
      {separateImage&&<p>Used only for illustrations. Discovery, storyboarding and review continue through the text service.</p>}
      {isApiProvider(imageProvider)?<label className="yu-provider-field">Image model<input value={draft[imageModelField]} onChange={e=>update(imageModelField,e.target.value)} spellCheck={false} required/></label>:<p>Draw using the locally signed-in Codex CLI and subscription usage.</p>}
      {imageApi?<KeyField name="image-key-action" title="Image service API key" present={!!view?.keyPresent[imageApi]} action={imageKeyAction} onAction={value=>{setImageKeyAction(value);setImageKey('');setMessage('');}} value={imageKey} onValue={setImageKey}/>:!separateImage&&api&&<p>Use the text service API key.</p>}
     </Group>}
     {provider!=='readonly'&&<details className="yu-provider-efforts"><summary><SlidersHorizontal size={16}/><span>Reasoning effort</span><small>{reasoningTasks.length} tasks</small>{changed('taskReasoningEfforts','codexReasoningEffort')&&<i className="yu-provider-changed">Changed</i>}</summary>
      <div className="yu-provider-effort-rows">
       {provider==='codex'&&<div className={draft.codexReasoningEffort!==view?.settings.codexReasoningEffort?'changed':undefined}><span>Other requests</span><Choices name="effort-codex" label="Other requests reasoning effort" variant="segments" value={draft.codexReasoningEffort} onChange={value=>update('codexReasoningEffort',value)} options={[{value:'',label:'Default'},...codexReasoningEfforts.map(value=>({value,label:value}))]}/></div>}
       {reasoningTasks.map(task=><div key={task} className={draft.taskReasoningEfforts[task]!==view?.settings.taskReasoningEfforts[task]?'changed':undefined}><span>{taskReasoningLabels[task]}</span><Choices<string> name={`effort-${task}`} label={`${taskReasoningLabels[task]} reasoning effort`} variant="segments" value={draft.taskReasoningEfforts[task]} onChange={value=>update('taskReasoningEfforts',{...draft.taskReasoningEfforts,[task]:value as Settings['taskReasoningEfforts'][typeof task]})} options={efforts.map(value=>({value,label:value}))}/></div>)}
      </div>
     </details>}
    </fieldset>:busy?<p role="status">Loading local settings…</p>:!error&&<p role="status">Reload to edit settings.</p>}
    <div className="yu-provider-actions">
     <span className={dirty?'dirty':undefined}>{dirty?'Unsaved changes':view?.restartRequired?'Saved. Restart to apply.':draft?'Matches saved settings':''}</span>
     <button type="button" className="yu-provider-ghost" aria-label="Reload settings" title="Reload settings" disabled={busy} onClick={()=>void load()}><RefreshCw size={16}/></button>
     {dirty&&<button type="button" className="yu-provider-ghost" disabled={busy} onClick={discard}><RotateCcw size={16}/>Discard</button>}
     {draft&&<button type="submit" className="yu-primary" disabled={!dirty||busy}>{saving.current?'Saving…':'Save settings'}</button>}
    </div>
   </form>
   {view&&<div className="yu-provider-maintenance"><button type="button" className="yu-provider-ghost" disabled={busy} onClick={()=>void savedAction('check')}>Check saved connection</button><button type="button" className="yu-provider-ghost" disabled={busy} onClick={()=>void savedAction('reset')}>Reset all generation settings</button><p>Checks use saved settings and startup overrides. Unsaved changes are not submitted and no content is generated.</p></div>}
  </div>
 </Sheet>}</>;
}
