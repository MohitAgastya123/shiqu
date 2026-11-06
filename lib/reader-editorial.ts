// Source coverage includes character balloons as well as narration and illustration staging.
// English product text and generation contracts; canonical source evidence remains unchanged.
// Persist source-to-frame editorial evidence; references are checked against the saved edition.
// Imported parts require every compiler-owned English evidence unit, not only selected review quotations.
import {z} from 'zod';
import {Converter} from 'opencc-js';
import {importCoverageUnits} from './story-import-text.ts';
import {englishOriginal} from './reader-source-types.ts';
import type {OriginalSource} from './reader-source-types.ts';
import type {Document} from './reader-model.ts';
const simplify=Converter({from:'t',to:'cn'});
const normalized=(text:string)=>simplify(text).replaceAll('著','着').replace(/[\p{P}\p{S}\s]/gu,'');
export const editorialCoverageSchema=z.object({
 unitId:z.string().min(1).max(60).optional(),
 quote:z.string().trim().min(2).max(120),task:z.string().trim().min(1).max(120),
 pages:z.array(z.number().int().min(1)).max(80),assessment:z.enum(['adequate','needs-change']),
 reason:z.string().trim().min(1).max(180),issuePage:z.number().int().min(0),
});
export type EditorialCoverage=z.infer<typeof editorialCoverageSchema>;
export function editorialCoverageJson(count:number,original?:OriginalSource){
 const units=original?.imported?importCoverageUnits((englishOriginal(original)||original).text):[];
 return {type:'array',minItems:units.length||1,maxItems:units.length||32,items:{type:'object',properties:{
  ...(units.length?{unitId:{type:'string',enum:units.map(unit=>unit.id)}}:{}),
  quote:{type:'string',minLength:2,maxLength:120},task:{type:'string',minLength:1,maxLength:120},
  pages:{type:'array',maxItems:count,items:{type:'integer',minimum:1,maximum:count}},
  assessment:{type:'string',enum:['adequate','needs-change']},reason:{type:'string',minLength:1,maxLength:180},issuePage:{type:'integer',minimum:0,maximum:count},
 },required:[...(units.length?['unitId']:[]),'quote','task','pages','assessment','reason','issuePage'],additionalProperties:false}};
}
export function validateEditorialCoverage(coverage:EditorialCoverage[],original:OriginalSource,complete=true){
 const english=englishOriginal(original);
 const source=normalized(original.text+'\n'+(original.chapterContext?.text||'')+'\n'+(english?.text||'')+'\n'+(english?.chapterContext?.text||''));
 for(const item of coverage){const quote=normalized(item.quote);if(quote.length<2||!source.includes(quote))throw Error('EDITORIAL_SOURCE_QUOTE');}
 if(original.imported&&complete){
  const units=importCoverageUnits((english||original).text),ids=new Set(coverage.map(item=>item.unitId));
  if(coverage.length!==units.length||ids.size!==units.length||units.some(unit=>!ids.has(unit.id)))throw Error('IMPORTED_SOURCE_COVERAGE_INCOMPLETE');
  for(const item of coverage){
   const unit=units.find(unit=>unit.id===item.unitId)!;
   if(!normalized(unit.text).includes(normalized(item.quote)))throw Error('IMPORTED_SOURCE_UNIT_QUOTE');
   if(item.assessment==='adequate'&&!item.pages.length)throw Error('IMPORTED_SOURCE_UNIT_MISSING_FRAMES');
  }
 }
}
// User overrides may waive presentation preferences, but never known missing imported source evidence.
export function assertImportedCoverageReady(doc:Pick<Document,'original'|'plan'|'visualReview'>){
 if(!doc.original?.imported)return;
 const coverage=doc.visualReview?.reports.at(-1)?.coverage,count=doc.plan?.pages.length;
 if(!coverage||!count)throw Error('IMPORTED_SOURCE_COVERAGE_UNREVIEWED');
 validateEditorialCoverage(coverage,doc.original);
 if(coverage.some(item=>item.assessment!=='adequate'||item.issuePage!==0||!item.pages.length||new Set(item.pages).size!==item.pages.length||item.pages.some(page=>!Number.isInteger(page)||page<1||page>count)))throw Error('IMPORTED_SOURCE_COVERAGE_NOT_READY');
}
export const editorialAuditDirection="Check original and storyboard in both directions. First identify key narrative tasks, then locate how captions, attributed balloons and scene prompts carry them. Mentioning an entire exchange or showing its aftermath does not prove development. Check causation, meaningful actions/responses, bodily and environmental conditions and natural results; do not build the checklist merely from the existing draft. Return coverage: quote is one short continuous locatable quotation from the supplied English verifiedOriginal text, allowing simplified/traditional, punctuation and whitespace differences only. Never translate, join, paraphrase or abbreviate exact evidence. task describes the distinct narrative role in English; pages lists corresponding frames, empty when missing. adequate requires reason explaining realization and issuePage=0; needs-change requires a material loss and issuePage matching an issue. Select 1–32 tasks according to complexity, not to inflate coverage. All quotations and explanations must be English. For verifiedOriginal.importedPart, return every coverageUnit exactly once with its unitId and a quotation from that same unit. Do not select only easy units or silently omit a thread. Adequate requires at least one corresponding frame; otherwise mark needs-change with a concrete repair issue. The independent source units are mandatory evidence scope, not summaries to illustrate mechanically.";
