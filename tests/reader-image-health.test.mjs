// Decode real fixture pixels, including corrupt compressed data with valid dimensions/container.
import test from 'node:test';
import assert from 'node:assert/strict';
import {imageBytes} from './fixtures/images.mjs';
import {imageDimensions} from '../lib/reader-image-dimensions.ts';
import {readableImage} from '../server/reader-image-health.ts';
for(const name of ['portrait.png','portrait.jpg','portrait-progressive.jpg','portrait.webp','portrait-lossy.webp','alpha.webp'])test(`offline image health decodes ${name}`,async()=>{assert.equal(await readableImage(imageBytes(name)),true);});
for(const [name,format] of [['portrait.png','png'],['portrait.jpg','jpeg'],['portrait-lossy.webp','webp']])test(`${format}: valid dimensions cannot hide corrupt pixel data or reuse a healthy cache entry`,async()=>{
 const good=imageBytes(name);assert.equal(await readableImage(good),true);const bytes=Buffer.from(good);
 if(format==='png')bytes[bytes.indexOf('IDAT')+4]^=255;
 else if(format==='jpeg'){const i=bytes.indexOf(Buffer.from([255,218])),start=i+2+bytes.readUInt16BE(i+2);bytes.fill(0,start,bytes.length-2);bytes[start]=255;bytes[start+1]=2;}
 else bytes.fill(0,30);
 assert.ok(imageDimensions(bytes),'The old metadata-only check still passes');assert.equal(await readableImage(bytes),false);assert.equal(await readableImage(good),true,'A bad decode cannot poison a later good image');
});
