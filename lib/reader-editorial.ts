// English product text and generation contracts; canonical source evidence remains unchanged.
// Persist source-to-frame editorial evidence; references are checked against the saved edition.
import {z} from 'zod';
import {Converter} from 'opencc-js';
import {englishOriginal} from './reader-source-types.ts';
import type {OriginalSource} from './reader-source-types.ts';
const simplify=Converter({from:'t',to:'cn'});
const normalized=(text:string)=>simplify(text).replaceAll('著','着').replace(/[\p{P}\p{S}\s]/gu,'');
export const editorialCoverageSchema=z.object({
 quote:z.string().trim().min(2).max(120),task:z.string().trim().min(1).max(120),
 pages:z.array(z.number().int().min(1)).max(80),assessment:z.enum(['adequate','needs-change']),
 reason:z.string().trim().min(1).max(180),issuePage:z.number().int().min(0),
});
export type EditorialCoverage=z.infer<typeof editorialCoverageSchema>;
export const editorialCoverageJson=(count:number)=>({type:'array',minItems:1,maxItems:32,items:{type:'object',properties:{
 quote:{type:'string',minLength:2,maxLength:120},task:{type:'string',minLength:1,maxLength:120},
 pages:{type:'array',maxItems:count,items:{type:'integer',minimum:1,maximum:count}},
 assessment:{type:'string',enum:['adequate','needs-change']},reason:{type:'string',minLength:1,maxLength:180},issuePage:{type:'integer',minimum:0,maximum:count},
},required:['quote','task','pages','assessment','reason','issuePage'],additionalProperties:false}});
export function validateEditorialCoverage(coverage:EditorialCoverage[],original:OriginalSource){
 const english=englishOriginal(original);
 const source=normalized(original.text+'\n'+(original.chapterContext?.text||'')+'\n'+(english?.text||'')+'\n'+(english?.chapterContext?.text||''));
 for(const item of coverage){const quote=normalized(item.quote);if(quote.length<2||!source.includes(quote))throw Error('EDITORIAL_SOURCE_QUOTE');}
}
export const editorialAuditDirection="Check original and storyboard in both directions. First identify key narrative tasks, then locate how captions and scene prompts carry them. Mentioning an entire exchange or showing its aftermath does not prove development. Check causation, meaningful actions/responses, bodily and environmental conditions and natural results; do not build the checklist merely from the existing draft. Return coverage: quote is one short continuous locatable quotation from the supplied English verifiedOriginal text, allowing simplified/traditional, punctuation and whitespace differences only. Never translate, join, paraphrase or abbreviate exact evidence. task describes the distinct narrative role in English; pages lists corresponding frames, empty when missing. adequate requires reason explaining realization and issuePage=0; needs-change requires a material loss and issuePage matching an issue. Select 1–32 tasks according to complexity, not to inflate coverage. All quotations and explanations must be English.";
