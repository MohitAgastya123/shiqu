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

for(const mode of ['duplicate-range','unknown-resolved'])test(`continuation evidence cannot bypass ${mode}`,async()=>{
 const f=await continuationFixture(),initial=structuredClone(f.fixture.catalog),receipt=structuredClone(f.fixture.receipt);
 if(mode==='duplicate-range')initial.stories.push({title:'已保存的同范围故事',description:'同一故事的既有记录。',source:{...receipt.stories[0].source,edition:f.book.edition}});
 if(mode==='unknown-resolved')receipt.scan.resolvedEventIds.push('unknown-event');
 await f.cache.write(f.key,initial);
 f.provider.suggestions=async(_s,_e,input)=>{const result=localChoices(receipt,input);return result;};
 if(mode==='unknown-resolved')assert.equal((await f.run()).stories[0].title,receipt.stories[0].title);else await assert.rejects(f.run(),/保留进度/);
 const state=[...f.store.values.values()].map(bytes=>JSON.parse(new TextDecoder().decode(bytes))).find(doc=>doc.key===f.key).value;
 assert.equal(state.stories.length,initial.stories.length+(mode==='unknown-resolved'?1:0));if(mode==='unknown-resolved'){assert.deepEqual(state.pendingEvents,initial.pendingEvents);assert.equal(state.stories.at(-1).continuedFrom,undefined);}else assert.equal(state.pendingEvents.length,0);
});

test('invalid cached continuation evidence cannot be reused as an accepted story',async()=>{
 const f=await continuationFixture(),state=structuredClone(f.fixture.catalog);state.stories[0].continuedFrom=[state.stories[1].source];await f.cache.write(f.key,state);
 f.provider.suggestions=async(_s,_e,input)=>{assert.deepEqual(input.scan.pendingEvents,state.pendingEvents);throw Error('invalid cache rejected');};
 await assert.rejects(f.run(),/invalid cache rejected/);
});

test('a different complete third-chapter event may share background without an old pending event',async()=>{
 const f=await continuationFixture(),section=f.book.sections.find(section=>section.id==='honglou-003'),source={edition:f.book.edition,sectionId:'honglou-003',firstUnit:'honglou-003-003',lastUnit:section.units.at(-1).id};
 const existing={title:'贾雨村获荐复职',description:'贾雨村受荐复职，与黛玉同赴京。',source:{edition:f.book.edition,sectionId:'honglou-002',firstUnit:'honglou-002-017',lastUnit:'honglou-002-017',continuations:[{sectionId:'honglou-003',firstUnit:'honglou-003-001',lastUnit:'honglou-003-004'}]}};
 await f.cache.write(f.key,{...f.fixture.catalog,stories:[existing],pendingEvents:[],cursor:2,readThrough:2});
 f.provider.suggestions=async()=>({stories:[{title:'林黛玉进贾府',description:'孤女入京投亲，与外祖家相见。',source}],note:'',scan:{blockComplete:true,pendingEvents:[],resolvedEventIds:[]}});
 f.provider.matchStories=async(_theme,stories)=>({matches:stories.map(story=>({id:story.id,verdict:story.title==='林黛玉进贾府'?'yes':'no',reason:'受控验证完整事件共享背景。'}))});
 const result=await f.run();assert.equal(result.stories[0].title,'林黛玉进贾府');assert.equal(result.stories[0].continuedFrom,undefined);
});

test('fresh complete events do not trust model-supplied pending completion metadata',async()=>{
 const f=await continuationFixture(),receipt=structuredClone(f.fixture.receipt);receipt.scan.resolvedEventIds=[];
 f.provider.suggestions=async(_s,_e,input)=>{const result=localChoices(receipt,input);for(const story of result.stories)story.continuedFrom=f.fixture.catalog.pendingEvents.map(event=>event.source);return result;};
 await f.run();const state=[...f.store.values.values()].map(bytes=>JSON.parse(new TextDecoder().decode(bytes))).find(doc=>doc.key===f.key).value;
 assert.equal(state.stories.at(-1).continuedFrom,undefined);assert.deepEqual(state.pendingEvents,f.fixture.catalog.pendingEvents);
});

for(const mode of ['covered-union','same-title','invalid-source','no-progress'])test(`rejection diagnostics preserve state for ${mode} and clear on a valid retry`,async()=>{
 const f=await continuationFixture(),ref=(first,last)=>({edition:f.book.edition,sectionId:'honglou-003',firstUnit:'honglou-003-'+String(first).padStart(3,'0'),lastUnit:'honglou-003-'+String(last).padStart(3,'0')}),story=(title,source)=>({title,description:'原文中的一个完整事件。',source});
 const old=[story('事件甲',ref(1,4)),story('事件乙',ref(5,8))],expected={'covered-union':'no-new-evidence','same-title':'duplicate','invalid-source':'invalid-source','no-progress':'no-progress'}[mode];
 await f.cache.write(f.key,{...f.fixture.catalog,stories:old,pendingEvents:[],cursor:2,readThrough:2});
 f.provider.suggestions=async()=>({stories:mode==='no-progress'?[]:[story(mode==='same-title'?'事件甲':'交叉拼接',mode==='invalid-source'?{...ref(3,6),firstUnit:'unknown'}:ref(3,6))],note:'',scan:{blockComplete:false,pendingEvents:[],resolvedEventIds:[]}});
 await assert.rejects(f.run(),/已保留进度/);
 const read=()=>[...f.store.values.values()].map(bytes=>JSON.parse(new TextDecoder().decode(bytes))).find(doc=>doc.key===f.key).value;
 assert.deepEqual(read().stories,old);assert.equal(read().cursor,2);assert.equal(read().lastRejection.code,expected);assert.ok(!JSON.stringify(read().lastRejection).includes('text'));
 f.provider.suggestions=async()=>({stories:[story('合法新故事',ref(9,10))],note:'',scan:{blockComplete:true,pendingEvents:[],resolvedEventIds:[]}});
 f.provider.matchStories=async(_theme,stories)=>({matches:stories.map(story=>({id:story.id,verdict:story.title==='合法新故事'?'yes':'no',reason:'受控验证合法重试。'}))});
 assert.equal((await f.run()).stories[0].title,'合法新故事');assert.equal(read().lastRejection,undefined);
});
