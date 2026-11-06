// English product text and generation contracts; canonical source evidence remains unchanged.
// Generate story plans and media through Gemini, preserving safe errors and validated results.
import {formatSystemPrompt} from './reader-prompt-format.ts';
import {promptRecord} from './reader-prompt-records.ts';
import {discoveryCall} from './reader-discovery-call.ts';
import type {DiscoveryContext} from './reader-discovery-call.ts';
import {normalizeProductionPrompt,storyEditorialContext} from './reader-prompts.ts';
import {z} from 'zod';
import {frameRecommendationOutputSchema,frameRecommendationOutputJson,frameRecommendationPrompt,frameRecommendationPayload} from './reader-frame-recommendation.ts';
import {readerMaxFrames,geminiGenerationTimeoutMs} from './reader-limits.ts';
import {storyDraftSchema,readerBooks} from './reader-model.ts';
import type {Plan,Selection} from './reader-model.ts';
import type {StoryGenerator} from './reader-engine.ts';
import {freshSuggestions,suggestionBatchSchema} from './reader-suggestions.ts';
import {getArtStyle} from './reader-styles.ts';
import {choicesJson,storyDraftJson,suggestionSystemPrompt,draftInstructions,imagePrompt,imageTypes,mediaType} from './reader-generation-contract.ts';
export {imageTypes} from './reader-generation-contract.ts';
import type {ArtStyleId} from './reader-styles.ts';
import {saveStoryOriginal} from './reader-source-storage.ts';
import {localChoicesJson,localScanJson,localCatalogOutputJson,localCatalogOutputTokens,localChoices,localReadingPrompt,localSuggestionPayload} from './reader-local-contract.ts';
import {themeMatchPrompt,themeMatchPayload,themeMatchJson,parseThemeMatches,themeMatchOutputTokens,themeMatchEffort} from './reader-theme-match.ts';
import type {ThemeStory} from './reader-theme-match.ts';
import type {WholeBookInput} from './reader-local-contract.ts';
import {verifiedOriginalPayload} from './reader-source-types.ts';
import {assertStoryBriefReady} from './reader-story-brief.ts';
import type {OriginalSource} from './reader-source-types.ts';
import {readerImageAsset,referenceImageKey} from './reader-image-assets.ts';
import {imageDimensions} from './reader-image-dimensions.ts';
import {storyboardGenerator} from './reader-storyboard.ts';
import {geminiReviewEvidence} from './reader-gemini-evidence.ts';
import {geminiResponseDiagnostic} from './reader-gemini-diagnostics.ts';
import {geminiOutputSchema} from './reader-gemini-schema.ts';
import {artRecommendationJson,artRecommendationSchema,selectedArtRecommendationPrompt,selectedArtRecommendationPayload} from './reader-art-recommendation.ts';
import {taskReasoningDefaults,geminiThinkingLevel} from './reader-reasoning.ts';
import type {TaskReasoningEfforts,ReasoningEffort,ReasoningTask} from './reader-reasoning.ts';

export const defaultModels={text:'gemini-3.8-flash',image:'gemini-nano-banana-2.1'};
type Models=typeof defaultModels;
export interface Assets {
 get(key:string):Promise<{arrayBuffer():Promise<ArrayBuffer>}|null>;
 put(key:string,value:ArrayBuffer|Uint8Array,options:{contentType:string}):Promise<unknown>;
}
type Part={text?:string;thought?:boolean;inlineData?:{mimeType:string;data:string}};
type UrlMetadata={retrievedUrl?:string;urlRetrievalStatus?:string;retrieved_url?:string;url_retrieval_status?:string};
type Candidate={content?:{parts?:Part[]};finishReason?:string;urlContextMetadata?:{urlMetadata?:UrlMetadata[]};url_context_metadata?:{url_metadata?:UrlMetadata[]}};
type Result={candidates?:Candidate[];promptFeedback?:{blockReason?:string};responseId?:string;modelVersion?:string;usageMetadata?:unknown};
export class GeminiError extends Error {
 status:number;
 constructor(code:string,status=502){super(code);this.status=status;}
}
const choicesSchema=suggestionBatchSchema;

export function configuredModels(vars:Record<string,string|undefined>):Models {
 return {text:vars.GEMINI_TEXT_MODEL?.trim()||defaultModels.text,image:vars.GEMINI_IMAGE_MODEL?.trim()||defaultModels.image};
}
function source(selection:Selection){
 const book=(selection.bookId==='other'?selection.customBook:readerBooks.find(b=>b.id===selection.bookId)?.sourceTitle||selection.bookId)?.trim();
 if(!book)throw new GeminiError('INVALID_SOURCE',400);
 let url='';
 if(/^https?:/i.test(book)){
  try{const parsed=new URL(book);if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)throw Error();parsed.hash='';url=parsed.href;}catch{throw new GeminiError('INVALID_SOURCE',400);}
 }
 return {book:url||book,url};
}
function wasRead(candidate:Candidate,url:string){
 const metadata=candidate.urlContextMetadata?.urlMetadata||candidate.url_context_metadata?.url_metadata||[];
 return metadata.some(m=>{
  try{const retrieved=new URL(m.retrievedUrl||m.retrieved_url||'');retrieved.hash='';return retrieved.href===url&&(m.urlRetrievalStatus||m.url_retrieval_status)==='URL_RETRIEVAL_STATUS_SUCCESS';}catch{return false;}
 });
}
function encode(bytes:Uint8Array){
 // Avoid spreading an entire image onto the JS stack in a Worker.
 let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
 return btoa(binary);
}
export function safeGeminiError(error:unknown){
 // Log only codes and validation paths, never raw provider messages, prompts or credentials.
 console.error('reader_generation_error',JSON.stringify(error instanceof GeminiError?{code:error.message,status:error.status}:error instanceof z.ZodError?{code:'INVALID_OUTPUT',fields:error.issues.map(i=>i.path.join('.'))}:{code:error instanceof Error?error.name:'UNKNOWN'}));
 if(error instanceof GeminiError){
  if(error.message==='UNSUPPORTED_REASONING_EFFORT')return 'Gemini text tasks support low, medium and high. Adjust the task reasoning setting.';
  if(error.message==='SOURCE_UNAVAILABLE')return 'Cannot read this link. Use a publicly accessible source page.';
  if(error.message==='INVALID_SOURCE')return 'Enter a valid book title or public webpage URL.';
  if(error.message==='CONTENT_BLOCKED')return 'This content cannot be generated. Try another story.';
  if(error.message==='SCHEMA_TOO_COMPLEX')return 'Gemini rejected this output schema. Progress is saved. Update the app or check the schema before retrying.';
  if(error.message==='UNSUPPORTED_FIELD')return 'Gemini does not support these request parameters. Progress is saved. Update the app or check the model configuration.';
  if(error.message==='INCOMPLETE_RESPONSE')return 'Gemini returned an incomplete result. Progress is saved. Check output and reasoning budgets, then retry.';
  if(error.message==='INVALID_TEXT'||error.message==='INVALID_JSON')return 'Gemini returned an invalid format. Progress is saved; retry explicitly.';
  if(error.status===401||error.status===403)return 'The provider key or model permissions are unavailable. Check provider settings.';
  if(error.status===402)return 'Provider billing or balance is unavailable. Check the Gemini project billing and quota. Your selection is saved.';
  if(error.status===404)return 'The selected model is unavailable. Check provider settings.';
  if(error.status===429)return 'The provider is busy or quota is unavailable. Your story is saved.';
  if(error.status===400)return 'Gemini rejected these parameters. Progress is saved. Check diagnostics and model settings.';
 }
 if(error instanceof Error&&/timeout|abort/i.test(error.name))return 'Generation timed out. Progress is saved; retry explicitly.';
 return 'This step could not generate. Progress is saved; retry explicitly.';
}
function client(key:string,transport:typeof fetch){
 return async(model:string,input:Record<string,unknown>,task:ReasoningTask|'image')=>{
  const started=Date.now();
  if(!/^[a-zA-Z0-9._-]+$/.test(model))throw new GeminiError('INVALID_MODEL',400);
  const response=await transport(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
   method:'POST',headers:{'x-goog-api-key':key,'Content-Type':'application/json'},
   body:JSON.stringify({...input,store:false}),signal:AbortSignal.timeout(geminiGenerationTimeoutMs),
  });
  // Never propagate a provider's response body; it may echo private prompts or credentials.
  if(!response.ok){
   let failure:{error?:{status?:string;message?:string}}={};try{failure=await response.json() as typeof failure;}catch{}
   const status=failure.error?.status,message=failure.error?.message||'';
   const reason=response.status===400?(/too (?:many states|complex)|(?:schema|grammar|constraint)[^.]*complex/i.test(message)?'SCHEMA_TOO_COMPLEX':/Unknown name "/i.test(message)?'UNSUPPORTED_FIELD':undefined):undefined;
   console.error('gemini_request_rejected',JSON.stringify({httpStatus:response.status,model,task,status:status&&/^[A-Z_]{1,50}$/.test(status)?status:undefined,reason}));
   throw new GeminiError(reason||'PROVIDER_ERROR',response.status);
  }
  let result:Result;try{result=await response.json() as Result;}catch{throw new GeminiError('PROVIDER_ERROR',502);}
  if(!result||typeof result!=='object')throw new GeminiError('PROVIDER_ERROR',502);
  const candidate=result.candidates?.[0];
  const config=input.generationConfig as {maxOutputTokens?:number;thinkingConfig?:{thinkingLevel?:string}}|undefined;
  console.info('gemini_response',JSON.stringify(geminiResponseDiagnostic({...result.usageMetadata as object,finishReason:candidate?candidate.finishReason||'FINISH_REASON_UNSPECIFIED':'NO_CANDIDATE',task,maxOutputTokens:config?.maxOutputTokens,thinkingLevel:config?.thinkingConfig?.thinkingLevel,elapsedMs:Date.now()-started})));
  const fail=(code:string)=>Object.assign(new GeminiError(code),{usage:result.usageMetadata,model:result.modelVersion||model});
  if(result.promptFeedback?.blockReason||candidate?.finishReason&&['SAFETY','IMAGE_SAFETY','PROHIBITED_CONTENT','BLOCKLIST','RECITATION'].includes(candidate.finishReason))throw fail('CONTENT_BLOCKED');
  if(!candidate||candidate.finishReason&&candidate.finishReason!=='STOP')throw fail('INCOMPLETE_RESPONSE');
  return {result,candidate,metadata:{model:result.modelVersion||model,requestId:result.responseId||response.headers.get('x-request-id')||null,usage:result.usageMetadata||null}};
 };
}
function textRequest(model:string,system:string,data:unknown,schema:unknown,url:string,maxOutputTokens:number,effort:ReasoningEffort){
 let thinkingLevel:string;try{thinkingLevel=geminiThinkingLevel(effort);}catch{throw new GeminiError('UNSUPPORTED_REASONING_EFFORT',400);}
 // Argon's high thinking shares the output cap; 8K can expire before the JSON answer begins.
 const tokenLimit=model==='gemini-4-argon'&&thinkingLevel==='HIGH'?Math.max(32768,maxOutputTokens):maxOutputTokens;
 return {systemInstruction:{parts:[{text:formatSystemPrompt(system)}]},contents:[{role:'user',parts:[{text:JSON.stringify(data)}]}],
  ...(url?{tools:[{urlContext:{}}]}:{}),
  generationConfig:{maxOutputTokens:tokenLimit,thinkingConfig:{thinkingLevel},responseFormat:{text:{mimeType:'APPLICATION_JSON',schema:geminiOutputSchema(schema)}}}};
}
function parseText(candidate:Candidate){
 const value=candidate.content?.parts?.filter(p=>!p.thought&&typeof p.text==='string').map(p=>p.text).join('');
 if(!value)throw new GeminiError('INVALID_TEXT');
 try{return JSON.parse(value);}catch{throw new GeminiError('INVALID_JSON');}
}
export async function suggestStories(key:string,selection:Selection,config:Partial<Models>={},transport:typeof fetch=fetch,excludeTitles:string[]=[],localBook?:WholeBookInput,reasoning:TaskReasoningEfforts=taskReasoningDefaults,maxStories?:1,context?:DiscoveryContext){
 const models={...defaultModels,...config},{book,url}=source(selection),scanning=localBook?.purpose==='scan'||localBook?.purpose==='catalog';
 const run=async(report:(meta:{model?:string;usage?:unknown;acceptedCount?:number})=>void)=>{
  const {candidate,metadata}=await client(key,transport)(models.text,textRequest(models.text,
   localBook?localReadingPrompt(localBook):suggestionSystemPrompt,
   localSuggestionPayload(book,selection.theme,excludeTitles,localBook,maxStories),localBook?.purpose==='catalog'?localCatalogOutputJson(localBook):scanning?localScanJson:localBook?localChoicesJson:choicesJson,url,localBook?.purpose==='catalog'?localCatalogOutputTokens(localBook.scan?.maxStories||1):scanning?10000:localBook?5000:2500,reasoning.suggest),'suggest');report(metadata);
  if(url&&!wasRead(candidate,url))return {stories:[],note:'Cannot read this link. Provide a public source page or enter the book title.'};
  const batch=localBook?localChoices(parseText(candidate),localBook):choicesSchema.parse(parseText(candidate));
  const fresh=scanning?batch:freshSuggestions(batch,excludeTitles);report({acceptedCount:fresh.stories.length});
  return maxStories?{...fresh,stories:fresh.stories.slice(0,maxStories)}:fresh;
 };
 return localBook?.purpose==='catalog'?discoveryCall({stage:'extraction',provider:'gemini',model:models.text,effort:reasoning.suggest,requestedCount:localBook.scan?.maxStories||1},context,run):run(()=>{});
}
export async function matchStoryThemes(key:string,theme:string,stories:ThemeStory[],config:Partial<Models>={},transport:typeof fetch=fetch,context?:DiscoveryContext){
 const models={...defaultModels,...config};
 return discoveryCall({stage:'matching',provider:'gemini',model:models.text,effort:themeMatchEffort,requestedCount:stories.length},context,async report=>{
  const {candidate,metadata}=await client(key,transport)(models.text,textRequest(models.text,themeMatchPrompt,themeMatchPayload(theme,stories),themeMatchJson,'',themeMatchOutputTokens(stories.length),themeMatchEffort),'suggest');report(metadata);
  const parsed=parseThemeMatches(parseText(candidate),stories);report({acceptedCount:parsed.matches.length});return parsed;
 });
}

export async function recommendStoryArt(key:string,selection:Selection,original:OriginalSource,config:Models,transport:typeof fetch,reasoning:TaskReasoningEfforts=taskReasoningDefaults){
 const {candidate}=await client(key,transport)(config.text,textRequest(config.text,selectedArtRecommendationPrompt,selectedArtRecommendationPayload(selection,original),artRecommendationJson,'',600,reasoning.art),'art');
 return artRecommendationSchema.parse(parseText(candidate));
}
export function makeGenerator(key:string,assets:Assets,config:Partial<Models>={},transport:typeof fetch=fetch,reasoning:TaskReasoningEfforts=taskReasoningDefaults):StoryGenerator{
 const models={...defaultModels,...config},generate=client(key,transport);
 return {
  ...storyboardGenerator(selection=>source(selection).book,async(task,instructions,payload,schema,maxOutputTokens,original)=>{
   const evidence=geminiReviewEvidence(payload,schema);
   if(evidence.direction){instructions+='\n\n'+evidence.direction;payload=evidence.payload;schema=evidence.schema;}
   const book=(payload as {book:string}).book,url=!original&&/^https?:/i.test(book)?book:'',input=textRequest(models.text,instructions,payload,schema,url,maxOutputTokens,reasoning[task]);
   const {candidate,metadata}=await generate(models.text,input,task);
   if(url&&!wasRead(candidate,url))throw new GeminiError('SOURCE_UNAVAILABLE');
   return {value:evidence.resolve(parseText(candidate)),...metadata,reasoningEffort:reasoning[task],promptRecord:promptRecord(instructions,payload,input.generationConfig.responseFormat.text.schema)};
  }),
  original:(selection,plan,id)=>saveStoryOriginal(assets,selection,plan,id,transport),
  async recommend(selection,id,original,prepareRequirements=false){
   const payload=frameRecommendationPayload(selection,original,prepareRequirements),schema=frameRecommendationOutputJson(original,prepareRequirements);
   const input=textRequest(models.text,frameRecommendationPrompt,payload,schema,'',original.storyBrief?4096:2000,reasoning.frames);
   const {candidate,metadata}=await generate(models.text,input,'frames');
   return {value:frameRecommendationOutputSchema(original,prepareRequirements).parse(parseText(candidate)),...metadata,reasoningEffort:reasoning.frames,promptRecord:promptRecord(frameRecommendationPrompt,payload,input.generationConfig.responseFormat.text.schema)};
  },
  async plan(selection:Selection,id:string,original?:OriginalSource){
   assertStoryBriefReady(original);
   const {book,url}=source(selection);
   const instructions=draftInstructions(!!original?.localSource),payload={book,chosenStory:selection.storyTitle,...(selection.storyTitle?{}:{theme:selection.theme}),editorialContext:storyEditorialContext(selection.theme),exactPageCount:selection.length,narrativeDetail:selection.narrativeDetail,productionPrompt:normalizeProductionPrompt(selection.productionPrompt||'',selection.theme),artDirection:getArtStyle(selection.artStyle).prompt,variationSeed:id,...(original?{verifiedOriginal:verifiedOriginalPayload(original)}:{})},schema=storyDraftJson(selection.length);
   const input=textRequest(models.text,instructions,payload,schema,original?'':url,Math.max(8192,(selection.length==='auto'?readerMaxFrames:selection.length)*800),reasoning.plan);
   const {candidate,metadata}=await generate(models.text,input,'plan');
   if(url&&!original&&!wasRead(candidate,url))throw new GeminiError('SOURCE_UNAVAILABLE');
   const value=storyDraftSchema.parse(parseText(candidate));
   if(selection.length!=='auto'&&value.pages.length!==selection.length)throw new GeminiError('INVALID_PLAN');
   return {value,...metadata,reasoningEffort:reasoning.plan,promptRecord:promptRecord(instructions,payload,input.generationConfig.responseFormat.text.schema)};
  },
  async image(plan:Plan,page:number,id:string,reference:string,style:ArtStyleId='ink-pencil',productionPrompt='',artifactId?:string){
   const parts:Part[]=[];
   if(reference){
    // Authorized book snapshots are copied into the target story namespace before this call.
    const key=referenceImageKey(id,reference);
    if(!key)throw new GeminiError(reference.startsWith(`/api/reader/media/${id}/`)?'INVALID_ANCHOR':'MISSING_ANCHOR');
    const anchor=await assets.get(key);if(!anchor)throw new GeminiError('MISSING_ANCHOR');
    const bytes=new Uint8Array(await anchor.arrayBuffer()),mimeType=mediaType(bytes);
    if(!mimeType||bytes.length>12*1024*1024)throw new GeminiError('INVALID_ANCHOR');
    parts.push({inlineData:{mimeType,data:encode(bytes)}});
   }
   const prompt=imagePrompt(plan,page,style,productionPrompt,!!reference);
   parts.push({text:prompt});
   const {candidate,metadata}=await generate(models.image,{contents:[{role:'user',parts}],generationConfig:{responseModalities:['TEXT','IMAGE'],imageConfig:{aspectRatio:'9:16',imageSize:'1K'}}},'image');
   const output=candidate.content?.parts?.find(p=>!p.thought&&p.inlineData)?.inlineData;
   if(!output||!(output.mimeType in imageTypes)||output.data.length>17*1024*1024)throw new GeminiError('INVALID_MEDIA');
   let bytes:Uint8Array;try{bytes=Uint8Array.from(atob(output.data),c=>c.charCodeAt(0));}catch{throw new GeminiError('INVALID_MEDIA');}
   if(!bytes.length||bytes.length>12*1024*1024||mediaType(bytes)!==output.mimeType)throw new GeminiError('INVALID_MEDIA');
   if(!imageDimensions(bytes))throw new GeminiError('INVALID_MEDIA');
   const asset=readerImageAsset(id,page,imageTypes[output.mimeType as keyof typeof imageTypes],artifactId);
   await assets.put(asset.key,bytes,{contentType:output.mimeType});
   return {value:asset.url,...metadata,promptRecord:promptRecord('',prompt,undefined,reference||undefined)};
  },
  async audio(){throw new GeminiError('VOICE_DISABLED');},
  safeError:safeGeminiError,
 };
}
