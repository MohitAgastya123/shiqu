// Run discovery through real REST, durable jobs, SQLite and FileMedia using bounded fake inference only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {discoveryService} from './fixtures/discovery.mjs';
import {selection} from './fixtures/story-library.mjs';
import {until} from './fixtures/production.mjs';
import {discoveryNamespace} from '../server/local-story-discovery.ts';
import {DiscoveryFailure} from '../lib/reader-discovery-call.ts';
const key=s=>discoveryNamespace(s.library.book,'codex','controlled',undefined,'medium')+'/library';
const catalog=s=>({stories:s.library.stories,cursor:1,readThrough:1,pendingEvents:[],exhausted:true,rejected:false});
async function create(s,theme='受控主题'){const row=await s.f.json('sessions','POST',{requestId:randomUUID(),intake:true,selection:{...selection,theme,narrativeDetail:'balanced'}});await s.f.demand(row.id);await until(async()=>['idle','failed'].includes((await s.f.read(row.id)).intake.search.state));return s.f.read(row.id);}
async function more(s,id,automatic=true){const row=await s.f.read(id);await s.f.json(`sessions/${id}/setup`,'POST',{action:'more',automatic,requestId:randomUUID(),generation:row.intake.generation});await until(async()=>['idle','failed'].includes((await s.f.read(id)).intake.search.state));return s.f.read(id);}
test('persistent bad stories do not block later originals; exhausted results disclose unknown judgments',async t=>{
 const s=await discoveryService(t,16);let bad=0;
 s.library.provider.matchStories=async(_theme,input)=>{if(input.some(story=>story.title==='故事0')){bad++;throw new DiscoveryFailure('refused');}return {matches:input.map(story=>({id:story.id,verdict:story.title==='故事15'?'yes':'no',reason:'受控完整原文判断。'}))};};
 const first=await create(s);assert.equal(first.intake.batches[0].stories[0].title,'故事15');assert.equal(bad,2);
 const next=await more(s,first.id);assert.deepEqual(next.intake.batches.at(-1).stories,[]);assert.match(next.intake.batches.at(-1).note,/未能判断/);assert.equal(bad,2);assert.equal((await s.cache.read(key(s),z.any())).stories.length,16);
});
test('eight isolation calls span automatic rounds, viewer departures and a restart; manual retry starts a new cycle',async t=>{
 const s=await discoveryService(t,40);s.library.provider.matchStories=async(_theme,input)=>{if(input.some(story=>Number(story.title.slice(2))%4===0))throw new DiscoveryFailure('refused');return {matches:input.map(story=>({id:story.id,verdict:'yes',reason:'受控原文判断。'}))};};
 let row=await create(s);const cycle=JSON.parse((await s.f.app.services.database.prepare('SELECT document FROM reader_sessions WHERE id=?').bind(row.id).first()).document).intake.search.cycleId;
 for(let i=0;i<30&&row.intake.batches.at(-1).stories.length;i++){if(i===2){await s.restart();await s.f.demand(row.id);}row=await more(s,row.id);}
 await s.f.app.services.production.queue.settle();assert.ok(s.events.filter(e=>e.isolation).length<=8);assert.ok(s.events.filter(e=>e.isolation).length>0);
 const saved=await s.f.app.services.database.prepare('SELECT document FROM reader_sessions WHERE id=?').bind(row.id).first();assert.equal(JSON.parse(saved.document).intake.search.cycleId,cycle);
 const before=s.events.filter(e=>e.isolation).length;await more(s,row.id,false);assert.ok(s.events.filter(e=>e.isolation).length<=before+8);const changed=await s.f.app.services.database.prepare('SELECT document FROM reader_sessions WHERE id=?').bind(row.id).first();assert.notEqual(JSON.parse(changed.document).intake.search.cycleId,cycle);
});
test('a service outage stops without splitting and keeps already-paid catalog entries',async t=>{
 const s=await discoveryService(t,4);let calls=0;s.library.provider.matchStories=async()=>{calls++;throw new DiscoveryFailure('service');};
 const row=await create(s);assert.equal(row.intake.search.state,'failed');assert.equal(calls,1);assert.equal(s.events.filter(e=>e.isolation).length,0);assert.equal((await s.cache.read(key(s),z.any())).stories.length,1);
});
test('later matching batch returns while two pending calls save after selection',async t=>{
 const s=await discoveryService(t,12);await s.cache.write(key(s),catalog(s));const gates=[];
 s.library.provider.matchStories=async(_theme,input)=>{await new Promise(resolve=>gates.push({input,resolve}));return {matches:input.map(story=>({id:story.id,verdict:story.title==='故事8'?'yes':'no',reason:'原文依据。'}))};};
 const pending=create(s);await until(()=>gates.length===3);gates.find(gate=>gate.input.some(story=>story.title==='故事8')).resolve();const row=await pending;assert.equal(row.intake.batches[0].stories[0].title,'故事8');
 await s.f.json(`sessions/${row.id}/setup`,'POST',{action:'choose',requestId:randomUUID(),generation:row.intake.generation,batch:0,index:0});for(const gate of gates)gate.resolve();await s.f.app.services.production.queue.settle();
 const current=await s.f.read(row.id);assert.equal(current.selection.storyTitle,'故事8');assert.equal(current.intake.batches.length,1);assert.equal(gates.length,3);await until(()=>s.events.length===3);assert.equal(s.events.filter(e=>e.status==='success').length,3);
});
test('partial pending failure saves independent stories; corrected receipt resolves without reinsertion after restart',async t=>{
 const s=await discoveryService(t,2),event={id:'old',title:'旧事件',source:s.library.stories[0].source};await s.cache.write(key(s),{...catalog(s),stories:[],cursor:0,readThrough:0,exhausted:false,pendingEvents:[event]});let calls=0;
 s.library.provider.suggestions=async()=>{calls++;return {stories:calls===1?[s.library.stories[0]]:[],note:'',scan:{blockComplete:true,pendingEvents:[],resolvedEventIds:calls===1?['unknown']:['old']}};};
 const row=await create(s);assert.equal(row.intake.batches[0].stories.length,1);assert.equal((await s.cache.read(key(s),z.any())).pendingEvents.length,1);await s.restart();await s.f.demand(row.id);await more(s,row.id);
 const saved=await s.cache.read(key(s),z.any());assert.deepEqual(saved.pendingEvents,[]);assert.equal(saved.stories.length,1);assert.equal(saved.exhausted,true);assert.equal(calls,2);
});
test('single invalid cached entries are removed without rereading a completed original',async t=>{
 const s=await discoveryService(t,2);await s.cache.write(key(s),catalog(s));await create(s);const before=s.events.length;
 await s.cache.write(key(s),{...catalog(s),stories:[s.library.stories[0],{title:null}],pendingEvents:[{id:'bad',title:'失效',source:{...s.library.stories[0].source,firstUnit:'missing'}}]});const row=await create(s);assert.equal(row.intake.batches[0].stories.length,1);assert.equal(s.events.length,before);assert.equal(s.library.calls.catalog.length,0);assert.equal((await s.cache.read(key(s),z.any())).stories.length,1);
});
