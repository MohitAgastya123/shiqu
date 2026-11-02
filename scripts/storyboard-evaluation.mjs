// Offline-only two-gate evaluation. Bind checkpoints to inputs/config/prompts and retain paid results;
// the application engine and bookshelf do not opt into this adapter.
import {createHash} from 'node:crypto';
import {ownDesktopData} from '../server/desktop-owner.ts';
import {readFile,writeFile} from 'node:fs/promises';
import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {parseFrameCountReport,newReview} from '../lib/reader-review.ts';
import {planSchema} from '../lib/reader-model.ts';
import {readerMaxAutomaticRepairs} from '../lib/reader-limits.ts';
import {validateEditorialCoverage} from '../lib/reader-editorial.ts';

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const matchesEvaluationModel=(receipt,model)=>typeof model==='string'&&!!model&&receipt?.model===model;

// Write receipt history before returning a model result, including count-keep calls absent from engine usage.
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
export function createFrameCountGate(base,{binding,checkpoint,save}){
 if(!binding||!save||!base.reviewFrameCount||!base.review||!base.restructure)throw Error('EVALUATION_GATE_REQUIRED');
 const state=checkpoint||{binding,phase:'frames',reports:[]};
 if(state.binding!==binding||!['frames','full'].includes(state.phase)||!Array.isArray(state.reports))throw Error('EVALUATION_BINDING_MISMATCH');
 async function record(phase,args,call){
  const key=hash([binding,phase,args]);const previous=state.reports.find(r=>r.key===key);
  if(previous)return previous.generated;
  const generated=await call();state.reports.push({key,phase,generated});await save(structuredClone(state));return generated;
 }
 return {...base,
  async review(selection,plan,original,outline,candidates){
   if(state.phase==='frames'){
    const generated=await record('frames',[selection,plan,original],()=>base.reviewFrameCount(selection,plan,original));
    const report=parseFrameCountReport(plan.pages.length,{frameCountReview:generated.value.frameCountReview,requirements:generated.value.requirements});
    validateEditorialCoverage(report.coverage,original);
    if(report.issues.length){
     // Archived v1 inputs have a selected ending, rather than pending ending candidates.
     if(candidates)throw Error('EVALUATION_SELECTED_ENDING_REQUIRED');
     return {...generated,value:{...report,titleReview:{title:plan.title,reason:'数量审核保留标题；标题尚待原全面审核。'}}};
    }
    state.phase='full';await save(structuredClone(state));
   }
   return record('full',[selection,plan,original,outline,candidates],()=>base.review(selection,plan,original,outline,candidates));
  },
  async restructure(selection,plan,original,issues,coverage){
   const key=hash([binding,'frames',[selection,plan,original]]);
   const raw=state.phase==='frames'?state.reports.find(r=>r.key===key)?.generated.value:undefined;
   const report=raw?parseFrameCountReport(plan.pages.length,{frameCountReview:raw.frameCountReview,requirements:raw.requirements}):undefined;
   const context=report?.issues.length&&JSON.stringify(report.issues)===JSON.stringify(issues)?{frameCountReview:report.frameCountReview,requirements:report.requirements}:undefined;
   const result=await record('structure',[selection,plan,original,issues,coverage,context],()=>base.restructure(selection,plan,original,issues,coverage,context));
   state.phase='frames';await save(structuredClone(state));return result;
  },
 };
}
