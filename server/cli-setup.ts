// English product messages; source evidence and machine identifiers remain stable.
// Terminal-only provider onboarding. Hidden input never echoes keys; only explicit completed setup persists them.
import {createInterface} from 'node:readline/promises';
import {providerNames,settingsVariables,validApiKey} from '../lib/system-settings.ts';
import type {ProviderName,SystemSettings} from '../lib/system-settings.ts';
import type {SystemSettingsStore} from './system-settings.ts';
import {geminiReasoningEfforts,taskReasoningDefaults} from '../lib/reader-reasoning.ts';

export type SetupPrompt={text:(question:string)=>Promise<string>;secret:(question:string)=>Promise<string>};
function requireTerminal(){if(!process.stdin.isTTY||!process.stdout.isTTY)throw Error('No generation provider is configured. Run --configure in an interactive terminal, or set SHIQU_AI_PROVIDER and its API key. For reading only, set SHIQU_AI_PROVIDER=readonly.');}
export async function askSetupText(question:string){
 requireTerminal();const terminal=createInterface({input:process.stdin,output:process.stdout}),abort=new AbortController();
 terminal.once('SIGINT',()=>abort.abort());terminal.once('close',()=>abort.abort());
 try{return await terminal.question(question,{signal:abort.signal});}catch{throw Error('Provider setup canceled.');}finally{terminal.close();}
}
export async function askHiddenKey(question:string){
 requireTerminal();const input=process.stdin,wasRaw=!!input.isRaw,wasPaused=input.isPaused();
 input.setRawMode(true);input.resume();process.stdout.write(question);
 return new Promise<string>((resolve,reject)=>{
  let value='';
  function cleanup(){input.off('data',data);input.off('end',cancel);input.off('error',cancel);input.setRawMode(wasRaw);if(wasPaused)input.pause();process.stdout.write('\n');}
  function cancel(){cleanup();reject(Error('Provider setup canceled.'));}
  function data(chunk:Buffer){
   // Strip terminal escape sequences so cursor keys cannot become credential characters.
   // eslint-disable-next-line no-control-regex
   for(const character of chunk.toString('utf8').replace(/\x1b\[[0-9;]*[A-Za-z~]/g,'')){
    if(character==='\x03'||character==='\x04'){cancel();return;}
    if(character==='\r'||character==='\n'){cleanup();resolve(value);return;}
    if(character==='\x7f'||character==='\b')value=Array.from(value).slice(0,-1).join('');
    else if(character>=' '&&character!=='\x1b')value+=character;
    if(value.length>4096){cleanup();reject(Error('API keys must be at most 4096 characters.'));return;}
   }
  }
  input.on('data',data);input.once('end',cancel);input.once('error',cancel);
 });
}
export const terminalSetupPrompt:SetupPrompt={text:askSetupText,secret:askHiddenKey};
export function effectiveProviderVariables(store:SystemSettingsStore,variables:Record<string,string|undefined>){
 const saved=store.settings(),name=variables.SHIQU_AI_PROVIDER?.trim()||saved.provider;
 // DeepSeek and Claude are invocation-only: preserve saved task settings without loading another provider's key.
 if(name==='deepseek'||name==='claude')return {...settingsVariables(saved,''),...variables,SHIQU_AI_PROVIDER:name};
 if(!(providerNames as readonly string[]).includes(name))throw Error('SHIQU_AI_PROVIDER must be gemini, codex, claude, openai, deepseek or readonly');
 const provider=name as ProviderName;
 return {...settingsVariables({...saved,provider},store.key(provider)),...variables,SHIQU_AI_PROVIDER:provider};
}
export function providerReady(variables:Record<string,string|undefined>){
 if(variables.SHIQU_AI_PROVIDER==='readonly'||variables.SHIQU_AI_PROVIDER==='codex'||variables.SHIQU_AI_PROVIDER==='claude')return true;
 const key=variables.SHIQU_AI_PROVIDER==='deepseek'?variables.DEEPSEEK_API_KEY:variables.SHIQU_AI_PROVIDER==='openai'?variables.OPENAI_API_KEY:variables.GEMINI_API_KEY;
 if(!key?.trim())return false;validApiKey(key);return true;
}
export async function configureProvider(store:SystemSettingsStore,prompt:SetupPrompt=terminalSetupPrompt,platform=process.platform){
 const saved=store.settings();
 const choices=(platform==='win32'?['openai','gemini','readonly']:['codex','openai','gemini','readonly']) as ProviderName[];
 const labels={codex:'Codex · signed-in CLI (subscription usage)',openai:'OpenAI API · API key (separate billing)',gemini:'Gemini · API key',readonly:'Read-only · no generation'};
 let provider:ProviderName|undefined;
 while(!provider){
  const answer=(await prompt.text('Choose a generation provider:\n'+choices.map((name,index)=>`${index+1}. ${labels[name]}`).join('\n')+'\nEnter a number or name'+(saved.providerConfigured?` (Enter to keep ${saved.provider})`:'')+': ')).trim().toLowerCase();
  provider=choices.includes(answer as ProviderName)?answer as ProviderName:/^[1-4]$/.test(answer)?choices[Number(answer)-1]:!answer&&saved.providerConfigured?saved.provider:undefined;
 }
 const patch:Partial<SystemSettings>={provider,providerConfigured:true};
 let change:{provider:'gemini'|'openai';value:string}|undefined;
 if(provider==='gemini'||provider==='openai'){
  const present=!!store.key(provider),answer=await prompt.secret(`${provider==='openai'?'OpenAI':'Gemini'} API key (hidden input${present?', Enter to keep the saved key':''}): `);
  if(answer.trim())change={provider,value:validApiKey(answer)};
  else if(!present)throw Error('No API key was entered. Provider settings were not saved. You can choose read-only mode.');
  const textField=provider==='openai'?'openaiTextModel':'textModel',imageField=provider==='openai'?'openaiImageModel':'imageModel';
  patch[textField]=(await prompt.text(`Text model (Enter for ${saved[textField]}): `)).trim()||saved[textField];
  patch[imageField]=(await prompt.text(`Image model (Enter for ${saved[imageField]}): `)).trim()||saved[imageField];
 }else if(provider==='codex')patch.codexModel=(await prompt.text(`Codex model (Enter for ${saved.codexModel||'CLI default'}): `)).trim()||saved.codexModel;
 if(provider==='gemini')patch.taskReasoningEfforts=Object.fromEntries(Object.entries(saved.taskReasoningEfforts).map(([task,value])=>[task,(geminiReasoningEfforts as readonly string[]).includes(value)?value:taskReasoningDefaults[task as keyof typeof taskReasoningDefaults]])) as SystemSettings['taskReasoningEfforts'];
 store.save(patch,change);
}
export async function cliProviderConfiguration(store:SystemSettingsStore,variables:Record<string,string|undefined>,prompt?:SetupPrompt){
 let effective=effectiveProviderVariables(store,variables);
 if(!providerReady(effective)){
  if(effective.SHIQU_AI_PROVIDER==='deepseek')throw Error('Provide a DeepSeek key through DEEPSEEK_API_KEY. Keys from other providers are never used.');
  await configureProvider(store,prompt);
  effective=effectiveProviderVariables(store,variables);
  if(!providerReady(effective))throw Error('Environment overrides still select an incompletely configured provider. Correct or remove them. Saved settings have been retained.');
 }
 return effective;
}
