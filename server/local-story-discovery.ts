// English product messages; source evidence and machine identifiers remain stable.
// Persist theme-neutral stories before matching; never let a reader's theme or exclusions shape extraction.
// Expand only until new stories exist, carrying verified unfinished events across blocks and cancellation.
// Binary theme receipts read originals; old catalog ranges resume without generating summaries.
// Complete events may share background; structural novelty is checked before admission, not display.
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {previousReadingPlanKey,previousDiscoveryNamespace,previousSummaryNamespace} from './story-discovery-legacy.ts';
import {discoveryMeasurement} from './story-discovery-metrics.ts';
import {localSourceSchema,localSourceKey,localReadingPrompt,localCatalogJson,legacyLocalReadingPrompt,legacyLocalScanJson,localChapterStoriesPrompt,localTitleStoriesPrompt,catalogStoryLimit} from '../lib/reader-local-contract.ts';
import type {LocalSourceReference,PendingEvent,WholeBookInput} from '../lib/reader-local-contract.ts';
import {suggestionBatchSchema,titleKey} from '../lib/reader-suggestions.ts';
import type {SuggestionBatch} from '../lib/reader-suggestions.ts';
import {ReaderError} from '../lib/reader-model.ts';
import type {Selection} from '../lib/reader-model.ts';
import type {ReaderProvider} from '../lib/reader-provider.ts';
import type {LocalBook,LocalBooks} from './local-books.ts';
import {StoryDiscoveryCache,discoveryHash} from './story-discovery-cache.ts';
import type {ReadingObserver} from './story-discovery-cache.ts';
import {readingPlan,readingPlanKey,manifestSchema,hydrateReadingPlan,defaultReadingLimits,legacyReadingPlanKey} from './story-reading-inputs.ts';
import type {ReadingLimits,ReadingBlock} from './story-reading-inputs.ts';
import {requestTokens} from './story-token-budget.ts';
import {sourceUnitIds,sourcesOverlap,sourceCovers,mergeSources} from './local-source-ranges.ts';
import {matchLibraryStories,hasUnknownJudgments} from './story-theme-matching.ts';
import {englishSourceLabel} from './local-book-contents.ts';
import {containsChinese} from '../lib/reader-source-types.ts';

const storySchema=suggestionBatchSchema.shape.stories.element.omit({storyBrief:true,matchReason:true}).extend({source:localSourceSchema,continuedFrom:z.array(localSourceSchema).min(1).max(16).optional()});
type Story=z.infer<typeof storySchema>;
const pendingSchema=z.object({id:z.string().min(1).max(64),title:z.string().min(1).max(100),source:localSourceSchema});
const rejectionSchema=z.object({code:z.enum(['duplicate','no-new-evidence','invalid-source','no-progress','pending-resolution']),title:z.string().max(100).optional(),source:localSourceSchema.optional()});
const stateSchema=z.object({stories:z.array(storySchema).max(50000),cursor:z.number().int().min(0),readThrough:z.number().int().min(0),pendingEvents:z.array(pendingSchema).max(16),exhausted:z.boolean(),rejected:z.boolean(),lastRejection:rejectionSchema.optional(),overlapDiagnostics:z.array(z.object({source:localSourceSchema,other:localSourceSchema,ratio:z.number().min(0).max(1)})).max(32).optional()});
const stateEnvelope=stateSchema.extend({stories:z.array(z.unknown()).max(50000),pendingEvents:z.array(z.unknown()).max(16)});
type State=z.infer<typeof stateSchema>;
type Rejection=z.infer<typeof rejectionSchema>;
const failed=()=>new ReaderError(502,'Story discovery could not be fully verified. Progress has been retained. Retry or choose another theme.');
const rejectionMessage=(reason:Rejection)=>({
 duplicate:'Discovery returned only saved stories. Progress has been retained. Retry the search.',
 'no-new-evidence':'The overlapping source range contains no new story evidence. Progress has been retained. Retry the search.',
 'invalid-source':'The source range cited by discovery could not be verified. Progress has been retained. Retry the search.',
 'no-progress':'Discovery returned no new story and did not confirm that reading was complete. Progress has been retained. Retry the search.',
 'pending-resolution':'The cross-chapter event resolution does not match the source coverage. Progress has been retained. Retry the search.',
}[reason.code]);
function rejectedStory(code:Rejection['code'],raw:unknown):Rejection{
 const value=raw as {title?:unknown;source?:unknown},source=localSourceSchema.safeParse(value?.source);
 return {code,...(typeof value?.title==='string'?{title:value.title.slice(0,100)}:{}),...(source.success?{source:source.data}:{})};
}
export function discoveryNamespace(book:LocalBook,provider:string,model:string,limits=defaultReadingLimits,effort?:string){
 return discoveryHash(['story-library-v2',readingPlanKey(book,provider,limits),model,localReadingPrompt({...book.input,purpose:'catalog'}),localCatalogJson,...(effort?[effort]:[])]);
}
export const legacySummaryDiscoveryNamespace=previousSummaryNamespace;
export function legacyDiscoveryNamespace(book:LocalBook,provider:string,model:string){
 return discoveryHash(['direct-reading-v2',legacyReadingPlanKey(book,provider),model,legacyLocalReadingPrompt({...book.input,purpose:'scan'}),legacyLocalScanJson]);
}
function qualified(books:LocalBooks,book:LocalBook,source:LocalSourceReference,visible?:Set<string>){
 books.resolve(book,source);
 if(visible&&!sourceUnitIds(book,source).every(id=>visible.has(id)))throw failed();
}
function mergePending(books:LocalBooks,book:LocalBook,old:PendingEvent[],updates:PendingEvent[],resolved:string[],accepted:Story[],visible:Set<string>){
 const result=new Map(old.map(event=>[event.id,event])),seen=new Set<string>();
 if(new Set(resolved).size!==resolved.length)throw failed();
 for(const id of resolved){
  const event=result.get(id);
  if(!event||!accepted.some(story=>sourceCovers(book,story.source,event.source)))throw failed();
  result.delete(id);
 }
 for(const update of updates){
  qualified(books,book,update.source,visible);
  if(update.id&&(!old.some(event=>event.id===update.id)||resolved.includes(update.id)))throw failed();
  const previous=update.id?result.get(update.id):[...result.values()].find(event=>sourcesOverlap(book,event.source,update.source));
  const id=previous?.id||discoveryHash([localSourceKey(update.source),update.title]);
  if(resolved.includes(id)||resolved.some(done=>sourcesOverlap(book,old.find(event=>event.id===done)!.source,update.source)))throw failed();
  if(seen.has(id))throw failed();seen.add(id);
  const event={id,title:update.title,source:previous?mergeSources(book,previous.source,update.source):update.source};
  qualified(books,book,event.source);
  result.set(id,event);
 }
 if(result.size>16)throw failed();
 return [...result.values()];
}
export async function discoverLocalStories(provider:ReaderProvider,books:LocalBooks,cache:StoryDiscoveryCache,book:LocalBook,selection:Selection,excluded:string[],observer?:ReadingObserver,excludedSources:LocalSourceReference[]=[],limits:ReadingLimits=defaultReadingLimits):Promise<SuggestionBatch>{
 observer={signal:observer?.signal||new AbortController().signal,onProgress:observer?.onProgress||(()=>{}),...observer,cycleId:observer?.cycleId||randomUUID()};
 const batchLimit=observer.maxStories||4;
 const targetTitle=selection.discovery?.mode==='title'?selection.discovery.title:undefined;
 // Old tasks retain main-first behavior; new automatic searches discover independent events.
 const chapterStories=!!selection.discoverySources&&!selection.discovery;
 const status=await provider.status(),plan=await readingPlan(book,status.provider,cache,limits,!!selection.discoverySources&&(chapterStories||!!targetTitle),targetTitle);
 const scope=(selection.discoverySources?'/scope/'+discoveryHash(selection.discoverySources.map(localSourceKey))+(chapterStories?'/selected-chapters-v1/main-first/'+discoveryHash(localChapterStoriesPrompt):'/auto-v1'):'')+(targetTitle?'/title/'+discoveryHash([titleKey(targetTitle),localTitleStoriesPrompt]):'');
 const namespace=discoveryNamespace(book,status.provider,status.models.text,limits,status.taskReasoningEfforts?.suggest)+scope;
 const oldNamespace=previousDiscoveryNamespace(book,status.provider,status.models.text,limits,status.taskReasoningEfforts?.suggest)+scope;
 const legacyNamespace=legacySummaryDiscoveryNamespace(book,status.provider,status.models.text,limits,status.taskReasoningEfforts?.suggest)+scope;
 // A requested title fixes the event. Only automatic discovery needs a theme judgment.
 const theme=selection.theme.normalize('NFKC').trim(),key=namespace+'/library';
 const totalChars=plan.blocks.reduce((n,block)=>n+block.chars,0),excludedKeys=new Set(excludedSources.length?[]:excluded.map(titleKey));
 const validExclusions=excludedSources.filter(source=>{try{qualified(books,book,source);return true;}catch{return false;}});
 const sameRange=(a:LocalSourceReference,b:LocalSourceReference)=>sourceCovers(book,a,b)&&sourceCovers(book,b,a);
 const duplicate=(a:Story,b:Story)=>sameRange(a.source,b.source)||titleKey(a.title)===titleKey(b.title)&&sourcesOverlap(book,a.source,b.source);
 const crossing=(a:LocalSourceReference,b:LocalSourceReference)=>sourcesOverlap(book,a,b)&&!sourceCovers(book,a,b)&&!sourceCovers(book,b,a);
 const visibleStories=(stories:Story[])=>{
  const shown:Story[]=[],exclusions=validExclusions.map(source=>({source,known:stories.find(other=>sameRange(source,other.source))}));
  for(const story of stories){
   if(excludedKeys.has(titleKey(story.title))||exclusions.some(excluded=>sameRange(excluded.source,story.source)||excluded.known&&duplicate(story,excluded.known)))continue;
   if(shown.some(other=>duplicate(other,story)))continue;
   shown.push(story);
  }
  return shown;
 };
 const validFor=(state:Pick<State,'cursor'|'readThrough'|'exhausted'>,length:number)=>{
  if(state.cursor>length||state.readThrough>length||state.readThrough<state.cursor||state.readThrough>state.cursor+1||state.exhausted!==(state.cursor===length))return false;
  return true;
 };
 const validate=(state:Pick<State,'cursor'|'readThrough'|'exhausted'>)=>validFor(state,plan.blocks.length);
 const restore=(raw:z.infer<typeof stateEnvelope>):State=>{
  const stories:Story[]=[],pendingEvents:PendingEvent[]=[],ids=new Set<string>();
  for(const item of raw.stories)try{
   const story=storySchema.parse(item);qualified(books,book,story.source);
   for(const source of story.continuedFrom||[]){qualified(books,book,source);if(!sourceCovers(book,story.source,source))throw failed();}
   stories.push(story);
  }catch{/* Remove only the invalid record, retaining the proven reading frontier. */}
  for(const item of raw.pendingEvents)try{const event=pendingSchema.parse(item);qualified(books,book,event.source);if(!ids.has(event.id)){pendingEvents.push(event);ids.add(event.id);}}catch{/* Other unfinished events remain valid. */}
  return {...raw,stories,pendingEvents};
 };
 const unitText=new Map(book.sections.flatMap(section=>section.units.map(unit=>[unit.id,unit.text] as const)));
 const scanRequest=(current:State,cursor:number,maxStories=5)=>{
  const block=plan.blocks[cursor],visible=new Set(block.visible);
  const context=current.pendingEvents.map(event=>{
   const ids=sourceUnitIds(book,event.source);for(const id of ids)visible.add(id);
   return 'Unresolved event '+event.id+'\n'+books.resolve(book,event.source).title+'\n'+ids.map(id=>'['+id+']\n'+unitText.get(id)).join('\n\n');
  });
  let relevant=current.stories.filter(story=>sourceUnitIds(book,story.source).some(id=>visible.has(id)));
  if(chapterStories)for(const story of relevant){
   // A main story may begin in an earlier block. Its original evidence remains available for episodes.
   const ids=sourceUnitIds(book,story.source).filter(id=>!visible.has(id));
   if(ids.length){for(const id of ids)visible.add(id);context.push('Selected story '+story.title+'\n'+books.resolve(book,story.source).title+'\n'+ids.map(id=>'['+id+']\n'+unitText.get(id)).join('\n\n'));}
  }
  if(chapterStories)relevant=current.stories.filter(story=>sourceUnitIds(book,story.source).some(id=>visible.has(id)));
  const completed=current.stories.filter(story=>current.pendingEvents.some(event=>sourceCovers(book,story.source,event.source)));
  if(completed.length)context.push('Complete stories have already been saved. After verifying the corresponding event and all evidence, resolve them through resolvedEventIds without returning duplicate stories: '+JSON.stringify(completed.map(story=>({title:story.title,source:story.source}))));
  const chapterStoryLevel=chapterStories?(relevant.length?'episodes':'main'):undefined;
  const input:WholeBookInput={title:book.title,edition:book.edition,text:block.text,purpose:'catalog',scan:{maxStories:targetTitle||chapterStoryLevel==='main'?1:maxStories,excludedSources:relevant.map(story=>story.source),pendingEvents:current.pendingEvents,contextText:context.join('\n\n'),...(chapterStoryLevel?{chapterStoryLevel}:{}),...(targetTitle?{targetStoryTitle:targetTitle}:{})}};
  return {input,titles:relevant.map(story=>story.title),visible};
 };
 const progress=(current:State,stage:'reading'|'checking'|'selecting'='reading',reading:ReadingObserver|undefined=observer,block:ReadingBlock|undefined=plan.blocks[current.cursor])=>reading?.onProgress({completed:current.cursor,total:plan.blocks.length,completedChars:plan.blocks.slice(0,current.cursor).reduce((n,block)=>n+block.chars,0),totalChars,stage,mode:plan.manifest.mode,currentChapters:block?.chapters||[]});
 const empty=():State=>({stories:[],cursor:0,readThrough:0,pendingEvents:[],exhausted:false,rejected:false});
 const read=async()=>{
  const raw=await cache.read(key,stateEnvelope,validate);if(!raw)return empty();
  const restored=restore(raw);
  if(JSON.stringify(raw)!==JSON.stringify(restored)){
   const repaired=await cache.update(key,stateEnvelope,()=>raw,value=>restore(value));
   return restore(repaired);
  }
  return restored;
 };
 // Migrate under the extraction lock; never let a late legacy read overwrite new progress.
 if(!await cache.read(key,stateEnvelope,validate))await cache.shared(key,observer,async()=>{
  if(await cache.read(key,stateEnvelope,validate))return;
  const manifest=await cache.read(previousReadingPlanKey(book,status.provider,limits)+'/blocks',manifestSchema,value=>{hydrateReadingPlan(book,value);return true;});
  const oldBlocks=manifest?hydrateReadingPlan(book,manifest):[];
  for(const oldKey of [oldNamespace,legacyNamespace]){
   const previous=await cache.read(oldKey+'/library',stateEnvelope,value=>!manifest||validFor(value,oldBlocks.length));if(!previous)continue;
   // English discovery starts a new scan when old display prose cannot be reused.
   // Do not alter the old cache or the verified original evidence.
   if([...previous.stories,...previous.pendingEvents].some(value=>{const item=value as {title?:unknown;description?:unknown;matchReason?:unknown};return containsChinese([item.title,item.description,item.matchReason].filter(value=>typeof value==='string').join(' '));}))continue;
   const completed=new Set(oldBlocks.slice(0,manifest?previous.cursor:0).flatMap(block=>[...block.visible]));
   let cursor=0;while(cursor<plan.blocks.length&&[...plan.blocks[cursor].visible].every(id=>completed.has(id)))cursor++;
   await cache.write(key,{...restore(previous),cursor,readThrough:cursor,exhausted:cursor===plan.blocks.length});break;
  }
 });
 const measurement=await discoveryMeasurement(cache,observer.cycleId!,!(await read()).stories.length);
 const existingCall=observer.onCall;observer.onCall=event=>{measurement.call(event);existingCall?.(event);};
 const response=async(state:State,stories:Story[],hit:boolean):Promise<SuggestionBatch>=>{
  const unknown=!targetTitle&&await hasUnknownJudgments(provider,cache,book.id,theme,state.stories,status.provider);
  await measurement.finish(stories.length?'matched':unknown?'incomplete':'none');
  const note=(targetTitle?(stories.length?'The complete source for the requested story has been verified. The theme remains a narrative focus for production.':state.exhausted?(state.stories.length?'The requested story is listed. Select one of the results.':`The complete events of “${targetTitle}” could not be verified in this source range. Add related chapters or check the title. A partial story will not be substituted.`):'Checking original text for the requested title.'):hit?'Saved local stories and theme match results were reused.':chapterStories?'Stories were indexed from main events to smaller events, then matched to the theme.':'Stories were indexed from the original text and matched to the theme.')+(state.rejected?'Some returned sources could not be fully verified. Progress has been retained; you can retry.':'')+(!targetTitle&&!stories.length&&state.exhausted?(unknown?'Reading is complete, but some stories could not be assessed. Theme matching is incomplete.':'The supplied source has been checked. No more matching stories are available.'):'')+(!targetTitle&&state.exhausted&&state.pendingEvents.length?'Some cross-chapter events remain incomplete and were not recommended as stories.':'');
  // Discovery returns ranges and a short match reason; preparation creates the synopsis after selection.
  return suggestionBatchSchema.parse({stories:stories.slice(0,batchLimit).map(story=>({...story,sourceLabel:englishSourceLabel(book,story.source)})),note:note.slice(0,300)});
 };
 const extraction:Selection={bookId:selection.bookId,...(selection.bookId==='other'?{customBook:book.title}:{}),theme:'',artStyle:'ink-pencil',productionPrompt:'',length:'auto',voice:false};
 let hit=true;
 try{while(true){
  observer?.signal.throwIfAborted();
  const saved=await read(),candidates=visibleStories(saved.stories);
  if(candidates.length)progress(saved,'selecting');
  const matched=targetTitle?candidates.map(story=>({...story,matchReason:'The requested story was verified against the selected source. The theme guides narrative emphasis only.'})):await matchLibraryStories(provider,cache,namespace,theme,candidates,story=>books.resolve(book,story.source).text,limits.whole,status.provider,observer,{bookId:book.id,legacyNamespaces:[oldNamespace],retryUnknown:saved.exhausted,context:observer});
  if(matched.length||saved.exhausted)return response(saved,matched,hit);
  const baseline=saved.stories.length;
  await cache.shared(key,observer,async reading=>{
   let current=await read();progress(current,'reading',reading);
   // A simultaneous theme may already have extended the shared library while matching ran.
   while(current.stories.length<=baseline&&!current.exhausted){
    reading.signal.throwIfAborted();
    const {input,titles,visible}=scanRequest(current,current.cursor,current.stories.length?catalogStoryLimit:1);
    if(requestTokens(input,'',titles,status.provider)>limits.whole)throw new ReaderError(502,'The cross-chapter text or saved records exceed the input budget. Stories and progress have been retained. Select fewer chapters.');
    const result=await provider.suggestions(extraction,titles,input,{...reading,maxStories:undefined});
    progress(current,'checking',reading);
    if(result.stories.length>input.scan!.maxStories)throw failed();
    if(!result.scan||!Array.isArray(result.scan.pendingEvents)||!Array.isArray(result.scan.resolvedEventIds))throw failed();
    const overlapDiagnostics:NonNullable<State['overlapDiagnostics']>=[],accepted:Story[]=[],rejections:Rejection[]=result.scan.invalidStories?[{code:'invalid-source'}]:[],initialCovered=new Set(current.stories.flatMap(story=>sourceUnitIds(book,story.source))),covered=new Set(initialCovered);
    for(const raw of result.stories){
     try{
      const parsed=storySchema.omit({continuedFrom:true}).parse(raw);qualified(books,book,parsed.source,visible);
      const continuedFrom=current.pendingEvents.filter(event=>result.scan!.resolvedEventIds.includes(event.id)&&sourceCovers(book,parsed.source,event.source)).map(event=>event.source);
      const story:Story={...parsed,...(continuedFrom.length?{continuedFrom}:{})},known=[...current.stories,...accepted];
      if(known.some(other=>duplicate(other,story))){rejections.push(rejectedStory('duplicate',raw));continue;}
      const storyUnits=sourceUnitIds(book,story.source);
      for(const other of known){if(!crossing(other.source,story.source))continue;const otherUnits=sourceUnitIds(book,other.source),set=new Set(otherUnits),ratio=storyUnits.filter(id=>set.has(id)).length/Math.min(storyUnits.length,otherUnits.length);if(ratio>.8&&overlapDiagnostics.length<32)overlapDiagnostics.push({source:story.source,other:other.source,ratio});}
      const units=storyUnits,fresh=units.some(id=>!covered.has(id)),nested=known.some(other=>sourceCovers(book,other.source,story.source));
      if(known.some(other=>crossing(other.source,story.source))&&!fresh&&!nested&&!continuedFrom.length){rejections.push(rejectedStory('no-new-evidence',raw));continue;}
      accepted.push({...story,sourceLabel:englishSourceLabel(book,story.source)});for(const id of units)covered.add(id);
     }catch{rejections.push(rejectedStory('invalid-source',raw));}
    }
    let pending:PendingEvent[];
    try{if(result.scan.invalid)throw failed();pending=mergePending(books,book,current.pendingEvents,result.scan.pendingEvents,result.scan.resolvedEventIds,[...current.stories,...accepted],visible);if(targetTitle&&accepted.length&&pending.length)throw failed();}
    catch{
     const independent=targetTitle?[]:accepted.filter(story=>!story.continuedFrom?.length||sourceUnitIds(book,story.source).some(id=>!initialCovered.has(id)));
     const lastRejection={code:'pending-resolution' as const};
     await cache.write(key,{...current,stories:[...current.stories,...independent.map(({continuedFrom,...story})=>{void continuedFrom;return story;})],lastRejection});
     if(independent.length){await measurement.stored();break;}
     throw new ReaderError(502,rejectionMessage(lastRejection));
    }
    const rejected=!!rejections.length,lastRejection=rejections[0]||(!accepted.length&&!result.scan.blockComplete?{code:'no-progress' as const}:undefined);
    const next:State={...current,stories:[...current.stories,...accepted],pendingEvents:pending,rejected,lastRejection,overlapDiagnostics};
    // A full response is not proof that all stories in this block have been catalogued.
    if(rejections.every(reason=>reason.code==='duplicate')&&result.stories.length<input.scan!.maxStories&&result.scan.blockComplete)next.cursor++;
    if(targetTitle&&accepted.length&&!pending.length)next.cursor=plan.blocks.length;
    next.readThrough=next.cursor;next.exhausted=next.cursor===plan.blocks.length;
    const advanced=next.cursor>current.cursor||pending.length<current.pendingEvents.length;
    await cache.write(key,next);if(accepted.length)await measurement.stored();current=next;progress(current,'reading',reading);
    if(reading.signal.aborted)break;
    if(!accepted.length&&lastRejection&&!advanced)throw new ReaderError(502,rejectionMessage(lastRejection));
   }
  });
  hit=false;
 }
 }catch(error){await measurement.finish(observer.signal.aborted?'cancelled':'failed');throw error;}
}
