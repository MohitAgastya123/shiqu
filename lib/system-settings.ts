// English product messages; source identities and historical evidence stay stable.
// Share the non-secret settings wire format between CLI, desktop and their private runtime bridge.
// Provider-specific model slots survive switching; credentials always live in a separate table.
import {z} from 'zod';
import {codexReasoningEffortSchema} from './codex-settings.ts';
import {taskReasoningSchema,reasoningTasks,geminiReasoningEfforts} from './reader-reasoning.ts';
export const providerNames=['gemini','codex','openai','readonly'] as const;
export type ProviderName=typeof providerNames[number];
// Providers that can draw. An unset image provider follows the text provider.
export const imageProviderNames=['gemini','codex','openai'] as const;
export type ImageProviderName=typeof imageProviderNames[number];
export type ApiProviderName='gemini'|'openai';
export const openaiDefaultModels={text:'gpt-6.1-sol',image:'gpt-image-2.5-sunburst'};
const model=z.string().regex(/^[\w.-]{1,100}$/);
export const systemSettingsSchema=z.object({
 libraryConfigured:z.boolean().default(false),nodePath:z.string().max(4096).default(''),dataDirectory:z.string().min(1).max(4096),port:z.number().int().min(1024).max(65535).default(3000),
 lanEnabled:z.boolean().optional(),internetEnabled:z.boolean().default(false),cloudflaredPath:z.string().max(4096).default(''),
 provider:z.enum(providerNames).default('gemini'),providerConfigured:z.boolean().default(false),
 // Optional and omitted when unset (null clears it), so existing settings JSON stays unchanged.
 imageProvider:z.enum(imageProviderNames).nullish().transform(value=>value??undefined),
 textModel:model.default('gemini-3.8-flash'),imageModel:model.default('gemini-nano-banana-2.1'),
 openaiTextModel:model.default(openaiDefaultModels.text),openaiImageModel:model.default(openaiDefaultModels.image),
 codexPath:z.string().max(4096).default(''),codexModel:z.string().regex(/^[\w.-]{0,100}$/).default('gpt-6.1-sol'),codexHome:z.string().max(4096).default(''),codexReasoningEffort:codexReasoningEffortSchema,
 taskReasoningEfforts:taskReasoningSchema,
}).strict().superRefine((settings,ctx)=>{
 if(settings.provider==='gemini')for(const task of reasoningTasks)if(!(geminiReasoningEfforts as readonly string[]).includes(settings.taskReasoningEfforts[task]))ctx.addIssue({code:z.ZodIssueCode.custom,path:['taskReasoningEfforts',task],message:'Gemini supports only low, medium and high.'});
 for(const field of ['dataDirectory','nodePath','cloudflaredPath','codexPath','codexHome'] as const)if(/[\0\r\n]/.test(settings[field]))ctx.addIssue({code:z.ZodIssueCode.custom,path:[field],message:'Paths cannot contain control characters.'});
});
export type SystemSettings=z.infer<typeof systemSettingsSchema>;
export function defaultSystemSettings(library:string){return systemSettingsSchema.parse({dataDirectory:library});}
// Read-only has no image side; otherwise an unset image provider follows the text provider.
export function effectiveImageProvider(settings:Pick<SystemSettings,'provider'|'imageProvider'>):ImageProviderName|null{
 return settings.provider==='readonly'?null:settings.imageProvider||settings.provider;
}
export function isApiProvider(name:string|null|undefined):name is ApiProviderName{return name==='gemini'||name==='openai';}
const keyVariables={gemini:'GEMINI_API_KEY',openai:'OPENAI_API_KEY'} as const;
// Credentials are emitted only for the active text and image providers.
export function settingsVariables(settings:SystemSettings,key:string,imageKey=''){
 const image=effectiveImageProvider(settings),keys:Record<string,string>={};
 if(isApiProvider(settings.provider))keys[keyVariables[settings.provider]]=key;
 if(isApiProvider(image)&&image!==settings.provider)keys[keyVariables[image]]=imageKey;
 return {SHIQU_AI_PROVIDER:settings.provider,...(image&&image!==settings.provider?{SHIQU_IMAGE_PROVIDER:image}:{}),...keys,
 GEMINI_TEXT_MODEL:settings.textModel,GEMINI_IMAGE_MODEL:settings.imageModel,OPENAI_TEXT_MODEL:settings.openaiTextModel,OPENAI_IMAGE_MODEL:settings.openaiImageModel,
 CODEX_BIN:settings.codexPath||'codex',CODEX_MODEL:settings.codexModel,SHIQU_CODEX_HOME:settings.codexHome,CODEX_REASONING_EFFORT:settings.codexReasoningEffort,
 ...Object.fromEntries(reasoningTasks.map(task=>['SHIQU_REASONING_'+task.toUpperCase(),settings.taskReasoningEfforts[task]]))};
}
export function validApiKey(value:string){const key=value.trim();if(!key||new TextEncoder().encode(key).length>4096||/[\0\r\n]/.test(value))throw Error('The API key must be a nonempty single line of at most 4096 bytes.');return key;}
export function resetProviderSettings(settings:SystemSettings):SystemSettings{
 const defaults=defaultSystemSettings(settings.dataDirectory);
 const {imageProvider:_,...rest}=settings;void _;
 return {...rest,provider:defaults.provider,providerConfigured:false,textModel:defaults.textModel,imageModel:defaults.imageModel,openaiTextModel:defaults.openaiTextModel,openaiImageModel:defaults.openaiImageModel,codexPath:'',codexHome:'',codexModel:defaults.codexModel,codexReasoningEffort:'',taskReasoningEfforts:defaults.taskReasoningEfforts};
}
