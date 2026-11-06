// Validate English export content and unchanged public archive protocol.
// Exercise signed public archives and shared comic-panel encoding with isolated output files.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {unzipSync,zipSync,strToU8,strFromU8} from 'fflate';
import {publicStoryZip,exportStory,exportNamedStory,selectExportSession} from '../scripts/export-story.mjs';
import {withWebpXmp,webpPayloadHash,sha256Hex,publicImageXmp,assertStoryWebp} from '../lib/story-webp-metadata.ts';
import {zipMetadataStory} from '../lib/reader-zip-content.ts';
import {loadImage} from '@napi-rs/canvas';
import {makeStory} from './fixtures/story.mjs';

const raw=new Uint8Array(await readFile(new URL('./fixtures/images/publication.webp',import.meta.url)));
const keys=['id','title','summary','bookId','theme','sourceReference','sourceText','sourceUrl','artStyleLabel','author','publication','aiGenerated','aiDisclosure','generationModels','pages','reflection','adaptationNote','revision','createdAt','updatedAt'];
function fixture({unsigned=false,id='test-story',title='Test story',revision=1}={}){
 const story={...makeStory(2),id,title,revision,generated:true,sourceText:'The source describes a traveler who takes action and reaches a clear outcome.',sourceReference:'Zhuangzi, Free and Easy Wandering',artStyleLabel:'Ink wash',author:'yysun',publication:{author:'yysun',workUrl:'',contact:'',sourceNote:'Public domain',reuse:'Share with attribution',watermarkFontSize:24},aiGenerated:true,aiDisclosure:'This work contains AI-generated illustrations and adapted text.',generationModels:[{step:'plan:0',model:'test-model',requestId:'PRIVATE_REQUEST'}],productionPrompt:'PRIVATE_PRODUCTION',acceptancePrompt:'PRIVATE_ACCEPTANCE',promptHistoryFile:'提示词.json',privateField:'PRIVATE_OTHER'};
 const files={};
 story.pages=story.pages.map((page,index)=>{
  const originalSha256=sha256Hex(raw),imagePayloadSha256=webpPayloadHash(raw);
  const bytes=unsigned?raw:withWebpXmp(raw,publicImageXmp(story,index,originalSha256,imagePayloadSha256));
  const image=`图片/${String(index+1).padStart(2,'0')}.webp`;files[image]=bytes;
  return {...page,prompt:'PRIVATE_FRAME',image,sha256:sha256Hex(bytes),originalSha256,imagePayloadSha256};
 });
 files['故事.json']=strToU8(JSON.stringify(story));
 files['分镜.md']=strToU8('PRIVATE_FRAME_MARKDOWN');files['署名与转载.txt']=strToU8('old credit');
 files['提示词.md']=strToU8('PRIVATE_HISTORY'.repeat(100000));files['提示词.json']=strToU8('{}');files['系统提示词.md']=strToU8('PRIVATE_SYSTEM');
 return {story,files,bytes:zipSync(files,{level:0})};
}
function edit(input,change){const files={...input.files},story=JSON.parse(strFromU8(files['故事.json']));change(story,files);files['故事.json']=strToU8(JSON.stringify(story));return zipSync(files,{level:0});}

// Control only the HTTP boundary; encoding, fonts, watermarks, metadata and ZIP validation are production code.
function nativeApi(t){
 const {story}=fixture({id:crypto.randomUUID(),revision:4});
 story.publication=null;story.pages=story.pages.map((page,i)=>({...page,image:`/api/reader/media/frame-${i}.webp`}));
 const session={id:story.id,state:'completed',revision:{number:4},story};
 const state={current:story.id,mediaStatus:200,afterMedia:()=>{},author:'yysun',requests:[]};
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  const parsed=new URL(url);assert.equal(parsed.origin,'http://export.test');assert.equal(options.method||'GET','GET');
  state.requests.push(parsed.pathname);
  const route=parsed.pathname.replace('/api/reader/','');
  if(route==='sessions')return Response.json([{...session,story:{...story,sourceText:''}}]);
  if(route===`sessions/${story.id}`)return Response.json(session);
  if(route.endsWith('/current'))return Response.json({id:state.current});
  if(route==='publication-defaults')return Response.json({publication:{...fixture().story.publication,author:state.author}});
  if(route===`sessions/${story.id}/prompts`)return Response.json({productionPrompt:'PRIVATE_PRODUCTION',acceptancePrompt:'PRIVATE_ACCEPTANCE',records:[],missingRecords:[]});
  if(route.startsWith('media/')){state.afterMedia();return new Response(raw,{status:state.mediaStatus,headers:{'Content-Type':'image/webp'}});}
  throw Error('Unexpected API request: '+parsed.pathname);
 });
 return {story,session,state};
}

test('named Node export reads the complete story, applies default credits and encodes every frame without a browser',async t=>{
 const {story,state}=nativeApi(t),root=await mkdtemp(path.join(tmpdir(),'shiqu-native-test-'));
 try{
  await writeFile(path.join(root,'Original sharing title.zip'),publicStoryZip(fixture({id:crypto.randomUUID(),title:'Original sharing title'}).bytes).bytes);
  const result=await exportNamedStory(story.title,{appUrl:'http://export.test',outputDirectory:root});
  assert.equal(path.basename(result.path),'Original sharing title.zip');
  const files=unzipSync(await readFile(result.path)),saved=JSON.parse(strFromU8(files['故事.json']));
  assert.equal(saved.id,story.id);assert.equal(saved.revision,4);assert.equal(saved.sourceText,story.sourceText);assert.equal(saved.author,'yysun');
  assert.equal(saved.pages.length,story.pages.length);assert.equal(Object.keys(files).length,story.pages.length+3);
  for(const [i,page]of saved.pages.entries()){
   assertStoryWebp(files[page.image],zipMetadataStory(saved),i,page);
   const decoded=await loadImage(Buffer.from(files[page.image]));assert.ok(decoded.width>0&&decoded.height>0);
  }
  for(const name of ['故事.json','分镜.md','署名与转载.txt'])assert.ok(!strFromU8(files[name]).includes('PRIVATE_'));
  assert.equal(state.requests.filter(route=>route.includes('/media/')).length,story.pages.length*2,'Read dimensions before planning, then encode every original frame.');
  assert.deepEqual(await readdir(root),[path.basename(result.path)]);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('named Node export leaves the existing archive intact when media is missing, credits are unsigned or the current revision changes',async t=>{
 const {story,state}=nativeApi(t),root=await mkdtemp(path.join(tmpdir(),'shiqu-native-fail-'));
 try{
  const output=path.join(root,'existing.zip'),original=fixture().bytes;await writeFile(output,original);
  const options={appUrl:'http://export.test',output};
  state.author='';await assert.rejects(exportNamedStory(story.title,options),/EXPORT_UNSIGNED/);
  assert.equal(state.requests.filter(route=>route.includes('/media/')).length,0);
  state.author='yysun';state.mediaStatus=404;await assert.rejects(exportNamedStory(story.title,options),/EXPORT_IMAGE_MISSING_1/);
  state.mediaStatus=200;state.afterMedia=()=>{state.current=crypto.randomUUID();};
  await assert.rejects(exportNamedStory(story.title,options),/switched to a newer revision during export/);
  assert.deepEqual(await readFile(output),Buffer.from(original));assert.deepEqual(await readdir(root),['existing.zip']);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('public ZIP matches the Guandu field/layout contract and retains original signed WebPs byte for byte',()=>{
 const input=fixture(),result=publicStoryZip(input.bytes),files=unzipSync(result.bytes),story=JSON.parse(strFromU8(files['故事.json']));
 assert.deepEqual(Object.keys(story),keys);
 assert.deepEqual(Object.keys(files),['图片/01.webp','图片/02.webp','分镜.md','故事.json','署名与转载.txt']);
 assert.deepEqual(Object.keys(story.pages[0]),['caption','image','sha256','originalSha256','imagePayloadSha256']);
 assert.deepEqual(story.generationModels,[{step:'plan:0',model:'test-model'}]);
 for(const key of ['sourceText','sourceReference','sourceUrl','author','aiDisclosure','reflection','revision'])assert.equal(story[key],input.story[key]);
 assert.equal(story.publication.sourceNote,'Public domain');assert.ok(!('watermarkFontSize' in story.publication));
 for(const page of story.pages)assert.deepEqual(files[page.image],input.files[page.image]);
 for(const name of ['分镜.md','故事.json','署名与转载.txt'])assert.ok(!strFromU8(files[name]).includes('PRIVATE_'));
 assert.ok(strFromU8(files['分镜.md']).includes(input.story.sourceText));
 assert.ok(strFromU8(files['署名与转载.txt']).includes('Created by: yysun · Shiqu · AI-generated'));
 assert.deepEqual(unzipSync(publicStoryZip(result.bytes).bytes),files,'Already public archive contents remain stable');
});

test('named export rejects ambiguous names and incomplete current versions instead of choosing older complete drafts',()=>{
 const old={id:'old',state:'completed',superseded:true,story:fixture().story};
 const current={id:'current',state:'completed',story:fixture().story};
 assert.equal(selectExportSession([old,current],'Test story'),current);
 assert.equal(selectExportSession([current],'current'),current);
 assert.throws(()=>selectExportSession([current,{...current,id:'other'}],'Test story'),/Multiple stories/);
 assert.throws(()=>selectExportSession([current],'不存在'),/Not found/);
 assert.throws(()=>selectExportSession([old,{...current,state:'running',story:{...current.story,pages:[{image:''}]}}],'Test story'),/Missing images for frames 1|Frame 1 is missing/);
 assert.throws(()=>selectExportSession([{...current,state:'running'}],'current'),/revision is incomplete/);
});

test('named export preserves the original sharing filename across a new revision ID and renamed title',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'shiqu-export-family-'));
 try{
  const source=path.join(root,'download.zip'),outputDirectory=path.join(root,'works');
  await writeFile(source,fixture({id:'parent',title:'Old title'}).bytes);
  const previous=await exportStory(source,{outputDirectory});
  await writeFile(source,fixture({id:'child',title:'New title',revision:2}).bytes);
  const current=await exportStory(source,{outputDirectory,resolveCurrentId:async id=>id==='parent'?'child':id});
  assert.equal(current.path,previous.path);assert.equal(current.title,'New title');
  assert.deepEqual(await readdir(outputDirectory),['Old title.zip']);
  const saved=JSON.parse(strFromU8(unzipSync(new Uint8Array(await readFile(current.path)))['故事.json']));
  assert.equal(saved.id,'child');assert.equal(saved.revision,2);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('missing frames, corrupt images, bad hashes and missing/mismatched signatures stop the export',()=>{
 const input=fixture();
 assert.throws(()=>publicStoryZip(edit(input,(_,files)=>delete files['图片/02.webp'])),/Frame 2 is missing/);
 assert.throws(()=>publicStoryZip(edit(input,s=>s.pages[0].image='../outside.webp')),/sequential/);
 assert.throws(()=>publicStoryZip(edit(input,(_,files)=>files['图片/01.webp']=new Uint8Array([1,2,3]))),/WebP/);
 assert.throws(()=>publicStoryZip(edit(input,s=>s.pages[0].sha256='0'.repeat(64))),/SHA-256 does not match/);
 assert.throws(()=>publicStoryZip(edit(input,s=>s.pages[0].imagePayloadSha256='0'.repeat(64))),/pixel-payload hash/);
 assert.throws(()=>publicStoryZip(fixture({unsigned:true}).bytes),/XMP/);
 assert.throws(()=>publicStoryZip(edit(input,s=>s.author='different-author')),/credit does not match/);
 assert.throws(()=>publicStoryZip(edit(input,s=>s.aiDisclosure='Different disclosure')),/AI disclosure/);
 assert.throws(()=>publicStoryZip(edit(input,s=>s.revision=2)),/Revision/);
 assert.throws(()=>publicStoryZip(edit(input,s=>s.sourceUrl='https://example.org/changed')),/SourceURL/);
 assert.throws(()=>publicStoryZip(edit(input,s=>s.sourceText='')),/sourceText/);
});

test('export keeps an existing filename after a title change, supports in-place conversion and leaves targets intact on failure',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'shiqu-export-test-'));
 try{
  const input=fixture(),source=path.join(root,'download.zip'),output=path.join(root,'作品集');
  await writeFile(source,input.bytes);const first=await exportStory(source,{outputDirectory:output});
  const changed=edit(input,s=>s.title='New title');await writeFile(source,changed);
  const next=await exportStory(source,{outputDirectory:output});assert.equal(next.path,first.path);
  assert.deepEqual(await readdir(output),[path.basename(first.path)]);
  let current=await readFile(first.path);assert.equal(JSON.parse(strFromU8(unzipSync(current)['故事.json'])).title,'New title');
  const again=await exportStory(first.path,{output:first.path});assert.deepEqual(unzipSync(await readFile(again.path)),unzipSync(current));current=await readFile(again.path);
  await writeFile(source,edit(input,(_,files)=>delete files['图片/01.webp']));
  await assert.rejects(exportStory(source,{output:first.path}),/Missing images for frames 1|Frame 1 is missing/);assert.deepEqual(await readFile(first.path),current);
  await writeFile(source,input.bytes);await writeFile(first.path+'.tmp','other operation');
  await assert.rejects(exportStory(source,{output:first.path}),{code:'EEXIST'});
  assert.equal(await readFile(first.path+'.tmp','utf8'),'other operation');assert.deepEqual(await readFile(first.path),current);
 }finally{await rm(root,{recursive:true,force:true});}
});
