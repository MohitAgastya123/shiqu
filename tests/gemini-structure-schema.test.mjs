// Exercise Gemini's production structural repair adapter and the unchanged local edit limits.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createReaderProvider} from '../server/generation.ts';
import {structuralEditsJson,applyStructuralEdits} from '../lib/reader-structure.ts';
import {geminiOutputSchema} from '../lib/reader-gemini-schema.ts';
import {readerStoryboardBatchSize} from '../lib/reader-limits.ts';
import {makePlan,selection as legacy} from './fixtures/production.mjs';

const selection={...legacy,length:'auto'},plan=makePlan(12),page=plan.pages[0];
const original={title:'测试原文',text:'甲贈物，乙沉默未接，然後轉身告辭。',url:'https://example.org/source',kind:'passage',provider:'fixture',retrievedAt:'2026-11-01'};
const issue={page:2,category:'progression',problem:'关键回应没有展开。',instruction:'在原第二幅前补回应。',requiresReplan:true};
function generator(answer,inspect=()=>{}){
 return createReaderProvider({SHIQU_AI_PROVIDER:'gemini',GEMINI_API_KEY:'controlled'},{},async(_url,init)=>{
  const body=JSON.parse(init.body);inspect(body.generationConfig.responseFormat.text.schema);
  return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(answer)}]}}]});
 }).generator();
}
const repair=gen=>gen.restructure(selection,plan,original,[issue]);

test('Gemini keeps structural repair counts in guidance and preserves the shared schema',async()=>{
 const shared=JSON.stringify(structuralEditsJson(12)),answer={characters:null,edits:[{from:2,to:2,pages:[page,page]}]};let sent;
 const result=await repair(generator(answer,schema=>{
  sent=schema;assert.equal(schema.properties.edits.maxItems,undefined);assert.match(schema.properties.edits.description,new RegExp(`At most ${readerStoryboardBatchSize} items`));
  const pages=schema.properties.edits.items.properties.pages;
  assert.equal(pages.maxItems,undefined);assert.match(pages.description,/At most 20 items/);
  assert.deepEqual(pages.items,geminiOutputSchema(structuralEditsJson(12).properties.edits.items.properties.pages.items));
 }));
 assert.equal(applyStructuralEdits(plan,result.value).plan.pages.length,13);
 assert.deepEqual(result.promptRecord.schema,sent);
 assert.equal(JSON.stringify(structuralEditsJson(12)),shared);
});

test('Gemini repairs still reject excessive edit counts, per-edit frames and combined frames locally',async()=>{
 for(const edits of [
  Array.from({length:readerStoryboardBatchSize+1},(_,i)=>({from:i+1,to:i,pages:[page]})),
  [{from:2,to:2,pages:Array(readerStoryboardBatchSize+1).fill(page)}],
 ])await assert.rejects(repair(generator({characters:null,edits})),error=>error.name==='ZodError');
 const edits=[{from:2,to:2,pages:Array(11).fill(page)},{from:3,to:3,pages:Array(10).fill(page)}];
 const result=await repair(generator({characters:null,edits})),before=structuredClone(plan);
 assert.throws(()=>applyStructuralEdits(plan,result.value),/INVALID_STRUCTURAL_EDIT/);
 assert.deepEqual(plan,before);
});
