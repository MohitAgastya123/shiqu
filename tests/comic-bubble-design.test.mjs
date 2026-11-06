// Verify the redesigned balloons through shared geometry, placement, offline font and artwork-tone sampling.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createCanvas,GlobalFonts} from '@napi-rs/canvas';
import {computeBubbleLayout,measureBubbleText,fitBubbleText,comicTextWidth,paintComicBubbles} from '../lib/comic-bubble-layout.ts';
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
 const layout=computeBubbleLayout(b,420,590,reference);assert.ok(layout.fontSize>=24);assert.equal(layout.lines.map(line=>line.text).join(' '),'WAIT FOR ME.');assert.ok(b.y>.2,'Placement follows the speaker instead of forcing a page-top row.');
 assert.deepEqual(autoPlaceBubbles(input,reference),placed);
 const measured=measureBubbleText('Wait for me.','speech',{maxWidth:300,maxHeight:250});assert.ok(measured);assert.ok(measured.width<300&&measured.height<250);assert.ok(fitBubbleText('Wait for me.',measured.width,measured.height));
 assert.throws(()=>autoPlaceBubbles(Array.from({length:4},(_,i)=>bubble({id:String(i),text:'W'.repeat(220)})),reference),BubbleDensityError);
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
