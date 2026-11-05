// Edit shared provider defaults locally; saved keys are presence flags and live generation stays unchanged.
import {useEffect,useRef,useState} from 'react';
import {ChevronRight,Settings2} from 'lucide-react';
import Sheet from './StorySheet';
import {request} from './shared';
import type {ProviderSettings as Settings,ProviderSettingsSave,ProviderSettingsView} from '@/lib/provider-settings';
import {codexReasoningEfforts} from '@/lib/codex-settings';
import {reasoningTasks,taskReasoningLabels,taskReasoningDefaults,geminiReasoningEfforts} from '@/lib/reader-reasoning';
import {effectiveImageProvider,isApiProvider} from '@/lib/system-settings';
import './ProviderSettings.css';

const labels:Record<string,string>={gemini:'Google / Gemini',openai:'OpenAI API',codex:'Codex · ChatGPT 订阅',readonly:'只读',claude:'Claude Code',deepseek:'DeepSeek API'};
type Runtime=ProviderSettingsView['runtime'];
export function ProviderRuntimeSummary({runtime}:{runtime:Runtime|null}){
 return <section className="yu-provider-summary" aria-label="当前运行配置"><div><span>当前运行</span>{runtime&&<strong>{labels[runtime.provider]||runtime.provider}</strong>}</div>
  {!runtime?<p role="status">正在读取生成配置…</p>:runtime.provider==='readonly'?<p>只读模式，不生成内容。</p>:<dl><dt>文本</dt><dd title={runtime.models.text}>{runtime.models.text||'—'}</dd><dt>图片</dt><dd title={runtime.models.image}>{runtime.imageProvider?`${labels[runtime.imageProvider]} · `:''}{runtime.models.image||'—'}</dd></dl>}
  {runtime?.configured===false&&runtime.provider!=='readonly'&&<p>生成服务尚未接通。</p>}
 </section>;
}
export default function ProviderSettings({onRuntime}:{onRuntime?:(runtime:Runtime|null)=>void}){
 const [open,setOpen]=useState(false),[view,setView]=useState<ProviderSettingsView|null>(null),[draft,setDraft]=useState<Settings|null>(null);
 const [runtime,setRuntime]=useState<ProviderSettingsView['runtime']|null>(null);
 useEffect(()=>{onRuntime?.(runtime);},[runtime,onRuntime]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[key,setKey]=useState(''),[keyAction,setKeyAction]=useState<ProviderSettingsSave['keyAction']>('keep');
 const [imageKey,setImageKey]=useState(''),[imageKeyAction,setImageKeyAction]=useState<ProviderSettingsSave['imageKeyAction']>('keep');
 const live=useRef(true),saving=useRef(false),readVersion=useRef(0);
 function adopt(result:ProviderSettingsView){setView(result);setDraft(result.settings);setRuntime(result.runtime);setKey('');setKeyAction('keep');setImageKey('');setImageKeyAction('keep');}
 async function load(){
  const version=++readVersion.current;
  setBusy(true);setError('');setMessage('');
  try{const result=await request('local/provider-settings');if(live.current&&version===readVersion.current){adopt(result);}}
  catch(e){
   if(live.current&&version===readVersion.current){
    const status=(e as {status?:number}).status;
    if(status===403||status===404){setView(null);setDraft(null);setError(status===403?'编辑设置仅限本机访问。若已在本机，请完整重启 pnpm dev 或 CLI 服务后重新读取。':'当前入口不提供设置编辑，请使用桌面设置或 CLI 配置。');}
    else setError(e instanceof Error?e.message:'暂时无法读取生成设置。');
   }
   // Running provider information is public reader metadata, independent of local editing access.
   try{const status=await request('reader/status');if(live.current&&version===readVersion.current)setRuntime({provider:status.provider,imageProvider:status.imageProvider,models:status.models,configured:status.configured,taskReasoningEfforts:status.taskReasoningEfforts});}catch{}
  }
  finally{if(live.current&&version===readVersion.current)setBusy(false);}
 }
 useEffect(()=>{live.current=true;void load();return()=>{live.current=false;};},[]);
 function update<K extends keyof Settings>(field:K,value:Settings[K]){setDraft(old=>old?{...old,[field]:value}:old);setMessage('');}
 function selectProvider(provider:Settings['provider']){
  if(!draft)return;
  // "Same as text" stays unset; a typed image key survives unless the effective image provider changes.
  const imageProvider=draft.imageProvider===provider?undefined:draft.imageProvider;
  if(effectiveImageProvider({provider,imageProvider})!==effectiveImageProvider(draft)){setImageKey('');setImageKeyAction('keep');}
  setDraft({...draft,provider,imageProvider,...(provider==='gemini'?{taskReasoningEfforts:Object.fromEntries(reasoningTasks.map(task=>[task,(geminiReasoningEfforts as readonly string[]).includes(draft.taskReasoningEfforts[task])?draft.taskReasoningEfforts[task]:taskReasoningDefaults[task]])) as Settings['taskReasoningEfforts']}:{})});setKey('');setKeyAction('keep');setError('');setMessage('');
 }
 async function save(){
  if(!draft||!view||saving.current)return;saving.current=true;readVersion.current++;setBusy(true);setError('');setMessage('');
  try{
   // null clears a previous separate image provider; omitted fields keep their saved values.
   const result:ProviderSettingsView=await request('local/provider-settings','POST',{settings:{...draft,imageProvider:draft.imageProvider??null},expectedRevision:view.revision,keyAction,key,imageKeyAction,imageKey});
   if(live.current){adopt(result);setMessage(result.restartRequired?'设置已保存。重启当前服务后生效。':'设置已保存到本机共享数据库。');}
  }catch(e){if(live.current)setError(e instanceof Error?e.message:'设置暂未保存，请重新读取后再试。');}
  finally{saving.current=false;if(live.current)setBusy(false);}
 }
 const provider=draft?.provider,api=provider==='gemini'||provider==='openai',efforts=provider==='gemini'?geminiReasoningEfforts:codexReasoningEfforts;
 const imageProvider=draft?effectiveImageProvider(draft):null,separateImage=!!imageProvider&&imageProvider!==provider,imageApi=separateImage&&isApiProvider(imageProvider)?imageProvider:null;
 const dirty=!!draft&&!!view&&(JSON.stringify(draft)!==JSON.stringify(view.settings)||keyAction!=='keep'||imageKeyAction!=='keep');
 const notice=message||(view?.restartRequired?'已保存的设置尚未应用，重启服务后生效。':'');
 return <><button type="button" onClick={()=>{setOpen(true);void load();}}><Settings2 size={20}/>生成服务与模型<ChevronRight size={18}/></button>
 {open&&<Sheet title="生成服务与模型" busy={saving.current} onClose={()=>{setOpen(false);setKey('');setKeyAction('keep');setImageKey('');setImageKeyAction('keep');}}>
  <div className="yu-provider-settings">
   <p>与桌面、CLI 和技能共用，保存后重启服务生效。</p>
   {error?<p className="yu-batch-error" role="alert">{error}</p>:notice&&<p className="yu-provider-message" role="status">{notice}</p>}
   {!!view?.overrides.length&&<details className="yu-provider-overrides"><summary>本次启动有 {view.overrides.length} 项覆盖</summary><ul>{view.overrides.map(name=><li key={name}><code>{name}</code></li>)}</ul><p>移除对应的启动覆盖后，保存值才会生效。</p></details>}
   <form onSubmit={e=>{e.preventDefault();void save();}}>
    {draft?<fieldset disabled={busy} aria-label="生成服务设置">
     <section className="yu-provider-group" aria-label="提供方与模型">
      <h3>提供方与模型</h3>
      <label>文本服务<select value={provider} onChange={e=>selectProvider(e.target.value as Settings['provider'])}><option value="gemini">Google / Gemini</option><option value="openai">OpenAI API</option><option value="codex" disabled={view?.platform==='win32'}>Codex · ChatGPT 订阅</option><option value="readonly">只读</option></select></label>
      <p>{api?'按 API 项目计费。':provider==='codex'?'使用本机已登录的 Codex CLI 和订阅额度。':'只读模式，不调用生成服务。'}</p>
      {provider!=='readonly'&&<label>图片服务<select value={draft.imageProvider||''} onChange={e=>{const value=e.target.value as NonNullable<Settings['imageProvider']>|'';const next=value&&value!==provider?value:undefined;if(effectiveImageProvider({provider:provider!,imageProvider:next})!==imageProvider){setImageKey('');setImageKeyAction('keep');}update('imageProvider',next);}}><option value="">与文本服务相同</option><option value="gemini">Google / Gemini</option><option value="openai">OpenAI API</option><option value="codex" disabled={view?.platform==='win32'}>Codex · ChatGPT 订阅</option></select></label>}
      {api&&<div className="yu-provider-models"><label>文本模型<input value={provider==='openai'?draft.openaiTextModel:draft.textModel} onChange={e=>update(provider==='openai'?'openaiTextModel':'textModel',e.target.value)} spellCheck={false} required/></label>{!separateImage&&<label>图片模型<input value={provider==='openai'?draft.openaiImageModel:draft.imageModel} onChange={e=>update(provider==='openai'?'openaiImageModel':'imageModel',e.target.value)} spellCheck={false} required/></label>}</div>}
      {provider==='codex'&&<label>文本模型<input value={draft.codexModel} onChange={e=>update('codexModel',e.target.value)} placeholder="留空使用 CLI 默认模型" spellCheck={false}/></label>}
     </section>
     {api&&<section className="yu-provider-group" aria-label="API 密钥设置">
      <div className="yu-provider-group-heading"><h3>API 密钥</h3><span>{view?.keyPresent[provider]?'已保存':'未设置'}</span></div>
      <label>密钥操作<select aria-label="API 密钥操作" value={keyAction} onChange={e=>{setKeyAction(e.target.value as ProviderSettingsSave['keyAction']);setKey('');setMessage('');}}><option value="keep">保留已保存密钥</option><option value="replace">输入新密钥</option><option value="remove">移除已保存密钥</option></select></label>
      {keyAction==='replace'&&<label>新 API 密钥<input type="password" autoComplete="off" spellCheck={false} value={key} onChange={e=>setKey(e.target.value)} required maxLength={4096}/></label>}
      <p>{keyAction==='remove'?'保存后移除本机密钥，重启后停止使用。':'已存密钥不会显示或返回浏览器。'}</p>
     </section>}
     {separateImage&&<section className="yu-provider-group" aria-label="图片服务设置">
      <div className="yu-provider-group-heading"><h3>图片服务 · {labels[imageProvider!]}</h3>{imageApi&&<span>{view?.keyPresent[imageApi]?'密钥已保存':'密钥未设置'}</span>}</div>
      <p>只用于绘制插图；选题、分镜与审核仍使用文本服务，制作流程不变。</p>
      {imageApi?<>
       <label>图片模型<input value={imageApi==='openai'?draft.openaiImageModel:draft.imageModel} onChange={e=>update(imageApi==='openai'?'openaiImageModel':'imageModel',e.target.value)} spellCheck={false} required/></label>
       <label>图片服务密钥操作<select aria-label="图片服务 API 密钥操作" value={imageKeyAction} onChange={e=>{setImageKeyAction(e.target.value as ProviderSettingsSave['imageKeyAction']);setImageKey('');setMessage('');}}><option value="keep">保留已保存密钥</option><option value="replace">输入新密钥</option><option value="remove">移除已保存密钥</option></select></label>
       {imageKeyAction==='replace'&&<label>图片服务新 API 密钥<input type="password" autoComplete="off" spellCheck={false} value={imageKey} onChange={e=>setImageKey(e.target.value)} required maxLength={4096}/></label>}
      </>:<p>使用本机已登录的 Codex CLI 和订阅额度绘图。</p>}
     </section>}
     {provider!=='readonly'&&<details className="yu-provider-efforts"><summary>高级设置 · 推理档位</summary>
      {provider==='codex'&&<label className="yu-provider-codex-effort">其他请求推理档位<select value={draft.codexReasoningEffort} onChange={e=>update('codexReasoningEffort',e.target.value as Settings['codexReasoningEffort'])}><option value="">跟随 Codex 默认</option>{codexReasoningEfforts.map(value=><option key={value}>{value}</option>)}</select></label>}
      <div>{reasoningTasks.map(task=><label key={task}>{taskReasoningLabels[task]}<select value={draft.taskReasoningEfforts[task]} onChange={e=>update('taskReasoningEfforts',{...draft.taskReasoningEfforts,[task]:e.target.value as Settings['taskReasoningEfforts'][typeof task]})}>{efforts.map(value=><option key={value}>{value}</option>)}</select></label>)}</div>
     </details>}
    </fieldset>:busy?<p role="status">正在读取本机设置…</p>:!error&&<p role="status">重新读取后可编辑设置。</p>}
    <div className="yu-provider-actions"><button type="button" className="yu-provider-reload" aria-label="重新读取设置" disabled={busy} onClick={()=>void load()}>重新读取</button>{draft&&<button type="submit" className="yu-primary" disabled={!dirty||busy}>{saving.current?'正在保存…':'保存设置'}</button>}</div>
   </form>
  </div>
 </Sheet>}</>;
}
