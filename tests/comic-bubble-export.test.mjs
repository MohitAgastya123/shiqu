// Exercise the shared SVG/canvas layout and real production raster/archive exporters with isolated artwork.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {unzipSync,strFromU8} from 'fflate';
import {PDFDocument,PDFName,PDFDict} from 'pdf-lib';
import {computeBubbleLayout,fitBubbleText,paintComicBubbles,bubbleTailStart} from '../lib/comic-bubble-layout.ts';
import {createStoryZip} from '../lib/reader-zip.ts';
import {createStoryPng} from '../lib/reader-png.ts';
import {layoutComicPages,layoutComicPanel} from '../lib/comic-page-layout.ts';
import {createStoryPdf} from '../lib/reader-pdf.ts';
import {storyZipData,storyZipFiles,publicStoryZipData,zipMetadataStory} from '../lib/reader-zip-content.ts';
import {publicStoryZip} from '../lib/public-story-zip.mjs';
import {assertStoryWebp,sha256Hex} from '../lib/story-webp-metadata.ts';
import {nativeExportRuntime,exportLocalStory} from '../server/story-export.ts';

const speech={id:'speech-1',kind:'speech',speaker:'Sam',text:'We can cross here.',x:.05,y:.04,width:.42,height:.2,tailX:.25,tailY:.7};
const thought={...speech,id:'thought-1',kind:'thought',speaker:'Lee',text:'Perhaps there is another way.',x:.53,tailX:.75};
const story=(bubbles=[speech,thought])=>({id:'balloon-story',title:'The crossing',summary:'Two travelers consider a crossing.',bookId:'zhuangzi',theme:'An original story',status:'published',pages:[{caption:'',prompt:'Two travelers beside a river.',image:'/api/reader/media/base.png',audio:'',...(bubbles.length?{bubbles}:{} )}],reflection:'They consider their next step.',sourceText:'Sam said that they could cross there. Lee thought there might be another way.',sourceUrl:'https://example.test/source',adaptationNote:'An illustrated adaptation.',checks:{source:true,plot:true,visual:true},revision:1,createdAt:'2026-11-06',updatedAt:'2026-11-06',publication:{author:'Bubble author',workUrl:'',contact:'',sourceNote:'',reuse:''}});
async function fixture(embeddedBubbles=[]){
 const canvas=createCanvas(900,1350),ctx=canvas.getContext('2d');ctx.fillStyle='#245078';ctx.fillRect(0,0,900,1350);paintComicBubbles(ctx,embeddedBubbles,900,1350);const base=await canvas.encode('png');
 const app={async handle(request){const route=new URL(request.url).pathname;if(route.includes('/media/'))return new Response(base,{headers:{'Content-Type':'image/png'}});if(route.endsWith('publication-defaults'))return Response.json({publication:null});throw Error('Unexpected production request: '+route);}};
 const runtime=nativeExportRuntime(process.cwd(),app);await runtime.ready();return {base,app,runtime};
}
async function pixels(bytes){const image=await loadImage(Buffer.from(bytes)),canvas=createCanvas(image.width,image.height),ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return {width:image.width,height:image.height,at:(x,y)=>[...ctx.getImageData(Math.round(x),Math.round(y),1,1).data]};}
const fixtureSize={width:900,height:1350};
const fixturePages=saved=>layoutComicPages(saved.pages,{imageSizes:Object.fromEntries(saved.pages.map((_,i)=>[i,fixtureSize]))});
const white=pixel=>pixel[0]>220&&pixel[1]>220&&pixel[2]>220;

test('one deterministic layout supplies SVG geometry, fitted lines, and distinct thought/speech connectors',()=>{
 const a=computeBubbleLayout(speech,900,1350),again=computeBubbleLayout({...speech},900,1350),b=computeBubbleLayout(thought,900,1350);
 assert.deepEqual(a,again);assert.ok(a.fontSize>=20);assert.equal(a.tailPath,undefined);assert.ok(a.bodyCommands.length>8);assert.equal(a.circles.length,0);assert.equal(b.tailPath,undefined);assert.equal(b.circles.length,3);assert.notEqual(a.path,b.path);
 assert.ok(a.lines.every(line=>!line.text.includes('Sam:')));assert.equal(a.lines.map(line=>line.text).join(' '),speech.text.toUpperCase());assert.ok(a.lines.every(line=>line.width<=a.bounds.width*.72+1e-8));
 const start=bubbleTailStart(speech);assert.ok(start.y>speech.y+speech.height/2);assert.ok(start.x>=speech.x&&start.x<=speech.x+speech.width);
 const resized=computeBubbleLayout(speech,1800,2700);assert.equal(resized.fontSize,a.fontSize*2);assert.deepEqual(resized.lines.map(line=>line.text),a.lines.map(line=>line.text));
 const word='W'.repeat(60),fit=fitBubbleText(word,500,600);assert.ok(fit);assert.equal(fit.lines.join(''),word);
 assert.equal(fitBubbleText('W'.repeat(220),40,40),null);assert.throws(()=>computeBubbleLayout({...speech,width:.02,height:.02},900,1350),/too dense/);
});

test('shared canvas painting changes artwork pixels and keeps the original media bytes untouched',async()=>{
 const {base,runtime}=await fixture(),canvas=runtime.canvas();canvas.width=900;canvas.height=1350;const ctx=canvas.getContext('2d');
 await runtime.image(new Blob([base],{type:'image/png'}),image=>ctx.drawImage(image.value,0,0));const before=sha256Hex(base);
 paintComicBubbles(ctx,[speech,thought],900,1350);const output=await new Promise(resolve=>canvas.toBlob(resolve,'image/png')),rendered=await pixels(new Uint8Array(await output.arrayBuffer()));
 assert.ok(white(rendered.at(100,100)));assert.ok(white(rendered.at(600,100)));assert.equal(sha256Hex(base),before);assert.deepEqual(rendered.at(450,1000).slice(0,3),[36,80,120]);
});

test('production ZIP composites balloons before signatures and keeps public conversion byte-preserving',async()=>{
 const {base,runtime}=await fixture(),saved=story(),archive=await createStoryZip(saved,null,()=>{},runtime),files=unzipSync(new Uint8Array(await archive.arrayBuffer())),data=JSON.parse(strFromU8(files['故事.json']));
 assert.equal(data.pages[0].bubbleRendering,'embedded');assert.deepEqual(data.pages[0].bubbles,[speech,thought]);assert.equal(data.pages[0].originalSha256,sha256Hex(base));
 assertStoryWebp(files['图片/01.webp'],zipMetadataStory(data),0,data.pages[0]);const rendered=await pixels(files['图片/01.webp']),presentation=layoutComicPanel(saved.pages[0],fixturePages(saved)[0].panels[0],fixtureSize),bubble=presentation.bubbles[0];assert.ok(white(rendered.at((bubble.x+bubble.width/2)*presentation.rect.width,(bubble.y+bubble.height*.15)*presentation.rect.height)));assert.deepEqual(data.pages[0].comicRendering,{width:Math.round(presentation.rect.width),height:Math.round(presentation.rect.height),minFontSize:20});assert.deepEqual(convertedLayout(data),[0]);
 const converted=publicStoryZip(new Uint8Array(await archive.arrayBuffer())),publicFiles=unzipSync(converted.bytes);assert.deepEqual(publicFiles['图片/01.webp'],files['图片/01.webp']);assert.deepEqual(converted.story.pages[0].bubbles,[speech,thought]);assert.equal(converted.story.pages[0].bubbleRendering,'embedded');
 assert.deepEqual(unzipSync(publicStoryZip(converted.bytes).bytes)['图片/01.webp'],files['图片/01.webp']);
 assert.match(strFromU8(publicFiles['分镜.md']),/1\. Sam \(speech\): We can cross here\./);assert.match(strFromU8(publicFiles['分镜.md']),/2\. Lee \(thought\): Perhaps there is another way\./);
 assert.throws(()=>publicStoryZipData({...data,pages:[{...data.pages[0],bubbleRendering:undefined}]}),/already contain/);
});

test('legacy archives omit new optional fields and editable JSON does not claim embedded balloons',()=>{
 const plain=story([]),legacy=storyZipData(plain,['图片/01.webp'],[],null),editable=storyZipData(story(),['/api/reader/media/base.png'],[],null);
 assert.equal(Object.hasOwn(legacy.pages[0],'bubbles'),false);assert.equal(Object.hasOwn(legacy.pages[0],'bubbleRendering'),false);assert.equal(Object.hasOwn(editable.pages[0],'bubbleRendering'),false);assert.deepEqual(editable.pages[0].bubbles,[speech,thought]);
 assert.match(strFromU8(storyZipFiles(editable)['分镜.md']),/Sam \(speech\)/);
});

test('silent panels remain valid public archives with empty narration and no balloons',async()=>{
 const {runtime}=await fixture(),archive=await createStoryZip(story([]),null,()=>{},runtime),converted=publicStoryZip(new Uint8Array(await archive.arrayBuffer()));
 assert.equal(converted.story.pages[0].caption,'');assert.equal(Object.hasOwn(converted.story.pages[0],'bubbles'),false);
});

test('raster ZIP and offline HTML do not repaint balloons marked as already embedded',async t=>{
 const {base,app,runtime}=await fixture([{...speech,x:.53,tailX:.75}]),dataHash=sha256Hex(base),saved=story([speech]);saved.pages[0].bubbleRendering='embedded';
 const archive=await createStoryZip(saved,null,()=>{},runtime),files=unzipSync(new Uint8Array(await archive.arrayBuffer())),raster=await pixels(files['图片/01.webp']);
 const metadata=JSON.parse(strFromU8(files['故事.json']));assert.equal(metadata.pages[0].comicRendering.minFontSize,null);assert.equal(metadata.comicPages[0].panels[0].span,'splash');const quarter=structuredClone(metadata);quarter.comicPages[0].panels[0].width/=2;quarter.comicPages[0].panels[0].height/=2;assert.throws(()=>publicStoryZipData(quarter),/canonical panel templates/);
 const reexportStory={...saved,pages:[{...saved.pages[0],comicRendering:metadata.pages[0].comicRendering}]},reexportRuntime={...runtime,read:async()=>new Blob([files['图片/01.webp']],{type:'image/webp'})},again=unzipSync(new Uint8Array(await(await createStoryZip(reexportStory,null,()=>{},reexportRuntime)).arrayBuffer()));assert.equal(JSON.parse(strFromU8(again['故事.json'])).pages[0].comicRendering.minFontSize,null);
 const panel=fixturePages(saved)[0].panels[0],presentation=layoutComicPanel(saved.pages[0],panel,fixtureSize),point=(x,y)=>({x:presentation.art.x-presentation.rect.x+x*presentation.art.width,y:presentation.art.y-presentation.rect.y+y*presentation.art.height});const empty=point(.26,.075),existing=point(.74,.075);
 assert.ok(!white(raster.at(empty.x,empty.y)),'Saved overlay coordinates must not cause a second balloon.');assert.ok(white(raster.at(existing.x,existing.y)),'The existing embedded balloon remains visible.');
 const directory=await mkdtemp(path.join(os.tmpdir(),'shiqu-bubble-embedded-'));t.after(()=>rm(directory,{recursive:true,force:true}));const output=path.join(directory,'preview.html');
 await exportLocalStory(process.cwd(),app,{state:'completed',story:saved},{format:'html',output,preview:true});
 const html=await readFile(output,'utf8'),image=html.match(/src="data:image\/png;base64,([^"]+)"/);assert.ok(image);const sheet=await pixels(Buffer.from(image[1],'base64'));assert.ok(!white(sheet.at(empty.x+presentation.rect.x,empty.y+presentation.rect.y)));assert.ok(white(sheet.at(existing.x+presentation.rect.x,existing.y+presentation.rect.y)));assert.equal(sha256Hex(base),dataHash);
});

test('PDF preserves full artwork for balloon pages and PNG visibly paints the same overlays',async()=>{
 const {runtime}=await fixture(),saved=story(),pdf=await PDFDocument.load(await createStoryPdf(saved,()=>{},runtime));assert.ok(pdf.getPageCount()>=2);
 const resources=pdf.getPage(0).node.Resources(),objects=resources.lookup(PDFName.of('XObject'),PDFDict);const jpeg=pdf.context.lookup(objects.values()[0]);const rendered=await pixels(jpeg.contents);
 const presentation=layoutComicPanel(saved.pages[0],fixturePages(saved)[0].panels[0],fixtureSize),bubble=presentation.bubbles[0],x=presentation.rect.x+(bubble.x+bubble.width/2)*presentation.rect.width,y=presentation.rect.y+(bubble.y+bubble.height*.15)*presentation.rect.height;
 assert.ok(white(rendered.at(x,y)));assert.ok(!white(rendered.at(presentation.art.x+presentation.art.width/2,presentation.art.y+presentation.art.height*.9)));
 const png=await createStoryPng(saved,()=>{},runtime),sheet=await pixels(new Uint8Array(await png.arrayBuffer()));assert.ok(sheet.width>=900&&sheet.height>=1350);
 let found=false;for(let row=0;row<sheet.height&&!found;row+=4)for(let column=0;column<sheet.width;column+=4){const pixel=sheet.at(column,row);if(Math.abs(pixel[0]-36)<5&&Math.abs(pixel[1]-80)<5&&Math.abs(pixel[2]-120)<5){found=true;break;}}assert.ok(found,'The full source illustration remains on the comic overview.');
});

test('offline HTML embeds composited pixels and escapes its accessible dialogue transcript',async t=>{
 const {app}=await fixture(),directory=await mkdtemp(path.join(os.tmpdir(),'shiqu-bubble-preview-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const saved=story([{...speech,text:'<script>Stay here</script>'}]),output=path.join(directory,'preview.html');await exportLocalStory(process.cwd(),app,{state:'completed',story:saved},{format:'html',output,preview:true});
 const html=await readFile(output,'utf8');assert.ok(!html.includes('<script>Stay here</script>'));assert.match(html,/&lt;script&gt;Stay here&lt;\/script&gt;/);
 const image=html.match(/src="data:image\/png;base64,([^"]+)"/);assert.ok(image);const rendered=await pixels(Buffer.from(image[1],'base64'));assert.equal(rendered.width,900);assert.equal(rendered.height,1350);assert.match(html,/Comic page 1/);assert.match(html,/Read this page as text/);
});

function convertedLayout(data){return data.comicPages.flatMap(page=>page.panels.map(panel=>panel.frameIndex));}
