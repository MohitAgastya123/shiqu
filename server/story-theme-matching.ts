// Persist complete binary original-based receipts separately from the shared story catalog.
// A shared flight makes one bounded call and saves its receipt even if its last reader leaves.
import {z} from 'zod';
import {ReaderError} from '../lib/reader-model.ts';
import type {ReaderProvider} from '../lib/reader-provider.ts';
import {localSourceKey} from '../lib/reader-local-contract.ts';
import type {LocalSourceReference} from '../lib/reader-local-contract.ts';
import {themeMatchPrompt,themeMatchJson,themeMatchPayload,themeMatchesSchema,themeDecisionSchema,themeMatchBatchSize,themeStorySchema} from '../lib/reader-theme-match.ts';
import type {ThemeStory} from '../lib/reader-theme-match.ts';
import {StoryDiscoveryCache,discoveryHash} from './story-discovery-cache.ts';
import type {ReadingObserver} from './story-discovery-cache.ts';
import {readingTokens} from './story-token-budget.ts';
type Story={title:string;source:LocalSourceReference};
const savedSchema=z.object({decisions:z.record(z.string().regex(/^[a-f0-9]{64}$/),themeDecisionSchema)});
export const themeStoryId=(story:Story)=>discoveryHash([story.title,localSourceKey(story.source)]);
export const themeDecisionKey=(namespace:string,theme:string,identity?:{model:string;reasoningEffort:string})=>namespace+'/themes/'+discoveryHash([theme.normalize('NFKC').trim(),themeMatchPrompt,themeMatchJson,...(identity?[identity]:[])]);
export async function matchLibraryStories<T extends Story>(provider:ReaderProvider,cache:StoryDiscoveryCache,namespace:string,theme:string,stories:T[],original:(story:T)=>string,budget:number,providerName:string,observer?:ReadingObserver):Promise<(T&{matchReason:string})[]>{
 if(!stories.length)return [];
 if(!provider.matchStories)throw new ReaderError(503,'当前生成服务暂不支持故事主题匹配，请更新服务后重试。');
 const status=await provider.status(),identity=status.themeMatching||{model:status.models.text,reasoningEffort:status.taskReasoningEfforts?.suggest||''};
 const key=themeDecisionKey(namespace,theme,identity),entries=stories.map(story=>({story,id:themeStoryId(story)}));
 const read=async()=>await cache.read(key,savedSchema,value=>Object.keys(value.decisions).length<=50000&&Object.entries(value.decisions).every(([id,decision])=>id===decision.id))||{decisions:{}};
 const fits=(input:ThemeStory[])=>readingTokens(themeMatchPrompt,providerName)+readingTokens(JSON.stringify(themeMatchPayload(theme,input)),providerName)+readingTokens(JSON.stringify(themeMatchJson),providerName)<=budget;
 while(true){
  observer?.signal.throwIfAborted();
  const saved=await read(),matched=entries.filter(entry=>saved.decisions[entry.id]?.verdict==='yes').map(entry=>({...entry.story,matchReason:saved.decisions[entry.id].reason}));
  if(matched.length)return matched;
  if(entries.every(entry=>saved.decisions[entry.id]?.verdict==='no'))return [];
  await cache.shared(key,observer,async reading=>{
   const current=await read();
   if(entries.some(entry=>current.decisions[entry.id]?.verdict==='yes'))return;
   reading.signal.throwIfAborted();
   const input:ThemeStory[]=[];
   for(const entry of entries.filter(entry=>!current.decisions[entry.id]).slice(0,themeMatchBatchSize)){
    const candidate=themeStorySchema.parse({id:entry.id,title:entry.story.title,text:original(entry.story)});
    if(!fits([...input,candidate])){
     if(!input.length)throw new ReaderError(502,'单篇故事原文超过主题匹配输入预算，故事库已保留，请缩小故事范围后重试。');
     break;
    }
    input.push(candidate);
   }
   if(!input.length)return;
   const result=themeMatchesSchema.parse(await provider.matchStories!(theme,input)),requested=new Set(input.map(entry=>entry.id));
   if(result.matches.length!==requested.size||new Set(result.matches.map(match=>match.id)).size!==requested.size||result.matches.some(match=>!requested.has(match.id)))throw new ReaderError(502,'主题判断未能逐篇核对，故事库已保留，请重试。');
   for(const match of result.matches)current.decisions[match.id]=match;
   await cache.write(key,current);
  });
 }
}
