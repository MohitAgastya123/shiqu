// English product messages; source evidence and machine identifiers remain stable.
// Bind whole-book or selected-chapter discovery and verified originals to the existing provider.
// Verify and persist originals before any paid storyboard request; never fall back remotely.
// Keep the provider's execution deadlines visible to the production countdown.
import type {ReaderProvider} from '../lib/reader-provider.ts';
import type {MediaStore} from '../lib/services.ts';
import type {Selection} from '../lib/reader-model.ts';
import type {OriginalSource} from '../lib/reader-source-types.ts';
import {ReaderError} from '../lib/reader-model.ts';
import {selectedChapterScope} from './local-book-contents.ts';
import {LocalBooks,localBookId} from './local-books.ts';
import {hasSourceAnomaly,hasStoredSourceAnomaly} from './local-source-quality.ts';
import {discoverLocalStories} from './local-story-discovery.ts';
import {StoryDiscoveryCache,discoveryHash} from './story-discovery-cache.ts';
import {measurementBusy,settleMeasurements} from './story-discovery-metrics.ts';
import {matchingBusy,settleMatching} from './story-theme-matching.ts';
import {localSourceKey,localSourceSchema,sourceRanges} from '../lib/reader-local-contract.ts';
import {artRecommendationSchema,selectedArtRecommendationPrompt} from '../lib/reader-art-recommendation.ts';
import {englishSourceLabel} from './local-book-contents.ts';

export function withLocalBooks(provider:ReaderProvider,books:LocalBooks,media:MediaStore,cache=new StoryDiscoveryCache(media)):ReaderProvider{
 async function persist(source:NonNullable<Awaited<ReturnType<LocalBooks['selected']>>>,id:string){
  await media.put(`reader/${id}/source.json`,new TextEncoder().encode(JSON.stringify(source)),{contentType:'application/json'});
  return source;
 }
 async function recommendArt(selection:Selection){
  const original=await books.selected(selection);
  if(!original?.localSource||!selection.storyTitle)throw new ReaderError(400,'Select a story with a verified source first.');
  if(!provider.recommendArt)throw new ReaderError(503,'Art style recommendations are unavailable. Choose an art style manually.');
  const status=await provider.status(),key='selected-story-art/'+discoveryHash([selection.bookId,selection.customBook,original.localSource,selection.storyTitle,selection.theme,status.provider,status.models.text,selectedArtRecommendationPrompt,...(status.taskReasoningEfforts?[status.taskReasoningEfforts.art]:[])]);
  return cache.shared(key,undefined,async()=>{
   const saved=await cache.read(key,artRecommendationSchema);if(saved)return saved;
   const result=artRecommendationSchema.parse(await provider.recommendArt!(selection,original));
   await cache.write(key,result);return result;
  });
 }
 return {
  discoveryBusy:()=>cache.busy||matchingBusy(cache)||measurementBusy(cache),
  settleDiscovery:async()=>{await settleMatching(cache);await cache.settle();await settleMeasurements(cache);await cache.settle();},
  status:()=>provider.status(),safeError:error=>provider.safeError(error),
  generationTimeoutMs:phase=>provider.generationTimeoutMs?.(phase)??null,
  ...(provider.matchStories?{matchStories:provider.matchStories.bind(provider)}:{}),
  async suggestions(selection,excluded,_localBook,reading,excludedSources=[]){
   reading?.signal.throwIfAborted();
   const book=await books.book(selection);
   reading?.signal.throwIfAborted();
   if(!book){if(selection.discoverySources||selection.discovery?.mode==='title')throw new ReaderError(400,'Chapter and title discovery are supported only for built-in books.');return provider.suggestions(selection,excluded,undefined,reading,excludedSources);}
   const scope=selection.discoverySources?selectedChapterScope(books,book,selection.discoverySources):null;
   const result=await discoverLocalStories(provider,books,cache,scope?.book||book,scope?{...selection,discoverySources:scope.discoverySources}:selection,excluded,reading,excludedSources);
   // A single-story scope has sliced units; display paragraph positions from the full original.
   return scope?{...result,stories:result.stories.map(story=>({...story,sourceLabel:englishSourceLabel(book,story.source!)}))}:result;
  },
  recommendArt,
  generator(){
   const generator=provider.generator();
   function verifyOriginal(selection:Selection,original:OriginalSource|undefined){
    if(!original?.localSource||!selection.source||localSourceKey(original.localSource)!==localSourceKey(selection.source))throw new ReaderError(400,'The original text has not been verified locally. Select the story again.');
    if(hasStoredSourceAnomaly(original)||hasSourceAnomaly(original.title))throw new ReaderError(400,'The saved original contains unrecognized characters or missing text. Select a complete, readable source. The original record has been retained.');
    if(original.chapterContext){
     const {title,text,source}=original.chapterContext,parsed=localSourceSchema.safeParse(source);
     const anchors=sourceRanges(original.localSource),sections=new Set(anchors.map(range=>range.sectionId));
     if(typeof title!=='string'||!title||hasSourceAnomaly(title)||typeof text!=='string'||!text.isWellFormed()||!parsed.success||parsed.data.edition!==original.localSource.edition)throw new ReaderError(400,'The saved chapter context could not be verified. Select the story again. The original record has been retained.');
     const ranges=sourceRanges(parsed.data);
     if(ranges.length!==sections.size||new Set(ranges.map(range=>range.sectionId)).size!==sections.size||ranges.some(range=>!sections.has(range.sectionId))||[...ranges,...anchors].some(range=>![range.firstUnit,range.lastUnit].every(id=>text.includes(`[${id}]\n`))))throw new ReaderError(400,'The saved chapter context does not match the selected source. Select the story again. The original record has been retained.');
    }
   }
   return {...generator,
    validateOriginal(selection,original){if(localBookId(selection))verifyOriginal(selection,original);},
    ...(provider.recommendArt?{recommendArt}:{}),
    async reflection(selection,draft,original,revision){
     if(localBookId(selection))verifyOriginal(selection,original);
     return generator.reflection(selection,draft,original,revision);
    },
    async reflectionCandidates(selection,draft,original){
     if(localBookId(selection))verifyOriginal(selection,original);
     return generator.reflectionCandidates(selection,draft,original);
    },
    ...(generator.reviewFrameCount?{async reviewFrameCount(selection,plan,original){
     if(localBookId(selection))verifyOriginal(selection,original);
     return generator.reviewFrameCount!(selection,plan,original);
    }} satisfies Pick<typeof generator,'reviewFrameCount'>:{}),
    ...(generator.review?{async review(selection,plan,original,outline,candidates){
     if(localBookId(selection))verifyOriginal(selection,original);
     return generator.review!(selection,plan,original,outline,candidates);
    }} satisfies Pick<typeof generator,'review'>:{}),
    ...(generator.restructure?{async restructure(selection,plan,original,issues,coverage,frameCountContext){
     if(localBookId(selection))verifyOriginal(selection,original);
     return generator.restructure!(selection,plan,original,issues,coverage,frameCountContext);
    }} satisfies Pick<typeof generator,'restructure'>:{}),
    ...(generator.repair?{async repair(selection,plan,original,issues,outline){
     if(localBookId(selection))verifyOriginal(selection,original);
     return generator.repair!(selection,plan,original,issues,outline);
    }} satisfies Pick<typeof generator,'repair'>:{}),
    ...(generator.outline?{async outline(selection,id,original){
     if(localBookId(selection))verifyOriginal(selection,original);
     const result=await generator.outline!(selection,id,original);
     return original?{...result,value:{...result.value,sourceReference:original.chapterContext?.title||original.title}}:result;
    }} satisfies Pick<typeof generator,'outline'>:{}),
    ...(generator.planBatch?{async planBatch(selection,id,draft,original){
     if(localBookId(selection))verifyOriginal(selection,original);
     return generator.planBatch!(selection,id,draft,original);
    }} satisfies Pick<typeof generator,'planBatch'>:{}),
    async prepareOriginal(selection,id){
     if(!localBookId(selection)){
      if(selection.source)throw new ReaderError(400,'The source does not match the selected book. Select the story again.');
      return generator.prepareOriginal?.(selection,id)||null;
     }
     const original=await books.storyOriginal(selection);return persist(original!,id);
    },
    async recommend(selection,id,original,prepareRequirements=false){
     if(localBookId(selection))verifyOriginal(selection,original);
     if(!generator.recommend)throw new ReaderError(503,'This provider does not support frame recommendations. Update the service and retry.');
     return generator.recommend(selection,id,original,prepareRequirements);
    },
    async plan(selection,id,original){
     if(!localBookId(selection))return generator.plan(selection,id,original);
     verifyOriginal(selection,original);
     // The checkpoint owns the exact verified version; readable retries keep that saved original.
     const result=await generator.plan(selection,id,original);
     return {...result,value:{...result.value,sourceReference:original!.chapterContext?.title||original!.title}};
    },
    async original(selection,plan,id){
     if(!localBookId(selection))return generator.original(selection,plan,id);
     const original=await books.legacy(selection,plan);await persist(original!,id);
     return {source:original,message:'',searchUrl:''};
    },
   };
  },
 };
}
