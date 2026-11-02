// Exercise paid-result preservation and bounded discovery with isolated source-valid fake inference.
import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {libraryFixture} from './fixtures/story-library.mjs';
import {discoveryNamespace} from '../server/local-story-discovery.ts';
const key=f=>discoveryNamespace(f.book,'codex','mock',undefined,'medium')+'/library';
const state=f=>({stories:f.stories,cursor:1,readThrough:1,pendingEvents:[],exhausted:true,rejected:false});
const read=async f=>f.cache.read(key(f),z.any());
test('a bad cached story or pending does not clear good stories or completed coverage',async()=>{
 const f=libraryFixture();await f.cache.write(key(f),{...state(f),stories:[f.stories[0],{...f.stories[1],source:{...f.stories[1].source,firstUnit:'missing'}}],pendingEvents:[{id:'bad',title:'失效',source:{...f.stories[0].source,firstUnit:'missing'}}]});
 const result=await f.run('知恩图报');assert.equal(result.stories[0].title,f.stories[0].title);assert.equal(f.calls.catalog.length,0);
 const saved=await read(f);assert.equal(saved.stories.length,1);assert.equal(saved.exhausted,true);assert.deepEqual(saved.pendingEvents,[]);
});
test('partial pending failure retains independent story and corrected receipt closes from cached evidence',async()=>{
 const f=libraryFixture(),event={id:'old',title:'旧事件',source:f.stories[0].source};
 await f.cache.write(key(f),{...state(f),stories:[],cursor:0,readThrough:0,exhausted:false,pendingEvents:[event]});let count=0;
 f.provider.suggestions=async()=>{count++;return {stories:count===1?[f.stories[0]]:[],note:'',scan:{blockComplete:true,pendingEvents:[],resolvedEventIds:count===1?['unknown']:['old']}};};
 const first=await f.run('知恩图报');assert.equal(first.stories.length,1);assert.equal((await read(f)).pendingEvents.length,1);assert.equal((await read(f)).cursor,0);
 await f.run('知恩图报',[f.stories[0].source]);const saved=await read(f);assert.equal(saved.pendingEvents.length,0);assert.equal(saved.stories.length,1);assert.equal(saved.exhausted,true);assert.equal(count,2);
});
test('all queued cache updates execute and merge latest state',async()=>{
 const f=libraryFixture(),schema=z.object({ids:z.array(z.number())});
 await Promise.all(Array.from({length:8},(_,id)=>f.cache.update('atomic',schema,()=>({ids:[]}),value=>({ids:[...value.ids,id]}))));
 assert.deepEqual((await f.cache.read('atomic',schema)).ids,[0,1,2,3,4,5,6,7]);
});

import {matchLibraryStories,hasUnknownJudgments} from '../server/story-theme-matching.ts';
import {DiscoveryFailure} from '../lib/reader-discovery-call.ts';
import {until} from './fixtures/production.mjs';
import {StoryDiscoveryCache} from '../server/story-discovery-cache.ts';
function many(count=16){const f=libraryFixture();f.stories.splice(0);f.book.sections[0].units.splice(0);for(let i=0;i<count;i++){const unit={id:'u'+i,text:'人物'+i+'面对困境，作出选择，经过行动终于解决问题并平安归来。',narrative:true};f.book.sections[0].units.push(unit);f.stories.push({title:'故事'+i,description:'一场有起因、行动和结果的事件。',source:{edition:f.book.edition,sectionId:'s1',firstUnit:unit.id,lastUnit:unit.id}});}f.book.input.text='篇章 s1：第一章\n'+f.book.sections[0].units.map(u=>'['+u.id+']\n'+u.text).join('\n\n');return f;}
const observe=cycleId=>({cycleId,signal:new AbortController().signal,onProgress:()=>{},drain:true});
const matching=(f,observer,cache=f.cache)=>matchLibraryStories(f.provider,cache,'isolated','主题',f.stories,s=>f.books.resolve(f.book,s.source).text,50000,'codex',observer,{bookId:f.book.id,retryUnknown:true});
test('one persistent story failure is isolated once and later matching stories remain reachable',async()=>{
 const f=many(16),calls=[];f.provider.matchStories=async(_theme,input)=>{calls.push(input.map(s=>s.title));if(input.some(s=>s.title==='故事0'))throw new DiscoveryFailure('refused');return {matches:input.map(s=>({id:s.id,verdict:s.title==='故事15'?'yes':'no',reason:'受控原文依据。'}))};};
 const result=await matching(f,observe('failure-once'));assert.equal(result[0].title,'故事15');await until(()=>calls.filter(c=>c.length===1).length>=1);
 assert.ok(calls.filter(c=>c.length===1).length<=4);assert.equal(calls.filter(c=>c.length===1&&c[0]==='故事0').length,1);
 assert.equal(await hasUnknownJudgments(f.provider,f.cache,f.book.id,'主题',f.stories,'codex'),true);
});
test('isolation budget survives repeated requests and cache recreation in the same cycle',async()=>{
 const f=many(40);let calls=0,singles=0;f.provider.matchStories=async(_theme,input,context)=>{calls++;if(context?.isolation)singles++;throw new DiscoveryFailure('refused');};
 assert.deepEqual(await matching(f,observe('budget-cycle')),[]);assert.equal(singles,8);const before=calls;
 assert.deepEqual(await matching(f,observe('budget-cycle'),new StoryDiscoveryCache(f.store)),[]);assert.equal(calls,before);
 assert.deepEqual(await matching(f,observe('fresh-cycle')),[]);assert.equal(singles,16);
});
test('a later matching batch returns before two pending batches, then both pending receipts save',async()=>{
 const f=many(16),gates=[];f.provider.matchStories=async(_theme,input)=>{await new Promise(resolve=>gates.push({input,resolve}));return {matches:input.map(s=>({id:s.id,verdict:s.title==='故事8'?'yes':'no',reason:'受控依据。'}))};};
 const pending=matching(f,observe('parallel'));await until(()=>gates.length===3);gates[2].resolve();const result=await pending;assert.equal(result[0].title,'故事8');assert.equal(gates.length,3);
 gates[0].resolve();gates[1].resolve();await until(()=>[...f.store.values.values()].some(bytes=>{const doc=JSON.parse(new TextDecoder().decode(bytes));return doc.value.decisions&&Object.keys(doc.value.decisions).length===12;}));assert.equal(gates.length,3);
});
test('service failures stop dispatch instead of being isolated or cached as no',async()=>{
 const f=many(40);let calls=0;f.provider.matchStories=async()=>{calls++;throw new TypeError('private network details');};
 await assert.rejects(matching(f,observe('outage')),/private network/);await new Promise(resolve=>setImmediate(resolve));assert.ok(calls<=3);
 assert.equal(await hasUnknownJudgments(f.provider,f.cache,f.book.id,'主题',f.stories,'codex'),false);
});
test('matching cache is shared across scope and extraction identity but checks original content',async()=>{
 const f=many(4);let calls=0;f.provider.matchStories=async(_theme,input)=>{calls++;return {matches:input.map(s=>({id:s.id,verdict:'yes',reason:'原文依据。'}))};};
 await matching(f,observe('scope-a'));const before=calls;await matchLibraryStories(f.provider,f.cache,'other-extractor','主题',f.stories,s=>f.books.resolve(f.book,s.source).text,50000,'codex',observe('scope-b'),{bookId:f.book.id});assert.equal(calls,before);
 f.book.sections[0].units[0].text+='原文内容已经改变。';await matching(f,observe('changed-original'));assert.equal(calls,before,'other cached positive stories can return without judging the changed one');
 await matchLibraryStories(f.provider,f.cache,'another','主题',[f.stories[0]],s=>f.books.resolve(f.book,s.source).text,50000,'codex',observe('changed-only'),{bookId:f.book.id});assert.equal(calls,before+1);
});
