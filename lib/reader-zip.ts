// Export credited WebPs, source text and saved prompts; never substitute current rules for missing history.
import {zipSync,strToU8} from 'fflate';
import type {Story} from './content';
import type {GeneratedStory} from './reader-model';
import {request} from './reader-request.ts';
import {archivePromptHistory,promptRecordText} from './reader-prompt-records.ts';
import type {StoryPromptArchive,StoryPromptHistory} from './reader-prompt-records.ts';
import {zipFilename,zipImageFilename,assertZipReady,storyZipData,storyZipFiles} from './reader-zip-content.ts';
export {zipFilename,assertZipReady} from './reader-zip-content.ts';
import {drawStoryWatermarks} from './story-watermark.ts';
import {sha256Hex,webpPayloadHash,publicImageXmp,withWebpXmp,assertStoryWebp} from './story-webp-metadata.ts';
import type {StoryImageHashes} from './story-webp-metadata.ts';

async function webpImage(blob:Blob,page:number,story:Story){
 const image=new Image(),url=URL.createObjectURL(blob);
 let canvas:HTMLCanvasElement|undefined;
 try{
  image.src=url;await image.decode();
  if(!image.naturalWidth||!image.naturalHeight)throw Error('INVALID_IMAGE');
  canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  const context=canvas.getContext('2d');if(!context)throw Error('CANVAS_UNAVAILABLE');
  context.drawImage(image,0,0);
  drawStoryWatermarks(context,canvas.width,canvas.height,story);
  return await new Promise<Blob>((resolve,reject)=>canvas!.toBlob(result=>{
   if(!result?.size||result.type!=='image/webp')reject(Error('WEBP_UNAVAILABLE'));
   else resolve(result);
  },'image/webp',.85));
 }catch{throw Error(`第 ${page+1} 幅画面转为 WebP 失败，请换用支持 WebP 导出的浏览器后重试。`);}
 finally{image.src='';URL.revokeObjectURL(url);if(canvas){canvas.width=0;canvas.height=0;}}
}
function promptText(story:Story,history:StoryPromptArchive){
 const systems=new Map(history.systemPrompts.map(system=>[system.id,system]));
 return [
  `# ${story.title} · 制作提示词`,
  '本文件包含已保存的制作与验收要求、逐幅画面提示词，以及实际调用留存的系统指令、文本输入、输出契约与参考图路径。分享前请检查原文与自定义内容；参考图路径不代表已打包参考图文件。',
  '相同系统规则只保存一次，各次调用引用 [系统提示词](系统提示词.md)；不同历史规则分别保留，文本输入不做删减。',
  `## 制作要求\n\n${history.productionPrompt===null?'未留存。':history.productionPrompt||'未填写。'}`,
  `## 验收要求\n\n${history.acceptancePrompt===null?'未留存。':history.acceptancePrompt||'未填写。'}`,
  '## 逐幅画面提示词',
  ...story.pages.map((page,index)=>`### 第 ${index+1} 幅\n\n${page.prompt||'未留存。'}`),
  '## 实际调用记录',
  '以下仅为已留存的调用记录，不保证完整复现；未留存的历史不使用当前系统规则补造。',
  ...(history.records.length?history.records.map(item=>[
   `### ${item.index+1} · ${item.step} · ${item.model}`,
   `来源版本：${item.originId}（${item.originId===story.id?'本版本实际使用':'沿用旧版本记录'}）`,
   promptRecordText({...item.record,instructions:item.record.instructionsRef?`[${systems.get(item.record.instructionsRef)!.label}](系统提示词.md#${item.record.instructionsRef})`:'未使用独立系统指令。'}),
  ].join('\n\n')):['未留存完整提示词调用记录。']),
  ...(history.missingRecords.length?[
   '## 未留存完整提示词的调用',
   ...history.missingRecords.map(item=>`- ${item.index+1} · ${item.step} · ${item.model} · 来源版本：${item.originId} · 未留存`),
  ]:[]),
 ].join('\n\n')+'\n';
}
function systemPromptText(story:Story,history:StoryPromptArchive){
 return [
  `# ${story.title} · 系统提示词`,
  '以下为实际调用时留存的系统规则，每段原文只保存一次；不同历史版本分别列出，不以当前规则替代。',
  ...(history.systemPrompts.length?history.systemPrompts.map(system=>`<a id="${system.id}"></a>\n\n## ${system.label}\n\n${system.instructions}`):['未留存非空的系统指令；各次调用是否留存完整提示词请查看 [提示词](提示词.md)。']),
 ].join('\n\n')+'\n';
}
export async function createStoryZip(story:Story,history:StoryPromptHistory|null,onProgress:(text:string)=>void=()=>{}){
 assertZipReady(story);
 const generated='generated'in story&&story.generated===true?story as GeneratedStory:null;
 if(generated&&!history)throw Error('提示词记录未载入，无法打包 ZIP，请重试。');
 await document.fonts?.ready;
 const files:Record<string,Uint8Array>={},images:string[]=[],hashes:StoryImageHashes[]=[];
 for(const [index,page] of story.pages.entries()){
  onProgress(`正在打包第 ${index+1} / ${story.pages.length} 幅`);
  const url=new URL(page.image,location.origin);
  if(url.origin!==location.origin)throw Error('画面来源不可用，无法打包 ZIP。');
  const response=await fetch(url.href,{credentials:'same-origin',signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error(`第 ${index+1} 幅读取失败，请保持联网后重试。`);
  const blob=await response.blob();
  const mime=blob.type.split(';')[0].trim().toLowerCase();
  if(!['image/png','image/jpeg','image/webp'].includes(mime)||!blob.size)throw Error(`第 ${index+1} 幅画面暂不可用，无法打包 ZIP。`);
  const webp=await webpImage(blob,index,story),filename=zipImageFilename(index,story.pages.length);
  const encoded=new Uint8Array(await webp.arrayBuffer()),originalSha256=sha256Hex(new Uint8Array(await blob.arrayBuffer())),imagePayloadSha256=webpPayloadHash(encoded);
  const output=withWebpXmp(encoded,publicImageXmp(story,index,originalSha256,imagePayloadSha256));
  const imageHashes={sha256:sha256Hex(output),originalSha256,imagePayloadSha256};
  assertStoryWebp(output,story,index,imageHashes);
  images.push(filename);files[filename]=output;hashes.push(imageHashes);
 }
 onProgress('正在整理分镜与保存 ZIP');
 const archive=archivePromptHistory(history);
 Object.assign(files,storyZipFiles(storyZipData(story,images,hashes,history)));
 files['提示词.md']=strToU8(promptText(story,archive));
 files['系统提示词.md']=strToU8(systemPromptText(story,archive));
 // Keep full call inputs outside the story metadata consumed by reading sites.
 files['提示词.json']=strToU8(JSON.stringify(archive,null,2)+'\n');
 // WebP is already compressed; avoid repeating compression while building the archive.
 return new Blob([zipSync(files,{level:0}) as BlobPart],{type:'application/zip'});
}
export async function downloadStoryZip(story:Story,onProgress:(text:string)=>void){
 assertZipReady(story);
 onProgress('正在读取已保存的提示词');
 const history:StoryPromptHistory|null='generated'in story&&story.generated===true?await request(`reader/sessions/${encodeURIComponent(story.id)}/prompts`):null;
 const blob=await createStoryZip(story,history,onProgress),url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=zipFilename(story.title);(document.querySelector('dialog[open]')||document.body).appendChild(link);link.click();link.remove();
 return {url,filename:link.download};
}
