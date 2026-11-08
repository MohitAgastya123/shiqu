// Compose filled comic panels with protected-aware crops, compact lettering and safe legacy text bands.
// One bounded presentation supplies SVG/canvas/export geometry while opaque archived lettering stays intact.
import type {ComicBubble} from './reader-bubbles.ts';
import {autoPlaceBubbles} from './reader-bubbles.ts';
import {comicTextWidth,paintComicBubbles,comicBubbleFontFamily,computeBubbleLayout} from './comic-bubble-layout.ts';
import {defaultComicBubblePalette,sampleComicBubblePalette} from './comic-bubble-palette.ts';
import type {ExportRuntime} from './story-export-runtime.ts';
import {comicCanvasTarget,comicCompositionSchema} from './comic-composition.ts';
import type {ComicComposition,NormalizedRect} from './comic-composition.ts';

export const comicPageWidth=900,comicPageHeight=1350,comicMinimumFontSize=20;
export type ComicPanelSpan='normal'|'wide'|'large'|'splash';
export type ComicRect={x:number;y:number;width:number;height:number};
export type ComicImageSize={width:number;height:number};
export type ComicFrame={caption:string;prompt?:string;image?:string;bubbles?:ComicBubble[];bubbleRendering?:'embedded';panel?:ComicPanelSpan;comicRendering?:{width:number;height:number;minFontSize:number|null};composition?:ComicComposition};
export type ComicPanel=ComicRect&{frameIndex:number;span:ComicPanelSpan};
export type ComicPage={index:number;panels:ComicPanel[]};
export type ComicPanelPresentation={rect:ComicRect;art:ComicRect;artViewport:ComicRect;letteringBand?:ComicRect;signature:ComicRect;protectedAreas:ComicRect[];cropped:boolean;artOccupancy:number;narration:ComicRect;captionLines:{text:string;x:number;y:number;width:number}[];captionFontSize:number;captionLineHeight:number;bubbles:ComicBubble[];bubbleReference:ComicImageSize};
export type ComicPresentationOptions={watermarkFontSize?:number};
export type ComicLayoutOptions=ComicPresentationOptions&{imageSizes?:Readonly<Record<number,ComicImageSize|undefined>>};
export class ComicPanelDensityError extends Error{constructor(frameIndex:number){super(`Panel ${frameIndex+1} cannot fit its complete narration and dialogue at a readable size, even on a full comic page. Shorten the text or revise its saved balloons.`);this.name='ComicPanelDensityError';}}
const defaultImageSize={width:864,height:1536};
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
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const relative=(area:ComicRect,rect:ComicRect):NormalizedRect=>({x:(area.x-rect.x)/rect.width,y:(area.y-rect.y)/rect.height,width:area.width/rect.width,height:area.height/rect.height});
export function comicSignatureHeight(width:number,fontSize=24){
 if(!Number.isFinite(fontSize)||fontSize<12||fontSize>48)throw Error('The publication watermark size is invalid.');
 return Math.ceil(fontSize*1.25+width*.03+4);
}
function protectedSourceAreas(frame:ComicFrame):NormalizedRect[]{
 const areas:NormalizedRect[]=(frame.composition?.protectedAreas||[]).map(area=>({...area}));
 for(const bubble of frame.bubbles||[]){const x=clamp(bubble.tailX-.075,0,.85),y=clamp(bubble.tailY-.12,0,.84);areas.push({x,y,width:.15,height:.16});}
 return areas;
}
function fitArtwork(frame:ComicFrame,size:ComicImageSize,viewport:ComicRect){
 const cover=Math.max(viewport.width/size.width,viewport.height/size.height),width=size.width*cover,height=size.height*cover;
 const focus=frame.composition?.focus||{x:.5,y:.5},areas=protectedSourceAreas(frame);
 let lowX=viewport.x+viewport.width-width,highX=viewport.x,lowY=viewport.y+viewport.height-height,highY=viewport.y;
 for(const area of areas){lowX=Math.max(lowX,viewport.x-area.x*width);highX=Math.min(highX,viewport.x+viewport.width-(area.x+area.width)*width);lowY=Math.max(lowY,viewport.y-area.y*height);highY=Math.min(highY,viewport.y+viewport.height-(area.y+area.height)*height);}
 const retained=viewport.width*viewport.height/(width*height);
 if(frame.composition&&frame.bubbleRendering!=='embedded'&&retained>=.65-1e-9&&lowX<=highX+1e-9&&lowY<=highY+1e-9){
  const art={x:clamp(viewport.x+viewport.width/2-focus.x*width,lowX,highX),y:clamp(viewport.y+viewport.height/2-focus.y*height,lowY,highY),width,height};
  return {art,artViewport:viewport,cropped:retained<1-1e-6,occupancy:1};
 }
 // Unknown historical scenes may contain an important face or object at any edge. Keep all their pixels.
 const scale=Math.min(viewport.width/size.width,viewport.height/size.height),w=size.width*scale,h=size.height*scale,art={x:viewport.x+(viewport.width-w)/2,y:viewport.y+(viewport.height-h)/2,width:w,height:h};
 return {art,artViewport:{...art},cropped:false,occupancy:w*h/(viewport.width*viewport.height)};
}
function computeComicPanel(frame:ComicFrame,panel:ComicPanel,imageSize?:ComicImageSize,options:ComicPresentationOptions={}):ComicPanelPresentation{
 const rect=pixels(panel);imageSize=imageSize||frame.comicRendering||(frame.composition?comicCanvasTarget(frame.composition.canvas):defaultImageSize);
 if(![imageSize.width,imageSize.height].every(value=>Number.isFinite(value)&&value>0)||frame.composition&&!comicCompositionSchema.safeParse(frame.composition).success)throw new ComicPanelDensityError(panel.frameIndex);
 if(frame.comicRendering){
  const recorded=frame.comicRendering;
  if(imageSize.width!==recorded.width||imageSize.height!==recorded.height||![recorded.width,recorded.height].every(value=>Number.isFinite(value)&&value>0)||recorded.width>900||recorded.height>1350||recorded.minFontSize===null&&panel.span!=='splash'||recorded.minFontSize!==null&&(!Number.isFinite(recorded.minFontSize)||recorded.minFontSize<20||Math.min(rect.width/recorded.width,rect.height/recorded.height)<1-1e-6))throw new ComicPanelDensityError(panel.frameIndex);
  const scale=Math.min(rect.width/imageSize.width,rect.height/imageSize.height),width=imageSize.width*scale,height=imageSize.height*scale,art={x:rect.x+(rect.width-width)/2,y:rect.y+(rect.height-height)/2,width,height};
  return {rect,art,artViewport:{...art},narration:{x:rect.x,y:rect.y,width:0,height:0},signature:{x:rect.x,y:rect.y,width:0,height:0},captionLines:[],captionFontSize:comicMinimumFontSize,captionLineHeight:25,bubbles:[],bubbleReference:{width:rect.width,height:rect.height},protectedAreas:[],cropped:false,artOccupancy:1};
 }
 if(frame.bubbleRendering==='embedded'&&panel.span!=='splash')throw new ComicPanelDensityError(panel.frameIndex);
 const padding=7,fontSize=comicMinimumFontSize,lineHeight=25,caption=frame.caption.trim()?comicCaptionLines(frame.caption,rect.width-padding*2,fontSize):[],narrationHeight=caption.length?caption.length*lineHeight+padding*2:0,signatureHeight=comicSignatureHeight(rect.width,options.watermarkFontSize);
 if(narrationHeight>rect.height*.48)throw new ComicPanelDensityError(panel.frameIndex);
 const signature={x:rect.x,y:rect.y+rect.height-signatureHeight,width:rect.width,height:signatureHeight};
 const narration={x:rect.x+padding,y:signature.y-narrationHeight+padding,width:rect.width-padding*2,height:Math.max(0,narrationHeight-padding*2)};
 const baseViewport={x:rect.x+1,y:rect.y+1,width:rect.width-2,height:rect.height-narrationHeight-signatureHeight-2};
 if(baseViewport.height<130)throw new ComicPanelDensityError(panel.frameIndex);
 let fitted=fitArtwork(frame,imageSize,baseViewport),bubbles:ComicBubble[]=[],letteringBand:ComicRect|undefined,protectedAreas:ComicRect[]=[];
 const sourceAreas=protectedSourceAreas(frame),mapAreas=(art:ComicRect)=>sourceAreas.map(area=>({x:art.x+area.x*art.width,y:art.y+area.y*art.height,width:area.width*art.width,height:area.height*art.height}));
 const mapped=(art:ComicRect)=>(frame.bubbles||[]).map(bubble=>({...bubble,tailX:(art.x-rect.x+bubble.tailX*art.width)/rect.width,tailY:(art.y-rect.y+bubble.tailY*art.height)/rect.height}));
 const place=(fit:typeof fitted,bounds:ComicRect,band:boolean)=>{
  const areas=band?[fit.artViewport]:mapAreas(fit.art);
  const result=autoPlaceBubbles(mapped(fit.art),{referenceWidth:rect.width,referenceHeight:rect.height,protectedAreas:areas.map(area=>relative(area,rect)),bodyBounds:relative(bounds,rect),allowDistantTails:band,maxFontSize:band?20:22});
  for(const bubble of result)computeBubbleLayout(bubble,rect.width,rect.height,{referenceWidth:rect.width,referenceHeight:rect.height});
  protectedAreas=areas;return result;
 };
 if(frame.bubbleRendering!=='embedded'&&frame.bubbles?.length){
  let overlay=false;
  if(frame.composition)try{bubbles=place(fitted,fitted.artViewport,false);overlay=true;}catch{/* Try a scene-independent lettering band before promoting the panel. */}
  if(!overlay){
   let found=false;
   for(const height of [64,80,100,124,152,184,220,264,320,384,460]){
    const available={...baseViewport,y:baseViewport.y+height,height:baseViewport.height-height};if(available.height<130)break;
    const band={x:baseViewport.x+6,y:baseViewport.y+4,width:baseViewport.width-12,height:height-8},fit=fitArtwork(frame,imageSize,available);
    try{bubbles=place(fit,band,true);fitted=fit;letteringBand={x:baseViewport.x,y:baseViewport.y,width:baseViewport.width,height};found=true;break;}catch{/* Finite larger bands preserve every word without covering scene content. */}
   }
   if(!found)throw new ComicPanelDensityError(panel.frameIndex);
  }
 }
 return {rect,...fitted,narration,signature,letteringBand,captionLines:caption.map((text,index)=>({text,x:narration.x,y:narration.y+index*lineHeight,width:comicTextWidth(text,fontSize)})),captionFontSize:fontSize,captionLineHeight:lineHeight,bubbles,bubbleReference:{width:rect.width,height:rect.height},protectedAreas,artOccupancy:fitted.occupancy};
}
type CachedPanel={value:ComicPanelPresentation}|{failed:true};
const panelPresentations=new WeakMap<ComicFrame,Map<string,CachedPanel>>();
const panelCacheLimit=16;
function copyPresentation(value:ComicPanelPresentation):ComicPanelPresentation{
 return {...value,rect:{...value.rect},art:{...value.art},artViewport:{...value.artViewport},signature:{...value.signature},protectedAreas:value.protectedAreas.map(area=>({...area})),...(value.letteringBand?{letteringBand:{...value.letteringBand}}:{}),narration:{...value.narration},captionLines:value.captionLines.map(line=>({...line})),bubbles:value.bubbles.map(bubble=>({...bubble})),bubbleReference:{...value.bubbleReference}};
}
export function layoutComicPanel(frame:ComicFrame,panel:ComicPanel,imageSize?:ComicImageSize,options:ComicPresentationOptions={}):ComicPanelPresentation{
 const size=imageSize||frame.comicRendering||(frame.composition?comicCanvasTarget(frame.composition.canvas):defaultImageSize);
 // Content fingerprints catch in-place edits; frame identity keeps unrelated stories out of the same cache.
 const key=JSON.stringify([panel.frameIndex,panel.span,panel.x,panel.y,panel.width,panel.height,size.width,size.height,frame.caption,frame.bubbles,frame.bubbleRendering,frame.comicRendering,frame.composition,options.watermarkFontSize??24]);
 let cache=panelPresentations.get(frame);if(!cache){cache=new Map();panelPresentations.set(frame,cache);}
 const cached=cache.get(key);
 if(cached){cache.delete(key);cache.set(key,cached);if('value'in cached)return copyPresentation(cached.value);throw new ComicPanelDensityError(panel.frameIndex);}
 function save(value:CachedPanel){cache!.set(key,value);while(cache!.size>panelCacheLimit)cache!.delete(cache!.keys().next().value!);}
 try{const value=computeComicPanel(frame,panel,size,options);save({value});return copyPresentation(value);}
 catch(error){if(error instanceof ComicPanelDensityError)save({failed:true});throw error;}
}
const margin=32,top=90,gutter=18,contentWidth=comicPageWidth-margin*2,contentHeight=1200,cellWidth=(contentWidth-gutter)/2,cellHeight=(contentHeight-gutter)/2;
const cell=(column:number,row:number,columns=1,rows=1):ComicRect=>({x:(margin+column*(cellWidth+gutter))/comicPageWidth,y:(top+row*(cellHeight+gutter))/comicPageHeight,width:(columns*cellWidth+(columns-1)*gutter)/comicPageWidth,height:(rows*cellHeight+(rows-1)*gutter)/comicPageHeight});
const legacyTemplates:{span:ComicPanelSpan;rect:ComicRect}[][]=[
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
const newMargin=14,newTop=54,newGutter=10,newHeight=1244;
function newCell(column:number,row:number,columns=1,rows=1,totalColumns=2,totalRows=2):ComicRect{
 const width=(comicPageWidth-newMargin*2-(totalColumns-1)*newGutter)/totalColumns,height=(newHeight-(totalRows-1)*newGutter)/totalRows;
 return {x:(newMargin+column*(width+newGutter))/comicPageWidth,y:(newTop+row*(height+newGutter))/comicPageHeight,width:(width*columns+(columns-1)*newGutter)/comicPageWidth,height:(height*rows+(rows-1)*newGutter)/comicPageHeight};
}
const slot=(span:ComicPanelSpan,column:number,row:number,columns=1,rows=1,totalColumns=2,totalRows=2)=>({span,rect:newCell(column,row,columns,rows,totalColumns,totalRows)});
const terminalTemplates:{span:ComicPanelSpan;rect:ComicRect}[][]=[
 [slot('normal',0,0),slot('normal',1,0)],
 [slot('normal',0,0)],
];
const templates:{span:ComicPanelSpan;rect:ComicRect}[][]=[
 [slot('normal',0,0),slot('normal',1,0),slot('normal',0,1),slot('normal',1,1)],
 [slot('wide',0,0,2),slot('normal',0,1),slot('normal',1,1)],
 [slot('normal',0,0),slot('normal',1,0),slot('wide',0,1,2)],
 [slot('normal',0,0,1,1,3,2),slot('normal',1,0,1,1,3,2),slot('normal',2,0,1,1,3,2),slot('wide',0,1,3,1,3,2)],
 [slot('wide',0,0,3,1,3,2),slot('normal',0,1,1,1,3,2),slot('normal',1,1,1,1,3,2),slot('normal',2,1,1,1,3,2)],
 [slot('large',0,0,1,2),slot('normal',1,0),slot('normal',1,1)],
 [slot('normal',0,0),slot('large',1,0,1,2),slot('normal',0,1)],
 [slot('wide',0,0,2),slot('wide',0,1,2)],
 [slot('large',0,0,1,2),slot('large',1,0,1,2)],
 [slot('splash',0,0,2,2)],
 Array.from({length:6},(_,index)=>slot('normal',index%3,Math.floor(index/3),1,1,3,2)),
 [slot('large',0,0,1,2,2,3),slot('normal',1,0,1,1,2,3),slot('normal',1,1,1,1,2,3),slot('normal',0,2,1,1,2,3),slot('normal',1,2,1,1,2,3)],
 [slot('normal',0,0,1,1,2,3),slot('large',1,0,1,2,2,3),slot('normal',0,1,1,1,2,3),slot('normal',0,2,1,1,2,3),slot('normal',1,2,1,1,2,3)],
 ...terminalTemplates,
];
export function layoutComicPages(frames:readonly ComicFrame[],{imageSizes={},...options}:ComicLayoutOptions={}):ComicPage[]{
 const pages:ComicPage[]=[];let first=0;
 while(first<frames.length){
  let selected:ComicPanel[]|undefined,best=Infinity;
  // Opaque exported panels may only upscale; their historical template remains an admissible option.
  const catalog=frames.slice(first,first+6).some(frame=>frame.comicRendering)?[...templates,...legacyTemplates]:templates;
  for(const template of catalog){
   if(first+template.length>frames.length)continue;
   // A spare final row may finish a story; continuing pages must use the whole canvas.
   if(first+template.length<frames.length&&terminalTemplates.includes(template))continue;
   const candidate=template.map(({span,rect},offset)=>({frameIndex:first+offset,span,...rect}));
   if(candidate.some(panel=>preferredSpan(frames[panel.frameIndex])==='splash'&&panel.span!=='splash'))continue;
   try{
    const presentations=candidate.map(panel=>layoutComicPanel(frames[panel.frameIndex],panel,imageSizes[panel.frameIndex],options));
    const coverage=candidate.reduce((sum,panel)=>sum+panel.width*panel.height,0),waste=presentations.reduce((sum,p)=>sum+1-p.artOccupancy,0)/candidate.length,worstWaste=Math.max(...presentations.map(p=>1-p.artOccupancy));
    // Keep a planned wide scene out of a portrait slot, even when other filled panels lower average waste.
    const emphasis=candidate.reduce((sum,panel)=>sum+(preferredSpan(frames[panel.frameIndex])===panel.span?0:frames[panel.frameIndex].composition ? .12 : .035),0)/candidate.length;
    const score=waste+worstWaste*.5+emphasis+(1-Math.min(1,coverage/.875))*.2-candidate.length*.02+(candidate.length===1&&first+1<frames.length?.22:0);
    if(score<best-1e-9){selected=candidate;best=score;}
   }catch(error){if(!(error instanceof ComicPanelDensityError))throw error;}
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
export async function paintComicPanel(ctx:CanvasRenderingContext2D,frame:ComicFrame,panel:ComicPanel,runtime:ExportRuntime,savedBlob?:Blob,options:ComicPresentationOptions={}){
 if(!frame.image)throw Error(`Panel ${panel.frameIndex+1} has no saved image.`);
 const blob=savedBlob||await runtime.read(frame.image,panel.frameIndex);
 await runtime.image(blob,image=>{
  const presentation=layoutComicPanel(frame,panel,image,options),palette=sampleComicBubblePalette(image.value,runtime.canvas()),{rect,art}=presentation;
  ctx.fillStyle=palette.paper;ctx.fillRect(rect.x,rect.y,rect.width,rect.height);
  ctx.save();try{const viewport=presentation.artViewport;ctx.beginPath();ctx.rect(viewport.x,viewport.y,viewport.width,viewport.height);ctx.clip();ctx.drawImage(image.value,art.x,art.y,art.width,art.height);}finally{ctx.restore();}
  if(presentation.letteringBand){const band=presentation.letteringBand;ctx.fillStyle=palette.fill;ctx.fillRect(band.x,band.y,band.width,band.height);}
  if(presentation.captionLines.length){const strip={x:rect.x+1,y:presentation.narration.y-7,width:rect.width-2,height:presentation.narration.height+14};ctx.fillStyle=palette.fill;ctx.fillRect(strip.x,strip.y,strip.width,strip.height);ctx.strokeStyle=palette.stroke;ctx.lineWidth=1;ctx.strokeRect(strip.x,strip.y,strip.width,strip.height);}
  ctx.save();try{ctx.translate(rect.x,rect.y);paintComicBubbles(ctx,presentation.bubbles,rect.width,rect.height,{referenceWidth:rect.width,referenceHeight:rect.height,palette});}finally{ctx.restore();}
  ctx.font=`700 ${presentation.captionFontSize}px ${comicBubbleFontFamily}`;ctx.fontKerning='none';ctx.textBaseline='top';ctx.fillStyle=palette.ink;
  for(const line of presentation.captionLines)ctx.fillText(line.text,line.x,line.y);
  ctx.strokeStyle=palette.stroke;ctx.lineWidth=2;ctx.strokeRect(rect.x,rect.y,rect.width,rect.height);
 });
}
export async function paintComicPage(ctx:CanvasRenderingContext2D,frames:readonly ComicFrame[],page:ComicPage,runtime:ExportRuntime,onFrame:(frameIndex:number)=>void=()=>{},options:ComicPresentationOptions={}){
 const first=page.panels[0],firstFrame=first?frames[first.frameIndex]:undefined;
 const firstBlob=firstFrame?.image?await runtime.read(firstFrame.image,first.frameIndex):undefined;
 const palette=firstBlob?await runtime.image(firstBlob,image=>sampleComicBubblePalette(image.value,runtime.canvas())):defaultComicBubblePalette;
 ctx.fillStyle=palette.paper;ctx.fillRect(0,0,comicPageWidth,comicPageHeight);
 for(const panel of page.panels){onFrame(panel.frameIndex);await paintComicPanel(ctx,frames[panel.frameIndex],panel,runtime,panel===first?firstBlob:undefined,options);}
}
export function validatedComicPages(value:unknown,frameCount:number):ComicPage[]{
 if(!Array.isArray(value)||value.length>80)throw Error('Invalid comic page layout metadata.');
 const frames:number[]=[];
 for(const [index,page]of value.entries()){
  if(!page||page.index!==index||!Array.isArray(page.panels)||!page.panels.length||page.panels.length>6)throw Error('Invalid comic page layout metadata.');
  let previousY=-1;
  for(const panel of page.panels){
   if(!Number.isInteger(panel.frameIndex)||!['normal','wide','large','splash'].includes(panel.span)||![panel.x,panel.y,panel.width,panel.height].every(Number.isFinite)||panel.x<0||panel.y<0||panel.width<=0||panel.height<=0||panel.x+panel.width>1+1e-9||panel.y+panel.height>1+1e-9||panel.y<previousY-1e-9)throw Error('Invalid comic panel rectangle.');
   if(page.panels.some((other:ComicPanel)=>other!==panel&&panel.x<other.x+other.width-1e-9&&panel.x+panel.width>other.x+1e-9&&panel.y<other.y+other.height-1e-9&&panel.y+panel.height>other.y+1e-9))throw Error('Comic panel rectangles overlap.');
   previousY=panel.y;frames.push(panel.frameIndex);
  }
 }
 if(frames.length!==frameCount||frames.some((frame,index)=>frame!==index))throw Error('Comic page layout must preserve every source panel in order.');
 for(const page of value)if(![...templates,...legacyTemplates].some(template=>template.length===page.panels.length&&template.every((expected,index)=>{const panel=page.panels[index];return panel.span===expected.span&&(['x','y','width','height'] as const).every(key=>Math.abs(panel[key]-expected.rect[key])<1e-8);})))throw Error('Comic page layout must use complete canonical panel templates.');
 return value.map(page=>({index:page.index,panels:page.panels.map((panel:ComicPanel)=>({frameIndex:panel.frameIndex,span:panel.span,x:panel.x,y:panel.y,width:panel.width,height:panel.height}))}));
}
export function validatedComicRendering(value:unknown){
 const item=value as {width?:unknown;height?:unknown;minFontSize?:unknown}|null;
 if(!item||![item.width,item.height].every(value=>typeof value==='number'&&Number.isFinite(value)&&value>0)||Number(item.width)>900||Number(item.height)>1350||item.minFontSize!==null&&(typeof item.minFontSize!=='number'||!Number.isFinite(item.minFontSize)||item.minFontSize<comicMinimumFontSize||item.minFontSize>256))throw Error('Invalid embedded comic panel rendering metadata.');
 return {width:Number(item.width),height:Number(item.height),minFontSize:item.minFontSize as number|null};
}
