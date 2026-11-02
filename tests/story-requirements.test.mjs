// Exercise story criteria through real persistence, queued review gates and immutable revisions.
import test from 'node:test';
import assert from 'node:assert/strict';
import {productionFixture,until,makePlan,selection} from './fixtures/production.mjs';
import {acceptanceCriteria,acceptancePromptSchema} from '../lib/reader-acceptance.ts';
import {selectionSchema} from '../lib/reader-model.ts';
import {reviewReportSchema} from '../lib/reader-review.ts';
import {checkedRevision,revisionImpact} from '../lib/reader-revision.ts';
const criteria='关键反应落实到画面。\n保留对白的条件。';
const results=status=>[{criterion:1,status,pages:status==='unknown'?[]:[2],evidence:status==='unknown'?'无法从文字分镜判断生成图中的手指数量。':'第二幅的手部反应与配文提供依据。'},{criterion:2,status:'passed',pages:[1],evidence:'第一幅配文保留了条件。'}];
const titleReview={title:'庄周梦蝶',reason:'标题符合原文。'};
test('criteria are bounded and legacy stories remain unmodified; acceptance-only revisions preserve images and script',()=>{
 assert.deepEqual(acceptanceCriteria('  一条\n\n 第二条\r\n'),['一条','第二条']);
 assert.equal(acceptancePromptSchema.safeParse(Array(21).fill('一条').join('\n')).success,false);
 assert.equal('acceptancePrompt' in selectionSchema.parse(selection),false);
 const base={selection,plan:makePlan(3),images:['a','b','c']},impact=revisionImpact(base,{acceptancePrompt:criteria});
 assert.equal(impact.replan,false);assert.equal(impact.redraw,0);assert.equal(impact.review,true);
 const checked=checkedRevision(base,{acceptancePrompt:criteria});assert.deepEqual(checked.plan,base.plan);assert.equal(checked.selection.acceptancePrompt,criteria);
});
test('missing, duplicate, out-of-range and unactionable failed criterion results cannot pass review validation',()=>{
 const schema=reviewReportSchema(3,undefined,criteria),report={titleReview,issues:[],acceptanceResults:results('passed')};
 assert.equal(schema.safeParse(report).success,true);
 for(const acceptanceResults of [undefined,[],[results('passed')[0],results('passed')[0]],[{...results('passed')[0],criterion:3},results('passed')[1]],results('failed'),[{...results('passed')[0],pages:[4]},results('passed')[1]]])assert.equal(schema.safeParse({...report,acceptanceResults}).success,false);
 assert.equal(schema.safeParse({...report,acceptanceResults:results('unknown')}).success,true);
});
for(const provider of ['codex','gemini'])test(`${provider}: saved per-story requirements, actual prompts and acceptance-only revisions survive restart without redrawing`,async t=>{
 const f=await productionFixture(t,provider);f.control.hold=false;
 f.control.beforeText=async kind=>kind==='review'?{issues:[],acceptanceResults:results('passed')}:undefined;
 const id=await f.create(3,{acceptancePrompt:criteria});await until(async()=>(await f.read(id)).state==='completed');
 const before=await f.read(id),captures=await f.json(`sessions/${id}/prompts`);
 assert.equal(before.selection.acceptancePrompt,criteria);assert.deepEqual(captures.results,results('passed'));assert.deepEqual(captures.criteria,criteria.split('\n'));
 assert.equal(captures.productionPrompt,before.selection.productionPrompt);assert.equal(captures.acceptancePrompt,criteria);assert.deepEqual(captures.missingRecords,[]);
 assert.ok(captures.records.some(record=>record.step==='image:1'&&record.record.input.includes('Scene 2:')),'queued publication retains actual image prompt');
 assert.ok(captures.records.some(record=>record.step.startsWith('review')&&JSON.parse(record.record.input).acceptancePrompt===criteria));
 assert.equal('records' in before,false);assert.equal('usage' in before,false);
 const imageCalls=f.control.calls.length,planCalls=f.control.plans.length,reviews=f.control.reviews.length,base=await f.json(`sessions/${id}/revisions`);
 const child=await f.json(`sessions/${id}/revisions`,'POST',{requestId:crypto.randomUUID(),token:base.token,changes:{acceptancePrompt:criteria+'\n结语不复述情节。'},paused:true});
 assert.equal(child.ready,3);assert.equal(child.generationProgress.reviewStatus,'pending');assert.deepEqual(child.story.pages.map(p=>p.prompt),before.story.pages.map(p=>p.prompt));
 f.control.beforeText=async kind=>kind==='review'?{issues:[],acceptanceResults:[...results('passed'),{criterion:3,status:'passed',pages:[0],evidence:'结语提炼判断，不复述情节。'}]}:undefined;
 await f.json(`sessions/${child.id}/production-control`,'POST',{action:'resume'});await until(async()=>(await f.read(child.id)).state==='completed');
 assert.equal(f.control.calls.length,imageCalls);assert.equal(f.control.plans.length,planCalls);assert.equal(f.control.reviews.length,reviews+1);
 const latest=await f.json(`sessions/${child.id}/prompts`);assert.ok(latest.records.some(record=>record.originId===id&&record.step==='image:1'));assert.ok(latest.records.some(record=>record.originId===child.id&&record.step.startsWith('review')));
 assert.equal(latest.acceptancePrompt,criteria+'\n结语不复述情节。');
 assert.equal((await f.read(id)).selection.acceptancePrompt,criteria);
 await f.restart();assert.deepEqual((await f.json(`sessions/${child.id}/prompts`)).results,latest.results);
 const database=f.app.services.database;await database.prepare('UPDATE reader_sessions SET user_id=? WHERE id=?').bind('other-owner',id).run();assert.equal((await f.request(`sessions/${id}/prompts`)).status,404);
});
test('failed criteria enter existing targeted repair and must pass a fresh audit before drawing',async t=>{
 const f=await productionFixture(t);f.control.hold=false;
 f.control.beforeText=async kind=>kind==='review'?f.control.reviews.length===1?{issues:[{page:2,category:'action',problem:'缺少可见反应。',instruction:'第二幅保留原事件，增加可见的手部回应。',requiresReplan:false}],acceptanceResults:results('failed')}:{issues:[],acceptanceResults:results('passed')}:undefined;
 const id=await f.create(3,{acceptancePrompt:criteria});await until(async()=>(await f.read(id)).state==='completed');
 assert.equal(f.control.repairs.length,1);assert.equal(f.control.repairs[0].acceptancePrompt,criteria);assert.equal(f.control.reviews.length,2);assert.equal((await f.json(`sessions/${id}/prompts`)).results[0].status,'passed');
});
test('unknown/conflicting criteria stop immediately with evidence, no fabricated repair or drawing',async t=>{
 const f=await productionFixture(t);f.control.hold=false;f.control.beforeText=async kind=>kind==='review'?{issues:[],acceptanceResults:results('unknown')}:undefined;
 const id=await f.create(3,{acceptancePrompt:criteria});await until(async()=>(await f.read(id)).state==='failed');const saved=await f.read(id);
 assert.equal(saved.generationProgress.reviewStopReason,'requirements');assert.equal(saved.retryAllowed,false);assert.match(saved.error,/无法从文字分镜判断/);
 assert.equal(f.control.repairs.length,0);assert.equal(f.control.calls.length,0);assert.equal(f.control.reviews.length,1);
 assert.equal((await f.json(`sessions/${id}/prompts`)).results[0].status,'unknown');
 assert.equal((await f.request(`sessions/${id}/production`,'POST',{viewerId:crypto.randomUUID(),page:0,retry:true})).status,409);
});
test('historical rows have no invented capture history, and previews do not commission inference',async t=>{
 const f=await productionFixture(t),id=await f.createLegacyReader(3);f.app.stopGeneration();
 await f.app.services.database.prepare("UPDATE reader_sessions SET document=json_remove(document,'$.usage') WHERE id=?").bind(id).run();
 const initial=await f.json(`sessions/${id}/prompts`);assert.deepEqual(initial.records,[]);assert.deepEqual(initial.results,[]);assert.ok(initial.previews.production.instructions.includes('本篇验收要求'));assert.equal(f.control.plans.length,0);
 assert.deepEqual(initial.missingRecords,[]);assert.equal(initial.productionPrompt,selection.productionPrompt);assert.equal(initial.acceptancePrompt,'');
});

test('prompt export metadata identifies partially retained and inherited calls without leaking raw receipts',async t=>{
 const f=await productionFixture(t),id=await f.createLegacyReader(3);f.app.stopGeneration();
 const record={instructions:'Saved historical rules',input:'Saved historical input',schema:{type:'object'},reference:'/api/media/old-reference.webp'};
 const usage=[
  {step:'plan',model:'old-text',originId:'parent-version',requestId:'private-request-id',usage:{private:'private-usage'},promptRecord:record},
  {step:'image:0',model:'old-image',originId:'parent-version',requestId:'private-image-id',usage:null},
  {step:'review:0',model:'new-review',requestId:null,usage:null,promptRecord:record},
 ];
 await f.app.services.database.prepare("UPDATE reader_sessions SET document=json_set(document,'$.usage',json(?)) WHERE id=?").bind(JSON.stringify(usage),id).run();
 const history=await f.json(`sessions/${id}/prompts`);
 assert.deepEqual(history.records,[{step:'plan',model:'old-text',originId:'parent-version',index:0,record},{step:'review:0',model:'new-review',originId:id,index:2,record}]);
 assert.deepEqual(history.missingRecords,[{step:'image:0',model:'old-image',originId:'parent-version',index:1}]);
 assert.ok(!JSON.stringify(history).includes('private-'));
 assert.equal(f.control.plans.length,0);assert.equal(f.control.calls.length,0);
});

test('confirmation drafts retain both requirements through restart and apply them only on explicit confirmation',async t=>{
 const f=await productionFixture(t);f.control.hold=false;f.generation.suggestions=async()=>({stories:[{title:'庄周梦蝶',description:'梦与醒的经历。'}],note:''});
 f.control.beforeText=async kind=>kind==='review'?{issues:[],acceptanceResults:results('passed')}:undefined;
 const created=await f.json('sessions','POST',{requestId:crypto.randomUUID(),intake:true,selection:{...selection,storyTitle:undefined,length:'auto',narrativeDetail:'balanced'}}),id=created.id;await f.demand(id);
 await until(async()=>(await f.read(id)).intake.phase==='choosing');
 await f.json(`sessions/${id}/setup`,'POST',{requestId:crypto.randomUUID(),generation:(await f.read(id)).intake.generation,action:'choose',batch:0,index:0});await until(async()=>(await f.read(id)).intake.phase==='confirming');
 const settings={artStyle:'ink-pencil',productionPrompt:'保留关键对白，画面尽量复用。',acceptancePrompt:criteria,narrativeDetail:'balanced',length:'auto'};
 await f.json(`sessions/${id}/setup`,'POST',{requestId:crypto.randomUUID(),generation:(await f.read(id)).intake.generation,action:'draft',settings});await f.restart();
 const resumed=await f.read(id);assert.deepEqual(resumed.intake.draft,settings);assert.equal(f.control.plans.length,0);assert.equal(f.control.calls.length,0);
 await f.json(`sessions/${id}/setup`,'POST',{requestId:crypto.randomUUID(),generation:resumed.intake.generation,action:'confirm',settings});await until(async()=>(await f.read(id)).state==='completed');
 const saved=await f.read(id);assert.equal(saved.selection.productionPrompt,settings.productionPrompt);assert.equal(saved.selection.acceptancePrompt,criteria);assert.equal(f.control.outlines.at(-1).acceptancePrompt,criteria);
});
