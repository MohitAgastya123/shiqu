// English interface: labels, accessibility text, and workflow messages use English.
// Present service actions first, keeping runtime and storage details available on demand.
// Native lifecycle and clipboard operations remain owned by the desktop controller.
import {ChevronRight,Copy,ExternalLink,Server,Square} from 'lucide-react';
import type {ServiceState} from './library-summary';

type Props={state:ServiceState;running:boolean;busy:string;native:boolean;configured:boolean;toggleDisabled:boolean;url?:string;nodeVersion?:string;nodeError:string;directory:string;error:string;onToggle:()=>void;onOpen:()=>void;onCopy:()=>void};
const stateLabels:Record<ServiceState,string>={running:"Running",stopped:"Stopped",loading:"Loading",unavailable:"Status unknown",preview:''};

export function ServiceCard({state,running,busy,native,configured,toggleDisabled,url,nodeVersion,nodeError,directory,error,onToggle,onOpen,onCopy}:Props){
 const toggleLabel=busy?busy+'…':!native?"Start service":!configured?"Complete setup first":running?"Stop service":"Start service";
 return <section className="runtime-card" aria-labelledby="runtime-title">
  <div className="runtime-heading"><span className="runtime-icon" aria-hidden="true"><Server size={19} strokeWidth={1.5}/></span><h2 id="runtime-title">Local service</h2>{state!=='preview'&&<span className={'runtime-state is-'+state} role="status"><i aria-hidden="true"/>{stateLabels[state]}</span>}</div>
  {error&&!busy&&<p className="runtime-error" role="alert">{error}</p>}
  <div className="runtime-actions">
   {state==='running'&&<button className="runtime-browser" type="button" disabled={!!busy} onClick={onOpen}>Open in browser<ExternalLink size={14} aria-hidden="true"/></button>}
   <button id="desktop-service-toggle" className={'runtime-toggle'+(state==='running'?' is-stop':'')} type="button" disabled={toggleDisabled} onClick={onToggle}>{state==='running'&&<Square size={12} aria-hidden="true"/>}{toggleLabel}</button>
  </div>
  {state==='running'&&url&&<div className="runtime-address"><span title={new URL(url).origin}>{new URL(url).origin}</span><button type="button" disabled={!!busy} aria-label="Copy local access address" title="Copy local access address" onClick={onCopy}><Copy size={13} aria-hidden="true"/></button></div>}
  <details className="runtime-details"><summary><span>Runtime and storage</span>{nodeError&&<span className="runtime-details-error">Runtime unavailable</span>}<ChevronRight size={14} aria-hidden="true"/></summary><dl className="runtime-facts"><div><dt>Runtime</dt><dd>{!native?'—':nodeVersion?`Node ${nodeVersion} · Ready`:nodeError?"Runtime unavailable":"Checking…"}</dd></div><div><dt>Story directory</dt><dd className="runtime-path">{native?directory:'—'}</dd></div></dl></details>
  <p className="runtime-foot">Closing the window keeps the app in the tray. Quitting stops it.</p>
 </section>;
}
