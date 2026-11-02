// Hand-calculated offline metrics include unknowns, duplicates, and range diagnostics in their denominators.
import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluate,datasetHash,scoreBoundaries} from '../scripts/eval-story-discovery.mjs';
import {readFile} from 'node:fs/promises';
test('end-to-end recall counts unknown positives while coverage exposes missing judgments',()=>{
 const dataset={version:'draft',annotationStatus:'draft',samples:[{id:'a',label:'yes'},{id:'b',label:'yes'},{id:'c',label:'no'},{id:'d',label:'no'}],boundaries:[]};
 const recording={source:'controlled',annotationVersion:'draft',datasetHash:datasetHash(dataset),identity:{contract:'original-binary-v1'},matches:[{sampleId:'a',verdict:'yes'},{sampleId:'b',status:'refused'},{sampleId:'c',verdict:'yes'},{sampleId:'d',verdict:'no'}]};
 const report=evaluate(dataset,recording);assert.equal(report.precision,.5);assert.equal(report.recall,.5);assert.equal(report.judgedRecall,1);assert.equal(report.coverage,.75);assert.equal(report.unknown,1);
 recording.matches.push({sampleId:'a',verdict:'no'});assert.equal(evaluate(dataset,recording).recall,0);recording.datasetHash='wrong';assert.equal(evaluate(dataset,recording).comparable,false);
});
test('empty denominators are not zero accuracy',()=>{const d={version:'draft',samples:[],boundaries:[]};const r=evaluate(d,{annotationVersion:'draft',datasetHash:datasetHash(d),identity:{contract:'original-binary-v1'},matches:[],boundaries:[]});assert.equal(r.precision,null);assert.equal(r.recall,null);assert.equal(r.coverage,null);});
test('range matching is one-to-one and deterministic; merge/split/endpoints are diagnostics',()=>{
 const gold=[{id:'a',units:['1','2']},{id:'b',units:['3','4']},{id:'c',units:['5','6','7','8']},{id:'d',units:['9']}];
 const result=scoreBoundaries(gold,[{id:'merged',units:['1','2','3','4']},{id:'p1',units:['5','6']},{id:'p2',units:['7','8']},{id:'exact',units:['9']},{id:'dup',units:['9']}]);assert.equal(result.exact,1);assert.equal(result.exactRate,.25);assert.equal(result.duplicates,1);assert.equal(result.diagnostics.merged.length,1);assert.equal(result.diagnostics.split.length,1);assert.ok(result.diagnostics.missingStart.length);assert.ok(result.diagnostics.missingEnd.length);assert.deepEqual(result.omitted,[]);
 const shared=scoreBoundaries([{id:'main',units:['1','2','3']},{id:'child',units:['2']}],[{id:'main',units:['1','2','3']},{id:'child',units:['2']}]);assert.equal(shared.exactRate,1);assert.equal(shared.diagnostics.merged.length,0);
});
test('shipped annotations cover 40 pairs, three books and three complete chapters, with controlled provenance',async()=>{
 const d=JSON.parse(await readFile('data/evals/story-discovery/annotations.json','utf8')),r=JSON.parse(await readFile('data/evals/story-discovery/controlled.json','utf8'));
 assert.equal(d.samples.length,40);assert.equal(new Set(d.stories.map(s=>s.bookId)).size,3);assert.equal(d.boundaries.length,3);assert.equal(d.annotationStatus,'draft');assert.equal(r.source,'controlled');assert.equal(evaluate(d,r).comparable,true);assert.equal(evaluate(d,null).comparable,false);
});
