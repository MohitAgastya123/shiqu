// Verify one production queue for count/full review, recovery, image reuse and explicit overrides.
import test from 'node:test';
import assert from 'node:assert/strict';
import {productionFixture,until,makePlan,makeReflectionCandidates,selection as legacy,encoded} from './fixtures/production.mjs';
import {ReaderRepository} from '../lib/reader-repository.ts';
import {selectionSchema} from '../lib/reader-model.ts';
import {newReview} from '../lib/reader-review.ts';
import {readerImageAsset,referenceImageKey} from '../lib/reader-image-assets.ts';
import {productionJobId,inputVersion} from '../server/production-queue.ts';
import {generationProgress} from '../lib/generation-progress.ts';
const owner='docker-local-owner';
const requirement={page:2,quote:'乙未接',task:'重复反应',captionEvidence:'拒绝已经明确',visualEvidence:'相同拒绝又分一幅',loss:'重复拖慢推进',instruction:'合并重复拒绝，保留决定性反应。'};
const reduction={frameCountReview:{decision:'reduce',proposedCount:3,reason:'移除重复反应。'},requirements:[requirement,{...requirement,task:'重复解释',instruction:'保留此第二项完整要求。'}]};
async function seed(f,{count=4,saved=0,candidates=false}={}){
 const id=crypto.randomUUID(),repo=new ReaderRepository(f.app.services.database),selection=selectionSchema.parse({...legacy,length:'auto'});
 await repo.create(id,owner,selection);
 await f.app.services.database.prepare("UPDATE stories SET generation_mode='background',generation_control='paused' WHERE id=?").bind(id).run();
 const images=Array(count).fill('');
 for(let page=0;page<saved;page++){const asset=readerImageAsset(id,page,'png');await f.media.put(asset.key,Buffer.from(encoded,'base64'),{contentType:'image/png'});images[page]=asset.url;}
 const doc={plan:makePlan(count),original:{title:'原文',text:'甲赠物，乙未接，后来二人和解。'},images,audio:[],usage:[],visualReview:newReview(),...(candidates?{reflectionCandidates:makeReflectionCandidates('原结语')}:{})};
 await f.app.services.database.prepare('UPDATE stories SET document=?,page=? WHERE id=?').bind(JSON.stringify(doc),Math.min(2,count-1),id).run();
 return {id,selection,images,read:async()=>JSON.parse((await new ReaderRepository(f.app.services.database).get(id,owner)).document),resume:()=>f.json(`sessions/${id}/production-control`,'POST',{action:'resume'}),pause:()=>f.json(`sessions/${id}/production-control`,'POST',{action:'pause'})};
}
test('production queue survives old review keys, reduces with full requirements, and reuses bytes before missing-image dispatch',async t=>{
 const f=await productionFixture(t),s=await seed(f,{saved:3,candidates:true});let context,releaseFull,fullStarted=false;
 const hold=new Promise(resolve=>releaseFull=resolve);t.after(()=>releaseFull());
 f.control.beforeText=async(kind,payload)=>{
  if(kind==='frames'&&payload.plan.pages.length===4)return reduction;
  if(kind==='structure'){context=payload.frameCountContext;return {edits:[{from:2,to:2,pages:[]}]};}
  if(kind==='review'){fullStarted=true;await hold;}
 };
 const version=inputVersion({selection:s.selection}),oldIds=[];
 for(const oldKey of ['review:0','repair:0:structure']){
  const oldId=productionJobId(s.id,'script',version,oldKey);oldIds.push(oldId);
  await f.app.services.production.queue.enqueue({id:oldId,sessionId:s.id,ownerId:owner,kind:'script',pool:'text',version,dependencies:[],payload:{stepKey:oldKey},priority:-20});
 }
 await s.resume();await until(()=>fullStarted);
 const pending=await s.read();assert.equal(pending.visualReview.phase,'full');assert.equal(pending.visualReview.status,'pending');assert.equal(pending.plan.pages.length,3);assert.ok(pending.reflectionCandidates);assert.equal(context.requirements.length,2);assert.equal(f.control.calls.length,0);
 assert.deepEqual(pending.images,[s.images[0],s.images[2],'']);assert.equal((await f.read(s.id)).page,1);
 for(const image of pending.images.filter(Boolean))assert.deepEqual(Buffer.from((await f.media.get(referenceImageKey(s.id,image))).body),Buffer.from(encoded,'base64'));
 releaseFull();await until(()=>f.control.calls.length===1);assert.equal(f.control.calls[0].page,2);assert.equal((await s.read()).reflectionCandidates,undefined);
 for(const oldId of oldIds)assert.equal((await f.app.services.production.queue.job(oldId)).state,'succeeded');
 f.control.calls[0].resolve();await until(async()=>(await f.read(s.id)).state==='completed');
 assert.deepEqual((await s.read()).usage.filter(x=>x.step.startsWith('review:')).map(x=>x.step),['review:frames:0:0','review:frames:0:1','review:full:0:2']);
});
test('count in flight drains on pause; restart/full failure retries do not repeat saved count',async t=>{
 const f=await productionFixture(t),s=await seed(f);let releaseCount,countStarted=false,failFull=true;
 const hold=new Promise(resolve=>releaseCount=resolve);t.after(()=>releaseCount());
 f.control.beforeText=async kind=>{if(kind==='frames'){countStarted=true;await hold;}if(kind==='review'&&failFull)throw Error('controlled failure');};
 await s.resume();await until(()=>countStarted);await s.pause();releaseCount();
 await until(async()=>{const d=await s.read();return d.visualReview.phase==='full'&&(await f.read(s.id)).state==='idle';});
 assert.equal(f.control.reviews.length,0);assert.equal(f.control.calls.length,0);await f.restart();await f.app.services.production.tick();assert.equal(f.control.frameReviews.length,1);
 await s.resume();await until(async()=>(await f.read(s.id)).state==='failed');await s.pause();failFull=false;await s.resume();await f.demand(s.id,crypto.randomUUID(),0,true);
 await until(()=>f.control.calls.length===1);assert.equal(f.control.frameReviews.length,1);assert.equal((await s.read()).usage.filter(x=>x.step.startsWith('review:frames:')).length,1);
});
test('full structure edits return to count, while caption repair stays in full',async t=>{
 const f=await productionFixture(t),s=await seed(f,{count:3});const sequence=[];
 f.control.beforeText=async(kind,payload)=>{
  sequence.push(kind);
  if(kind==='review'&&f.control.reviews.length===1)return {issues:[{page:2,category:'progression',problem:'缺少原文的回应。',instruction:'补回应。',requiresReplan:true}]};
  if(kind==='review'&&f.control.reviews.length===2)return {issues:[{page:2,category:'caption',problem:'指代不清。',instruction:'只改配文。',requiresReplan:false}]};
  if(kind==='repair')return {pages:[{page:2,...payload.plan.pages[1],caption:'他没有伸手接物，停在原处看着对方。'}]};
 };
 await s.resume();await until(()=>f.control.calls.length===1);
 assert.deepEqual(sequence,['frames','review','structure','frames','review','repair','review']);assert.equal((await s.read()).visualReview.repairs,2);
});
test('explicit draw-anyway remains marked, paused and idempotent when bypassing an unfinished count gate',async t=>{
 const f=await productionFixture(t),s=await seed(f);f.control.beforeText=async(kind,payload)=>kind==='frames'?reduction:kind==='structure'?{edits:[{from:2,to:2,pages:[payload.plan.pages[1]]}]}:undefined;
 await s.resume();await until(async()=>(await f.read(s.id)).generationProgress.reviewStopReason==='unchanged');await s.pause();
 const skip=()=>f.json(`sessions/${s.id}/review-override`,'POST',{});await skip();await skip();await f.app.services.production.tick();assert.equal(f.control.calls.length,0);assert.equal(f.control.reviews.length,0);
 const paused=await f.read(s.id);assert.equal(paused.generationControl,'paused');assert.equal(paused.generationProgress.reviewOverridden,true);assert.match(generationProgress(paused,0).steps.find(x=>x.id==='review').detail,/确认跳过/);
 f.control.hold=false;await s.resume();await until(async()=>(await f.read(s.id)).state==='completed');await skip();assert.equal(f.control.calls.length,4);assert.equal(f.control.reviews.length,0);
});
for(const legacyReview of ['passed','absent'])test(`opening an old automatic plan with ${legacyReview} review does not add either audit`,async t=>{
 const f=await productionFixture(t),s=await seed(f),doc=await s.read();
 if(legacyReview==='passed')doc.visualReview={...newReview(),status:'passed'};else delete doc.visualReview;
 await f.app.services.database.prepare('UPDATE stories SET document=? WHERE id=?').bind(JSON.stringify(doc),s.id).run();
 await s.resume();await until(()=>f.control.calls.length===1);assert.equal(f.control.frameReviews.length,0);assert.equal(f.control.reviews.length,0);
});
