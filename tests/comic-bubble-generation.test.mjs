// Exercise automatic, evidence-backed balloons through the same production queue, repairs and saved history.
import test from 'node:test';
import assert from 'node:assert/strict';
import {comicBubbleSchema,pageBubblesSchema,comicBubbleJsonSchema,autoPlaceBubbles,validateBubbleEvidence,BubbleDensityError} from '../lib/reader-bubbles.ts';
import {fitBubbleText,computeBubbleLayout} from '../lib/comic-bubble-layout.ts';
import {planSchema,storyboardBatchSchema} from '../lib/reader-model.ts';
import {storyDraftJson,imagePrompt} from '../lib/reader-generation-contract.ts';
import {applyStructuralEdits,structuralEditsJson} from '../lib/reader-structure.ts';
import {storyReviewHistory} from '../lib/reader-review-history.ts';
import {ReaderRepository} from '../lib/reader-repository.ts';
import {advanceStory} from '../lib/reader-engine.ts';
import {productionFixture,makePlan,until} from './fixtures/production.mjs';

const owner='docker-local-owner';
const source='Mara said, "We should cross before sunset." She then thought that caution mattered more than speed. Ivo answered, "I will follow the safer path."';
const balloon=(overrides={})=>({id:'mara-speech',kind:'speech',speaker:'Mara',text:'We should cross before sunset.',x:.05,y:.05,width:.4,height:.2,tailX:.3,tailY:.78,sourceQuote:'Mara said, "We should cross before sunset."',...overrides});
const thought=()=>balloon({id:'mara-thought',kind:'thought',text:'Caution matters more than speed.',tailX:.3,sourceQuote:'She then thought that caution mattered more than speed.'});
const page=(bubbles=[balloon(),thought()])=>({caption:'',prompt:'Mara stands beside the river in the lower left, her face near normalized x=0.3 y=0.78; Ivo waits at the lower right.',bubbles});
const document=async(f,id)=>JSON.parse((await f.app.services.production.repository.get(id,owner)).document);
const plan=()=>({...makePlan(2),title:'The River Crossing',summary:'Mara and Ivo choose a careful crossing before sunset.',sourceReference:'The River Crossing',adaptationNote:'A source-grounded English adaptation.',reflection:'Caution gives their choice its shape.',pages:[page(),{caption:'Ivo chooses the safer path.',prompt:'Ivo walks beside the river below open sky while Mara watches from the bank.',bubbles:[]}]});

async function fixture(t){
 const f=await productionFixture(t);f.control.hold=false;
 f.control.translateSource=()=>({title:'The River Crossing',text:source});
 f.control.beforeText=async(kind)=>kind==='plan'?plan():kind==='recommend'?{storySummary:plan().summary,storyMatchReason:'The saved source contains the spoken exchange and explicit thought.'}:undefined;
 return f;
}

test('saved page schema is additive, allows empty narration and validates bounded unique balloon fields',()=>{
 const old=makePlan(2),parsed=planSchema.parse(old);assert.deepEqual(parsed,old);assert.equal(parsed.pages[0].bubbles,undefined);
 assert.equal(planSchema.parse(plan()).pages[0].caption,'');assert.equal(storyboardBatchSchema(1).parse({pages:[page()]}).pages[0].bubbles.length,2);
 for(const invalid of [{x:NaN},{x:Infinity},{width:0},{x:.8,width:.3},{y:.9,height:.2},{tailY:1.1},{text:'x'.repeat(221)},{speaker:'x'.repeat(81)}])assert.equal(comicBubbleSchema.safeParse(balloon(invalid)).success,false);
 assert.equal(pageBubblesSchema.safeParse([balloon(),balloon()]).success,false);assert.equal(pageBubblesSchema.safeParse(Array.from({length:5},(_,index)=>balloon({id:String(index)}))).success,false);
 assert.ok(comicBubbleJsonSchema.required.includes('sourceQuote'));assert.ok(storyDraftJson(2).properties.pages.items.required.includes('bubbles'));assert.ok(structuralEditsJson(2).properties.edits.items.properties.pages.items.required.includes('bubbles'));
});

test('generation evidence is an exact source quotation, including explicit thought attribution',()=>{
 validateBubbleEvidence([page()],source);
 assert.throws(()=>validateBubbleEvidence([page([balloon({sourceQuote:undefined})])],source),/exact quotation/);
 assert.throws(()=>validateBubbleEvidence([page([thought(),balloon({sourceQuote:'Mara promised that no danger existed.'})])],source),/exact quotation/);
 validateBubbleEvidence([page([balloon({sourceQuote:'Mara said,\n "We should cross before sunset."'})])],source);
});

test('automatic placement is deterministic, readable, ordered and preserves speaker targets without mutating input',()=>{
 const input=[balloon(),thought()],original=structuredClone(input),placed=autoPlaceBubbles(input);
 assert.deepEqual(input,original);assert.deepEqual(autoPlaceBubbles(input),placed);assert.deepEqual(placed.map(({id,text,sourceQuote,tailX,tailY})=>({id,text,sourceQuote,tailX,tailY})),original.map(({id,text,sourceQuote,tailX,tailY})=>({id,text,sourceQuote,tailX,tailY})));
 for(const bubble of placed){assert.ok(bubble.x>=0&&bubble.y>=0&&bubble.x+bubble.width<=1&&bubble.y+bubble.height<=.60000001);assert.ok(bubble.y+bubble.height>=.55);const fit=fitBubbleText(bubble.text,bubble.width*900,bubble.height*1350,bubble.kind,bubble.speaker);assert.ok(fit.fontSize>=26);assert.doesNotThrow(()=>computeBubbleLayout(bubble,900,1350));}
 const [a,b]=placed;assert.ok(a.x+a.width<=b.x||a.y+a.height<=b.y||b.x+b.width<=a.x||b.y+b.height<=a.y);
});

test('long words, multiple thought clouds and maximum density have explicit readable outcomes',()=>{
 const long=autoPlaceBubbles([balloon({text:'W'.repeat(180)})]);assert.equal(long[0].text,'W'.repeat(180));assert.ok(fitBubbleText(long[0].text,long[0].width*900,long[0].height*1350,'speech','Mara').lines.length>2);
 const thoughts=autoPlaceBubbles(Array.from({length:4},(_,index)=>thoughtWith(index)));assert.equal(thoughts.length,4);assert.ok(thoughts.every(bubble=>computeBubbleLayout(bubble,900,1350).circles.length===3));
 const dense=Array.from({length:4},(_,index)=>thoughtWith(index,{text:'W'.repeat(220),speaker:'W'.repeat(80)}));assert.throws(()=>autoPlaceBubbles(dense),BubbleDensityError);assert.ok(dense.every(bubble=>bubble.text.length===220));
 assert.throws(()=>autoPlaceBubbles([balloon({tailX:.5,tailY:.04})]),BubbleDensityError);
 assert.throws(()=>autoPlaceBubbles([balloon({tailX:.85}),balloon({id:'other',tailX:.15})]),BubbleDensityError);
 function thoughtWith(index,overrides={}){return balloon({id:'thought-'+index,kind:'thought',text:'I should wait.',tailX:.13+index*.24,tailY:.82,...overrides});}
});

test('image prompt stays textless and unchanged by editable balloon content or geometry',()=>{
 const original=plan(),changed=structuredClone(original);changed.pages[0].bubbles[0]={...changed.pages[0].bubbles[0],text:'Wait for me.',x:.5,y:.2,tailX:.8};
 const before=imagePrompt(original,0,'ink-pencil','',false);assert.equal(imagePrompt(changed,0,'ink-pencil','',false),before);assert.match(before,/upper 60%/);assert.match(before,/No text/);assert.doesNotMatch(before,/We should cross|sourceQuote/);
});

test('production automatically places source-grounded speech and thought before drawing and retains them after restart',async t=>{
 const f=await fixture(t),id=await f.createLegacyReader(2);await f.demand(id,crypto.randomUUID(),1);await until(async()=>(await f.read(id)).state==='completed');
 const saved=await document(f,id);assert.equal(saved.plan.pages[0].bubbles.length,2);assert.equal(saved.plan.pages[0].bubbles[1].kind,'thought');assert.notEqual(saved.plan.pages[0].bubbles[0].height,.2);assert.equal(saved.plan.pages[0].bubbles[0].tailY,.78);assert.equal(f.control.calls.length,2);assert.equal(saved.visualReview.status,'passed');
 assert.deepEqual(f.control.reviews[0].plan.pages[0].bubbles,saved.plan.pages[0].bubbles);assert.equal((await f.read(id)).story.pages[0].bubbles[0].speaker,'Mara');
 await f.restart();assert.deepEqual((await f.read(id)).story.pages[0].bubbles,saved.plan.pages[0].bubbles);
});

test('density gets one production retry with feedback and retained usage; exhausted density stops before artwork',async t=>{
 const f=await fixture(t),id=await f.createLegacyReader(2),repo=new ReaderRepository(f.app.services.database),generator=f.generation.generator();let attempts=0;
 const dense=Array.from({length:4},(_,index)=>balloon({id:'dense-'+index,kind:'thought',text:'W'.repeat(220),speaker:'W'.repeat(80),tailX:.13+index*.24}));
 f.control.beforeText=async(kind,payload)=>kind==='recommend'?{storySummary:plan().summary,storyMatchReason:'Supported by the source.'}:kind==='plan'?((++attempts===1)?{...plan(),pages:[page(dense),plan().pages[1]]}:(assert.match(payload.bubblePlacementRetry.message,/Shorten|shorten/),assert.equal(payload.bubblePlacementRetry.previousPages[0].bubbles.length,4),plan())):undefined;
 for(let step=0;step<10&&!(await document(f,id)).draft;step++)await advanceStory(repo,generator,owner,id,0);
 const saved=await document(f,id);assert.equal(attempts,2);assert.equal(saved.draft.pages[0].bubbles.length,2);assert.equal(saved.usage.filter(call=>call.step==='plan:bubble-placement:1').length,1);assert.equal(f.control.calls.length,0);
 const blocked=await f.createLegacyReader(2);attempts=0;f.control.beforeText=async kind=>kind==='plan'?(attempts++,{...plan(),pages:[page(dense),plan().pages[1]]}):undefined;
 for(let step=0;step<10&&(await f.read(blocked)).state!=='failed';step++)await advanceStory(repo,generator,owner,blocked,0);
 const failed=await f.read(blocked);assert.equal(failed.state,'failed');assert.match(failed.error,/too dense/);assert.equal(attempts,2);assert.equal(f.control.calls.length,0);assert.equal((await document(f,blocked)).usage.filter(call=>call.step.startsWith('plan:bubble-placement:')).length,2);
});

test('local balloon-only repairs count as changes and persist complete before/after history',async t=>{
 const f=await fixture(t),id=await f.createLegacyReader(2);let repairs=0;
 f.control.beforeText=async(kind,payload)=>kind==='plan'?plan():kind==='review'?(f.control.reviews.length===1?{issues:[{page:1,category:'caption',problem:'The speaker needs the source wording.',instruction:'Correct only the first balloon text.',requiresReplan:false}]}:{issues:[]}):kind==='repair'?(repairs++,{pages:[{page:1,...payload.plan.pages[0],bubbles:payload.plan.pages[0].bubbles.map((bubble,index)=>index?bubble:{...bubble,text:'We should cross before sunset!'})}]}):undefined;
 await f.demand(id,crypto.randomUUID(),1);await until(async()=>(await f.read(id)).state==='completed');const row=await f.app.services.production.repository.get(id,owner),saved=JSON.parse(row.document),history=storyReviewHistory(row),repair=history.entries.find(entry=>entry.kind==='repair');
 assert.equal(repairs,1);assert.equal(saved.plan.pages[0].bubbles[0].text,'We should cross before sunset!');assert.equal(repair.outcome,'changed');assert.equal(repair.repair.pages[0].before.bubbles[0].text,'We should cross before sunset.');assert.equal(repair.repair.pages[0].after.bubbles[0].text,'We should cross before sunset!');assert.equal(saved.visualReview.history[0].changed,true);
});

test('structural edits retain balloon data and legacy pages unchanged',()=>{
 const original=plan(),replacement={...original.pages[0],bubbles:autoPlaceBubbles(original.pages[0].bubbles)},edited=applyStructuralEdits(original,{edits:[{from:1,to:1,pages:[replacement]}]});assert.deepEqual(edited.plan.pages[0].bubbles,replacement.bubbles);assert.deepEqual(edited.plan.pages[1],original.pages[1]);assert.equal(edited.sourcePages[0],0);
});


test('production storyboard batches automatically fit balloons and retain their exact saved evidence',async t=>{
 const f=await fixture(t);f.control.hold=true;
 f.control.beforeText=async(kind,payload)=>kind==='batch'?{pages:Array.from({length:payload.batch.last-payload.batch.first+1},(_,index)=>page(index===0?[balloon()]:[]))}:undefined;
 const id=await f.createLegacyReader(21);await f.demand(id);await until(()=>f.control.calls.length===1);
 const saved=await document(f,id);assert.equal(saved.plan.pages.length,21);assert.equal(f.control.batches.length,2);assert.deepEqual(f.control.batches[1].previousPages,saved.plan.pages.slice(0,20));assert.equal(saved.plan.pages[20].bubbles[0].sourceQuote,balloon().sourceQuote);assert.ok(saved.plan.pages[20].bubbles[0].y>.3);
});

test('production structural repair retains source-backed balloons and records them before the final review',async t=>{
 const f=await fixture(t);f.control.autoLength=2;
 f.control.beforeText=async(kind,payload)=>kind==='batch'?{pages:[page(),plan().pages[1]]}:kind==='review'?(f.control.reviews.length===1?{issues:[{page:1,category:'continuity',problem:'The staged speaker needs corrected continuity.',instruction:'Replace only the first frame while keeping its dialogue.',requiresReplan:true}]}:{issues:[]}):kind==='structure'?{characters:null,edits:[{from:1,to:1,pages:[{...page(),prompt:page().prompt+' Her right hand rests on the railing.'}]}]}:undefined;
 const id=await f.createLegacyReader('auto');await f.demand(id,crypto.randomUUID(),1);await until(async()=>(await f.read(id)).state==='completed');const saved=await document(f,id);
 assert.equal(f.control.structures.length,1);assert.equal(saved.visualReview.status,'passed');assert.equal(saved.plan.pages[0].bubbles[1].kind,'thought');assert.equal(saved.visualReview.history[0].structure.edits[0].pages[0].bubbles[0].sourceQuote,balloon().sourceQuote);assert.equal(f.control.reviews.at(-1).plan.pages[0].bubbles.length,2);
});
