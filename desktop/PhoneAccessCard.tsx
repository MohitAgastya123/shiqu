// 手机访问保留局域网与可选隧道，链接、二维码和保存由控制器管理。
import {ChevronRight,Copy,Globe,Smartphone,Wifi} from 'lucide-react';
import type {ServiceState} from './console-state';

type Props={state:ServiceState;running:boolean;busy:boolean;locked:boolean;links:string[];phone:string;publicUrl?:string;qr:string;internetEnabled:boolean;cloudflaredPath:string;internetError?:string;onChoose:(url:string)=>void;onInternetChange:(enabled:boolean)=>void;onCloudflaredChange:(path:string)=>void;onCopy:()=>void;onBrowseCloudflared?:()=>void};

export function PhoneAccessCard({state,running,busy,locked,links,phone,publicUrl,qr,internetEnabled,cloudflaredPath,internetError,onChoose,onInternetChange,onCloudflaredChange,onCopy,onBrowseCloudflared}:Props){
 const internet=!!phone&&phone===publicUrl,connected=state==='running'&&!!phone;
 const ModeIcon=internet?Globe:Wifi;
 const placeholder=state==='loading'?'正在读取服务状态…':state==='unavailable'?'服务状态暂不可用，恢复后显示二维码。':state==='running'?'未找到可用的访问地址。':'启动本机服务后，手机扫码接着读。';
 return <section className="card phone-card" aria-labelledby="phone-title">
  <div className="phone-heading"><span className="phone-icon" aria-hidden="true"><Smartphone size={19} strokeWidth={1.5}/></span><div><h2 id="phone-title">手机接着读</h2><p>扫码打开，无需安装。</p></div></div>
  {internetError&&<p className="phone-error" role="status">{internetError}</p>}
  {connected?<>
   <div className="phone-connection"><ModeIcon size={14} aria-hidden="true"/>{links.length>1?<select aria-label="手机访问方式" value={phone} onChange={e=>onChoose(e.target.value)}>{links.map(url=><option key={url} value={url}>{url===publicUrl?'互联网 · ':'局域网 · '}{new URL(url).hostname}</option>)}</select>:<span>{internet?'互联网 · 私密链接':'局域网 · 同一 Wi-Fi'}</span>}</div>
   <div className="phone-qr">{qr?<img src={qr} width="240" height="240" alt={internet?'扫描私密二维码，通过互联网连接书架':'扫描二维码，通过局域网打开书架'}/>:<p role="status">正在生成二维码…</p>}</div>
   <p className="phone-address">{new URL(phone).origin}</p>
   <button className="phone-copy" type="button" disabled={busy} onClick={onCopy}><Copy size={14} aria-hidden="true"/>{internet?'复制私密链接':'复制访问链接'}</button>
   <p className="phone-permission">{internet?'二维码和完整链接可授权访问书架与生成服务，请勿公开分享。':'同一网络中的设备可访问书架并生成故事，仅限可信网络。'}</p>
  </>:<div className="phone-empty"><Smartphone size={30} strokeWidth={1.2} aria-hidden="true"/><p role="status">{placeholder}</p></div>}
  <details className="phone-settings"><summary><span>连接设置</span><span className="phone-settings-mode">{internetEnabled?'局域网 + 互联网':'仅局域网'}</span><ChevronRight size={14} aria-hidden="true"/></summary>
   <fieldset disabled={locked}><legend className="sr-only">手机访问设置</legend>
    <label className="switch-row"><input type="checkbox" checked={internetEnabled} onChange={e=>onInternetChange(e.target.checked)}/><span><strong>允许互联网访问</strong><small>{running?'停止服务后可修改互联网访问。':'手机可从其他 Wi-Fi 或蜂窝网络连接，无需账户或域名。'}</small></span></label>
    {internetEnabled&&<><label>cloudflared 可执行文件<input value={cloudflaredPath} placeholder="留空自动查找，或填写绝对路径" onChange={e=>onCloudflaredChange(e.target.value)} spellCheck={false}/></label>{onBrowseCloudflared&&<button className="secondary" type="button" onClick={onBrowseCloudflared}>选择 cloudflared 文件</button>}<p className="help">需另行安装 cloudflared。macOS：brew install cloudflared。</p></>}
   </fieldset>
   <p className="phone-setting-note">局域网访问始终开启，使用 HTTP，无需配对 ID。可连接的设备共享书架和生成权限。</p>
   {internetEnabled&&<p className="phone-setting-note">互联网经 Cloudflare 免费临时隧道转发 HTTPS。配对有效期为 12 小时，停服立即失效，重启后需重新扫码。地址会变化，无可用性保证。</p>}
  </details>
  <p className="phone-foot">电脑保持唤醒，服务保持运行。</p>
 </section>;
}
