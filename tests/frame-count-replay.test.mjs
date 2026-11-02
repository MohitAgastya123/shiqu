// Replay paid native audits only for exact requests; retain rejected receipts as evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {collectEvaluationReplays,evaluationReplayKey,failedEvaluationReceipts,evaluationReplayForJob,openEvaluationHistory} from '../scripts/storyboard-evaluation.mjs';
const model='controlled',job={instructions:'Read the supplied source.',prompt:'{"plan":"original"}',schema:{type:'object',properties:{answer:{type:'string'}},required:['answer'],additionalProperties:false},timeoutMs:1000,reasoningEffort:'high'};
async function fixture(t){const directory=await mkdtemp(join(tmpdir(),'frame-replays-'));t.after(()=>rm(directory,{recursive:true,force:true}));return directory;}
async function pair(directory,name,request=job,receipt={text:'{"answer":"checked"}',model,requestId:name,image:null}){
 await mkdir(directory,{recursive:true});await writeFile(join(directory,name+'-request.json'),JSON.stringify({job:{...request,model:request.model??model}}));await writeFile(join(directory,name+'-receipt.json'),JSON.stringify(receipt));return receipt;
}
test('replay freezes every pair and requires the complete job and resolved model',async t=>{
 const directory=await fixture(t);await pair(join(directory,'nested'),'a');
 const replay=await collectEvaluationReplays(directory,model);assert.equal(replay.manifest.entries.length,1);assert.equal(replay.get(job).receipt.requestId,'a');assert.equal(replay.get({...job,model}).receipt.requestId,'a');
 for(const change of [{prompt:'changed'},{instructions:'changed'},{schema:{type:'string'}},{timeoutMs:2000},{reasoningEffort:'low'}])assert.equal(replay.get({...job,...change}),undefined);
 assert.throws(()=>evaluationReplayKey({...job,model:'other'},model),/MODEL/);assert.throws(()=>evaluationReplayKey({...job,generateImage:true},model),/NO_MEDIA/);
 await writeFile(join(directory,'nested/a-receipt.json'),'changed after collection');assert.equal(replay.get(job).receipt.text,'{"answer":"checked"}');
 const returned=replay.get(job);returned.receipt.text='mutated';assert.equal(replay.get(job).receipt.text,'{"answer":"checked"}');
});
test('replay rejects requested or actual model mismatches',async t=>{
 const a=await fixture(t);await pair(a,'a',{...job,model:'other'});await assert.rejects(()=>collectEvaluationReplays(a,model),/MODEL/);
 const b=await fixture(t);await pair(b,'b',job,{text:'{}',model:'other',requestId:'b'});await assert.rejects(()=>collectEvaluationReplays(b,model),/MODEL/);
});
test('different receipts for one exact request are ambiguous regardless of editorial verdict',async t=>{
 const directory=await fixture(t);await pair(directory,'a',job,{text:'{"issues":[]}',model,requestId:'a'});await pair(directory,'b',job,{text:'{"issues":["missing action"]}',model,requestId:'b'});
 await assert.rejects(()=>collectEvaluationReplays(directory,model),/AMBIGUOUS/);
});
test('only the receipt linked to an explicit output failure is excluded, not its job or a timeout predecessor',async t=>{
 const old={step:'review:3',hash:'old-job',requestId:'old'},count={step:'review:3',hash:'count-job',requestId:'count'};
 const parent={state:'failed',error:'Invalid source quote',calls:[count,old],failures:[{step:'review:3',error:'EDITORIAL_SOURCE_QUOTE'}]};
 const excluded=failedEvaluationReceipts(parent);assert.deepEqual(excluded,[{jobHash:'old-job',requestId:'old',reason:'EDITORIAL_SOURCE_QUOTE'}]);
 assert.deepEqual(failedEvaluationReceipts({...parent,failures:[{step:'review:3',error:'TIMEOUT'}]}),[]);
 assert.throws(()=>failedEvaluationReceipts({...parent,failures:[{step:'review:4',error:'EDITORIAL_SOURCE_QUOTE'}]}),/AMBIGUOUS/);
 const directory=await fixture(t);await pair(directory,'old',job,{text:'invalid quote',model,requestId:'old'});await pair(directory,'new',job,{text:'valid quote',model,requestId:'new'});
 const replay=await collectEvaluationReplays(directory,model,excluded);assert.equal(replay.get(job).receipt.requestId,'new');assert.equal(replay.manifest.entries.find(e=>e.requestId==='old').excluded,'EDITORIAL_SOURCE_QUOTE');
});
test('explicit failure identity stays tied to its recorded call even after later calls',()=>{
 const bad={step:'review:1',hash:'bad-job',requestId:'bad'},later={step:'review:2',hash:'good-job',requestId:'good'};
 assert.equal(failedEvaluationReceipts({calls:[bad,later],failures:[{...bad,error:'EDITORIAL_SOURCE_QUOTE'}]})[0].requestId,'bad');
 assert.throws(()=>failedEvaluationReceipts({calls:[bad],failures:[{...bad,requestId:'invented',error:'EDITORIAL_SOURCE_QUOTE'}]}),/AMBIGUOUS/);
});
test('persisted exact entry proof permits restart into structure and full jobs, while forged proof does not',async t=>{
 const directory=await fixture(t);await pair(directory,'entry');let replay=await collectEvaluationReplays(directory,model);
 const historyDirectory=join(directory,'history');await mkdir(historyDirectory);let history=openEvaluationHistory(historyDirectory);
 const structure={...job,instructions:'Repair the audited structure.'},full={...job,instructions:'Review all facts and continuity.'};
 assert.throws(()=>evaluationReplayForJob(replay,history.calls,structure),/FIRST_MISS/);
 const entry=evaluationReplayForJob(replay,history.calls,job);history.receipt({hash:createHash('sha256').update(JSON.stringify(job)).digest('hex'),cached:true,cachedFrom:[entry.entry.receipt],model,requestId:entry.receipt.requestId});
 replay=await collectEvaluationReplays(directory,model);history=openEvaluationHistory(historyDirectory);
 assert.equal(evaluationReplayForJob(replay,history.calls,structure),undefined);assert.equal(evaluationReplayForJob(replay,history.calls,full),undefined);
 for(const change of [{hash:'different'},{model:'other'},{requestId:'other'},{cached:false},{cachedFrom:['elsewhere']}])assert.throws(()=>evaluationReplayForJob(replay,[{...history.calls[0],...change}],structure),/FIRST_MISS/);
});
