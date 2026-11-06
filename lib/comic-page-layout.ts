// Compose ordered source frames into readable comic sheets without cropping or changing saved artwork.
// One presentation supplies the reader, canvas exports and offline pages; dense panels promote finitely.
import type {ComicBubble} from './reader-bubbles.ts';
import {autoPlaceBubbles} from './reader-bubbles.ts';
import {comicTextWidth,paintComicBubbles,comicBubbleFontFamily} from './comic-bubble-layout.ts';
import {defaultComicBubblePalette,sampleComicBubblePalette} from './comic-bubble-palette.ts';
import type {ExportRuntime} from './story-export-runtime.ts';

export const comicPageWidth=900,comicPageHeight=1350,comicMinimumFontSize=24,comicSignatureSafeHeight=88;
export type ComicPanelSpan='normal'|'wide'|'large'|'splash';
export type ComicRect={x:number;y:number;width:number;height:number};
export type ComicImageSize={width:number;height:number};
export type ComicFrame={caption:string;prompt?:string;image?:string;bubbles?:ComicBubble[];bubbleRendering?:'embedded';panel?:ComicPanelSpan;comicRendering?:{width:number;height:number;minFontSize:number|null}};
export type ComicPanel=ComicRect&{frameIndex:number;span:ComicPanelSpan};
export type ComicPage={index:number;panels:ComicPanel[]};
export type ComicPanelPresentation={rect:ComicRect;art:ComicRect;narration:ComicRect;captionLines:{text:string;x:number;y:number;width:number}[];captionFontSize:number;captionLineHeight:number;bubbles:ComicBubble[];bubbleReference:ComicImageSize};
export type ComicLayoutOptions={imageSizes?:Readonly<Record<number,ComicImageSize|undefined>>};
export class ComicPanelDensityError extends Error{constructor(frameIndex:number){super(`Panel ${frameIndex+1} cannot fit its complete narration and dialogue at a readable size, even on a full comic page. Shorten the text or revise its saved balloons.`);this.name='ComicPanelDensityError';}}
const defaultImageSize={width:900,height:1350};
const pixels=(rect:ComicRect):ComicRect=>({x:rect.x*comicPageWidth,y:rect.y*comicPageHeight,width:rect.width*comicPageWidth,height:rect.height*comicPageHeight});
export function comicCaptionLines(text:string,width:number,size=comicMinimumFontSize){
 const lines:string[]=[];
 for(const paragraph of text.replace(/\r\n?/g,'\n').split('\n')){
  let line='';
  for(const word of paragraph.trim().split(/\s+/u).filter(Boolean)){
   if(comicTextWidth(line?line+' '+word:word,size)<=width){line=line?line+' '+word:word;continue;}
   if(line){lines.push(line);line='';}
   for(const character of Array.from(word)){if(comicTextWidth(character,size)>width)throw Error('A narration character exceeds the panel width.');if(line&&comicTextWidth(line+character,size)>width){lines.push(line);line='';}line+=character;}
  }
  if(line||paragraph.trim())lines.push(line);
 }
 return lines;
}
function computeComicPanel(frame:ComicFrame,panel:ComicPanel,imageSize?:ComicImageSize):ComicPanelPresentation{
 const rect=pixels(panel);imageSize=imageSize||frame.comicRendering||defaultImageSize;
 if(![imageSize.width,imageSize.height].every(value=>Number.isFinite(value)&&value>0))throw new ComicPanelDensityError(panel.frameIndex);
 if(frame.comicRendering){
  const recorded=frame.comicRendering;
  if(imageSize.width!==recorded.width||imageSize.height!==recorded.height)throw new ComicPanelDensityError(panel.frameIndex);
  if(![recorded.width,recorded.height].every(value=>Number.isFinite(value)&&value>0)||recorded.width>900||recorded.height>1350||recorded.minFontSize===null&&panel.span!=='splash'||recorded.minFontSize!==null&&(!Number.isFinite(recorded.minFontSize)||recorded.minFontSize*Math.min(rect.width/recorded.width,rect.height/recorded.height)<comicMinimumFontSize-1e-6))throw new ComicPanelDensityError(panel.frameIndex);
  const scale=Math.min(rect.width/imageSize.width,rect.height/imageSize.height),width=imageSize.width*scale,height=imageSize.height*scale;
  return {rect,art:{x:rect.x+(rect.width-width)/2,y:rect.y+(rect.height-height)/2,width,height},narration:{x:rect.x,y:rect.y,width:0,height:0},captionLines:[],captionFontSize:comicMinimumFontSize,captionLineHeight:31,bubbles:[],bubbleReference:{width:rect.width,height:rect.height}};
 }
 const padding=12,fontSize=comicMinimumFontSize,lineHeight=31,caption=frame.caption.trim()?comicCaptionLines(frame.caption,rect.width-padding*2,fontSize):[];
 const narrationHeight=caption.length?caption.length*lineHeight+padding*2:0;
 if(!Number.isFinite(imageSize.width)||!Number.isFinite(imageSize.height)||imageSize.width<=0||imageSize.height<=0||narrationHeight>rect.height*.45)throw new ComicPanelDensityError(panel.frameIndex);
 const artwork={x:rect.x+padding,y:rect.y+padding,width:rect.width-padding*2,height:rect.height-narrationHeight-comicSignatureSafeHeight-padding*2};
 if(artwork.height<160)throw new ComicPanelDensityError(panel.frameIndex);
 const scale=Math.min(artwork.width/imageSize.width,artwork.height/imageSize.height),width=imageSize.width*scale,height=imageSize.height*scale;
 const art={x:artwork.x+(artwork.width-width)/2,y:artwork.y+(artwork.height-height)/2,width,height};
 const narration={x:rect.x+padding,y:rect.y+rect.height-comicSignatureSafeHeight-narrationHeight+padding,width:rect.width-padding*2,height:Math.max(0,narrationHeight-padding*2)};
 let bubbles:ComicBubble[]=[];
 if(frame.bubbleRendering==='embedded'){
  // Historical embedded balloons do not identify their font or padding; never estimate their baked glyph size.
  if(panel.span!=='splash')throw new ComicPanelDensityError(panel.frameIndex);
 }else if(frame.bubbles?.length){
  const mapped=frame.bubbles.map(bubble=>({...bubble,tailX:(art.x-rect.x+bubble.tailX*art.width)/rect.width,tailY:(art.y-rect.y+bubble.tailY*art.height)/rect.height}));
  try{bubbles=autoPlaceBubbles(mapped,{referenceWidth:rect.width,referenceHeight:rect.height});}
  catch{throw new ComicPanelDensityError(panel.frameIndex);}
  if(bubbles.some(bubble=>bubble.y*rect.height+bubble.height*rect.height>rect.height-comicSignatureSafeHeight-narrationHeight-padding))throw new ComicPanelDensityError(panel.frameIndex);
 }
 return {rect,art,narration,captionLines:caption.map((text,index)=>({text,x:narration.x,y:narration.y+index*lineHeight,width:comicTextWidth(text,fontSize)})),captionFontSize:fontSize,captionLineHeight:lineHeight,bubbles,bubbleReference:{width:rect.width,height:rect.height}};
}
type CachedPanel={value:ComicPanelPresentation}|{failed:true};
const panelPresentations=new WeakMap<ComicFrame,Map<string,CachedPanel>>();
const panelCacheLimit=16;
function copyPresentation(value:ComicPanelPresentation):ComicPanelPresentation{
 return {...value,rect:{...value.rect},art:{...value.art},narration:{...value.narration},captionLines:value.captionLines.map(line=>({...line})),bubbles:value.bubbles.map(bubble=>({...bubble})),bubbleReference:{...value.bubbleReference}};
}
export function layoutComicPanel(frame:ComicFrame,panel:ComicPanel,imageSize?:ComicImageSize):ComicPanelPresentation{
 const size=imageSize||frame.comicRendering||defaultImageSize;
 // Content fingerprints catch in-place edits; frame identity keeps unrelated stories out of the same cache.
 const key=JSON.stringify([panel.frameIndex,panel.span,panel.x,panel.y,panel.width,panel.height,size.width,size.height,frame.caption,frame.bubbles,frame.bubbleRendering,frame.comicRendering]);
 let cache=panelPresentations.get(frame);if(!cache){cache=new Map();panelPresentations.set(frame,cache);}
 const cached=cache.get(key);
 if(cached){cache.delete(key);cache.set(key,cached);if('value'in cached)return copyPresentation(cached.value);throw new ComicPanelDensityError(panel.frameIndex);}
 function save(value:CachedPanel){cache!.set(key,value);while(cache!.size>panelCacheLimit)cache!.delete(cache!.keys().next().value!);}
 try{const value=computeComicPanel(frame,panel,size);save({value});return copyPresentation(value);}
 catch(error){if(error instanceof ComicPanelDensityError)save({failed:true});throw error;}
}
const margin=32,top=90,gutter=18,contentWidth=comicPageWidth-margin*2,contentHeight=1200,cellWidth=(contentWidth-gutter)/2,cellHeight=(contentHeight-gutter)/2;
const cell=(column:number,row:number,columns=1,rows=1):ComicRect=>({x:(margin+column*(cellWidth+gutter))/comicPageWidth,y:(top+row*(cellHeight+gutter))/comicPageHeight,width:(columns*cellWidth+(columns-1)*gutter)/comicPageWidth,height:(rows*cellHeight+(rows-1)*gutter)/comicPageHeight});
const templates:{span:ComicPanelSpan;rect:ComicRect}[][]=[
 [{span:'normal',rect:cell(0,0)},{span:'normal',rect:cell(1,0)},{span:'normal',rect:cell(0,1)},{span:'normal',rect:cell(1,1)}],
 [{span:'wide',rect:cell(0,0,2)},{span:'normal',rect:cell(0,1)},{span:'normal',rect:cell(1,1)}],
 [{span:'normal',rect:cell(0,0)},{span:'normal',rect:cell(1,0)},{span:'wide',rect:cell(0,1,2)}],
 [{span:'large',rect:cell(0,0,1,2)},{span:'normal',rect:cell(1,0)},{span:'normal',rect:cell(1,1)}],
 [{span:'normal',rect:cell(0,0)},{span:'large',rect:cell(1,0,1,2)},{span:'normal',rect:cell(0,1)}],
 [{span:'wide',rect:cell(0,0,2)},{span:'wide',rect:cell(0,1,2)}],
 [{span:'large',rect:cell(0,0,1,2)},{span:'large',rect:cell(1,0,1,2)}],
 [{span:'splash',rect:cell(0,0,2,2)}],
];
function preferredSpan(frame:ComicFrame):ComicPanelSpan{
 if(frame.panel){if(!['normal','wide','large','splash'].includes(frame.panel))throw Error('Invalid comic panel emphasis.');return frame.panel;}
 const text=(frame.caption+' '+(frame.prompt||'')).toLowerCase();
 if(/\b(panoram(?:a|ic)|wide landscape|sweeping view|vast army)\b/u.test(text))return 'wide';
 if(/\b(decisive moment|turning point|sudden revelation|climax)\b/u.test(text))return 'large';
 return 'normal';
}
const allowed:Record<ComicPanelSpan,ComicPanelSpan[]>={normal:['normal','wide','large','splash'],wide:['wide','splash'],large:['large','splash'],splash:['splash']};
export function layoutComicPages(frames:readonly ComicFrame[],{imageSizes={}}:ComicLayoutOptions={}):ComicPage[]{
 const pages:ComicPage[]=[];let first=0;
 while(first<frames.length){
  let selected:ComicPanel[]|undefined;
  for(const template of templates){
   if(first+template.length>frames.length)continue;
   const candidate=template.map(({span,rect},offset)=>({frameIndex:first+offset,span,...rect}));
   if(candidate.some(panel=>!allowed[preferredSpan(frames[panel.frameIndex])].includes(panel.span)))continue;
   try{for(const panel of candidate)layoutComicPanel(frames[panel.frameIndex],panel,imageSizes[panel.frameIndex]);selected=candidate;break;}catch(error){if(!(error instanceof ComicPanelDensityError))throw error;}
  }
  if(!selected)throw new ComicPanelDensityError(first);
  pages.push({index:pages.length,panels:selected});first+=selected.length;
 }
 return pages;
}
export function comicPageForFrame(pages:readonly ComicPage[],frameIndex:number){return pages.findIndex(page=>page.panels.some(panel=>panel.frameIndex===frameIndex));}
export async function readComicImageSizes(frames:readonly ComicFrame[],runtime:ExportRuntime){
 const sizes:Record<number,ComicImageSize>={};
 for(const [index,frame]of frames.entries()){if(!frame.image)throw Error(`Panel ${index+1} has no saved image.`);const blob=await runtime.read(frame.image,index);try{sizes[index]=await runtime.image(blob,image=>({width:image.width,height:image.height}));}catch{throw Error(`Panel ${index+1} has unreadable artwork.`);}}
 return sizes;
}
export async function paintComicPanel(ctx:CanvasRenderingContext2D,frame:ComicFrame,panel:ComicPanel,runtime:ExportRuntime,savedBlob?:Blob){
 if(!frame.image)throw Error(`Panel ${panel.frameIndex+1} has no saved image.`);
 const blob=savedBlob||await runtime.read(frame.image,panel.frameIndex);
 await runtime.image(blob,image=>{
  const presentation=layoutComicPanel(frame,panel,image),palette=sampleComicBubblePalette(image.value,runtime.canvas()),{rect,art}=presentation;
  ctx.fillStyle=palette.paper;ctx.fillRect(rect.x,rect.y,rect.width,rect.height);ctx.drawImage(image.value,art.x,art.y,art.width,art.height);
  ctx.save();try{ctx.translate(rect.x,rect.y);paintComicBubbles(ctx,presentation.bubbles,rect.width,rect.height,{referenceWidth:rect.width,referenceHeight:rect.height,palette});}finally{ctx.restore();}
  ctx.font=`700 ${presentation.captionFontSize}px ${comicBubbleFontFamily}`;ctx.fontKerning='none';ctx.textBaseline='top';ctx.fillStyle=palette.ink;
  for(const line of presentation.captionLines)ctx.fillText(line.text,line.x,line.y);
  ctx.strokeStyle=palette.stroke;ctx.lineWidth=2;ctx.strokeRect(rect.x,rect.y,rect.width,rect.height);
 });
}
export async function paintComicPage(ctx:CanvasRenderingContext2D,frames:readonly ComicFrame[],page:ComicPage,runtime:ExportRuntime,onFrame:(frameIndex:number)=>void=()=>{}){
 const first=page.panels[0],firstFrame=first?frames[first.frameIndex]:undefined;
 const firstBlob=firstFrame?.image?await runtime.read(firstFrame.image,first.frameIndex):undefined;
 const palette=firstBlob?await runtime.image(firstBlob,image=>sampleComicBubblePalette(image.value,runtime.canvas())):defaultComicBubblePalette;
 ctx.fillStyle=palette.paper;ctx.fillRect(0,0,comicPageWidth,comicPageHeight);
 for(const panel of page.panels){onFrame(panel.frameIndex);await paintComicPanel(ctx,frames[panel.frameIndex],panel,runtime,panel===first?firstBlob:undefined);}
}
export function validatedComicPages(value:unknown,frameCount:number):ComicPage[]{
 if(!Array.isArray(value)||value.length>80)throw Error('Invalid comic page layout metadata.');
 const frames:number[]=[];
 for(const [index,page]of value.entries()){
  if(!page||page.index!==index||!Array.isArray(page.panels)||!page.panels.length||page.panels.length>4)throw Error('Invalid comic page layout metadata.');
  let previousY=-1;
  for(const panel of page.panels){
   if(!Number.isInteger(panel.frameIndex)||!['normal','wide','large','splash'].includes(panel.span)||![panel.x,panel.y,panel.width,panel.height].every(Number.isFinite)||panel.x<0||panel.y<0||panel.width<=0||panel.height<=0||panel.x+panel.width>1+1e-9||panel.y+panel.height>1+1e-9||panel.y<previousY-1e-9)throw Error('Invalid comic panel rectangle.');
   if(page.panels.some((other:ComicPanel)=>other!==panel&&panel.x<other.x+other.width-1e-9&&panel.x+panel.width>other.x+1e-9&&panel.y<other.y+other.height-1e-9&&panel.y+panel.height>other.y+1e-9))throw Error('Comic panel rectangles overlap.');
   previousY=panel.y;frames.push(panel.frameIndex);
  }
 }
 if(frames.length!==frameCount||frames.some((frame,index)=>frame!==index))throw Error('Comic page layout must preserve every source panel in order.');
 for(const page of value)if(!templates.some(template=>template.length===page.panels.length&&template.every((expected,index)=>{const panel=page.panels[index];return panel.span===expected.span&&(['x','y','width','height'] as const).every(key=>Math.abs(panel[key]-expected.rect[key])<1e-8);})))throw Error('Comic page layout must use complete canonical panel templates.');
 return value.map(page=>({index:page.index,panels:page.panels.map((panel:ComicPanel)=>({frameIndex:panel.frameIndex,span:panel.span,x:panel.x,y:panel.y,width:panel.width,height:panel.height}))}));
}
export function validatedComicRendering(value:unknown){
 const item=value as {width?:unknown;height?:unknown;minFontSize?:unknown}|null;
 if(!item||![item.width,item.height].every(value=>typeof value==='number'&&Number.isFinite(value)&&value>0)||Number(item.width)>900||Number(item.height)>1350||item.minFontSize!==null&&(typeof item.minFontSize!=='number'||!Number.isFinite(item.minFontSize)||item.minFontSize<comicMinimumFontSize||item.minFontSize>256))throw Error('Invalid embedded comic panel rendering metadata.');
 return {width:Number(item.width),height:Number(item.height),minFontSize:item.minFontSize as number|null};
}
