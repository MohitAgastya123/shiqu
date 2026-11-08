// Comic dialogue and placement feedback share the ordinary source-grounded text workflow.
// English product messages; source evidence and machine identifiers remain stable.
// Share the Responses text adapter with DeepSeek; only OpenAI supports image generation here.
// Never log provider bodies or credentials, fetch returned image URLs, retry, or fall back to another provider.
// Planned scene canvases retarget image resolution while legacy calls keep their original size policy.
import {formatSystemPrompt} from '../lib/reader-prompt-format.ts';
import {promptRecord} from '../lib/reader-prompt-records.ts';
import {discoveryCall} from '../lib/reader-discovery-call.ts';
import {normalizeProductionPrompt,storyEditorialContext} from '../lib/reader-prompts.ts';
import {verifiedOriginalPayload} from '../lib/reader-source-types.ts';
import {assertStoryBriefReady} from '../lib/reader-story-brief.ts';
import {z} from 'zod';
import {ReaderError,storyDraftSchema} from '../lib/reader-model.ts';
import type {ReaderProvider} from '../lib/reader-provider.ts';
import type {MediaStore} from '../lib/services.ts';
import {configuredTaskReasoning,reasoningTasks} from '../lib/reader-reasoning.ts';
import type {ReasoningEffort,ReasoningTask} from '../lib/reader-reasoning.ts';
import {openaiDefaultModels} from '../lib/system-settings.ts';
import {storyboardGenerator} from '../lib/reader-storyboard.ts';
import {freshSuggestions,suggestionBatchSchema} from '../lib/reader-suggestions.ts';
import {localChoicesJson,localScanJson,localCatalogOutputJson,localCatalogOutputTokens,localChoices,localReadingPrompt,localSuggestionPayload} from '../lib/reader-local-contract.ts';
import {themeMatchPrompt,themeMatchPayload,themeMatchJson,parseThemeMatches,themeMatchOutputTokens,themeMatchModel,themeMatchEffort} from '../lib/reader-theme-match.ts';
import {choicesJson,storyDraftJson,suggestionSystemPrompt,draftInstructions,imagePrompt,imageTypes,mediaType,storySource} from '../lib/reader-generation-contract.ts';
import {artRecommendationJson,artRecommendationSchema,selectedArtRecommendationPrompt,selectedArtRecommendationPayload} from '../lib/reader-art-recommendation.ts';
import {frameRecommendationOutputSchema,frameRecommendationOutputJson,frameRecommendationPrompt,frameRecommendationPayload} from '../lib/reader-frame-recommendation.ts';
import {getArtStyle} from '../lib/reader-styles.ts';
import {saveStoryOriginal} from '../lib/reader-source-storage.ts';
import {readerImageAsset,referenceImageKey} from '../lib/reader-image-assets.ts';
import {imageDimensions,imageRequestSize} from '../lib/reader-image-dimensions.ts';
import {readerStoryboardTimeoutMs} from '../lib/reader-limits.ts';
import {responsesDiagnostic} from '../lib/reader-responses-diagnostics.ts';
import {geminiReviewEvidence as sourceReviewEvidence} from '../lib/reader-gemini-evidence.ts';

export class OpenAIError extends Error{usage?:unknown;model?:string;status:number;constructor(code:string,status=502){super(code);this.status=status;}}
// Responses strict schemas require every property. Nullable optional properties are restored before Zod validation.
export function strictOpenAISchema(input:unknown):any{
 if(!input||typeof input!=='object')return input;
 if(Array.isArray(input))return input.map(strictOpenAISchema);
 const value=input as Record<string,any>,output=Object.fromEntries(Object.entries(value).map(([key,item])=>[key,strictOpenAISchema(item)]));
 if(value.type==='object'&&value.properties){
  const required=new Set(value.required||[]);
  output.properties=Object.fromEntries(Object.entries(value.properties).map(([key,schema])=>[key,required.has(key)?strictOpenAISchema(schema):{anyOf:[strictOpenAISchema(schema),{type:'null'}]}]));
  output.required=Object.keys(value.properties);output.additionalProperties=false;
 }
 return output;
}
function restoreOptional(value:any,schema:any):any{
 if(Array.isArray(value))return value.map(item=>restoreOptional(item,schema?.items));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key,item])=>item!==null||schema?.required?.includes(key)).map(([key,item])=>[key,restoreOptional(item,schema?.properties?.[key])]));
 return value;
}
export function safeOpenAIError(error:unknown){
 const code=error instanceof OpenAIError?error.message:error instanceof z.ZodError?'INVALID_OUTPUT':error instanceof Error&&/abort|timeout/i.test(error.name)?'TIMEOUT':'PROVIDER_ERROR';
 console.error('openai_request_failed',JSON.stringify({code,status:error instanceof OpenAIError?error.status:undefined}));
 if(error instanceof OpenAIError){
  if(code==='MODEL_UNAVAILABLE')return 'OpenAI did not use the requested theme matching model. Check Luna model access and retry.';
  if(error.status===401||error.status===403)return 'The OpenAI API key or model access is unavailable. Check provider settings.';
  if(error.status===402||error.status===429)return 'OpenAI API billing, quota, or rate limits prevent this request. Progress has been retained.';
  if(error.status===404)return 'The OpenAI API model is unavailable. Check text and image model settings.';
  if(code==='REFUSED')return 'OpenAI could not generate this content. Adjust the story or production instructions.';
 }
 return code==='TIMEOUT'?'OpenAI API timed out. Progress has been retained.':'OpenAI API could not complete this step. Progress has been retained.';
}
export function createOpenAIProvider(variables:Record<string,string|undefined>,media:MediaStore,transport:typeof fetch):ReaderProvider{
 return createResponsesProvider('openai',variables,media,transport);
}
export function createDeepSeekProvider(variables:Record<string,string|undefined>,media:MediaStore,transport:typeof fetch):ReaderProvider{
 return createResponsesProvider('deepseek',variables,media,transport);
}
function safeDeepSeekError(error:unknown){
 const validation=error instanceof Error&&['EDITORIAL_SOURCE_QUOTE','EDITORIAL_COVERAGE_REQUIRED','FRAME_COUNT_REVIEW_SCOPE'].includes(error.message)?error.message:undefined;
 const code=error instanceof OpenAIError?error.message:error instanceof z.ZodError?'INVALID_OUTPUT':validation|| (error instanceof Error&&/abort|timeout/i.test(error.name)?'TIMEOUT':'PROVIDER_ERROR');
 console.error('deepseek_request_failed',JSON.stringify({code,status:error instanceof OpenAIError?error.status:undefined}));
 if(error instanceof OpenAIError){
  if(error.status===401||error.status===403)return 'The DeepSeek API key or model access is unavailable. Check provider settings.';
  if(error.status===402||error.status===429)return 'DeepSeek API billing, quota, or rate limits prevent this request. Progress has been retained.';
  if(error.status===404)return 'The DeepSeek API model is unavailable. Check text model settings.';
 }
 return code==='TIMEOUT'?'DeepSeek API timed out. Progress has been retained.':'DeepSeek API could not complete this step. Progress has been retained.';
}
function deepSeekEffort(effort:ReasoningEffort):ReasoningEffort{
 // DeepSeek maps medium and xhigh to high; expose the effective effort in saved call metadata.
 return effort==='medium'||effort==='xhigh'?'high':effort;
}
function createResponsesProvider(provider:'openai'|'deepseek',variables:Record<string,string|undefined>,media:MediaStore,transport:typeof fetch):ReaderProvider{
 const deepseek=provider==='deepseek',base=deepseek?'https://api.deepseek.com':'https://api.openai.com/v1';
 const key=(deepseek?variables.DEEPSEEK_API_KEY:variables.OPENAI_API_KEY)?.trim()||'';
 const models=deepseek?{text:variables.DEEPSEEK_TEXT_MODEL?.trim()||'deepseek-flash',image:''}:{text:variables.OPENAI_TEXT_MODEL?.trim()||openaiDefaultModels.text,image:variables.OPENAI_IMAGE_MODEL?.trim()||openaiDefaultModels.image};
 const reasoning=configuredTaskReasoning(variables),timeoutMs=deepseek?15*60*1000:readerStoryboardTimeoutMs,safeError=deepseek?safeDeepSeekError:safeOpenAIError;
 if(deepseek)for(const task of reasoningTasks)reasoning[task]=deepSeekEffort(reasoning[task]);
 const matchingModel=deepseek?models.text:themeMatchModel,matchingEffort=deepseek?deepSeekEffort(themeMatchEffort):themeMatchEffort,label=deepseek?'DeepSeek API':'OpenAI API';
 if([models.text,...(deepseek?[]:[models.image])].some(model=>!model.match(/^[\w.-]{1,100}$/)))throw new OpenAIError('INVALID_MODEL',400);
 async function request(route:string,body:Record<string,unknown>|FormData,timeout=timeoutMs){
  if(!key)throw new OpenAIError('KEY_REQUIRED',401);
  const multipart=body instanceof FormData;
  const response=await transport(base+route,{method:'POST',headers:{Authorization:'Bearer '+key,...(!multipart?{'Content-Type':'application/json'}:{})},body:multipart?body:JSON.stringify(body),signal:AbortSignal.timeout(timeout),redirect:'error'});
  if(!response.ok){await response.body?.cancel();throw new OpenAIError('PROVIDER_ERROR',response.status);}
  let value:any;try{value=await response.json();}catch{throw new OpenAIError('PROVIDER_ERROR',502);}
  if(!value||typeof value!=='object')throw new OpenAIError('PROVIDER_ERROR',502);
  return {value,requestId:response.headers.get('x-request-id')};
 }
 async function text(instructions:string,payload:unknown,schema:unknown,effort:ReasoningEffort,maxOutputTokens=8192,requestedModel=models.text,task?:ReasoningTask){
  // Resolve only exact saved source references before the unchanged canonical review validators.
  const evidence=deepseek?sourceReviewEvidence(payload,schema):{payload,schema,direction:'',resolve:(value:unknown)=>value};
  if(evidence.direction)instructions+='\n\n'+evidence.direction;
  instructions=formatSystemPrompt(instructions);
  // Full-story review can consume 32K in reasoning alone, before it emits its JSON report.
  const tokenLimit=deepseek?Math.max(maxOutputTokens,effort==='max'||effort==='high'&&task==='review'?65536:effort==='high'?32768:8192):maxOutputTokens;
  const started=Date.now();
  const outputSchema=strictOpenAISchema(evidence.schema);
  const {value,requestId}=await request('/responses',{model:requestedModel,instructions,input:[{role:'user',content:JSON.stringify(evidence.payload)}],reasoning:{effort},text:{format:{type:'json_schema',name:'story_result',strict:true,schema:outputSchema}},max_output_tokens:tokenLimit,store:false});
  if(deepseek)console.info('deepseek_response',JSON.stringify(responsesDiagnostic({status:value.status,incompleteReason:value.incomplete_details?.reason,inputTokens:value.usage?.input_tokens,outputTokens:value.usage?.output_tokens,reasoningTokens:value.usage?.output_tokens_details?.reasoning_tokens,cachedInputTokens:value.usage?.input_tokens_details?.cached_tokens,maxOutputTokens:tokenLimit,reasoningEffort:effort,elapsedMs:Date.now()-started})));
  const fail=(code:string)=>Object.assign(new OpenAIError(code),{usage:value.usage,model:value.model});
  if(!deepseek&&requestedModel===themeMatchModel&&value.model&&value.model!==requestedModel)throw fail('MODEL_UNAVAILABLE');
  if(value.status!=='completed')throw fail('INCOMPLETE_RESPONSE');
  const content=(value.output||[]).filter((item:any)=>item.type==='message').flatMap((item:any)=>item.content||[]);
  if(content.some((item:any)=>item.type==='refusal'))throw fail('REFUSED');
  const output=content.filter((item:any)=>item.type==='output_text').map((item:any)=>item.text).join('');
  let parsed;try{parsed=JSON.parse(output);}catch{throw fail('INVALID_OUTPUT');}
  return {value:evidence.resolve(restoreOptional(parsed,evidence.schema)),model:value.model||requestedModel,requestId:value.id||requestId,usage:value.usage||null,reasoningEffort:effort,promptRecord:promptRecord(instructions,evidence.payload,outputSchema)};
 }
 function book(selection:Parameters<ReaderProvider['suggestions']>[0]){
  const source=storySource(selection);if(source.isUrl)throw new ReaderError(400,label+' mode requires a built-in book or book title. Use Gemini for webpage URLs.');return source.book;
 }
 return {
  generationTimeoutMs:phase=>['recommend','plan','reflection','review','repair','image'].includes(phase)?timeoutMs:null,
  async status(){return {configured:!!key,provider,models,voiceEnabled:false,taskReasoningEfforts:reasoning,themeMatching:{model:matchingModel,reasoningEffort:matchingEffort},...(deepseek&&!key?{message:'Provide a DeepSeek key through DEEPSEEK_API_KEY. Keys from other providers are never used.'}:{})};},
  async suggestions(selection,excluded,localBook,reading){
   const scanning=localBook?.purpose==='scan'||localBook?.purpose==='catalog';
   const run=async(report:(meta:{model?:string;usage?:unknown;acceptedCount?:number})=>void)=>{
    const result=await text(localBook?localReadingPrompt(localBook):suggestionSystemPrompt,localSuggestionPayload(book(selection),selection.theme,excluded,localBook,reading?.maxStories),localBook?.purpose==='catalog'?localCatalogOutputJson(localBook):scanning?localScanJson:localBook?localChoicesJson:choicesJson,reasoning.suggest,localBook?.purpose==='catalog'?localCatalogOutputTokens(localBook.scan?.maxStories||1):scanning?10000:localBook?5000:2500);
    report(result);const batch=localBook?localChoices(result.value,localBook):suggestionBatchSchema.parse(result.value),fresh=scanning?batch:freshSuggestions(batch,excluded);report({acceptedCount:fresh.stories.length});
    return reading?.maxStories?{...fresh,stories:fresh.stories.slice(0,reading.maxStories)}:fresh;
   };
   return localBook?.purpose==='catalog'?discoveryCall({stage:'extraction',provider,model:models.text,effort:reasoning.suggest,requestedCount:localBook.scan?.maxStories||1},reading,run):run(()=>{});
  },
  async matchStories(theme,stories,context){
   return discoveryCall({stage:'matching',provider,model:matchingModel,effort:matchingEffort,requestedCount:stories.length},context,async report=>{
    const result=await text(themeMatchPrompt,themeMatchPayload(theme,stories),themeMatchJson,matchingEffort,themeMatchOutputTokens(stories.length),matchingModel);report(result);
    const parsed=parseThemeMatches(result.value,stories);report({acceptedCount:parsed.matches.length});return parsed;
   });
  },
  async recommendArt(selection,original){
   if(!original?.localSource)throw new ReaderError(400,'Select a story with a verified source first.');
   const result=await text(selectedArtRecommendationPrompt,selectedArtRecommendationPayload(selection,original),artRecommendationJson,reasoning.art,2048);return artRecommendationSchema.parse(result.value);
  },
  generator(){return {
   ...storyboardGenerator(book,(task,instructions,payload,schema,maxOutputTokens)=>text(instructions,payload,schema,reasoning[task],maxOutputTokens,models.text,task)),
   original:(selection,plan,id)=>saveStoryOriginal(media,selection,plan,id,transport),
   async recommend(selection,_id,original,prepareRequirements=false){const result=await text(frameRecommendationPrompt,frameRecommendationPayload(selection,original,prepareRequirements),frameRecommendationOutputJson(original,prepareRequirements),reasoning.frames,original.storyBrief?4096:2048);return {...result,value:frameRecommendationOutputSchema(original,prepareRequirements).parse(result.value)};},
   async plan(selection,id,original,bubblePlacementRetry){
    assertStoryBriefReady(original);
    const result=await text(draftInstructions(!!original?.localSource),{book:book(selection),chosenStory:selection.storyTitle,...(selection.storyTitle?{}:{theme:selection.theme}),editorialContext:storyEditorialContext(selection.theme),exactPageCount:selection.length,narrativeDetail:selection.narrativeDetail,productionPrompt:normalizeProductionPrompt(selection.productionPrompt||'',selection.theme),artDirection:getArtStyle(selection.artStyle).prompt,variationSeed:id,...(bubblePlacementRetry?{bubblePlacementRetry}:{}),...(original?{verifiedOriginal:verifiedOriginalPayload(original)}:{})},storyDraftJson(selection.length),reasoning.plan,Math.max(8192,(selection.length==='auto'?20:selection.length)*800));
    const value=storyDraftSchema.parse(result.value);if(selection.length!=='auto'&&value.pages.length!==selection.length)throw new OpenAIError('PLAN_LENGTH');return {...result,value};
   },
   async image(plan,page,id,reference,style='ink-pencil',productionPrompt='',artifactId){
    if(deepseek)throw new ReaderError(400,'DeepSeek supports text production only. Stop after storyboard review; another provider will not be called automatically for images.');
    const size=imageRequestSize(variables.IMAGE_SIZE,plan.pages[page].composition?.canvas);if(!size)throw new OpenAIError('INVALID_IMAGE_SIZE',400);
    const prompt=imagePrompt(plan,page,style,productionPrompt,!!reference);
    let body:Record<string,unknown>|FormData={model:models.image,prompt,n:1,size:size.size,output_format:'png'},route='/images/generations';
    if(reference){
     const ref=referenceImageKey(id,reference);if(!ref)throw new OpenAIError('INVALID_ANCHOR');
     const saved=await media.get(ref);if(!saved)throw new OpenAIError('INVALID_ANCHOR');
     const bytes=new Uint8Array(await saved.arrayBuffer()),mime=mediaType(bytes);
     if(!mime||!imageDimensions(bytes)||bytes.length>12*1024*1024)throw new OpenAIError('INVALID_ANCHOR');
     const form=new FormData();for(const [name,value] of Object.entries(body))form.set(name,String(value));
     form.set('image[]',new Blob([bytes],{type:mime}),'reference.'+imageTypes[mime]);body=form;route='/images/edits';
    }
    const {value,requestId}=await request(route,body),encoded=value.data?.[0]?.b64_json;
    if(typeof encoded!=='string'||!encoded.length||encoded.length>17*1024*1024||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))throw new OpenAIError('INVALID_IMAGE');
    const bytes=new Uint8Array(Buffer.from(encoded,'base64')),mime=mediaType(bytes);
    if(!mime||!imageDimensions(bytes)||bytes.length>12*1024*1024)throw new OpenAIError('INVALID_IMAGE');
    const asset=readerImageAsset(id,page,imageTypes[mime],artifactId);await media.put(asset.key,bytes,{contentType:mime});
    return {value:asset.url,model:models.image,requestId,usage:value.usage||null,promptRecord:promptRecord('',prompt,undefined,reference||undefined)};
   },
   async audio(){throw new ReaderError(400,'Audio narration is not currently available.');},safeError,
  };},safeError,
 };
}
