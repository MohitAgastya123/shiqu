// English product messages; source evidence and machine identifiers remain stable.
// Run the existing reader under a native supervisor, accepting secrets only through private stdin.
// EOF and explicit stop revoke access and terminate generation before releasing data ownership.
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createInterface} from 'node:readline';
import {once} from 'node:events';
import {z} from 'zod';
import {realpathSync} from 'node:fs';
import {createApplication} from './app.ts';
import {createHttpServer} from './http.ts';
import {desktopAccess} from './desktop-access.ts';
import {ensureLibraryReady,libraryUpgradeBackup} from './library-upgrade.ts';
import {ownDesktopData} from './desktop-owner.ts';
import {phoneUrls} from './phone-access.ts';
import {desktopRemote} from './desktop-remote.ts';
import {startDesktopTunnel,TunnelError} from './desktop-tunnel.ts';
import {createReaderProvider} from './generation.ts';
import {stopCodexProcesses} from './codex-runner.ts';
import {stopClaudeProcesses} from './claude-runner.ts';
import {FileMedia} from './media.ts';
import {systemSettingsSchema,settingsVariables} from '../lib/system-settings.ts';
import {installDiagnostics,recordDiagnostic,safeErrorCode} from './diagnostics.ts';

export const desktopSettings=systemSettingsSchema;
export type DesktopSettings=z.infer<typeof desktopSettings>;
export function desktopVariables(settings:DesktopSettings,key:string){return settingsVariables(systemSettingsSchema.parse(settings),key);}
export async function testDesktopProvider(settings:DesktopSettings,key:string,root:string,transport:typeof fetch=fetch){
 if(settings.provider==='codex'){
  const provider=createReaderProvider(desktopVariables(settings,key),new FileMedia(path.join(root,'unused')),transport);
  const status=await provider.status();return {ok:status.configured,message:status.configured?'Codex is signed in. This check did not generate content.':status.message||'Codex is not connected.'};
 }
 if(settings.provider==='readonly')return {ok:true,message:'Read-only mode is active. No generation provider is called.'};
 if(!key)return {ok:false,message:'Enter or save an API key first.'};
 try{
  // Metadata only: no generation endpoint, prompt, or paid output.
  for(const model of new Set(settings.provider==='openai'?[settings.openaiTextModel,settings.openaiImageModel]:[settings.textModel,settings.imageModel])){
   const openai=settings.provider==='openai';
   const response=await transport(openai?`https://api.openai.com/v1/models/${model}`:`https://generativelanguage.googleapis.com/v1beta/models/${model}`,{headers:openai?{Authorization:'Bearer '+key}:{'x-goog-api-key':key},signal:AbortSignal.timeout(10000),redirect:'error'});
   if(!response.ok)return {ok:false,message:`Model access check failed (HTTP ${response.status}). Check the key and model permissions.`};
   await response.body?.cancel();
  }
  return {ok:true,message:'The key and model metadata are accessible. No content was generated; this does not verify available generation quota.'};
 }catch{return {ok:false,message:'The connection timed out or the network is unavailable. No content was generated.'};}
}
export async function startDesktop(settings:DesktopSettings,key:string,root:string,options:{signal?:AbortSignal;onStatus?:(status:unknown)=>void}={}){
 const release=await ownDesktopData(settings.dataDirectory);
 const removeDiagnostics=installDiagnostics(settings.dataDirectory);
 let app:ReturnType<typeof createApplication>|undefined,server:ReturnType<typeof createHttpServer>|undefined,remoteServer:ReturnType<typeof createHttpServer>|undefined,tunnel:Awaited<ReturnType<typeof startDesktopTunnel>>|undefined;
 let stopped:Promise<void>|undefined;
 const remote=desktopRemote(request=>app!.handle(request));
 async function close(listener:typeof server){if(!listener)return;await new Promise<void>(resolve=>{listener.close(()=>resolve());listener.closeAllConnections();});}
 function stop(){return stopped??=(async()=>{try{remote.revoke();await tunnel?.stop();app?.stopGeneration();await Promise.all([stopCodexProcesses(),stopClaudeProcesses()]);await Promise.all([close(remoteServer),close(server)]);await app?.close();}finally{recordDiagnostic(settings.dataDirectory,'service_stopped');removeDiagnostics();await release();}})();}
 try{
  options.signal?.throwIfAborted();
  app=createApplication({root,dataDirectory:settings.dataDirectory,variables:desktopVariables(settings,key)});
  const local=`http://127.0.0.1:${settings.port}`,phones=phoneUrls('0.0.0.0',settings.port);
  const access=desktopAccess(app.handle,{hosts:[new URL(local).host,...phones.map(url=>new URL(url).host)]});
  // macOS can let a wildcard bind coexist with an occupied loopback port.
  // Probe the advertised local endpoint first so its browser link cannot open another service.
  server=createHttpServer(access.handle);server.listen(settings.port,'127.0.0.1');await once(server,'listening');await close(server);
  server=createHttpServer(access.handle);server.listen(settings.port,'0.0.0.0');await once(server,'listening');
  const status={running:true,pid:process.pid,url:local,phoneUrls:phones,publicUrl:'',internetError:''};
  if(settings.internetEnabled){
   try{
    remoteServer=createHttpServer(remote.handle);remoteServer.listen(0,'127.0.0.1');await once(remoteServer,'listening');
    const address=remoteServer.address();if(!address||typeof address==='string')throw Error('TUNNEL_LISTENER');
    tunnel=await startDesktopTunnel(`http://127.0.0.1:${address.port}`,settings.cloudflaredPath,{signal:options.signal});
    options.signal?.throwIfAborted();status.publicUrl=remote.activate(tunnel.origin);
    void tunnel.closed.then(async()=>{
     remote.revoke();status.publicUrl='';
     if(!stopped){status.internetError='The internet tunnel disconnected. Local and LAN access remain available. Stop and restart the service to retry.';options.onStatus?.({...status});}
     await close(remoteServer);await tunnel?.stop();
    });
   }catch(error){
    // Internet is optional: clean only its entry point. Parent shutdown still
    // propagates to the outer handler and releases the complete runtime.
    if(options.signal?.aborted)throw error;
    remote.revoke();await tunnel?.stop();await close(remoteServer);remoteServer=undefined;
    status.internetError=(error instanceof TunnelError?error.message:'The internet tunnel failed to start.')+' Local and LAN access remain available without a pairing ID.';
   }
  }
  options.signal?.throwIfAborted();recordDiagnostic(settings.dataDirectory,'service_started');return {server,status,stop};
 }catch(error){recordDiagnostic(settings.dataDirectory,'service_start_failed',{code:safeErrorCode(error)});await stop();throw error;}
}
export function desktopFailure(error:unknown){
 if(error instanceof TunnelError)return error.message;
 const code=(error as NodeJS.ErrnoException)?.code,message=(error as Error)?.message;
 if(code==='EADDRINUSE')return 'The port is in use. Choose another port or stop the other instance.';
 if(message&&/^(LIBRARY_|BACKUP_|DATA_BUSY:)/.test(message))return message;
 if(message==='DATA_BUSY')return 'Another CLI or desktop service is using this data directory. Wait for it to exit or choose another directory.';
 if(code==='EACCES'||code==='EPERM')return 'The selected file or data directory cannot be accessed. Check permissions.';
 return 'The service failed to start. Check Node 24, app resources, and the data directory.';
}
async function main(){
 const lines=createInterface({input:process.stdin,crlfDelay:Infinity});
 const abort=new AbortController();
 let runtime:Awaited<ReturnType<typeof startDesktop>>|undefined,starting=false,closing=false,inputClosed=false;
 const send=(value:unknown)=>process.stdout.write(JSON.stringify(value)+'\n');
 async function stop(){if(closing)return;closing=true;if(runtime)await runtime.stop();else await Promise.all([stopCodexProcesses(),stopClaudeProcesses()]);process.exit(0);}
 lines.on('close',()=>{inputClosed=true;abort.abort();if(!starting)void stop();});
 for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>{abort.abort();if(!starting)void stop();});
 process.on('exit',()=>{void stopCodexProcesses();void stopClaudeProcesses();});
 // Discard raw exception/provider output: the parent receives only safe status messages.
 process.on('uncaughtException',()=>{send({error:'The service exited unexpectedly. Restart it.'});void stop();});
 lines.on('line',line=>{
  if(line.length>20000){void stop();return;}
  if(runtime){try{if(JSON.parse(line).action==='stop')void stop();}catch{void stop();}return;}
  if(starting||closing)return;starting=true;
  void(async()=>{
   try{
    const input=z.object({action:z.enum(['start','test','upgrade']),settings:desktopSettings,key:z.string().max(4096).default('')}).strict().parse(JSON.parse(line));
    const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
    if(input.action==='upgrade'){ensureLibraryReady(input.settings.dataDirectory,root);send({upgraded:true,started:false,backup:libraryUpgradeBackup(input.settings.dataDirectory)});await stop();return;}
    if(input.action==='test'){send(await testDesktopProvider(input.settings,input.key,root));await stop();return;}
    runtime=await startDesktop(input.settings,input.key,root,{signal:abort.signal,onStatus:send});starting=false;
    if(inputClosed){await stop();return;}
    send(runtime.status);
   }catch(error){send({error:desktopFailure(error)});starting=false;await stop();}
  })();
 });
 const timer=setTimeout(()=>{if(!runtime&&!starting)void stop();},10000);timer.unref();
}
if(process.argv[1]&&import.meta.url===pathToFileURL(realpathSync(process.argv[1])).href)void main();
