// Share public archive conversion without a browser or filesystem; keep encoded WebPs unchanged.
import assert from 'node:assert/strict';
import {unzipSync,zipSync,strFromU8} from 'fflate';
import {assertStoryWebp} from './story-webp-metadata.ts';
import {zipImageFilename,publicStoryZipData,zipMetadataStory,storyZipFiles} from './reader-zip-content.ts';
export function savedJSON(bytes){
 assert(bytes.length<=100*1024*1024,'ZIP 超过 100 MiB。');
 const files=unzipSync(bytes,{filter:file=>file.name==='故事.json'});
 assert(files['故事.json']?.length<=1024*1024,'缺少故事.json，或故事.json 超过 1 MiB。');
 return JSON.parse(strFromU8(files['故事.json']));
}

export function publicStoryZip(bytes){
 const input=savedJSON(bytes);
 assert(input&&typeof input==='object'&&!Array.isArray(input),'故事.json 必须是对象。');
 for(const key of ['id','title','sourceReference','sourceText','aiDisclosure'])assert(typeof input[key]==='string'&&input[key].trim(),`缺少${key}，不能导出完整作品。`);
 assert(Array.isArray(input.pages)&&input.pages.length>=1&&input.pages.length<=80,'故事需要 1–80 幅。');
 const story=publicStoryZipData(input),files={},metadata=zipMetadataStory(story);
 const wanted=new Set(input.pages.map((page,index)=>{
  const expected=zipImageFilename(index,input.pages.length);
  assert(page.image===expected,`第 ${index+1} 幅必须有连续编号的 WebP 图片：${expected}`);
  return expected;
 }));
 const images=unzipSync(bytes,{filter:file=>wanted.has(file.name)&&file.originalSize<=12*1024*1024});
 story.pages.forEach((page,index)=>{
  const image=images[page.image];
  assert(image?.length,`缺少第 ${index+1} 幅图片，或图片超过 12 MiB。`);
  assertStoryWebp(image,metadata,index,page);
  assert(typeof page.caption==='string'&&page.caption.trim(),`第 ${index+1} 幅缺少旁白。`);
  files[page.image]=image;
 });
 Object.assign(files,storyZipFiles(story,{includePrompts:false}));
 for(const name of ['分镜.md','故事.json','署名与转载.txt'])assert(files[name].length<=1024*1024,`${name} 超过 1 MiB。`);
 const output=zipSync(files,{level:0});assert(output.length<=100*1024*1024,'导出 ZIP 超过 100 MiB。');
 return {bytes:output,story};
}

