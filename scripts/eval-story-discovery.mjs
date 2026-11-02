// Score fixed original-based annotations offline. No provider, runner, credential, or network imports.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export const datasetHash=dataset=>createHash('sha256').update(JSON.stringify(dataset)).digest('hex');
const ratio=(n,d)=>d?n/d:null;
const set=units=>new Set(units),covers=(a,b)=>b.every(id=>a.includes(id)),overlap=(a,b)=>a.some(id=>b.includes(id));
export function scoreBoundaries(expected,predicted){
 const remaining=[...predicted],matched=new Set(),diagnostics={merged:[],split:[],missingStart:[],missingEnd:[]};let exact=0;
 for(const gold of expected){const index=remaining.findIndex(p=>p.units.length===gold.units.length&&covers(p.units,gold.units));if(index>=0){remaining.splice(index,1);matched.add(gold.id);exact++;}}
 const unmatched=expected.filter(g=>!matched.has(g.id));
 for(const p of remaining){
  const included=unmatched.filter(g=>covers(p.units,g.units));
  const independent=included.filter(g=>included.some(other=>other!==g&&!covers(other.units,g.units)&&!covers(g.units,other.units)));
  if(independent.length>=2)diagnostics.merged.push({prediction:p.id,expected:independent.map(g=>g.id).sort()});
  for(const g of unmatched.filter(g=>p.units.length<g.units.length&&covers(g.units,p.units))){if(!p.units.includes(g.units[0]))diagnostics.missingStart.push({prediction:p.id,expected:g.id});if(!p.units.includes(g.units.at(-1)))diagnostics.missingEnd.push({prediction:p.id,expected:g.id});}
 }
 for(const g of unmatched){const parts=remaining.filter(p=>p.units.length<g.units.length&&covers(g.units,p.units));if(parts.length>=2&&covers([...set(parts.flatMap(p=>p.units))],g.units))diagnostics.split.push({expected:g.id,predictions:parts.map(p=>p.id).sort()});}
 const fingerprints=predicted.map(p=>JSON.stringify([...set(p.units)].sort()));
 return {expected:expected.length,predicted:predicted.length,exact,exactRate:ratio(exact,expected.length),unpaired:remaining.length,duplicates:fingerprints.length-new Set(fingerprints).size,omitted:expected.filter(g=>!predicted.some(p=>overlap(g.units,p.units))).map(g=>g.id),diagnostics,diagnosticsOverlap:true};
}
export function evaluate(dataset,recording){
 if(!recording||recording.datasetHash!==datasetHash(dataset)||recording.annotationVersion!==dataset.version||recording.identity?.contract!=='original-binary-v1')return {comparable:false,reason:'Missing recording or incompatible input/annotation/contract identity',annotationStatus:dataset.annotationStatus};
 let tp=0,fp=0,fn=0,unknown=0,judged=0,positive=0,judgedPositive=0;const failures={};
 for(const sample of dataset.samples){
  const entries=recording.matches.filter(m=>m.sampleId===sample.id),receipt=entries.length===1?entries[0]:undefined;
  if(sample.label==='yes')positive++;
  if(!receipt||!['yes','no'].includes(receipt.verdict)){unknown++;const status=entries.length>1?'duplicate':receipt?.status||'missing';failures[status]=(failures[status]||0)+1;continue;}
  judged++;if(sample.label==='yes')judgedPositive++;
  if(receipt.verdict==='yes'){if(sample.label==='yes')tp++;else fp++;}else if(sample.label==='yes')fn++;
 }
 return {comparable:true,annotationStatus:dataset.annotationStatus,source:recording.source,identity:recording.identity,samples:dataset.samples.length,tp,fp,fn,unknown,failures,precision:ratio(tp,tp+fp),recall:ratio(tp,positive),judgedRecall:ratio(tp,judgedPositive),coverage:ratio(judged,dataset.samples.length),boundaries:dataset.boundaries.map(g=>({id:g.id,...scoreBoundaries(g.expected,recording.boundaries.find(p=>p.id===g.id)?.predicted||[])}))};
}
async function main(){
 const args=process.argv.slice(2),arg=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
 const dataset=JSON.parse(await readFile(arg('--dataset',new URL('../data/evals/story-discovery/annotations.json',import.meta.url)),'utf8'));
 const recording=JSON.parse(await readFile(arg('--receipts',new URL('../data/evals/story-discovery/controlled.json',import.meta.url)),'utf8'));
 const requestedModel=arg('--model',recording.identity.model),requestedEffort=arg('--effort',recording.identity.effort);
 const report=evaluate(dataset,requestedModel===recording.identity.model&&requestedEffort===recording.identity.effort?recording:null);
 if(!args.includes('--json'))console.log('Offline replay; draft annotations; controlled receipts are not evidence of real-model accuracy or speed.');
 console.log(JSON.stringify(report,null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
