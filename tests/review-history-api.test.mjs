// Read history through the production API, with owner/deletion isolation and no production side effects.
import test from 'node:test';
import assert from 'node:assert/strict';
import {ReaderRepository} from '../lib/reader-repository.ts';
import {selectionSchema} from '../lib/reader-model.ts';
import {newReview} from '../lib/reader-review.ts';
import {productionFixture,makePlan,selection} from './fixtures/production.mjs';
const owner='docker-local-owner';
async function seed(f,uid=owner,extra={}){
 const id=crypto.randomUUID(),repo=new ReaderRepository(f.app.services.database);await repo.create(id,uid,selectionSchema.parse(selection));
 const doc={plan:makePlan(3),original:{title:'原文',text:'原文'},images:[],audio:[],usage:[],visualReview:newReview(),...extra};
 await f.app.services.database.prepare("UPDATE stories SET document=?,generation_control='paused' WHERE id=?").bind(JSON.stringify(doc),id).run();return id;
}
test('history is demand-loaded, read-only, owner scoped, and deleted stories stay hidden',async t=>{
 const f=await productionFixture(t),id=await seed(f),repo=new ReaderRepository(f.app.services.database);
 const before=await repo.get(id,owner);f.generation.status=async()=>{throw Error('History must not need a provider');};
 const jobs=await f.app.services.production.queue.jobs(id,owner),data=await f.json(`sessions/${id}/review-history`);
 assert.equal(data.id,id);assert.deepEqual(data.entries,[]);assert.deepEqual(await repo.get(id,owner),before);assert.deepEqual(await f.app.services.production.queue.jobs(id,owner),jobs);assert.equal(f.control.calls.length,0);assert.equal(f.control.reviews.length,0);
 assert.equal((await f.request(`sessions/${await seed(f,'other-owner')}/review-history`)).status,404);
 await repo.remove(id,owner);assert.equal((await f.request(`sessions/${id}/review-history`)).status,404);assert.equal((await f.request('sessions/not-an-id/review-history')).status,400);
});
test('a fresh revision shows its own records and links its parent without inheriting parent verdicts',async t=>{
 const f=await productionFixture(t),parent=await seed(f);
 const child=await seed(f,owner,{revision:{parentId:parent,rootId:parent,number:2},usage:[{step:'review:0',originId:parent,model:'old',usage:null}],visualReview:newReview()});
 const current=await f.json(`sessions/${child}/review-history`);assert.equal(current.parentId,parent);assert.equal(current.revision,2);assert.deepEqual(current.entries,[]);assert.equal((await f.json(`sessions/${parent}/review-history`)).id,parent);
});
