// Verify complete saved prompt exports, pixel attribution and fail-closed history/image reads.
import test from 'node:test';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import {makeStory} from './fixtures/story.mjs';
import {assertZipReady,createStoryZip,downloadStoryZip,zipFilename} from '../lib/reader-zip.ts';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {webpPayloadHash} from '../lib/story-webp-metadata.ts';
const mockEncoded=readFileSync(new URL('./fixtures/images/publication.webp',import.meta.url));
import {view} from '../lib/reader-model.ts';
import {archivePromptHistory} from '../lib/reader-prompt-records.ts';
import {publicStoryZip} from '../scripts/export-story.mjs';

function browserImages(t){
 const previous={Image:globalThis.Image,document:globalThis.document},urls=new Map(),canvases=[],revoked=[];
 const controls={failure:null,canvases,revoked,urls,downloads:[]};
 globalThis.Image=class{
  naturalWidth=941;naturalHeight=1672;src='';
  async decode(){if(controls.failure==='decode')throw Error('invalid image');this.bytes=new Uint8Array(await urls.get(this.src).arrayBuffer());}
 };
 globalThis.document={querySelector(){return null;},body:{appendChild(){}},createElement(tag){
  if(tag==='a')return {click(){controls.downloads.push({href:this.href,download:this.download});},remove(){}};
  assert.equal(tag,'canvas');
  const canvas={width:0,height:0,getContext(){return controls.failure==='context'?null:{save(){},restore(){},translate(){},rotate(){},measureText(text){return {width:[...text].length*20};},fillRect(){},fillText(text,x,y,maxWidth){(canvas.labels||=[]).push({text,x,y,font:this.font,maxWidth});},drawImage(image,x,y){assert.equal(x,0);assert.equal(y,0);canvas.image=image;}};},toBlob(callback,type,quality){
   assert.equal(type,'image/webp');assert.equal(quality,.85);
   canvas.encodedSize=[canvas.width,canvas.height];
   callback(controls.failure==='empty'?null:new Blob([mockEncoded],{type:controls.failure==='format'?'image/png':'image/webp'}));
  }};
  canvases.push(canvas);return canvas;
 }};
 t.mock.method(URL,'createObjectURL',blob=>{const url='blob:test-'+urls.size;urls.set(url,blob);return url;});
 t.mock.method(URL,'revokeObjectURL',url=>revoked.push(url));
 t.after(()=>{for(const [key,value] of Object.entries(previous))if(value===undefined)delete globalThis[key];else globalThis[key]=value;});
 return controls;
}

function promptHistory(story){
 return {
  productionPrompt:story.productionPrompt||'',acceptancePrompt:'保留条件与结局。',
  records:[
   {step:'plan',model:'test-text',originId:'old-version',index:0,record:{instructions:'HISTORICAL_SYSTEM_RULES\n\n保留原文的完整因果。',input:'{"productionPrompt":"原版制作要求"}',schema:{type:'object',properties:{title:{type:'string'}}}}},
   {step:'image:0',model:'test-image',originId:story.id,index:1,record:{instructions:'',input:'ACTUAL_IMAGE_PROMPT',reference:'/api/media/reference.webp'}},
  ],
  missingRecords:[{step:'review:0',model:'old-model',originId:'old-version',index:2}],
 };
}

test('ZIP requires every image and sanitizes the archive filename',()=>{
 const story=makeStory();
 assert.throws(()=>assertZipReady({...story,pages:[]}),/所有画面/);
 assert.throws(()=>assertZipReady({...story,pages:[{...story.pages[0],image:''}]}),/所有画面/);
 assert.equal(zipFilename('故事/名字?'),'故事名字.zip');
});

test('ZIP preserves images and public metadata while exporting requirements, page prompts and actual history',async t=>{
 const browser=browserImages(t);
 globalThis.location={origin:'http://localhost:3000'};
 t.after(()=>{delete globalThis.location;});
 const formats=['png','jpeg','webp'],bodies=Array.from({length:12},(_,i)=>new Uint8Array([i,4,8,15,16,23,42]));
 const fetched=[];
 t.mock.method(globalThis,'fetch',async (url,options)=>{
  const i=fetched.length;fetched.push(url);
  assert.equal(options.credentials,'same-origin');
  return new Response(bodies[i],{headers:{'Content-Type':`image/${formats[i%3]}`}});
 });
 const saved=makeStory(12),usage=[{step:'plan',model:'test-text',requestId:'private-request',usage:{private:'metadata'}},{step:'image:0',model:'test-image',requestId:null,usage:null}];
 const story=view({id:saved.id,selection:JSON.stringify({bookId:saved.bookId,theme:saved.theme,length:12,artStyle:'paper-cut',productionPrompt:'保留故事的转折。'}),document:JSON.stringify({plan:{...saved,sourceReference:'庄子·逍遥游'},images:saved.pages.map(page=>page.image),audio:[],usage}),state:'completed',page:0,saved:1,step_attempts:0,created_at:saved.createdAt,updated_at:saved.updatedAt}).story;
 const history=promptHistory(story),progress=[],blob=await createStoryZip(story,history,value=>progress.push(value));
 assert.equal(blob.type,'application/zip');
 const files=unzipSync(new Uint8Array(await blob.arrayBuffer()));
 assert.equal(Object.keys(files).length,18);
 const script=strFromU8(files['分镜.md']);
 const json=JSON.parse(strFromU8(files['故事.json']));
 assert.deepEqual(json.generationModels,[{step:'plan',model:'test-text'},{step:'image:0',model:'test-image'}]);
 assert.ok(!strFromU8(files['故事.json']).includes('private'));
 assert.equal(json.productionPrompt,story.productionPrompt);assert.equal(json.acceptancePrompt,history.acceptancePrompt);assert.equal(json.aiGenerated,true);assert.ok(script.includes(story.sourceText));
 assert.equal(json.promptHistoryFile,'提示词.json');
 assert.deepEqual(JSON.parse(strFromU8(files[json.promptHistoryFile])),archivePromptHistory(history));
 assert.equal(json.promptHistory,undefined);
 const prompts=strFromU8(files['提示词.md']);
 for(const value of [history.productionPrompt,history.acceptancePrompt,history.records[0].record.input,JSON.stringify(history.records[0].record.schema,null,2),history.records[1].record.input,history.records[1].record.reference,'沿用旧版本记录','本版本实际使用','未留存完整提示词的调用','review:0','[系统制作提示词](系统提示词.md#system-production-1)','未使用独立系统指令。'])assert.ok(prompts.includes(value),value);
 assert.ok(!prompts.includes(history.records[0].record.instructions));
 const systems=strFromU8(files['系统提示词.md']);
 assert.ok(systems.includes(history.records[0].record.instructions));assert.ok(systems.includes('<a id="system-production-1"></a>'));
 for(const file of ['故事.json','提示词.json','提示词.md'])for(const excluded of ['private-request','metadata','CURRENT_PREVIEW_ONLY'])assert.ok(!strFromU8(files[file]).includes(excluded));
 for(const key of ['title','summary','bookId','theme','sourceText','sourceUrl','reflection','adaptationNote','revision','createdAt','updatedAt','artStyleLabel'])assert.deepEqual(json[key],story[key]);
 assert.equal(json.sourceReference,story.sourceReference);
 assert.equal(json.pages.length,12);
 for(let i=0;i<12;i++){
  const filename=`图片/${String(i+1).padStart(2,'0')}.webp`;
  assert.equal(webpPayloadHash(files[filename]),webpPayloadHash(mockEncoded));
  assert.equal(json.pages[i].sha256,createHash('sha256').update(files[filename]).digest('hex'));
  assert.equal(json.pages[i].originalSha256,createHash('sha256').update(bodies[i]).digest('hex'));
  assert.equal(json.pages[i].imagePayloadSha256,webpPayloadHash(files[filename]));
  assert.equal(json.pages[i].caption,story.pages[i].caption);assert.equal(json.pages[i].image,filename);assert.equal(json.pages[i].prompt,story.pages[i].prompt);
  assert.ok(script.includes(`图片：${filename}`));
  assert.ok(script.includes(story.pages[i].caption));
  assert.ok(script.includes(story.pages[i].prompt));assert.ok(prompts.includes(story.pages[i].prompt));
  assert.equal(fetched[i],`http://localhost:3000${story.pages[i].image}`);
 }
 assert.ok(script.indexOf('## 第 2 幅')<script.indexOf('## 第 10 幅'));
 for(const text of [story.title,story.summary,story.reflection,story.adaptationNote,story.sourceReference,story.artStyleLabel])assert.ok(script.includes(text));
 assert.ok(progress.includes('正在打包第 12 / 12 幅'));
 assert.equal(browser.canvases.length,12);
 assert.equal(browser.revoked.length,12);
 for(const canvas of browser.canvases){assert.equal(canvas.encodedSize[0],941);assert.equal(canvas.encodedSize[1],1672);assert.equal(canvas.labels.length,1);assert.ok(canvas.labels.some(label=>label.text.includes('AI 生成')));assert.equal(canvas.width,0);assert.equal(canvas.height,0);}
});

test('ZIP exports stories without generation metadata with an empty model list',async t=>{
 browserImages(t);
 globalThis.location={origin:'http://localhost:3000'};
 t.after(()=>{delete globalThis.location;});
 t.mock.method(globalThis,'fetch',async()=>new Response('image',{headers:{'Content-Type':'image/png'}}));
 const story=makeStory(1),blob=await createStoryZip(story,null),files=unzipSync(new Uint8Array(await blob.arrayBuffer()));
 const json=JSON.parse(strFromU8(files['故事.json']));
 assert.equal(json.title,story.title);
 assert.deepEqual(json.generationModels,[]);
 assert.equal(json.pages[0].image,'图片/01.webp');
 assert.equal(json.productionPrompt,null);assert.equal(json.acceptancePrompt,null);
 assert.deepEqual(JSON.parse(strFromU8(files['提示词.json'])),{productionPrompt:null,acceptancePrompt:null,systemPrompts:[],records:[],missingRecords:[]});
 assert.match(strFromU8(files['提示词.md']),/未留存完整提示词调用记录/);
 assert.match(strFromU8(files['提示词.md']),/## 制作要求\n\n未留存/);
});

test('ZIP rejects failed decoding, missing canvas, empty encoding and PNG fallbacks',async t=>{
 const browser=browserImages(t);
 globalThis.location={origin:'http://localhost:3000'};
 t.after(()=>{delete globalThis.location;});
 t.mock.method(globalThis,'fetch',async()=>new Response('image',{headers:{'Content-Type':'image/png'}}));
 for(const failure of ['decode','context','empty','format']){
  browser.failure=failure;
  await assert.rejects(createStoryZip(makeStory(1),null),/第 1 幅.*WebP/);
 }
 assert.equal(browser.revoked.length,4);
 assert.ok(browser.canvases.every(canvas=>canvas.width===0&&canvas.height===0));
});

test('ZIP rejects incomplete, foreign, failed, empty and non-image responses',async t=>{
 browserImages(t);
 globalThis.location={origin:'http://localhost:3000'};
 t.after(()=>{delete globalThis.location;});
 const story=makeStory(2);
 const fetch=t.mock.method(globalThis,'fetch',async()=>new Response('image',{headers:{'Content-Type':'image/png'}}));
 await assert.rejects(createStoryZip({...story,pages:[{...story.pages[0],image:''}]},null),/所有画面/);
 await assert.rejects(createStoryZip({...story,pages:[{...story.pages[0],image:'https://other.example/image.png'}]},null),/来源不可用/);
 assert.equal(fetch.mock.callCount(),0);
 for(const response of [new Response('missing',{status:404}),new Response('html',{headers:{'Content-Type':'text/html'}}),new Response('',{headers:{'Content-Type':'image/png'}})]){
  fetch.mock.mockImplementation(async()=>response);
  await assert.rejects(createStoryZip(story,null),/第 1 幅/);
 }
 fetch.mock.mockImplementation(async()=>{throw Error('network offline');});
 await assert.rejects(createStoryZip(story,null),/network offline/);
});


test('ZIP credits remain consistent and image metadata does not inherit prompt contents',async t=>{
 browserImages(t);globalThis.location={origin:'http://localhost:3000'};t.after(()=>{delete globalThis.location;});
 t.mock.method(globalThis,'fetch',async()=>new Response('image',{headers:{'Content-Type':'image/webp'}}));
 const publication={author:'公开制作人',workUrl:'https://example.org/work',contact:'公开联系',sourceNote:'原文转录遵循 CC BY-SA 4.0。',reuse:'本次受保护贡献的商业使用请联系制作人。'};
 const story={...makeStory(1),generated:true,publication,productionPrompt:'PRIVATE_PRODUCTION_SENTINEL',pages:[{...makeStory(1).pages[0],prompt:'PRIVATE_IMAGE_SENTINEL'}]};
 const files=unzipSync(new Uint8Array(await (await createStoryZip(story,promptHistory(story))).arrayBuffer())),json=JSON.parse(strFromU8(files['故事.json']));
 assert.deepEqual(json.publication,publication);assert.equal(json.author,publication.author);assert.equal(json.aiGenerated,true);
 for(const file of ['故事.json','分镜.md','署名与转载.txt']){
  const text=strFromU8(files[file]);
  for(const value of Object.values(publication))assert.ok(text.includes(value));
 }
 assert.equal(json.productionPrompt,story.productionPrompt);assert.equal(json.pages[0].prompt,story.pages[0].prompt);
 assert.ok(strFromU8(files['提示词.md']).includes(story.productionPrompt));
 assert.ok(!new TextDecoder().decode(files['图片/01.webp']).includes('PRIVATE_'));
 assert.ok(strFromU8(files['署名与转载.txt']).includes('不能收紧公版材料'));
});

test('ZIP labels genuinely missing history without inventing system rules or treating empty requirements as missing',async t=>{
 browserImages(t);globalThis.location={origin:'http://localhost:3000'};t.after(()=>{delete globalThis.location;});
 t.mock.method(globalThis,'fetch',async()=>new Response('image',{headers:{'Content-Type':'image/png'}}));
 const story={...makeStory(1),generated:true,productionPrompt:'',pages:[{...makeStory(1).pages[0],prompt:''}]};
 const history={productionPrompt:'',acceptancePrompt:'',records:[],missingRecords:[]};
 const files=unzipSync(new Uint8Array(await (await createStoryZip(story,history)).arrayBuffer()));
 const text=strFromU8(files['提示词.md']),json=JSON.parse(strFromU8(files['故事.json']));
 assert.equal(json.productionPrompt,'');assert.equal(json.acceptancePrompt,'');assert.equal(json.pages[0].prompt,null);
 assert.match(text,/## 制作要求\n\n未填写/);assert.match(text,/## 验收要求\n\n未填写/);
 assert.match(text,/### 第 1 幅\n\n未留存/);assert.match(text,/未留存完整提示词调用记录/);
 assert.ok(!text.includes('HISTORICAL_SYSTEM_RULES'));
});

test('ZIP uses working internal references and keeps repeated large system rules below the existing 1 MiB text limit',async t=>{
 browserImages(t);globalThis.location={origin:'http://localhost:3000'};t.after(()=>{delete globalThis.location;});
 t.mock.method(globalThis,'fetch',async()=>new Response('image',{headers:{'Content-Type':'image/png'}}));
 const story={...makeStory(1),generated:true,productionPrompt:'分享制作过程'},instructions='原样保存的系统规则。'.repeat(10000);
 const history={productionPrompt:story.productionPrompt,acceptancePrompt:'',missingRecords:[],records:Array.from({length:10},(_,index)=>({step:`plan:${index}`,model:'recorded-model',originId:story.id,index,record:{instructions,input:`完整输入 ${index}`}}))};
 assert.ok(Buffer.byteLength(JSON.stringify(history))>1024*1024);
 const files=unzipSync(new Uint8Array(await (await createStoryZip(story,history)).arrayBuffer()));
 for(const [name,bytes] of Object.entries(files))if(/\.(?:md|json|txt)$/.test(name))assert.ok(bytes.length<1024*1024,`${name}: ${bytes.length}`);
 const archive=JSON.parse(strFromU8(files['提示词.json'])),prompts=strFromU8(files['提示词.md']),systems=strFromU8(files['系统提示词.md']);
 assert.equal(archive.systemPrompts.length,1);assert.equal(archive.records.length,10);
 assert.equal(systems.split(instructions).length-1,1);
 for(const record of archive.records){
  const system=archive.systemPrompts.find(item=>item.id===record.record.instructionsRef);
  assert.equal(system.instructions,instructions);
  assert.ok(prompts.includes(`[${system.label}](系统提示词.md#${system.id})`));
  assert.ok(systems.includes(`<a id="${system.id}"></a>`));
  assert.ok(prompts.includes(record.record.input));
 }
});

test('download loads actual prompt history on demand and excludes API previews and raw receipts',async t=>{
 const browser=browserImages(t);globalThis.location={origin:'http://localhost:3000'};t.after(()=>{delete globalThis.location;});
 const story={...makeStory(1),generated:true,productionPrompt:'分享制作过程'},history=promptHistory(story),calls=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  calls.push(url);
  if(String(url).endsWith('/prompts')){
   assert.equal(options.method,'GET');
   return Response.json({...history,previews:{production:{instructions:'CURRENT_PREVIEW_ONLY',input:'not history'}}});
  }
  return new Response('image',{headers:{'Content-Type':'image/png'}});
 });
 const progress=[],result=await downloadStoryZip(story,value=>progress.push(value));
 assert.deepEqual(calls,[`/api/reader/sessions/${story.id}/prompts`,`http://localhost:3000${story.pages[0].image}`]);
 assert.deepEqual(browser.downloads,[{href:result.url,download:result.filename}]);
 const files=unzipSync(new Uint8Array(await browser.urls.get(result.url).arrayBuffer()));
 assert.deepEqual(JSON.parse(strFromU8(files['提示词.json'])),archivePromptHistory(history));
 assert.ok(!strFromU8(files['提示词.md']).includes('CURRENT_PREVIEW_ONLY'));
 assert.ok(progress.includes('正在读取已保存的提示词'));
});

test('download fails explicitly before creating an incomplete archive if prompt history cannot be read',async t=>{
 const browser=browserImages(t),story={...makeStory(1),generated:true,productionPrompt:'制作要求'};
 const fetch=t.mock.method(globalThis,'fetch',async()=>Response.json({error:'提示词读取失败'},{status:404}));
 await assert.rejects(downloadStoryZip(story,()=>{}),/提示词读取失败/);
 assert.equal(fetch.mock.callCount(),1);assert.equal(browser.downloads.length,0);assert.equal(browser.canvases.length,0);
 await assert.rejects(createStoryZip(story,null),/提示词记录未载入/);
 await assert.rejects(downloadStoryZip({...story,pages:[{...story.pages[0],image:''}]},()=>{}),/所有画面/);
 assert.equal(fetch.mock.callCount(),1);
});

// The same saved sizing must reach every WebP and the public archive record.
test('ZIP applies the saved watermark size to WebP canvases and retains it in story metadata',async t=>{
 const browser=browserImages(t);globalThis.location={origin:'http://localhost:3000'};t.after(()=>{delete globalThis.location;});
 t.mock.method(globalThis,'fetch',async()=>new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'image/png'}}));
 const publication={author:'测试制作人',workUrl:'',contact:'',sourceNote:'',reuse:'',watermarkFontSize:40};
 const story={...makeStory(2),publication},blob=await createStoryZip(story,null);
 const files=unzipSync(new Uint8Array(await blob.arrayBuffer())),saved=JSON.parse(strFromU8(files['故事.json']));
 assert.deepEqual(saved.publication,publication);assert.equal(browser.canvases.length,2);
 for(const canvas of browser.canvases){assert.match(canvas.labels[0].font,/300 40px /);assert.equal(canvas.labels[0].maxWidth,941*.94);assert.deepEqual(canvas.encodedSize,[941,1672]);}
});

test('collection export consumes the browser ZIP with its signed WebPs and shared public serialization',async t=>{
 const browser=browserImages(t);globalThis.location={origin:'http://localhost:3000'};t.after(()=>{delete globalThis.location;});
 t.mock.method(globalThis,'fetch',async()=>new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'image/png'}}));
 const story={...makeStory(2),generated:true,artStyleLabel:'水墨',publication:{author:'测试制作人',workUrl:'',contact:'',sourceNote:'公版',reuse:'署名转载',watermarkFontSize:40}};
 const downloaded=new Uint8Array(await (await createStoryZip(story,promptHistory(story))).arrayBuffer()),full=unzipSync(downloaded);
 const {bytes}=publicStoryZip(downloaded),files=unzipSync(bytes);
 const data=JSON.parse(strFromU8(files['故事.json']));
 assert.equal(data.author,story.publication.author);assert.equal(data.aiGenerated,true);assert.equal(data.sourceText,story.sourceText);
 assert.ok(!('productionPrompt' in data));assert.ok(!('watermarkFontSize' in data.publication));
 assert.ok(!strFromU8(files['分镜.md']).includes('画面提示词'));assert.ok(!files['提示词.json']);
 assert.deepEqual(files['署名与转载.txt'],full['署名与转载.txt']);
 for(const page of data.pages){assert.ok(!('prompt' in page));assert.deepEqual(files[page.image],full[page.image]);}
 for(const canvas of browser.canvases)assert.match(canvas.labels[0].font,/300 40px /);
});
