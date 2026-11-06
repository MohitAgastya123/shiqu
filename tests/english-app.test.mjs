// Verify English source checkpoints through production helpers, with isolated synthetic evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceTranslationChunks,translateSourceCheckpoint,englishTranslationSchema,sourceTranslationChunkSize} from '../lib/reader-source-english.ts';
import {englishOriginal,sourceTranslationReady} from '../lib/reader-source-types.ts';
import {selectionSchema,nextStep,planSchema} from '../lib/reader-model.ts';
import {storyboardGenerator} from '../lib/reader-storyboard.ts';
import {frameRecommendationOutputJson,frameRecommendationOutputSchema} from '../lib/reader-frame-recommendation.ts';
const source=()=>({title:'梦蝶',text:'庄周梦为蝴蝶。醒后，不知庄周梦蝶，还是蝴蝶梦庄周。',provider:'维基文库',url:'https://example.test/source',retrievedAt:'2026-11-05T00:00:00Z',kind:'passage',localSource:{edition:'a'.repeat(64),sectionId:'section',firstUnit:'u1',lastUnit:'u2'}});
const generated=value=>({value,model:'controlled',requestId:'controlled',usage:{calls:1}});

test('untranslated or partial evidence is never exposed as an English source',async()=>{
 const original=source();assert.equal(englishOriginal(original),null);assert.equal(sourceTranslationReady(original),false);
 original.translationProgress={parts:['Zhuang Zhou dreamed he was a butterfly.'],titles:['The Butterfly Dream']};
 assert.equal(englishOriginal(original),null);
});
test('source translation checkpoints preserve raw evidence, provenance and exact source identity',async()=>{
 const original=source(),before=structuredClone(original);let calls=0;
 await translateSourceCheckpoint(original,{async translateSource(text,title){calls++;assert.equal(text,before.text);assert.equal(title,before.title);return generated({title:'The Butterfly Dream',text:'Zhuang Zhou dreamed he was a butterfly. On waking, he wondered whether Zhou had dreamed of a butterfly or a butterfly was dreaming of Zhou.'});}});
 assert.equal(calls,1);assert.equal(original.text,before.text);assert.deepEqual(original.localSource,before.localSource);
 const english=englishOriginal(original);assert.ok(english);assert.match(english.text,/Zhuang Zhou/);assert.doesNotMatch(JSON.stringify(english),/\p{Script=Han}/u);assert.equal(english.url,before.url);assert.equal(english.translationProgress,undefined);
 await translateSourceCheckpoint(original,{translateSource:()=>assert.fail('A saved translation must not be regenerated')});
});
test('large complete chapters translate in bounded restartable chunks without truncation',async()=>{
 const original=source();original.chapterContext={title:'齐物论',text:'庄周梦为蝴蝶。'.repeat(900),source:original.localSource};
 const chunks=sourceTranslationChunks(original);assert.ok(chunks.length>3);assert.equal(chunks.filter(c=>c.field==='chapterText').map(c=>c.text).join(''),original.chapterContext.text);
 assert.ok(chunks.every(c=>Array.from(c.text).length<=sourceTranslationChunkSize));
 let count=0;const translator={async translateSource(){count++;return generated({title:'On the Equality of Things',text:`English translation segment ${count}, preserving the narrative.`});}};
 await translateSourceCheckpoint(original,translator);assert.equal(englishOriginal(original),null);assert.equal(original.translationProgress.parts.length,1);
 const resumed=JSON.parse(JSON.stringify(original));while(!sourceTranslationReady(resumed))await translateSourceCheckpoint(resumed,translator);
 assert.equal(count,chunks.length);assert.ok(englishOriginal(resumed).chapterContext.text.includes(`segment ${count}`));assert.equal(resumed.translationProgress,undefined);
});
test('a failed translation preserves completed chunks and never falls back to Chinese',async()=>{
 const original=source();original.text+='梦'.repeat(4000);
 await translateSourceCheckpoint(original,{async translateSource(){return generated({title:'A Dream',text:'First complete English segment.'});}});
 await assert.rejects(translateSourceCheckpoint(original,{async translateSource(){throw Error('controlled outage');}}),/controlled outage/);
 assert.equal(original.translationProgress.parts.length,1);assert.equal(englishOriginal(original),null);
});
test('translation schema rejects untranslated responses and unavailable providers fail explicitly',async()=>{
 assert.equal(englishTranslationSchema.safeParse({title:'Dream',text:'庄周梦蝶'}).success,false);
 await assert.rejects(translateSourceCheckpoint(source(),{}),/English source translation is unavailable/);
});
test('English source text needs no paid translation and is kept intact',async()=>{
 const original={...source(),title:'The Butterfly Dream',text:'Zhuang Zhou dreamed that he was a butterfly.',provider:'Wikisource'};
 assert.equal(sourceTranslationReady(original),true);await translateSourceCheckpoint(original,{});assert.equal(englishOriginal(original).text,original.text);
});
test('the shared provider storyboard adapter supplies faithful English translation with bounded output',async()=>{
 const calls=[];const generator=storyboardGenerator(()=> 'Zhuangzi',async(...args)=>{calls.push(args);return generated({title:'The Butterfly Dream',text:'Zhuang Zhou dreamed he was a butterfly.'});});
 const result=await generator.translateSource(source().text,source().title);assert.match(result.value.text,/Zhuang Zhou/);
 const [task,instructions,payload,schema,budget]=calls[0];assert.equal(task,'plan');assert.match(instructions,/English/);assert.equal(payload.text,source().text);assert.ok(budget>=4096);assert.ok(schema.properties.text.maxLength>=10000);
});
test('preparation uses a distinct checkpoint key for each translated source chunk',()=>{
 const original=source(),selection=selectionSchema.parse({bookId:'zhuangzi',theme:'Original story',narrativeDetail:'balanced'});
 const doc={plan:null,images:[],audio:[],usage:[],original};assert.match(nextStep(doc,selection,0).key,/translation/);
 original.translationProgress={parts:['First English section'],titles:['Dream']};assert.notEqual(nextStep(doc,selection,0).key,'recommend:translation:0');
});
test('recommendation JSON and runtime schemas accept natural English prose',()=>{
 const original=source();original.storyBrief={summary:'An English source summary.',matchReason:'The source supports this story.',verified:false};
 const value={count:8,reason:'A complete narrative needs enough room for the actions and their consequences. '.repeat(3),storySummary:'A complete English summary. '.repeat(20),storyMatchReason:'The original passage supports the selected theme.'};
 assert.equal(frameRecommendationOutputSchema(original).safeParse(value).success,true);assert.equal(frameRecommendationOutputJson(original).properties.reason.maxLength,720);
});
test('an English page caption can exceed the old Chinese character budget',()=>{
 const english={title:'The Butterfly Dream',summary:'Zhuang Zhou dreams and then reflects on waking.',sourceReference:'Zhuangzi, On the Equality of Things',adaptationNote:'An English adaptation grounded in the source.',reflection:'The boundary between dream and waking can unsettle certainty.',characters:'Zhuang Zhou is an adult philosopher wearing a plain linen robe.',pages:[{caption:'Zhuang Zhou woke from a vivid dream of being a butterfly, yet the feeling of freedom lingered and made him question which life was the dream.',prompt:'An adult philosopher sits beside a tree in a quiet garden, his expression thoughtful.'}]};
 assert.equal(planSchema.safeParse(english).success,true);
});

test('the real production queue saves English source before completing a story',async t=>{
 const {productionFixture,until}=await import('./fixtures/production.mjs');
 const f=await productionFixture(t);f.control.hold=false;const id=await f.create(2);
 await until(async()=>(await f.read(id)).state==='completed');
 const session=await f.read(id);assert.ok(session.story.sourceText);assert.doesNotMatch(session.story.sourceText,/\p{Script=Han}/u);
 const row=await f.app.services.production.repository.get(id,'docker-local-owner'),doc=JSON.parse(row.document);
 assert.ok(doc.original.englishSource);assert.match(doc.original.text,/\p{Script=Han}/u,'Verified source evidence remains available to the source resolver');
 assert.ok(doc.usage.some(call=>call.step.startsWith('recommend')));assert.equal(f.control.calls.length,2);
 const before=doc.usage.length;await f.json(`sessions/${id}/source`);await f.json(`sessions/${id}/source`);assert.equal(JSON.parse((await f.app.services.production.repository.get(id,'docker-local-owner')).document).usage.length,before,'Opening the source is read-only');
});
test('explicit source translation serializes concurrent requests and preserves paused control',async t=>{
 const {productionFixture}=await import('./fixtures/production.mjs');const f=await productionFixture(t);
 const id=await f.create(2);await f.json(`sessions/${id}/production-control`,'POST',{action:'pause'});
 let row=await f.app.services.production.repository.get(id,'docker-local-owner'),doc=JSON.parse(row.document);doc.original=source();
 await f.app.services.database.prepare("UPDATE stories SET document=?,selection=json_set(selection,'$.source',json(?)),state='completed',step_key='image:1',step_attempts=2 WHERE id=?").bind(JSON.stringify(doc),JSON.stringify(doc.original.localSource),id).run();
 let entered,release;const started=new Promise(r=>entered=r),wait=new Promise(r=>release=r),factory=f.generation.generator.bind(f.generation);let calls=0;
 f.generation.generator=()=>({...factory(),async translateSource(){calls++;entered();await wait;return generated({title:'The Butterfly Dream',text:'Zhuang Zhou dreamed he was a butterfly and woke uncertain about the distinction.'});}});
 const first=f.request(`sessions/${id}/source`,'POST',{});await started;
 assert.equal((await f.request(`sessions/${id}/source`,'POST',{})).status,409);release();
 const response=await first;assert.equal(response.status,200);assert.equal(calls,1);assert.doesNotMatch((await response.json()).source.text,/\p{Script=Han}/u);
 row=await f.app.services.production.repository.get(id,'docker-local-owner');assert.equal(row.generation_control,'paused');assert.equal(row.state,'completed');assert.equal(row.step_key,'image:1');assert.equal(row.step_attempts,2);
 assert.equal(JSON.parse(row.document).usage.at(-1).step,'source-translation');
});

// Display names also reach export metadata instead of leaking saved canonical theme values.
test('shared English theme labels preserve IDs while making export descriptions English',async()=>{
 const {themeLabel}=await import('../lib/reader-language.ts');
 assert.equal(themeLabel('人情冷暖'),'Human warmth and indifference');assert.equal(themeLabel('原典故事'),'Original story');assert.equal(themeLabel('My own theme'),'My own theme');
});


test('a new stop command prevents later paid source chunks while retaining the finished chunk',async t=>{
 const {productionFixture}=await import('./fixtures/production.mjs');const f=await productionFixture(t);
 const id=await f.create(2);await f.json(`sessions/${id}/production-control`,'POST',{action:'pause'});
 const row=await f.app.services.production.repository.get(id,'docker-local-owner'),doc=JSON.parse(row.document);doc.original=source();doc.original.text+='梦'.repeat(4000);
 await f.app.services.database.prepare("UPDATE stories SET document=?,selection=json_set(selection,'$.source',json(?)),state='completed' WHERE id=?").bind(JSON.stringify(doc),JSON.stringify(doc.original.localSource),id).run();
 const factory=f.generation.generator.bind(f.generation);let calls=0;
 f.generation.generator=()=>({...factory(),async translateSource(){calls++;await f.json(`sessions/${id}/production-control`,'POST',{action:'stop'});return generated({title:'The Butterfly Dream',text:'The first complete English translation segment.'});}});
 const response=await f.request(`sessions/${id}/source`,'POST',{});assert.equal(response.status,409);assert.equal(calls,1);
 const saved=await f.app.services.production.repository.get(id,'docker-local-owner');assert.equal(saved.generation_control,'stopped');assert.equal(JSON.parse(saved.document).original.translationProgress.parts.length,1);assert.equal(JSON.parse(saved.document).original.englishSource,undefined);
});
