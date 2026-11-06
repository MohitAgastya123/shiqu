// Verify finite automatic page compositions and production exports using isolated artwork and real canvas/PDF IO.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {PDFDocument} from 'pdf-lib';
import {unzipSync,strFromU8} from 'fflate';
import {layoutComicPages,layoutComicPanel,comicPageForFrame,validatedComicPages,ComicPanelDensityError} from '../lib/comic-page-layout.ts';
import {createStoryPdf} from '../lib/reader-pdf.ts';
import {createStoryZip} from '../lib/reader-zip.ts';
import {publicStoryZip} from '../lib/public-story-zip.mjs';
import {publicStoryZipData} from '../lib/reader-zip-content.ts';
import {nativeExportRuntime} from '../server/story-export.ts';
import {makeStory} from './fixtures/story.mjs';
const frame=(extra={})=>({caption:'A traveler follows the river.',prompt:'A traveler beside a quiet river.',image:'/api/reader/media/fixture.png',audio:'',...extra});

test('one to eighty legacy frames keep exact source order with four normal cells as the default',()=>{
 for(let count=1;count<=80;count++){
  const frames=Array.from({length:count},()=>frame()),pages=layoutComicPages(frames);assert.deepEqual(pages.flatMap(page=>page.panels.map(panel=>panel.frameIndex)),Array.from({length:count},(_,index)=>index));assert.deepEqual(validatedComicPages(pages,count),pages);
  for(const [index,page]of pages.entries())for(const panel of page.panels)assert.equal(comicPageForFrame(pages,panel.frameIndex),index);
  if(count%4===0)assert.ok(pages.every(page=>page.panels.length===4));
 }
});

test('wide, large and splash emphasis use ordered templates without later panels above previous ones',()=>{
 for(const hints of [['wide','normal','normal'],['large','normal','normal'],['normal','normal','wide'],['wide','wide'],['large','large'],['splash','normal','normal','normal','normal']]){
  const pages=layoutComicPages(hints.map(panel=>frame({panel})));assert.deepEqual(pages.flatMap(page=>page.panels.map(panel=>panel.frameIndex)),hints.map((_,index)=>index));for(const page of pages)for(let index=1;index<page.panels.length;index++)assert.ok(page.panels[index].y>=page.panels[index-1].y);
 }
 assert.throws(()=>layoutComicPages([frame({panel:'unknown'})]),/Invalid comic panel/);
});

test('dense narration promotes finitely, preserves all text and errors when even a splash is impossible',()=>{
 const caption='The traveler considers what this choice will mean for the people who depend on the crossing. '.repeat(5).trim(),frames=[frame({caption}),frame(),frame(),frame()],page=layoutComicPages(frames)[0];assert.notEqual(page.panels[0].span,'normal');const layout=layoutComicPanel(frames[0],page.panels[0]);assert.equal(layout.captionLines.map(line=>line.text).join(' '),caption);assert.ok(layout.captionFontSize>=24);
 assert.throws(()=>layoutComicPages([frame({caption:'W'.repeat(5000)})]),ComicPanelDensityError);
 const portrait=layoutComicPanel(frame(),layoutComicPages(Array.from({length:4},()=>frame()))[0].panels[0],{width:864,height:1536});assert.ok(Math.abs(portrait.art.width/portrait.art.height-864/1536)<1e-9);assert.ok(portrait.art.x>=portrait.rect.x);assert.ok(portrait.art.y+portrait.art.height<portrait.narration.y);
});

test('embedded full panels keep their original layout and cannot repaint text or masquerade as smaller lettering',()=>{
 const frames=Array.from({length:4},()=>frame()),pages=layoutComicPages(frames),baked=frames.map((value,index)=>({...value,comicRendering:{width:409,height:591,minFontSize:24}}));assert.deepEqual(layoutComicPages(baked),pages);
 const result=layoutComicPanel(baked[0],pages[0].panels[0],{width:409,height:591});assert.deepEqual(result.bubbles,[]);assert.deepEqual(result.captionLines,[]);assert.equal(result.art.width,409);
 assert.throws(()=>layoutComicPages([frame({comicRendering:{width:900,height:1350,minFontSize:24}})]),ComicPanelDensityError);
 assert.equal(layoutComicPages([frame({bubbleRendering:'embedded'}),frame()])[0].panels[0].span,'splash');assert.equal(layoutComicPages([frame({comicRendering:{width:409,height:591,minFontSize:null}}),frame()])[0].panels[0].span,'splash');assert.throws(()=>validatedComicPages([{index:0,panels:[pages[0].panels[1]]}],1),/preserve every source panel/);assert.throws(()=>validatedComicPages([{index:0,panels:[{...pages[0].panels[0],span:'splash'}]}],1),/canonical panel templates/);
});

test('production PDF groups four frames per sheet and ZIP keeps readable complete numbered panels with unchanged public bytes',async()=>{
 const canvas=createCanvas(900,1350),ctx=canvas.getContext('2d');ctx.fillStyle='#285a78';ctx.fillRect(0,0,900,1350);const bytes=await canvas.encode('png'),app={handle:async()=>new Response(bytes,{headers:{'Content-Type':'image/png'}})},runtime=nativeExportRuntime(process.cwd(),app),story={...makeStory(8),pages:Array.from({length:8},()=>frame())};
 const pdf=await PDFDocument.load(await createStoryPdf(story,()=>{},runtime));assert.equal(pdf.getPageCount(),4,'Two comic sheets followed by complete ending, credit and source pages.');
 const archive=new Uint8Array(await(await createStoryZip(story,null,()=>{},runtime)).arrayBuffer()),files=unzipSync(archive),data=JSON.parse(strFromU8(files['故事.json']));assert.equal(data.comicPages.length,2);assert.equal(Object.keys(files).filter(name=>name.startsWith('图片/')).length,8);assert.ok(data.pages.every(page=>page.comicRendering.width===409&&page.comicRendering.height===591&&page.comicRendering.minFontSize===24));
 const converted=publicStoryZip(archive),publicFiles=unzipSync(converted.bytes);assert.deepEqual(converted.story.comicPages,data.comicPages);for(let index=1;index<=8;index++){const name=`图片/${String(index).padStart(2,'0')}.webp`;assert.deepEqual(publicFiles[name],files[name]);}
 const broken=structuredClone(data);broken.pages[0].comicRendering.width=900;assert.throws(()=>publicStoryZipData(broken),/lettering is too small/);
});


test('panel presentation caching reuses work, detects in-place edits and isolates caller mutations',()=>{
 let reads=0;const bubbles=[{id:'cached',kind:'speech',speaker:'Mara',text:'Wait for me.',x:.1,y:.1,width:.5,height:.2,tailX:.4,tailY:.6}],input=frame({get bubbles(){reads++;return bubbles;}}),panel={...layoutComicPages([frame()])[0].panels[0]};
 // Define a getter after construction because object spread otherwise evaluates it once.
 Object.defineProperty(input,'bubbles',{get(){reads++;return bubbles;},enumerable:true});
 const first=layoutComicPanel(input,panel);reads=0;const cached=layoutComicPanel(input,panel);assert.equal(reads,1,'A cache hit fingerprints input without rerunning the placement search.');assert.deepEqual(cached,first);assert.notEqual(cached,first);
 cached.rect.x=-999;cached.captionLines[0].text='Changed by caller';cached.bubbles[0].text='Changed by caller';const isolated=layoutComicPanel(input,panel);assert.deepEqual(isolated,first);
 input.caption='The traveler pauses at the river.';bubbles[0].text='We should wait here.';const edited=layoutComicPanel(input,panel);assert.equal(edited.captionLines.map(line=>line.text).join(' '),input.caption);assert.equal(edited.bubbles[0].text,bubbles[0].text);assert.notDeepEqual(edited,first);
 const resized=layoutComicPanel(input,panel,{width:864,height:1536});assert.notEqual(resized.art.width,edited.art.width);
 // More than sixteen dimension variants evict old entries instead of retaining every edit forever.
 layoutComicPanel(input,panel);for(let index=1;index<=20;index++)layoutComicPanel(input,panel,{width:900+index,height:1350});reads=0;layoutComicPanel(input,panel);assert.ok(reads>1,'An evicted variant is recomputed.');
});

test('cached density failures are fresh and keep the current canonical panel number',()=>{
 let reads=0;const input=frame({caption:'W'.repeat(5000)});Object.defineProperty(input,'bubbles',{get(){reads++;return [];},enumerable:true});const first={...layoutComicPages([frame()])[0].panels[0],frameIndex:2};
 let original;try{layoutComicPanel(input,first);}catch(error){original=error;}assert.match(original.message,/Panel 3/);reads=0;
 let cached;try{layoutComicPanel(input,first);}catch(error){cached=error;}assert.equal(reads,1);assert.notEqual(cached,original);assert.match(cached.message,/Panel 3/);assert.throws(()=>layoutComicPanel(input,{...first,frameIndex:8}),/Panel 9/);
 input.caption='A short complete narration.';assert.equal(layoutComicPanel(input,first).captionLines[0].text,input.caption);
});
