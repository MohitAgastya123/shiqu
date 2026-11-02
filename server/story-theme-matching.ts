// Reuse original-based judgments independently of extraction, and isolate bad entries without retry storms.
// Short write locks merge receipts; process-wide slots remain occupied until paid calls really settle.
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {ReaderError} from '../lib/reader-model.ts';
import type {ReaderProvider} from '../lib/reader-provider.ts';
import {localSourceKey} from '../lib/reader-local-contract.ts';
import type {LocalSourceReference} from '../lib/reader-local-contract.ts';
import {themeMatchPrompt,themeMatchJson,themeMatchPayload,themeDecisionSchema,themeMatchBatchSize,themeStorySchema,themeMatchContract} from '../lib/reader-theme-match.ts';
import type {ThemeStory} from '../lib/reader-theme-match.ts';
import {discoveryCode} from '../lib/reader-discovery-call.ts';
import type {DiscoveryContext} from '../lib/reader-discovery-call.ts';
import {StoryDiscoveryCache,discoveryHash} from './story-discovery-cache.ts';
import type {ReadingObserver} from './story-discovery-cache.ts';
import {readingTokens} from './story-token-budget.ts';
import frozen from '../lib/reader-discovery-v1.json' with {type:'json'};
type Story={title:string;source:LocalSourceReference};
const unknownSchema=z.object({reason:z.enum(['failed','budget']),cycle:z.string(),budget:z.number()});
const savedSchema=z.object({decisions:z.record(z.string(),themeDecisionSchema),fingerprints:z.record(z.string(),z.string()),unknown:z.record(z.string(),unknownSchema)});
const cycleSchema=z.object({calls:z.record(z.string(),z.boolean()),retried:z.record(z.string(),z.boolean()),retryAllowed:z.boolean()});
const empty=()=>({decisions:{},fingerprints:{},unknown:{}} as z.infer<typeof savedSchema>);
export const themeStoryId=(story:Story)=>discoveryHash([story.title.normalize('NFKC').trim(),localSourceKey(story.source)]);
export const legacyThemeStoryId=(story:Story)=>discoveryHash([story.title,localSourceKey(story.source)]);
export const legacyThemeDecisionKey=(namespace:string,theme:string,identity?:{model:string;reasoningEffort:string})=>namespace+'/themes/'+discoveryHash([theme.normalize('NFKC').trim(),frozen.themeMatchPrompt,frozen.themeMatchJson,...(identity?[identity]:[])]);
export const themeDecisionKey=(namespace:string,theme:string,identity?:{model:string;reasoningEffort:string;provider?:string})=>namespace+'/themes/'+discoveryHash([theme.normalize('NFKC').trim(),themeMatchContract,...(identity?[identity]:[])]);
type Query={cycle:string;done:boolean;found?:boolean;ids:Set<string>;observer?:ReadingObserver;error?:unknown;context?:DiscoveryContext};
type Flight={promise:Promise<void>;readers:Set<Query>;isolation?:{id:string;callId:string}};
class Changes{
 promise:Promise<void>;wake!:()=>void;
 constructor(){this.promise=new Promise(resolve=>{this.wake=resolve;});}
 notify(){this.wake();this.promise=new Promise(resolve=>{this.wake=resolve;});}
}
const coordinators=new WeakMap<object,{flights:Map<string,Flight>;changes:Changes}>();
let active=0;const slots:Array<()=>void>=[];
async function slot(){if(active>=3)await new Promise<void>(resolve=>slots.push(resolve));else active++;return ()=>{const next=slots.shift();if(next)next();else active--;};}
const alive=(q:Query)=>!q.done&&!q.found&&!q.observer?.signal.aborted;
async function changed(promise:Promise<void>,signal?:AbortSignal){
 if(!signal)return promise;signal.throwIfAborted();
 await new Promise<void>((resolve,reject)=>{const cancel=()=>{signal.removeEventListener('abort',cancel);reject(signal.reason);};signal.addEventListener('abort',cancel,{once:true});promise.then(()=>{signal.removeEventListener('abort',cancel);resolve();});});
}
export async function matchLibraryStories<T extends Story>(provider:ReaderProvider,cache:StoryDiscoveryCache,namespace:string,theme:string,stories:T[],original:(story:T)=>string,budget:number,providerName:string,observer?:ReadingObserver,options:{bookId?:string;legacyNamespaces?:string[];retryUnknown?:boolean;context?:DiscoveryContext}={}):Promise<(T&{matchReason:string})[]>{
 const status=await provider.status(),identity={...(status.themeMatching||{model:status.models.text,reasoningEffort:status.taskReasoningEfforts?.suggest||''}),provider:providerName};
 const key=themeDecisionKey(options.bookId?'original-judgments/'+discoveryHash([options.bookId,providerName]):namespace,theme,identity);
 const cycle=observer?.cycleId||randomUUID(),cycleKey='discovery-cycle/'+discoveryHash(cycle);
 const initialCycle=():z.infer<typeof cycleSchema>=>({calls:{},retried:{},retryAllowed:!!options.retryUnknown});
 const cycleState=await cache.update(cycleKey,cycleSchema,initialCycle,value=>value);
 if(!stories.length)return [];
 if(!provider.matchStories)throw new ReaderError(503,'当前生成服务暂不支持故事主题匹配，请更新服务后重试。');
 const entries=stories.map(story=>{const text=original(story);return {story,id:themeStoryId(story),text,fingerprint:discoveryHash(text)};});
 const read=async()=>await cache.read(key,savedSchema)||empty();
 const fits=(input:ThemeStory[])=>readingTokens(themeMatchPrompt,providerName)+readingTokens(JSON.stringify(themeMatchPayload(theme,input)),providerName)+readingTokens(JSON.stringify(themeMatchJson),providerName)<=budget;
 const input=(entry:typeof entries[number])=>themeStorySchema.parse({id:entry.id,title:entry.story.title,text:entry.text});
 // Only the proven old original-based contract is imported, using the old serializer and IDs.
 for(const legacy of options.legacyNamespaces||[]){
  const old=await cache.read(legacyThemeDecisionKey(legacy,theme,{model:identity.model,reasoningEffort:identity.reasoningEffort}),z.object({decisions:z.record(z.string(),themeDecisionSchema)}));
  if(old)await cache.update(key,savedSchema,empty,current=>{
   for(const entry of entries){const decision=old.decisions[legacyThemeStoryId(entry.story)];if(decision&&decision.id===legacyThemeStoryId(entry.story)&&!current.decisions[entry.id]){current.decisions[entry.id]={...decision,id:entry.id};current.fingerprints[entry.id]=entry.fingerprint;}}
   return current;
  });
 }
 let coordination=coordinators.get(cache.identity);if(!coordination){coordination={flights:new Map(),changes:new Changes()};coordinators.set(cache.identity,coordination);}
 const {flights,changes}=coordination,q:Query={cycle,done:false,ids:new Set(entries.map(entry=>entry.id)),observer,context:options.context};
 const flightKey=(entry:typeof entries[number])=>key+'/'+entry.id+'/'+entry.fingerprint;
 const save=async(batch:typeof entries,decisions:z.infer<typeof themeDecisionSchema>[],reason?:'failed'|'budget')=>{
  await cache.update(key,savedSchema,empty,current=>{
   for(const entry of batch){
    const decision=decisions.find(item=>item.id===entry.id);
    if(decision){current.decisions[entry.id]=decision;current.fingerprints[entry.id]=entry.fingerprint;delete current.unknown[entry.id];}
    else if(reason&&!(current.decisions[entry.id]&&current.fingerprints[entry.id]===entry.fingerprint)){delete current.decisions[entry.id];current.fingerprints[entry.id]=entry.fingerprint;current.unknown[entry.id]={reason,cycle,budget};}
   }
   return current;
  });changes.notify();
 };
 const reserve=async(reader:Query,callId:string,storyId:string)=>{
  let allowed=false;
  await cache.update('discovery-cycle/'+discoveryHash(reader.cycle),cycleSchema,initialCycle,current=>{
   if(current.calls[callId])allowed=true;
   else if(Object.keys(current.calls).length<8&&!current.calls['story/'+storyId]){current.calls[callId]=true;allowed=true;}
   return current;
  });return allowed;
 };
 const start=(batch:typeof entries)=>{
  const claimed=[...batch],retryIds=new Set(batch.filter(entry=>cycleState.retried[entry.id]).map(entry=>entry.id));
  const flight:Flight={readers:new Set([q]),promise:Promise.resolve()};
  for(const entry of batch)flights.set(flightKey(entry),flight);
  flight.promise=(async()=>{
   const release=await slot();
   try{
    if(![...flight.readers].some(alive))return;
    const latest=await read();
    batch=batch.filter(entry=>!(latest.fingerprints[entry.id]===entry.fingerprint&&(latest.decisions[entry.id]||latest.unknown[entry.id]&&!retryIds.has(entry.id))));
    if(!batch.length)return;
    for(const reader of flight.readers)await cache.update('discovery-cycle/'+discoveryHash(reader.cycle),cycleSchema,initialCycle,current=>{for(const entry of batch)current.retried[entry.id]=true;return current;});
    let matches:z.infer<typeof themeDecisionSchema>[]=[];
    try{
     const result=await provider.matchStories!(theme,batch.map(input),{...q.context,cycleId:cycle});
     const counts=new Map<string,number>();for(const raw of result.matches||[])counts.set(raw.id,(counts.get(raw.id)||0)+1);
     matches=(result.matches||[]).flatMap(raw=>{const parsed=themeDecisionSchema.safeParse(raw);return parsed.success&&counts.get(raw.id)===1&&batch.some(entry=>entry.id===raw.id)?[parsed.data]:[];});
    }catch(error){if(discoveryCode(error)==='service')throw error;}
    const missing=batch.filter(entry=>!matches.some(match=>match.id===entry.id));
    for(const reader of flight.readers)if(matches.some(match=>match.verdict==='yes'&&reader.ids.has(match.id)))reader.found=true;
    await save(batch,matches,missing.length?'failed':undefined);
    // Return yes immediately; readers for whom it is relevant stop this flight's further isolation.
    await Promise.resolve();
    for(const entry of missing){
     const readers=[...flight.readers].filter(alive);if(!readers.length)break;
     const callId='story/'+entry.id;flight.isolation={id:entry.id,callId};
     const allowed=await Promise.all(readers.map(reader=>reserve(reader,callId,entry.id)));
     if(!allowed.some(Boolean))continue;
     let decisions:z.infer<typeof themeDecisionSchema>[]=[];
     try{
      const result=await provider.matchStories!(theme,[input(entry)],{...q.context,cycleId:cycle,isolation:true});
      if(result.matches?.length===1){const parsed=themeDecisionSchema.safeParse(result.matches[0]);if(parsed.success&&parsed.data.id===entry.id)decisions=[parsed.data];}
     }catch(error){if(discoveryCode(error)==='service')throw error;}
     await save([entry],decisions,'failed');delete flight.isolation;
    }
   }catch(error){for(const reader of flight.readers){reader.error=error;}changes.notify();}
   finally{release();for(const entry of claimed)if(flights.get(flightKey(entry))===flight)flights.delete(flightKey(entry));changes.notify();}
  })();
 };
 try{
  while(true){
   observer?.signal.throwIfAborted();const notification=changes.promise,saved=await read();
   if(q.error)throw q.error;
   const matched=entries.filter(entry=>saved.fingerprints[entry.id]===entry.fingerprint&&saved.decisions[entry.id]?.verdict==='yes').map(entry=>({...entry.story,matchReason:saved.decisions[entry.id].reason}));
   if(matched.length)return matched;
   const todo:typeof entries=[];let waiting=false;
   for(const entry of entries){
    if(saved.fingerprints[entry.id]===entry.fingerprint&&saved.decisions[entry.id])continue;
    const flight=flights.get(flightKey(entry));if(flight){if(!flight.isolation||await reserve(q,flight.isolation.callId,flight.isolation.id))flight.readers.add(q);await cache.update(cycleKey,cycleSchema,initialCycle,current=>{current.retried[entry.id]=true;return current;});cycleState.retried[entry.id]=true;waiting=true;continue;}
    const unknown=saved.fingerprints[entry.id]===entry.fingerprint?saved.unknown[entry.id]:undefined;
    if(unknown){
     if(unknown.reason==='budget'&&unknown.budget===budget)continue;
     if(!cycleState.retryAllowed||unknown.cycle===cycle||cycleState.retried[entry.id])continue;
     const next=await cache.update(cycleKey,cycleSchema,initialCycle,current=>{current.retried[entry.id]=true;return current;});cycleState.retried=next.retried;
    }
    if(!fits([input(entry)])){await save([entry],[],'budget');continue;}
    todo.push(entry);
   }
   let launched=0;
   while(todo.length&&launched<3){
    const batch:typeof entries=[];
    while(todo.length&&batch.length<themeMatchBatchSize&&fits([...batch.map(input),input(todo[0])]))batch.push(todo.shift()!);
    for(let i=batch.length-1;i>=0;i--){const flight=flights.get(flightKey(batch[i]));if(flight){flight.readers.add(q);batch.splice(i,1);waiting=true;}}
    if(batch.length){start(batch);launched++;waiting=true;}
   }
   if(!waiting&&!todo.length)return [];
   await changed(notification,observer?.signal);
  }
 }finally{
  q.done=true;
  if(observer?.signal.aborted&&observer.drain){const owned=new Set(entries.map(entry=>flights.get(flightKey(entry))).filter((flight):flight is Flight=>!!flight));await Promise.all([...owned].filter(flight=>![...flight.readers].some(alive)).map(flight=>flight.promise));if(q.error)throw q.error;}
 }
}
export async function hasUnknownJudgments(provider:ReaderProvider,cache:StoryDiscoveryCache,bookId:string,theme:string,stories:Story[],providerName:string){
 const status=await provider.status(),identity={...(status.themeMatching||{model:status.models.text,reasoningEffort:status.taskReasoningEfforts?.suggest||''}),provider:providerName};
 const key=themeDecisionKey('original-judgments/'+discoveryHash([bookId,providerName]),theme,identity),saved=await cache.read(key,savedSchema);
 return stories.some(story=>saved?.unknown[themeStoryId(story)]);
}
