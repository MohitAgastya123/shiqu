// Authenticate the separate tunnel listener first; always deny local settings routes even for a loopback source socket.
// Pairing keys remain in fragments and remote responses forbid shared caching.
import {randomBytes,timingSafeEqual} from 'node:crypto';

const cookieName='__Host-shiqu-remote',lifetime=12*60*60;
const secret=()=>randomBytes(32).toString('base64url');
function equal(value:string,expected:string){
 const bytes=Buffer.from(value);return bytes.length===Buffer.byteLength(expected)&&timingSafeEqual(bytes,Buffer.from(expected));
}
export function desktopRemote(handle:(request:Request)=>Promise<Response>){
 let origin='',pairing=secret(),session=secret(),expires=0;
 const nonce=secret();
 function protect(response:Response){
  response.headers.set('Cache-Control','private, no-store');response.headers.set('Referrer-Policy','no-referrer');
  response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('X-Frame-Options','DENY');return response;
 }
 const denied=(status=401)=>protect(Response.json({error:'Scan the private QR code in the desktop app to reconnect to the bookshelf.'},{status}));
 const bootstrap=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect to Shiqu</title><body><main><h1>Connect to your story library</h1><p id="status">Connecting…</p></main><script nonce="${nonce}">
const token=location.hash.slice(1);history.replaceState(null,'','/connect');
if(!token)document.getElementById('status').textContent='Scan the private QR code in the desktop app, or open the complete access link.';
else fetch('/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})}).then(response=>{if(!response.ok)throw Error();location.replace('/');}).catch(()=>{document.getElementById('status').textContent='Connection failed or the link expired. Scan the desktop QR code again.';});
</script></body></html>`;
 return {
  activate(publicOrigin:string){
   const url=new URL(publicOrigin);
   if(url.protocol!=='https:'||!/^https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com$/.test(publicOrigin))throw Error('TUNNEL_HOST');
   origin=url.origin;expires=Date.now()+lifetime*1000;return origin+'/connect#'+pairing;
  },
  revoke(){origin='';pairing=secret();session=secret();expires=0;},
  async handle(request:Request){
   const incoming=new URL(request.url);
   if(incoming.pathname==='/api/local/provider-settings')return denied(403);
   if(!origin||incoming.host!==new URL(origin).host)return denied(403);
   const requestOrigin=request.headers.get('origin');
   if((requestOrigin&&requestOrigin!==origin)||(!['GET','HEAD'].includes(request.method)&&requestOrigin!==origin))return denied(403);
   if(incoming.pathname==='/desktop'||incoming.pathname.startsWith('/desktop/'))return denied(404);
   if(incoming.pathname==='/connect'){
    if(request.method==='GET')return protect(new Response(bootstrap,{headers:{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`}}));
    if(request.method!=='POST'||Date.now()>=expires)return denied();
    let token='';try{const body=await request.text();if(body.length>256)return denied();token=JSON.parse(body).token;}catch{return denied();}
    if(typeof token!=='string'||!equal(token,pairing))return denied();
    return protect(Response.json({ok:true},{headers:{'Set-Cookie':`${cookieName}=${session}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0,Math.floor((expires-Date.now())/1000))}`}}));
   }
   const cookie=request.headers.get('cookie')?.split(';').map(part=>part.trim()).find(part=>part.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';
   if(Date.now()>=expires||!equal(cookie,session))return denied();
   // Never trust forwarded headers to choose the reader's origin or bypass its checks.
   const forwarded=new Request(origin+incoming.pathname+incoming.search,request);
   for(const name of [...forwarded.headers.keys()])if(name==='forwarded'||name.startsWith('x-forwarded-'))forwarded.headers.delete(name);
   return protect(await handle(forwarded));
  },
 };
}
