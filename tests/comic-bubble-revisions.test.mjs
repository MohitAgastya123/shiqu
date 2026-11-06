// Verify the production revision path retains balloon drafts, review boundaries and immutable artwork.
// All inference, media and SQLite data are isolated fixtures; no paid services are used.
import test from 'node:test';
import assert from 'node:assert/strict';
import {checkedRevision,revisionImpact} from '../lib/reader-revision.ts';
import {productionFixture,until,makePlan,selection} from './fixtures/production.mjs';

const speech={id:'speech-1',kind:'speech',speaker:'The traveller',text:'We must cross before sunset.',x:0.04,y:0.04,width:0.43,height:0.2,tailX:0.28,tailY:0.7};
const thought={...speech,id:'thought-2',kind:'thought',text:'I hope the bridge is safe.',x:0.53,tailX:0.72};
const basis=()=>{const plan=makePlan(4);plan.pages[0].bubbles=[structuredClone(speech),structuredClone(thought)];return {selection,plan,images:['a','b','c','d']};};

test('balloon geometry and IDs retain review; attribution, content, evidence and reading order require it',()=>{
 const base=basis();
 for(const key of ['x','y','width','height','tailX','tailY','id']){
  const plan=structuredClone(base.plan);plan.pages[0].bubbles[0][key]=key==='id'?'renamed-bubble':plan.pages[0].bubbles[0][key]+0.01;
  const {impact}=checkedRevision(base,{plan});assert.equal(impact.changed,true,key);assert.equal(impact.review,false,key);assert.equal(impact.redraw,0,key);
 }
 for(const change of [bubble=>bubble.text+=' Now!',bubble=>bubble.kind='thought',bubble=>bubble.speaker='Another traveller',bubble=>bubble.sourceQuote='We must cross before sunset.']){
  const plan=structuredClone(base.plan);change(plan.pages[0].bubbles[0]);assert.equal(revisionImpact(base,{plan}).review,true);assert.equal(revisionImpact(base,{plan}).redraw,0);
 }
 const reordered=structuredClone(base.plan);reordered.pages[0].bubbles.reverse();assert.equal(revisionImpact(base,{plan:reordered}).review,true);
 const removed=structuredClone(base.plan);removed.pages[0].bubbles.pop();assert.equal(revisionImpact(base,{plan:removed}).review,true);
 const legacy={...base,plan:makePlan(4)},empty=structuredClone(legacy.plan);empty.pages[0].bubbles=[];assert.equal(revisionImpact(legacy,{plan:empty}).review,false);
});

test('invalid balloon geometry, duplicate IDs and excessive text fail before revision writes',()=>{
 const base=basis();
 for(const change of [bubble=>bubble.x=0.9,bubble=>bubble.height=0,bubble=>bubble.tailY=1.1,bubble=>bubble.text='x'.repeat(221),bubble=>bubble.speaker='']){
  const plan=structuredClone(base.plan);change(plan.pages[0].bubbles[0]);assert.throws(()=>checkedRevision(base,{plan}),/comic bubble/i);
 }
 const duplicate=structuredClone(base.plan);duplicate.pages[0].bubbles[1].id=duplicate.pages[0].bubbles[0].id;assert.throws(()=>checkedRevision(base,{plan:duplicate}),/comic bubble/i);
 const dense=structuredClone(base.plan);dense.pages[0].bubbles[0].width=0.03;assert.throws(()=>checkedRevision(base,{plan:dense}),/too dense/i);
});

test('REST layout-only balloon revisions persist without model work and preserve old versions, media and conflicts',async t=>{
 const f=await productionFixture(t);f.control.hold=false;const id=await f.create();await until(async()=>(await f.read(id)).state==='completed');
 const snapshot=storyId=>f.json(`sessions/${storyId}/revisions`);
 const base=await snapshot(id),plan=structuredClone(base.plan);plan.pages[0].bubbles=[speech,thought];plan.pages[0].caption='';
 const added=await f.json(`sessions/${id}/revisions`,'POST',{requestId:crypto.randomUUID(),token:base.token,changes:{plan}});
 await until(async()=>(await f.read(added.id)).state==='completed');
 const before=await f.read(added.id),editable=await snapshot(added.id),layout=structuredClone(editable.plan);layout.pages[0].bubbles[0].x=0.055;layout.pages[0].bubbles[0].tailX=0.31;
 const calls={images:f.control.calls.length,reviews:f.control.reviews.length,plans:f.control.plans.length,frames:f.control.frameReviews.length};
 const payload={requestId:crypto.randomUUID(),token:editable.token,changes:{plan:layout}};
 const saved=await f.json(`sessions/${added.id}/revisions`,'POST',payload);await until(async()=>(await f.read(saved.id)).state==='completed');
 const after=await f.read(saved.id);assert.deepEqual(after.story.pages[0].bubbles,layout.pages[0].bubbles);assert.equal(after.story.pages[0].caption,'');
 assert.deepEqual({images:f.control.calls.length,reviews:f.control.reviews.length,plans:f.control.plans.length,frames:f.control.frameReviews.length},calls);
 assert.deepEqual((await f.read(added.id)).story,before.story);
 for(let page=0;page<before.story.pages.length;page++){
  const bytes=async image=>new Uint8Array(await(await f.request(image.replace('/api/reader/',''))).arrayBuffer());
  assert.deepEqual(await bytes(after.story.pages[page].image),await bytes(before.story.pages[page].image));
 }
 assert.equal((await f.request(`sessions/${added.id}/revisions`,'POST',{...payload,requestId:crypto.randomUUID()})).status,409);
 assert.equal((await f.json(`sessions/${added.id}/revisions`,'POST',payload)).id,saved.id);
 await f.restart();assert.deepEqual((await f.read(saved.id)).story.pages[0].bubbles,layout.pages[0].bubbles);
});
