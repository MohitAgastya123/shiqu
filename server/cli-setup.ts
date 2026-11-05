// Terminal-only provider onboarding. Hidden input never echoes keys; only explicit completed setup persists them.
import {createInterface} from 'node:readline/promises';
import {providerNames,imageProviderNames,settingsVariables,validApiKey,effectiveImageProvider,isApiProvider} from '../lib/system-settings.ts';
import type {ProviderName,ImageProviderName,ApiProviderName,SystemSettings} from '../lib/system-settings.ts';
import type {SystemSettingsStore,KeyChange} from './system-settings.ts';
import {geminiReasoningEfforts,taskReasoningDefaults} from '../lib/reader-reasoning.ts';

export type SetupPrompt={text:(question:string)=>Promise<string>;secret:(question:string)=>Promise<string>};
function requireTerminal(){if(!process.stdin.isTTY||!process.stdout.isTTY)throw Error('尚未配置生成服务；请在交互终端运行 --configure，或用 SHIQU_AI_PROVIDER（可选 SHIQU_IMAGE_PROVIDER）和对应 API 密钥指定服务；仅阅读可设置 SHIQU_AI_PROVIDER=readonly。');}
export async function askSetupText(question:string){
 requireTerminal();const terminal=createInterface({input:process.stdin,output:process.stdout}),abort=new AbortController();
 terminal.once('SIGINT',()=>abort.abort());terminal.once('close',()=>abort.abort());
 try{return await terminal.question(question,{signal:abort.signal});}catch{throw Error('已取消服务配置。');}finally{terminal.close();}
}
export async function askHiddenKey(question:string){
 requireTerminal();const input=process.stdin,wasRaw=!!input.isRaw,wasPaused=input.isPaused();
 input.setRawMode(true);input.resume();process.stdout.write(question);
 return new Promise<string>((resolve,reject)=>{
  let value='';
  function cleanup(){input.off('data',data);input.off('end',cancel);input.off('error',cancel);input.setRawMode(wasRaw);if(wasPaused)input.pause();process.stdout.write('\n');}
  function cancel(){cleanup();reject(Error('已取消服务配置。'));}
  function data(chunk:Buffer){
   // Strip terminal escape sequences so cursor keys cannot become credential characters.
   // eslint-disable-next-line no-control-regex
   for(const character of chunk.toString('utf8').replace(/\x1b\[[0-9;]*[A-Za-z~]/g,'')){
    if(character==='\x03'||character==='\x04'){cancel();return;}
    if(character==='\r'||character==='\n'){cleanup();resolve(value);return;}
    if(character==='\x7f'||character==='\b')value=Array.from(value).slice(0,-1).join('');
    else if(character>=' '&&character!=='\x1b')value+=character;
    if(value.length>4096){cleanup();reject(Error('API 密钥长度不能超过 4096。'));return;}
   }
  }
  input.on('data',data);input.once('end',cancel);input.once('error',cancel);
 });
}
export const terminalSetupPrompt:SetupPrompt={text:askSetupText,secret:askHiddenKey};
const keyNames={gemini:'GEMINI_API_KEY',openai:'OPENAI_API_KEY'} as const;
// Invocation overrides win for one run; saved credentials are read only for the active text/image providers.
export function effectiveProviderVariables(store:SystemSettingsStore,variables:Record<string,string|undefined>){
 const saved=store.settings(),name=variables.SHIQU_AI_PROVIDER?.trim()||saved.provider,imageName=variables.SHIQU_IMAGE_PROVIDER?.trim();
 if(!(providerNames as readonly string[]).includes(name))throw Error('SHIQU_AI_PROVIDER must be gemini, codex, openai or readonly');
 if(name!=='readonly'&&imageName&&!(imageProviderNames as readonly string[]).includes(imageName))throw Error('SHIQU_IMAGE_PROVIDER must be gemini, codex or openai');
 const provider=name as ProviderName,settings={...saved,provider,imageProvider:(imageName||saved.imageProvider) as ImageProviderName|undefined},image=effectiveImageProvider(settings);
 const effective:Record<string,string|undefined>={...settingsVariables(settings,store.key(provider),image?store.key(image):''),...variables,SHIQU_AI_PROVIDER:provider};
 if(image&&image!==provider)effective.SHIQU_IMAGE_PROVIDER=image;else delete effective.SHIQU_IMAGE_PROVIDER;
 return effective;
}
export function providerReady(variables:Record<string,string|undefined>){
 const text=variables.SHIQU_AI_PROVIDER;
 if(text==='readonly')return true;
 for(const name of new Set([text,variables.SHIQU_IMAGE_PROVIDER||text])){
  if(!isApiProvider(name))continue;
  const key=variables[keyNames[name]];
  if(!key?.trim())return false;validApiKey(key);
 }
 return true;
}
const providerLabels={codex:'Codex · 已登录的 CLI（订阅额度）',openai:'OpenAI API · API 密钥（单独计费）',gemini:'Gemini · API 密钥',readonly:'只读 · 不生成内容'};
async function chooseImageProvider(prompt:SetupPrompt,saved:SystemSettings,provider:ImageProviderName,platform:string){
 const choices=(platform==='win32'?['openai','gemini']:['codex','openai','gemini']) as ImageProviderName[],current=saved.imageProvider&&choices.includes(saved.imageProvider)?saved.imageProvider:undefined;
 while(true){
  const answer=(await prompt.text('选择图片服务：\n0. 与文本服务相同\n'+choices.map((name,index)=>`${index+1}. ${providerLabels[name]}`).join('\n')+`\n输入编号或名称（回车${current?`保留 ${current}`:'与文本服务相同'}）：`)).trim().toLowerCase();
  if(!answer)return current===provider?undefined:current;
  if(answer==='0'||answer==='same')return undefined;
  const chosen=choices.includes(answer as ImageProviderName)?answer as ImageProviderName:/^[1-9]$/.test(answer)?choices[Number(answer)-1]:undefined;
  if(chosen)return chosen===provider?undefined:chosen;
 }
}
async function askKey(store:SystemSettingsStore,prompt:SetupPrompt,provider:ApiProviderName,purpose=''){
 const present=!!store.key(provider),answer=await prompt.secret(`${purpose}${provider==='openai'?'OpenAI':'Gemini'} API 密钥（输入隐藏${present?'，回车保留已保存密钥':''}）：`);
 if(answer.trim())return {provider,value:validApiKey(answer)};
 if(!present)throw Error('未输入 API 密钥；未保存此次服务配置。可选择只读模式。');
}
export async function configureProvider(store:SystemSettingsStore,prompt:SetupPrompt=terminalSetupPrompt,platform=process.platform){
 const saved=store.settings();
 const choices=(platform==='win32'?['openai','gemini','readonly']:['codex','openai','gemini','readonly']) as ProviderName[];
 let provider:ProviderName|undefined;
 while(!provider){
  const answer=(await prompt.text('选择生成服务（文本与分镜）：\n'+choices.map((name,index)=>`${index+1}. ${providerLabels[name]}`).join('\n')+'\n输入编号或名称'+(saved.providerConfigured?`（回车保留 ${saved.provider}）`:'')+'：')).trim().toLowerCase();
  provider=choices.includes(answer as ProviderName)?answer as ProviderName:/^[1-4]$/.test(answer)?choices[Number(answer)-1]:!answer&&saved.providerConfigured?saved.provider:undefined;
 }
 // Read-only keeps the saved image choice for a later switch back.
 const imageProvider=provider==='readonly'?saved.imageProvider:await chooseImageProvider(prompt,saved,provider,platform);
 const separate=provider!=='readonly'&&!!imageProvider&&imageProvider!==provider;
 const patch:Partial<SystemSettings>={provider,providerConfigured:true,imageProvider:imageProvider??null} as Partial<SystemSettings>;
 const changes:KeyChange[]=[];
 if(provider==='gemini'||provider==='openai'){
  const change=await askKey(store,prompt,provider,separate?'文本服务 ':'');if(change)changes.push(change);
  const textField=provider==='openai'?'openaiTextModel':'textModel',imageField=provider==='openai'?'openaiImageModel':'imageModel';
  patch[textField]=(await prompt.text(`文本模型（回车使用 ${saved[textField]}）：`)).trim()||saved[textField];
  if(!separate)patch[imageField]=(await prompt.text(`图片模型（回车使用 ${saved[imageField]}）：`)).trim()||saved[imageField];
 }else if(provider==='codex')patch.codexModel=(await prompt.text(`Codex 模型（回车使用 ${saved.codexModel||'CLI 默认'}）：`)).trim()||saved.codexModel;
 if(separate&&(imageProvider==='gemini'||imageProvider==='openai')){
  const change=await askKey(store,prompt,imageProvider,'图片服务 ');if(change)changes.push(change);
  const imageField=imageProvider==='openai'?'openaiImageModel':'imageModel';
  patch[imageField]=(await prompt.text(`图片模型（回车使用 ${saved[imageField]}）：`)).trim()||saved[imageField];
 }
 if(provider==='gemini')patch.taskReasoningEfforts=Object.fromEntries(Object.entries(saved.taskReasoningEfforts).map(([task,value])=>[task,(geminiReasoningEfforts as readonly string[]).includes(value)?value:taskReasoningDefaults[task as keyof typeof taskReasoningDefaults]])) as SystemSettings['taskReasoningEfforts'];
 store.save(patch,changes);
}
export async function cliProviderConfiguration(store:SystemSettingsStore,variables:Record<string,string|undefined>,prompt?:SetupPrompt){
 let effective=effectiveProviderVariables(store,variables);
 if(!providerReady(effective)){
  await configureProvider(store,prompt);
  effective=effectiveProviderVariables(store,variables);
  if(!providerReady(effective))throw Error('本次环境变量仍覆盖为未完整配置的服务；请修正或移除相应环境变量。保存的配置仍然保留。');
 }
 return effective;
}
