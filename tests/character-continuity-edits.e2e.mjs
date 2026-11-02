// Exercise the real engine's global-character repair path with controlled providers, never live inference.
import test from 'node:test';
import assert from 'node:assert/strict';
import {productionFixture,until} from './fixtures/production.mjs';
const owner='docker-local-owner';
const issue={page:2,category:'continuity',problem:'全局人物说明仍引用旧幅号，与当前正确画幅的物件状态冲突。',instruction:'只修characters按剧情阶段描述，保留正确画幅。',requiresReplan:true};
const document=async(f,id)=>JSON.parse((await f.app.services.production.repository.get(id,owner)).document);
test('characters-only repair preserves frames, records old/new metadata and rechecks before drawing',async t=>{
 const f=await productionFixture(t);f.control.autoLength=3;let original;
 f.control.beforeText=async(kind,payload)=>{
  if(kind==='review'){if(f.control.reviews.length===1){original=structuredClone(payload.plan);return {issues:[issue]};}assert.equal(payload.plan.characters,original.characters+' Continuity now follows each frame.');return {issues:[]};}
  if(kind==='structure')return {edits:[],characters:payload.plan.characters+' Continuity now follows each frame.'};
 };
 const id=await f.createLegacyReader('auto');await f.demand(id);await until(()=>f.control.calls.length===1);
 const doc=await document(f,id);assert.deepEqual(doc.plan.pages,original.pages);assert.equal(doc.visualReview.repairs,1);assert.equal(doc.visualReview.status,'passed');assert.equal(doc.visualReview.history[0].structure.previousCharacters,original.characters);assert.equal(doc.visualReview.history[0].structure.characters,doc.plan.characters);assert.equal(doc.visualReview.history[0].structure.before,3);assert.equal(doc.visualReview.history[0].structure.after,3);assert.equal(f.control.structures.length,1);assert.equal(f.control.reviews.length,2);
});
test('an unchanged global repair is blocked without drawing',async t=>{
 const f=await productionFixture(t);f.control.autoLength=3;f.control.beforeText=async(kind,payload)=>kind==='review'?{issues:[issue]}:kind==='structure'?{edits:[],characters:payload.plan.characters}:undefined;
 const id=await f.createLegacyReader('auto');await f.demand(id);await until(async()=>(await f.read(id)).state==='failed');
 assert.equal((await document(f,id)).visualReview.stopReason,'unchanged');assert.equal(f.control.calls.length,0);assert.equal(f.control.structures.length,1);
});
test('legacy numeric scripts retain their global-replan stop rather than silently changing mode',async t=>{
 const f=await productionFixture(t);f.control.beforeText=async kind=>kind==='review'?{issues:[issue]}:undefined;
 const id=await f.createLegacyReader(3);await f.demand(id);await until(async()=>(await f.read(id)).state==='failed');
 const row=await f.read(id);assert.equal(row.selection.length,3);assert.match(row.error,/全局人物连续性/);assert.equal(f.control.structures.length,0);assert.equal(f.control.calls.length,0);
});
test('global continuity repairs share the existing twenty-repair ceiling',async t=>{
 const f=await productionFixture(t);f.control.autoLength=3;f.control.beforeText=async(kind,payload)=>kind==='review'?{issues:[issue]}:kind==='structure'?{edits:[],characters:payload.plan.characters+' revised'}:undefined;
 const id=await f.createLegacyReader('auto');await f.demand(id);await until(async()=>(await f.read(id)).state==='failed');
 const doc=await document(f,id);assert.equal(doc.visualReview.stopReason,'limit');assert.equal(doc.visualReview.repairs,20);assert.equal(f.control.structures.length,20);assert.equal(f.control.calls.length,0);
});
