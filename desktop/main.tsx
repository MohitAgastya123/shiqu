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
import {defaultSystemSettings,effectiveImageProvider,isApiProvider} from '../lib/system-settings';
import type {SystemSettings,ProviderName,ImageProviderName,ApiProviderName} from '../lib/system-settings';
import './styles.css';

type Settings=SystemSettings;
type View={settings:Settings;revision:number;keyPresent:boolean;imageKeyPresent?:boolean;providerKeys:{gemini:boolean;openai:boolean};runtimeConfigured:boolean;credentialError:string|null;platform:string};
type Status={running:boolean;url?:string;phoneUrls:string[];publicUrl?:string;internetError?:string;error?:string};
type NodeInfo={path:string;version:string;sqlite:boolean};
type KeyAction='keep'|'replace'|'delete';
type DesktopTab='overview'|'queue'|'settings';
const tabs=[['overview','概览',LayoutDashboard],['queue','生成队列',Layers3],['settings','设置',Settings2]] as const;
const previewSettings=defaultSystemSettings('桌面应用中保存的故事目录');
const apiLabels:Record<ApiProviderName,string>={openai:'OpenAI',gemini:'Gemini'};
type KeyFieldProps={id:string;provider:ApiProviderName;label:string;present:boolean;action:KeyAction;value:string;reveal:boolean;onValue:(value:string)=>void;onReveal:()=>void;onToggleDelete:()=>void};
// One saved credential per API provider; text and image sides edit their own provider's key.
function KeyField({id,provider,label,present,action,value,reveal,onValue,onReveal,onToggleDelete}:KeyFieldProps){
 return <>
  <div className="label-row"><label htmlFor={id}>{label}</label><span className={action==='delete'?'key-state warning':'key-state'}>{action==='delete'?'保存后删除':action==='replace'?'等待保存到本机':present?'已保存到本机数据库':'未设置 · 可选择只读'}</span></div>
  <div className="input-row"><input id={id} type={reveal?'text':'password'} autoComplete="off" spellCheck={false} value={value} placeholder={present?'输入新密钥以替换；留空保留已保存密钥':`粘贴你的 ${apiLabels[provider]} API 密钥`} onChange={e=>onValue(e.target.value)}/><button className="subtle" type="button" onClick={onReveal} aria-label={reveal?'隐藏输入的密钥':'显示输入的密钥'}>{reveal?'隐藏':'显示'}</button></div>
  <div className="key-help"><p className="help">密钥以明文保存在本机数据库，由系统文件权限保护。浏览器与手机无法读取。</p>{(present||action!=='keep')&&<button className="text-button danger" onClick={onToggleDelete}>{action==='delete'?'撤销删除':'删除已保存的密钥'}</button>}</div>
 </>;
}

function Desktop(){
 const [tab,setTab]=useState<DesktopTab>('overview');
 const [view,setView]=useState<View|null>(null),[settings,setSettings]=useState<Settings|null>(null),[status,setStatus]=useState<Status>({running:false,phoneUrls:[]});
 const [key,setKey]=useState(''),[keyAction,setKeyAction]=useState<KeyAction>('keep'),[reveal,setReveal]=useState(false),[imageKey,setImageKey]=useState(''),[imageKeyAction,setImageKeyAction]=useState<KeyAction>('keep'),[imageReveal,setImageReveal]=useState(false),[node,setNode]=useState<NodeInfo|null>(null),[nodeError,setNodeError]=useState('');
 const [busy,setBusy]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState(''),[phone,setPhone]=useState(''),[qr,setQr]=useState('');
 const native=isTauri();
 const [statusKnown,setStatusKnown]=useState(false),[statusReadError,setStatusReadError]=useState('');
 const statusEpoch=useRef(0);
 const actionInFlight=useRef(false);
 function acceptStatus(result:Status){statusEpoch.current++;setStatus(result);setStatusKnown(true);setStatusReadError('');}
 async function checkNode(nodePath:string){try{const info=await invoke<NodeInfo>('detect_node',{nodePath});setNode(info);setNodeError('');return info;}catch(e){setNode(null);setNodeError(String(e));return null;}}
 useEffect(()=>{
  if(!native){if(import.meta.env.DEV){setSettings(previewSettings);setView({settings:previewSettings,keyPresent:false,credentialError:null,platform:'preview',revision:0,providerKeys:{gemini:false,openai:false},runtimeConfigured:false});}else setError('请在拾趣桌面应用中打开。');return;}
  void invoke<View>('get_settings').then(result=>{setView(result);setSettings(result.settings);if(!result.settings.providerConfigured&&!result.runtimeConfigured)setTab('settings');void checkNode(result.settings.nodePath);}).catch(e=>setError(String(e)));
  let active=true,inFlight=false;
  function readStatus(){if(inFlight)return;inFlight=true;const epoch=statusEpoch.current;void invoke<Status>('server_status').then(result=>{if(active&&epoch===statusEpoch.current){setStatus(result);setStatusKnown(true);setStatusReadError('');}}).catch(()=>{if(active&&epoch===statusEpoch.current){setStatusKnown(false);setStatusReadError('暂时无法读取服务状态，正在重试。');}}).finally(()=>{inFlight=false;});}
  readStatus();const timer=setInterval(readStatus,2000);
  return()=>{active=false;clearInterval(timer);};
 },[native]);
 useEffect(()=>{const links=[status.publicUrl,...status.phoneUrls].filter((link):link is string=>!!link);setPhone(current=>links.includes(current)?current:links[0]||'');},[status.publicUrl,status.phoneUrls.join('|')]);
 useEffect(()=>{let active=true;setQr('');if(phone)void QRCode.toDataURL(phone,{width:240,margin:2,color:{dark:'#193d30',light:'#ffffff'}}).then(value=>{if(active)setQr(value);}).catch(()=>setError('二维码生成失败，请复制访问链接。'));return()=>{active=false;};},[phone]);
 async function action(name:string,work:()=>Promise<void>){if(actionInFlight.current)return;actionInFlight.current=true;setBusy(name);setError('');setMessage('');try{await work();}catch(e){setError(String(e));}finally{actionInFlight.current=false;setBusy('');}}
 function openReader(){if(!busy)void action('打开浏览器',async()=>{await invoke('open_reader');});}
 function update<K extends keyof Settings>(name:K,value:Settings[K]){setSettings(previous=>previous?{...previous,[name]:value}:previous);}
 async function browse(kind:string,field:keyof Settings){const value=await invoke<string|null>('choose_path',{kind});if(value)update(field,value as never);}
 async function save(){
  if(!settings)throw Error('设置尚未加载。');
  const result=await invoke<View>('save_settings',{settings,keyAction,key,imageKeyAction,imageKey,expectedRevision:view?.revision});
  setView(result);setSettings(result.settings);clearKeys();
  return result;
 }
 function clearKeys(){setKey('');setKeyAction('keep');setReveal(false);setImageKey('');setImageKeyAction('keep');setImageReveal(false);}
 function selectImageProvider(imageProvider:ImageProviderName|''){
  setImageKey('');setImageKeyAction('keep');setImageReveal(false);
  setSettings(previous=>previous?{...previous,imageProvider:imageProvider&&imageProvider!==previous.provider?imageProvider:undefined}:previous);
 }
 function selectProvider(provider:ProviderName){
  // A typed image key survives a text-provider change unless the effective image provider changes.
  setKey('');setKeyAction('keep');setReveal(false);
  if(settings){const next={...settings,provider,imageProvider:settings.imageProvider===provider?undefined:settings.imageProvider};if(effectiveImageProvider(next)!==effectiveImageProvider(settings)){setImageKey('');setImageKeyAction('keep');setImageReveal(false);}}
  setSettings(previous=>previous?{...previous,provider,imageProvider:previous.imageProvider===provider?undefined:previous.imageProvider,taskReasoningEfforts:provider==='gemini'?Object.fromEntries(Object.entries(previous.taskReasoningEfforts).map(([task,value])=>[task,(geminiReasoningEfforts as readonly string[]).includes(value)?value:taskReasoningDefaults[task as keyof typeof taskReasoningDefaults]])) as Settings['taskReasoningEfforts']:previous.taskReasoningEfforts}:previous);
 }
 async function copy(value:string){await navigator.clipboard.writeText(value);setMessage('访问链接已复制。');}
 const links=[status.publicUrl,...status.phoneUrls].filter((link):link is string=>!!link);
 const apiProvider=settings?.provider==='gemini'||settings?.provider==='openai',openai=settings?.provider==='openai',keyPresent=settings?.provider==='gemini'?!!view?.providerKeys.gemini:settings?.provider==='openai'?!!view?.providerKeys.openai:false;
 const imageProvider=settings?effectiveImageProvider(settings):null,separateImage=!!imageProvider&&imageProvider!==settings?.provider,imageKeyPresent=isApiProvider(imageProvider)?!!view?.providerKeys[imageProvider]:false;
 const locked=!native||!!busy||status.running,dirty=!!settings&&!!view&&(JSON.stringify(settings)!==JSON.stringify(view.settings)||keyAction!=='keep'||imageKeyAction!=='keep');
 const configured=!!(view?.settings.providerConfigured||view?.runtimeConfigured);
 const serviceState:ServiceState=!native?'preview':!statusKnown?statusReadError?'unavailable':'loading':status.running?'running':'stopped';
 const previewReaderUrl=import.meta.env.DEV?localReaderUrl(import.meta.env.VITE_DESKTOP_READER_URL,window.location.href):null;
 async function startService(){
  if(!settings)throw Error('设置尚未加载。');
  const saved=dirty?(await save()).settings:settings;
  const info=await checkNode(saved.nodePath);if(!info)throw Error('内置运行时不可用，请检查运行时错误。');
  const started=await invoke<Status>('start_server');acceptStatus(started);
  if(!started.running)throw Error(started.error||'服务尚未成功启动，请检查设置后重试。');
 }
 function launchReader(){
  if(!native||busy)return;
  if(!configured){setTab('settings');return;}
  if(!statusKnown)return;
  void action(status.running?'打开拾趣':'启动并打开拾趣',async()=>{if(!status.running)await startService();await invoke('open_reader');});
 }
 return <main className={'desktop-console'+(tab==='overview'?' overview-workspace':'')}>
  <header className="app-header"><div className="brand"><div className="brand-mark" aria-hidden="true">拾</div><div><h1>拾趣 <span>桌面版</span></h1><p>在自己的电脑上，留一间故事书房。</p></div></div><span className="edition">桌面控制台</span></header>
  {(error||message)&&<div className="notice" role="status" aria-live="polite">{error?<span className="error">{error}</span>:message}</div>}
  {!settings?<section className="card"><h2>{native?'正在读取设置…':'需要桌面应用'}</h2></section>:<div className="layout">
   <div className="desktop-left-pane">
    <div className="desktop-tabs" role="tablist" aria-label="桌面工作区">{tabs.map(([id,label,Icon],index)=><button type="button" id={'tab-'+id} key={id} role="tab" aria-selected={tab===id} aria-controls={'panel-'+id} tabIndex={tab===id?0:-1} onClick={()=>setTab(id)} onKeyDown={event=>{const next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:null;if(next===null)return;event.preventDefault();setTab(tabs[next][0]);document.getElementById('tab-'+tabs[next][0])?.focus();}}><Icon size={17}/>{label}</button>)}</div>
    <div role="tabpanel" id={'panel-'+tab} aria-labelledby={'tab-'+tab} tabIndex={0}>
    {tab==='overview'?<OverviewPane native={native} state={serviceState} busy={busy} configured={configured} settings={view?.settings||settings} previewUrl={previewReaderUrl} onLaunch={launchReader} onQueue={()=>setTab('queue')} onSettings={()=>setTab('settings')}/>:tab==='queue'?<LibraryPane tab="queue" native={native} revision={view?.settings.dataDirectory||''}/>:<div className="settings-stack">
    <section className="card">{!view?.settings.providerConfigured&&!view?.runtimeConfigured&&<p className="help" role="status">首次使用，请选择生成服务并保存；也可选择只读模式。配置与 CLI 共用，保存后无需再次设置。</p>}<div className="section-heading"><span className="step">01</span><div><h2>生成服务</h2><p>选择故事与插图的生成方式。</p></div></div>
     <fieldset disabled={locked}><legend className="sr-only">生成服务设置</legend>
      <label>文本服务<select value={settings.provider} onChange={e=>selectProvider(e.target.value as ProviderName)}><option value="gemini">Gemini · API 密钥</option><option value="openai">OpenAI API · API 密钥（单独计费）</option><option value="readonly">只读 · 不生成内容</option><option value="codex" disabled={view?.platform==='windows'}>Codex · ChatGPT 订阅{view?.platform==='windows'?'（Windows 暂不支持）':''}</option></select></label>
      {settings.provider!=='readonly'&&<><label>图片服务<select value={settings.imageProvider||''} onChange={e=>selectImageProvider(e.target.value as ImageProviderName|'')}><option value="">与文本服务相同</option><option value="gemini">Gemini · API 密钥</option><option value="openai">OpenAI API · API 密钥（单独计费）</option><option value="codex" disabled={view?.platform==='windows'}>Codex · ChatGPT 订阅{view?.platform==='windows'?'（Windows 暂不支持）':''}</option></select></label>
       <p className="help">故事、分镜与审核使用文本服务，插图使用图片服务；制作流程不变。</p></>}
      {apiProvider?<>
       <KeyField id="api-key" provider={openai?'openai':'gemini'} label={`${openai?'OpenAI':'Gemini'} API 密钥`} present={keyPresent} action={keyAction} value={key} reveal={reveal} onValue={value=>{setKey(value);setKeyAction(value?'replace':'keep');}} onReveal={()=>setReveal(!reveal)} onToggleDelete={()=>{setKey('');setKeyAction(keyAction==='delete'?'keep':'delete');}}/>
       <p className="help">环境变量只覆盖本次运行，不会自动保存。OpenAI API 与 Gemini 使用 API 计费，Codex 使用订阅额度。</p>
       {view?.credentialError&&<p className="error" role="alert">{view.credentialError}</p>}
       <div className="two-fields"><label>文本模型<input value={openai?settings.openaiTextModel:settings.textModel} onChange={e=>update(openai?'openaiTextModel':'textModel',e.target.value)} spellCheck={false}/></label>{!separateImage&&<label>图片模型<input value={openai?settings.openaiImageModel:settings.imageModel} onChange={e=>update(openai?'openaiImageModel':'imageModel',e.target.value)} spellCheck={false}/></label>}</div>
      </>:settings.provider==='codex'?<>
       <p className="help">使用本机已安装并登录的 Codex CLI。不会使用 API 密钥，也不会切换到 API 计费。</p>
       <label>Codex 可执行文件<div className="input-row"><input placeholder="留空使用 PATH 中的 codex" value={settings.codexPath} onChange={e=>update('codexPath',e.target.value)}/><button className="subtle" onClick={()=>void action('选择文件',()=>browse('codex','codexPath'))}>选择</button></div></label>
       <label>Codex 文本模型<input value={settings.codexModel} onChange={e=>update('codexModel',e.target.value)} placeholder="留空使用 CLI 默认模型"/></label>
       <label>Codex 其他请求推理档位<select value={settings.codexReasoningEffort} onChange={e=>update('codexReasoningEffort',e.target.value as Settings['codexReasoningEffort'])}><option value="">跟随 Codex 默认</option>{codexReasoningEfforts.map(effort=><option value={effort} key={effort}>{effort}</option>)}</select></label>
       <p className="help">用于绘图调用等未分类请求；文本任务采用下方各自的档位。文字推理档位不等于图片质量。</p>
       <label>Codex 登录目录（可选）<div className="input-row"><input value={settings.codexHome} onChange={e=>update('codexHome',e.target.value)} placeholder="留空使用 CLI 默认目录"/><button className="subtle" onClick={()=>void action('选择目录',()=>browse('codexHome','codexHome'))}>选择</button></div></label>
       <p className="help">首次登录需先在终端执行 codex login；此处可检查登录状态。</p>
      </>:<p className="help">只阅读和整理已有故事，不调用生成服务；其他已保存的服务配置仍保留。</p>}
      {separateImage&&<><div className="section-heading"><div><h3>图片服务</h3><p>只用于绘制插图，与文本服务分别配置。</p></div></div>
       {isApiProvider(imageProvider)?<>
        <KeyField id="image-api-key" provider={imageProvider} label={`图片 · ${apiLabels[imageProvider]} API 密钥`} present={imageKeyPresent} action={imageKeyAction} value={imageKey} reveal={imageReveal} onValue={value=>{setImageKey(value);setImageKeyAction(value?'replace':'keep');}} onReveal={()=>setImageReveal(!imageReveal)} onToggleDelete={()=>{setImageKey('');setImageKeyAction(imageKeyAction==='delete'?'keep':'delete');}}/>
        <label>图片模型<input value={imageProvider==='openai'?settings.openaiImageModel:settings.imageModel} onChange={e=>update(imageProvider==='openai'?'openaiImageModel':'imageModel',e.target.value)} spellCheck={false}/></label>
       </>:<>
        <p className="help">使用本机已安装并登录的 Codex CLI 绘图，消耗订阅额度，不使用 API 密钥。</p>
        <label>Codex 可执行文件<div className="input-row"><input placeholder="留空使用 PATH 中的 codex" value={settings.codexPath} onChange={e=>update('codexPath',e.target.value)}/><button className="subtle" onClick={()=>void action('选择文件',()=>browse('codex','codexPath'))}>选择</button></div></label>
        <label>Codex 绘图推理档位<select value={settings.codexReasoningEffort} onChange={e=>update('codexReasoningEffort',e.target.value as Settings['codexReasoningEffort'])}><option value="">跟随 Codex 默认</option>{codexReasoningEfforts.map(effort=><option value={effort} key={effort}>{effort}</option>)}</select></label>
        <label>Codex 登录目录（可选）<div className="input-row"><input value={settings.codexHome} onChange={e=>update('codexHome',e.target.value)} placeholder="留空使用 CLI 默认目录"/><button className="subtle" onClick={()=>void action('选择目录',()=>browse('codexHome','codexHome'))}>选择</button></div></label>
       </>}
      </>}
      {settings.provider!=='readonly'&&<><div className="section-heading"><div><h3>按任务分配推理档位</h3><p>简单推荐优先速度，分镜与审核优先质量。</p></div></div>
      <div className="two-fields">{reasoningTasks.map(task=>{
       const options=settings.provider==='gemini'?geminiReasoningEfforts:codexReasoningEfforts,value=settings.taskReasoningEfforts[task];
       return <label key={task}>{taskReasoningLabels[task]}<select value={value} onChange={e=>update('taskReasoningEfforts',{...settings.taskReasoningEfforts,[task]:e.target.value as Settings['taskReasoningEfforts'][typeof task]})}>
        {!(options as readonly string[]).includes(value)&&<option value={value} disabled>{value}（此提供方不支持，请调整）</option>}
        {options.map(effort=><option value={effort} key={effort}>{effort}{effort===taskReasoningDefaults[task]?'（推荐）':''}</option>)}
       </select></label>;
      })}</div>
      <p className="help">初审与复核使用同一档位。Gemini 支持 low、medium、high；OpenAI API 与 Codex 的可用档位取决于模型。保存后在下次启动服务时生效。</p></>}
      <div className="test-row"><button className="secondary" onClick={()=>void action('检查连接',async()=>{if(dirty)await save();const result=await invoke<{ok:boolean;message:string}>('test_provider');if(result.ok)setMessage(result.message);else setError(result.message);})}>检查连接</button><span className="help">检查前保存配置；仅检查访问或登录，不生成内容。</span></div>
      <button className="text-button danger" disabled={locked} onClick={()=>{if(window.confirm('清除所有已保存的服务选择、模型和 API 密钥？故事、书库与网络设置保留。'))void action('重置服务',async()=>{const result=await invoke<View>('reset_providers');setView(result);setSettings(result.settings);clearKeys();setTab('settings');setMessage('服务配置已重置，请重新选择或使用只读模式。');});}}>重置所有服务配置</button>
     </fieldset>
    </section>
    <section className="card"><div className="section-heading"><span className="step">02</span><div><h2>本地运行</h2><p>运行时与故事数据，由你掌握。</p></div></div>
     <fieldset disabled={locked}><legend className="sr-only">本地运行设置</legend>
      <label>运行时<input value={node?`内置 Node ${node.version}`:'内置 Node 24'} readOnly/></label>
      <div className="node-check"><span className={node?'success':'help'}>{node?`Node ${node.version} · SQLite 可用`:!native?'—':nodeError||'正在检查 Node 24…'}</span><button className="text-button" onClick={()=>void action('检查运行时',async()=>{await checkNode(settings.nodePath);})}>检查运行时</button></div>
      <label>故事数据目录<div className="input-row"><input value={settings.dataDirectory} onChange={e=>update('dataDirectory',e.target.value)}/><button className="subtle" onClick={()=>void action('选择目录',()=>browse('data','dataDirectory'))}>选择</button></div></label>
      <p className="help">保存 SQLite 和图片。更换目录会切换书架，不会搬移已有数据。</p>
      <label className="port-field">服务端口<input type="number" min="1024" max="65535" value={settings.port} onChange={e=>update('port',Number(e.target.value))}/></label>
     </fieldset>
     <div className="save-row"><button className="text-button" disabled={locked} onClick={()=>void action('重新读取',async()=>{const result=await invoke<View>('get_settings');setView(result);setSettings(result.settings);clearKeys();})}>重新读取设置</button><span className="help">{status.running?'停止服务后可修改设置。':dirty?'有尚未保存的更改。':'设置已同步。'}</span><button className="secondary" disabled={locked||!dirty} onClick={()=>void action('保存设置',async()=>{await save();setMessage('设置已保存。');})}>保存设置</button></div>
    </section>
   </div>}
    </div>
   </div>
   <aside className="service-stack">
    <ServiceCard state={serviceState} running={status.running} busy={busy} native={native} configured={configured} toggleDisabled={!!busy||!native||configured&&!statusKnown} url={status.url} nodeVersion={node?.version} nodeError={nodeError} directory={view?.settings.dataDirectory||settings.dataDirectory} error={statusReadError||status.error||''} onOpen={openReader} onCopy={()=>{if(status.url)void action('复制链接',()=>copy(status.url!));}} onToggle={()=>{if(!configured){setTab('settings');return;}void action(status.running?'停止服务':'启动服务',async()=>{if(status.running)acceptStatus(await invoke<Status>('stop_server'));else await startService();});}}/>
    <PhoneAccessCard state={serviceState} running={status.running} busy={!!busy} locked={locked} links={links} phone={phone} publicUrl={status.publicUrl} qr={qr} internetEnabled={settings.internetEnabled} cloudflaredPath={settings.cloudflaredPath} internetError={status.internetError} onChoose={setPhone} onInternetChange={enabled=>update('internetEnabled',enabled)} onCloudflaredChange={value=>update('cloudflaredPath',value)} onCopy={()=>void action('复制链接',()=>copy(phone))}/>
   </aside>
  </div>}
  <footer><span>拾趣 · 内置 Node 24</span><button className="text-button" disabled={!!busy||!native} onClick={()=>void action('退出',async()=>{await invoke('quit_app');})}>退出拾趣</button></footer>
 </main>;
}
createRoot(document.getElementById('root')!).render(<Desktop/>);
