// Isolate evaluation data and bind exact request receipts to their inputs and model.
// Review sequencing and paid checkpoints belong to the production engine, never this tool.
import {createHash} from 'node:crypto';
import {ownDesktopData} from '../server/desktop-owner.ts';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {newReview} from '../lib/reader-review.ts';
import {planSchema} from '../lib/reader-model.ts';
import {readerMaxAutomaticRepairs} from '../lib/reader-limits.ts';

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const matchesEvaluationModel=(receipt,model)=>typeof model==='string'&&!!model&&receipt?.model===model;

// Freeze exact native request/receipt pairs; never choose a receipt by its editorial verdict.
export function evaluationReplayKey(job,model){
 if(!model||job.model!==undefined&&job.model!==model)throw Error('EVALUATION_REPLAY_MODEL');
 if(job.image||job.generateImage)throw Error('EVALUATION_NO_MEDIA');
 const request={...job};delete request.model;return hash({...request,model});
}
export function failedEvaluationReceipts(result){
 const calls=result.calls||[],failures=result.failures||[],rejected=[];
 for(const failure of failures){
  if(failure.error!=='EDITORIAL_SOURCE_QUOTE')continue;
  let call;
  if(failure.requestId&&failure.hash)call=calls.find(c=>c.requestId===failure.requestId&&c.hash===failure.hash&&c.step===failure.step);
  else if(failure===failures.at(-1)&&result.state==='failed'&&result.error&&calls.at(-1)?.step===failure.step)call=calls.at(-1);
  if(!call?.requestId||!call.hash)throw Error('EVALUATION_FAILURE_RECEIPT_AMBIGUOUS');
  rejected.push({jobHash:call.hash,requestId:call.requestId,reason:failure.error});
 }
 return rejected;
}
export async function collectEvaluationReplays(directory,model,excluded=[]){
 const rejected=new Map(excluded.map(value=>[value.requestId,value])),entries=[],receipts=new Map();
 async function collect(folder){
  for(const file of (await readdir(folder,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
   const location=folder+'/'+file.name;
   if(file.isSymbolicLink())throw Error('EVALUATION_REPLAY_SYMLINK');
   if(file.isDirectory()){await collect(location);continue;}
   if(!file.name.endsWith('-request.json'))continue;
   const requestRaw=await readFile(location,'utf8'),request=JSON.parse(requestRaw),receiptFile=location.replace(/-request\.json$/,'-receipt.json');let receiptRaw;
   try{receiptRaw=await readFile(receiptFile,'utf8');}catch(error){if(error.code==='ENOENT')continue;throw error;}
   const receipt=JSON.parse(receiptRaw);
   if(!request.job||request.job.model!==model||!matchesEvaluationModel(receipt,model)||!receipt.requestId||typeof receipt.text!=='string')throw Error('EVALUATION_REPLAY_MODEL');
   if(receipt.image)throw Error('EVALUATION_NO_MEDIA');
   const unpinned={...request.job};delete unpinned.model;
   const jobHashes=[hash(request.job),hash(unpinned)],key=evaluationReplayKey(request.job,model),entry={request:location,receipt:receiptFile,key,requestHash:createHash('sha256').update(requestRaw).digest('hex'),receiptHash:createHash('sha256').update(receiptRaw).digest('hex'),requestId:receipt.requestId,...(rejected.has(receipt.requestId)?{excluded:rejected.get(receipt.requestId).reason}:{})};
   entries.push(entry);
   if(entry.excluded)continue;
   const previous=receipts.get(key);
   if(previous&&previous.entry.receiptHash!==entry.receiptHash)throw Error('EVALUATION_REPLAY_AMBIGUOUS');
   receipts.set(key,{entry,receipt,jobHashes});
  }
 }
 await collect(directory);
 return {manifest:{directory,model,entries},get(job){const value=receipts.get(evaluationReplayKey(job,model));return value?structuredClone(value):undefined;},hasRecordedEntry(calls){return [...receipts.values()].some(value=>calls.some(call=>call.cached&&call.model===model&&call.requestId===value.receipt.requestId&&value.jobHashes.includes(call.hash)&&call.cachedFrom?.includes(value.entry.receipt)));}};
}
// Entry proof belongs to the persisted branch, not to each new runner process.
export function evaluationReplayForJob(replay,calls,job){
 if(!replay)return undefined;
 const paid=replay.get(job);
 if(!replay.hasRecordedEntry(calls)&&!paid)throw Error('EVALUATION_REPLAY_FIRST_MISS');
 return paid;
}

// Write raw receipt history before returning a model result; engine usage records successful checkpoints.
export function openEvaluationHistory(directory){
 let saved;
 for(const file of ['text-history.json','result.json']){
  try{saved=JSON.parse(readFileSync(directory+'/'+file,'utf8'));break;}catch(error){if(error.code!=='ENOENT')throw error;}
 }
 const calls=structuredClone(saved?.calls||[]),failures=structuredClone(saved?.failures||[]);
 if(!Array.isArray(calls)||!Array.isArray(failures))throw Error('EVALUATION_HISTORY_INVALID');
 const persist=()=>{const file=directory+'/text-history.json';writeFileSync(file+'.tmp',JSON.stringify({calls,failures},null,2));renameSync(file+'.tmp',file);};
 return {calls,failures,receipt(value){calls.push(value);persist();},failure(value){failures.push(value);persist();}};
}
export function evaluationHistoryTotals(result){
 const receiptIds=[...new Set([...(result.lineage?.previousReceiptIds||[]),...(result.calls||[]).map(call=>call.requestId||call.hash)])];
 return {receiptIds,textReceipts:receiptIds.length,failures:(result.lineage?.previousFailures||0)+(result.failures||[]).length};
}

// Re-audit a stable system draft without inheriting its verdict or resetting the repair budget.
export function continueEvaluationDocument(input,parentInput,parent){
 if(!parentInput||!parent||input.id!==parentInput.id||!isDeepStrictEqual(input.selection,parentInput.selection)||!isDeepStrictEqual(input.original,parent.original)||!isDeepStrictEqual(input.original,parentInput.original))throw Error('EVALUATION_PARENT_MISMATCH');
 planSchema.parse(parent.plan);
 const previous=parent.visualReview;
 if(!previous||!Number.isInteger(previous.repairs)||previous.repairs<0||previous.repairs>readerMaxAutomaticRepairs||!Number.isInteger(previous.round)||previous.round<0||!Array.isArray(parent.usage)||!Array.isArray(parent.images)||previous.history&&!Array.isArray(previous.history))throw Error('EVALUATION_PARENT_REVIEW');
 return {plan:structuredClone(parent.plan),original:structuredClone(parent.original),images:structuredClone(parent.images),audio:[],usage:structuredClone(parent.usage),frameCountConfirmed:true,frameRecommendation:structuredClone(input.frameRecommendation),visualReview:{...newReview(),round:previous.round,repairs:previous.repairs,history:structuredClone(previous.history||[])}};
}

// A dead runner's isolated DB lock may be cleared only after obtaining exclusive ownership.
export async function acquireEvaluationRun(directory){
 let unlock;try{unlock=await ownDesktopData(directory);}catch(error){if(error.message==='DATA_BUSY')throw Error('EVALUATION_RUN_ACTIVE');throw error;}
 let active=true;
 return {
  async bind(binding,metadata){
   if(!active||!binding)throw Error('EVALUATION_RUN_RELEASED');
   const manifest=directory+'/source-manifest.json';let saved;
   try{saved=JSON.parse(await readFile(manifest,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
   if(saved){if(saved.binding!==binding)throw Error('EVALUATION_BINDING_MISMATCH');return saved;}
   // Never adopt an earlier manifest-less batch and relabel its provenance.
   try{await readFile(directory+'/inputs.json');throw Error('EVALUATION_MANIFEST_REQUIRED');}catch(error){if(error.code!=='ENOENT')throw error;}
   const value={...metadata,binding};await writeFile(manifest,JSON.stringify(value,null,2),{flag:'wx'});return value;
  },
  async recover(database,owner){
   if(!active)throw Error('EVALUATION_RUN_RELEASED');
   return database.prepare("UPDATE reader_sessions SET state='idle',lock_token=NULL,lock_until=0,error=NULL WHERE user_id=? AND state='running'").bind(owner).run();
  },
  async release(){if(active){active=false;await unlock();}},
 };
}
