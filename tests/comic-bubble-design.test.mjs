// Verify compact protected-area balloons through production geometry, safe bands, offline font and artwork sampling.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createCanvas,GlobalFonts} from '@napi-rs/canvas';
import {computeBubbleLayout,measureBubbleText,fitBubbleText,comicTextWidth,paintComicBubbles,bubbleMinimumFontSize,bubbleTargetFontSize,bubbleTailStart,bubbleTailTip} from '../lib/comic-bubble-layout.ts';
import {autoPlaceBubbles,BubbleDensityError} from '../lib/reader-bubbles.ts';
import {comicBubblePaletteFromPixels,sampleComicBubblePalette,defaultComicBubblePalette} from '../lib/comic-bubble-palette.ts';
import {comicBubbleFontSha256,ensureComicBubbleFont} from '../lib/comic-bubble-font.ts';
import {nativeExportRuntime} from '../server/story-export.ts';
const bubble=(overrides={})=>({id:'speech',kind:'speech',speaker:'Mara',text:'We should cross before sunset.',x:.2,y:.2,width:.42,height:.17,tailX:.5,tailY:.62,...overrides});
const reference={referenceWidth:420,referenceHeight:590};
const rgb=hex=>[1,3,5].map(offset=>parseInt(hex.slice(offset,offset+2),16));
const luminance=hex=>rgb(hex).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((sum,n,index)=>sum+n*[.2126,.7152,.0722][index],0);

test('speech uses one closed oval and attached short tail, without a separately stroked triangle',()=>{
 const layout=computeBubbleLayout(bubble(),900,1350);
 assert.equal(layout.tailPath,undefined);assert.equal(layout.tailCommands.length,0);assert.equal(layout.bodyCommands.filter(c=>c.kind==='M').length,1);assert.equal(layout.bodyCommands.filter(c=>c.kind==='Z').length,1);assert.equal(layout.bodyCommands.filter(c=>c.kind==='L').length,0);
 assert.ok(layout.lines.every(line=>line.text===line.text.toUpperCase()));assert.ok(!layout.lines.some(line=>/MARA/.test(line.text)));assert.equal(layout.lines.join('').includes('Mara:'),false);
 const tail=layout.bodyCommands.at(-3),bounds=layout.bounds;assert.equal(tail.kind,'Q');assert.ok(tail.y>bounds.y+bounds.height);assert.ok(tail.y-(bounds.y+bounds.height)<80,'Distant metadata targets produce a bounded short tail.');
 const thought=computeBubbleLayout(bubble({kind:'thought'}),900,1350);assert.equal(thought.circles.length,3);assert.ok(thought.circles[0].r>thought.circles[1].r&&thought.circles[1].r>thought.circles[2].r);assert.notEqual(thought.path,layout.path);
});

test('content-size placement preserves evidence and targets and fits at final panel pixel dimensions',()=>{
 const original=bubble({text:'Wait for me.',sourceQuote:'Mara said, Wait for me.',tailX:.45,tailY:.65}),input=[original],placed=autoPlaceBubbles(input,reference),[b]=placed;
 assert.deepEqual(input,[original]);assert.equal(b.sourceQuote,original.sourceQuote);assert.equal(b.tailX,original.tailX);assert.equal(b.tailY,original.tailY);assert.ok(b.width<.8);assert.ok(b.height<.4);
 const layout=computeBubbleLayout(b,420,590,reference);assert.ok(layout.fontSize>=20);assert.equal(layout.lines.map(line=>line.text).join(' '),'WAIT FOR ME.');assert.ok(b.y>.2,'Placement follows the speaker instead of forcing a page-top row.');
 assert.deepEqual(autoPlaceBubbles(input,reference),placed);
 const measured=measureBubbleText('Wait for me.','speech',{maxWidth:300,maxHeight:250});assert.ok(measured);assert.ok(measured.width<300&&measured.height<250);assert.ok(fitBubbleText('Wait for me.',measured.width,measured.height));
 assert.throws(()=>autoPlaceBubbles(Array.from({length:4},(_,i)=>bubble({id:String(i),text:'W'.repeat(220)})),reference),BubbleDensityError);
});

test('short dialogue uses compact comic lettering while longer words retain every character',()=>{
 assert.equal(bubbleMinimumFontSize,20);assert.equal(bubbleTargetFontSize,22);
 for(const [text,kind]of [['Wait.','speech'],['I have an idea.','thought'],['A careful choice','speech']]){
  const [placed]=autoPlaceBubbles([bubble({text,kind})],reference),layout=computeBubbleLayout(placed,420,590,reference);
  assert.ok(layout.fontSize>=20&&layout.fontSize<=22);assert.ok(placed.width*420<210);assert.ok(placed.height*590<125);assert.equal(layout.lines.map(line=>line.text).join(' '),text.toUpperCase());
 }
 const text='Supercalifragilisticexpialidocious',measured=measureBubbleText(text,'speech',{maxWidth:240,maxHeight:300});assert.ok(measured);assert.equal(measured.lines.join(''),text.toUpperCase());
});

test('exact-fit words remain readable after normalized pixel geometry round-trips',()=>{
 const placed=bubble({text:'Hello!',x:.3073787296145293,y:.04051863857374392,width:.2994810971089696,height:.08103727714748785,tailX:.4571192781690141,tailY:.1312803889789303});
 const layout=computeBubbleLayout(placed,284,617,{referenceWidth:284,referenceHeight:617});
 assert.equal(layout.lines.map(line=>line.text).join(' '),'HELLO!');assert.ok(layout.fontSize>=20);
 for(const [rw,rh]of [[284,617],[420,590],[900,1350]])for(const kind of ['speech','thought'])for(const text of ['Hello!','Wait.','I have an idea.','Keep going.']){
  const measured=measureBubbleText(text,kind,{maxWidth:rw*.8,maxHeight:rh*.5,fontSize:20});assert.ok(measured);
  const normalized=bubble({text,kind,x:0,y:0,width:measured.width/rw,height:measured.height/rh});
  const rendered=computeBubbleLayout(normalized,rw,rh,{referenceWidth:rw,referenceHeight:rh});
  assert.equal(rendered.lines.map(line=>line.text).join(' '),text.toUpperCase());assert.ok(rendered.fontSize>=20);
 }
});

test('automatic compact placement preserves ordinary words when the panel can fit them',()=>{
 const options={referenceWidth:284,referenceHeight:617};
 for(const kind of ['speech','thought']){
  const [placed]=autoPlaceBubbles([bubble({kind,text:"It's frightened.",tailX:.45,tailY:.75})],options),layout=computeBubbleLayout(placed,284,617,options);
  assert.equal(layout.lines.map(line=>line.text).join(' '),"IT'S FRIGHTENED.");assert.ok(layout.lines.some(line=>line.text.includes('FRIGHTENED.')),'An available wider candidate keeps the complete word.');assert.ok(layout.fontSize>=20);
 }
 const text='Supercalifragilisticexpialidocious',narrow={referenceWidth:180,referenceHeight:617},[placed]=autoPlaceBubbles([bubble({text,tailX:.45,tailY:.75})],narrow),layout=computeBubbleLayout(placed,180,617,narrow);
 assert.equal(layout.lines.map(line=>line.text).join(''),text.toUpperCase(),'A word wider than the whole panel still uses the complete character-wrapping fallback.');
});

test('protected talking and silent faces plus central action retain untouched rendered pixels',async()=>{
 await nativeExportRuntime(process.cwd(),{handle(){throw Error('No media needed');}}).ready();
 const areas=[{x:.22,y:.34,width:.18,height:.18},{x:.65,y:.4,width:.16,height:.18},{x:.46,y:.42,width:.12,height:.16},{x:.39,y:.66,width:.23,height:.16}],input=[bubble({id:'spoken',text:"It's frightened.",tailX:.31,tailY:.48}),bubble({id:'thought',kind:'thought',text:'What if we frighten it more?',tailX:.73,tailY:.54})],original=structuredClone(input);
 const options={...reference,protectedAreas:areas,bodyBounds:{x:0,y:0,width:1,height:.84}},placed=autoPlaceBubbles(input,options);
 assert.deepEqual(input,original);assert.deepEqual(autoPlaceBubbles(input,options),placed);assert.deepEqual(autoPlaceBubbles(input,{...options,protectedAreas:[...areas].reverse()}),placed);assert.deepEqual(placed.map(b=>[b.id,b.speaker,b.text,b.sourceQuote]),original.map(b=>[b.id,b.speaker,b.text,b.sourceQuote]));
 const canvas=createCanvas(420,590),ctx=canvas.getContext('2d');paintComicBubbles(ctx,placed,420,590,reference);
 for(const area of areas){const data=ctx.getImageData(Math.ceil(area.x*420),Math.ceil(area.y*590),Math.floor(area.width*420)-1,Math.floor(area.height*590)-1).data;assert.ok(data.every((value,index)=>index%4!==3||value===0),'Balloon bodies, tails and thought trails cannot paint a protected face/action.');}
 assert.ok(placed.some((b,index)=>b.tailX!==input[index].tailX||b.tailY!==input[index].tailY),'Only presentation tips are clipped before the protected faces.');
 for(const b of placed){const start=bubbleTailStart(b),tip=bubbleTailTip(b,reference);assert.ok(Math.hypot((start.x-tip.x)*420,(start.y-tip.y)*590)<=64+1e-6);}
});

test('legacy lettering bands keep bodies and short tips outside the entire unknown artwork',async()=>{
 await nativeExportRuntime(process.cwd(),{handle(){throw Error('No media needed');}}).ready();
 const input=[bubble({id:'first',text:'Wait here.',tailX:.8,tailY:.7}),bubble({id:'second',kind:'thought',text:'I have an idea.',tailX:.2,tailY:.8})],original=structuredClone(input),bodyBounds={x:0,y:0,width:1,height:.26},art={x:0,y:.28,width:1,height:.72},options={...reference,protectedAreas:[art],bodyBounds,allowDistantTails:true};
 const placed=autoPlaceBubbles(input,options),canvas=createCanvas(420,590),ctx=canvas.getContext('2d');paintComicBubbles(ctx,placed,420,590,reference);
 assert.deepEqual(input,original);assert.equal(placed.length,2);assert.ok(placed[1].y+placed[1].height/2>=placed[0].y+placed[0].height/2-.04);
 for(const b of placed){assert.ok(b.y>=0&&b.y+b.height<=bodyBounds.height);assert.ok(b.tailY<art.y);const start=bubbleTailStart(b);assert.ok(Math.hypot((start.x-b.tailX)*420,(start.y-b.tailY)*590)<=64+1e-6);}
 const pixels=ctx.getImageData(0,Math.ceil(art.y*590),420,590-Math.ceil(art.y*590)).data;assert.ok(pixels.every((value,index)=>index%4!==3||value===0),'Unknown artwork is not crossed by lettering or a connector.');
 assert.throws(()=>autoPlaceBubbles(input,{...options,bodyBounds:{x:0,y:0,width:1,height:.05}}),BubbleDensityError);
 assert.throws(()=>autoPlaceBubbles(input,{...options,protectedAreas:[{x:0,y:0,width:1,height:1}]}),BubbleDensityError);
 for(const invalid of [{bodyBounds:{x:.9,y:0,width:.2,height:.2}},{protectedAreas:[{x:0,y:0,width:0,height:.1}]},{maxFontSize:19}])assert.throws(()=>autoPlaceBubbles(input,{...reference,...invalid}),BubbleDensityError);
});

test('ranked placement stays bounded for eighty four-balloon panels',()=>{
 const input=Array.from({length:4},(_,index)=>bubble({id:String(index),kind:index%2?'thought':'speech',text:'We can help.',tailX:.12+index*.25,tailY:.8})),options={referenceWidth:900,referenceHeight:1350,bodyBounds:{x:0,y:0,width:1,height:.25},protectedAreas:[{x:0,y:.3,width:1,height:.7}],allowDistantTails:true},start=process.cpuUsage();
 for(let index=0;index<80;index++){const placed=autoPlaceBubbles(input,options);assert.equal(placed.length,4);assert.deepEqual(placed.map(b=>b.text),input.map(b=>b.text));}
 const elapsed=process.cpuUsage(start);assert.ok(elapsed.user+elapsed.system<3_000_000,'Eighty layouts stay within a finite CPU-work budget, excluding host suspension.');
});

test('artwork sampling gives deterministic cohesive fills with strong text contrast',()=>{
 const red=Uint8ClampedArray.from(Array.from({length:100},()=>[185,60,35,255]).flat()),blue=Uint8ClampedArray.from(Array.from({length:100},()=>[35,70,185,255]).flat());
 const warm=comicBubblePaletteFromPixels(red),cool=comicBubblePaletteFromPixels(blue);assert.deepEqual(comicBubblePaletteFromPixels(red),warm);assert.notEqual(warm.fill,cool.fill);assert.ok(rgb(warm.fill)[0]>rgb(warm.fill)[2]);assert.ok(rgb(cool.fill)[2]>rgb(cool.fill)[0]);
 for(const p of [warm,cool,defaultComicBubblePalette])assert.ok((luminance(p.fill)+.05)/(luminance(p.ink)+.05)>7);
 assert.deepEqual(comicBubblePaletteFromPixels([]),defaultComicBubblePalette);
 const art=createCanvas(20,20),ctx=art.getContext('2d');ctx.fillStyle='#b93c23';ctx.fillRect(0,0,20,20);const sample=createCanvas(1,1);assert.deepEqual(sampleComicBubblePalette(art,sample),warm);assert.equal(sample.width,0);assert.equal(sample.height,0);
});

test('the bundled licensed comic face supplies actual native glyph metrics without horizontal stretching',async()=>{
 const font=await readFile('data/export-fonts/ComicNeue-Bold.ttf');assert.equal(createHash('sha256').update(font).digest('hex'),comicBubbleFontSha256);assert.match(await readFile('data/export-fonts/ComicNeue-OFL.txt','utf8'),/SIL OPEN FONT LICENSE/);
 await nativeExportRuntime(process.cwd(),{handle(){throw Error('No media needed');}}).ready();assert.ok(GlobalFonts.has('Shiqu Comic'));
 const canvas=createCanvas(900,1350),ctx=canvas.getContext('2d');ctx.font='700 32px "Shiqu Comic"';ctx.fontKerning='none';for(const text of ['HELLO','WAIT FOR ME.','BEFORE SUNSET'])assert.ok(Math.abs(ctx.measureText(text).width-comicTextWidth(text,32))<.01);
 const scale=ctx.scale;ctx.scale=()=>{throw Error('Comic lettering must not be horizontally distorted.');};paintComicBubbles(ctx,[bubble()],900,1350);ctx.scale=scale;
 assert.ok(ctx.getImageData(350,360,1,1).data[3]>0,'The actual native font and balloon paint successfully.');
});

test('standalone browser readiness registers the actual bundled face, shares concurrent loads, and retries failures',async t=>{
 const originalDocument=globalThis.document,originalFace=globalThis.FontFace;t.after(()=>{if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;if(originalFace===undefined)delete globalThis.FontFace;else globalThis.FontFace=originalFace;});
 let attempts=0,fail=true;const registered=new Set(),fonts={ready:Promise.resolve(),add(face){registered.add(face);},async load(){return [...registered];}};
 globalThis.document={fonts};globalThis.FontFace=class{
  constructor(family,source,options){this.family=family;this.source=source;this.options=options;this.status='unloaded';}
  async load(){attempts++;if(fail)throw Error('Offline asset unavailable');const bytes=await readFile(new URL(this.source.match(/^url\("(.+)"\)$/)[1]));assert.equal(createHash('sha256').update(bytes).digest('hex'),comicBubbleFontSha256);assert.equal(this.family,'Shiqu Comic');assert.equal(this.options.weight,'700');this.status='loaded';return this;}
 };
 await assert.rejects(ensureComicBubbleFont(),/asset unavailable/);fail=false;await Promise.all([ensureComicBubbleFont(),ensureComicBubbleFont()]);assert.equal(attempts,2);assert.equal(registered.size,1);await ensureComicBubbleFont();assert.equal(attempts,2);
});
