// Partition complete imported prose at natural boundaries without removing source characters.
// Stable source offsets, finite part budgets and evidence chunks share the same lossless text rules.
import {storyImportLimits,storyImportPartBudgets,storyImportTitleSchema} from './story-import-contract.ts';
import type {ImportSourceUnit,ImportTextSource,ImportPartPlan,StoryImportSettings} from './story-import-contract.ts';

export type ImportTextLocation={start:number;end:number;page?:number;heading?:string};
export class ImportTextError extends Error{status=400;constructor(message:string){super(message);this.name='ImportTextError';}}
const invalid=(message:string)=>new ImportTextError(message);
export function importWordCount(text:string){return text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length||0;}
export function canonicalImportText(text:string){
 if(typeof text!=='string'||!text.isWellFormed())throw invalid('The document contains damaged text. Export a readable Word or PDF copy and try again.');
 const value=text.replace(/\r\n?/g,'\n').trim();
 if(!value||!/[\p{L}\p{N}]/u.test(value))throw invalid('No readable story text was found. Upload a Word document or a PDF with selectable text.');
 if(value.length>storyImportLimits.textCharacters)throw invalid('The document exceeds the 2 million character text limit. Upload a smaller complete story.');
 if(value.includes('\u0000')||/[\uFFFD\uE000-\uF8FF\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]/u.test(value))throw invalid('The extracted document contains unreadable or missing characters. Export a text-readable copy and try again.');
 return value;
}
function safeEnd(text:string,end:number){return end>0&&end<text.length&&/[\uD800-\uDBFF]/.test(text[end-1])&&/[\uDC00-\uDFFF]/.test(text[end])?end-1:end;}
function boundaries(text:string,start:number,maximum:number){
 const value=text.slice(start,maximum),paragraphs:number[]=[],sentences:number[]=[],words:number[]=[];
 for(const match of value.matchAll(/\n[\t ]*\n+/g))paragraphs.push(start+match.index!+match[0].length);
 for(const match of value.matchAll(/[。！？；]|[.!?;]["'”’\])}]*(?:\s+|$)/g))sentences.push(start+match.index!+match[0].length);
 for(const match of value.matchAll(/\s+|[，、：]/g))words.push(start+match.index!+match[0].length);
 return {paragraphs,sentences,words};
}
function naturalEnd(text:string,start:number,target:number,hard:number){
 if(text.length-start<=hard)return text.length;
 const end=safeEnd(text,Math.min(text.length,start+hard)),options=boundaries(text,start,end),minimum=start+Math.min(target*.45,hard*.45);
 for(const list of [options.paragraphs,options.sentences,options.words]){
  const before=list.filter(value=>value>=minimum&&value<=start+target).at(-1);if(before)return before;
 }
 const after=[...options.paragraphs,...options.sentences,...options.words].filter(value=>value>start+target).sort((a,b)=>a-b)[0];
 if(after)return after;
 const fallback=options.words.at(-1)||options.sentences.at(-1)||options.paragraphs.at(-1);if(fallback&&fallback>start)return fallback;
 throw invalid('A word or unbroken passage is too long to divide safely. Add normal sentence or paragraph breaks and upload the document again.');
}
export function importedSourceUnits(text:string,locations:ImportTextLocation[]=[]):ImportSourceUnit[]{
 if(!text||text.length>storyImportLimits.textCharacters||!text.isWellFormed())throw invalid('The imported source text is invalid or too long.');
 const mandatory=[...new Set(locations.flatMap(location=>[location.start,location.end]).filter(value=>value>0&&value<text.length))].sort((a,b)=>a-b),result:ImportSourceUnit[]=[];
 let start=0;
 while(start<text.length){
  const next=mandatory.find(value=>value>start),limit=next===undefined?text.length:next;
  const relative=naturalEnd(text.slice(0,limit),start,storyImportLimits.sourceUnitTarget,storyImportLimits.sourceUnitHard),end=Math.min(relative,limit);
  if(end<=start||end-start>storyImportLimits.sourceUnitHard)throw invalid('The source could not be divided into complete readable units.');
  const location=locations.find(item=>item.start<=start&&item.end>start),heading=location?.heading&&start===location.start?location.heading:undefined;
  result.push({id:'u'+String(result.length+1).padStart(6,'0'),start,end,...(location?.page?{page:location.page}:{}),...(heading?{heading}:{})});start=end;
 }
 return result;
}
export function validateImportedSource(source:ImportTextSource){
 if(!source.text||source.text.length>storyImportLimits.textCharacters||!source.text.isWellFormed()||!source.units.length)throw invalid('The saved imported source is incomplete. Upload the document again.');
 let end=0;const ids=new Set<string>();
 for(const unit of source.units){
  if(!/^[A-Za-z0-9_-]{1,60}$/.test(unit.id)||ids.has(unit.id)||!Number.isInteger(unit.start)||!Number.isInteger(unit.end)||unit.start!==end||unit.end<=unit.start||unit.end>source.text.length||unit.end-unit.start>storyImportLimits.sourceUnitHard||safeEnd(source.text,unit.start)!==unit.start||safeEnd(source.text,unit.end)!==unit.end)throw invalid('The saved imported source ranges do not cover the complete document. Upload it again.');
  ids.add(unit.id);end=unit.end;
 }
 if(end!==source.text.length)throw invalid('The saved imported source is missing its final text. Upload the document again.');
}
export function planImportedStory(source:ImportTextSource,title:string,detail:StoryImportSettings['narrativeDetail']='balanced'):ImportPartPlan[]{
 validateImportedSource(source);title=storyImportTitleSchema.parse(title);
 const budget=storyImportPartBudgets[detail];if(!budget)throw invalid('Choose a valid narrative detail level.');
 const groups:{first:number;last:number}[]=[];let first=0;
 while(first<source.units.length){
  const start=source.units[first].start;let hardLast=first;
  while(hardLast+1<source.units.length&&hardLast-first+1<storyImportLimits.partUnits&&source.units[hardLast+1].end-start<=budget.hard)hardLast++;
  if(source.units[hardLast].end-start>budget.hard)throw invalid('One source passage exceeds the comic part limit. Upload a document with normal paragraph breaks.');
  let last=hardLast;
  if(hardLast<source.units.length-1){
   const targetLast=source.units.findIndex((unit,index)=>index>=first&&index<=hardLast&&unit.end-start>=budget.target);if(targetLast>=first)last=targetLast;
   const candidates=source.units.flatMap((unit,index)=>index>first&&index<=hardLast&&unit.heading&&unit.start-start>=budget.target*.5?[index-1]:[]);
   if(candidates.length)last=candidates.reduce((best,value)=>Math.abs(source.units[value].end-start-budget.target)<Math.abs(source.units[best].end-start-budget.target)?value:best,candidates[0]);
  }
  groups.push({first,last});first=last+1;
  if(groups.length>storyImportLimits.parts)throw invalid('This story needs more than 200 comic parts at this detail level. Choose a briefer detail level or upload a smaller complete story.');
 }
 return groups.map(({first,last},index)=>{const begin=source.units[first],end=source.units[last],text=source.text.slice(begin.start,end.end);return {number:index+1,title:groups.length===1?title:`${title} — Part ${index+1}`,firstUnit:begin.id,lastUnit:end.id,start:begin.start,end:end.end,sourceCharacters:end.end-begin.start,wordCount:importWordCount(text)};});
}
export type ImportCoverageUnit={id:string;text:string;start:number;end:number};
export function importCoverageUnits(text:string):ImportCoverageUnit[]{
 const readable=(value:string)=>value.match(/[\p{L}\p{N}]/gu)?.length||0;
 if(readable(text)<2)throw invalid('The current comic part has no readable source evidence. Upload a complete story passage.');
 const desired=Math.min(storyImportLimits.coverageUnits,Math.max(1,Math.ceil(text.length/storyImportLimits.sourceUnitTarget))),units:ImportCoverageUnit[]=[];let start=0;
 while(start<text.length&&units.length<desired){
  const slots=desired-units.length,remaining=text.length-start;
  let end=text.length;
  if(slots>1){
   const target=Math.ceil(remaining/slots),maximum=safeEnd(text,Math.min(text.length,start+Math.ceil(target*1.5))),options=boundaries(text,start,maximum),candidate=[...options.paragraphs,...options.sentences,...options.words].filter(value=>value>start);
   if(candidate.length)end=candidate.reduce((best,value)=>Math.abs(value-start-target)<Math.abs(best-start-target)?value:best,candidate[0]);
  }
  if(end<=start)end=text.length;
  units.push({id:'e'+String(units.length+1).padStart(3,'0'),text:text.slice(start,end),start,end});start=end;
 }
 if(start!==text.length)throw invalid('The complete source could not be prepared for coverage review.');
 for(let index=0;index<units.length&&units.length>1;index++)if(readable(units[index].text)<2){
  if(index){units[index-1].text+=units[index].text;units[index-1].end=units[index].end;units.splice(index,1);index--;}
  else{units[1].text=units[0].text+units[1].text;units[1].start=units[0].start;units.shift();index--;}
 }
 return units.map((unit,index)=>({...unit,id:'e'+String(index+1).padStart(3,'0')}));
}
