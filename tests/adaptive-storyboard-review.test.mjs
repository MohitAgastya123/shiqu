// Validate editorial evidence and structural provenance with controlled provider transports only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {applyStructuralEdits} from '../lib/reader-structure.ts';
import {validateEditorialCoverage} from '../lib/reader-editorial.ts';
import {reviewReportSchema} from '../lib/reader-review.ts';
import {reusableRevisionImages} from '../lib/reader-revision-images.ts';
import {checkedRevision} from '../lib/reader-revision.ts';
import {createReaderProvider} from '../server/generation.ts';
import {makePlan,selection as legacy} from './fixtures/production.mjs';

const selection={...legacy,length:'auto',narrativeDetail:'detailed'};
const original={title:'测试原文',text:'甲贈物，乙沉默未接，然後轉身告辭。',url:'https://example.org/source',kind:'passage',provider:'fixture',retrievedAt:'2026-11-01'};
const coverage={quote:'乙沉默未接',task:'未接受赠物的回应',pages:[2],assessment:'adequate',reason:'有独立回应',issuePage:0};
const issue={page:2,category:'progression',problem:'关键回应没有展开。',instruction:'在原第二幅前补回应。',requiresReplan:true};
const added={caption:'乙没有接过递来的物件，停了一会儿。',prompt:'The listener pauses with empty hands before the offered object.'};
const basePlan=()=>{const p=makePlan(4);p.pages[1].prompt=p.pages[2].prompt='Two identical descriptions with distinct stored drawings.';return p;};
test('ordered insertion and deletion preserve explicit identities, including duplicate prompts',()=>{
 const plan=basePlan(),edit=applyStructuralEdits(plan,{edits:[{from:2,to:1,pages:[added]}]});
 assert.equal(edit.plan.pages.length,5);assert.deepEqual(edit.sourcePages,[0,null,1,2,3]);assert.deepEqual(edit.progressMap,[0,2,3,4]);
 const images=reusableRevisionImages({selection,plan,images:['A','X1','X2','B']},selection,edit.plan,edit.sourcePages);
 assert.deepEqual(images,['A','','X1','X2','B']);
 assert.deepEqual(reusableRevisionImages({selection,plan,images:['A','X1','X2','B']},selection,edit.plan),['A','','','','B'],'No implicit guesses for duplicate X');
 const reduced=applyStructuralEdits(plan,{edits:[{from:2,to:3,pages:[]}]});assert.equal(reduced.plan.pages.length,2);assert.deepEqual(reduced.sourcePages,[0,3]);assert.deepEqual(reduced.progressMap,[0,1,1,1]);
 assert.equal(plan.pages.length,4);assert.equal(edit.removed.length,0);assert.equal(reduced.removed.length,2);
});
test('caption-only replacement reuses its explicit source; first-frame or global identity changes invalidate artwork',()=>{
 const plan=basePlan(),edited=applyStructuralEdits(plan,{edits:[{from:2,to:2,pages:[{...plan.pages[1],caption:'只更新说法，画面仍然承担相同的瞬间。'}]}]});
 assert.deepEqual(edited.sourcePages,[0,1,2,3]);const base={selection,plan,images:['A','X1','X2','B']};
 assert.deepEqual(reusableRevisionImages(base,selection,edited.plan,edited.sourcePages),base.images);
 const first=applyStructuralEdits(plan,{edits:[{from:1,to:1,pages:[added]}]});assert.deepEqual(reusableRevisionImages(base,selection,first.plan,first.sourcePages),['','','','']);
 assert.deepEqual(reusableRevisionImages(base,{...selection,artStyle:'ink-wash'},edited.plan,edited.sourcePages),['','','','']);
 assert.throws(()=>reusableRevisionImages(base,selection,plan,[0,1,1,3]),/SOURCE_MAP/);
});
test('invalid edits fail before mutating a saved plan and execution bounds cannot be exceeded',()=>{
 const plan=makePlan(4),saved=structuredClone(plan);
 for(const edits of [[{from:3,to:3,pages:[]},{from:2,to:2,pages:[]}],[{from:2,to:3,pages:[]},{from:3,to:4,pages:[]}],[{from:6,to:5,pages:[added]}],[{from:2,to:0,pages:[added]}],[{from:2,to:1,pages:[]}],[{from:1,to:4,pages:[]}],[{from:1,to:1,pages:Array(21).fill(added)}]])assert.throws(()=>applyStructuralEdits(plan,{edits}));
 assert.throws(()=>applyStructuralEdits(makePlan(80),{edits:[{from:2,to:1,pages:[added]}]}),/FRAME_LIMIT/);
 assert.deepEqual(plan,saved);
 assert.equal(applyStructuralEdits(plan,{edits:[{from:2,to:2,pages:[plan.pages[1]]}]}).changed,false);
});
test('coverage validates source references, frame bounds and a concrete matching issue',()=>{
 validateEditorialCoverage([coverage],original);validateEditorialCoverage([{...coverage,quote:'甲赠物，乙沉默未接。'}],original);
 assert.throws(()=>validateEditorialCoverage([{...coverage,quote:'乙欣然接受了礼物'}],original),/SOURCE_QUOTE/);
 const report={titleReview:{title:'赠物',reason:'范围明确'},issues:[],coverage:[coverage]};
 assert.equal(reviewReportSchema(3).parse(report).coverage.length,1);
 for(const change of [{pages:[4]},{pages:[2,2]},{assessment:'needs-change',issuePage:2},{pages:[]}])assert.equal(reviewReportSchema(3).safeParse({...report,coverage:[{...coverage,...change}]}).success,false);
 assert.ok(reviewReportSchema(3).parse({...report,issues:[issue],coverage:[{...coverage,assessment:'needs-change',pages:[],issuePage:2}]}));
 assert.ok(reviewReportSchema(3).parse({titleReview:report.titleReview,issues:[]}), 'Historical receipts remain readable');
});
test('old numeric caption/style edits preserve their mode; explicit narrative replanning selects auto',()=>{
 const base={selection:legacy,plan:makePlan(8),images:Array(8).fill('image')},plan=structuredClone(base.plan);plan.pages[2].caption='只改变这幅配文，仍保留相同的画面。';
 assert.equal(checkedRevision(base,{plan}).selection.length,8);assert.equal(checkedRevision(base,{plan}).impact.replan,false);
 assert.equal(checkedRevision(base,{artStyle:'ink-wash'}).impact.replan,false);
 const detailed=checkedRevision(base,{narrativeDetail:'detailed',length:'auto'});assert.equal(detailed.selection.length,'auto');assert.equal(detailed.impact.replan,true);
});
for(const provider of ['codex','gemini','openai'])test(`${provider} editorial/structure wire schemas and bounded output budgets`,async()=>{
 const seen=[],plan=makePlan(3),media={get(){throw Error('No media');},put(){throw Error('No media');}};
 const answer=(schema,payload,budget)=>{seen.push({schema,payload,budget});return schema.properties.edits?{edits:[{from:2,to:1,pages:[added]}]}:{titleReview:{title:plan.title,reason:'原文支持'},issues:[],coverage:[coverage]};};
 const runner={status:async()=>({configured:true}),run:async job=>({text:JSON.stringify(answer(job.schema,JSON.parse(job.prompt))),model:'controlled',requestId:'fixture',usage:{calls:1},image:null})};
 const transport=async(_url,options)=>{const body=JSON.parse(options.body);if(provider==='openai'){const value=answer(body.text.format.schema,JSON.parse(body.input[0].content),body.max_output_tokens);return Response.json({status:'completed',id:'fixture',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]});}const value=answer(body.generationConfig.responseFormat.text.schema,JSON.parse(body.contents[0].parts[0].text),body.generationConfig.maxOutputTokens);return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(value)}]}}]});};
 const gen=createReaderProvider({SHIQU_AI_PROVIDER:provider,GEMINI_API_KEY:'test-only',OPENAI_API_KEY:'test-only'},media,transport,runner).generator();
 assert.equal((await gen.review(selection,plan,original)).value.coverage.length,1);
 assert.equal((await gen.restructure(selection,plan,original,[issue])).value.edits.length,1);
 assert.ok(seen[0].schema.required.includes('coverage'));assert.equal(seen[0].payload.countPolicy,'adaptive');assert.equal(seen[0].payload.narrativeDetail,'detailed');
 assert.deepEqual(seen[1].schema.required,['edits']);if(provider!=='codex')assert.deepEqual(seen.map(x=>x.budget),[24000,16000]);
});
