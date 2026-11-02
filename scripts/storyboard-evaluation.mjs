// Offline-only two-gate evaluation. Bind checkpoints to inputs/config/prompts and retain paid results;
// the application engine and bookshelf do not opt into this adapter.
import {createHash} from 'node:crypto';
import {ownDesktopData} from '../server/desktop-owner.ts';
import {parseFrameCountReport} from '../lib/reader-review.ts';
import {validateEditorialCoverage} from '../lib/reader-editorial.ts';

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const matchesEvaluationModel=(receipt,model)=>typeof model==='string'&&!!model&&receipt?.model===model;

// A dead runner's isolated DB lock may be cleared only after obtaining exclusive ownership.
export async function acquireEvaluationRun(directory){
 let unlock;try{unlock=await ownDesktopData(directory);}catch(error){if(error.message==='DATA_BUSY')throw Error('EVALUATION_RUN_ACTIVE');throw error;}
 let active=true;
 return {
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
