// English product text and generation contracts; canonical source evidence remains unchanged.
// Export saved stories; balloon pages preserve full artwork and keep narration outside its bounds.
import {themeLabel} from './reader-language.ts';
import type {Story} from './content';
import {browserExportRuntime,type ExportRuntime} from './story-export-runtime.ts';
import {publicationCredit,publicationText} from './story-publication.ts';
import {paintComicBubbles} from './comic-bubble-layout.ts';

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
  for(let i=0;i<story.pages.length;i++){
   onProgress(`Preparing frame ${i+1} / ${story.pages.length}`);
   const scene=story.pages[i],blob=await runtime.read(scene.image,i);
   if(scene.bubbles?.length){
    ctx.clearRect(0,0,W,H);ctx.fillStyle='#f7f6ef';ctx.fillRect(0,0,W,H);
    font(28);const narration=scene.caption.trim()?lines(scene.caption):[],artTop=120,artHeight=H-artTop-120-narration.length*40;
    if(artHeight<120)throw Error(`Frame ${i+1} has too much narration to export with its balloons.`);
    await runtime.image(blob,image=>{
     const scale=Math.min((W-2*M)/image.width,artHeight/image.height),width=image.width*scale,height=image.height*scale,x=(W-width)/2,y=artTop+(artHeight-height)/2;
     ctx.drawImage(image.value,x,y,width,height);
     if(scene.bubbleRendering!=='embedded'){ctx.save();try{ctx.translate(x,y);paintComicBubbles(ctx,scene.bubbles,width,height);}finally{ctx.restore();}}
    });
    font(27,sans);ctx.fillStyle='#2a493b';lines(story.title,W-2*M-120).forEach((line,j)=>ctx.fillText(line,M,45+j*36));
    ctx.textAlign='right';ctx.fillText(`${String(i+1).padStart(2,'0')} / ${story.pages.length}`,W-M,45);ctx.textAlign='left';
    font(28);narration.forEach((line,j)=>ctx.fillText(line,M,artTop+artHeight+20+j*40));
    font(21,sans);ctx.fillStyle='#65745d';ctx.fillText(publicationCredit(story),M,H-65,W-2*M);
    await addCanvas();continue;
   }
   await runtime.image(blob,image=>{
    const scale=Math.max(W/image.width,H/image.height),width=image.width*scale,height=image.height*scale;
    ctx.clearRect(0,0,W,H);ctx.drawImage(image.value,(W-width)/2,(H-height)/2,width,height);
   });
   const top=ctx.createLinearGradient(0,0,0,260);top.addColorStop(0,'rgba(14,34,25,.72)');top.addColorStop(1,'rgba(14,34,25,0)');ctx.fillStyle=top;ctx.fillRect(0,0,W,260);
   font(27,sans);ctx.fillStyle='#f1efdf';lines(story.title,W-2*M-120).forEach((line,j)=>ctx.fillText(line,M,55+j*39));
   ctx.textAlign='right';ctx.fillText(`${String(i+1).padStart(2,'0')} / ${story.pages.length}`,W-M,55);ctx.textAlign='left';
   font(32);const caption=lines(scene.caption),captionTop=H-140-caption.length*47;
   const shade=ctx.createLinearGradient(0,Math.max(300,captionTop-200),0,H);shade.addColorStop(0,'rgba(14,34,25,0)');shade.addColorStop(.5,'rgba(14,34,25,.8)');shade.addColorStop(1,'rgba(14,34,25,.96)');ctx.fillStyle=shade;ctx.fillRect(0,Math.max(300,captionTop-200),W,H);
   ctx.fillStyle='#fff9e9';caption.forEach((line,j)=>ctx.fillText(line,M,captionTop+j*47));
   font(21,sans);ctx.fillStyle='#c7d1bc';ctx.fillText(publicationCredit(story),M,H-65,W-2*M);
   await addCanvas();
  }
  onProgress('Preparing the ending and source notes');
  let y=0,appendix=0;
  function paper(){ctx.fillStyle='#f7f6ef';ctx.fillRect(0,0,W,H);font(22,sans);ctx.fillStyle='#7b8b74';ctx.fillText('Shiqu / After the story',M,50);ctx.textAlign='right';ctx.fillText(String(story.pages.length+1+appendix++).padStart(2,'0'),W-M,50);ctx.textAlign='left';y=140;}
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
  await block('About this adaptation',story.adaptationNote.replace('','。'));
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
