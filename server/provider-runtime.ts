// 统一运行配置摘要、重启判定和元数据连接检查，不返回密钥或生成内容。
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
// 独立图片服务只负责绘图，文本模型与密钥仍归文本服务。
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
// 仅在服务内存中比较实际文本及图片服务的凭证。
export function providerSignature(variables:Variables){
 const {provider,imageProvider,models,taskReasoningEfforts}=runtimeConfiguration(variables),value=(key:string,fallback='')=>variables[key]?.trim()||fallback;
 if(provider==='readonly')return provider;
 const field=(name:Exclude<RuntimeProvider,'readonly'>)=>credentialFields[name].map(key=>[key,value(key,key.endsWith('_BIN')?name:'')]);
 return JSON.stringify({provider,imageProvider,models,reasoning:taskReasoningEfforts,fields:field(provider),imageFields:imageProvider?field(imageProvider):[]});
}
export async function checkProviderVariables(variables:Variables,transport:typeof fetch=fetch){
 const runtime=runtimeConfiguration(variables);
 if(runtime.provider==='readonly')return {ok:true,message:'当前为只读模式，不调用生成服务。'};
 try{
  for(const provider of new Set([runtime.provider,runtime.imageProvider||runtime.provider])){
   const label=runtime.imageProvider?(provider===runtime.provider?'文本服务：':'图片服务：'):'';
   if(provider==='codex'||provider==='claude'){
    const status=await createReaderProvider({...variables,SHIQU_AI_PROVIDER:provider,SHIQU_IMAGE_PROVIDER:''},new FileMedia('/unused-provider-check'),transport).status();
    if(!status.configured)return {ok:false,message:status.message||'请先在本机登录生成服务。'};
   }else{
    const key=variables[keyNames[provider]!]?.trim();
    if(!key)return {ok:false,message:label+'请先配置生成服务并保存 API 密钥。'};
    const models=[...(provider===runtime.provider?[runtime.models.text]:[]),...(provider===(runtime.imageProvider||runtime.provider)?[runtime.models.image]:[])].filter(Boolean);
    for(const model of new Set(models)){
     const base=provider==='openai'?'https://api.openai.com/v1/models/':provider==='deepseek'?'https://api.deepseek.com/models/':'https://generativelanguage.googleapis.com/v1beta/models/';
     const response=await transport(base+encodeURIComponent(model),{headers:provider==='gemini'?{'x-goog-api-key':key}:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(10000),redirect:'error'});
     await response.body?.cancel();
     if(!response.ok)return {ok:false,message:`模型访问检查失败（HTTP ${response.status}），请检查密钥及权限。`};
    }
   }
  }
  return {ok:true,message:(runtime.imageProvider?'文本服务与图片服务':'')+'连接检查通过；仅检查模型元数据或登录状态，未生成内容。'};
 }catch{return {ok:false,message:'连接检查失败，请检查网络或本机登录状态；未生成内容。'};}
}
