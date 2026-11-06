// Exercise panel emphasis through the production schemas, revision workflow and repair history.
// Presentation changes preserve reviewed text, source identity and immutable illustration inputs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {planSchema,comicPanelKinds} from '../lib/reader-model.ts';
import {generatedPageJson,imagePrompt,storyPageDirection} from '../lib/reader-generation-contract.ts';
import {revisionImpact,checkedRevision} from '../lib/reader-revision.ts';
import {applyStructuralEdits} from '../lib/reader-structure.ts';
import {storyReviewHistory} from '../lib/reader-review-history.ts';
import {productionFixture,until,makePlan,selection} from './fixtures/production.mjs';

test('new generation requests bounded panel hints while saved legacy frames remain unchanged',()=>{
 const old=makePlan(4);assert.deepEqual(planSchema.parse(old),old);
 assert.ok(generatedPageJson.required.includes('panel'));assert.deepEqual(generatedPageJson.properties.panel.enum,[...comicPanelKinds]);
 for(const panel of comicPanelKinds){const plan=structuredClone(old);plan.pages[0].panel=panel;assert.equal(planSchema.parse(plan).pages[0].panel,panel);}
 assert.equal(planSchema.safeParse({...old,pages:[{...old.pages[0],panel:'unknown'}]}).success,false);
 assert.match(storyPageDirection,/Most frames must be normal/);assert.match(storyPageDirection,/not be printed inside balloons/);
});

test('panel spans change presentation without invalidating review or illustration inputs',()=>{
 const base={selection,plan:makePlan(4),images:['a','b','c','d']};
 for(const panel of comicPanelKinds){
  const plan=structuredClone(base.plan);plan.pages[0].panel=panel;
  const {impact}=checkedRevision(base,{plan});assert.equal(impact.changed,true);assert.equal(impact.review,false);assert.equal(impact.redraw,0);
  assert.equal(imagePrompt(base.plan,0,'ink-pencil','',false),imagePrompt(plan,0,'ink-pencil','',false));
 }
 const edited=structuredClone(base.plan);edited.pages[0].panel='wide';edited.pages[0].caption+=' A meaningful new response.';assert.equal(revisionImpact(base,{plan:edited}).review,true);
});

test('structural edits and before/after repair history retain panel emphasis',()=>{
 const plan=makePlan(2);plan.pages[0].panel='normal';const after={...plan.pages[0],panel:'wide'};
 const edited=applyStructuralEdits(plan,{edits:[{from:1,to:1,pages:[after]}]});assert.equal(edited.plan.pages[0].panel,'wide');assert.equal(edited.sourcePages[0],0);
 const review={status:'passed',round:1,repairs:1,issues:[],repaired:[1],reports:[],history:[{round:1,requested:[1],before:[{page:1,...plan.pages[0]}],changes:[{page:1,...after}],changed:true}]};
 const history=storyReviewHistory({id:'panel-fixture',selection:JSON.stringify(selection),document:JSON.stringify({plan,images:[],audio:[],usage:[],visualReview:review}),error:null});
 assert.equal(history.entries[0].repair.pages[0].before.panel,'normal');assert.equal(history.entries[0].repair.pages[0].after.panel,'wide');
});

test('production generates saved panel hints and a span-only revision uses no review or drawing',async t=>{
 const f=await productionFixture(t);f.control.hold=false;
 f.control.beforeText=async(kind,payload)=>kind==='plan'?{...makePlan(payload.exactPageCount),pages:makePlan(payload.exactPageCount).pages.map((page,index)=>({...page,panel:comicPanelKinds[index%comicPanelKinds.length]}))}:undefined;
 const id=await f.create(4);await until(async()=>(await f.read(id)).state==='completed');const original=await f.read(id);
 assert.deepEqual(original.story.pages.map(page=>page.panel),[...comicPanelKinds]);
 const base=await f.json(`sessions/${id}/revisions`),plan=structuredClone(base.plan);plan.pages[0].panel='splash';
 const before={images:f.control.calls.length,reviews:f.control.reviews.length,plans:f.control.plans.length};
 const next=await f.json(`sessions/${id}/revisions`,'POST',{requestId:crypto.randomUUID(),token:base.token,changes:{plan}});await until(async()=>(await f.read(next.id)).state==='completed');
 assert.equal((await f.read(next.id)).story.pages[0].panel,'splash');assert.equal((await f.read(id)).story.pages[0].panel,'normal');
 assert.deepEqual({images:f.control.calls.length,reviews:f.control.reviews.length,plans:f.control.plans.length},before);
 await f.restart();assert.equal((await f.read(next.id)).story.pages[0].panel,'splash');
});
