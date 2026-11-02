// Export one shareable archive: credited WebPs, source text and public metadata, never internal prompts.
import {zipSync,strToU8} from 'fflate';
import type {Story} from './content';
import type {GeneratedStory} from './reader-model';
import {pdfFilename,storySourceReference} from './reader-pdf.ts';
import {aiDisclosure,publicationText} from './story-publication.ts';
import {drawStoryWatermarks} from './story-watermark.ts';
import {sha256Hex,webpPayloadHash,publicImageXmp,withWebpXmp} from './story-webp-metadata.ts';

export function zipFilename(title:string){return pdfFilename(title).replace(/-拾趣\.pdf$/,'.zip');}
export function assertZipReady(story:Story){
 if(!story.pages.length||story.pages.some(page=>!page.image))throw Error('等所有画面生成完成后，就能下载分镜与图片 ZIP。');
}
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
function storyboardText(story:Story,images:string[]){
 const generated='generated'in story&&story.generated===true?story as GeneratedStory:null;
 return [
  `# ${story.title}`,story.summary,`主题：${story.theme}`,`出处：${storySourceReference(story)}`,
  story.sourceUrl&&`出处链接：${story.sourceUrl}`,
  generated?.artStyleLabel&&`画风：${generated.artStyleLabel}`,
  `## 署名与转载\n\n${publicationText(story)}`,
  ...story.pages.map((page,index)=>`## 第 ${index+1} 幅\n\n图片：${images[index]}\n\n### 旁白\n\n${page.caption}`),
  story.reflection&&`## 余味\n\n${story.reflection}`,
  story.adaptationNote&&`## 改编说明\n\n${story.adaptationNote}`,
  story.sourceText&&`## 保存的原文\n\n${story.sourceText}`,
 ].filter(Boolean).join('\n\n')+'\n';
}
export async function createStoryZip(story:Story,onProgress:(text:string)=>void=()=>{}){
 assertZipReady(story);
 await document.fonts?.ready;
 const files:Record<string,Uint8Array>={},images:string[]=[],hashes:{sha256:string;originalSha256:string;imagePayloadSha256:string}[]=[];
 const digits=Math.max(2,String(story.pages.length).length);
 for(const [index,page] of story.pages.entries()){
  onProgress(`正在打包第 ${index+1} / ${story.pages.length} 幅`);
  const url=new URL(page.image,location.origin);
  if(url.origin!==location.origin)throw Error('画面来源不可用，无法打包 ZIP。');
  const response=await fetch(url.href,{credentials:'same-origin',signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error(`第 ${index+1} 幅读取失败，请保持联网后重试。`);
  const blob=await response.blob();
  const mime=blob.type.split(';')[0].trim().toLowerCase();
  if(!['image/png','image/jpeg','image/webp'].includes(mime)||!blob.size)throw Error(`第 ${index+1} 幅画面暂不可用，无法打包 ZIP。`);
  const webp=await webpImage(blob,index,story),filename=`图片/${String(index+1).padStart(digits,'0')}.webp`;
  const encoded=new Uint8Array(await webp.arrayBuffer()),originalSha256=sha256Hex(new Uint8Array(await blob.arrayBuffer())),imagePayloadSha256=webpPayloadHash(encoded);
  const output=withWebpXmp(encoded,publicImageXmp(story,index,originalSha256,imagePayloadSha256));
  images.push(filename);files[filename]=output;hashes.push({sha256:sha256Hex(output),originalSha256,imagePayloadSha256});
 }
 onProgress('正在整理分镜与保存 ZIP');
 files['分镜.md']=strToU8(storyboardText(story,images));
 const generated='generated'in story&&story.generated===true?story as GeneratedStory:null;
 files['故事.json']=strToU8(JSON.stringify({
  id:story.id,title:story.title,summary:story.summary,bookId:story.bookId,theme:story.theme,
  sourceReference:storySourceReference(story),sourceText:story.sourceText,sourceUrl:story.sourceUrl,
  artStyleLabel:generated?.artStyleLabel??null,
  author:story.publication?.author||'',publication:story.publication||null,
  aiGenerated:generated?true:null,aiDisclosure:aiDisclosure(story),
  generationModels:generated?.generationModels??[],
  pages:story.pages.map((page,index)=>({caption:page.caption,image:images[index],...hashes[index]})),
  reflection:story.reflection,adaptationNote:story.adaptationNote,
  revision:story.revision,createdAt:story.createdAt,updatedAt:story.updatedAt,
 },null,2)+'\n');
 files['署名与转载.txt']=strToU8(`${story.title}\n\n${publicationText(story)}\n\n原作出处：${storySourceReference(story)}\n${story.sourceUrl}\n\n作品编号：${story.id}\n版本：${story.revision}\n保存时间：${story.updatedAt}\n`);
 // WebP is already compressed; avoid repeating compression while building the archive.
 return new Blob([zipSync(files,{level:0}) as BlobPart],{type:'application/zip'});
}
export async function downloadStoryZip(story:Story,onProgress:(text:string)=>void){
 const blob=await createStoryZip(story,onProgress),url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=zipFilename(story.title);(document.querySelector('dialog[open]')||document.body).appendChild(link);link.click();link.remove();
 return {url,filename:link.download};
}
