// English product text and generation contracts; canonical source evidence remains unchanged.
// Export complete shared comic panels before the existing credited WebP/hash/XMP pipeline.
import {zipSync,strToU8} from 'fflate';
import type {Story} from './content';
import type {GeneratedStory} from './reader-model';
import {request} from './reader-request.ts';
import {archivePromptHistory,promptRecordText} from './reader-prompt-records.ts';
import type {StoryPromptArchive,StoryPromptHistory} from './reader-prompt-records.ts';
import {zipFilename,zipImageFilename,assertZipReady,storyZipData,storyZipFiles} from './reader-zip-content.ts';
export {zipFilename,assertZipReady} from './reader-zip-content.ts';
import {drawStoryWatermarks} from './story-watermark.ts';
import {layoutComicPages,paintComicPanel,readComicImageSizes} from './comic-page-layout.ts';
import type {ComicPanel} from './comic-page-layout.ts';
import {sha256Hex,webpPayloadHash,publicImageXmp,withWebpXmp,assertStoryWebp} from './story-webp-metadata.ts';
import type {StoryImageHashes} from './story-webp-metadata.ts';
import {browserExportRuntime,type ExportRuntime,type ExportCanvas} from './story-export-runtime.ts';

async function webpImage(blob:Blob,page:number,story:Story,runtime:ExportRuntime,panel:ComicPanel){
 let canvas:ExportCanvas|undefined;
 try{
  canvas=runtime.canvas();canvas.width=Math.round(panel.width*900);canvas.height=Math.round(panel.height*1350);
  const context=canvas.getContext('2d');if(!context)throw Error('CANVAS_UNAVAILABLE');
  context.save();try{context.translate(-panel.x*900,-panel.y*1350);await paintComicPanel(context,story.pages[page],panel,runtime,blob);}finally{context.restore();}
  drawStoryWatermarks(context,canvas.width,canvas.height,story);
  return await new Promise<Blob>((resolve,reject)=>canvas!.toBlob(result=>{
   if(!result?.size||result.type!=='image/webp')reject(Error('WEBP_UNAVAILABLE'));else resolve(result);
  },'image/webp',.85));
 }catch{throw Error(`Frame ${page+1} could not be converted to WebP. Check the image and export runtime.`);}
 finally{if(canvas){canvas.width=0;canvas.height=0;}}
}
function promptText(story:Story,history:StoryPromptArchive){
 const systems=new Map(history.systemPrompts.map(system=>[system.id,system]));
 return [
  `# ${story.title} · Production prompts`,
  'This file contains saved creative and acceptance requirements, scene prompts and recorded system instructions, text input, output contracts and reference-image paths. Review source and custom content before sharing. A reference path does not mean its image is bundled.',
  'Identical system rules are saved once and referenced by each call in the [system prompts](系统提示词.md). Historical rule versions are retained separately; recorded text input is preserved.',
  `## Creative requirements\n\n${history.productionPrompt===null?'Not recorded.':history.productionPrompt||'Not specified.'}`,
  `## Acceptance criteria\n\n${history.acceptancePrompt===null?'Not recorded.':history.acceptancePrompt||'Not specified.'}`,
  '## Scene prompts',
  ...story.pages.map((page,index)=>`### Frame ${index+1}\n\n${page.prompt||'Not recorded.'}`),
  '## Recorded calls',
  'These are saved call records, not a guarantee of full reproducibility. Missing historical records are never reconstructed from current instructions.',
  ...(history.records.length?history.records.map(item=>[
   `### ${item.index+1} · ${item.step} · ${item.model}`,
   `Origin version: ${item.originId}（${item.originId===story.id?'used in this version':'retained from an earlier version'}）`,
   promptRecordText({...item.record,instructions:item.record.instructionsRef?`[${systems.get(item.record.instructionsRef)!.label}](系统提示词.md#${item.record.instructionsRef})`:'No separate system instructions.'}),
  ].join('\n\n')):['Complete prompt call records were not saved.']),
  ...(history.missingRecords.length?[
   '## Calls without complete prompt records',
   ...history.missingRecords.map(item=>`- ${item.index+1} · ${item.step} · ${item.model} · Origin version: ${item.originId} · Not recorded`),
  ]:[]),
 ].join('\n\n')+'\n';
}
function systemPromptText(story:Story,history:StoryPromptArchive){
 return [
  `# ${story.title} · System prompts`,
  'These system rules were saved when calls ran. Identical instructions are stored once; distinct historical versions remain separate and are not replaced with current rules.',
  ...(history.systemPrompts.length?history.systemPrompts.map(system=>`<a id="${system.id}"></a>\n\n## ${system.label}\n\n${system.instructions}`):['No nonempty system instructions were saved. See [prompts](提示词.md) for available call records.']),
 ].join('\n\n')+'\n';
}
export async function createStoryZip(story:Story,history:StoryPromptHistory|null,onProgress:(text:string)=>void=()=>{},runtime:ExportRuntime=browserExportRuntime()){
 assertZipReady(story);
 const generated='generated'in story&&story.generated===true?story as GeneratedStory:null;
 if(generated&&!history)throw Error('Prompt records are not loaded. Retry before exporting ZIP.');
 await runtime.ready();
 const files:Record<string,Uint8Array>={},images:string[]=[],hashes:StoryImageHashes[]=[];
 const imageSizes=await readComicImageSizes(story.pages,runtime),comicPages=layoutComicPages(story.pages,{imageSizes}),panels=comicPages.flatMap(page=>page.panels),comicRenderings=panels.map(panel=>({width:Math.round(panel.width*900),height:Math.round(panel.height*1350),minFontSize:story.pages[panel.frameIndex].comicRendering?.minFontSize===null||!story.pages[panel.frameIndex].comicRendering&&story.pages[panel.frameIndex].bubbleRendering==='embedded'?null:24}));
 for(const [index,page] of story.pages.entries()){
  onProgress(`Packaging frame ${index+1} / ${story.pages.length}`);
  const blob=await runtime.read(page.image,index);
  const webp=await webpImage(blob,index,story,runtime,panels[index]),filename=zipImageFilename(index,story.pages.length);
  const encoded=new Uint8Array(await webp.arrayBuffer()),originalSha256=sha256Hex(new Uint8Array(await blob.arrayBuffer())),imagePayloadSha256=webpPayloadHash(encoded);
  const output=withWebpXmp(encoded,publicImageXmp(story,index,originalSha256,imagePayloadSha256));
  const imageHashes={sha256:sha256Hex(output),originalSha256,imagePayloadSha256};
  assertStoryWebp(output,story,index,imageHashes);
  images.push(filename);files[filename]=output;hashes.push(imageHashes);
 }
 onProgress('Preparing storyboard and saving ZIP');
 const archive=archivePromptHistory(history);
 Object.assign(files,storyZipFiles(storyZipData(story,images,hashes,history,{bubbleRendering:'embedded',comicPages,comicRenderings})));
 files['提示词.md']=strToU8(promptText(story,archive));
 files['系统提示词.md']=strToU8(systemPromptText(story,archive));
 // Keep full call inputs outside the story metadata consumed by reading sites.
 files['提示词.json']=strToU8(JSON.stringify(archive,null,2)+'\n');
 // WebP is already compressed; avoid repeating compression while building the archive.
 return new Blob([zipSync(files,{level:0}) as BlobPart],{type:'application/zip'});
}
export async function downloadStoryZip(story:Story,onProgress:(text:string)=>void){
 assertZipReady(story);
 onProgress('Reading saved prompts');
 const history:StoryPromptHistory|null='generated'in story&&story.generated===true?await request(`reader/sessions/${encodeURIComponent(story.id)}/prompts`):null;
 const blob=await createStoryZip(story,history,onProgress),url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=zipFilename(story.title);(document.querySelector('dialog[open]')||document.body).appendChild(link);link.click();link.remove();
 return {url,filename:link.download};
}
