// Exercise the production compositor's protected crops, unknown-scene bands and actual export roundtrips.
// Synthetic geometry marks important content without claiming semantic recognition of generated pixels.
import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutComicPages,layoutComicPanel,comicSignatureHeight,validatedComicPages,ComicPanelDensityError} from '../lib/comic-page-layout.ts';
import {computeBubbleLayout} from '../lib/comic-bubble-layout.ts';
const frame=(extra={})=>({caption:'The travelers find a kitten beside the river.',prompt:'Two travelers kneel beside a kitten on a stone.',image:'/fixture.png',audio:'',...extra});
const bubble=(extra={})=>({id:'hello',kind:'speech',speaker:'Traveler',text:'It is frightened.',x:.1,y:.1,width:.4,height:.2,tailX:.35,tailY:.36,...extra});
const composition=(extra={})=>({canvas:'4:5',focus:{x:.5,y:.5},protectedAreas:[{kind:'face',x:.23,y:.18,width:.2,height:.18},{kind:'action',x:.42,y:.5,width:.5,height:.25}],...extra});
const intersects=(a,b)=>a.x<b.x+b.width-1e-6&&a.x+a.width>b.x+1e-6&&a.y<b.y+b.height-1e-6&&a.y+a.height>b.y+1e-6;
const body=(p,b)=>({x:p.rect.x+b.x*p.rect.width,y:p.rect.y+b.y*p.rect.height,width:b.width*p.rect.width,height:b.height*p.rect.height});

test('legacy portraits soften unsafe wide hints and keep every source pixel with scene-independent lettering',()=>{
 const frames=Array.from({length:10},(_,index)=>frame({panel:[0,3,7,9].includes(index)?'wide':index===8?'large':'normal',bubbles:index===1?[bubble()]:[]})),sizes=Object.fromEntries(frames.map((_,i)=>[i,{width:941,height:1672}])),pages=layoutComicPages(frames,{imageSizes:sizes});
 assert.deepEqual(pages.flatMap(page=>page.panels.map(panel=>panel.frameIndex)),frames.map((_,i)=>i));assert.notEqual(pages[0].panels[0].span,'wide');assert.ok(pages[0].panels.length>=3);
 for(const panel of pages.flatMap(page=>page.panels)){const p=layoutComicPanel(frames[panel.frameIndex],panel,sizes[panel.frameIndex]);assert.equal(p.cropped,false);assert.ok(Math.abs(p.art.width/p.art.height-941/1672)<1e-9);assert.ok(p.artOccupancy>.5);for(const b of p.bubbles)assert.equal(intersects(body(p,b),p.artViewport),false);if(p.bubbles.length)assert.ok(p.letteringBand);}
});
test('planned focal crops fill their viewport while keeping every protected face and decisive action visible',()=>{
 const frames=[frame({panel:'wide',composition:composition({canvas:'3:2'}),bubbles:[bubble({tailX:.33,tailY:.32})]}),frame({composition:composition()}),frame({composition:composition()})],sizes={0:{width:1536,height:1024},1:{width:1024,height:1280},2:{width:1024,height:1280}},pages=layoutComicPages(frames,{imageSizes:sizes});
 for(const panel of pages.flatMap(page=>page.panels)){const f=frames[panel.frameIndex],p=layoutComicPanel(f,panel,sizes[panel.frameIndex]);assert.ok(p.art.x<=p.artViewport.x+1e-6&&p.art.y<=p.artViewport.y+1e-6);assert.ok(p.art.x+p.art.width>=p.artViewport.x+p.artViewport.width-1e-6);for(const area of f.composition.protectedAreas){const a={x:p.art.x+area.x*p.art.width,y:p.art.y+area.y*p.art.height,width:area.width*p.art.width,height:area.height*p.art.height};assert.ok(a.x>=p.artViewport.x-1e-6&&a.y>=p.artViewport.y-1e-6&&a.x+a.width<=p.artViewport.x+p.artViewport.width+1e-6&&a.y+a.height<=p.artViewport.y+p.artViewport.height+1e-6);for(const b of p.bubbles)assert.equal(intersects(a,body(p,b)),false);}}
});
test('a fully protected scene gets a compact lettering band instead of a forced overlap or lost dialogue',()=>{
 const f=frame({composition:composition({protectedAreas:[{kind:'action',x:0,y:0,width:1,height:1}]}),bubbles:[bubble(),bubble({id:'idea',kind:'thought',speaker:'Companion',text:'We should be patient.',tailX:.65,tailY:.45})]}),panel=layoutComicPages([f])[0].panels[0],p=layoutComicPanel(f,panel);assert.ok(p.letteringBand);assert.equal(p.bubbles.map(b=>b.text).join('|'),f.bubbles.map(b=>b.text).join('|'));for(const b of p.bubbles){assert.equal(intersects(body(p,b),p.artViewport),false);const layout=computeBubbleLayout(b,p.rect.width,p.rect.height,{referenceWidth:p.rect.width,referenceHeight:p.rect.height});assert.ok(layout.fontSize>=20);}
});
test('signature clearance follows the real maximum font and keeps narration outside its drawing area',()=>{
 const f=frame({caption:'The travelers return home safely. '.repeat(4).trim()}),panel=layoutComicPages([f],{watermarkFontSize:48})[0].panels[0],small=layoutComicPanel(f,panel,undefined,{watermarkFontSize:12}),large=layoutComicPanel(f,panel,undefined,{watermarkFontSize:48});assert.equal(large.signature.height,comicSignatureHeight(large.rect.width,48));assert.ok(large.signature.height>small.signature.height);for(const line of large.captionLines)assert.ok(line.y+large.captionLineHeight<=large.signature.y);assert.equal(large.captionLines.map(line=>line.text).join(' '),f.caption);
});
test('composition and publication changes invalidate cached geometry and returned regions remain isolated',()=>{
 const f=frame({composition:composition(),bubbles:[bubble()]}),panel=layoutComicPages([f])[0].panels[0],a=layoutComicPanel(f,panel);a.artViewport.x=-500;a.protectedAreas[0].x=-100;assert.notDeepEqual(layoutComicPanel(f,panel).artViewport,a.artViewport);f.composition.focus.x=.2;f.composition.protectedAreas.push({kind:'face',x:.8,y:.1,width:.15,height:.2});const b=layoutComicPanel(f,panel,undefined,{watermarkFontSize:48});assert.ok(b.signature.height>a.signature.height);assert.ok(b.protectedAreas.every(area=>area.x>=b.rect.x));
});
test('finite new and historical maps remain valid and impossible lettering reports its frame',()=>{
 const frames=Array.from({length:80},()=>frame()),pages=layoutComicPages(frames);assert.deepEqual(validatedComicPages(pages,80),pages);assert.ok(pages.every(page=>page.panels.length<=6));assert.throws(()=>layoutComicPages([frame({caption:'W'.repeat(6000)})]),ComicPanelDensityError);const bad=structuredClone(pages);bad[0].panels[0].width=.999;assert.throws(()=>validatedComicPages(bad,80),/overlap|rectangle|canonical/);
});

test('dense upcoming scenes cannot leave the lower half of an intermediate comic page empty',()=>{
 const frames=Array.from({length:10},(_,index)=>frame({caption:'The travelers looked for a safe way to reach the animal across the water.',panel:index===3?'wide':'normal',composition:composition({canvas:index===3?'3:2':'4:5',protectedAreas:index===2||index===3?[{kind:'action',x:0,y:0,width:1,height:1}]:[{kind:'face',x:.25,y:.3,width:.2,height:.2}]}),bubbles:index===2||index===3?[bubble({text:'We must make sure the little one is safe. '.repeat(4).trim()})]:[]})),sizes=Object.fromEntries(frames.map((f,index)=>[index,f.composition.canvas==='3:2'?{width:1536,height:1024}:{width:1024,height:1280}])),pages=layoutComicPages(frames,{imageSizes:sizes});
 assert.deepEqual(pages.flatMap(page=>page.panels.map(panel=>panel.frameIndex)),frames.map((_,index)=>index));
 for(const page of pages.slice(0,-1)){
  assert.ok(Math.max(...page.panels.map(panel=>panel.y+panel.height))>.95,'Continuing pages must reach the bottom panel row.');
  assert.ok(page.panels.reduce((area,panel)=>area+panel.width*panel.height,0)>.85,'Continuing pages must occupy the complete comic canvas.');
 }
 assert.deepEqual(validatedComicPages(pages,frames.length),pages);
});

test('three planned portraits and a landscape scene receive filled mixed rows in either reading order',()=>{
 for(const wideOffset of [0,3]){
  const frames=Array.from({length:8},(_,index)=>frame({caption:'The travelers follow the river and find a sheltered crossing.',panel:index%4===wideOffset?'wide':'normal',composition:composition({canvas:index%4===wideOffset?'3:2':'4:5',protectedAreas:[{kind:'face',x:.25,y:.3,width:.2,height:.18},{kind:'action',x:.4,y:.55,width:.25,height:.2}]}),bubbles:index%4===1?[bubble({text:'Follow me.'})]:[]})),sizes=Object.fromEntries(frames.map((f,index)=>[index,f.composition.canvas==='3:2'?{width:1536,height:1024}:{width:1024,height:1280}])),pages=layoutComicPages(frames,{imageSizes:sizes});
  assert.deepEqual(pages.map(page=>page.panels.map(panel=>panel.frameIndex)),[[0,1,2,3],[4,5,6,7]]);
  for(const page of pages){
   assert.deepEqual(page.panels.map(panel=>panel.span),frames.slice(page.index*4,page.index*4+4).map(f=>f.panel));
   const wide=page.panels[wideOffset];assert.ok(wide.width>.95);assert.ok(wideOffset===0?wide.y<page.panels[1].y:wide.y>page.panels[0].y);
   for(const panel of page.panels){const p=layoutComicPanel(frames[panel.frameIndex],panel,sizes[panel.frameIndex]);assert.equal(p.artOccupancy,1,'A planned landscape cannot be averaged away as a letterboxed portrait slot.');for(const area of p.protectedAreas){assert.ok(area.x>=p.artViewport.x-1e-6&&area.y>=p.artViewport.y-1e-6&&area.x+area.width<=p.artViewport.x+p.artViewport.width+1e-6&&area.y+area.height<=p.artViewport.y+p.artViewport.height+1e-6);}}
  }
  assert.deepEqual(validatedComicPages(pages,frames.length),pages);
 }
});

test('production exports retain staging, exact source and actual 20px baked geometry through public conversion',async()=>{
 const [{createCanvas},{unzipSync,strFromU8},{PDFDocument},{createStoryPdf},{createStoryPng},{createStoryZip},{publicStoryZip},{nativeExportRuntime},{makeStory}]=await Promise.all([import('@napi-rs/canvas'),import('fflate'),import('pdf-lib'),import('../lib/reader-pdf.ts'),import('../lib/reader-png.ts'),import('../lib/reader-zip.ts'),import('../lib/public-story-zip.mjs'),import('../server/story-export.ts'),import('./fixtures/story.mjs')]);
 const canvas=createCanvas(800,1000),ctx=canvas.getContext('2d');ctx.fillStyle='#8dc9e6';ctx.fillRect(0,0,800,1000);ctx.fillStyle='#eab981';ctx.fillRect(184,180,160,180);ctx.fillStyle='#d44b37';ctx.fillRect(336,500,400,250);const bytes=await canvas.encode('png'),runtime=nativeExportRuntime(process.cwd(),{handle:async()=>new Response(bytes,{headers:{'Content-Type':'image/png'}})});
 const source='Mara and Ivo protect the lantern, cross the river, and return home safely. FINAL_SENTINEL',story={...makeStory(4),title:'The lantern crossing',summary:'Two travelers protect a lantern.',theme:'Kindness',sourceText:source,reflection:'They arrive home together.',adaptationNote:'Synthetic production verification.',publication:{author:'Composition fixture',workUrl:'',contact:'',sourceNote:'Original test fixture',reuse:'',watermarkFontSize:48},pages:Array.from({length:4},(_,i)=>frame({image:`/api/reader/media/composition-${i}.png`,composition:composition(),bubbles:i===0?[bubble({text:'Wait for me.'})]:[]}))};
 const pdf=await PDFDocument.load(await createStoryPdf(story,()=>{},runtime));assert.ok(pdf.getPageCount()>=2);const png=await createStoryPng(story,()=>{},runtime);assert.ok(png.size>1000);
 const archive=new Uint8Array(await(await createStoryZip(story,null,()=>{},runtime)).arrayBuffer()),files=unzipSync(archive),data=JSON.parse(strFromU8(files['故事.json']));assert.equal(data.sourceText,source);assert.deepEqual(data.pages.map(page=>page.composition),story.pages.map(page=>page.composition));assert.ok(data.pages.every(page=>page.comicRendering.minFontSize===20));
 const reopened=layoutComicPages(data.pages,{imageSizes:Object.fromEntries(data.pages.map((page,i)=>[i,{width:page.comicRendering.width,height:page.comicRendering.height}]))});assert.deepEqual(reopened,data.comicPages,'Round-trip raster panels must not promote because of pixel rounding.');
 const publicArchive=unzipSync(publicStoryZip(archive).bytes);for(let i=1;i<=4;i++){const name=`图片/${String(i).padStart(2,'0')}.webp`;assert.deepEqual(publicArchive[name],files[name]);}
});

test('historical embedded balloons remain uncropped even when a later record includes composition',()=>{
 const f=frame({bubbleRendering:'embedded',composition:composition({canvas:'3:2',protectedAreas:[]}),bubbles:[bubble()]}),panel=layoutComicPages([f])[0].panels[0],p=layoutComicPanel(f,panel,{width:1536,height:1024});assert.equal(panel.span,'splash');assert.equal(p.cropped,false);assert.deepEqual(p.bubbles,[]);assert.ok(Math.abs(p.art.width/p.art.height-1.5)<1e-9);
});
