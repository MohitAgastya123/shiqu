// Edit shared provider defaults locally; saved keys are presence flags and live generation stays unchanged.
import {useEffect,useRef,useState} from 'react';
import {ChevronRight,Settings2} from 'lucide-react';
import Sheet from './StorySheet';
import {request} from './shared';
import type {ProviderSettings as Settings,ProviderSettingsSave,ProviderSettingsView} from '@/lib/provider-settings';
import {codexReasoningEfforts} from '@/lib/codex-settings';
import {reasoningTasks,taskReasoningLabels,taskReasoningDefaults,geminiReasoningEfforts} from '@/lib/reader-reasoning';
import './ProviderSettings.css';

const labels:Record<string,string>={gemini:'Google / Gemini',openai:'OpenAI API',codex:'Codex · ChatGPT 订阅',readonly:'只读',claude:'Claude Code',deepseek:'DeepSeek API'};
export default function ProviderSettings(){
 const [available,setAvailable]=useState(true),[open,setOpen]=useState(false),[view,setView]=useState<ProviderSettingsView|null>(null),[draft,setDraft]=useState<Settings|null>(null);
 const [runtime,setRuntime]=useState<ProviderSettingsView['runtime']|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[key,setKey]=useState(''),[keyAction,setKeyAction]=useState<ProviderSettingsSave['keyAction']>('keep');
 const live=useRef(true),saving=useRef(false),readVersion=useRef(0);
 function adopt(result:ProviderSettingsView){setView(result);setDraft(result.settings);setRuntime(result.runtime);setKey('');setKeyAction('keep');}
 async function load(){
  const version=++readVersion.current;
  setBusy(true);setError('');setMessage('');
  try{const result=await request('local/provider-settings');if(live.current&&version===readVersion.current){adopt(result);setAvailable(true);}}
  catch(e){
   if(live.current&&version===readVersion.current){
    const status=(e as {status?:number}).status;
    if(status===403||status===404){setAvailable(false);setView(null);setDraft(null);setError(status===403?'编辑设置仅限本机访问。若已在本机，请完整重启 pnpm dev 或 CLI 服务后重新读取。':'当前入口不提供设置编辑，请使用桌面设置或 CLI 配置。');}
    else setError(e instanceof Error?e.message:'暂时无法读取生成设置。');
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
   if(live.current){adopt(result);setMessage(result.restartRequired?'设置已保存。重启当前服务后生效。':'设置已保存到本机共享数据库。');}
  }catch(e){if(live.current)setError(e instanceof Error?e.message:'设置暂未保存，请重新读取后再试。');}
  finally{saving.current=false;if(live.current)setBusy(false);}
 }
 const provider=draft?.provider,api=provider==='gemini'||provider==='openai',efforts=provider==='gemini'?geminiReasoningEfforts:codexReasoningEfforts;
 const dirty=!!draft&&!!view&&(JSON.stringify(draft)!==JSON.stringify(view.settings)||keyAction!=='keep');
 return <><button type="button" onClick={()=>{setOpen(true);void load();}}><Settings2 size={20}/>生成服务与模型<ChevronRight size={18}/></button>
 {open&&<Sheet title="生成服务与模型" busy={saving.current} onClose={()=>{setOpen(false);setKey('');setKeyAction('keep');}}>
  <div className="yu-provider-settings">
   <p>与桌面、CLI 和技能共用本机设置。保存不会改变正在运行的生成任务。</p>
   {runtime&&<section className="yu-provider-runtime" aria-label="当前运行配置"><h3>当前运行</h3><strong>{labels[runtime.provider]||runtime.provider}</strong><dl><dt>文本模型</dt><dd>{runtime.models.text||'—'}</dd><dt>图片模型</dt><dd>{runtime.models.image||'—'}</dd></dl>
    {runtime.configured===false&&<p>当前生成服务尚未接通。</p>}
    {runtime.configured===undefined&&<p>显示本次启动配置；尚未检查 CLI 登录状态。</p>}
    {runtime.taskReasoningEfforts&&<details><summary>运行中的任务推理档位</summary><dl>{reasoningTasks.map(task=><div key={task}><dt>{taskReasoningLabels[task]}</dt><dd>{runtime.taskReasoningEfforts![task]}</dd></div>)}</dl></details>}
    {!!view?.overrides.length&&<div className="yu-provider-overrides"><p>本次启动有环境或配置文件覆盖，优先于保存值：</p><ul>{view.overrides.map(name=><li key={name}><code>{name}</code></li>)}</ul><p>要使用对应的保存值，请移除覆盖后重启服务。密钥值不会显示。</p></div>}
    {view?.restartRequired&&<p className="yu-provider-restart" role="status">保存的配置与当前运行不同，请重启服务。已有启动覆盖仍然优先。</p>}
   </section>}
   {error&&<p className="yu-batch-error" role="alert">{error}</p>}
   {message&&<p className="yu-provider-message" role="status">{message}</p>}
   {!draft?<p role="status">{busy?'正在读取本机设置…':available?'重新读取后可编辑设置。':'当前仅显示运行配置。'}</p>:<form onSubmit={e=>{e.preventDefault();void save();}}>
    <fieldset disabled={busy}><legend>保存的生成设置</legend>
     <label>提供方<select value={provider} onChange={e=>selectProvider(e.target.value as Settings['provider'])}><option value="gemini">Google / Gemini · API 密钥</option><option value="openai">OpenAI API · 单独计费</option><option value="codex" disabled={view?.platform==='win32'}>Codex · ChatGPT 订阅</option><option value="readonly">只读 · 不生成内容</option></select></label>
     {api&&<>
      <div className="yu-provider-models"><label>文本模型<input value={provider==='openai'?draft.openaiTextModel:draft.textModel} onChange={e=>update(provider==='openai'?'openaiTextModel':'textModel',e.target.value)} spellCheck={false} required/></label><label>图片模型<input value={provider==='openai'?draft.openaiImageModel:draft.imageModel} onChange={e=>update(provider==='openai'?'openaiImageModel':'imageModel',e.target.value)} spellCheck={false} required/></label></div>
      <p>{view?.keyPresent[provider]?'此服务已有密钥，保存时默认保留。':'此服务尚未保存 API 密钥。'}</p>
      <label>API 密钥操作<select value={keyAction} onChange={e=>{setKeyAction(e.target.value as ProviderSettingsSave['keyAction']);setKey('');setMessage('');}}><option value="keep">保留已保存密钥</option><option value="replace">输入新密钥</option><option value="remove">移除已保存密钥</option></select></label>
      {keyAction==='replace'&&<label>新 API 密钥<input type="password" autoComplete="off" spellCheck={false} value={key} onChange={e=>setKey(e.target.value)} required maxLength={4096}/></label>}
      {keyAction==='remove'&&<p>保存后移除此服务的密钥。当前运行中的服务仍需重启才会应用。</p>}
      <p>已保存密钥不会返回浏览器。新密钥保存成功后会清空输入。API 服务按对应项目计费。</p>
     </>}
     {provider==='codex'&&<><p>使用本机已登录的 Codex CLI 和订阅额度。</p><label>Codex 文本模型<input value={draft.codexModel} onChange={e=>update('codexModel',e.target.value)} placeholder="留空使用 CLI 默认模型" spellCheck={false}/></label><label>其他请求推理档位<select value={draft.codexReasoningEffort} onChange={e=>update('codexReasoningEffort',e.target.value as Settings['codexReasoningEffort'])}><option value="">跟随 Codex 默认</option>{codexReasoningEfforts.map(value=><option key={value}>{value}</option>)}</select></label></>}
     {provider!=='readonly'&&<details className="yu-provider-efforts"><summary>按任务设置推理档位</summary><div>{reasoningTasks.map(task=><label key={task}>{taskReasoningLabels[task]}<select value={draft.taskReasoningEfforts[task]} onChange={e=>update('taskReasoningEfforts',{...draft.taskReasoningEfforts,[task]:e.target.value as Settings['taskReasoningEfforts'][typeof task]})}>{efforts.map(value=><option key={value}>{value}</option>)}</select></label>)}</div></details>}
     <p>保存到共享数据库，重启服务后读取新配置。此页面不会测试连接或生成内容。</p>
     <button type="submit" className="yu-primary" disabled={!dirty||busy}>{busy?'正在保存…':'保存设置'}</button>
    </fieldset>
   </form>}
   <button type="button" className="yu-revision-open" disabled={busy} onClick={()=>void load()}>重新读取设置</button>
  </div>
 </Sheet>}</>;
}
