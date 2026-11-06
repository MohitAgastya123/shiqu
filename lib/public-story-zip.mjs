// English product text and generation contracts; canonical source evidence remains unchanged.
// Convert shared archive metadata without repainting embedded balloons or changing signed WebP bytes.
import assert from 'node:assert/strict';
import {unzipSync,zipSync,strFromU8} from 'fflate';
import {imageDimensions} from './reader-image-dimensions.ts';
import {assertStoryWebp} from './story-webp-metadata.ts';
import {zipImageFilename,publicStoryZipData,zipMetadataStory,storyZipFiles} from './reader-zip-content.ts';
export function savedJSON(bytes){
 assert(bytes.length<=100*1024*1024,'ZIP exceeds 100 MiB.');
 const files=unzipSync(bytes,{filter:file=>file.name==='故事.json'});
 assert(files['故事.json']?.length<=1024*1024,'Missing story metadata or story metadata exceeds 1 MiB.');
 return JSON.parse(strFromU8(files['故事.json']));
}

export function publicStoryZip(bytes){
 const input=savedJSON(bytes);
 assert(input&&typeof input==='object'&&!Array.isArray(input),'Story metadata must be an object.');
 for(const key of ['id','title','sourceReference','sourceText','aiDisclosure'])assert(typeof input[key]==='string'&&input[key].trim(),`Missing ${key}; cannot export a complete work.`);
 assert(Array.isArray(input.pages)&&input.pages.length>=1&&input.pages.length<=80,'A story needs 1–80 frames.');
 const story=publicStoryZipData(input),files={},metadata=zipMetadataStory(story);
 const wanted=new Set(input.pages.map((page,index)=>{
  const expected=zipImageFilename(index,input.pages.length);
  assert(page.image===expected,`Frame ${index+1} requires a sequential WebP image: ${expected}`);
  return expected;
 }));
 const images=unzipSync(bytes,{filter:file=>wanted.has(file.name)&&file.originalSize<=12*1024*1024});
 story.pages.forEach((page,index)=>{
  const image=images[page.image];
  assert(image?.length,`Frame ${index+1} is missing or exceeds 12 MiB.`);
  assertStoryWebp(image,metadata,index,page);
  if(page.comicRendering){const size=imageDimensions(image);assert(size&&size.width===page.comicRendering.width&&size.height===page.comicRendering.height,`Frame ${index+1} embedded comic dimensions do not match its saved image.`);}
  assert(typeof page.caption==='string',`Frame ${index+1} narration must be a string.`);
  files[page.image]=image;
 });
 Object.assign(files,storyZipFiles(story,{includePrompts:false}));
 for(const name of ['分镜.md','故事.json','署名与转载.txt'])assert(files[name].length<=1024*1024,`${name} exceeds 1 MiB.`);
 const output=zipSync(files,{level:0});assert(output.length<=100*1024*1024,'Exported ZIP exceeds 100 MiB.');
 return {bytes:output,story};
}
