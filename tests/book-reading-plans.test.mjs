// 真实原著的容量、全书发现和历史进度迁移检查，仅在原著套件中运行。
import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {LocalBooks} from '../server/local-books.ts';
import {buildReadingPlan,hydrateReadingPlan} from '../server/story-reading-inputs.ts';
import {discoverLocalStories,discoveryNamespace} from '../server/local-story-discovery.ts';
import {localSourceKey} from '../lib/reader-local-contract.ts';
import {memory} from './fixtures/story-library.mjs';
import {StoryDiscoveryCache} from '../server/story-discovery-cache.ts';
import {previousReadingPlanKey,previousDiscoveryNamespace} from '../server/story-discovery-legacy.ts';
import baseline from './fixtures/story-discovery-v1.json' with {type:'json'};
import {books} from './fixtures/test-tier.mjs';
const observe=cycleId=>({cycleId,signal:new AbortController().signal,onProgress:()=>{},drain:true});

test('fixed books retain exhaustive bounded blocks and meet provider-neutral size targets',async()=>{
 const books=new LocalBooks(process.cwd());
 for(const row of baseline.probe.books){const book=await books.book({bookId:row.id}),next=buildReadingPlan(book,'codex'),gemini=buildReadingPlan(book,'gemini'),blocks=hydrateReadingPlan(book,next);assert.deepEqual(blocks.flatMap(b=>[...b.visible]),book.sections.flatMap(s=>s.units.map(u=>u.id)));assert.ok(next.blocks.every(b=>b.tokens<=12000));
  if(row.id==='战国策'){assert.ok(next.blocks.length<=60);const sizes=next.blocks.map(b=>b.tokens).sort((a,b)=>a-b);assert.ok(sizes[Math.floor(sizes.length/2)]>=2000);}else if(row.id==='三国演义'){assert.ok(Math.abs(next.blocks.length-row.old)/row.old<=.05);assert.ok(gemini.blocks.length<=next.blocks.length*1.5);}else assert.ok(next.blocks.length<=row.old);
 }
});

test('all 1129 Shishuo units are covered in at most 60 calls; 1072 eligible stories saved once and 57 rejects accounted',books,async()=>{
 const books=new LocalBooks(process.cwd()),book=await books.book({bookId:'shishuo'}),store=memory(),cache=new StoryDiscoveryCache(store),eligible=[],rejected=[];let calls=0;
 for(const s of book.sections)for(const u of s.units){const story={title:'事件'+u.id,description:'原典中的完整独立事件。',source:{edition:book.edition,sectionId:s.id,firstUnit:u.id,lastUnit:u.id}};try{books.resolve(book,story.source);eligible.push(story);}catch{rejected.push({id:u.id,reason:u.text.length<20?'short':'source-anomaly'});}}
 const provider={status:async()=>({provider:'codex',models:{text:'mock',image:'none'},taskReasoningEfforts:{suggest:'medium'},themeMatching:{model:'match',reasoningEffort:'low'}}),suggestions:async(_s,_excluded,input)=>{calls++;const known=new Set(input.scan.excludedSources.map(localSourceKey)),available=eligible.filter(story=>input.text.includes('['+story.source.firstUnit+']')&&!known.has(localSourceKey(story.source)));return {stories:available.slice(0,input.scan.maxStories),note:'',scan:{blockComplete:available.length<input.scan.maxStories,pendingEvents:[],resolvedEventIds:[]}};},matchStories:async(_theme,entries)=>({matches:entries.map(s=>({id:s.id,verdict:'no',reason:'固定主题无符合项。'}))})};
 const result=await discoverLocalStories(provider,books,cache,book,{bookId:'shishuo',theme:'固定测试主题'},[],observe('shishuo-full'));
 assert.deepEqual(result.stories,[]);assert.ok(calls<=60,`${calls} calls`);const saved=await cache.read(discoveryNamespace(book,'codex','mock',undefined,'medium')+'/library',z.any());assert.equal(saved.stories.length,1072);assert.equal(new Set(saved.stories.map(s=>localSourceKey(s.source))).size,1072);assert.equal(saved.exhausted,true);assert.equal(rejected.length,57);assert.equal(rejected.filter(r=>r.reason==='short').length,56);assert.equal(rejected.find(r=>r.reason==='source-anomaly').id,'shishuo-10-026');assert.deepEqual(rejected.map(r=>r.id).sort(),baseline.probe.invalid.map(r=>r.id).sort());
});

test('v3 migration maps the proven frontier, rereads only its containing new block, and preserves old bytes',async()=>{
 const books=new LocalBooks(process.cwd()),book=await books.book({bookId:'战国策'}),fixture=baseline.books.find(row=>row.bookId===book.id),store=memory(),cache=new StoryDiscoveryCache(store),old=previousDiscoveryNamespace(book,'codex','mock',undefined,'medium'),manifestKey=previousReadingPlanKey(book,'codex')+'/blocks';
 const first=book.sections[0],story={title:'颜率保九鼎',description:'颜率保全九鼎。',source:{edition:book.edition,sectionId:first.id,firstUnit:first.units[0].id,lastUnit:first.units.at(-1).id}};
 await cache.write(manifestKey,fixture.manifest);await cache.write(old+'/library',{stories:[story],cursor:2,readThrough:2,pendingEvents:[],exhausted:false,rejected:false});const originalBytes=[...store.values.values()].map(bytes=>bytes.slice()),inputs=[];
 const provider={status:async()=>({provider:'codex',models:{text:'mock',image:'none'},taskReasoningEfforts:{suggest:'medium'},themeMatching:{model:'match',reasoningEffort:'low'}}),matchStories:async(_theme,entries)=>({matches:entries.map(s=>({id:s.id,verdict:'yes',reason:'原文依据。'}))}),suggestions:async(_s,_e,input)=>{inputs.push(input.text);return {stories:[],note:'',scan:{blockComplete:true,pendingEvents:[],resolvedEventIds:[]}};}};
 const selection={bookId:book.id,theme:'固定主题'};await discoverLocalStories(provider,books,cache,book,selection,[]);const newKey=discoveryNamespace(book,'codex','mock',undefined,'medium')+'/library';assert.equal((await cache.read(newKey,z.any())).cursor,0);assert.equal(inputs.length,0);
 await discoverLocalStories(provider,books,cache,book,selection,[],undefined,[story.source]);assert.equal(inputs.length,17);assert.equal(new Set(inputs).size,17);assert.equal((await cache.read(newKey,z.any())).exhausted,true);assert.ok(originalBytes.every(bytes=>[...store.values.values()].some(current=>Buffer.compare(bytes,current)===0)));
 await discoverLocalStories(provider,books,new StoryDiscoveryCache(store),book,selection,[],undefined,[story.source]);assert.equal(inputs.length,17);
});
