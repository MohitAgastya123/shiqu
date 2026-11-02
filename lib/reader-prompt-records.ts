// Retain application-authored prompts with paid receipts; omit credentials and binary attachments.
// Records are fetched on demand rather than added to shelf or progress polling payloads.
export type PromptRecord={instructions:string;input:string;schema?:unknown;reference?:string};
export function promptRecord(instructions:string,input:unknown,schema?:unknown,reference?:string):PromptRecord{
 return {instructions,input:typeof input==='string'?input:JSON.stringify(input),...(schema?{schema}:{}),...(reference?{reference}:{})};
}
export function promptRecordText(record:PromptRecord){return ['## 系统指令',record.instructions,'## 文本输入',record.input,...(record.schema?['## 输出契约',JSON.stringify(record.schema,null,2)]:[]),...(record.reference?['## 图片参考',record.reference]:[])].join('\n\n');}
