// Apply bounded, ordered edits against original frame numbers; never mutate a partial or invalid plan.
import {z} from 'zod';
import {planSchema} from './reader-model.ts';
import type {Plan} from './reader-model.ts';
import {readerMaxFrames,readerMinFrames,readerStoryboardBatchSize} from './reader-limits.ts';
export const structuralEditsSchema=z.object({edits:z.array(z.object({from:z.number().int().min(1),to:z.number().int().min(0),pages:z.array(planSchema.shape.pages.element).max(readerStoryboardBatchSize)}).strict()).min(1).max(readerStoryboardBatchSize)}).strict();
export type StructuralEdits=z.infer<typeof structuralEditsSchema>;
export function structuralEditsJson(count:number){return {type:'object',properties:{edits:{type:'array',minItems:1,maxItems:readerStoryboardBatchSize,items:{type:'object',properties:{from:{type:'integer',minimum:1,maximum:count+1},to:{type:'integer',minimum:0,maximum:count},pages:{type:'array',maxItems:readerStoryboardBatchSize,items:{type:'object',properties:{caption:{type:'string',minLength:8,maxLength:90},prompt:{type:'string',minLength:20,maxLength:1800}},required:['caption','prompt'],additionalProperties:false}}},required:['from','to','pages'],additionalProperties:false}}},required:['edits'],additionalProperties:false};}
export function applyStructuralEdits(plan:Plan,value:StructuralEdits){
 const {edits}=structuralEditsSchema.parse(value),pages:Plan['pages']=[],sourcePages:(number|null)[]=[];
 let cursor=1,previousFrom=0,written=0;
 for(const edit of edits){
  const {from,to}=edit;written+=edit.pages.length;
  if(from<=previousFrom||from<cursor||from>plan.pages.length+1||to<from-1||to>plan.pages.length||written>readerStoryboardBatchSize||to===from-1&&!edit.pages.length)throw Error('INVALID_STRUCTURAL_EDIT');
  for(;cursor<from;cursor++){pages.push(plan.pages[cursor-1]);sourcePages.push(cursor-1);}
  const replaced=plan.pages.slice(from-1,to),same=replaced.length===edit.pages.length&&replaced.every((page,i)=>page.prompt===edit.pages[i].prompt);
  for(let i=0;i<edit.pages.length;i++){
   const page=edit.pages[i],matches=replaced.flatMap((p,j)=>p.prompt===page.prompt?[j]:[]);
   const unique=matches.length===1&&edit.pages.filter(p=>p.prompt===page.prompt).length===1;
   pages.push(page);sourcePages.push(same?from-1+i:unique?from-1+matches[0]:null);
  }
  cursor=to+1;previousFrom=from;
 }
 for(;cursor<=plan.pages.length;cursor++){pages.push(plan.pages[cursor-1]);sourcePages.push(cursor-1);}
 if(pages.length<readerMinFrames||pages.length>readerMaxFrames)throw Error('STRUCTURAL_FRAME_LIMIT');
 const next=planSchema.parse({...plan,pages}),changed=JSON.stringify(next.pages)!==JSON.stringify(plan.pages);
 const removed=edits.flatMap(edit=>plan.pages.slice(edit.from-1,edit.to).map((page,i)=>({page:edit.from+i,...page})));
 const progressMap=plan.pages.map((_,i)=>{const at=sourcePages.indexOf(i);return at>=0?at:Math.min(i,pages.length-1);});
 return {plan:next,sourcePages,progressMap,changed,edits,removed};
}
