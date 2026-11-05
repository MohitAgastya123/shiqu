// Exercise Argon's combined thinking/output budget through the production adapter and validators.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createReaderProvider} from '../server/generation.ts';
import {makePlan,selection as legacy} from './fixtures/production.mjs';

const selection={...legacy,length:'auto'};
const original={title:'原文',text:'庄周梦为蝴蝶，醒来又是庄周。',url:'',kind:'passage',provider:'fixture',retrievedAt:'2026-11-05'};
const plan=makePlan(3),{pages,reflection:_,...metadata}=plan;
const outline={...metadata,beats:pages.map(()=> '庄周醒来，核对梦与醒的处境。')};
function provider(model,transport,effort='high'){
 return createReaderProvider({SHIQU_AI_PROVIDER:'gemini',GEMINI_API_KEY:'controlled',GEMINI_TEXT_MODEL:model,SHIQU_REASONING_OUTLINE:effort},{},transport).generator();
}

test('Argon high thinking has answer room while Flash, lower effort and larger task budgets stay unchanged',async()=>{
 const seen=[],failure=new Error('controlled request probe');
 const transport=async(_url,options)=>{seen.push(JSON.parse(options.body).generationConfig);throw failure;};
 const argon=provider('gemini-4-argon',transport),flash=provider('gemini-3.8-flash',transport);
 for(const call of [
  ()=>argon.outline(selection,'fixture',original),
  ()=>flash.outline(selection,'fixture',original),
  ()=>provider('gemini-4-argon',transport,'medium').outline(selection,'fixture',original),
  ()=>argon.plan(selection,'fixture',original),
  ()=>argon.planBatch(selection,'fixture',{outline,pages:[]},original),
  ()=>argon.reflectionCandidates(selection,plan,original),
  ()=>argon.reviewFrameCount(selection,plan,original),
  ()=>argon.review(selection,plan,original),
 ])await assert.rejects(call,error=>error===failure);
 assert.deepEqual(seen.map(config=>config.maxOutputTokens),[32768,8192,8192,64000,32768,32768,32768,32768]);
 assert.deepEqual(seen[0].responseFormat,seen[1].responseFormat,'Only the token allocation changes');
 assert.equal(seen[0].thinkingConfig.thinkingLevel,'HIGH');assert.equal(seen[2].thinkingConfig.thinkingLevel,'MEDIUM');
});

test('Argon still rejects incomplete answers and oversized outlines after increasing its token budget',async()=>{
 let response={finishReason:'MAX_TOKENS',content:{parts:[{text:JSON.stringify(outline)}]}};
 const gen=provider('gemini-4-argon',async()=>Response.json({candidates:[response]}));
 await assert.rejects(gen.outline(selection,'fixture',original),error=>error.message==='INCOMPLETE_RESPONSE');
 response={finishReason:'STOP',content:{parts:[{text:JSON.stringify({...outline,beats:Array(81).fill(outline.beats[0])})}]}};
 await assert.rejects(gen.outline(selection,'fixture',original),error=>error.name==='ZodError');
 response={finishReason:'STOP',content:{parts:[{text:JSON.stringify(outline)}]}};
 assert.deepEqual((await gen.outline(selection,'fixture',original)).value,outline);
});
