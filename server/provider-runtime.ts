// Share runtime summaries, restart checks and metadata connectivity tests without returning keys or generating content.
import {configuredTaskReasoning} from '../lib/reader-reasoning.ts';
import {configuredModels} from '../lib/reader-gemini.ts';
import {openaiDefaultModels,imageProviderNames} from '../lib/system-settings.ts';
import type {ProviderSettingsView} from '../lib/provider-settings.ts';
import {createReaderProvider} from './generation.ts';
import {FileMedia} from './media.ts';
type Variables=Record<string,string|undefined>;
export const providerOverrideNames=['SHIQU_AI_PROVIDER','SHIQU_IMAGE_PROVIDER','GEMINI_API_KEY','GEMINI_TEXT_MODEL','GEMINI_IMAGE_MODEL','OPENAI_API_KEY','OPENAI_TEXT_MODEL','OPENAI_IMAGE_MODEL','CODEX_BIN','CODEX_MODEL','SHIQU_CODEX_HOME','CODEX_REASONING_EFFORT','CLAUDE_BIN','CLAUDE_MODEL','CLAUDE_CONFIG_DIR','DEEPSEEK_API_KEY','DEEPSEEK_TEXT_MODEL',...['SUGGEST','ART','FRAMES','OUTLINE','PLAN','REVIEW','REPAIR'].map(task=>'SHIQU_REASONING_'+task)];
type RuntimeProvider=ProviderSettingsView['runtime']['provider'];
const keyNames:Partial<Record<RuntimeProvider,string>>={gemini:'GEMINI_API_KEY',openai:'OPENAI_API_KEY',deepseek:'DEEPSEEK_API_KEY'};
const credentialFields:Record<Exclude<RuntimeProvider,'readonly'>,string[]>={gemini:['GEMINI_API_KEY'],openai:['OPENAI_API_KEY'],codex:['CODEX_BIN','SHIQU_CODEX_HOME','CODEX_REASONING_EFFORT'],claude:['CLAUDE_BIN','CLAUDE_CONFIG_DIR'],deepseek:['DEEPSEEK_API_KEY']};
function providerModels(provider:Exclude<RuntimeProvider,'readonly'>,variables:Variables){
 const value=(key:string,fallback='')=>variables[key]?.trim()||fallback;
 return provider==='gemini'?configuredModels(variables):provider==='openai'?{text:value('OPENAI_TEXT_MODEL',openaiDefaultModels.text),image:value('OPENAI_IMAGE_MODEL',openaiDefaultModels.image)}:provider==='codex'?{text:value('CODEX_MODEL','codex-default'),image:'codex-image-generation'}:{text:value(provider==='claude'?'CLAUDE_MODEL':'DEEPSEEK_TEXT_MODEL',provider==='claude'?'opus':'deepseek-flash'),image:''};
}
// A separate image provider draws only; the text provider retains its own model and credentials.
function imageSide(provider:RuntimeProvider,variables:Variables){
 const image=variables.SHIQU_IMAGE_PROVIDER?.trim() as RuntimeProvider|undefined;
 return provider!=='readonly'&&image&&image!==provider&&(imageProviderNames as readonly string[]).includes(image)?image as Exclude<RuntimeProvider,'readonly'>:undefined;
}
export function runtimeConfiguration(variables:Variables):ProviderSettingsView['runtime']{
 const provider=(variables.SHIQU_AI_PROVIDER?.trim()||'gemini') as RuntimeProvider,value=(key:string)=>variables[key]?.trim()||'';
 if(provider==='readonly')return {provider,models:{text:'',image:''},configured:false};
 const image=imageSide(provider,variables),models=providerModels(provider,variables);
 const keys=[keyNames[provider],image&&keyNames[image]].filter((key):key is string=>!!key);
 return {provider,...(image?{imageProvider:image as NonNullable<ProviderSettingsView['runtime']['imageProvider']>}:{}),models:{text:models.text,image:image?providerModels(image,variables).image:models.image},taskReasoningEfforts:configuredTaskReasoning(variables),...(keys.length?{configured:keys.every(key=>!!value(key))}:{})};
}
// Compare active text and image credentials only in server memory.
export function providerSignature(variables:Variables){
 const {provider,imageProvider,models,taskReasoningEfforts}=runtimeConfiguration(variables),value=(key:string,fallback='')=>variables[key]?.trim()||fallback;
 if(provider==='readonly')return provider;
 const field=(name:Exclude<RuntimeProvider,'readonly'>)=>credentialFields[name].map(key=>[key,value(key,key.endsWith('_BIN')?name:'')]);
 return JSON.stringify({provider,imageProvider,models,reasoning:taskReasoningEfforts,fields:field(provider),imageFields:imageProvider?field(imageProvider):[]});
}
export async function checkProviderVariables(variables:Variables,transport:typeof fetch=fetch){
 const runtime=runtimeConfiguration(variables);
 if(runtime.provider==='readonly')return {ok:true,message:'Read-only mode is active; generation services will not be called.'};
 try{
  for(const provider of new Set([runtime.provider,runtime.imageProvider||runtime.provider])){
   const label=runtime.imageProvider?(provider===runtime.provider?'Text provider: ':'Image provider: '):'';
   if(provider==='codex'||provider==='claude'){
    const status=await createReaderProvider({...variables,SHIQU_AI_PROVIDER:provider,SHIQU_IMAGE_PROVIDER:''},new FileMedia('/unused-provider-check'),transport).status();
    if(!status.configured)return {ok:false,message:status.message||'Sign in to the generation service on this computer first.'};
   }else{
    const key=variables[keyNames[provider]!]?.trim();
    if(!key)return {ok:false,message:label+'Configure the generation provider and save its API key first.'};
    const models=[...(provider===runtime.provider?[runtime.models.text]:[]),...(provider===(runtime.imageProvider||runtime.provider)?[runtime.models.image]:[])].filter(Boolean);
    for(const model of new Set(models)){
     const base=provider==='openai'?'https://api.openai.com/v1/models/':provider==='deepseek'?'https://api.deepseek.com/models':'https://generativelanguage.googleapis.com/v1beta/models/';
     const response=await transport(base+(provider==='deepseek'?'':encodeURIComponent(model)),{headers:provider==='gemini'?{'x-goog-api-key':key}:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(10000),redirect:'error'});
     await response.body?.cancel();
     if(!response.ok)return {ok:false,message:`Model access check failed (HTTP ${response.status}). Check the API key and permissions.`};
    }
   }
  }
  return {ok:true,message:(runtime.imageProvider?'Text and image providers: ':'')+'Connection check passed. Only model metadata or sign-in status was checked; no content was generated.'};
 }catch{return {ok:false,message:'Connection check failed. Check the network or local sign-in status; no content was generated.'};}
}
