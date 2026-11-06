// Offline exports use shared comic balloon painting, archive rules, and native canvas IO.
// Read media through the in-process production API only; never fetch remote URLs or mutate source images.
import path from 'node:path';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {createCanvas,loadImage,GlobalFonts} from '@napi-rs/canvas';
import {createHash} from 'node:crypto';
import type {Story} from '../lib/content.ts';
import type {ExportRuntime,ExportCanvas} from '../lib/story-export-runtime.ts';
import {createStoryZip} from '../lib/reader-zip.ts';
import {createStoryPdf} from '../lib/reader-pdf.ts';
import {createStoryPng} from '../lib/reader-png.ts';
import {publicStoryZip} from '../lib/public-story-zip.mjs';
import {storyZipData,storyZipFiles} from '../lib/reader-zip-content.ts';
import {imageDimensions} from '../lib/reader-image-dimensions.ts';
import {hasPublicationAuthor,withPublicationDefaults} from '../lib/story-publication.ts';
import type {StoryPromptHistory} from '../lib/reader-prompt-records.ts';
import {comicBubbleFontSha256} from '../lib/comic-bubble-font.ts';
type Application={handle:(request:Request)=>Promise<Response>};
const fontHash='2c76254f6fc379fddfce0a7e84fb5385bb135d3e399294f6eeb6680d0365b74b';
const loaded=new Set<string>();
export function nativeExportRuntime(root:string,app:Application):ExportRuntime{
 return {
  ready:async()=>{
   const comic=path.join(root,'data/export-fonts/ComicNeue-Bold.ttf');
   if(!loaded.has(comic)){const bytes=await readFile(comic);if(createHash('sha256').update(bytes).digest('hex')!==comicBubbleFontSha256)throw Error('EXPORT_COMIC_FONT_INVALID');if(!GlobalFonts.register(bytes,'Shiqu Comic'))throw Error('EXPORT_COMIC_FONT_UNAVAILABLE');loaded.add(comic);}
   const font=path.join(root,'data/export-fonts/NotoSansCJKsc-Regular.otf');if(loaded.has(font))return;
   const bytes=await readFile(font);if(createHash('sha256').update(bytes).digest('hex')!==fontHash)throw Error('EXPORT_FONT_INVALID');
   for(const family of ['Noto Serif SC','Noto Sans CJK SC','PingFang SC','Microsoft YaHei','Songti SC','STSong','SimSun'])if(!GlobalFonts.register(bytes,family))throw Error('EXPORT_FONT_UNAVAILABLE');loaded.add(font);
  },
  canvas:()=>{
   const canvas=createCanvas(1,1);
   const wrapper:ExportCanvas={get width(){return canvas.width;},set width(n){canvas.width=n;},get height(){return canvas.height;},set height(n){canvas.height=n;},getContext:()=>canvas.getContext('2d') as unknown as CanvasRenderingContext2D,
    toBlob:(callback,type='image/png',quality)=>{const format=type==='image/jpeg'?'jpeg':type==='image/webp'?'webp':'png';void (format==='png'?canvas.encode('png'):canvas.encode(format,Math.round((quality??.92)*100))).then(bytes=>callback(new Blob([new Uint8Array(bytes)],{type})),()=>callback(null));}};
   return wrapper;
  },
  read:async(source,page)=>{
   if(!/^\/api\/(?:reader\/)?media\//.test(source)&&!/^\/art\//.test(source))throw Error(`EXPORT_IMAGE_SOURCE_${page+1}`);
   const response=await app.handle(new Request('http://shiqu.local'+source));if(!response.ok)throw Error(`EXPORT_IMAGE_MISSING_${page+1}`);
   const blob=await response.blob();if(!/^image\/(png|jpeg|webp)(;|$)/.test(blob.type)||blob.size>12*1024*1024)throw Error(`EXPORT_IMAGE_INVALID_${page+1}`);return blob;
  },
  image:async(blob,work)=>{
   const bytes=new Uint8Array(await blob.arrayBuffer()),size=imageDimensions(bytes);if(!size||size.width*size.height>64000000)throw Error('EXPORT_IMAGE_INVALID');
   const image=await loadImage(Buffer.from(bytes));return await work({value:image as unknown as CanvasImageSource,width:image.width,height:image.height});
  },
 };
}
import {layoutComicPages,paintComicPage,readComicImageSizes,comicPageWidth,comicPageHeight} from '../lib/comic-page-layout.ts';
const escape=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export async function exportLocalStory(root:string,app:Application,session:any,options:{format:string;output:string;includePrompts?:boolean;allowUnsigned?:boolean;preview?:boolean}){
 if(session.superseded)throw Error('EXPORT_SUPERSEDED_VERSION');let story:Story=session.story;if(!story)throw Error('EXPORT_NO_STORYBOARD');
 const defaults=await(await app.handle(new Request('http://shiqu.local/api/reader/publication-defaults'))).json();story=withPublicationDefaults(story,defaults.publication);
 if(!options.preview&&!hasPublicationAuthor(story.publication)&&!options.allowUnsigned)throw Error('EXPORT_UNSIGNED: set publication author or explicitly pass --allow-unsigned');
 const runtime=nativeExportRuntime(root,app);let bytes:Uint8Array;const format=options.preview?'html':options.format;
 if(format==='json'){bytes=new TextEncoder().encode(JSON.stringify(storyZipData(story,story.pages.map(p=>p.image||''),[],null),null,2)+'\n');}
 else if(format==='md'){bytes=storyZipFiles(storyZipData(story,story.pages.map(p=>p.image||''),[],null))['分镜.md'];}
 else if(format==='html'){
  await runtime.ready();
  const imageSizes=await readComicImageSizes(story.pages,runtime),pages=layoutComicPages(story.pages,{imageSizes}),sheets=[];
  for(const page of pages){
   const canvas=runtime.canvas();canvas.width=comicPageWidth;canvas.height=comicPageHeight;
   try{
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('PREVIEW_CANVAS_UNAVAILABLE');await paintComicPage(ctx,story.pages,page,runtime);
    const image=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('PREVIEW_IMAGE_UNAVAILABLE')),'image/png'));
    const src='data:image/png;base64,'+Buffer.from(await image.arrayBuffer()).toString('base64');
    const transcript=page.panels.map(({frameIndex})=>{const frame=story.pages[frameIndex];return `<li><strong>Panel ${frameIndex+1}</strong><p>${escape(frame.caption)}</p>`+(frame.bubbles?.length?'<ol>'+frame.bubbles.map(bubble=>`<li>${escape(bubble.speaker)} (${bubble.kind}): ${escape(bubble.text)}</li>`).join('')+'</ol>':'')+'</li>';}).join('');
    sheets.push(`<figure><img alt="Comic page ${page.index+1}, panels ${page.panels.map(panel=>panel.frameIndex+1).join(', ')}" src="${src}"><figcaption>Comic page ${page.index+1} / ${pages.length}</figcaption><details><summary>Read this page as text</summary><ol>${transcript}</ol></details></figure>`);
   }finally{canvas.width=0;canvas.height=0;}
  }
  bytes=new TextEncoder().encode(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>${escape(story.title)}</title><style>body{max-width:1000px;margin:2rem auto;padding:0 1rem;font:18px/1.8 system-ui;background:#f5f0e5;color:#243b2c}figure{margin:2rem 0}img{width:100%;height:auto;display:block}figcaption{text-align:center}details{white-space:pre-wrap}</style><h1>${escape(story.title)}</h1>${sheets.join('')}<p>${escape(story.reflection)}</p><details><summary>Source text (English translation)</summary>${escape(story.sourceText)}</details><p>${escape(story.publication?.author||'Unsigned')} · AI-assisted adaptation</p></html>`);
 }else{
  if(session.state!=='completed'||!story.pages.length||story.pages.some(p=>!p.image))throw Error('EXPORT_INCOMPLETE: complete the current version before image export');
  if(format==='zip'){
   const response=await app.handle(new Request(`http://shiqu.local/api/reader/sessions/${story.id}/prompts`));if(!response.ok)throw Error('EXPORT_PROMPTS_UNAVAILABLE');
   const blob=await createStoryZip(story,await response.json() as StoryPromptHistory,()=>{},runtime),archive=new Uint8Array(await blob.arrayBuffer());bytes=options.includePrompts?archive:publicStoryZip(archive).bytes;
  }else if(format==='pdf')bytes=await createStoryPdf(story,()=>{},runtime);
  else if(format==='png')bytes=new Uint8Array(await(await createStoryPng(story,()=>{},runtime)).arrayBuffer());
  else throw Error('EXPORT_FORMAT_INVALID');
 }
 const output=path.resolve(options.output);await writeFile(output,bytes,{flag:'wx',mode:0o600});return {path:output,format,pages:story.pages.length,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
}
