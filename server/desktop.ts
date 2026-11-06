// The native console passes the settings location and overrides through private stdin; provider settings are edited in the local browser.
// Upgrade the library before starting; shutdown revokes remote access and stops generation before releasing ownership.
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
import {SystemSettingsStore} from './system-settings.ts';
import {effectiveProviderVariables,providerReady} from './cli-setup.ts';
import {browserProviderSettings} from './browser-provider-settings.ts';
import {providerSettingsPath} from '../lib/provider-settings.ts';
import {checkProviderVariables,runtimeConfiguration} from './provider-runtime.ts';
import {installDiagnostics,recordDiagnostic,safeErrorCode} from './diagnostics.ts';

export const desktopSettings=systemSettingsSchema;
export type DesktopSettings=z.infer<typeof desktopSettings>;
export function desktopVariables(settings:DesktopSettings,key:string,imageKey=''){return settingsVariables(systemSettingsSchema.parse(settings),key,imageKey);}
// Retain the native test entry point; share browser metadata connectivity checks.
export async function testDesktopProvider(settings:DesktopSettings,key:string,_root:string,transport:typeof fetch=fetch,imageKey=''){
 return checkProviderVariables(desktopVariables(settings,key,imageKey),transport);
}
export function desktopProviderConfiguration(settings:DesktopSettings,key:string,imageKey:string,settingsFile?:string,overrides:Record<string,string|undefined>={}){
 if(!settingsFile)return {variables:desktopVariables(settings,key,imageKey)};
 if(!path.isAbsolute(settingsFile))throw Error('SETTINGS_STORE_UNAVAILABLE');
 const store=new SystemSettingsStore(settingsFile,settings.dataDirectory,{existingOnly:true});
 try{return {variables:effectiveProviderVariables(store,overrides),locations:{settings:settingsFile,library:settings.dataDirectory}};}finally{store.close();}
}
export async function startDesktop(settings:DesktopSettings,key:string,root:string,options:{signal?:AbortSignal;onStatus?:(status:unknown)=>void;imageKey?:string;settingsFile?:string;overrides?:Record<string,string|undefined>;transport?:typeof fetch}={}){
 options.onStatus?.({running:false,phoneUrls:[],state:'upgrading'});
 const upgrade=ensureLibraryReady(settings.dataDirectory,root);
 const backup=upgrade?.backup||libraryUpgradeBackup(settings.dataDirectory);
 options.onStatus?.({running:false,phoneUrls:[],state:'starting',backup});
 const configuration=desktopProviderConfiguration(settings,key,options.imageKey||'',options.settingsFile,options.overrides);
 const release=await ownDesktopData(settings.dataDirectory);
 const removeDiagnostics=installDiagnostics(settings.dataDirectory);
 let app:ReturnType<typeof createApplication>|undefined,server:ReturnType<typeof createHttpServer>|undefined,remoteServer:ReturnType<typeof createHttpServer>|undefined,tunnel:Awaited<ReturnType<typeof startDesktopTunnel>>|undefined;
 let stopped:Promise<void>|undefined,monitor:ReturnType<typeof setInterval>|undefined;
 const remote=desktopRemote(request=>app!.handle(request));
 async function close(listener:typeof server){if(!listener)return;await new Promise<void>(resolve=>{listener.close(()=>resolve());listener.closeAllConnections();});}
 function stop(){return stopped??=(async()=>{try{clearInterval(monitor);remote.revoke();await tunnel?.stop();app?.stopGeneration();await Promise.all([stopCodexProcesses(),stopClaudeProcesses()]);await Promise.all([close(remoteServer),close(server)]);await app?.close();}finally{recordDiagnostic(settings.dataDirectory,'service_stopped');removeDiagnostics();await release();}})();}
 try{
  options.signal?.throwIfAborted();
  app=createApplication({root,dataDirectory:settings.dataDirectory,variables:configuration.variables,production:{autoStart:providerReady(configuration.variables)},transport:options.transport});
  const local=`http://127.0.0.1:${settings.port}`,phones=phoneUrls('0.0.0.0',settings.port);
  const providerSettings=configuration.locations?browserProviderSettings({variables:configuration.variables,overrides:options.overrides||{},ports:[settings.port],locations:configuration.locations,existingOnly:true,transport:options.transport}):undefined;
  const access=desktopAccess(app.handle,{hosts:[new URL(local).host,`localhost:${settings.port}`,...phones.map(url=>new URL(url).host)]});
  const localHandle:Parameters<typeof createHttpServer>[0]=(request,peer)=>new URL(request.url).pathname===providerSettingsPath&&providerSettings?providerSettings(request,peer):access.handle(request);
  // Probe loopback first because macOS may allow a wildcard listener beside an occupied loopback port.
  server=createHttpServer(localHandle);server.listen(settings.port,'127.0.0.1');await once(server,'listening');await close(server);
  server=createHttpServer(localHandle);server.listen(settings.port,'0.0.0.0');await once(server,'listening');
  const status={running:true,state:'running',pid:process.pid,url:local,phoneUrls:phones,publicUrl:'',internetError:'',backup};
  function snapshot(){
   let provider;try{provider=providerSettings?.snapshot();}catch{return {...status,provider:runtimeConfiguration(configuration.variables),generating:app!.generating,settingsError:'Shared generation settings could not be read. Check the local configuration and retry.'};}
   return {...status,provider:runtimeConfiguration(configuration.variables),generating:app!.generating,...(provider?{provider:provider.runtime,restartRequired:provider.restartRequired,overrides:provider.overrides}:{})};
  }
  if(settings.internetEnabled){
   try{
    remoteServer=createHttpServer(remote.handle);remoteServer.listen(0,'127.0.0.1');await once(remoteServer,'listening');
    const address=remoteServer.address();if(!address||typeof address==='string')throw Error('TUNNEL_LISTENER');
    tunnel=await startDesktopTunnel(`http://127.0.0.1:${address.port}`,settings.cloudflaredPath,{signal:options.signal});
    options.signal?.throwIfAborted();status.publicUrl=remote.activate(tunnel.origin);
    void tunnel.closed.then(async()=>{
     remote.revoke();status.publicUrl='';
     if(!stopped){status.internetError='The internet tunnel disconnected. Local and LAN access remain available. Stop and restart the service to retry.';options.onStatus?.(snapshot());}
     await close(remoteServer);await tunnel?.stop();
    });
   }catch(error){
    // Internet access is optional; tunnel failure cleans only its entry point while parent shutdown releases the full runtime.
    if(options.signal?.aborted)throw error;
    remote.revoke();await tunnel?.stop();await close(remoteServer);remoteServer=undefined;
    status.internetError=(error instanceof TunnelError?error.message:'The internet tunnel failed to start.')+' Local and LAN access remain available without a pairing ID.';
   }
  }
  options.signal?.throwIfAborted();recordDiagnostic(settings.dataDirectory,'service_started');
  monitor=setInterval(()=>options.onStatus?.(snapshot()),1000);monitor.unref();
  return {server,get status(){return snapshot();},stop};
 }catch(error){recordDiagnostic(settings.dataDirectory,'service_start_failed',{code:safeErrorCode(error)});await stop();throw error;}
}
export function desktopFailure(error:unknown){
 if(error instanceof TunnelError)return error.message;
 const code=(error as NodeJS.ErrnoException)?.code,message=(error as Error)?.message;
 if(code==='EADDRINUSE')return 'The port is already in use. Choose another port or stop the other instance.';
 if(message&&/^(LIBRARY_|BACKUP_|DATA_BUSY:)/.test(message)){
  const code=message.split(/[;: ]/)[0],backup=message.match(/(?:^|; )backup: ([^;]+)/)?.[1];
  return `${code}: The library could not be upgraded or opened. Keep the existing library and check its backup.${backup?' Backup: '+backup:''}`;
 }
 if(message==='SETTINGS_STORE_UNAVAILABLE')return 'Shared generation settings could not be read. Check the local configuration and retry.';
 if(message==='DATA_BUSY')return 'Another CLI or desktop service is using this data directory. Wait for it to exit or choose another directory.';
 if(code==='EACCES'||code==='EPERM')return 'The selected file or data directory is inaccessible. Check permissions.';
 return 'Service startup failed. Check Node 24, application resources and the data directory.';
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
 // Discard raw exceptions and provider output; the parent receives only safe status messages.
 process.on('uncaughtException',()=>{send({error:'The service exited unexpectedly. Restart it.'});void stop();});
 lines.on('line',line=>{
  if(line.length>20000){void stop();return;}
  if(runtime){try{if(JSON.parse(line).action==='stop')void stop();}catch{void stop();}return;}
  if(starting||closing)return;starting=true;
  void(async()=>{
   try{
    const input=z.object({action:z.enum(['start','test','upgrade']),settings:desktopSettings,key:z.string().max(4096).default(''),imageKey:z.string().max(4096).default(''),settingsFile:z.string().optional(),overrides:z.record(z.string()).default({})}).strict().parse(JSON.parse(line));
    const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
    if(input.action==='upgrade'){ensureLibraryReady(input.settings.dataDirectory,root);send({upgraded:true,started:false,backup:libraryUpgradeBackup(input.settings.dataDirectory)});await stop();return;}
    if(input.action==='test'){send(await testDesktopProvider(input.settings,input.key,root,fetch,input.imageKey));await stop();return;}
    runtime=await startDesktop(input.settings,input.key,root,{signal:abort.signal,onStatus:send,imageKey:input.imageKey,settingsFile:input.settingsFile,overrides:input.overrides});starting=false;
    if(inputClosed){await stop();return;}
    send(runtime.status);
   }catch(error){send({running:false,state:'failed',phoneUrls:[],error:desktopFailure(error)});starting=false;await stop();}
  })();
 });
 const timer=setTimeout(()=>{if(!runtime&&!starting)void stop();},10000);timer.unref();
}
if(process.argv[1]&&import.meta.url===pathToFileURL(realpathSync(process.argv[1])).href)void main();
