// The controller supplies service state, lifecycle actions, and read-only provider summaries without querying stories.
import type {ServiceState,Status} from './console-state';
import {stateLabels} from './console-state';
import type {ProviderSettingsView} from '../lib/provider-settings';
const labels:Record<string,string>={readonly:'Read only',gemini:'Gemini',openai:'OpenAI API',codex:'Codex',claude:'Claude Code',deepseek:'DeepSeek'};
type Props={state:ServiceState;status:Status;native:boolean;busy:string;provider:ProviderSettingsView['runtime'];nodeVersion?:string;nodeError:string;onStart:()=>void;onStop:()=>void;onRestart:()=>void;onOpen:()=>void;onSettings:()=>void;previewUrl:string|null};
export function ServiceCard({state,status,native,busy,provider,nodeVersion,nodeError,onStart,onStop,onRestart,onOpen,onSettings,previewUrl}:Props){
 const pending=state==='starting'||state==='upgrading',locked=!native||!!busy||pending||state==='loading'||state==='unavailable';
 return <section className="service-card" aria-label="Local service">
  <div className="service-label"><i className={status.running?'status-dot live':'status-dot'}/><span role="status">{stateLabels[state]}</span><span className="runtime-badge">{nodeVersion?`Node ${nodeVersion}`:nodeError?"Runtime unavailable":"Bundled runtime"}</span></div>
  <h2>Stories in your browser.<br/>Service controls here.</h2><p>Start the service, then open Shiqu on your computer or phone.</p>
  {(status.error||status.settingsError||nodeError)&&<p className="service-error" role="alert">{status.error||status.settingsError||nodeError}</p>}
  <div className="service-actions">
   <button className="primary" disabled={locked||status.running} onClick={onStart}>{pending?stateLabels[state]+'…':"Start service"}</button>
   <button className="secondary" disabled={locked||!status.running} onClick={onStop}>Stop</button>
   <button className="secondary" disabled={locked||!status.running} onClick={onRestart}>Restart service</button>
  </div>
  {native?<button className="browser-link" disabled={locked||!status.running} onClick={onOpen}>Open in browser ↗</button>:previewUrl?<a className="browser-link" href={previewUrl} target="_blank" rel="noopener noreferrer">Open in browser ↗</a>:<p>The reader is not connected. Start the Shiqu service first.</p>}
  {status.running&&status.url&&<p className="service-address">{status.url}</p>}
  {pending&&<p role="status">{state==='upgrading'?"Startup continues when the upgrade or recovery finishes. Keep the app open.":"Starting the local service. Please wait."}</p>}
  {status.backup&&<p className="backup-path">Verified upgrade backup: {status.backup}</p>}
  <div className="provider-summary" aria-label={status.running?'Active configuration':"Saved configuration"}><div><strong>{status.running?'Currently running':"Saved configuration"} · {provider.provider==='readonly'?'Read only':provider.configured===false?"Generation is not configured":labels[provider.provider]||provider.provider}</strong>{status.restartRequired&&<span>Restart required</span>}</div>
   {provider.provider!=='readonly'&&provider.configured!==false&&<p>Text: {labels[provider.provider]} · {provider.models.text}<br/>Images: {labels[provider.imageProvider||provider.provider]} · {provider.models.image}</p>}
   <button className="text-button" disabled={locked||!status.running} onClick={onSettings}>Generation service and models ↗</button><p>Configure in a browser on this computer. Restart the service after saving.</p>
  </div>
 </section>;
}
