// The English service console manages local service, paths, and access; the browser owns story actions and generation settings.
import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {invoke,isTauri} from '@tauri-apps/api/core';
import QRCode from 'qrcode';
import {ServiceCard} from './ServiceCard';
import {PhoneAccessCard} from './PhoneAccessCard';
import {localReaderUrl} from './reader-url';
import {savedProvider} from './console-state';
import type {Status,ServiceState} from './console-state';
import {defaultSystemSettings} from '../lib/system-settings';
import type {SystemSettings} from '../lib/system-settings';
import './styles.css';
type View={settings:SystemSettings;revision:number;providerKeys?:{gemini:boolean;openai:boolean}};
type NodeInfo={version:string};
const nativeFields=['dataDirectory','port','internetEnabled','cloudflaredPath','codexPath','codexHome'] as const;
const nativeValues=(settings:SystemSettings)=>Object.fromEntries(nativeFields.map(name=>[name,settings[name]]));
const preview=defaultSystemSettings("Story directory saved in the desktop app");
function Desktop(){
 const native=isTauri(),[view,setView]=useState<View|null>(null),[settings,setSettings]=useState<SystemSettings|null>(null),[status,setStatus]=useState<Status>({running:false,phoneUrls:[]});
 const [known,setKnown]=useState(false),[statusError,setStatusError]=useState(''),[busy,setBusy]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState(''),[node,setNode]=useState<NodeInfo|null>(null),[nodeError,setNodeError]=useState('');
 const [phone,setPhone]=useState(''),[qr,setQr]=useState('');
 const inFlight=useRef(false),dirtyRef=useRef(false),epoch=useRef(0);
 const dirty=!!view&&!!settings&&JSON.stringify(nativeValues(settings))!==JSON.stringify(nativeValues(view.settings));dirtyRef.current=dirty;
 function adopt(next:View){setView(next);setSettings(next.settings);}
 function accept(next:Status){epoch.current++;setStatus(next);setKnown(true);setStatusError('');}
 async function reload(){adopt(await invoke<View>('get_settings'));}
 async function checkNode(){try{setNode(await invoke<NodeInfo>('detect_node',{nodePath:''}));setNodeError('');}catch{setNodeError("The bundled runtime is unavailable. Reinstall Shiqu.");}}
 useEffect(()=>{
  if(!native){adopt({settings:preview,revision:0});return;}
  void reload().catch(e=>setError(String(e)));void checkNode();
  let live=true,polling=false;
  async function poll(){if(polling)return;polling=true;const started=epoch.current;try{const next=await invoke<Status>('server_status');if(live&&started===epoch.current){setStatus(next);setKnown(true);setStatusError('');}const current=await invoke<View>('get_settings');if(live&&!dirtyRef.current)adopt(current);}catch{if(live&&started===epoch.current){setKnown(false);setStatusError("Could not read service status. Retrying.");}}finally{polling=false;}}
  void poll();const timer=setInterval(()=>void poll(),2000);return()=>{live=false;clearInterval(timer);};
 },[native]);
 const links=[status.publicUrl,...status.phoneUrls].filter((url):url is string=>!!url);
 useEffect(()=>{setPhone(current=>links.includes(current)?current:links[0]||'');},[links.join('|')]);
 useEffect(()=>{let live=true;setQr('');if(phone)void QRCode.toDataURL(phone,{width:240,margin:2,color:{dark:'#193d30',light:'#ffffff'}}).then(next=>{if(live)setQr(next);}).catch(()=>setError("Could not create a QR code. Copy the access link instead."));return()=>{live=false;};},[phone]);
 async function action(name:string,work:()=>Promise<void>){if(inFlight.current)return;inFlight.current=true;setBusy(name);setError('');setMessage('');try{await work();}catch(e){setError(String(e));}finally{inFlight.current=false;setBusy('');}}
 function update<K extends keyof SystemSettings>(name:K,value:SystemSettings[K]){setSettings(current=>current?{...current,[name]:value}:current);}
 async function browse(kind:string,field:keyof SystemSettings){const path=await invoke<string|null>('choose_path',{kind});if(path)update(field,path as never);}
 async function save(){if(!settings||!view)throw Error("Reload settings before saving.");const result=await invoke<View>('save_settings',{settings:nativeValues(settings),expectedRevision:view.revision});adopt(result);return result;}
 async function start(){if(dirty)await save();accept({running:false,phoneUrls:[],state:'starting'});try{const next=await invoke<Status>('start_server');accept(next);if(!next.running)throw Error(next.error||"The service has not started.");}catch(e){accept({running:false,phoneUrls:[],state:'failed',error:String(e)});throw e;}}
 async function stop(){accept(await invoke<Status>('stop_server'));await reload();}
 async function restart(){if(!window.confirm(status.generating?"A story is generating. Restarting will stop the current work; you can continue it in the browser afterward. Restart now?":"Restarting stops any active generation. You can continue it in the browser afterward. Restart now?"))return;await stop();await start();}
 async function copy(value:string){await navigator.clipboard.writeText(value);setMessage("Access link copied.");}
 const state:ServiceState=!native?'preview':!known?statusError?'unavailable':'loading':status.state==='upgrading'||status.state==='starting'?status.state:status.running?'running':status.error?'failed':'stopped';
 const locked=!native||!!busy||!known||status.running||state==='starting'||state==='upgrading';
 const previewUrl=import.meta.env.DEV?localReaderUrl(import.meta.env.VITE_DESKTOP_READER_URL,window.location.href):null;
 return <main className="desktop-console"><header className="app-header"><div className="brand"><div className="brand-mark" aria-hidden="true">S</div><div><h1>Shiqu <span>Desktop console</span></h1><p>Your story library, ready whenever you are.</p></div></div></header>
  {(error||message||statusError)&&<div className="notice" role="status">{error||statusError?<span className="error">{error||statusError}</span>:message}</div>}
  {!settings?<section className="card"><h2>Loading local settings…</h2><button onClick={()=>void action("Load settings",reload)}>Reload settings</button></section>:<div className="layout"><div className="settings-stack">
   <ServiceCard state={state} status={status} native={native} busy={busy} provider={status.running&&status.provider?status.provider:savedProvider(view?.settings||settings,view?.providerKeys)} nodeVersion={node?.version} nodeError={nodeError} onStart={()=>void action("Start service",start)} onStop={()=>void action("Stop service",stop)} onRestart={()=>void action("Restart service",restart)} onOpen={()=>void action("Open browser",async()=>{await invoke('open_reader');})} onSettings={()=>void action("Open generation settings",async()=>{await invoke('open_reader',{generationSettings:true});})} previewUrl={previewUrl}/>
   <section className="card local-settings"><div className="section-heading"><h2>Computer and storage</h2><p>Stop the service before editing.</p></div><fieldset disabled={locked}><legend className="sr-only">Local settings</legend>
    <label>Story data directory<div className="input-row"><input value={settings.dataDirectory} onChange={e=>update('dataDirectory',e.target.value)}/><button className="secondary" onClick={()=>void action("Choose directory",()=>browse('data','dataDirectory'))}>Choose directory</button></div></label>
    <label className="port-field">Service port<input type="number" min="1024" max="65535" value={settings.port} onChange={e=>update('port',Number(e.target.value))}/></label>
    <details className="advanced-settings"><summary>Advanced settings</summary><p className="help">Change these only to customize the Codex executable or login directory. Leave blank to use defaults.</p>
    <label>Codex executable<div className="input-row"><input value={settings.codexPath} placeholder="Leave blank to use codex from PATH" onChange={e=>update('codexPath',e.target.value)}/><button className="secondary" onClick={()=>void action("Choose file",()=>browse('codex','codexPath'))}>Choose file</button></div></label>
    <label>Codex login directory<div className="input-row"><input value={settings.codexHome} placeholder="Leave blank for the default login directory" onChange={e=>update('codexHome',e.target.value)}/><button className="secondary" onClick={()=>void action("Choose directory",()=>browse('codexHome','codexHome'))}>Choose directory</button></div></label>
    </details>
   </fieldset><div className="save-row"><p className="help">{dirty?"You have unsaved local changes":"Matches saved settings"}</p><button className="secondary" disabled={!native||!!busy} onClick={()=>void action("Load settings",reload)}>Reload settings</button><button className="secondary" disabled={locked||!dirty} onClick={()=>void action("Save settings",async()=>{await save();setMessage("Local settings saved.");})}>Save local settings</button></div></section>
  </div><PhoneAccessCard state={state} running={status.running} busy={!!busy} locked={locked} links={links} phone={phone} publicUrl={status.publicUrl} qr={qr} internetEnabled={settings.internetEnabled} cloudflaredPath={settings.cloudflaredPath} internetError={status.internetError} onChoose={setPhone} onInternetChange={value=>update('internetEnabled',value)} onCloudflaredChange={value=>update('cloudflaredPath',value)} onBrowseCloudflared={()=>void action("Choose file",()=>browse('cloudflared','cloudflaredPath'))} onCopy={()=>void action("Copy link",()=>copy(phone))}/></div>}
  <footer><span>Closing the window keeps Shiqu in the tray. Quitting stops the service.</span><button className="text-button" disabled={!native||!!busy} onClick={()=>void action("Quit app",async()=>{await invoke('quit_app');})}>Quit Shiqu</button></footer>
 </main>;
}
createRoot(document.getElementById('root')!).render(<Desktop/>);
