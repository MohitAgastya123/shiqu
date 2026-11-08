// Exercise the shared production scenic presentation without a second image pipeline or model calls.
// Synthetic protected subjects prove foreground preservation; actual scene appearance is reviewed privately.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {build} from 'esbuild';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {unzipSync,strFromU8} from 'fflate';
import {PDFDocument} from 'pdf-lib';
import {layoutComicPages,layoutComicPanel,paintComicPanel} from '../lib/comic-page-layout.ts';
import {defaultComicBubblePalette} from '../lib/comic-bubble-palette.ts';
import {imagePrompt,storyPageDirection} from '../lib/reader-generation-contract.ts';
import {nativeExportRuntime} from '../server/story-export.ts';
import {createStoryPdf} from '../lib/reader-pdf.ts';
import {createStoryPng} from '../lib/reader-png.ts';
import {createStoryZip} from '../lib/reader-zip.ts';
import {publicStoryZip} from '../lib/public-story-zip.mjs';
import {makeStory} from './fixtures/story.mjs';

const size={width:1122,height:1402},panel={frameIndex:2,span:'normal',x:602/900,y:54/1350,width:284/900,height:617/1350};
const staging=()=>({canvas:'4:5',focus:{x:.54,y:.66},protectedAreas:[{kind:'face',x:.25,y:.34,width:.18,height:.17},{kind:'face',x:.6,y:.34,width:.18,height:.17},{kind:'action',x:.4,y:.57,width:.2,height:.15},{kind:'action',x:.66,y:.7,width:.27,height:.22}]});
const frame=()=>({caption:'The traveler stopped her companion. Then she noticed a dry box beside the bench.',prompt:'Two adult travelers pause beside the park bench and notice an empty box.',image:'/api/reader/media/scenery/2.png',audio:'',panel:'normal',composition:staging(),bubbles:[{id:'consider',kind:'thought',speaker:'Mara',text:'What if we frighten it more?',x:.2,y:.25,width:.23,height:.086,tailX:.32,tailY:.36},{id:'idea',kind:'speech',speaker:'Mara',text:'I have an idea.',x:.26,y:.38,width:.15,height:.055,tailX:.34,tailY:.45}]});
const intersects=(a,b)=>a.x<b.x+b.width-1e-9&&a.x+a.width>b.x+1e-9&&a.y<b.y+b.height-1e-9&&a.y+a.height>b.y+1e-9;
const pixel=(ctx,x,y)=>[...ctx.getImageData(Math.floor(x),Math.floor(y),1,1).data];
const artwork=(width=1122,height=1402)=>{const canvas=createCanvas(width,height),c=canvas.getContext('2d');c.fillStyle='#18734b';c.fillRect(0,0,width,height);c.fillStyle='#71af60';for(let y=0;y<height*.2;y+=25)for(let x=0;x<width;x+=70)c.fillRect(x,y,35,12);for(const [index,a]of staging().protectedAreas.entries()){c.fillStyle=['#e53428','#af2fb5','#1952d4','#f3bc22'][index];c.fillRect(a.x*width,a.y*height,a.width*width,a.height*height);}return canvas.toBuffer('image/png');};
const runtimeFor=bytes=>nativeExportRuntime(process.cwd(),{handle:async()=>new Response(bytes,{headers:{'Content-Type':'image/png'}})});

test('a dense staged panel reuses bounded scenery and reveals existing canopy at its original scale',()=>{
 const f=frame(),before=structuredClone(f),p=layoutComicPanel(f,panel,size),b=p.scenicBackdrop;assert.ok(b);assert.ok(p.letteringBand);assert.ok(b.viewport.height<p.letteringBand.height);
 assert.equal(b.source.x,0);assert.equal(b.source.y,0);assert.equal(b.source.width,1);assert.ok(b.source.height>=.08&&b.source.height<=.20);assert.ok(b.source.height*size.height>=64);
 assert.ok(Math.abs(b.source.height-.13)<1e-9,'The source strip reserves a full face-height above both face boxes before its single guard.');
 const scale=b.art.width/size.width;assert.ok(Math.abs(scale-b.art.height/size.height)<1e-12);assert.ok(scale<=1);assert.ok(scale/(p.art.width/size.width)<=3.25);
 const sampled={x:(b.viewport.x-b.art.x)/b.art.width,y:(b.viewport.y-b.art.y)/b.art.height,width:b.viewport.width/b.art.width,height:b.viewport.height/b.art.height};assert.ok(sampled.x>=b.source.x-1e-9&&sampled.y>=b.source.y-1e-9&&sampled.x+sampled.width<=b.source.x+b.source.width+1e-9&&sampled.y+sampled.height<=b.source.y+b.source.height+1e-9);
 for(const a of f.composition.protectedAreas){assert.equal(intersects(b.source,{x:Math.max(0,a.x-.04),y:Math.max(0,a.y-.04),width:a.width+.08,height:a.height+.08}),false);if(a.kind==='face')assert.ok(b.source.height<=a.y-a.height-.04+1e-9);}
 assert.ok(p.artViewport.y<p.protectedAreas[0].y);assert.equal(p.artViewport.y,p.art.y);assert.ok(b.viewport.y+b.viewport.height>=p.artViewport.y);assert.deepEqual(f,before);
});

test('unknown, baked, unsafe and undersized scenery retain conservative protection',()=>{
 const unknown=frame();delete unknown.composition;const p=layoutComicPanel(unknown,panel,size);assert.equal(p.scenicBackdrop,undefined);assert.ok(p.letteringBand);
 const unsafe=frame();unsafe.composition.protectedAreas=[{kind:'action',x:0,y:0,width:1,height:1}];assert.equal(layoutComicPanel(unsafe,panel,size).scenicBackdrop,undefined);
 const small=frame();assert.equal(layoutComicPanel(small,panel,{width:160,height:200}).scenicBackdrop,undefined);
 const embedded={...frame(),bubbleRendering:'embedded'},splash=layoutComicPages([embedded])[0].panels[0];assert.equal(layoutComicPanel(embedded,splash,size).scenicBackdrop,undefined);
 const baked={...frame(),comicRendering:{width:284,height:617,minFontSize:20}};assert.equal(layoutComicPanel(baked,panel,{width:284,height:617}).scenicBackdrop,undefined);
 const invalid=frame();invalid.composition.protectedAreas[0].y=NaN;assert.throws(()=>layoutComicPanel(invalid,panel,size),/Panel 3/);
});

test('cached scenery copies cannot mutate source bounds or later presentations',()=>{
 const f=frame(),p=layoutComicPanel(f,panel,size),baseline=structuredClone(p);p.scenicBackdrop.art.x=-1;p.scenicBackdrop.viewport.y=-1;p.scenicBackdrop.source.height=1;assert.deepEqual(layoutComicPanel(f,panel,size),baseline);
 f.composition.protectedAreas[0].y=.05;assert.equal(layoutComicPanel(f,panel,size).scenicBackdrop,undefined);
});

test('hair above a declared face cannot be sampled into the lettering scenery',async()=>{
 const f=frame();f.composition.protectedAreas[0]={kind:'face',x:.15,y:.26,width:.28,height:.19};const dimensions={width:1200,height:1200},canvas=createCanvas(dimensions.width,dimensions.height),ctx=canvas.getContext('2d');ctx.fillStyle='#18734b';ctx.fillRect(0,0,1200,1200);ctx.fillStyle='#da29cf';ctx.fillRect(180,36,336,264);const png=canvas.toBuffer('image/png'),runtime=runtimeFor(png),p=layoutComicPanel(f,panel,dimensions);assert.equal(p.scenicBackdrop,undefined);assert.ok(p.letteringBand);assert.ok(.26-.19-.04<.08,'The earlier .20 strip would include the hair, while the head envelope rejects it.');
 await runtime.ready();const output=createCanvas(900,1350);await paintComicPanel(output.getContext('2d'),f,panel,runtime);const band=p.letteringBand,data=output.getContext('2d').getImageData(Math.ceil(band.x)+2,Math.ceil(band.y)+2,Math.floor(band.width)-4,Math.floor(band.height)-4).data;let duplicated=0;for(let i=0;i<data.length;i+=4)if(data[i]===218&&data[i+1]===41&&data[i+2]===207)duplicated++;assert.equal(duplicated,0,'A second floating head/hair must never appear above the original figure.');
 const raw=await loadImage(png),control=createCanvas(900,1350);control.getContext('2d').drawImage(raw,p.art.x,p.art.y,p.art.width,p.art.height);const originalHead={x:p.art.x+.25*p.art.width,y:p.art.y+.15*p.art.height};assert.deepEqual(pixel(output.getContext('2d'),originalHead.x,originalHead.y),pixel(control.getContext('2d'),originalHead.x,originalHead.y),'The one original head stays at its unchanged position.');
});

test('contained and narrow original art join the scenic region without leaving a paper gap',async()=>{
 for(const [ratio,faceY]of [[1,.34],[.4,.5]]){
  const f=frame();f.composition={canvas:'4:5',focus:{x:.5,y:.5},protectedAreas:[{kind:'face',x:0,y:faceY,width:1,height:.1},{kind:'action',x:0,y:.8,width:1,height:.15}]};f.bubbles=[{...f.bubbles[0],kind:'speech',tailX:.3,tailY:faceY+.05}];const dimensions={width:1200,height:1200/ratio},p=layoutComicPanel(f,panel,dimensions),backdrop=p.scenicBackdrop;assert.ok(backdrop);assert.ok(backdrop.viewport.y+backdrop.viewport.height>=p.art.y,'Scenery must reach the actual first source-image row.');
  if(ratio===1){assert.ok(p.art.y>p.letteringBand.y+p.letteringBand.height+1);const png=artwork(dimensions.width,dimensions.height),runtime=runtimeFor(png);await runtime.ready();const actual=createCanvas(900,1350);await paintComicPanel(actual.getContext('2d'),f,panel,runtime);const colour=pixel(actual.getContext('2d'),p.letteringBand.x+4,p.letteringBand.y+p.letteringBand.height+10);assert.ok(colour[1]>colour[0]*1.4&&colour[1]>colour[2],'The gap below the lettering band must contain scenery.');}
  else{assert.ok(p.art.width<p.letteringBand.width);assert.equal(backdrop.viewport.width,p.letteringBand.width);assert.deepEqual(p.artViewport,p.art,'Narrow foreground pixels keep their original safe containment.');}
 }
});

test('existing scenic pixels that already cover the complete band need no new backdrop crop',()=>{
 const f=frame();f.composition={canvas:'9:16',focus:{x:.5,y:.8},protectedAreas:[{kind:'face',x:.1,y:.8,width:.8,height:.1},{kind:'action',x:0,y:.4,width:1,height:.15}]};f.bubbles=[{...f.bubbles[0],text:'Please wait for me.',tailX:.5,tailY:.85}];const p=layoutComicPanel(f,panel,{width:1122,height:1995});assert.equal(p.protectedAreas.length,1,'Placement used the conservative foreground region.');assert.ok(p.protectedAreas[0].y>p.artViewport.y+100);assert.ok(p.art.y<=p.artViewport.y);assert.equal(p.artViewport.y,p.rect.y+1);assert.equal(p.letteringBand,undefined);assert.equal(p.scenicBackdrop,undefined);assert.equal(p.bubbles[0].text,'Please wait for me.');
});

test('production painting leaves protected foreground pixels identical and fills the old band with scenery',async()=>{
 const f=frame(),png=artwork(),runtime=runtimeFor(png);await runtime.ready();const p=layoutComicPanel(f,panel,size),actual=createCanvas(900,1350),control=createCanvas(900,1350),c=control.getContext('2d');const image=await loadImage(png);c.drawImage(image,p.art.x,p.art.y,p.art.width,p.art.height);await paintComicPanel(actual.getContext('2d'),f,panel,runtime);
 const protectedViewport=p.protectedAreas[0],x=Math.ceil(protectedViewport.x)+3,y=Math.ceil(protectedViewport.y)+3,w=Math.floor(protectedViewport.width)-6,h=Math.floor(protectedViewport.height)-6;assert.deepEqual(actual.getContext('2d').getImageData(x,y,w,h).data,c.getImageData(x,y,w,h).data);
 const background=pixel(actual.getContext('2d'),p.scenicBackdrop.viewport.x+4,p.scenicBackdrop.viewport.y+p.scenicBackdrop.viewport.height/2);assert.ok(background[1]>background[0]*1.4&&background[1]>background[2],'The uncovered lettering area contains green scenery, not plain paper or subject pixels.');
 for(const a of f.composition.protectedAreas){const point={x:p.art.x+(a.x+a.width/2)*p.art.width,y:p.art.y+(a.y+a.height/2)*p.art.height};assert.deepEqual(pixel(actual.getContext('2d'),point.x,point.y),pixel(c,point.x,point.y));}
});

test('reader SVG uses exactly the shared scenic and foreground transforms with independent clips',async()=>{
 const bundled=await build({entryPoints:['client/ui/StoryComicPage.tsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',loader:{'.css':'empty'}}),module={exports:{}};new Function('require','module','exports',bundled.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
 const f=frame(),frames=[{...f,bubbles:[]},{...f,bubbles:[]},f],p=layoutComicPanel(f,panel,size),props={frames,layout:{index:0,panels:[panel]},selectedFrame:2,images:{[f.image]:{...size,palette:defaultComicBubblePalette}},reloads:{},onImageError:()=>{},onImageLoad:()=>{}},html=renderToStaticMarkup(createElement('div',null,createElement(module.exports.default,props),createElement(module.exports.default,props)));
 assert.equal((html.match(/data-scenic-backdrop="true"/g)||[]).length,2);assert.doesNotMatch(html,/class="yu-comic-lettering-band"/);for(const r of [p.art,p.scenicBackdrop.art,p.scenicBackdrop.viewport])for(const key of ['x','y','width','height'])assert.ok(html.includes(`${key}="${r[key]}"`));
 const ids=[...html.matchAll(/<clipPath id="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,4);assert.equal(new Set(ids).size,ids.length);for(const id of ids)assert.ok(html.includes(`clip-path="url(#${id})"`));
});

test('fresh generation directs illustrated environmental headroom without changing source facts',()=>{
 const f=frame(),prompt=imagePrompt({characters:'Two adult travelers wear modern coats.',pages:[f]},0,'ack-comics','',false);assert.match(storyPageDirection,/headroom fully illustrated/);assert.match(prompt,/Continue the illustrated environmental background/);assert.match(prompt,/No text, captions, letters, logos or speech bubbles/);assert.ok(prompt.includes(f.prompt));assert.ok(prompt.includes('Two adult travelers wear modern coats.'));
});

test('real PDF, PNG and signed ZIP exports consume the same scenic presentation without new inference',async()=>{
 const frames=Array.from({length:4},(_,i)=>({...frame(),image:`/api/reader/media/scenery/${i}.png`,bubbles:i===2?frame().bubbles:[],panel:i===3?'wide':'normal',composition:{...staging(),canvas:i===3?'3:2':'4:5'}})),files=frames.map((_,i)=>artwork(i===3?1536:1122,i===3?1024:1402));let reads=0;
 const runtime=nativeExportRuntime(process.cwd(),{handle:async request=>{reads++;const index=Number(new URL(request.url).pathname.match(/(\d+)\.png$/)[1]);return new Response(files[index],{headers:{'Content-Type':'image/png'}});}}),story={...makeStory(4),title:'The patient travelers',summary:'Two travelers help carefully.',theme:'Kindness',sourceText:'The travelers consider a patient approach, find a box, and finish the rescue. FINAL_SENTINEL',reflection:'Care makes room for a safer choice.',adaptationNote:'Original synthetic source and scene geometry.',sourceReference:'Original test story',publication:{author:'Scenery fixture',workUrl:'',contact:'',sourceNote:'Original test source',reuse:'',watermarkFontSize:24},pages:frames};
 const sizes=Object.fromEntries(frames.map((_,i)=>[i,i===3?{width:1536,height:1024}:size])),pages=layoutComicPages(frames,{imageSizes:sizes});assert.ok(pages.flatMap(p=>p.panels).some(panel=>layoutComicPanel(frames[panel.frameIndex],panel,sizes[panel.frameIndex]).scenicBackdrop));
 const pdf=await PDFDocument.load(await createStoryPdf(story,()=>{},runtime));assert.ok(pdf.getPageCount()>=2);assert.ok((await createStoryPng(story,()=>{},runtime)).size>1000);
 const archive=new Uint8Array(await(await createStoryZip(story,null,()=>{},runtime)).arrayBuffer()),zip=unzipSync(archive),data=JSON.parse(strFromU8(zip['故事.json']));assert.equal(data.sourceText,story.sourceText);assert.deepEqual(data.pages.map(p=>p.composition),frames.map(f=>f.composition));assert.ok(reads>0);
 const publicZip=unzipSync(publicStoryZip(archive).bytes);for(let i=1;i<=4;i++){const name=`图片/${String(i).padStart(2,'0')}.webp`;assert.deepEqual(publicZip[name],zip[name]);}
});
