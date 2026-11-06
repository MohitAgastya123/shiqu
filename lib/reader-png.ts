// English product text and generation contracts; canonical source evidence remains unchanged.
// Export the same automatic comic sheets as the reader and PDF, in a complete overview image.
import {themeLabel} from './reader-language.ts';
import type {Story} from './content';
import {browserExportRuntime,type ExportRuntime} from './story-export-runtime.ts';
import type {GeneratedStory} from './reader-model';
import {readerBooks} from './reader-books.ts';
import {pdfFilename,wrapPdfText} from './reader-pdf.ts';
import {publicationCredit} from './story-publication.ts';
import {layoutComicPages,paintComicPage,readComicImageSizes,comicPageWidth,comicPageHeight} from './comic-page-layout.ts';
import type {ComicLayoutOptions} from './comic-page-layout.ts';

const M=36,GAP=24;
const family='"Noto Serif SC", "Songti SC", "STSong", "SimSun", serif';
export function pngFilename(title:string){return pdfFilename(title).replace(/\.pdf$/,'-overview.png');}
export function assertPngReady(story:Story){if('generated' in story&&story.generated&&!story.sourceText?.trim())throw Error('Prepare the saved English source before exporting this story.');
 if(!story.pages.length||story.pages.some(page=>!page.image))throw Error('Complete every image before exporting an overview PNG.');
}
export function layoutStoryPng(story:Story,measure:(text:string,size:number)=>number,options:ComicLayoutOptions={}){
 assertPngReady(story);
 const pages=layoutComicPages(story.pages,options),columns=pages.length>1?2:1,width=2*M+columns*comicPageWidth+(columns-1)*GAP;
 const wrap=(text:string,size:number,limit:number)=>wrapPdfText(text,limit,value=>measure(value,size));
 const title=wrap(`${story.title} · ${pages.length} comic ${pages.length===1?'page':'pages'}`,52,width-2*M);
 const generated='generated'in story&&story.generated===true?story as GeneratedStory:null;
 const book=readerBooks.find(book=>book.id===story.bookId)?.title||'Custom story';
 const subtitle=wrap([book,generated?.artStyleLabel,themeLabel(story.theme)].filter(Boolean).join(' · '),26,width-2*M),subtitleY=M+title.length*70+12;
 const firstY=subtitleY+subtitle.length*40+30;
 const cells=pages.map((page,index)=>({index,x:M+(index%columns)*(comicPageWidth+GAP),y:firstY+Math.floor(index/columns)*(comicPageHeight+GAP),page}));
 const footerY=firstY+Math.ceil(pages.length/columns)*(comicPageHeight+GAP),reflection=wrap(story.reflection?`A final thought: ${story.reflection}`:'The story ends here; the afterthought is yours.',36,width-2*M),credit=wrap(publicationCredit(story),22,width-2*M);
 const height=footerY+32+reflection.length*56+30+credit.length*32+24;
 if(width>32767||height>32767||width*height>64000000)throw Error('This comic overview is too large for a PNG canvas. Export the complete story as PDF instead.');
 return {width,height,columns,pages,title,subtitle,subtitleY,cells,footerY,reflection,credit};
}
export async function createStoryPng(story:Story,onProgress:(text:string)=>void=()=>{},runtime:ExportRuntime=browserExportRuntime()){
 assertPngReady(story);await runtime.ready();
 const canvas=runtime.canvas(),context=canvas.getContext('2d');if(!context)throw Error('PNG export is not supported by this browser. Try another browser.');
 const ctx:CanvasRenderingContext2D=context;
 const font=(size:number)=>{ctx.font=`${size}px ${family}`;ctx.textBaseline='top';};
 const imageSizes=await readComicImageSizes(story.pages,runtime),layout=layoutStoryPng(story,(text,size)=>{font(size);return ctx.measureText(text).width;},{imageSizes});canvas.width=layout.width;canvas.height=layout.height;
 try{
  ctx.fillStyle='#f6f2e8';ctx.fillRect(0,0,canvas.width,canvas.height);
  function text(lines:string[],x:number,y:number,size:number,lineHeight:number,color:string){font(size);ctx.fillStyle=color;lines.forEach((line,i)=>ctx.fillText(line,x,y+i*lineHeight));}
  text(layout.title,M,M,52,70,'#263a2e');text(layout.subtitle,M,layout.subtitleY,26,40,'#6b7465');
  for(const cell of layout.cells){onProgress(`Preparing comic page ${cell.index+1} / ${layout.pages.length}`);ctx.save();try{ctx.translate(cell.x,cell.y);await paintComicPage(ctx,story.pages,cell.page,runtime);}finally{ctx.restore();}}
  text(layout.reflection,M,layout.footerY+32,36,56,'#263a2e');text(layout.credit,M,layout.height-24-layout.credit.length*32,22,32,'#6b7465');
  onProgress('Saving comic overview PNG');return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('PNG rendering failed. Retry.')),'image/png'));
 }finally{canvas.width=0;canvas.height=0;}
}

export async function downloadStoryPng(story:Story,onProgress:(text:string)=>void){
 const blob=await createStoryPng(story,onProgress),url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=pngFilename(story.title);(document.querySelector('dialog[open]')||document.body).appendChild(link);link.click();link.remove();
 return {url,filename:link.download};
}
