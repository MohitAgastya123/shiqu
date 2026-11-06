// English interface: labels, accessibility text, and workflow messages use English.
// Edit shared provider defaults locally; saved keys are presence flags and live generation stays unchanged.
import {useEffect,useRef,useState} from 'react';
import {ChevronRight,Settings2} from 'lucide-react';
import Sheet from './StorySheet';
import {request} from './shared';
import type {ProviderSettings as Settings,ProviderSettingsSave,ProviderSettingsView} from '@/lib/provider-settings';
import {codexReasoningEfforts} from '@/lib/codex-settings';
import {reasoningTasks,taskReasoningLabels,taskReasoningDefaults,geminiReasoningEfforts} from '@/lib/reader-reasoning';
import './ProviderSettings.css';

const labels:Record<string,string>={gemini:'Google / Gemini',openai:'OpenAI API',codex:"Codex · ChatGPT subscription",readonly:"Read only",claude:'Claude Code',deepseek:'DeepSeek API'};
type Runtime=ProviderSettingsView['runtime'];
export function ProviderRuntimeSummary({runtime}:{runtime:Runtime|null}){
 return <section className="yu-provider-summary" aria-label="Active configuration"><div><span>Currently running</span>{runtime&&<strong>{labels[runtime.provider]||runtime.provider}</strong>}</div>
  {!runtime?<p role="status">Loading generation configuration…</p>:runtime.provider==='readonly'?<p>Read only. No content will be generated.</p>:<dl><dt>Text</dt><dd title={runtime.models.text}>{runtime.models.text||'—'}</dd><dt>Images</dt><dd title={runtime.models.image}>{runtime.models.image||'—'}</dd></dl>}
  {runtime?.configured===false&&runtime.provider!=='readonly'&&<p>The generation service is not connected.</p>}
 </section>;
}
export default function ProviderSettings({onRuntime}:{onRuntime?:(runtime:Runtime|null)=>void}){
 const [open,setOpen]=useState(false),[view,setView]=useState<ProviderSettingsView|null>(null),[draft,setDraft]=useState<Settings|null>(null);
 const [runtime,setRuntime]=useState<ProviderSettingsView['runtime']|null>(null);
 useEffect(()=>{onRuntime?.(runtime);},[runtime,onRuntime]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[key,setKey]=useState(''),[keyAction,setKeyAction]=useState<ProviderSettingsSave['keyAction']>('keep');
 const live=useRef(true),saving=useRef(false),readVersion=useRef(0);
 function adopt(result:ProviderSettingsView){setView(result);setDraft(result.settings);setRuntime(result.runtime);setKey('');setKeyAction('keep');}
 async function load(){
  const version=++readVersion.current;
  setBusy(true);setError('');setMessage('');
  try{const result=await request('local/provider-settings');if(live.current&&version===readVersion.current){adopt(result);}}
  catch(e){
   if(live.current&&version===readVersion.current){
    const status=(e as {status?:number}).status;
    if(status===403||status===404){setView(null);setDraft(null);setError(status===403?"Settings can only be edited on this computer. If you are here already, restart pnpm dev or the CLI service, then reload.":"Settings cannot be edited here. Use desktop settings or CLI configuration.");}
    else setError(e instanceof Error?e.message:"Could not load generation settings.");
   }
   // Running provider information is public reader metadata, independent of local editing access.
   try{const status=await request('reader/status');if(live.current&&version===readVersion.current)setRuntime({provider:status.provider,models:status.models,configured:status.configured,taskReasoningEfforts:status.taskReasoningEfforts});}catch{}
  }
  finally{if(live.current&&version===readVersion.current)setBusy(false);}
 }
 useEffect(()=>{live.current=true;void load();return()=>{live.current=false;};},[]);
 function update<K extends keyof Settings>(field:K,value:Settings[K]){setDraft(old=>old?{...old,[field]:value}:old);setMessage('');}
 function selectProvider(provider:Settings['provider']){
  if(!draft)return;setDraft({...draft,provider,...(provider==='gemini'?{taskReasoningEfforts:Object.fromEntries(reasoningTasks.map(task=>[task,(geminiReasoningEfforts as readonly string[]).includes(draft.taskReasoningEfforts[task])?draft.taskReasoningEfforts[task]:taskReasoningDefaults[task]])) as Settings['taskReasoningEfforts']}:{})});setKey('');setKeyAction('keep');setError('');setMessage('');
 }
 async function save(){
  if(!draft||!view||saving.current)return;saving.current=true;readVersion.current++;setBusy(true);setError('');setMessage('');
  try{
   const result:ProviderSettingsView=await request('local/provider-settings','POST',{settings:draft,expectedRevision:view.revision,keyAction,key});
   if(live.current){adopt(result);setMessage(result.restartRequired?"Settings saved. Restart the service to apply them.":"Settings saved to the shared local database.");}
  }catch(e){if(live.current)setError(e instanceof Error?e.message:"Settings were not saved. Reload and try again.");}
  finally{saving.current=false;if(live.current)setBusy(false);}
 }
 const provider=draft?.provider,api=provider==='gemini'||provider==='openai',efforts=provider==='gemini'?geminiReasoningEfforts:codexReasoningEfforts;
 const dirty=!!draft&&!!view&&(JSON.stringify(draft)!==JSON.stringify(view.settings)||keyAction!=='keep');
 const notice=message||(view?.restartRequired?"Saved settings have not been applied. Restart the service to apply them.":'');
 return <><button type="button" onClick={()=>{setOpen(true);void load();}}><Settings2 size={20}/>Generation service and models<ChevronRight size={18}/></button>
 {open&&<Sheet title="Generation service and models" busy={saving.current} onClose={()=>{setOpen(false);setKey('');setKeyAction('keep');}}>
  <div className="yu-provider-settings">
   <p>Shared with the desktop app, CLI, and skill. Restart the service after saving.</p>
   {error?<p className="yu-batch-error" role="alert">{error}</p>:notice&&<p className="yu-provider-message" role="status">{notice}</p>}
   {!!view?.overrides.length&&<details className="yu-provider-overrides"><summary>This launch has {view.overrides.length}  overrides</summary><ul>{view.overrides.map(name=><li key={name}><code>{name}</code></li>)}</ul><p>Remove the launch overrides to use the saved values.</p></details>}
   <form onSubmit={e=>{e.preventDefault();void save();}}>
    {draft?<fieldset disabled={busy} aria-label="Generation service settings">
     <section className="yu-provider-group" aria-label="Provider and models">
      <h3>Provider and models</h3>
      <label>Provider<select value={provider} onChange={e=>selectProvider(e.target.value as Settings['provider'])}><option value="gemini">Google / Gemini</option><option value="openai">OpenAI API</option><option value="codex" disabled={view?.platform==='win32'}>Codex · ChatGPT subscription</option><option value="readonly">Read only</option></select></label>
      <p>{api?"Billed to your API project.":provider==='codex'?"Uses your signed-in local Codex CLI and subscription allowance.":"Read only. No generation service calls."}</p>
      {api&&<div className="yu-provider-models"><label>Text model<input value={provider==='openai'?draft.openaiTextModel:draft.textModel} onChange={e=>update(provider==='openai'?'openaiTextModel':'textModel',e.target.value)} spellCheck={false} required/></label><label>Image model<input value={provider==='openai'?draft.openaiImageModel:draft.imageModel} onChange={e=>update(provider==='openai'?'openaiImageModel':'imageModel',e.target.value)} spellCheck={false} required/></label></div>}
      {provider==='codex'&&<label>Text model<input value={draft.codexModel} onChange={e=>update('codexModel',e.target.value)} placeholder="Leave blank for the CLI default model" spellCheck={false}/></label>}
     </section>
     {api&&<section className="yu-provider-group" aria-label="API key settings">
      <div className="yu-provider-group-heading"><h3>API key</h3><span>{view?.keyPresent[provider]?"Saved":"Not set"}</span></div>
      <label>Key action<select aria-label="API key action" value={keyAction} onChange={e=>{setKeyAction(e.target.value as ProviderSettingsSave['keyAction']);setKey('');setMessage('');}}><option value="keep">Keep saved key</option><option value="replace">Enter a new key</option><option value="remove">Remove saved key</option></select></label>
      {keyAction==='replace'&&<label>New API key<input type="password" autoComplete="off" spellCheck={false} value={key} onChange={e=>setKey(e.target.value)} required maxLength={4096}/></label>}
      <p>{keyAction==='remove'?"Removes the local key on save. Restart to stop using it.":"Saved keys are never shown or returned to the browser."}</p>
     </section>}
     {provider!=='readonly'&&<details className="yu-provider-efforts"><summary>Advanced · Reasoning effort</summary>
      {provider==='codex'&&<label className="yu-provider-codex-effort">Reasoning effort for other requests<select value={draft.codexReasoningEffort} onChange={e=>update('codexReasoningEffort',e.target.value as Settings['codexReasoningEffort'])}><option value="">Use Codex default</option>{codexReasoningEfforts.map(value=><option key={value}>{value}</option>)}</select></label>}
      <div>{reasoningTasks.map(task=><label key={task}>{taskReasoningLabels[task]}<select value={draft.taskReasoningEfforts[task]} onChange={e=>update('taskReasoningEfforts',{...draft.taskReasoningEfforts,[task]:e.target.value as Settings['taskReasoningEfforts'][typeof task]})}>{efforts.map(value=><option key={value}>{value}</option>)}</select></label>)}</div>
     </details>}
    </fieldset>:busy?<p role="status">Loading local settings…</p>:!error&&<p role="status">Reload settings to edit them.</p>}
    <div className="yu-provider-actions"><button type="button" className="yu-provider-reload" aria-label="Reload settings" disabled={busy} onClick={()=>void load()}>Reload</button>{draft&&<button type="submit" className="yu-primary" disabled={!dirty||busy}>{saving.current?"Saving…":"Save settings"}</button>}</div>
   </form>
  </div>
 </Sheet>}</>;
}
