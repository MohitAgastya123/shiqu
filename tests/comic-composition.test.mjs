// Exercise planned canvas/protected-region contracts through real providers, repairs and revisions.
// Controlled inference and isolated production storage retain source evidence and immutable image bytes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {comicCompositionSchema,comicCanvases,comicCanvasTarget} from '../lib/comic-composition.ts';
import {planSchema} from '../lib/reader-model.ts';
import {generatedPageJson,repairedPageJson,imagePrompt} from '../lib/reader-generation-contract.ts';
import {imageRequestSize,imageCanvasDirection} from '../lib/reader-image-dimensions.ts';
import {checkedRevision} from '../lib/reader-revision.ts';
import {applyStructuralEdits} from '../lib/reader-structure.ts';
import {createReaderProvider} from '../server/generation.ts';
import {productionFixture,until,makePlan,selection} from './fixtures/production.mjs';
import {png} from './fixtures/images.mjs';

const staging=(canvas='4:5')=>({canvas,focus:{x:.5,y:.55},protectedAreas:[{kind:'face',x:.2,y:.25,width:.2,height:.2},{kind:'action',x:.55,y:.55,width:.3,height:.2}]});

test('saved staging is additive, bounded and preserved by the canonical plan schema',()=>{
 const legacy=makePlan(2);assert.deepEqual(planSchema.parse(legacy),legacy);
 const plan=structuredClone(legacy);plan.pages[0].composition=staging();assert.deepEqual(planSchema.parse(plan).pages[0].composition,staging());
 for(const canvas of comicCanvases)assert.equal(comicCompositionSchema.parse(staging(canvas)).canvas,canvas);
 for(const value of [{...staging(),canvas:'square'},{...staging(),focus:{x:NaN,y:.5}},{...staging(),protectedAreas:[{kind:'face',x:.9,y:0,width:.2,height:.2}]},{...staging(),protectedAreas:[{kind:'face',x:0,y:0,width:0,height:.2}]},{...staging(),protectedAreas:Array.from({length:13},()=>staging().protectedAreas[0])}])assert.equal(comicCompositionSchema.safeParse(value).success,false);
 assert.ok(generatedPageJson.required.includes('composition'));assert.ok(!repairedPageJson.required.includes('composition'));assert.equal(repairedPageJson.properties.composition,generatedPageJson.properties.composition);
});

test('explicit canvases produce matching bounded sizes while legacy overrides remain exact',()=>{
 assert.deepEqual(imageRequestSize('720x1280'),{size:'720x1280',width:720,height:1280});assert.equal(imageRequestSize('1024x1536'),null);
 for(const canvas of comicCanvases){
  const target=comicCanvasTarget(canvas),native=imageRequestSize(undefined,canvas),override=imageRequestSize('720x1280',canvas),[x,y]=canvas.split(':').map(Number);
  assert.deepEqual(native,{size:`${target.width}x${target.height}`,...target});assert.equal(override.width*y,override.height*x);assert.ok(override.width*override.height<=720*1280);assert.ok(override.width*override.height>=655360);assert.equal(override.width%16,0);assert.equal(override.height%16,0);assert.match(imageCanvasDirection(canvas),new RegExp(canvas));
 }
 for(const value of ['auto','1x1','2304x4096','864x1536 injected'])assert.equal(imageRequestSize(value,'3:2'),null);
});

test('image prompts use explicit staging and remain independent of mutable panel and balloon layout',()=>{
 const plan=makePlan(2);plan.pages[0].composition=staging('3:2');
 const prompt=imagePrompt(plan,0,'ink-pencil','',false);assert.match(prompt,/3:2 landscape canvas/);assert.match(prompt,/1536 x 1024/);assert.match(prompt,/protectedAreas/);assert.doesNotMatch(prompt,/9:16 portrait canvas|static lianhuanhua/);
 const layout=structuredClone(plan);layout.pages[0].panel='splash';layout.pages[0].bubbles=[];assert.equal(imagePrompt(layout,0,'ink-pencil','',false),prompt);
 const historical=makePlan(2);assert.match(imagePrompt(historical,0,'ink-pencil','',false),/9:16 portrait canvas/);
});

for(const name of ['gemini','codex','openai'])test(`${name} requests each staged aspect and preserves returned native image bytes`,async()=>{
 const stored=new Map(),calls=[],media={get:async key=>{const bytes=stored.get(key);return bytes?{arrayBuffer:async()=>bytes.slice().buffer}:null;},put:async(key,bytes)=>stored.set(key,new Uint8Array(bytes))};
 const runner={status:async()=>({configured:true}),run:async job=>{calls.push(job);return {image:Buffer.from(png).toString('base64'),text:'',model:'controlled',requestId:'controlled',usage:null};}};
 const transport=async(_url,init)=>{calls.push(JSON.parse(init.body));return name==='openai'?Response.json({data:[{b64_json:Buffer.from(png).toString('base64')}]}):Response.json({candidates:[{finishReason:'STOP',content:{parts:[{inlineData:{mimeType:'image/png',data:Buffer.from(png).toString('base64')}}]}}]});};
 const provider=createReaderProvider({SHIQU_AI_PROVIDER:name,GEMINI_API_KEY:'controlled',OPENAI_API_KEY:'controlled'},media,transport,runner),plan=makePlan(3);
 for(const [index,canvas]of ['4:5','3:2','2:3'].entries()){
  plan.pages[index].composition=staging(canvas);await provider.generator().image(plan,index,'canvas-fixture','');assert.deepEqual(stored.get(`reader/canvas-fixture/${index}.png`),new Uint8Array(png));const call=calls.at(-1);
  if(name==='gemini')assert.deepEqual(call.generationConfig.imageConfig,{aspectRatio:canvas,imageSize:'1K'});
  else if(name==='openai')assert.equal(call.size,imageRequestSize(undefined,canvas).size);
  else{assert.equal(call.generateImage,true);assert.match(call.prompt,new RegExp(canvas));assert.match(call.prompt,/Planned scene geometry/);}
 }
});

test('real image staging changes affect revision reuse, while panel-only layout keeps review and artwork',()=>{
 const base={selection,plan:makePlan(3),images:['a','b','c']};base.plan.pages.forEach(page=>page.composition=staging());
 const panel=structuredClone(base.plan);panel.pages[1].panel='wide';const layout=checkedRevision(base,{plan:panel}).impact;assert.equal(layout.review,false);assert.equal(layout.redraw,0);
 const changed=structuredClone(base.plan);changed.pages[1].composition=staging('3:2');const next=checkedRevision(base,{plan:changed}).impact;assert.equal(next.review,false);assert.equal(next.redraw,1);
 changed.pages[0].composition.focus.x=.6;const anchor=checkedRevision(base,{plan:changed}).impact;assert.equal(anchor.redraw,3);assert.equal(anchor.review,false);
});

test('manual scene rewrites clear stale copied staging but retain explicitly revised geometry',()=>{
 const base={selection,plan:makePlan(3),images:['a','b','c']};base.plan.pages.forEach(page=>page.composition=staging());
 const changed=structuredClone(base.plan);changed.pages[1].prompt='The traveler moves to the far bank beneath the old bridge.';
 const revision=checkedRevision(base,{plan:changed});assert.equal(revision.plan.pages[1].composition,undefined);assert.equal(revision.impact.review,true);assert.equal(revision.impact.redraw,1);assert.deepEqual(changed.pages[1].composition,staging());assert.deepEqual(base.plan.pages[1].composition,staging());
 changed.pages[1].composition=staging('3:2');const explicit=checkedRevision(base,{plan:changed});assert.deepEqual(explicit.plan.pages[1].composition,staging('3:2'));assert.equal(explicit.impact.redraw,1);
});

test('structural retention preserves saved staging for matching prompts without inheriting it into a new scene',()=>{
 const legacy=makePlan(2),captionOnly={...legacy.pages[0],caption:'A changed caption.',composition:staging('3:2')};const retained=applyStructuralEdits(legacy,{edits:[{from:1,to:1,pages:[captionOnly]}]});assert.equal(retained.plan.pages[0].composition,undefined);
 const current=makePlan(2);current.pages[0].composition=staging();const unchanged=applyStructuralEdits(current,{edits:[{from:1,to:1,pages:[{...current.pages[0],caption:'A revised caption.',composition:staging('3:2')}]}]});assert.deepEqual(unchanged.plan.pages[0].composition,staging());
 const rewritten={...current.pages[0],prompt:'The traveler reaches a different bridge as the sun sets.'};delete rewritten.composition;assert.equal(applyStructuralEdits(current,{edits:[{from:1,to:1,pages:[rewritten]}]}).plan.pages[0].composition,undefined);
});

for(const annotated of [false,true])test(`production caption repair retains ${annotated?'saved staging':'legacy absence'} and explicit staging revision draws only one changed frame`,async t=>{
 const f=await productionFixture(t);f.control.hold=false;
 f.control.beforeText=async(kind,payload)=>{
  if(kind==='plan'){const plan=makePlan(payload.exactPageCount);if(annotated)plan.pages.forEach(page=>page.composition=staging());return plan;}
  if(kind==='review')return {issues:f.control.reviews.length===1?[{page:2,category:'caption',problem:'A source-grounded caption clarification is needed.',instruction:'Clarify only the caption.',requiresReplan:false}]:[]};
  if(kind==='repair')return {pages:[{page:2,...payload.plan.pages[1],caption:payload.plan.pages[1].caption+' The crossing is now clear.',composition:staging('3:2')}]};
 };
 const id=await f.create(3);await until(async()=>(await f.read(id)).state==='completed');const saved=await f.read(id);assert.deepEqual(saved.story.pages[1].composition,annotated?staging():undefined);
 const base=await f.json(`sessions/${id}/revisions`),plan=structuredClone(base.plan);plan.pages[1].composition=staging('3:2');const before={images:f.control.calls.length,reviews:f.control.reviews.length,plans:f.control.plans.length};
 const revised=await f.json(`sessions/${id}/revisions`,'POST',{requestId:crypto.randomUUID(),token:base.token,changes:{plan}});await until(async()=>(await f.read(revised.id)).state==='completed');
 assert.equal(f.control.calls.length,before.images+1);assert.equal(f.control.reviews.length,before.reviews);assert.equal(f.control.plans.length,before.plans);assert.equal((await f.read(revised.id)).story.pages[1].composition.canvas,'3:2');await f.restart();assert.equal((await f.read(revised.id)).story.pages[1].composition.canvas,'3:2');
});
