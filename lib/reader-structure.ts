// Replacement frames retain attributed balloons, while image mapping depends only on scene prompts.
// English product text and generation contracts; canonical source evidence remains unchanged.
// Apply bounded frame edits and optional global character-continuity updates atomically.
// Character-only updates preserve frame/progress identities and still require a real change.
import {z} from 'zod';
import {generatedPageJson} from './reader-generation-contract.ts';
import {planSchema} from './reader-model.ts';
import type {Plan} from './reader-model.ts';
import {readerMaxFrames,readerMinFrames,readerStoryboardBatchSize} from './reader-limits.ts';
export const structuralEditsSchema=z.object({edits:z.array(z.object({from:z.number().int().min(1),to:z.number().int().min(0),pages:z.array(planSchema.shape.pages.element).max(readerStoryboardBatchSize)}).strict()).max(readerStoryboardBatchSize),characters:planSchema.shape.characters.nullable().optional()}).strict().superRefine((value,ctx)=>{if(!value.edits.length&&!value.characters)ctx.addIssue({code:z.ZodIssueCode.custom,message:'Frame edits or a character-continuity update are required'});});
export type StructuralEdits=z.infer<typeof structuralEditsSchema>;
export function structuralEditsJson(count:number){return {type:'object',properties:{characters:{anyOf:[{type:'string',minLength:20,maxLength:6000},{type:'null'}]},edits:{type:'array',minItems:0,maxItems:readerStoryboardBatchSize,items:{type:'object',properties:{from:{type:'integer',minimum:1,maximum:count+1},to:{type:'integer',minimum:0,maximum:count},pages:{type:'array',maxItems:readerStoryboardBatchSize,items:generatedPageJson}},required:['from','to','pages'],additionalProperties:false}}},required:['characters','edits'],additionalProperties:false};}
export function applyStructuralEdits(plan:Plan,value:StructuralEdits){
 const {edits,characters}=structuralEditsSchema.parse(value),pages:Plan['pages']=[],sourcePages:(number|null)[]=[];
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
 const next=planSchema.parse({...plan,pages,...(characters?{characters}:{})}),changed=JSON.stringify(next.pages)!==JSON.stringify(plan.pages)||next.characters!==plan.characters;
 const removed=edits.flatMap(edit=>plan.pages.slice(edit.from-1,edit.to).map((page,i)=>({page:edit.from+i,...page})));
 const progressMap=plan.pages.map((_,i)=>{const at=sourcePages.indexOf(i);return at>=0?at:Math.min(i,pages.length-1);});
 return {plan:next,sourcePages,progressMap,changed,edits,removed,...(next.characters!==plan.characters?{characters:next.characters,previousCharacters:plan.characters}:{})};
}
