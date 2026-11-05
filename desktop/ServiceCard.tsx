// Present service actions first, keeping runtime and storage details available on demand.
// Native lifecycle and clipboard operations remain owned by the desktop controller.
import {ChevronRight,Copy,ExternalLink,Server,Square} from 'lucide-react';
import type {ServiceState} from './library-summary';

type Props={state:ServiceState;running:boolean;busy:string;native:boolean;configured:boolean;toggleDisabled:boolean;url?:string;nodeVersion?:string;nodeError:string;directory:string;error:string;onToggle:()=>void;onOpen:()=>void;onCopy:()=>void};
const stateLabels:Record<ServiceState,string>={running:'运行中',stopped:'已停止',loading:'读取中',unavailable:'状态未知',preview:''};

export function ServiceCard({state,running,busy,native,configured,toggleDisabled,url,nodeVersion,nodeError,directory,error,onToggle,onOpen,onCopy}:Props){
 const toggleLabel=busy?busy+'…':!native?'启动服务':!configured?'先完成设置':running?'停止服务':'启动服务';
 return <section className="runtime-card" aria-labelledby="runtime-title">
  <div className="runtime-heading"><span className="runtime-icon" aria-hidden="true"><Server size={19} strokeWidth={1.5}/></span><h2 id="runtime-title">本机服务</h2>{state!=='preview'&&<span className={'runtime-state is-'+state} role="status"><i aria-hidden="true"/>{stateLabels[state]}</span>}</div>
  {error&&!busy&&<p className="runtime-error" role="alert">{error}</p>}
  <div className="runtime-actions">
   {state==='running'&&<button className="runtime-browser" type="button" disabled={!!busy} onClick={onOpen}>在浏览器打开<ExternalLink size={14} aria-hidden="true"/></button>}
   <button id="desktop-service-toggle" className={'runtime-toggle'+(state==='running'?' is-stop':'')} type="button" disabled={toggleDisabled} onClick={onToggle}>{state==='running'&&<Square size={12} aria-hidden="true"/>}{toggleLabel}</button>
  </div>
  {state==='running'&&url&&<div className="runtime-address"><span title={new URL(url).origin}>{new URL(url).origin}</span><button type="button" disabled={!!busy} aria-label="复制本机访问地址" title="复制本机访问地址" onClick={onCopy}><Copy size={13} aria-hidden="true"/></button></div>}
  <details className="runtime-details"><summary><span>运行与存储</span>{nodeError&&<span className="runtime-details-error">运行时不可用</span>}<ChevronRight size={14} aria-hidden="true"/></summary><dl className="runtime-facts"><div><dt>运行时</dt><dd>{!native?'—':nodeVersion?`Node ${nodeVersion} · 就绪`:nodeError?'运行时不可用':'正在检查…'}</dd></div><div><dt>故事目录</dt><dd className="runtime-path">{native?directory:'—'}</dd></div></dl></details>
  <p className="runtime-foot">关闭窗口后在托盘运行，退出应用时停止。</p>
 </section>;
}
