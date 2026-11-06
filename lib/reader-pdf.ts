// English product text and generation contracts; canonical source evidence remains unchanged.
// Export automatic comic sheets using the shared full-art panel presentation, followed by source notes.
import {themeLabel} from './reader-language.ts';
import type {Story} from './content';
import {browserExportRuntime,type ExportRuntime} from './story-export-runtime.ts';
import {publicationCredit,publicationText} from './story-publication.ts';
import {layoutComicPages,paintComicPage,readComicImageSizes} from './comic-page-layout.ts';

const W=900,H=1350,M=72;
const serif='"Noto Serif SC", "Songti SC", "STSong", serif';
const sans='"Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif';
export function storySourceReference(story:Story){
 if('sourceReference'in story&&typeof story.sourceReference==='string')return story.sourceReference;
 return 'See the source link for the original';
}
export function pdfFilename(title:string){return (title.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'').trim().slice(0,60)||'Shiqu Story')+'-Shiqu.pdf';}
export function assertPdfReady(story:Story){if('generated' in story&&story.generated&&!story.sourceText?.trim())throw Error('Prepare the saved English source before exporting this story.');if(!story.pages.length||story.pages.some(page=>!page.image))throw Error('Complete every image before exporting a PDF.');}
export function wrapPdfText(text:string,width:number,measure:(text:string)=>number):string[]{
 const lines:string[]=[];
 for(const paragraph of text.replace(/\r\n?/g,'\n').split('\n')){
  let line='';
  for(const token of paragraph.match(/\S+\s*|\s+/g)||[]){
   if(line&&measure(line+token.trimEnd())>width){lines.push(line.trimEnd());line='';}
   if(measure(token.trimEnd())<=width){line+=token;continue;}
   for(const char of Array.from(token)){if(line&&measure(line+char)>width){lines.push(line.trimEnd());line='';}line+=char;}
  }
  lines.push(line.trimEnd());
 }
 return lines;
}
export async function createStoryPdf(story:Story,onProgress:(text:string)=>void=()=>{},runtime:ExportRuntime=browserExportRuntime()){
 assertPdfReady(story);
 const {PDFDocument}=await import('pdf-lib');
 await runtime.ready();
 const pdf=await PDFDocument.create();pdf.setTitle(story.title);pdf.setAuthor(story.publication?.author||'Uncredited');pdf.setSubject(themeLabel(story.theme));pdf.setCreator('Shiqu Story Reader');
 const canvas=runtime.canvas();canvas.width=W;canvas.height=H;
 const context=canvas.getContext('2d');if(!context)throw Error('PDF export is not supported by this browser. Try another browser.');
 const ctx:CanvasRenderingContext2D=context;
 const font=(size:number,family=serif)=>{ctx.font=`${size}px ${family}`;ctx.textBaseline='top';};
 const lines=(text:string,width=W-2*M)=>wrapPdfText(text,width,value=>ctx.measureText(value).width);
 async function addCanvas(){
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('PDF rendering failed. Retry.')),'image/jpeg',.93));
  const image=await pdf.embedJpg(await blob.arrayBuffer());pdf.addPage([360,540]).drawImage(image,{x:0,y:0,width:360,height:540});
 }
 try{
  const imageSizes=await readComicImageSizes(story.pages,runtime),comicPages=layoutComicPages(story.pages,{imageSizes});
  for(const page of comicPages){
   onProgress(`Preparing comic page ${page.index+1} / ${comicPages.length}`);
   await paintComicPage(ctx,story.pages,page,runtime);
   font(20,sans);ctx.fillStyle='#263a2e';lines(story.title,W-2*M-120).forEach((line,index)=>ctx.fillText(line,M,20+index*23));
   ctx.textAlign='right';ctx.fillText(`${page.index+1} / ${comicPages.length}`,W-M,30);ctx.textAlign='left';
   font(18,sans);ctx.fillText(publicationCredit(story),M,H-30,W-2*M);
   await addCanvas();
  }
  onProgress('Preparing the ending and source notes');
  let y=0,appendix=0;
  function paper(){ctx.fillStyle='#f7f6ef';ctx.fillRect(0,0,W,H);font(22,sans);ctx.fillStyle='#7b8b74';ctx.fillText('Shiqu / After the story',M,50);ctx.textAlign='right';ctx.fillText(String(comicPages.length+1+appendix++).padStart(2,'0'),W-M,50);ctx.textAlign='left';y=140;}
  paper();
  async function block(label:string,text:string,size=30){
   if(!text.trim())return;
   if(y>H-230){await addCanvas();paper();}
   font(22,sans);ctx.fillStyle='#8c7957';ctx.fillText(label,M,y);y+=46;
   font(size);const content=lines(text);
   for(const line of content){if(y>H-110){await addCanvas();paper();font(size);}ctx.fillStyle='#2a493b';ctx.fillText(line,M,y);y+=size*1.75;}
   y+=40;
  }
  await block('A final thought',story.reflection,40);
  await block('Source reference',storySourceReference(story));
  await block('About this adaptation',story.adaptationNote);
  await block('Credits and reuse',publicationText(story),25);
  if(story.sourceUrl)await block('Source URL',story.sourceUrl,23);
  await addCanvas();onProgress('Saving PDF');
  return await pdf.save();
 }finally{canvas.width=0;canvas.height=0;}
}
export async function downloadStoryPdf(story:Story,onProgress:(text:string)=>void){
 const bytes=await createStoryPdf(story,onProgress);
 const blob=new Blob([bytes as BlobPart],{type:'application/pdf'}),url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=pdfFilename(story.title);(document.querySelector('dialog[open]')||document.body).appendChild(link);link.click();link.remove();
 return {url,filename:link.download};
}
