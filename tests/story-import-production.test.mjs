// Exercise exact imported source evidence through shared provider contracts, real production and public exports.
// Controlled adapters and temporary libraries prevent paid calls or personal-library mutations.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import {unzipSync,strFromU8} from 'fflate';
import {createStoryPdf} from '../lib/reader-pdf.ts';
import {createStoryPng} from '../lib/reader-png.ts';
import {createStoryZip} from '../lib/reader-zip.ts';
import {publicStoryZip} from '../lib/public-story-zip.mjs';
import {nativeExportRuntime} from '../server/story-export.ts';
import {verifiedOriginalPayload,englishOriginal} from '../lib/reader-source-types.ts';
import {editorialCoverageJson,validateEditorialCoverage,assertImportedCoverageReady} from '../lib/reader-editorial.ts';
import {storyboardReviewGenerator} from '../lib/reader-review.ts';
import {importCoverageUnits} from '../lib/story-import-text.ts';
import {importedStoryDirection} from '../lib/reader-prompts.ts';
import {ReaderRepository} from '../lib/reader-repository.ts';
import {emptyDocument,view} from '../lib/reader-model.ts';
import {storyZipData,publicStoryZipData,storyZipFiles} from '../lib/reader-zip-content.ts';
import {productionFixture,until} from './fixtures/production.mjs';

const text=Array.from({length:8},(_,i)=>`Stage ${i+1}. Mara carries a lantern along the riverbank and checks the stones before crossing. Ivo follows her footprints and waits until the current slows. They keep the lantern above the water and move carefully toward the opposite shore. `).join('\n\n')+'\n\nAt dusk they reach the far bank, where their friends are waiting.';
function original(root=randomUUID()){
 return {title:'The River Crossing — Part 2',text,url:'',kind:'passage',provider:'Uploaded Word document',retrievedAt:'2026-11-06T00:00:00Z',imported:{sourceId:randomUUID(),fileName:'The River Crossing.docx',format:'docx',fileSha256:'a'.repeat(64),textSha256:'b'.repeat(64),start:12000,end:12000+text.length,unitIds:['u000025','u000026'],seriesId:randomUUID(),seriesTitle:'The River Crossing',partRootId:root,partNumber:2,partCount:2,continuity:{characters:'Mara wears a dark red coat and carries a brass lantern. Ivo wears a blue coat.',previousSummary:'Mara and Ivo reached the river before dusk.',previousEnding:'They stopped at the bank to find a safe route.'}}};
}
const coverage=source=>importCoverageUnits((englishOriginal(source)||source).text).map(unit=>({unitId:unit.id,quote:unit.text.trim().slice(0,95),task:'Preserve this source segment.',pages:[1,2],assessment:'adequate',reason:'The controlled frames preserve the source actions and outcome.',issuePage:0}));
const plan={title:'The River Crossing',summary:'Mara and Ivo cross the river carefully and reach their waiting friends.',sourceReference:'Uploaded story, Part 2',adaptationNote:'An English adaptation of the exact uploaded passage.',characters:'Mara wears a dark red coat and carries a brass lantern. Ivo wears a blue coat.',pages:[{caption:'Mara checks the stones while Ivo waits for the current to slow.',prompt:'Mara in a red coat holds a brass lantern on the riverbank; Ivo in a blue coat waits behind her.',bubbles:[],panel:'normal'},{caption:'At dusk they reach the far bank, where their friends are waiting.',prompt:'Mara and Ivo step safely onto the far riverbank at dusk; their friends wait on firm ground.',bubbles:[],panel:'normal'}]};

test('imported provider evidence contains the entire scoped source and distinct continuity, including translated units',()=>{
 const source=original(),payload=verifiedOriginalPayload(source);assert.equal(payload.text,text);assert.equal(payload.url,'');assert.equal(payload.importedPart.number,2);assert.equal(payload.importedPart.count,2);assert.deepEqual(payload.importedPart.continuity,source.imported.continuity);assert.equal(payload.importedPart.coverageUnits.map(unit=>unit.text).join(''),text);assert.ok(payload.importedPart.coverageUnits.length>1);assert.doesNotMatch(JSON.stringify(payload),/fileSha256|partRootId|localPath/);assert.match(importedStoryDirection,/NOT additional narrative evidence/);assert.match(importedStoryDirection,/intermediate part/);
 const translated={...source,text:'甲乙丙丁。',englishSource:{title:'The River Crossing',text}};assert.equal(verifiedOriginalPayload(translated).importedPart.coverageUnits.map(unit=>unit.text).join(''),text);assert.equal(translated.text,'甲乙丙丁。');
});

test('complete imported coverage requires every unit once with exact in-unit evidence and represented frames',()=>{
 const source=original(),valid=coverage(source),schema=editorialCoverageJson(2,source);assert.ok(schema.items.required.includes('unitId'));assert.equal(schema.minItems,valid.length);assert.equal(schema.maxItems,valid.length);assert.doesNotThrow(()=>validateEditorialCoverage(valid,source));
 assert.throws(()=>validateEditorialCoverage(valid.slice(1),source),/COVERAGE_INCOMPLETE/);assert.throws(()=>validateEditorialCoverage([...valid.slice(0,-1),valid[0]],source),/COVERAGE_INCOMPLETE/);assert.throws(()=>validateEditorialCoverage(valid.map((item,i)=>i?item:{...item,quote:'Mara flew away on a dragon.'}),source),/SOURCE_QUOTE/);assert.throws(()=>validateEditorialCoverage(valid.map((item,i)=>i?item:{...item,quote:'At dusk they reach the far bank'}),source),/UNIT_QUOTE/);assert.throws(()=>validateEditorialCoverage(valid.map((item,i)=>i?item:{...item,pages:[]}),source),/MISSING_FRAMES/);
 assert.doesNotThrow(()=>validateEditorialCoverage([],source,false),'The count-only gate validates defects; full coverage belongs to the independent full audit.');const legacy={...source};delete legacy.imported;assert.ok(!editorialCoverageJson(2,legacy).items.required.includes('unitId'));assert.doesNotThrow(()=>validateEditorialCoverage([valid[0]],legacy));
});

test('imported drawing cannot waive known missing evidence while a complete source permits style overrides',()=>{
 const source=original(),valid=coverage(source),doc={original:source,plan:{...plan,reflection:'Careful steps carry people safely.'},visualReview:{status:'blocked',round:1,repairs:20,issues:[{page:1,category:'composition',problem:'The view could be clearer.',instruction:'Clarify the viewpoint.'}],repaired:[],reports:[{coverage:valid}]}};
 assert.doesNotThrow(()=>assertImportedCoverageReady(doc));doc.visualReview.reports[0].coverage[0]={...valid[0],assessment:'needs-change',issuePage:1};assert.throws(()=>assertImportedCoverageReady(doc),/NOT_READY/);doc.visualReview.reports[0].coverage=valid.slice(1);assert.throws(()=>assertImportedCoverageReady(doc),/COVERAGE_INCOMPLETE/);doc.visualReview.reports=[];assert.throws(()=>assertImportedCoverageReady(doc),/UNREVIEWED/);assert.doesNotThrow(()=>assertImportedCoverageReady({...doc,original:{...source,imported:undefined}}));
});

test('shared review calls ask for full imported units only at the full gate and reject missing units',async()=>{
 const source=original(),selection={bookId:'other',customBook:'The River Crossing',storyTitle:'The River Crossing',theme:'Source story',artStyle:'ink-pencil',narrativeDetail:'balanced',length:'auto',productionPrompt:'',voice:false},calls=[];let missing=false;
 const generator=storyboardReviewGenerator(async(task,instructions,payload,schema)=>{calls.push({task,instructions,payload,schema});return {value:schema.properties.frameCountReview?{frameCountReview:{decision:'keep',proposedCount:2,reason:'Both actions have room.'},requirements:[]}:{titleReview:{title:plan.title,reason:'The title matches the source.'},issues:[],coverage:missing?coverage(source).slice(1):coverage(source)},model:'controlled',requestId:null,usage:null};});
 await generator.reviewFrameCount(selection,{...plan,reflection:'Careful steps can carry people safely.'},source);assert.ok(!calls[0].schema.properties.coverage);await generator.review(selection,{...plan,reflection:'Careful steps can carry people safely.'},source);assert.ok(calls[1].schema.properties.coverage.items.required.includes('unitId'));assert.equal(calls[1].payload.verifiedOriginal.importedPart.continuity.characters,source.imported.continuity.characters);missing=true;await assert.rejects(generator.review(selection,{...plan,reflection:'Careful steps can carry people safely.'},source),/COVERAGE_INCOMPLETE/);
});

test('the production engine retains a rejected imported storyboard, draws only after complete evidence, and exports part identity',async t=>{
 const f=await productionFixture(t);f.control.hold=false;f.control.autoLength=2;let missing=true;
 f.control.beforeText=async(kind,payload)=>{
  if(kind==='recommend')return {count:2,reason:'Two frames preserve the approach and safe arrival.',storySummary:plan.summary,storyMatchReason:'The source contains both actions.'};
  if(kind==='outline'){const {pages,...metadata}=plan;return {...metadata,beats:pages.map(page=>page.caption)};}
  if(kind==='batch')return {pages:plan.pages.slice(payload.batch.first-1,payload.batch.last)};
  if(kind==='plan')return plan;
  if(kind==='reflection')return {title:plan.title,candidates:['Careful steps can carry people safely.','Patience can make room for a safe crossing.','Trust can follow a path tested with care.']};
  if(kind==='review'){const entries=payload.verifiedOriginal.importedPart.coverageUnits.map(unit=>({unitId:unit.id,quote:unit.text.trim().slice(0,95),task:'Retain the source actions.',pages:[1,2],assessment:'adequate',reason:'The source approach and actual safe arrival remain visible.',issuePage:0}));return {issues:[],coverage:missing?entries.slice(1):entries};}
 };
 const id=randomUUID(),source=original(id),repo=new ReaderRepository(f.app.services.database),selection={bookId:'other',customBook:'The River Crossing',storyTitle:'The River Crossing',displayTitle:'The River Crossing — Part 2',theme:'Source story',artStyle:'ink-pencil',narrativeDetail:'balanced',length:'auto',productionPrompt:'',voice:false};
 await repo.create(id,'docker-local-owner',selection,{...emptyDocument(),original:source});
 await until(async()=>(await f.read(id)).state==='failed',15000);let saved=await f.read(id);
 assert.equal(saved.state,'failed');assert.match(saved.error,/verify every section/);assert.equal(f.control.calls.length,0);assert.ok(saved.story);assert.equal(saved.story.sourceText,text);assert.equal(f.control.plans.length,1);
 missing=false;const fault=saved.faults.find(fault=>fault.retryAllowed);assert.ok(fault);await f.json(`sessions/${id}/recover`,'POST',{requestId:randomUUID(),faultId:fault.id});await until(async()=>(await f.read(id)).state==='completed',15000);saved=await f.read(id);
 assert.equal(saved.state,'completed');assert.equal(f.control.calls.length,2);assert.equal(f.control.plans.length,1,'Recovery reuses the retained storyboard.');assert.equal(saved.story.title,selection.displayTitle);assert.equal(saved.story.series,undefined,'Unregistered provenance does not confer series membership.');assert.equal(saved.story.sourceText,text);assert.equal(f.control.reviews.at(-1).verifiedOriginal.importedPart.continuity.characters,source.imported.continuity.characters);
 const exportStory={...saved.story,series:{id:source.imported.seriesId,title:source.imported.seriesTitle,part:2,parts:2}};
 const data=storyZipData(exportStory,saved.story.pages.map((_,i)=>`图片/0${i+1}.webp`),[],null),publicData=publicStoryZipData(data);assert.deepEqual(publicData.series,exportStory.series);assert.equal(publicData.sourceText,text);assert.ok(new TextDecoder().decode(storyZipFiles(data)['分镜.md']).includes('Part 2 of 2'));
 const runtime=nativeExportRuntime(process.cwd(),f.app),pdf=await PDFDocument.load(await createStoryPdf(exportStory,()=>{},runtime));assert.equal(pdf.getTitle(),selection.displayTitle);assert.ok(pdf.getPageCount()>1);assert.ok((await createStoryPng(exportStory,()=>{},runtime)).size>100);
 const archive=new Uint8Array(await(await createStoryZip(exportStory,await f.json(`sessions/${id}/prompts`),()=>{},runtime)).arrayBuffer()),converted=publicStoryZip(archive),files=unzipSync(converted.bytes),exported=JSON.parse(strFromU8(files['故事.json']));assert.equal(exported.title,selection.displayTitle);assert.equal(exported.sourceText,text);assert.deepEqual(exported.series,exportStory.series);assert.equal(Object.keys(files).filter(name=>name.startsWith('图片/')).length,2);
 const row=await repo.get(id,'docker-local-owner'),copy={...row,id:randomUUID(),document:JSON.stringify({...JSON.parse(row.document),copiedFrom:{storyId:id,contentHash:'copy'}})};assert.equal(view(copy).story.series,undefined,'Copied provenance cannot grant active series membership.');
});
