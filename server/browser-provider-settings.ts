// English product messages; source evidence and machine identifiers remain stable.
// Keep local-only provider edits in the shared settings store; startup metadata never runs login probes.
// Trust socket metadata and exact loopback hosts, never forwarding headers. Saved keys never leave here.
import {z} from 'zod';
import {SystemSettingsStore} from './system-settings.ts';
import {desktopLibraryPaths} from './library-directory.ts';
import {effectiveProviderVariables} from './cli-setup.ts';
import {configuredTaskReasoning} from '../lib/reader-reasoning.ts';
import {configuredModels} from '../lib/reader-gemini.ts';
import {openaiDefaultModels,systemSettingsSchema,validApiKey} from '../lib/system-settings.ts';
import {loopbackAddress,providerSettingsSchema,providerSettingsSaveSchema,providerSettingsProofHeader} from '../lib/provider-settings.ts';
import type {ProviderSettingsView} from '../lib/provider-settings.ts';
import type {HttpPeer} from './http.ts';

type Variables=Record<string,string|undefined>;
const overrideNames=['SHIQU_AI_PROVIDER','GEMINI_API_KEY','GEMINI_TEXT_MODEL','GEMINI_IMAGE_MODEL','OPENAI_API_KEY','OPENAI_TEXT_MODEL','OPENAI_IMAGE_MODEL','CODEX_BIN','CODEX_MODEL','SHIQU_CODEX_HOME','CODEX_REASONING_EFFORT','CLAUDE_BIN','CLAUDE_MODEL','CLAUDE_CONFIG_DIR','DEEPSEEK_API_KEY','DEEPSEEK_TEXT_MODEL',...['SUGGEST','ART','FRAMES','OUTLINE','PLAN','REVIEW','REPAIR'].map(task=>'SHIQU_REASONING_'+task)];
function runtimeConfiguration(variables:Variables):ProviderSettingsView['runtime']{
 const provider=(variables.SHIQU_AI_PROVIDER?.trim()||'gemini') as ProviderSettingsView['runtime']['provider'],value=(key:string,fallback='')=>variables[key]?.trim()||fallback;
 if(provider==='readonly')return {provider,models:{text:'',image:''},configured:false};
 const models=provider==='gemini'?configuredModels(variables):provider==='openai'?{text:value('OPENAI_TEXT_MODEL',openaiDefaultModels.text),image:value('OPENAI_IMAGE_MODEL',openaiDefaultModels.image)}:provider==='codex'?{text:value('CODEX_MODEL','codex-default'),image:'codex-image-generation'}:{text:value(provider==='claude'?'CLAUDE_MODEL':'DEEPSEEK_TEXT_MODEL',provider==='claude'?'opus':'deepseek-flash'),image:''};
 const key=provider==='gemini'?'GEMINI_API_KEY':provider==='openai'?'OPENAI_API_KEY':provider==='deepseek'?'DEEPSEEK_API_KEY':null;
 return {provider,models,taskReasoningEfforts:configuredTaskReasoning(variables),...(key?{configured:!!value(key)}:{})};
}
// Compare credentials only in server memory and only for the effective provider.
function signature(variables:Variables){
 const {provider,models,taskReasoningEfforts}=runtimeConfiguration(variables),value=(key:string,fallback='')=>variables[key]?.trim()||fallback;
 if(provider==='readonly')return provider;
 const fields=provider==='gemini'?['GEMINI_API_KEY']:provider==='openai'?['OPENAI_API_KEY']:provider==='codex'?['CODEX_BIN','SHIQU_CODEX_HOME','CODEX_REASONING_EFFORT']:provider==='claude'?['CLAUDE_BIN','CLAUDE_CONFIG_DIR']:['DEEPSEEK_API_KEY'];
 return JSON.stringify({provider,models,reasoning:taskReasoningEfforts,fields:fields.map(key=>[key,value(key,key.endsWith('_BIN')?provider:'')])});
}
export function browserProviderSettings(options:{variables:Variables;overrides:Variables;ports:number[];locations?:ReturnType<typeof desktopLibraryPaths>;proxyToken?:string}){
 const runtimeSignature=signature(options.variables),locations=options.locations||desktopLibraryPaths(),hosts=new Set(options.ports.flatMap(port=>[`localhost:${port}`,`127.0.0.1:${port}`,`[::1]:${port}`]));
 const runtime=runtimeConfiguration(options.variables);
 const overrides=overrideNames.filter(name=>typeof options.overrides[name]==='string');
 const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
 const json=(value:unknown,status=200)=>Response.json(value,{status,headers});
 return async(request:Request,peer:HttpPeer)=>{
  const url=new URL(request.url),origin=request.headers.get('origin');
  const proxyVerified=options.proxyToken===undefined||!!options.proxyToken&&request.headers.get(providerSettingsProofHeader)===options.proxyToken;
  if(!proxyVerified||!loopbackAddress(peer.remoteAddress)||!hosts.has(url.host)||request.headers.get('sec-fetch-site')==='cross-site'||origin&&origin!==url.origin||request.method!=='GET'&&origin!==url.origin)return json({error:'Provider settings are available only on a same-origin page on this computer.'},403);
  if(!['GET','POST'].includes(request.method))return json({error:'Unsupported settings operation.'},405);
  let store:SystemSettingsStore|undefined;
  try{
   store=new SystemSettingsStore(locations.settings,locations.library);
   if(request.method==='POST'){
    if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return json({error:'Use JSON to save settings.'},415);
    const body=await request.text();if(body.length>16384)return json({error:'The settings payload is too large.'},413);
    const input=providerSettingsSaveSchema.parse(JSON.parse(body));
    if(input.expectedRevision!==store.revision())return json({error:'Settings were changed elsewhere. Reload them before saving.'},409);
    const current=store.settings(),merged=systemSettingsSchema.parse({...current,...input.settings,taskReasoningEfforts:{...current.taskReasoningEfforts,...input.settings.taskReasoningEfforts},providerConfigured:true});
    const provider=merged.provider,api=provider==='gemini'||provider==='openai';
    if(!api&&(input.keyAction!=='keep'||input.key))return json({error:'The current provider does not use an API key.'},400);
    if(input.keyAction!=='replace'&&input.key)return json({error:'Choose Replace key, or clear the input to keep the existing key.'},400);
    const key=api&&input.keyAction!=='keep'?{provider,value:input.keyAction==='remove'?null:validApiKey(input.key)}:undefined;
    if(api&&input.keyAction==='keep'&&!store.key(provider))return json({error:'Enter an API key for the selected provider, or choose read-only mode.'},400);
    store.save({...providerSettingsSchema.strip().parse(merged),providerConfigured:true},key,input.expectedRevision);
   }
   const snapshot=store.snapshot(),effective=effectiveProviderVariables(store,options.overrides);
   const view:ProviderSettingsView={settings:providerSettingsSchema.strip().parse(snapshot.settings),revision:snapshot.revision,keyPresent:snapshot.keyPresent,runtime,overrides,restartRequired:signature(effective)!==runtimeSignature,platform:process.platform};
   return json(view);
  }catch(error){
   if(error instanceof z.ZodError||error instanceof SyntaxError)return json({error:'Check the provider, model names, reasoning effort, and settings payload.'},400);
   if(error instanceof Error&&error.message.startsWith('Settings were changed elsewhere'))return json({error:error.message},409);
   if(error instanceof Error&&/^(?:The )?API key/.test(error.message))return json({error:'The API key must be a nonempty single line of at most 4096 bytes.'},400);
   return json({error:'Shared provider settings could not be read or saved. Check the local configuration and reload.'},503);
  }finally{store?.close();}
 };
}
