// English production expectations; original evidence and historical hashes remain unchanged.
// Require a consistent count decision backed by concrete structural issues, while reading historical reports unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import {frameCountReviewSchema,frameRequirementSchema,reviewReportSchema,parseFrameCountReport,reviewSystemPrompt,frameCountReviewDirection} from '../lib/reader-review.ts';
import {validateEditorialCoverage} from '../lib/reader-editorial.ts';
import {createReaderProvider} from '../server/generation.ts';
import {makePlan,selection as legacy} from './fixtures/production.mjs';
import {geminiEvidenceAnswer} from './fixtures/gemini-evidence.mjs';
import {storyScopeDirection} from '../lib/reader-prompts.ts';
import {withLocalBooks} from '../server/local-generation.ts';
const issue={page:2,category:'progression',problem:'先后回应被挤在同幅。',instruction:'给听者的回应独立画幅。',requiresReplan:true};
const titleReview={title:'原文故事',reason:'范围准确'};
const requirement={page:2,quote:'乙未接',task:'接受者的拒绝',captionEvidence:'配文说没有接受',visualEvidence:'画面只有送礼者',loss:'听者如何承受没有被表现',instruction:'补听者未伸手的回应。'};
test('the dedicated gate derives unambiguous issues and keeps full requirements when one frame has multiple losses',()=>{
 const keep={frameCountReview:{decision:'keep',proposedCount:3,reason:'任务空间充分。'},requirements:[]};
 assert.equal(parseFrameCountReport(3,keep).issues.length,0);assert.throws(()=>parseFrameCountReport(3,{...keep,frameCountReview:undefined}));
 assert.throws(()=>parseFrameCountReport(3,{...keep,requirements:[requirement]}),/SCOPE/);
 const changed=parseFrameCountReport(3,{frameCountReview:{decision:'expand',proposedCount:4,reason:'给回应提供空间。'},requirements:[requirement,{...requirement,task:'随后退让',loss:'后续退让被省略',instruction:'接续退让。'}]});
 assert.equal(changed.requirements.length,2);assert.equal(changed.issues.length,1);assert.ok(changed.issues[0].requiresReplan);assert.deepEqual(changed.coverage.map(c=>c.issuePage),[2,2]);
 assert.throws(()=>parseFrameCountReport(3,{frameCountReview:changed.frameCountReview,requirements:[{...requirement,page:4}]}));
 assert.throws(()=>validateEditorialCoverage([{...changed.coverage[0],quote:'甲赠物……乙未接'}],{text:'甲赠物，中间说话，乙未接。'}),/SOURCE_QUOTE/);
});
test('count verdicts respect the current count, direction, bounds and corresponding structural issues',()=>{
 assert.ok(frameRequirementSchema(3).parse({...requirement,task:'作'.repeat(120)}));
 assert.equal(frameRequirementSchema(3).safeParse({...requirement,task:'作'.repeat(121)}).success,false);
 for(const value of [{decision:'keep',proposedCount:3},{decision:'expand',proposedCount:4},{decision:'reduce',proposedCount:2},{decision:'redistribute',proposedCount:3}])assert.ok(frameCountReviewSchema(3).parse({...value,reason:'按原文的不同任务分配。'}));
 for(const value of [{decision:'keep',proposedCount:4},{decision:'expand',proposedCount:3},{decision:'reduce',proposedCount:4},{decision:'redistribute',proposedCount:2},{decision:'expand',proposedCount:81},{decision:'reduce',proposedCount:0}])assert.equal(frameCountReviewSchema(3).safeParse({...value,reason:'无效'}).success,false);
 const expanded={decision:'expand',proposedCount:4,reason:'为不同回应提供空间。'},keep={decision:'keep',proposedCount:3,reason:'现有空间充分。'};
 assert.ok(reviewReportSchema(3).parse({titleReview,issues:[issue],frameCountReview:expanded}));
 assert.equal(reviewReportSchema(3).safeParse({titleReview,issues:[],frameCountReview:expanded}).success,false);
 assert.equal(reviewReportSchema(3).safeParse({titleReview,issues:[issue],frameCountReview:keep}).success,false);
 assert.ok(reviewReportSchema(3).parse({titleReview,issues:[]}),'Historical reports have no mandatory new field');
});
test('the original audit remains intact and the appended count audit follows the requested four-step order',()=>{
 const steps=['1. Read the complete original','2. Locate each task','3. Identify actual compression losses','4. Turn each omission'];
 const positions=steps.map(text=>frameCountReviewDirection.indexOf(text));assert.ok(positions.every((p,i)=>p>=0&&(!i||p>positions[i-1])));
 assert.match(reviewSystemPrompt,/Compare adjacent frames/);assert.match(reviewSystemPrompt,/Ending standards/);assert.match(frameCountReviewDirection,/never choose a desired total and invent content/);assert.match(frameCountReviewDirection,/poems and reported stories/);assert.match(frameCountReviewDirection,/list of conclusions does not express several layers/);assert.match(frameCountReviewDirection,/combine, delete or redistribute/);assert.match(frameCountReviewDirection,/excludes a cover or separately displayed plan\.reflection/);
});
for(const provider of ['codex','gemini','openai'])test(`${provider}: automatic audit requires count decision without changing review effort or budget`,async()=>{
 const selection={...legacy,length:'auto',narrativeDetail:'balanced'},plan=makePlan(3),original={title:'原文',text:'甲赠物，乙未接，稍后转身离去。',url:'https://example.org',kind:'passage',provider:'fixture',retrievedAt:'2026-11-01'};
 let captured;const answer=(schema,payload,effort,budget)=>{captured={schema,payload,effort,budget};return {requirements:[requirement],frameCountReview:{decision:'expand',proposedCount:4,reason:'补回未接受的回应。'}};};
 const runner={status:async()=>({configured:true}),run:async job=>({text:JSON.stringify(answer(job.schema,JSON.parse(job.prompt),job.reasoningEffort)),model:'controlled',requestId:'fixture',usage:null,image:null})};
 const transport=async(_url,options)=>{const b=JSON.parse(options.body);const value=provider==='openai'?answer(b.text.format.schema,JSON.parse(b.input[0].content),b.reasoning.effort,b.max_output_tokens):answer(b.generationConfig.responseFormat.text.schema,JSON.parse(b.contents[0].parts[0].text),b.generationConfig.thinkingConfig.thinkingLevel,b.generationConfig.maxOutputTokens);return Response.json(provider==='openai'?{status:'completed',id:'fixture',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]}:{candidates:[{content:{parts:[{text:JSON.stringify(geminiEvidenceAnswer(value,captured.payload,captured.schema))}]}}]});};
 const gen=createReaderProvider({SHIQU_AI_PROVIDER:provider,GEMINI_API_KEY:'controlled',OPENAI_API_KEY:'controlled'}, {},transport,runner).generator();
 assert.equal((await gen.reviewFrameCount(selection,plan,original)).value.frameCountReview.proposedCount,4);assert.ok(captured.schema.required.includes('frameCountReview'));assert.equal(captured.payload.countPolicy,'adaptive');
 assert.ok(['high','HIGH'].includes(captured.effort));if(provider!=='codex')assert.equal(captured.budget,24000);
});
test('local count audits reject mismatched saved source before invoking the provider',async()=>{
 let calls=0;const raw={generator:()=>({reviewFrameCount:async()=>{calls++;return {value:{}};}})};
 const generator=withLocalBooks(raw,{},{}).generator();
 const source={edition:'edition',sectionId:'honglou-003',firstUnit:'honglou-003-001',lastUnit:'honglou-003-002'};
 await assert.rejects(()=>generator.reviewFrameCount({...legacy,bookId:'红楼梦',length:'auto',source},makePlan(3),{text:'原文',localSource:{...source,sectionId:'honglou-004'}}),/not been verified locally/);
 assert.equal(calls,0);
});
test('structure revision receives every complete requirement, while the recommendation remains advisory',async()=>{
 let payload,instructions;const gen=(await import('../lib/reader-review.ts')).storyboardReviewGenerator(async(_task,direction,input)=>{payload=input;instructions=direction;return {value:{edits:[{from:2,to:2,pages:[]}]},model:'fixture',usage:null};});
 const context={frameCountReview:{decision:'expand',proposedCount:4,reason:'回应需要空间'},requirements:[requirement,{...requirement,task:'第二层承受',instruction:'保留完整第二项，不得被合并字数截断。'}]};
 await gen.restructure({...legacy,length:'auto'},makePlan(3),{title:'原文',text:'甲赠物，乙未接。'},[issue],[],context);
 assert.deepEqual(payload.frameCountContext,context);assert.match(instructions,/proposed count is guidance/);
});

test('count and full audits reuse the same story scope instead of divergent title-based boundaries',async()=>{
 const {storyboardReviewGenerator}=await import('../lib/reader-review.ts');const directions=[];let count=true;
 const gen=storyboardReviewGenerator(async(_task,direction)=>{directions.push(direction);return {value:count?{frameCountReview:{decision:'keep',proposedCount:3,reason:'任务足够'},requirements:[]}:{titleReview,issues:[],coverage:[{quote:'乙未接',task:'回应',pages:[2],assessment:'adequate',reason:'已有',issuePage:0}]},model:'fixture',usage:null};});
 const s={...legacy,length:'auto'},p=makePlan(3),o={title:'原文',text:'甲赠物，乙未接。'};await gen.reviewFrameCount(s,p,o);count=false;await gen.review(s,p,o);
 assert.ok(directions.every(d=>d.includes(storyScopeDirection)));assert.ok(directions[1].includes('bodily and environmental conditions'));assert.ok(directions.every(d=>d.includes('shared reactions can reveal relationships')&&d.includes('identity, hierarchy or constraints')&&d.includes('A distinct role does not require its own frame')));
});
