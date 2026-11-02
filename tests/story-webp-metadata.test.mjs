// Check WebP RIFF/XMP boundaries and independent Node SHA-256 expectations without browser WebCrypto.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {withWebpXmp,webpPayloadHash,sha256Hex,publicImageXmp,xmlText,payloadHashScope} from '../lib/story-webp-metadata.ts';
import {imageDimensions} from '../lib/reader-image-dimensions.ts';
import {watermarkCredit,drawStoryWatermarks} from '../lib/story-watermark.ts';
import {makeStory} from './fixtures/story.mjs';
const source=new Uint8Array(readFileSync(new URL('./fixtures/images/publication.webp',import.meta.url)));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function chunks(bytes){const r=[];for(let i=12;i<bytes.length;){const n=new DataView(bytes.buffer,bytes.byteOffset+i+4,4).getUint32(0,true);r.push({tag:Buffer.from(bytes.subarray(i,i+4)).toString(),data:bytes.subarray(i+8,i+8+n),bytes:bytes.subarray(i,i+8+n+n%2)});i+=8+n+n%2;}return r;}

test('XMP replacement preserves encoded pixels, padding/dimensions and independently verifiable payload/file hashes',()=>{
 const before=chunks(source).filter(c=>['ICCP','ALPH','VP8 ','VP8L'].includes(c.tag));
 const a=withWebpXmp(source,'odd'),b=withWebpXmp(a,'different metadata');
 assert.deepEqual(imageDimensions(a),{width:941,height:1672});
 assert.deepEqual(imageDimensions(b),imageDimensions(source));
 assert.equal(new DataView(a.buffer).getUint32(4,true)+8,a.length);
 assert.equal(a.at(-1),0);assert.equal(chunks(a).find(c=>c.tag==='VP8X').data[0]&4,4);
 assert.equal(chunks(b).filter(c=>c.tag==='XMP ').length,1);
 assert.equal(webpPayloadHash(a),hash(Buffer.concat(before.map(c=>c.bytes))));
 assert.equal(webpPayloadHash(b),webpPayloadHash(source));
 assert.notEqual(sha256Hex(a),sha256Hex(b));assert.equal(sha256Hex(b),hash(b));
 assert.equal(payloadHashScope,'RIFF ICCP/ALPH/VP8/VP8L chunks including headers and padding, in file order');
});

test('public XMP escapes text, removes invalid XML controls and carries full bounded public attribution only',()=>{
 const story={...makeStory(1),generated:true,title:'<标题> & "引号"',publication:{author:'很长的完整署名'.repeat(8),workUrl:'https://example.org/?a=1&b=2',contact:'公开联系',sourceNote:'CC BY-SA',reuse:'<条件>'},productionPrompt:'PRIVATE_SENTINEL'};
 const xmp=publicImageXmp(story,0,'a'.repeat(64),'b'.repeat(64));
 assert.ok(xmp.includes(story.publication.author));assert.ok(xmp.includes('&lt;标题&gt; &amp; &quot;引号&quot;'));
 assert.ok(xmp.includes('shiqu:AIGenerated="true"'));assert.ok(!xmp.includes('PRIVATE_SENTINEL'));
 assert.equal(xmlText('a\x00\ud800\uffffb'),'ab');
 assert.ok(watermarkCredit(story).includes('…'));assert.ok(!watermarkCredit(story).includes(story.publication.author));
 const labels=[],ctx={save(){},restore(){},translate(){},rotate(){},fillText(...values){labels.push({values,font:this.font,opacity:this.fillStyle});}};
 drawStoryWatermarks(ctx,941,1672,story);assert.equal(labels.length,1);assert.equal(Number(labels[0].font.match(/[\d.]+(?=px)/)[0]),12);
 assert.equal(labels[0].opacity,'rgba(255,250,239,.75)');
});

test('invalid/truncated/animated containers fail closed',()=>{
 for(const bytes of [new Uint8Array(),source.subarray(0,source.length-1),Uint8Array.from(source,(_,i)=>i===4?0:source[i])])assert.throws(()=>withWebpXmp(bytes,'x'));
 const a=withWebpXmp(source,'x');a[20]|=2;assert.throws(()=>withWebpXmp(a,'x'));
});

test('hashing works with no secure-context WebCrypto',t=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'crypto');Object.defineProperty(globalThis,'crypto',{value:undefined,configurable:true});t.after(()=>Object.defineProperty(globalThis,'crypto',original));
 assert.equal(sha256Hex(new TextEncoder().encode('abc')),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('lossless alpha and odd-length ICCP survive XMP addition with correct feature flags',()=>{
 const alpha=new Uint8Array(readFileSync(new URL('./fixtures/images/alpha.webp',import.meta.url)));
 const labelled=withWebpXmp(alpha,'alpha');assert.equal(chunks(labelled)[0].data[0]&16,16);
 const parts=chunks(withWebpXmp(source,'first'));
 const iccp=Buffer.alloc(12);iccp.write('ICCP');iccp.writeUInt32LE(3,4);iccp.set([1,2,3],8);
 const body=Buffer.concat([parts[0].bytes,iccp,...parts.slice(1).map(c=>c.bytes),...parts.filter(c=>c.tag==='XMP ').map(c=>c.bytes)]);
 const container=Buffer.alloc(12+body.length);container.write('RIFF');container.writeUInt32LE(container.length-8,4);container.write('WEBP',8);container.set(body,12);
 const result=withWebpXmp(container,'final');
 assert.equal(chunks(result)[0].data[0]&32,32);assert.equal(chunks(result).filter(c=>c.tag==='XMP ').length,1);
 assert.deepEqual(chunks(result).find(c=>c.tag==='ICCP').bytes,new Uint8Array(iccp));
 assert.equal(webpPayloadHash(result),webpPayloadHash(container));
});
