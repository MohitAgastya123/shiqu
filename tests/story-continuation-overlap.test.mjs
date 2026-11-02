// Reproduce the captured public-domain story ranges without live inference or private session metadata.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LocalBooks} from '../server/local-books.ts';
import {StoryDiscoveryCache} from '../server/story-discovery-cache.ts';
import {discoverLocalStories,discoveryNamespace} from '../server/local-story-discovery.ts';
import {localChoices} from '../lib/reader-local-contract.ts';
import {memory} from './fixtures/story-library.mjs';
const fixture=JSON.parse(await readFile(new URL('./fixtures/pending-overlap.json',import.meta.url),'utf8'));
export async function continuationFixture(){
 const books=new LocalBooks(process.cwd()),selection={bookId:fixture.bookId,theme:'replay',artStyle:'ink-pencil',length:'auto',voice:false,productionPrompt:''},book=await books.book(selection),store=memory(),cache=new StoryDiscoveryCache(store),calls={catalog:[],matches:[]};
 const identity={configured:true,provider:'codex',models:{text:'gpt-6.1-sol',image:'unused'},taskReasoningEfforts:{suggest:'medium'},themeMatching:{model:'controlled',reasoningEffort:'low'}};
 const provider={status:async()=>identity,safeError:()=>'',generator:()=>({}),suggestions:async(_selection,_excluded,input)=>{calls.catalog.push(input);assert.equal(calls.catalog.length,1,'Only the captured extraction receipt is available');return localChoices(fixture.receipt,input);},matchStories:async(theme,stories)=>{calls.matches.push({theme,stories});return {matches:stories.map(story=>({id:story.id,verdict:theme==='everything'||story.title===fixture.receipt.stories[0].title?'yes':'no',reason:'受控匹配以验证续完故事可到达主题阶段。'}))};}};
 const key=discoveryNamespace(book,'codex','gpt-6.1-sol',undefined,'medium')+'/library';await cache.write(key,fixture.catalog);
 const run=(theme='replay',excludedSources=[],targetCache=cache)=>discoverLocalStories(provider,books,targetCache,book,{...selection,theme},[],{signal:new AbortController().signal,maxStories:1,onProgress:()=>{}},excludedSources);
 return {books,book,selection,store,cache,calls,provider,key,run,fixture:structuredClone(fixture)};
}
test('a captured completion sharing only old pending evidence survives acceptance, display, exclusion and restart',async()=>{
 const f=await continuationFixture(),batch=await f.run();assert.equal(batch.stories[0].title,fixture.receipt.stories[0].title);assert.equal(f.calls.catalog.length,1);
 assert.equal(batch.stories[0].continuedFrom,undefined);assert.equal(batch.stories[0].summary,undefined);assert.equal(batch.stories[0].storyBrief,undefined);
 const envelopes=[...f.store.values.values()].map(bytes=>JSON.parse(new TextDecoder().decode(bytes))),state=envelopes.find(doc=>doc.key===f.key).value;
 assert.equal(state.stories.length,5);assert.deepEqual(state.pendingEvents,[]);assert.equal(state.cursor,fixture.catalog.cursor);assert.equal(state.stories.at(-1).continuedFrom.length,2);
 const before=structuredClone(f.calls);assert.deepEqual((await f.run('replay',[],new StoryDiscoveryCache(f.store))).stories,batch.stories);assert.deepEqual(f.calls,before);
 assert.equal((await f.run('replay',[fixture.catalog.stories[2].source])).stories[0].title,batch.stories[0].title);
 const remaining=await f.run('everything',[batch.stories[0].source,...fixture.catalog.stories.filter((_,i)=>i!==2).map(story=>story.source)]);assert.ok(remaining.stories.some(story=>story.title===fixture.catalog.stories[2].title));assert.equal(f.calls.catalog.length,1);
 assert.ok(f.calls.matches.every(call=>call.stories.every(story=>!('continuedFrom' in story))));
});

for(const mode of ['forged-proof','overlap-outside-resolved-evidence','duplicate-range','unknown-resolved'])test(`continuation evidence cannot bypass ${mode}`,async()=>{
 const f=await continuationFixture(),initial=structuredClone(f.fixture.catalog),receipt=structuredClone(f.fixture.receipt);
 if(mode==='overlap-outside-resolved-evidence'){
  delete initial.pendingEvents[0].source.continuations;
  initial.pendingEvents.push({id:'unresolved-context',title:'尚未结清的旧证据',source:{...initial.pendingEvents[0].source,firstUnit:'honglou-001-023',lastUnit:'honglou-001-024'}});
 }
 if(mode==='duplicate-range')initial.stories.push({title:'已保存的同范围故事',description:'同一故事的既有记录。',source:{...receipt.stories[0].source,edition:f.book.edition}});
 if(mode==='forged-proof')receipt.scan.resolvedEventIds=[];
 if(mode==='unknown-resolved')receipt.scan.resolvedEventIds.push('unknown-event');
 await f.cache.write(f.key,initial);
 f.provider.suggestions=async(_s,_e,input)=>{const result=localChoices(receipt,input);if(mode==='forged-proof')for(const story of result.stories)story.continuedFrom=f.fixture.catalog.pendingEvents.map(event=>event.source);return result;};
 await assert.rejects(f.run(),/保留进度/);
 const state=[...f.store.values.values()].map(bytes=>JSON.parse(new TextDecoder().decode(bytes))).find(doc=>doc.key===f.key).value;
 assert.equal(state.stories.length,initial.stories.length);assert.deepEqual(state.pendingEvents,initial.pendingEvents);
});

test('invalid cached continuation evidence cannot be reused as an accepted story',async()=>{
 const f=await continuationFixture(),state=structuredClone(f.fixture.catalog);state.stories[0].continuedFrom=[state.stories[1].source];await f.cache.write(f.key,state);
 f.provider.suggestions=async(_s,_e,input)=>{assert.deepEqual(input.scan.pendingEvents,[]);throw Error('invalid cache rejected');};
 await assert.rejects(f.run(),/invalid cache rejected/);
});
