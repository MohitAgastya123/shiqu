// Verify offline gate ordering and recovery without paying providers or touching the library.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrameCountGate,matchesEvaluationModel} from '../scripts/storyboard-evaluation.mjs';
const plan={title:'旧稿',pages:[{}]},selection={length:'auto'},original={text:'甲说话，乙停住。'};
const req={page:1,quote:'乙停住',task:'回应',captionEvidence:'只有结果',visualEvidence:'甲说话',loss:'乙的承受被省略',instruction:'补回应'};
const change={frameCountReview:{decision:'expand',proposedCount:2,reason:'补回应'},requirements:[req]};
const keep={frameCountReview:{decision:'keep',proposedCount:1,reason:'任务已全'},requirements:[]};
const full={issues:[],titleReview:{title:'旧稿',reason:'适当'},coverage:[]};
const generated=value=>({value,model:'fixture',usage:null});
function fixture(){let saved;const calls=[];let count=change;let fail=false;const base={reviewFrameCount:async()=>{calls.push('frames');return generated(count);},review:async()=>{calls.push('full');if(fail)throw Error('interrupted');return generated(full);},restructure:async(...args)=>{calls.push(['structure',args[5]]);return generated({edits:[]});},repair:async()=>calls.push('local')};return {calls,base,get saved(){return saved;},setCount:v=>{count=v;},setFail:v=>{fail=v;},options:()=>({binding:'fixture-binding',checkpoint:saved,save:async v=>{saved=v;}})};}
test('frames changes trigger structure with complete requirements, then keep permits the original full audit',async()=>{
 const f=fixture(),g=createFrameCountGate(f.base,f.options());const result=await g.review(selection,plan,original);
 assert.equal(f.calls[0],'frames');assert.ok(result.value.issues[0].requiresReplan);
 await g.restructure(selection,plan,original,result.value.issues,result.value.coverage);
 assert.deepEqual(f.calls[1][1].requirements,[req]);
 const edited={...plan,pages:[{},{}]};f.setCount({...keep,frameCountReview:{...keep.frameCountReview,proposedCount:2}});
 await g.review(selection,edited,original);assert.deepEqual(f.calls.slice(2),['frames','full']);assert.equal(f.saved.phase,'full');
 await g.repair();assert.equal(f.saved.phase,'full');
 await g.restructure(selection,edited,original,[{requiresReplan:true}],[]);assert.equal(f.saved.phase,'frames');
});
test('saved count acceptance survives an interrupted full audit, and changed bindings are rejected',async()=>{
 const f=fixture();f.setCount(keep);f.setFail(true);const g=createFrameCountGate(f.base,f.options());
 await assert.rejects(()=>g.review(selection,plan,original),/interrupted/);assert.equal(f.saved.phase,'full');
 f.setFail(false);await createFrameCountGate(f.base,f.options()).review(selection,plan,original);
 assert.deepEqual(f.calls,['frames','full','full']);
 await createFrameCountGate(f.base,f.options()).review(selection,plan,original);assert.equal(f.calls.length,3);
 assert.throws(()=>createFrameCountGate(f.base,{...f.options(),binding:'changed'}),/BINDING/);
});
test('illegal count results stop before full audit; the dedicated gate is required',async()=>{
 const f=fixture();f.setCount({...keep,requirements:[req]});
 await assert.rejects(()=>createFrameCountGate(f.base,f.options()).review(selection,plan,original),/SCOPE/);assert.deepEqual(f.calls,['frames']);
 assert.throws(()=>createFrameCountGate({...f.base,reviewFrameCount:undefined},f.options()),/REQUIRED/);
});
test('raw receipt reuse requires the resolved model, including across probe/run directories',()=>{
 assert.ok(matchesEvaluationModel({model:'model-a'},'model-a'));
 for(const receipt of [{model:'model-b'},{},null])assert.equal(matchesEvaluationModel(receipt,'model-a'),false);
 assert.equal(matchesEvaluationModel({model:undefined},undefined),false);
});
