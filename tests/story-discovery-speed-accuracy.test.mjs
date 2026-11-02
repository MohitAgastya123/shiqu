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
