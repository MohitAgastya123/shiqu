// Verify the real adapter boundaries with fake HTTP/CLI and privacy-limited usage events.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createReaderProvider} from '../server/generation.ts';
import {discoveryCode,DiscoveryFailure,discoveryUsage} from '../lib/reader-discovery-call.ts';
const stories=Array.from({length:4},(_,i)=>({id:String(i+1).repeat(64),title:'事件'+i,text:'PRIVATE_ORIGINAL_'+i+'，人物行动并解决问题。'}));
for(const provider of ['codex','gemini','openai'])test(`${provider}: wire IDs, partial parsing, capacity, prefix order and safe metrics`,async()=>{
 const events=[],requests=[];let result={matches:[{id:1,reason:'冲突依据甲',verdict:'yes'},{id:1,reason:'冲突依据乙',verdict:'no'},{id:2,reason:'合法依据',verdict:'yes'},{id:3,reason:'非法判定',verdict:'review'}]};
 const runner={status:async()=>({configured:true,model:'controlled'}),run:async job=>{requests.push({payload:JSON.parse(job.prompt),schema:job.schema});return {text:JSON.stringify(result),model:job.model||'controlled',usage:{inputTokens:11,outputTokens:7}};}};
 const transport=async(_url,init)=>{const body=JSON.parse(init.body),api=provider==='openai';requests.push({payload:JSON.parse(api?body.input[0].content:body.contents[0].parts[0].text),schema:api?body.text.format.schema:body.generationConfig.responseFormat.text.schema});return Response.json(api?{status:'completed',model:body.model,usage:{input_tokens:11,output_tokens:7},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(result)}]}]}:{candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(result)}]}}],usageMetadata:{promptTokenCount:11,candidatesTokenCount:7}});};
 const p=createReaderProvider({SHIQU_AI_PROVIDER:provider,OPENAI_API_KEY:'SECRET',GEMINI_API_KEY:'SECRET'}, {},transport,runner);
 const parsed=await p.matchStories('PRIVATE_THEME',stories,{onCall:e=>events.push(e)});assert.deepEqual(parsed.matches.map(m=>m.id),[stories[1].id]);
 assert.deepEqual(Object.keys(requests[0].payload),['stories','theme']);assert.deepEqual(requests[0].payload.stories.map(s=>s.id),[1,2,3,4]);assert.deepEqual(Object.keys(requests[0].schema.properties.matches.items.properties),['id','reason','verdict']);
 result={stories:[],note:'',scan:{blockComplete:true,pendingEvents:[],resolvedEventIds:[]}};
 await p.suggestions({bookId:'zhuangzi',theme:'PRIVATE_THEME'},['CHANGING_EXCLUSION'],{title:'原典',edition:'a'.repeat(64),text:'STABLE_TEXT',purpose:'catalog',scan:{maxStories:32,excludedSources:[],pendingEvents:[],contextText:'CHANGING_CONTEXT'}},{onCall:e=>events.push(e)});
 const serialized=JSON.stringify(requests[1].payload);assert.ok(serialized.indexOf('STABLE_TEXT')<serialized.indexOf('CHANGING_CONTEXT'));assert.ok(serialized.indexOf('STABLE_TEXT')<serialized.indexOf('CHANGING_EXCLUSION'));assert.equal(requests[1].schema.properties.stories.maxItems,32);
 assert.equal(events.length,2);assert.equal(events[0].acceptedCount,1);assert.equal(events[0].inputTokens,11);assert.equal(events[0].outputTokens,7);assert.ok(events.every(e=>e.durationMs>=0));assert.doesNotMatch(JSON.stringify(events),/PRIVATE_|SECRET|CHANGING_/);
});
test('unknown usage stays unknown; only recognized content failures are isolatable',()=>{
 assert.deepEqual(discoveryUsage(null),{inputTokens:null,outputTokens:null});assert.equal(discoveryCode(new TypeError('network secret')),'service');assert.equal(discoveryCode(new DiscoveryFailure('refused')),'refused');assert.equal(discoveryCode(new SyntaxError('body')),'invalid-output');assert.equal(discoveryCode({message:'TIMEOUT',inferenceStarted:false}),'service');assert.equal(discoveryCode({message:'TIMEOUT',inferenceStarted:true}),'timeout');
});
