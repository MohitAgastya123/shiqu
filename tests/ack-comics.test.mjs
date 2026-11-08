// Exercise ACK selection through current production schemas, provider adapters, shared UI and archive metadata.
// Keep historical discovery contracts fixed and use controlled providers and synthetic saved rows only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createCanvas} from '@napi-rs/canvas';
import {build} from 'esbuild';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {artStyleIds,artStyleGroups,artStyles,getArtStyle} from '../lib/reader-styles.ts';
import {selectionSchema,view} from '../lib/reader-model.ts';
import {setupSettingsSchema} from '../lib/reader-intake.ts';
import {storyImportSettingsSchema,defaultStoryImportSettings} from '../lib/story-import-contract.ts';
import {revisionChangesSchema,checkedRevision} from '../lib/reader-revision.ts';
import {artRecommendationSchema,artRecommendationJson,selectSuggestedStory} from '../lib/reader-art-recommendation.ts';
import {choicesJson} from '../lib/reader-generation-contract.ts';
import {localChoicesJson,legacyLocalScanJson,legacyLocalReadingPrompt} from '../lib/reader-local-contract.ts';
import {createReaderProvider} from '../server/generation.ts';
import {storyZipData,publicStoryZipData,storyZipFiles} from '../lib/reader-zip-content.ts';
import {webpPayloadHash} from '../lib/story-webp-metadata.ts';

const previousStyleIds=['ink-pencil','ink-wash','vintage-comic','baimiao','cinematic','watercolor','gongbi','woodblock','paper-cut','cartoon','line-art','chibi','3d-animation','clay','classical-oil'];
const settings={artStyle:'ack-comics',productionPrompt:'',narrativeDetail:'balanced'};
const choice=()=>selectionSchema.parse({bookId:'other',customBook:'A Modern Rescue',storyTitle:'The Lost Kitten',theme:'Source story',length:1,...settings});
const makePlan=()=>({title:'The Lost Kitten',summary:'Mia patiently rescues a kitten from a shallow puddle and returns it to its owner.',sourceReference:'The Lost Kitten',adaptationNote:'A source-grounded English comic.',reflection:'Patience makes room for kindness.',characters:'Mia: a modern child in a yellow raincoat and red scarf, with short brown hair.',pages:[{caption:'Mia waits beside the kitten.',prompt:'In a modern village park, Mia kneels beside a shallow puddle and an orange kitten. Her yellow raincoat, red scarf and the kitten remain clearly visible.',bubbles:[],panel:'normal',composition:{canvas:'4:5',focus:{x:.5,y:.55},protectedAreas:[{kind:'face',x:.32,y:.18,width:.18,height:.16},{kind:'action',x:.42,y:.52,width:.35,height:.25}]}}]});

test('ACK is one grouped selectable style while every previous style and default remains intact',()=>{
 assert.equal(artStyleIds.length,16);assert.deepEqual(artStyleIds.filter(id=>id!=='ack-comics'),previousStyleIds);
 assert.deepEqual(artStyles.map(style=>style.id),[...artStyleIds]);assert.equal(new Set(artStyleIds).size,artStyleIds.length);
 const grouped=artStyleGroups.flatMap(group=>group.ids);assert.deepEqual([...grouped].sort(),[...artStyleIds].sort());assert.equal(grouped.filter(id=>id==='ack-comics').length,1);
 assert.ok(artStyleGroups.find(group=>group.label==='Classical and folk art').ids.includes('ack-comics'));
 const ack=getArtStyle('ack-comics');assert.equal(ack.label,'ACK comics');assert.notEqual(ack,getArtStyle('ink-pencil'));
 assert.equal(selectionSchema.parse({bookId:'other',theme:'Source story'}).artStyle,'ink-pencil');assert.equal(defaultStoryImportSettings.artStyle,'ink-pencil');
});

test('creation, import, recommendation and revision use the same ACK identity without changing source facts',()=>{
 const selected=choice();assert.equal(selected.artStyle,'ack-comics');assert.equal(setupSettingsSchema.parse(settings).artStyle,'ack-comics');assert.equal(storyImportSettingsSchema.parse(settings).artStyle,'ack-comics');
 const recommendation=artRecommendationSchema.parse({artStyle:'ack-comics',reason:'Expressive ink and flat colour suit this clear action.'});
 assert.equal(selectSuggestedStory({...selected,storyTitle:undefined},{title:'The Lost Kitten',artRecommendation:recommendation}).artStyle,'ack-comics');
 assert.deepEqual(revisionChangesSchema.parse({artStyle:'ack-comics'}),{artStyle:'ack-comics'});
 const plan=makePlan(),base={selection:{...selected,artStyle:'ink-pencil'},plan,images:['/saved-original.webp']};
 const edited=checkedRevision(base,{artStyle:'ack-comics'});assert.equal(edited.selection.artStyle,'ack-comics');assert.equal(edited.selection.customBook,'A Modern Rescue');assert.deepEqual(edited.plan,plan);
 assert.equal(edited.impact.replan,false);assert.equal(edited.impact.review,false);assert.equal(edited.impact.redraw,1);assert.equal(edited.impact.reused,0);
 assert.throws(()=>selectionSchema.parse({...selected,artStyle:'invented-comic'}));
});

test('current recommendation contracts offer ACK while historical cache contracts retain their fourteen styles',()=>{
 for(const schema of [artRecommendationJson,choicesJson.properties.stories.items.properties.artRecommendation,localChoicesJson.properties.stories.items.properties.artRecommendation])assert.deepEqual(schema.properties.artStyle.enum,[...artStyleIds]);
 const legacy=legacyLocalScanJson.properties.stories.items.properties.artRecommendation.properties.artStyle.enum;
 assert.equal(legacy.length,14);assert.ok(!legacy.includes('ack-comics'));assert.ok(!legacy.includes('baimiao'));
 assert.doesNotMatch(legacyLocalReadingPrompt({title:'A saved classic',text:'Saved source.',purpose:'scan'}),/ack-comics|ACK comics/);
});

test('real Gemini and subscription adapters carry ACK through planning and native image requests',async()=>{
 const ack=getArtStyle('ack-comics'),plan=makePlan();
 const canvas=createCanvas(1024,1280),context=canvas.getContext('2d');context.fillStyle='#f4e6bd';context.fillRect(0,0,1024,1280);const encoded=canvas.toBuffer('image/png').toString('base64');
 assert.match(ack.prompt,/variable-weight black ink/);assert.match(ack.prompt,/opaque flat colours/);assert.match(ack.prompt,/actual source culture, era, character ages, identity, clothing and props/);
 for(const providerName of ['gemini','codex']){
  const requests=[],saved=[];
  const media={get:async()=>null,put:async(...args)=>saved.push(args)};
  const runner={status:async()=>({configured:true}),run:async job=>{requests.push(job);return {text:JSON.stringify(plan),...(job.generateImage?{image:encoded}:{}),model:'controlled',requestId:'controlled',usage:null};}};
  const transport=async(_url,init)=>{const body=JSON.parse(init.body);requests.push(body);const image=body.generationConfig.responseModalities?.includes('IMAGE');return Response.json({candidates:[{finishReason:'STOP',content:{parts:image?[{inlineData:{mimeType:'image/png',data:encoded}}]:[{text:JSON.stringify(plan)}]}}]});};
  const generator=createReaderProvider({SHIQU_AI_PROVIDER:providerName,GEMINI_API_KEY:'controlled-only'},media,transport,runner).generator();
  const result=await generator.plan(choice(),'ack-controlled');assert.equal(result.value.pages[0].prompt,plan.pages[0].prompt);
  const image=await generator.image(plan,0,'ack-controlled','','ack-comics','');assert.match(image.value,/ack-controlled/);assert.equal(saved.length,1);
  const planning=providerName==='codex'?JSON.parse(requests[0].prompt):JSON.parse(requests[0].contents[0].parts[0].text);
  assert.equal(planning.artDirection,ack.prompt);assert.equal(planning.chosenStory,'The Lost Kitten');
  const drawing=providerName==='codex'?requests[1].prompt:requests[1].contents[0].parts.find(part=>part.text).text;
  assert.ok(drawing.includes(ack.prompt));assert.ok(drawing.includes(plan.characters));assert.ok(drawing.includes(plan.pages[0].prompt));assert.doesNotMatch(drawing,/textured colored pencil/);
 }
});

test('the shared creation and revision picker visibly selects the English ACK radio without submitting',async()=>{
 const bundle=await build({entryPoints:['client/ui/StoryArtStylePicker.tsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external'}),compiled={exports:{}};
 new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),compiled,compiled.exports);
 let changes=0;const Picker=compiled.exports.default,html=renderToStaticMarkup(createElement(Picker,{value:'ack-comics',disabled:false,onChange:()=>changes++}));
 assert.match(html,/Selected: <strong>ACK comics<\/strong>/);assert.match(html,/aria-label="ACK comics"[^>]*checked=""/);assert.match(html,/aria-label="Classical and folk art"/);assert.equal((html.match(/type="radio"/g)||[]).length,16);assert.equal(changes,0);
 const disabled=renderToStaticMarkup(createElement(Picker,{value:'ack-comics',disabled:true,onChange:()=>changes++}));assert.match(disabled,/<fieldset[^>]*disabled=""/);assert.equal(changes,0);
});

test('saved story views and production archive serialization retain the exact ACK label and source',async()=>{
 const now='2026-11-07T12:00:00Z',plan=makePlan(),original={title:'The Lost Kitten',text:'Mia patiently rescued the kitten and returned it to its owner.',kind:'passage',provider:'Uploaded Word document',url:'',retrievedAt:now};
 const row={id:randomUUID(),user_id:'isolated-owner',selection:JSON.stringify(choice()),document:JSON.stringify({plan,original,images:['/saved-art.webp'],audio:[],usage:[]}),state:'completed',generation_mode:'reader',generation_control:'stopped',created_at:now,updated_at:now};
 const story=view(row).story;assert.equal(story.artStyleLabel,'ACK comics');assert.equal(story.sourceText,original.text);
 const bytes=await readFile(new URL('./fixtures/images/publication.webp',import.meta.url)),sha256=createHash('sha256').update(bytes).digest('hex'),hashes=[{sha256,originalSha256:sha256,imagePayloadSha256:webpPayloadHash(bytes)}];
 const data=storyZipData(story,['图片/01.webp'],hashes,null),publicData=publicStoryZipData(data);assert.equal(publicData.artStyleLabel,'ACK comics');assert.equal(publicData.sourceText,original.text);assert.deepEqual(publicData.pages[0].sha256,sha256);
 const files=storyZipFiles(data,{includePrompts:false}),json=JSON.parse(new TextDecoder().decode(files['故事.json']));assert.equal(json.artStyleLabel,'ACK comics');assert.match(new TextDecoder().decode(files['分镜.md']),/Art style: ACK comics/);
});
