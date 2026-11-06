// Local provider settings share the native store; trust only real sockets and exact loopback hosts.
// Save, reset and checks use saved settings and startup overrides; credentials stay inside the service.
import {z} from 'zod';
import {SystemSettingsStore} from './system-settings.ts';
import {desktopLibraryPaths} from './library-directory.ts';
import {effectiveProviderVariables} from './cli-setup.ts';
import {systemSettingsSchema,validApiKey,effectiveImageProvider,isApiProvider} from '../lib/system-settings.ts';
import type {KeyChange} from './system-settings.ts';
import {loopbackAddress,providerSettingsSchema,providerSettingsSaveSchema,providerSettingsProofHeader,providerSettingsPath} from '../lib/provider-settings.ts';
import type {ProviderSettingsView} from '../lib/provider-settings.ts';
import type {HttpPeer} from './http.ts';
import {providerSignature,runtimeConfiguration,providerOverrideNames,checkProviderVariables} from './provider-runtime.ts';
type Variables=Record<string,string|undefined>;

export function browserProviderSettings(options:{variables:Variables;overrides:Variables;ports:number[];locations?:Pick<ReturnType<typeof desktopLibraryPaths>,'settings'|'library'>;proxyToken?:string;existingOnly?:boolean;transport?:typeof fetch}){
 const runtimeSignature=providerSignature(options.variables),locations=options.locations||desktopLibraryPaths(),hosts=new Set(options.ports.flatMap(port=>[`localhost:${port}`,`127.0.0.1:${port}`,`[::1]:${port}`]));
 const runtime=runtimeConfiguration(options.variables);
 const overrides=providerOverrideNames.filter(name=>typeof options.overrides[name]==='string');
 const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
 const json=(value:unknown,status=200)=>Response.json(value,{status,headers});
 function snapshot(store:SystemSettingsStore){
  const saved=store.snapshot(),effective=effectiveProviderVariables(store,options.overrides);
  return {settings:providerSettingsSchema.strip().parse(saved.settings),revision:saved.revision,keyPresent:saved.keyPresent,runtime,overrides,restartRequired:providerSignature(effective)!==runtimeSignature,platform:process.platform} satisfies ProviderSettingsView;
 }
 const openStore=()=>new SystemSettingsStore(locations.settings,locations.library,{existingOnly:options.existingOnly});
 const handler=async(request:Request,peer:HttpPeer)=>{
  const url=new URL(request.url),origin=request.headers.get('origin');
  const proxyVerified=options.proxyToken===undefined||!!options.proxyToken&&request.headers.get(providerSettingsProofHeader)===options.proxyToken;
  if(peer.rawPath!==undefined&&peer.rawPath!==providerSettingsPath)return json({error:'Provider settings accept only the fixed local settings path.'},403);
  if(!proxyVerified||!loopbackAddress(peer.remoteAddress)||!hosts.has(url.host)||request.headers.get('sec-fetch-site')==='cross-site'||origin&&origin!==url.origin||request.method!=='GET'&&origin!==url.origin)return json({error:'Provider settings are available only on a same-origin page on this computer.'},403);
  if(!['GET','POST'].includes(request.method))return json({error:'Unsupported settings operation.'},405);
  let store:SystemSettingsStore|undefined;
  try{
   store=openStore();
   if(request.method==='POST'){
    if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return json({error:'Use JSON to save settings.'},415);
    const body=await request.text();if(body.length>16384)return json({error:'The settings payload is too large.'},413);
    const raw=JSON.parse(body);
    if(raw.action==='check'||raw.action==='reset'){
     const input=z.object({action:z.enum(['check','reset']),expectedRevision:z.number().int().nonnegative()}).strict().parse(raw);
     if(input.expectedRevision!==store.revision())return json({error:'Settings were changed elsewhere. Reload them before saving.'},409);
     if(input.action==='check')return json(await checkProviderVariables(effectiveProviderVariables(store,options.overrides),options.transport));
     store.resetProviders(input.expectedRevision,true);return json(snapshot(store));
    }
    const input=providerSettingsSaveSchema.parse(raw);
    if(input.expectedRevision!==store.revision())return json({error:'Settings were changed elsewhere. Reload them before saving.'},409);
    const current=store.settings(),merged=systemSettingsSchema.parse({...current,...input.settings,taskReasoningEfforts:{...current.taskReasoningEfforts,...input.settings.taskReasoningEfforts},providerConfigured:true});
    const provider=merged.provider,api=provider==='gemini'||provider==='openai',image=effectiveImageProvider(merged),imageApi=image!==provider&&isApiProvider(image)?image:null;
    if(!api&&(input.keyAction!=='keep'||input.key))return json({error:'The current provider does not use an API key.'},400);
    if(!imageApi&&(input.imageKeyAction!=='keep'||input.imageKey))return json({error:'The image provider is the same as the text provider or does not use an API key.'},400);
    if(input.keyAction!=='replace'&&input.key||input.imageKeyAction!=='replace'&&input.imageKey)return json({error:'Choose Replace key, or clear the input to keep the existing key.'},400);
    const keys:KeyChange[]=[];
    if(api&&input.keyAction!=='keep')keys.push({provider,value:input.keyAction==='remove'?null:validApiKey(input.key)});
    if(imageApi&&input.imageKeyAction!=='keep')keys.push({provider:imageApi,value:input.imageKeyAction==='remove'?null:validApiKey(input.imageKey)});
    if(api&&input.keyAction==='keep'&&!store.key(provider))return json({error:'Enter an API key for the selected provider, or choose read-only mode.'},400);
    if(imageApi&&input.imageKeyAction==='keep'&&!store.key(imageApi))return json({error:'Enter an API key for the image provider, or use the text provider for images.'},400);
    // Explicitly clear an unset image provider so a previous separate selection is not retained.
    store.save({...providerSettingsSchema.strip().parse(merged),imageProvider:merged.imageProvider??null,providerConfigured:true} as Partial<typeof merged>,keys,input.expectedRevision);
   }
   return json(snapshot(store));
  }catch(error){
   if(error instanceof z.ZodError||error instanceof SyntaxError)return json({error:'Check the provider, model names, reasoning effort, and settings payload.'},400);
   if(error instanceof Error&&error.message.startsWith('Settings were changed elsewhere'))return json({error:error.message},409);
   if(error instanceof Error&&/^(?:The )?API key/.test(error.message))return json({error:'The API key must be a nonempty single line of at most 4096 bytes.'},400);
   return json({error:'Shared provider settings could not be read or saved. Check the local configuration and reload.'},503);
  }finally{store?.close();}
 };
 return Object.assign(handler,{snapshot(){const store=openStore();try{return snapshot(store);}finally{store.close();}}});
}
