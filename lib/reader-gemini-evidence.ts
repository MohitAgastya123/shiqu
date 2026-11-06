// English product text and generation contracts; canonical source evidence remains unchanged.
// Give Gemini exact source excerpts to cite; restore canonical quotes before shared review validation.
// Unknown references and model-authored replacement quotes fail rather than being repaired or truncated.
import {z} from 'zod';

type QuoteSource={id:number;quote:string};
function quoteSources(original:{text:string;chapterContext?:{text:string}}):QuoteSource[]{
 const quotes=new Set<string>();
 for(const text of [original.text,original.chapterContext?.text||'']){
  for(const clause of text.match(/[^，。！？；\r\n]+[，。！？；]?/gu)||[]){
   for(let first=0;first<clause.length;){
    let last=Math.min(first+100,clause.length);
    if(last<clause.length&&/[\uDC00-\uDFFF]/u.test(clause[last]))last--;
    if(clause.length-last===1)last=clause.length;
    const quote=clause.slice(first,last).trim();if((quote.match(/[\p{L}\p{N}]/gu)||[]).length>=2)quotes.add(quote);first=last;
   }
  }
 }
 return [...quotes].map((quote,index)=>({id:index+1,quote}));
}
export function geminiReviewEvidence(input:unknown,schema:unknown){
 const payload=input as {verifiedOriginal?:{text:string;chapterContext?:{text:string}}};
 const contract=schema as {properties?:Record<string,{items?:{properties?:Record<string,unknown>;required?:string[]}}>};
 const fields=['coverage','requirements'].filter(name=>contract.properties?.[name]?.items?.properties?.quote);
 if(!fields.length||!payload.verifiedOriginal)return {payload:input,schema,direction:'',resolve:(value:unknown)=>value};
 const sources=z.array(z.object({id:z.number().int().positive(),quote:z.string().min(2).max(120)})).min(1).parse(quoteSources(payload.verifiedOriginal)),output=structuredClone(contract);
 for(const field of fields){
  const item=output.properties![field].items!;
  delete item.properties!.quote;
  item.properties!.quoteId={type:'integer',minimum:1,maximum:sources.length};
  item.required=item.required!.map(name=>name==='quote'?'quoteId':name);
 }
 const reference=z.object({quoteId:z.number().int().min(1).max(sources.length),quote:z.never().optional()}).passthrough();
 const resultSchema=z.object(Object.fromEntries(fields.map(field=>[field,z.array(reference)]))).passthrough();
 return {
  payload:{...payload,reviewQuoteSources:sources},schema:output,
  direction:'For this call use quoteId instead of quote in coverage/requirements. Read verifiedOriginal completely, then select the integer from reviewQuoteSources directly supporting the task. Return only that integer; never copy, paraphrase, join or generate a quote. The ID is a source reference, not a substitute for a task, evidence or judgment.',
  resolve(value:unknown){
   const result:Record<string,unknown>=resultSchema.parse(value);
   for(const field of fields)result[field]=(result[field] as z.infer<typeof reference>[]).map(({quoteId,...item})=>({...item,quote:sources[quoteId-1].quote}));
   return result;
  },
 };
}
