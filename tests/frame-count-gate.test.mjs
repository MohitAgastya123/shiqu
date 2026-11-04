// Exercise production review checkpoints with controlled providers and isolated data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceStory} from '../lib/reader-engine.ts';
import {ReaderRepository} from '../lib/reader-repository.ts';
import {selectionSchema,nextStep} from '../lib/reader-model.ts';
import {newReview} from '../lib/reader-review.ts';
import {productionFixture,makePlan,makeReflectionCandidates,selection as legacy} from './fixtures/production.mjs';
import {matchesEvaluationModel} from '../scripts/storyboard-evaluation.mjs';
const owner='docker-local-owner';
const requirement={page:2,quote:'乙未接',task:'重复反应',captionEvidence:'已经交代拒绝',visualEvidence:'重复停顿',loss:'重复表达打断推进',instruction:'合并同一拒绝的重复反应。'};
const change={frameCountReview:{decision:'reduce',proposedCount:2,reason:'拒绝无需重复分幅。'},requirements:[requirement]};
async function seed(f,extra={}){
 const repo=new ReaderRepository(f.app.services.database),id=crypto.randomUUID(),selection=selectionSchema.parse({...legacy,length:'auto'});
 await repo.create(id,owner,selection);
 const doc={plan:makePlan(3),original:{title:'原文',text:'甲赠物，乙未接，后来二人和解。'},images:[],audio:[],usage:[],frameCountConfirmed:true,visualReview:newReview(),...extra};
 await f.app.services.database.prepare("UPDATE stories SET document=?,generation_mode='reader',generation_control='active',state='idle' WHERE id=?").bind(JSON.stringify(doc),id).run();
 const currentRepo=()=>new ReaderRepository(f.app.services.database);
 const read=async()=>{const row=await currentRepo().get(id,owner);return {row,doc:JSON.parse(row.document)};};
 return {id,selection,read,advance:(g=f.generation.generator(),retry=false)=>advanceStory(currentRepo(),g,owner,id,0,retry)};
}
test('production engine reduces, preserves images, saves every count receipt, then selects ending in full audit',async t=>{
 const f=await productionFixture(t),images=['/anchor.png','/repeat.png','/ending.png'],s=await seed(f,{images,reflectionCandidates:makeReflectionCandidates('原结语')});let context;
 f.control.beforeText=async(kind,payload)=>{
  if(kind==='frames'&&payload.plan.pages.length===3)return {...change,requirements:[requirement,{...requirement,task:'重复说明',instruction:'同时保留这项未截断的完整要求。'}]};
  if(kind==='structure'){context=payload.frameCountContext;return {edits:[{from:2,to:2,pages:[]}]};}
 };
 await s.advance();let saved=await s.read();assert.equal(saved.doc.visualReview.status,'repair');assert.equal(saved.doc.visualReview.phase,'frames');assert.equal(f.control.reviews.length,0);assert.ok(saved.doc.reflectionCandidates);
 await s.advance();saved=await s.read();assert.equal(saved.doc.plan.pages.length,2);assert.deepEqual(saved.doc.images,[images[0],images[2]]);assert.equal(context.requirements.length,2);assert.match(context.requirements[1].instruction,/未截断/);
 await s.advance();saved=await s.read();assert.equal(saved.doc.visualReview.phase,'full');assert.equal(saved.doc.visualReview.status,'pending');assert.equal(f.control.reviews.length,0);assert.ok(saved.doc.reflectionCandidates);
 await s.advance();saved=await s.read();assert.equal(saved.doc.visualReview.status,'passed');assert.equal(saved.doc.reflectionCandidates,undefined);assert.equal(f.control.reviews.length,1);assert.equal(f.control.calls.length,0);
 assert.deepEqual(saved.doc.usage.map(x=>x.step),['review:frames:0:0','repair:frames:0:1:structure','review:frames:0:1','review:full:0:2']);
 assert.equal(saved.doc.visualReview.frameCountReports.length,2);assert.equal(saved.doc.visualReview.reports.length,1);
});
test('a saved count-keep survives restart and failed full retry without paying the count gate again',async t=>{
 const f=await productionFixture(t),s=await seed(f);await s.advance();assert.equal((await s.read()).doc.visualReview.phase,'full');await f.restart();
 let fail=true;f.control.beforeText=async kind=>{if(kind==='review'&&fail)throw Error('controlled full failure');};
 await s.advance();assert.equal((await s.read()).row.state,'failed');assert.equal(f.control.frameReviews.length,1);
 fail=false;await s.advance(undefined,true);const saved=await s.read();assert.equal(saved.doc.visualReview.status,'passed');assert.equal(f.control.frameReviews.length,1);assert.equal(f.control.reviews.length,2);assert.equal(saved.doc.usage.length,2);
});
for(const invalid of ['direction','quote','capability'])test(`invalid count ${invalid} stops before full review or media`,async t=>{
 const f=await productionFixture(t),s=await seed(f);
 f.control.beforeText=async kind=>kind==='frames'?invalid==='direction'?{...change,frameCountReview:{...change.frameCountReview,proposedCount:4}}:{...change,requirements:[{...requirement,quote:'不在原文的句子'}]}:undefined;
 const g=f.generation.generator();if(invalid==='capability')delete g.reviewFrameCount;
 await s.advance(g);const saved=await s.read();assert.equal(saved.row.state,'failed');assert.equal(saved.doc.visualReview.status,'pending');assert.equal(f.control.reviews.length,0);assert.equal(f.control.calls.length,0);assert.equal(saved.doc.visualReview.frameCountReports,undefined);
});
test('count repairs share the global limit; no-op repair blocks and manual retry has a distinct job key',async t=>{
 const f=await productionFixture(t),s=await seed(f);f.control.beforeText=async(kind,payload)=>kind==='frames'?change:kind==='structure'?{edits:[{from:2,to:2,pages:[payload.plan.pages[1]]}]}:undefined;
 await s.advance();const oldKey=nextStep((await s.read()).doc,s.selection,0).key;await s.advance();let saved=await s.read();assert.equal(saved.doc.visualReview.stopReason,'unchanged');
 await s.advance(undefined,true);saved=await s.read();assert.notEqual(nextStep(saved.doc,s.selection,0).key,oldKey);
 const limited=await seed(f,{visualReview:{...newReview(),repairs:20}});await limited.advance();saved=await limited.read();assert.equal(saved.doc.visualReview.stopReason,'limit');assert.equal(saved.doc.visualReview.repairs,20);assert.equal(f.control.calls.length,0);
});
test('raw receipt reuse requires the resolved model',()=>{
 assert.ok(matchesEvaluationModel({model:'model-a'},'model-a'));
 for(const receipt of [{model:'model-b'},{},null])assert.equal(matchesEvaluationModel(receipt,'model-a'),false);
 assert.equal(matchesEvaluationModel({model:undefined},undefined),false);
});
test('a count structure repair consumes the same allowance as a subsequent full repair',async t=>{
 const f=await productionFixture(t),s=await seed(f,{visualReview:{...newReview(),repairs:19}});
 f.control.beforeText=async(kind,payload)=>{
  if(kind==='frames'&&payload.plan.pages.length===3)return change;
  if(kind==='structure')return {edits:[{from:2,to:2,pages:[]}]};
  if(kind==='review')return {issues:[{page:1,category:'caption',problem:'指代不清。',instruction:'只改配文。',requiresReplan:false}]};
 };
 for(let i=0;i<4;i++)await s.advance();const saved=await s.read();
 assert.equal(saved.doc.visualReview.repairs,20);assert.equal(saved.doc.visualReview.stopReason,'limit');assert.equal(saved.doc.visualReview.phase,'full');assert.equal(f.control.structures.length,1);assert.equal(f.control.repairs.length,0);assert.equal(f.control.calls.length,0);
});
