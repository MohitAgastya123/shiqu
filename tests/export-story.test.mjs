// Exercise the actual public-export path with signed app-format fixtures and isolated output files.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {unzipSync,zipSync,strToU8,strFromU8} from 'fflate';
import {publicStoryZip,exportStory,selectExportSession} from '../scripts/export-story.mjs';
import {withWebpXmp,webpPayloadHash,sha256Hex,publicImageXmp} from '../lib/story-webp-metadata.ts';
import {makeStory} from './fixtures/story.mjs';

const raw=new Uint8Array(await readFile(new URL('./fixtures/images/publication.webp',import.meta.url)));
const keys=['id','title','summary','bookId','theme','sourceReference','sourceText','sourceUrl','artStyleLabel','author','publication','aiGenerated','aiDisclosure','generationModels','pages','reflection','adaptationNote','revision','createdAt','updatedAt'];
function fixture({unsigned=false,id='test-story',title='测试故事',revision=1}={}){
 const story={...makeStory(2),id,title,revision,generated:true,sourceReference:'《庄子·逍遥游》',artStyleLabel:'水墨',author:'yysun',publication:{author:'yysun',workUrl:'',contact:'',sourceNote:'公版',reuse:'署名转载',watermarkFontSize:24},aiGenerated:true,aiDisclosure:'本作品包含 AI 生成的画面与改编文字。',generationModels:[{step:'plan:0',model:'test-model',requestId:'PRIVATE_REQUEST'}],productionPrompt:'PRIVATE_PRODUCTION',acceptancePrompt:'PRIVATE_ACCEPTANCE',promptHistoryFile:'提示词.json',privateField:'PRIVATE_OTHER'};
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

test('public ZIP matches the Guandu field/layout contract and retains original signed WebPs byte for byte',()=>{
 const input=fixture(),result=publicStoryZip(input.bytes),files=unzipSync(result.bytes),story=JSON.parse(strFromU8(files['故事.json']));
 assert.deepEqual(Object.keys(story),keys);
 assert.deepEqual(Object.keys(files),['图片/01.webp','图片/02.webp','分镜.md','故事.json','署名与转载.txt']);
 assert.deepEqual(Object.keys(story.pages[0]),['caption','image','sha256','originalSha256','imagePayloadSha256']);
 assert.deepEqual(story.generationModels,[{step:'plan:0',model:'test-model'}]);
 for(const key of ['sourceText','sourceReference','sourceUrl','author','aiDisclosure','reflection','revision'])assert.equal(story[key],input.story[key]);
 assert.equal(story.publication.sourceNote,'公版');assert.ok(!('watermarkFontSize' in story.publication));
 for(const page of story.pages)assert.deepEqual(files[page.image],input.files[page.image]);
 for(const name of ['分镜.md','故事.json','署名与转载.txt'])assert.ok(!strFromU8(files[name]).includes('PRIVATE_'));
 assert.ok(strFromU8(files['分镜.md']).includes(input.story.sourceText));
 assert.ok(strFromU8(files['署名与转载.txt']).includes('制作：yysun · 拾趣 · AI 生成'));
 assert.deepEqual(unzipSync(publicStoryZip(result.bytes).bytes),files,'Already public archive contents remain stable');
});

test('named export rejects ambiguous names and incomplete current versions instead of choosing older complete drafts',()=>{
 const old={id:'old',state:'completed',superseded:true,story:fixture().story};
 const current={id:'current',state:'completed',story:fixture().story};
 assert.equal(selectExportSession([old,current],'测试故事'),current);
 assert.equal(selectExportSession([current],'current'),current);
 assert.throws(()=>selectExportSession([current,{...current,id:'other'}],'测试故事'),/同名/);
 assert.throws(()=>selectExportSession([current],'不存在'),/没有找到/);
 assert.throws(()=>selectExportSession([old,{...current,state:'running',story:{...current.story,pages:[{image:''}]}}],'测试故事'),/缺少第 1 幅/);
 assert.throws(()=>selectExportSession([{...current,state:'running'}],'current'),/尚未制作完成/);
});

test('named export preserves the original sharing filename across a new revision ID and renamed title',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'shiqu-export-family-'));
 try{
  const source=path.join(root,'download.zip'),outputDirectory=path.join(root,'works');
  await writeFile(source,fixture({id:'parent',title:'旧标题'}).bytes);
  const previous=await exportStory(source,{outputDirectory});
  await writeFile(source,fixture({id:'child',title:'新标题',revision:2}).bytes);
  const current=await exportStory(source,{outputDirectory,resolveCurrentId:async id=>id==='parent'?'child':id});
  assert.equal(current.path,previous.path);assert.equal(current.title,'新标题');
  assert.deepEqual(await readdir(outputDirectory),['旧标题.zip']);
  const saved=JSON.parse(strFromU8(unzipSync(new Uint8Array(await readFile(current.path)))['故事.json']));
  assert.equal(saved.id,'child');assert.equal(saved.revision,2);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('missing frames, corrupt images, bad hashes and missing/mismatched signatures stop the export',()=>{
 const input=fixture();
 assert.throws(()=>publicStoryZip(edit(input,(_,files)=>delete files['图片/02.webp'])),/缺少第 2 幅/);
 assert.throws(()=>publicStoryZip(edit(input,s=>s.pages[0].image='../outside.webp')),/连续编号/);
 assert.throws(()=>publicStoryZip(edit(input,(_,files)=>files['图片/01.webp']=new Uint8Array([1,2,3]))),/WebP/);
 assert.throws(()=>publicStoryZip(edit(input,s=>s.pages[0].sha256='0'.repeat(64))),/SHA-256 不符/);
 assert.throws(()=>publicStoryZip(edit(input,s=>s.pages[0].imagePayloadSha256='0'.repeat(64))),/像素载荷哈希/);
 assert.throws(()=>publicStoryZip(fixture({unsigned:true}).bytes),/XMP/);
 assert.throws(()=>publicStoryZip(edit(input,s=>s.author='different-author')),/署名不符/);
 assert.throws(()=>publicStoryZip(edit(input,s=>s.aiDisclosure='Different disclosure')),/AI 披露/);
 assert.throws(()=>publicStoryZip(edit(input,s=>s.revision=2)),/Revision/);
 assert.throws(()=>publicStoryZip(edit(input,s=>s.sourceUrl='https://example.org/changed')),/SourceURL/);
 assert.throws(()=>publicStoryZip(edit(input,s=>s.sourceText='')),/sourceText/);
});

test('export keeps an existing filename after a title change, supports in-place conversion and leaves targets intact on failure',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'shiqu-export-test-'));
 try{
  const input=fixture(),source=path.join(root,'download.zip'),output=path.join(root,'作品集');
  await writeFile(source,input.bytes);const first=await exportStory(source,{outputDirectory:output});
  const changed=edit(input,s=>s.title='新标题');await writeFile(source,changed);
  const next=await exportStory(source,{outputDirectory:output});assert.equal(next.path,first.path);
  assert.deepEqual(await readdir(output),[path.basename(first.path)]);
  let current=await readFile(first.path);assert.equal(JSON.parse(strFromU8(unzipSync(current)['故事.json'])).title,'新标题');
  const again=await exportStory(first.path,{output:first.path});assert.deepEqual(unzipSync(await readFile(again.path)),unzipSync(current));current=await readFile(again.path);
  await writeFile(source,edit(input,(_,files)=>delete files['图片/01.webp']));
  await assert.rejects(exportStory(source,{output:first.path}),/缺少第 1 幅/);assert.deepEqual(await readFile(first.path),current);
  await writeFile(source,input.bytes);await writeFile(first.path+'.tmp','other operation');
  await assert.rejects(exportStory(source,{output:first.path}),{code:'EEXIST'});
  assert.equal(await readFile(first.path+'.tmp','utf8'),'other operation');assert.deepEqual(await readFile(first.path),current);
 }finally{await rm(root,{recursive:true,force:true});}
});
