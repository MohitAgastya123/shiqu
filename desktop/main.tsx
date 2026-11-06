// English interface: labels, accessibility text, and workflow messages use English.
// The desktop manages the local service; reading opens in the browser and credentials stay native.
import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {invoke,isTauri} from '@tauri-apps/api/core';
import QRCode from 'qrcode';
import {LayoutDashboard,Layers3,Settings2} from 'lucide-react';
import {LibraryPane} from './LibraryPane';
import {OverviewPane} from './OverviewPane';
import {ServiceCard} from './ServiceCard';
import {PhoneAccessCard} from './PhoneAccessCard';
import {localReaderUrl} from './reader-url';
import type {ServiceState} from './library-summary';
import {codexReasoningEfforts} from '../lib/codex-settings';
import {taskReasoningDefaults,reasoningTasks,taskReasoningLabels,geminiReasoningEfforts} from '../lib/reader-reasoning';
import {defaultSystemSettings} from '../lib/system-settings';
import type {SystemSettings,ProviderName} from '../lib/system-settings';
import './styles.css';

type Settings=SystemSettings;
type View={settings:Settings;revision:number;keyPresent:boolean;providerKeys:{gemini:boolean;openai:boolean};runtimeConfigured:boolean;credentialError:string|null;platform:string};
type Status={running:boolean;url?:string;phoneUrls:string[];publicUrl?:string;internetError?:string;error?:string};
type NodeInfo={path:string;version:string;sqlite:boolean};
type KeyAction='keep'|'replace'|'delete';
type DesktopTab='overview'|'queue'|'settings';
const tabs=[['overview',"Overview",LayoutDashboard],['queue',"Generation queue",Layers3],['settings',"Settings",Settings2]] as const;
const previewSettings=defaultSystemSettings("Story directory saved in the desktop app");

function Desktop(){
 const [tab,setTab]=useState<DesktopTab>('overview');
 const [view,setView]=useState<View|null>(null),[settings,setSettings]=useState<Settings|null>(null),[status,setStatus]=useState<Status>({running:false,phoneUrls:[]});
 const [key,setKey]=useState(''),[keyAction,setKeyAction]=useState<KeyAction>('keep'),[reveal,setReveal]=useState(false),[node,setNode]=useState<NodeInfo|null>(null),[nodeError,setNodeError]=useState('');
 const [busy,setBusy]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState(''),[phone,setPhone]=useState(''),[qr,setQr]=useState('');
 const native=isTauri();
 const [statusKnown,setStatusKnown]=useState(false),[statusReadError,setStatusReadError]=useState('');
 const statusEpoch=useRef(0);
 const actionInFlight=useRef(false);
 function acceptStatus(result:Status){statusEpoch.current++;setStatus(result);setStatusKnown(true);setStatusReadError('');}
 async function checkNode(nodePath:string){try{const info=await invoke<NodeInfo>('detect_node',{nodePath});setNode(info);setNodeError('');return info;}catch(e){setNode(null);setNodeError(String(e));return null;}}
 useEffect(()=>{
  if(!native){if(import.meta.env.DEV){setSettings(previewSettings);setView({settings:previewSettings,keyPresent:false,credentialError:null,platform:'preview',revision:0,providerKeys:{gemini:false,openai:false},runtimeConfigured:false});}else setError("Open this in the Shiqu desktop app.");return;}
  void invoke<View>('get_settings').then(result=>{setView(result);setSettings(result.settings);if(!result.settings.providerConfigured&&!result.runtimeConfigured)setTab('settings');void checkNode(result.settings.nodePath);}).catch(e=>setError(String(e)));
  let active=true,inFlight=false;
  function readStatus(){if(inFlight)return;inFlight=true;const epoch=statusEpoch.current;void invoke<Status>('server_status').then(result=>{if(active&&epoch===statusEpoch.current){setStatus(result);setStatusKnown(true);setStatusReadError('');}}).catch(()=>{if(active&&epoch===statusEpoch.current){setStatusKnown(false);setStatusReadError("Could not read service status. Retrying.");}}).finally(()=>{inFlight=false;});}
  readStatus();const timer=setInterval(readStatus,2000);
  return()=>{active=false;clearInterval(timer);};
 },[native]);
 useEffect(()=>{const links=[status.publicUrl,...status.phoneUrls].filter((link):link is string=>!!link);setPhone(current=>links.includes(current)?current:links[0]||'');},[status.publicUrl,status.phoneUrls.join('|')]);
 useEffect(()=>{let active=true;setQr('');if(phone)void QRCode.toDataURL(phone,{width:240,margin:2,color:{dark:'#193d30',light:'#ffffff'}}).then(value=>{if(active)setQr(value);}).catch(()=>setError("Could not create a QR code. Copy the access link instead."));return()=>{active=false;};},[phone]);
 async function action(name:string,work:()=>Promise<void>){if(actionInFlight.current)return;actionInFlight.current=true;setBusy(name);setError('');setMessage('');try{await work();}catch(e){setError(String(e));}finally{actionInFlight.current=false;setBusy('');}}
 function openReader(){if(!busy)void action("Open browser",async()=>{await invoke('open_reader');});}
 function update<K extends keyof Settings>(name:K,value:Settings[K]){setSettings(previous=>previous?{...previous,[name]:value}:previous);}
 async function browse(kind:string,field:keyof Settings){const value=await invoke<string|null>('choose_path',{kind});if(value)update(field,value as never);}
 async function save(){
  if(!settings)throw Error("Settings have not loaded.");
  const result=await invoke<View>('save_settings',{settings,keyAction,key,expectedRevision:view?.revision});
  setView(result);setSettings(result.settings);setKey('');setKeyAction('keep');setReveal(false);
  return result;
 }
 function selectProvider(provider:ProviderName){
  setKey('');setKeyAction('keep');setReveal(false);
  setSettings(previous=>previous?{...previous,provider,taskReasoningEfforts:provider==='gemini'?Object.fromEntries(Object.entries(previous.taskReasoningEfforts).map(([task,value])=>[task,(geminiReasoningEfforts as readonly string[]).includes(value)?value:taskReasoningDefaults[task as keyof typeof taskReasoningDefaults]])) as Settings['taskReasoningEfforts']:previous.taskReasoningEfforts}:previous);
 }
 async function copy(value:string){await navigator.clipboard.writeText(value);setMessage("Access link copied.");}
 const links=[status.publicUrl,...status.phoneUrls].filter((link):link is string=>!!link);
 const apiProvider=settings?.provider==='gemini'||settings?.provider==='openai',openai=settings?.provider==='openai',keyPresent=settings?.provider==='gemini'?!!view?.providerKeys.gemini:settings?.provider==='openai'?!!view?.providerKeys.openai:false;
 const locked=!native||!!busy||status.running,dirty=!!settings&&!!view&&(JSON.stringify(settings)!==JSON.stringify(view.settings)||keyAction!=='keep');
 const configured=!!(view?.settings.providerConfigured||view?.runtimeConfigured);
 const serviceState:ServiceState=!native?'preview':!statusKnown?statusReadError?'unavailable':'loading':status.running?'running':'stopped';
 const previewReaderUrl=import.meta.env.DEV?localReaderUrl(import.meta.env.VITE_DESKTOP_READER_URL,window.location.href):null;
 async function startService(){
  if(!settings)throw Error("Settings have not loaded.");
  const saved=dirty?(await save()).settings:settings;
  const info=await checkNode(saved.nodePath);if(!info)throw Error("Bundled runtime unavailable. Check the runtime error.");
  const started=await invoke<Status>('start_server');acceptStatus(started);
  if(!started.running)throw Error(started.error||"The service did not start. Check settings and try again.");
 }
 function launchReader(){
  if(!native||busy)return;
  if(!configured){setTab('settings');return;}
  if(!statusKnown)return;
  void action(status.running?"Open Shiqu":"Start and open Shiqu",async()=>{if(!status.running)await startService();await invoke('open_reader');});
 }
 return <main className={'desktop-console'+(tab==='overview'?' overview-workspace':'')}>
  <header className="app-header"><div className="brand"><div className="brand-mark" aria-hidden="true">S</div><div><h1>Shiqu <span>Desktop</span></h1><p>A home for stories on your own computer.</p></div></div><span className="edition">Desktop console</span></header>
  {(error||message)&&<div className="notice" role="status" aria-live="polite">{error?<span className="error">{error}</span>:message}</div>}
  {!settings?<section className="card"><h2>{native?"Loading settings…":"Desktop app required"}</h2></section>:<div className="layout">
   <div className="desktop-left-pane">
    <div className="desktop-tabs" role="tablist" aria-label="Desktop workspace">{tabs.map(([id,label,Icon],index)=><button type="button" id={'tab-'+id} key={id} role="tab" aria-selected={tab===id} aria-controls={'panel-'+id} tabIndex={tab===id?0:-1} onClick={()=>setTab(id)} onKeyDown={event=>{const next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:null;if(next===null)return;event.preventDefault();setTab(tabs[next][0]);document.getElementById('tab-'+tabs[next][0])?.focus();}}><Icon size={17}/>{label}</button>)}</div>
    <div role="tabpanel" id={'panel-'+tab} aria-labelledby={'tab-'+tab} tabIndex={0}>
    {tab==='overview'?<OverviewPane native={native} state={serviceState} busy={busy} configured={configured} settings={view?.settings||settings} previewUrl={previewReaderUrl} onLaunch={launchReader} onQueue={()=>setTab('queue')} onSettings={()=>setTab('settings')}/>:tab==='queue'?<LibraryPane tab="queue" native={native} revision={view?.settings.dataDirectory||''}/>:<div className="settings-stack">
    <section className="card">{!view?.settings.providerConfigured&&!view?.runtimeConfigured&&<p className="help" role="status">Choose a generation service and save, or select read only. Configuration is shared with the CLI, so you only need to set it up once.</p>}<div className="section-heading"><span className="step">01</span><div><h2>Generation service</h2><p>Choose how to generate stories and illustrations.</p></div></div>
     <fieldset disabled={locked}><legend className="sr-only">Generation service settings</legend>
      <label>Provider<select value={settings.provider} onChange={e=>selectProvider(e.target.value as ProviderName)}><option value="gemini">Gemini · API key</option><option value="openai">OpenAI API · API key (billed separately)</option><option value="readonly">Read only · No generation</option><option value="codex" disabled={view?.platform==='windows'}>Codex · ChatGPT subscription{view?.platform==='windows'?" (not supported on Windows)":''}</option></select></label>
      {apiProvider?<>
       <div className="label-row"><label htmlFor="api-key">{openai?'OpenAI':'Gemini'}  API key</label><span className={keyAction==='delete'?'key-state warning':'key-state'}>{keyAction==='delete'?"Remove after saving":keyAction==='replace'?"Waiting to save locally":keyPresent?"Saved in the local database":"Not set · Read only is available"}</span></div>
       <div className="input-row"><input id="api-key" type={reveal?'text':'password'} autoComplete="off" spellCheck={false} value={key} placeholder={keyPresent?"Enter a new key to replace; leave blank to keep the saved key":`Paste your ${openai?'OpenAI':'Gemini'} API key`} onChange={e=>{setKey(e.target.value);setKeyAction(e.target.value?'replace':'keep');}}/><button className="subtle" type="button" onClick={()=>setReveal(!reveal)} aria-label={reveal?"Hide entered key":"Show entered key"}>{reveal?"Hide":"Show"}</button></div>
       <div className="key-help"><p className="help">Keys are stored as plain text in the local database, protected by system file permissions. Browsers and phones cannot read them.</p>{(keyPresent||keyAction!=='keep')&&<button className="text-button danger" onClick={()=>{setKey('');setKeyAction(keyAction==='delete'?'keep':'delete');}}>{keyAction==='delete'?"Undo removal":"Remove saved key"}</button>}</div>
       <p className="help">Environment variables override this run only and are not saved automatically. OpenAI API and Gemini use API billing; Codex uses your subscription.</p>
       {view?.credentialError&&<p className="error" role="alert">{view.credentialError}</p>}
       <div className="two-fields"><label>Text model<input value={openai?settings.openaiTextModel:settings.textModel} onChange={e=>update(openai?'openaiTextModel':'textModel',e.target.value)} spellCheck={false}/></label><label>Image model<input value={openai?settings.openaiImageModel:settings.imageModel} onChange={e=>update(openai?'openaiImageModel':'imageModel',e.target.value)} spellCheck={false}/></label></div>
      </>:settings.provider==='codex'?<>
       <p className="help">Uses the locally installed, signed-in Codex CLI. Does not use API keys or switch to API billing.</p>
       <label>Codex executable<div className="input-row"><input placeholder="Leave blank to use codex from PATH" value={settings.codexPath} onChange={e=>update('codexPath',e.target.value)}/><button className="subtle" onClick={()=>void action("Choose file",()=>browse('codex','codexPath'))}>Choose</button></div></label>
       <label>Codex text model<input value={settings.codexModel} onChange={e=>update('codexModel',e.target.value)} placeholder="Leave blank for the CLI default model"/></label>
       <label>Codex reasoning effort for other requests<select value={settings.codexReasoningEffort} onChange={e=>update('codexReasoningEffort',e.target.value as Settings['codexReasoningEffort'])}><option value="">Use Codex default</option>{codexReasoningEfforts.map(effort=><option value={effort} key={effort}>{effort}</option>)}</select></label>
       <p className="help">Used for unclassified requests such as drawing calls. Text tasks use the individual efforts below. Text reasoning effort is separate from image quality.</p>
       <label>Codex login directory (optional)<div className="input-row"><input value={settings.codexHome} onChange={e=>update('codexHome',e.target.value)} placeholder="Leave blank for the CLI default directory"/><button className="subtle" onClick={()=>void action("Choose directory",()=>browse('codexHome','codexHome'))}>Choose</button></div></label>
       <p className="help">Run codex login in your terminal first. Check the login status here afterward.</p>
      </>:<p className="help">Read and organize existing stories without generation calls. Other saved provider settings are kept.</p>}
      {settings.provider!=='readonly'&&<><div className="section-heading"><div><h3>Reasoning effort by task</h3><p>Fast recommendations; careful storyboarding and review.</p></div></div>
      <div className="two-fields">{reasoningTasks.map(task=>{
       const options=settings.provider==='gemini'?geminiReasoningEfforts:codexReasoningEfforts,value=settings.taskReasoningEfforts[task];
       return <label key={task}>{taskReasoningLabels[task]}<select value={value} onChange={e=>update('taskReasoningEfforts',{...settings.taskReasoningEfforts,[task]:e.target.value as Settings['taskReasoningEfforts'][typeof task]})}>
        {!(options as readonly string[]).includes(value)&&<option value={value} disabled>{value} (unsupported by this provider; adjust)</option>}
        {options.map(effort=><option value={effort} key={effort}>{effort}{effort===taskReasoningDefaults[task]?" (recommended)":''}</option>)}
       </select></label>;
      })}</div>
      <p className="help">Initial review and recheck use the same effort. Gemini supports low, medium, and high. Available OpenAI API and Codex efforts depend on the model. Changes apply the next time the service starts.</p></>}
      <div className="test-row"><button className="secondary" onClick={()=>void action("Check connection",async()=>{if(dirty)await save();const result=await invoke<{ok:boolean;message:string}>('test_provider');if(result.ok)setMessage(result.message);else setError(result.message);})}>Check connection</button><span className="help">Saves settings first. Checks access or login without generating content.</span></div>
      <button className="text-button danger" disabled={locked} onClick={()=>{if(window.confirm("Clear all saved provider selections, models, and API keys? Stories, library, and network settings will remain."))void action("Reset providers",async()=>{const result=await invoke<View>('reset_providers');setView(result);setSettings(result.settings);setKey('');setKeyAction('keep');setReveal(false);setTab('settings');setMessage("Provider configuration reset. Choose a provider or use read only.");});}}>Reset all provider settings</button>
     </fieldset>
    </section>
    <section className="card"><div className="section-heading"><span className="step">02</span><div><h2>Local runtime</h2><p>Your runtime and story data stay under your control.</p></div></div>
     <fieldset disabled={locked}><legend className="sr-only">Local runtime settings</legend>
      <label>Runtime<input value={node?`Bundled Node ${node.version}`:"Bundled Node 24"} readOnly/></label>
      <div className="node-check"><span className={node?'success':'help'}>{node?`Node ${node.version} · SQLite available`:!native?'—':nodeError||"Checking Node 24…"}</span><button className="text-button" onClick={()=>void action("Check runtime",async()=>{await checkNode(settings.nodePath);})}>Check runtime</button></div>
      <label>Story data directory<div className="input-row"><input value={settings.dataDirectory} onChange={e=>update('dataDirectory',e.target.value)}/><button className="subtle" onClick={()=>void action("Choose directory",()=>browse('data','dataDirectory'))}>Choose</button></div></label>
      <p className="help">Stores SQLite and images. Changing this directory switches shelves without moving existing data.</p>
      <label className="port-field">Service port<input type="number" min="1024" max="65535" value={settings.port} onChange={e=>update('port',Number(e.target.value))}/></label>
     </fieldset>
     <div className="save-row"><button className="text-button" disabled={locked} onClick={()=>void action("Reload",async()=>{const result=await invoke<View>('get_settings');setView(result);setSettings(result.settings);setKey('');setKeyAction('keep');})}>Reload settings</button><span className="help">{status.running?"Stop the service to edit settings.":dirty?"You have unsaved changes.":"Settings synced."}</span><button className="secondary" disabled={locked||!dirty} onClick={()=>void action("Save settings",async()=>{await save();setMessage("Settings saved.");})}>Save settings</button></div>
    </section>
   </div>}
    </div>
   </div>
   <aside className="service-stack">
    <ServiceCard state={serviceState} running={status.running} busy={busy} native={native} configured={configured} toggleDisabled={!!busy||!native||configured&&!statusKnown} url={status.url} nodeVersion={node?.version} nodeError={nodeError} directory={view?.settings.dataDirectory||settings.dataDirectory} error={statusReadError||status.error||''} onOpen={openReader} onCopy={()=>{if(status.url)void action("Copy link",()=>copy(status.url!));}} onToggle={()=>{if(!configured){setTab('settings');return;}void action(status.running?"Stop service":"Start service",async()=>{if(status.running)acceptStatus(await invoke<Status>('stop_server'));else await startService();});}}/>
    <PhoneAccessCard state={serviceState} running={status.running} busy={!!busy} locked={locked} links={links} phone={phone} publicUrl={status.publicUrl} qr={qr} internetEnabled={settings.internetEnabled} cloudflaredPath={settings.cloudflaredPath} internetError={status.internetError} onChoose={setPhone} onInternetChange={enabled=>update('internetEnabled',enabled)} onCloudflaredChange={value=>update('cloudflaredPath',value)} onCopy={()=>void action("Copy link",()=>copy(phone))}/>
   </aside>
  </div>}
  <footer><span>Shiqu · Bundled Node 24</span><button className="text-button" disabled={!!busy||!native} onClick={()=>void action("Quit",async()=>{await invoke('quit_app');})}>Quit Shiqu</button></footer>
 </main>;
}
createRoot(document.getElementById('root')!).render(<Desktop/>);
