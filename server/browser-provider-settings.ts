// Keep local-only provider edits in the shared settings store; startup metadata never runs login probes.
// Trust socket metadata and exact loopback hosts, never forwarding headers. Saved keys never leave here.
import {z} from 'zod';
import {SystemSettingsStore} from './system-settings.ts';
import {desktopLibraryPaths} from './library-directory.ts';
import {effectiveProviderVariables} from './cli-setup.ts';
import {configuredTaskReasoning} from '../lib/reader-reasoning.ts';
import {configuredModels} from '../lib/reader-gemini.ts';
import {openaiDefaultModels,systemSettingsSchema,validApiKey,imageProviderNames,effectiveImageProvider,isApiProvider} from '../lib/system-settings.ts';
import type {KeyChange} from './system-settings.ts';
import {loopbackAddress,providerSettingsSchema,providerSettingsSaveSchema,providerSettingsProofHeader} from '../lib/provider-settings.ts';
import type {ProviderSettingsView} from '../lib/provider-settings.ts';
import type {HttpPeer} from './http.ts';

type Variables=Record<string,string|undefined>;
const overrideNames=['SHIQU_AI_PROVIDER','SHIQU_IMAGE_PROVIDER','GEMINI_API_KEY','GEMINI_TEXT_MODEL','GEMINI_IMAGE_MODEL','OPENAI_API_KEY','OPENAI_TEXT_MODEL','OPENAI_IMAGE_MODEL','CODEX_BIN','CODEX_MODEL','SHIQU_CODEX_HOME','CODEX_REASONING_EFFORT','CLAUDE_BIN','CLAUDE_MODEL','CLAUDE_CONFIG_DIR','DEEPSEEK_API_KEY','DEEPSEEK_TEXT_MODEL',...['SUGGEST','ART','FRAMES','OUTLINE','PLAN','REVIEW','REPAIR'].map(task=>'SHIQU_REASONING_'+task)];
type RuntimeProvider=ProviderSettingsView['runtime']['provider'];
const keyNames:Partial<Record<RuntimeProvider,string>>={gemini:'GEMINI_API_KEY',openai:'OPENAI_API_KEY',deepseek:'DEEPSEEK_API_KEY'};
const credentialFields:Record<Exclude<RuntimeProvider,'readonly'>,string[]>={gemini:['GEMINI_API_KEY'],openai:['OPENAI_API_KEY'],codex:['CODEX_BIN','SHIQU_CODEX_HOME','CODEX_REASONING_EFFORT'],claude:['CLAUDE_BIN','CLAUDE_CONFIG_DIR'],deepseek:['DEEPSEEK_API_KEY']};
function providerModels(provider:Exclude<RuntimeProvider,'readonly'>,variables:Variables){
 const value=(key:string,fallback='')=>variables[key]?.trim()||fallback;
 return provider==='gemini'?configuredModels(variables):provider==='openai'?{text:value('OPENAI_TEXT_MODEL',openaiDefaultModels.text),image:value('OPENAI_IMAGE_MODEL',openaiDefaultModels.image)}:provider==='codex'?{text:value('CODEX_MODEL','codex-default'),image:'codex-image-generation'}:{text:value(provider==='claude'?'CLAUDE_MODEL':'DEEPSEEK_TEXT_MODEL',provider==='claude'?'opus':'deepseek-flash'),image:''};
}
// A separate image provider draws; text models and keys stay with the text provider.
function imageSide(provider:RuntimeProvider,variables:Variables){
 const image=variables.SHIQU_IMAGE_PROVIDER?.trim() as RuntimeProvider|undefined;
 return provider!=='readonly'&&image&&image!==provider&&(imageProviderNames as readonly string[]).includes(image)?image as Exclude<RuntimeProvider,'readonly'>:undefined;
}
function runtimeConfiguration(variables:Variables):ProviderSettingsView['runtime']{
 const provider=(variables.SHIQU_AI_PROVIDER?.trim()||'gemini') as RuntimeProvider,value=(key:string)=>variables[key]?.trim()||'';
 if(provider==='readonly')return {provider,models:{text:'',image:''},configured:false};
 const image=imageSide(provider,variables),models=providerModels(provider,variables);
 const keys=[keyNames[provider],image&&keyNames[image]].filter((key):key is string=>!!key);
 return {provider,...(image?{imageProvider:image as NonNullable<ProviderSettingsView['runtime']['imageProvider']>}:{}),models:{text:models.text,image:image?providerModels(image,variables).image:models.image},taskReasoningEfforts:configuredTaskReasoning(variables),...(keys.length?{configured:keys.every(key=>!!value(key))}:{})};
}
// Compare credentials only in server memory and only for the effective text and image providers.
function signature(variables:Variables){
 const {provider,imageProvider,models,taskReasoningEfforts}=runtimeConfiguration(variables),value=(key:string,fallback='')=>variables[key]?.trim()||fallback;
 if(provider==='readonly')return provider;
 const field=(name:Exclude<RuntimeProvider,'readonly'>)=>credentialFields[name].map(key=>[key,value(key,key.endsWith('_BIN')?name:'')]);
 return JSON.stringify({provider,imageProvider,models,reasoning:taskReasoningEfforts,fields:field(provider),imageFields:imageProvider?field(imageProvider):[]});
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
  if(!proxyVerified||!loopbackAddress(peer.remoteAddress)||!hosts.has(url.host)||request.headers.get('sec-fetch-site')==='cross-site'||origin&&origin!==url.origin||request.method!=='GET'&&origin!==url.origin)return json({error:'生成服务设置仅可在本机同源页面中访问。'},403);
  if(!['GET','POST'].includes(request.method))return json({error:'不支持的设置操作。'},405);
  let store:SystemSettingsStore|undefined;
  try{
   store=new SystemSettingsStore(locations.settings,locations.library);
   if(request.method==='POST'){
    if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return json({error:'请使用 JSON 保存设置。'},415);
    const body=await request.text();if(body.length>16384)return json({error:'设置内容过长。'},413);
    const input=providerSettingsSaveSchema.parse(JSON.parse(body));
    if(input.expectedRevision!==store.revision())return json({error:'设置已由另一入口修改，请重新读取后保存。'},409);
    const current=store.settings(),merged=systemSettingsSchema.parse({...current,...input.settings,taskReasoningEfforts:{...current.taskReasoningEfforts,...input.settings.taskReasoningEfforts},providerConfigured:true});
    const provider=merged.provider,api=provider==='gemini'||provider==='openai',image=effectiveImageProvider(merged),imageApi=image!==provider&&isApiProvider(image)?image:null;
    if(!api&&(input.keyAction!=='keep'||input.key))return json({error:'当前提供方不使用 API 密钥。'},400);
    if(!imageApi&&(input.imageKeyAction!=='keep'||input.imageKey))return json({error:'图片服务与文本服务相同或不使用 API 密钥。'},400);
    if(input.keyAction!=='replace'&&input.key||input.imageKeyAction!=='replace'&&input.imageKey)return json({error:'请选择替换密钥，或清空输入以保留现有密钥。'},400);
    const keys:KeyChange[]=[];
    if(api&&input.keyAction!=='keep')keys.push({provider,value:input.keyAction==='remove'?null:validApiKey(input.key)});
    if(imageApi&&input.imageKeyAction!=='keep')keys.push({provider:imageApi,value:input.imageKeyAction==='remove'?null:validApiKey(input.imageKey)});
    if(api&&input.keyAction==='keep'&&!store.key(provider))return json({error:'请先为所选服务填写 API 密钥，或选择只读模式。'},400);
    if(imageApi&&input.imageKeyAction==='keep'&&!store.key(imageApi))return json({error:'请先为图片服务填写 API 密钥，或改为与文本服务相同。'},400);
    // An unset image provider is sent as null so the patch clears a previous separate choice.
    store.save({...providerSettingsSchema.strip().parse(merged),imageProvider:merged.imageProvider??null,providerConfigured:true} as Partial<typeof merged>,keys,input.expectedRevision);
   }
   const snapshot=store.snapshot(),effective=effectiveProviderVariables(store,options.overrides);
   const view:ProviderSettingsView={settings:providerSettingsSchema.strip().parse(snapshot.settings),revision:snapshot.revision,keyPresent:snapshot.keyPresent,runtime,overrides,restartRequired:signature(effective)!==runtimeSignature,platform:process.platform};
   return json(view);
  }catch(error){
   if(error instanceof z.ZodError||error instanceof SyntaxError)return json({error:'请检查提供方、模型名称、推理档位和保存内容。'},400);
   if(error instanceof Error&&error.message.startsWith('设置已由另一入口'))return json({error:error.message},409);
   if(error instanceof Error&&error.message.startsWith('API 密钥'))return json({error:'API 密钥必须为非空单行且不超过 4096 字节。'},400);
   return json({error:'暂时无法读取或保存共享生成设置，请检查本机配置后重新读取。'},503);
  }finally{store?.close();}
 };
}
