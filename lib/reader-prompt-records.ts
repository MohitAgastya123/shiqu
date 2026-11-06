// English product text and generation contracts; canonical source evidence remains unchanged.
// Retain application-authored prompts with paid receipts; omit credentials and binary attachments.
// Records are fetched on demand rather than added to shelf or progress polling payloads.
// Archive references deduplicate exact system rules without altering saved history.
import {formatSystemPrompt} from './reader-prompt-format.ts';
export type PromptRecord={instructions:string;input:string;schema?:unknown;reference?:string};
export type PromptReceipt={step:string;model:string;originId:string;index:number;record:PromptRecord};
export type StoryPromptHistory={productionPrompt:string;acceptancePrompt:string;records:PromptReceipt[];missingRecords:Omit<PromptReceipt,'record'>[]};
export function promptRecord(instructions:string,input:unknown,schema?:unknown,reference?:string):PromptRecord{
 return {instructions:formatSystemPrompt(instructions),input:typeof input==='string'?input:JSON.stringify(input),...(schema?{schema}:{}),...(reference?{reference}:{})};
}
export function promptRecordText(record:PromptRecord){return ['## System instructions',record.instructions,'## Text input',record.input,...(record.schema?['## Output contract',JSON.stringify(record.schema,null,2)]:[]),...(record.reference?['## Reference image',record.reference]:[])].join('\n\n');}
export function archivePromptHistory(history:StoryPromptHistory|null){
 const systemPrompts:{id:string;label:string;instructions:string}[]=[],byInstructions=new Map<string,typeof systemPrompts[number]>();
 const counts={production:0,acceptance:0,image:0},labels={production:'Production system prompt',acceptance:'Acceptance system prompt',image:'Image system prompt'};
 const records=(history?.records??[]).map(item=>{
  const {instructions,...input}=item.record;
  let system=byInstructions.get(instructions);
  if(instructions&&!system){
   const kind=item.step.startsWith('review')?'acceptance':item.step.startsWith('image:')?'image':'production',number=++counts[kind];
   system={id:`system-${kind}-${number}`,label:labels[kind]+(number>1?` ${number}`:''),instructions};
   byInstructions.set(instructions,system);systemPrompts.push(system);
  }
  return {...item,record:{instructionsRef:system?.id??null,...input}};
 });
 return {productionPrompt:history?.productionPrompt??null,acceptancePrompt:history?.acceptancePrompt??null,systemPrompts,records,missingRecords:history?.missingRecords??[]};
}
export type StoryPromptArchive=ReturnType<typeof archivePromptHistory>;
