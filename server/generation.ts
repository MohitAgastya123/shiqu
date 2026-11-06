// English product messages; source evidence and machine identifiers remain stable.
// Select a complete provider explicitly; subscription mode never falls back to API billing.
import {formatSystemPrompt} from '../lib/reader-prompt-format.ts';
import {promptRecord} from '../lib/reader-prompt-records.ts';
import {discoveryCall} from '../lib/reader-discovery-call.ts';
import {normalizeProductionPrompt,storyEditorialContext} from '../lib/reader-prompts.ts';
import {verifiedOriginalPayload} from '../lib/reader-source-types.ts';
import {assertStoryBriefReady} from '../lib/reader-story-brief.ts';
import {createOpenAIProvider,createDeepSeekProvider} from './openai-provider.ts';
import {frameRecommendationOutputSchema,frameRecommendationOutputJson,frameRecommendationPrompt,frameRecommendationPayload} from '../lib/reader-frame-recommendation.ts';
import {configuredModels,makeGenerator,suggestStories,safeGeminiError,recommendStoryArt,matchStoryThemes} from '../lib/reader-gemini.ts';
import {storyDraftSchema,ReaderError} from '../lib/reader-model.ts';
import {geminiGenerationTimeoutMs} from '../lib/reader-limits.ts';
import {codexGenerationTimeoutMs} from '../lib/codex-settings.ts';
import {choicesJson,storyDraftJson,suggestionSystemPrompt,draftInstructions,imagePrompt,nativeImageInstructions,imageTypes,mediaType,storySource} from '../lib/reader-generation-contract.ts';
import {freshSuggestions,suggestionBatchSchema} from '../lib/reader-suggestions.ts';
import {getArtStyle} from '../lib/reader-styles.ts';
import {saveStoryOriginal} from '../lib/reader-source-storage.ts';
import type {MediaStore} from '../lib/services.ts';
import type {ReaderProvider,ProviderStatus} from '../lib/reader-provider.ts';
import {ClaudeError,createClaudeRunner} from './claude-runner.ts';
import {CodexError,createCodexRunner} from './codex-runner.ts';
import type {CodexRunner} from './codex-runner.ts';
import {localChoicesJson,localScanJson,localCatalogOutputJson,localChoices,localReadingPrompt,localSuggestionPayload} from '../lib/reader-local-contract.ts';
import {themeMatchPrompt,themeMatchPayload,themeMatchJson,parseThemeMatches,themeMatchModel,themeMatchEffort} from '../lib/reader-theme-match.ts';
import {readerImageAsset,referenceImageKey} from '../lib/reader-image-assets.ts';
import {imageDimensions} from '../lib/reader-image-dimensions.ts';
import {storyboardGenerator} from '../lib/reader-storyboard.ts';
import {artRecommendationJson,artRecommendationSchema,selectedArtRecommendationPrompt,selectedArtRecommendationPayload} from '../lib/reader-art-recommendation.ts';
import {configuredTaskReasoning} from '../lib/reader-reasoning.ts';

function codexMessage(code:string){
 if(code==='INVALID_REASONING_EFFORT')return 'Invalid Codex reasoning effort. Use low, medium, high, xhigh, max, or leave blank for the default.';
 if(code==='MODEL_UNAVAILABLE')return 'Codex did not use the requested theme matching model. Check Luna model access and retry.';
 if(code==='REASONING_EFFORT_UNAVAILABLE')return 'Codex did not use the requested reasoning effort. Check the CLI version and model support.';
 if(code==='CHATGPT_LOGIN_REQUIRED')return 'Run codex login and sign in with your ChatGPT account. Subscription mode does not use API keys.';
 if(code==='UNSUPPORTED_PLATFORM')return 'Codex subscription mode supports macOS and Linux. On Windows, choose OpenAI API, Gemini, or read-only mode.';
 if(code==='CLI_UNAVAILABLE')return 'Codex CLI was not found. Install Codex or set CODEX_BIN, then restart the service.';
 if(code==='TIMEOUT')return 'Codex generation timed out. Previous content has been retained. Retry later.';
 if(code==='UNSAFE_CONFIGURATION')return 'Codex tool isolation is unavailable. Use a supported Codex version and check settings.';
 if(code==='IMAGE_UNAVAILABLE'||code==='INVALID_IMAGE')return 'Codex did not return a valid image. Check subscription usage and image generation access, then retry.';
 return 'Codex could not complete this step. Check subscription usage and sign-in status. Previous content has been retained.';
}
export function safeCodexError(error:unknown){const code=error instanceof CodexError?error.message:'INVALID_OUTPUT';console.error('codex_generation_error',JSON.stringify({code}));return codexMessage(code);}
export function safeClaudeError(error:unknown){
 const code=error instanceof ClaudeError?error.message:'INVALID_OUTPUT';
 console.error('claude_generation_error',JSON.stringify({code}));
 if(code==='CLAUDE_LOGIN_REQUIRED'||code==='SUBSCRIPTION_REQUIRED')return 'Run claude auth login with a Claude subscription account. API billing is not used.';
 if(code==='CLI_UNAVAILABLE')return 'Claude Code CLI was not found. Install it or set CLAUDE_BIN.';
 if(code==='RATE_LIMITED')return 'The Claude subscription limit has been reached. Wait for the limit to reset. Progress has been retained; API billing will not be used.';
 if(code==='TEXT_ONLY')return 'The Claude Code provider supports text only. Stop before image generation.';
 if(code==='TIMEOUT')return 'Claude Code generation timed out. Previous content has been retained.';
 if(code==='UNSAFE_CONFIGURATION'||code==='UNEXPECTED_TOOL')return 'Claude Code tool isolation is unavailable. This call has been stopped.';
 return 'Claude Code could not complete this step. Check sign-in, model access, and subscription usage. Progress has been retained.';
}
// Text work stays on SHIQU_AI_PROVIDER; an optional SHIQU_IMAGE_PROVIDER draws through the same production workflow.
export function createReaderProvider(variables:Record<string,string|undefined>,media:MediaStore,transport:typeof fetch,runner?:CodexRunner):ReaderProvider{
 const name=variables.SHIQU_AI_PROVIDER?.trim()||'gemini',imageName=variables.SHIQU_IMAGE_PROVIDER?.trim()||'';
 const text=createSingleProvider(name,variables,media,transport,runner);
 // Read-only has no image side, so its image setting is ignored rather than validated.
 if(name==='readonly'||!imageName||imageName===name)return text;
 if(!['gemini','codex','openai'].includes(imageName))throw Error('SHIQU_IMAGE_PROVIDER must be gemini, codex or openai');
 return withImageProvider(text,createSingleProvider(imageName,variables,media,transport,runner));
}
// Compose one provider from separate text and image providers. Image errors keep the image provider's safe messages.
export function withImageProvider(text:ReaderProvider,image:ReaderProvider):ReaderProvider{
 const imageErrors=new WeakSet<object>();
 const safeError=(error:unknown)=>error&&typeof error==='object'&&imageErrors.has(error)?image.safeError(error):text.safeError(error);
 return {
  ...text,
  generationTimeoutMs:phase=>(phase==='image'?image:text).generationTimeoutMs?.(phase)??null,
  async status(){
   const [textStatus,imageStatus]=await Promise.all([text.status(),image.status()]);
   const imageMessage=!imageStatus.configured?'Image provider: '+(imageStatus.message||'Not configured. Check the image provider API key or sign-in status.'):undefined;
   const message=!textStatus.configured?textStatus.message:imageMessage,reason=!textStatus.configured?textStatus.reason:imageStatus.reason;
   return {...textStatus,configured:textStatus.configured&&imageStatus.configured,...(reason?{reason}:{}),imageProvider:imageStatus.provider as NonNullable<ProviderStatus['imageProvider']>,models:{text:textStatus.models.text,image:imageStatus.models.image},...(message?{message}:{})};
  },
  generator(){
   const generator=text.generator(),drawing=image.generator();
   return {...generator,safeError,async image(...args){
    try{return await drawing.image(...args);}
    catch(error){if(error&&typeof error==='object')imageErrors.add(error);throw error;}
   }};
  },
  safeError,
 };
}
function createSingleProvider(name:string,variables:Record<string,string|undefined>,media:MediaStore,transport:typeof fetch,runner?:CodexRunner):ReaderProvider{
 if(name==='readonly'){
  const unavailable=()=>{throw new ReaderError(503,'Read-only mode is active. Open My space → Generation service and models on the computer running Shiqu.');};
  return {async status(){return {configured:false,provider:'readonly',models:{text:'',image:''},voiceEnabled:false};},suggestions:async()=>unavailable(),generator:()=>({plan:async()=>unavailable(),original:async()=>unavailable(),image:async()=>unavailable(),audio:async()=>unavailable(),reflection:async()=>unavailable(),reflectionCandidates:async()=>unavailable(),safeError:()=> 'Read-only mode is active. Configure a generation provider first.'}),safeError:()=> 'Read-only mode is active. Configure a generation provider first.'};
 }
 if(name==='openai')return createOpenAIProvider(variables,media,transport);
 if(name==='deepseek')return createDeepSeekProvider(variables,media,transport);
 if(name!=='gemini'&&name!=='codex'&&name!=='claude')throw Error('SHIQU_AI_PROVIDER must be gemini, codex, claude, openai, deepseek or readonly');
 const taskReasoningEfforts=configuredTaskReasoning(variables);
 if(name==='gemini'){
  const key=variables.GEMINI_API_KEY?.trim()||'',models=configuredModels(variables);
  return {generationTimeoutMs:phase=>['recommend','plan','reflection','review','repair','image'].includes(phase)?geminiGenerationTimeoutMs:null,async status(){return {configured:!!key,provider:'gemini',models,voiceEnabled:false,taskReasoningEfforts,themeMatching:{model:models.text,reasoningEffort:themeMatchEffort}};},suggestions:(selection,excluded,localBook,reading)=>suggestStories(key,selection,models,transport,excluded,localBook,taskReasoningEfforts,reading?.maxStories,reading),matchStories:(theme,stories,context)=>matchStoryThemes(key,theme,stories,models,transport,context),async recommendArt(selection,original){if(!original?.localSource)throw new ReaderError(400,'Select a story with a verified source first.');return recommendStoryArt(key,selection,original,models,transport,taskReasoningEfforts);},generator:()=>makeGenerator(key,media,models,transport,taskReasoningEfforts),safeError:safeGeminiError};
 }
 const claude=name==='claude',safeError=claude?safeClaudeError:safeCodexError,message=claude?(code:string)=>safeClaudeError(new ClaudeError(code)):codexMessage;
 const rawRunner=runner||(claude?createClaudeRunner(variables):createCodexRunner(variables)),cli:CodexRunner={status:()=>rawRunner.status(),run:job=>rawRunner.run({...job,instructions:formatSystemPrompt(job.instructions)})},models=claude?{text:variables.CLAUDE_MODEL?.trim()||'opus',image:''}:{text:variables.CODEX_MODEL?.trim()||'codex-default',image:'codex-image-generation'};
 const matchingModel=claude?models.text:themeMatchModel;
 let cached:Promise<ProviderStatus>|undefined,expires=0;
 function book(selection:Parameters<ReaderProvider['suggestions']>[0]){
  const source=storySource(selection);
  if(source.isUrl)throw new ReaderError(400,`${claude?'Claude Code':'Codex'} subscription mode requires a book title. Use Gemini for webpage URLs.`);
  return source.book;
 }
 const provider:ReaderProvider={
  generationTimeoutMs:phase=>['recommend','plan','reflection','review','repair','image'].includes(phase)?codexGenerationTimeoutMs:null,
  status(){
   if(!cached||Date.now()>=expires){expires=Date.now()+30000;cached=cli.status().then(({model:configuredModel,...result})=>({...result,...(!result.configured?{message:message(result.reason||'CLI_UNAVAILABLE')}:{ }),provider:name as 'codex'|'claude',models:{...models,text:configuredModel||models.text},voiceEnabled:false as const,taskReasoningEfforts,themeMatching:{model:matchingModel,reasoningEffort:themeMatchEffort}}));}
   return cached;
  },
  async suggestions(selection,excluded,localBook,reading){
   const scanning=localBook?.purpose==='scan'||localBook?.purpose==='catalog';
   const run=async(report:(meta:{model?:string;usage?:unknown;acceptedCount?:number})=>void)=>{
    const result=await cli.run({instructions:localBook?localReadingPrompt(localBook):suggestionSystemPrompt,prompt:JSON.stringify(localSuggestionPayload(book(selection),selection.theme,excluded,localBook,reading?.maxStories)),schema:localBook?.purpose==='catalog'?localCatalogOutputJson(localBook):scanning?localScanJson:localBook?localChoicesJson:choicesJson,timeoutMs:codexGenerationTimeoutMs,reasoningEffort:taskReasoningEfforts.suggest});
    report(result);
    const batch=localBook?localChoices(JSON.parse(result.text),localBook):suggestionBatchSchema.parse(JSON.parse(result.text));
    const fresh=scanning?batch:freshSuggestions(batch,excluded);report({acceptedCount:fresh.stories.length});
    return reading?.maxStories?{...fresh,stories:fresh.stories.slice(0,reading.maxStories)}:fresh;
   };
   return localBook?.purpose==='catalog'?discoveryCall({stage:'extraction',provider:name,model:models.text,effort:taskReasoningEfforts.suggest,requestedCount:localBook.scan?.maxStories||1},reading,run):run(()=>{});
  },
  async matchStories(theme,stories,context){
   return discoveryCall({stage:'matching',provider:name,model:matchingModel,effort:themeMatchEffort,requestedCount:stories.length},context,async report=>{
    const result=await cli.run({model:matchingModel,instructions:themeMatchPrompt,prompt:JSON.stringify(themeMatchPayload(theme,stories)),schema:themeMatchJson,timeoutMs:codexGenerationTimeoutMs,reasoningEffort:themeMatchEffort});report(result);
    const parsed=parseThemeMatches(JSON.parse(result.text),stories);report({acceptedCount:parsed.matches.length});return parsed;
   });
  },
  async recommendArt(selection,original){
   if(!original?.localSource)throw new ReaderError(400,'Select a story with a verified source first.');
   const result=await cli.run({instructions:selectedArtRecommendationPrompt,prompt:JSON.stringify(selectedArtRecommendationPayload(selection,original)),schema:artRecommendationJson,timeoutMs:codexGenerationTimeoutMs,reasoningEffort:taskReasoningEfforts.art});
   return artRecommendationSchema.parse(JSON.parse(result.text));
  },
  generator(){
   const run=async(job:Parameters<typeof cli.run>[0])=>({...await cli.run(job),promptRecord:promptRecord(job.instructions||'',job.prompt,job.schema)});
   return {
   ...storyboardGenerator(book,async(task,instructions,payload,schema)=>{
    const result=await run({instructions,prompt:JSON.stringify(payload),schema,timeoutMs:codexGenerationTimeoutMs,reasoningEffort:taskReasoningEfforts[task]});
    return {value:JSON.parse(result.text),model:result.model,requestId:result.requestId,usage:result.usage,promptRecord:result.promptRecord,reasoningEffort:result.reasoningEffort};
   }),
   original:(selection,plan,id)=>saveStoryOriginal(media,selection,plan,id,transport),
   async recommend(selection,id,original,prepareRequirements=false){
    const result=await run({instructions:frameRecommendationPrompt,prompt:JSON.stringify(frameRecommendationPayload(selection,original,prepareRequirements)),schema:frameRecommendationOutputJson(original,prepareRequirements),reasoningEffort:taskReasoningEfforts.frames});
    return {value:frameRecommendationOutputSchema(original,prepareRequirements).parse(JSON.parse(result.text)),model:result.model,requestId:result.requestId,usage:result.usage,promptRecord:result.promptRecord,reasoningEffort:result.reasoningEffort};
   },
   async plan(selection,id,original){
    assertStoryBriefReady(original);
    const result=await run({instructions:draftInstructions(!!original?.localSource),prompt:JSON.stringify({book:book(selection),chosenStory:selection.storyTitle,...(selection.storyTitle?{}:{theme:selection.theme}),editorialContext:storyEditorialContext(selection.theme),exactPageCount:selection.length,narrativeDetail:selection.narrativeDetail,productionPrompt:normalizeProductionPrompt(selection.productionPrompt||'',selection.theme),artDirection:getArtStyle(selection.artStyle).prompt,variationSeed:id,...(original?{verifiedOriginal:verifiedOriginalPayload(original)}:{})}),schema:storyDraftJson(selection.length),timeoutMs:codexGenerationTimeoutMs,reasoningEffort:taskReasoningEfforts.plan});
    const value=storyDraftSchema.parse(JSON.parse(result.text));if(selection.length!=='auto'&&value.pages.length!==selection.length)throw new CodexError('INVALID_PLAN');
    return {value,model:result.model,requestId:result.requestId,usage:result.usage,promptRecord:result.promptRecord,reasoningEffort:result.reasoningEffort};
   },
   async image(plan,page,id,reference,style='ink-pencil',productionPrompt='',artifactId){
    if(claude)throw new ClaudeError('TEXT_ONLY');
    let image:{bytes:Uint8Array;contentType:string}|undefined;
    if(reference){
     const key=referenceImageKey(id,reference);if(!key)throw new CodexError('INVALID_ANCHOR');
     const object=await media.get(key);if(!object)throw new CodexError('INVALID_ANCHOR');
     const bytes=new Uint8Array(await object.arrayBuffer()),contentType=mediaType(bytes);
     if(!contentType||bytes.length>12*1024*1024)throw new CodexError('INVALID_ANCHOR');image={bytes,contentType};
    }
    const result=await run({instructions:nativeImageInstructions,prompt:imagePrompt(plan,page,style,productionPrompt,!!image),image,generateImage:true});
    if(!result.image)throw new CodexError('IMAGE_UNAVAILABLE');
    const bytes=new Uint8Array(Buffer.from(result.image,'base64')),contentType=mediaType(bytes);
    if(!contentType||!bytes.length||bytes.length>12*1024*1024)throw new CodexError('INVALID_IMAGE');
    if(!imageDimensions(bytes))throw new CodexError('INVALID_IMAGE');
    const asset=readerImageAsset(id,page,imageTypes[contentType],artifactId);await media.put(asset.key,bytes,{contentType});
    return {value:asset.url,model:models.image,requestId:result.requestId,usage:result.usage,promptRecord:{...result.promptRecord,...(reference?{reference}:{})}};
   },
   async audio(){throw new CodexError('VOICE_DISABLED');},safeError,
  };},safeError,
 };
 return provider;
}
