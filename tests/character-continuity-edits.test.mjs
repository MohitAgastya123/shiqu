// Global continuity repairs may update characters without falsifying correct frames or losing provenance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {applyStructuralEdits,structuralEditsSchema} from '../lib/reader-structure.ts';
import {reviewReportSchema} from '../lib/reader-review.ts';
import {reusableRevisionImages} from '../lib/reader-revision-images.ts';
import {createReaderProvider} from '../server/generation.ts';
import {makePlan,selection as legacy} from './fixtures/production.mjs';
const characters='The same young scholar wears the original blue robe; the mark is present before wiping and absent after wiping, as each frame specifies.';
const issue={page:2,category:'continuity',problem:'全局人物说明的擦净幅号与正确画幅矛盾。',instruction:'只修characters，保持正确画幅。',requiresReplan:true};
test('character-only edits keep frame and progress identities, invalidate global drawing inputs and retain other metadata',()=>{
 const plan=makePlan(3),before=structuredClone(plan),result=applyStructuralEdits(plan,{edits:[],characters});
 assert.ok(result.changed);assert.deepEqual(result.plan.pages,plan.pages);assert.equal(result.plan.title,plan.title);assert.equal(result.plan.reflection,plan.reflection);assert.equal(result.previousCharacters,plan.characters);assert.equal(result.characters,characters);assert.deepEqual(result.sourcePages,[0,1,2]);assert.deepEqual(result.progressMap,[0,1,2]);assert.deepEqual(result.removed,[]);assert.deepEqual(plan,before);
 assert.deepEqual(reusableRevisionImages({selection:legacy,plan,images:['A','B','C']},legacy,result.plan,result.sourcePages),['','','']);
 assert.equal(applyStructuralEdits(plan,{edits:[],characters:plan.characters}).changed,false);
 for(const value of [{edits:[]},{edits:[],characters:null},{edits:[],characters:'short'},{edits:[],characters,title:'不可修改'}])assert.equal(structuralEditsSchema.safeParse(value).success,false);
 assert.ok(structuralEditsSchema.parse({edits:[{from:2,to:2,pages:[plan.pages[1]]}]}),'Old edits-only receipts remain valid');
 assert.ok(reviewReportSchema(3).parse({titleReview:{title:plan.title,reason:'保留'},issues:[issue]}));
});
for(const provider of ['codex','gemini','openai'])test(`${provider}: global characters-only repair keeps the existing text-stage budget`,async()=>{
 let schema;const runner={status:async()=>({configured:true}),run:async job=>{schema=job.schema;return {text:JSON.stringify({edits:[],characters}),model:'controlled',requestId:'fixture',usage:null};}};
 const transport=async(_url,options)=>{const b=JSON.parse(options.body);schema=provider==='openai'?b.text.format.schema:b.generationConfig.responseFormat.text.schema;return Response.json(provider==='openai'?{status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({edits:[],characters})}]}]}:{candidates:[{content:{parts:[{text:JSON.stringify({edits:[],characters})}]}}]});};
 const gen=createReaderProvider({SHIQU_AI_PROVIDER:provider,OPENAI_API_KEY:'fixture',GEMINI_API_KEY:'fixture'},{},transport,runner).generator();
 const result=await gen.restructure({...legacy,length:'auto'},makePlan(3),{title:'原文',text:'甲看见红印，乙随后擦净。'},[issue]);assert.equal(result.value.characters,characters);assert.deepEqual(result.value.edits,[]);assert.equal(schema.properties.edits.minItems,0);assert.ok(schema.properties.characters);assert.deepEqual([...schema.required].sort(),Object.keys(schema.properties).sort());
});
