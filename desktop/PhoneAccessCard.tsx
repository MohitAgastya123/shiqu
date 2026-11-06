// English interface: labels, accessibility text, and workflow messages use English.
// Lead with phone access; keep optional tunnel setup behind a disclosure without hiding access scope.
// Link selection, QR generation, settings persistence and clipboard actions stay in the controller.
import {ChevronRight,Copy,Globe,Smartphone,Wifi} from 'lucide-react';
import type {ServiceState} from './library-summary';

type Props={state:ServiceState;running:boolean;busy:boolean;locked:boolean;links:string[];phone:string;publicUrl?:string;qr:string;internetEnabled:boolean;cloudflaredPath:string;internetError?:string;onChoose:(url:string)=>void;onInternetChange:(enabled:boolean)=>void;onCloudflaredChange:(path:string)=>void;onCopy:()=>void};

export function PhoneAccessCard({state,running,busy,locked,links,phone,publicUrl,qr,internetEnabled,cloudflaredPath,internetError,onChoose,onInternetChange,onCloudflaredChange,onCopy}:Props){
 const internet=!!phone&&phone===publicUrl,connected=state==='running'&&!!phone;
 const ModeIcon=internet?Globe:Wifi;
 const placeholder=state==='loading'?"Reading service status…":state==='unavailable'?"Service status unavailable. The QR code appears when it recovers.":state==='running'?"No usable access address found.":"Start the local service, then scan to continue on your phone.";
 return <section className="card phone-card" aria-labelledby="phone-title">
  <div className="phone-heading"><span className="phone-icon" aria-hidden="true"><Smartphone size={19} strokeWidth={1.5}/></span><div><h2 id="phone-title">Read on your phone</h2><p>Scan to open. No installation needed.</p></div></div>
  {internetError&&<p className="phone-error" role="status">{internetError}</p>}
  {connected?<>
   <div className="phone-connection"><ModeIcon size={14} aria-hidden="true"/>{links.length>1?<select aria-label="Phone access method" value={phone} onChange={e=>onChoose(e.target.value)}>{links.map(url=><option key={url} value={url}>{url===publicUrl?"Internet · ":"Local network · "}{new URL(url).hostname}</option>)}</select>:<span>{internet?"Internet · Private link":"Local network · Same Wi-Fi"}</span>}</div>
   <div className="phone-qr">{qr?<img src={qr} width="240" height="240" alt={internet?"Scan this private QR code to access your shelf over the internet":"Scan to open your shelf on the local network"}/>:<p role="status">Creating QR code…</p>}</div>
   <p className="phone-address">{new URL(phone).origin}</p>
   <button className="phone-copy" type="button" disabled={busy} onClick={onCopy}><Copy size={14} aria-hidden="true"/>{internet?"Copy private link":"Copy access link"}</button>
   <p className="phone-permission">{internet?"The QR code and complete link grant shelf and generation access. Keep them private.":"Devices on the same network can access the shelf and generate stories. Use only on trusted networks."}</p>
  </>:<div className="phone-empty"><Smartphone size={30} strokeWidth={1.2} aria-hidden="true"/><p role="status">{placeholder}</p></div>}
  <details className="phone-settings"><summary><span>Connection settings</span><span className="phone-settings-mode">{internetEnabled?"Local network + Internet":"Local network only"}</span><ChevronRight size={14} aria-hidden="true"/></summary>
   <fieldset disabled={locked}><legend className="sr-only">Phone access settings</legend>
    <label className="switch-row"><input type="checkbox" checked={internetEnabled} onChange={e=>onInternetChange(e.target.checked)}/><span><strong>Allow internet access</strong><small>{running?"Stop the service before changing internet access.":"Connect from another Wi-Fi or mobile network without an account or domain."}</small></span></label>
    {internetEnabled&&<><label>cloudflared executable<input value={cloudflaredPath} placeholder="Leave blank to find automatically, or enter an absolute path" onChange={e=>onCloudflaredChange(e.target.value)} spellCheck={false}/></label><p className="help">Install cloudflared separately. On macOS: brew install cloudflared.</p></>}
   </fieldset>
   <p className="phone-setting-note">Local network access is always enabled over HTTP, with no pairing ID. Connected devices share shelf and generation permissions.</p>
   {internetEnabled&&<p className="phone-setting-note">Internet access uses a free temporary Cloudflare HTTPS tunnel. Pairing lasts 12 hours and ends when the service stops. Scan again after restarting. Addresses change and availability is not guaranteed.</p>}
  </details>
  <p className="phone-foot">Keep this computer awake and the service running.</p>
 </section>;
}
