// Follow the production engine through count, repair and recheck, then read the same saved history API.
import test from 'node:test';
import assert from 'node:assert/strict';
import {ReaderRepository} from '../lib/reader-repository.ts';
import {selectionSchema} from '../lib/reader-model.ts';
import {newReview} from '../lib/reader-review.ts';
import {productionFixture,makePlan,selection,until} from './fixtures/production.mjs';
test('formal review flow persists ordered history and before text without affecting generation on read',async t=>{
 const f=await productionFixture(t),owner='docker-local-owner',id=crypto.randomUUID();
 const repo=()=>new ReaderRepository(f.app.services.database),plan=makePlan(3);
 await repo().create(id,owner,selectionSchema.parse({...selection,length:'auto'}));
 await f.app.services.database.prepare("UPDATE stories SET document=?,generation_mode='reader',generation_control='active',state='idle' WHERE id=?").bind(JSON.stringify({plan,original:{title:'原文',text:'甲赠物，乙未接，后来二人和解。'},images:[],audio:[],usage:[],frameCountConfirmed:true,visualReview:newReview()}),id).run();
 f.control.beforeText=async(kind,payload)=>{
  if(kind==='frames'&&payload.plan.pages.length===3)return {frameCountReview:{decision:'reduce',proposedCount:2,reason:'重复反应可精简。'},requirements:[{page:2,quote:'乙未接',task:'重复反应',captionEvidence:'已经交代拒绝',visualEvidence:'重复停顿',loss:'拖慢推进',instruction:'合并重复反应。'}]};
  if(kind==='structure')return {edits:[{from:2,to:2,pages:[]}]};
  if(kind==='review'&&f.control.reviews.length===1)return {issues:[{page:1,category:'caption',problem:'指代不清。',instruction:'写明听者。',requiresReplan:false}]};
 };
 f.control.hold=false;await f.demand(id);await until(async()=>(await repo().get(id,owner)).state==='completed');
 await f.app.services.production.queue.settle();
 const before=await repo().get(id,owner),doc=JSON.parse(before.document),jobs=await f.app.services.production.queue.jobs(id,owner),calls=doc.usage.length;
 assert.equal(doc.visualReview.status,'passed');const mediaCalls=f.control.calls.length;assert.ok(mediaCalls>0);
 assert.deepEqual(doc.visualReview.history[1].before,[{page:1,...plan.pages[0]}]);
 for(const record of [...doc.visualReview.frameCountReports,...doc.visualReview.reports,...doc.visualReview.history]){assert.ok(record.step);assert.ok(Number.isFinite(Date.parse(record.recordedAt)));}
 const history=await f.json(`sessions/${id}/review-history`);
 assert.deepEqual(history.entries.map(x=>[x.kind,x.outcome]),[['count','needs-change'],['repair','changed'],['count','passed'],['review','needs-change'],['repair','changed'],['review','passed']]);
 assert.deepEqual(history.entries.map(x=>x.position),[0,1,2,3,4,5]);
 assert.equal(history.entries[1].repair.structure.before,3);assert.equal(history.entries[1].repair.structure.after,2);
 assert.deepEqual(history.entries[4].repair.pages[0].before,plan.pages[0]);assert.match(history.entries[4].repair.pages[0].after.prompt,/Revised staging/);
 await f.restart();assert.deepEqual(await f.json(`sessions/${id}/review-history`),history);
 assert.deepEqual(await repo().get(id,owner),before);assert.deepEqual(await f.app.services.production.queue.jobs(id,owner),jobs);assert.equal(JSON.parse((await repo().get(id,owner)).document).usage.length,calls);assert.equal(f.control.calls.length,mediaCalls);
});
