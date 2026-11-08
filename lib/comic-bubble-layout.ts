// Share oval balloon outlines, attached curved tails and exact offline comic lettering across SVG/canvas.
// Fit uppercase dialogue without speaker labels; panel reference dimensions preserve final-sheet readability.
// Compact new lettering uses a 20px floor and a 22px target; all renderers share bounded tail tips.
import type {ComicBubble} from './reader-bubbles.ts';
import {comicGlyphAdvances} from './comic-bubble-font-metrics.ts';
import {defaultComicBubblePalette,type ComicBubblePalette} from './comic-bubble-palette.ts';
export const bubbleReferenceWidth=900;
export const bubbleReferenceHeight=1350;
export const bubbleMinimumFontSize=20;
export const bubbleTargetFontSize=22;
export const comicBubbleFontFamily='"Shiqu Comic", sans-serif';
export type BubbleTextFit={fontSize:number;lines:string[];lineHeight:number};
export type BubbleReference={referenceWidth?:number;referenceHeight?:number};
type Command={kind:'M'|'L';x:number;y:number}|{kind:'Q';cx:number;cy:number;x:number;y:number}|{kind:'Z'};
export type BubbleLayout={path:string;tailPath?:string;circles:{x:number;y:number;r:number}[];lines:{text:string;x:number;y:number;width:number}[];fontSize:number;lineHeight:number;strokeWidth:number;bounds:{x:number;y:number;width:number;height:number};bodyCommands:Command[];tailCommands:Command[]};
export function comicTextWidth(text:string,size:number){
 return Array.from(text).reduce((total,character)=>total+(/\p{Mark}/u.test(character)?0:comicGlyphAdvances[character.codePointAt(0)!]??(/\p{Extended_Pictographic}|\p{Script=Han}/u.test(character)?1:.65))*size,0);
}
// Normalized widths round-trip through division/multiplication; a few ulps must not wrap an exact-fit word.
const fitsWithin=(value:number,limit:number)=>value<=limit+Number.EPSILON*Math.max(1,value,limit)*32;
function wrapped(text:string,width:number,size:number):string[]|null{
 const lines:string[]=[];
 for(const paragraph of text.replace(/\r\n?/g,'\n').split('\n')){
  let line='';
  for(const word of paragraph.trim().split(/\s+/u).filter(Boolean)){
   const candidate=line?line+' '+word:word;
   if(fitsWithin(comicTextWidth(candidate,size),width)){line=candidate;continue;}
   if(line){lines.push(line);line='';}
   for(const character of Array.from(word)){
    if(!fitsWithin(comicTextWidth(character,size),width))return null;
    if(line&&!fitsWithin(comicTextWidth(line+character,size),width)){lines.push(line);line='';}
    line+=character;
   }
  }
  lines.push(line);
 }
 return lines;
}
function fittedAt(text:string,width:number,height:number,size:number,kind:'speech'|'thought'):BubbleTextFit|null{
 const lines=wrapped(text.toUpperCase(),width*.76,size),lineHeight=size*1.16;
 if(!lines||!fitsWithin(lines.length*lineHeight,height*.73))return null;
 const rx=width*.45,ry=height*.43;
 if(lines.some((line,index)=>{const y=Math.abs((index-(lines.length-1)/2)*lineHeight)+size*.42;return y>=ry||!fitsWithin(comicTextWidth(line,size),2*rx*Math.sqrt(1-(y/ry)**2)*(kind==='thought'?.95:1));}))return null;
 return {fontSize:size,lines,lineHeight};
}
export function fitBubbleText(text:string,widthPx:number,heightPx:number,kind:'speech'|'thought'='speech',_speaker=''):BubbleTextFit|null{
 if(!Number.isFinite(widthPx)||!Number.isFinite(heightPx)||widthPx<=0||heightPx<=0||!text.trim())return null;
 for(let size=bubbleTargetFontSize;size>=bubbleMinimumFontSize;size--){const fit=fittedAt(text.trim(),widthPx,heightPx,size,kind);if(fit)return fit;}
 return null;
}
export function measureBubbleText(text:string,kind:'speech'|'thought',options:{maxWidth:number;maxHeight:number;fontSize?:number;preserveWords?:boolean}){
 const {maxWidth,maxHeight}=options;if(!text.trim()||!Number.isFinite(maxWidth)||!Number.isFinite(maxHeight)||maxWidth<1||maxHeight<1)return null;
 for(let size=Math.min(bubbleTargetFontSize,options.fontSize??bubbleTargetFontSize);size>=bubbleMinimumFontSize;size--){
  let best:({width:number;height:number}&BubbleTextFit)|null=null,bestScore=Infinity;
  const longest=Math.max(...text.trim().toUpperCase().split(/\s+/u).map(word=>comicTextWidth(word,size)));
  if(options.preserveWords&&!fitsWithin(longest/.76,maxWidth))continue;
  const firstWidth=Math.min(maxWidth,Math.max(72,size*2.7,longest/.76)),step=Math.max(12,(maxWidth-firstWidth)/64);
  for(let width=firstWidth;width<=maxWidth+step-1;width+=step){
   const w=Math.min(width,maxWidth),lines=wrapped(text.trim().toUpperCase(),w*.76,size);if(!lines)continue;
   const ellipseHeight=Math.max(...lines.map((line,index)=>{
    const ratio=comicTextWidth(line,size)/(w*.9*(kind==='thought'?.95:1));
    return ratio>=1?Infinity:(Math.abs((index-(lines.length-1)/2)*size*1.16)+size*.42)/(.43*Math.sqrt(1-ratio*ratio));
   }));
   const rawHeight=Math.max(size*2.5,lines.length*size*1.16/.7,ellipseHeight+1);
   for(let height=rawHeight;height<=Math.min(maxHeight,rawHeight+size*.5)+1;height+=size*.25){
    const fit=fittedAt(text.trim(),w,height,size,kind);if(!fit)continue;
    const score=w*height*(1+Math.abs(Math.log(w/height/1.7))*.8);if(score<bestScore){best={width:w,height,...fit};bestScore=score;}break;
   }
   if(width>=maxWidth)break;
  }
  if(best)return best;
 }
 return null;
}
export function bubbleTailStart(bubble:ComicBubble){
 const cx=bubble.x+bubble.width/2,cy=bubble.y+bubble.height/2,dx=bubble.tailX-cx,dy=bubble.tailY-cy;
 const distance=Math.hypot(dx/(bubble.width/2),dy/(bubble.height/2));
 return distance<=1?{x:cx,y:cy}:{x:cx+dx/distance,y:cy+dy/distance};
}
export function bubbleTailTip(bubble:ComicBubble,reference:BubbleReference={}){
 const rw=reference.referenceWidth??bubbleReferenceWidth,rh=reference.referenceHeight??bubbleReferenceHeight,start=bubbleTailStart(bubble);
 const dx=(bubble.tailX-start.x)*rw,dy=(bubble.tailY-start.y)*rh,distance=Math.hypot(dx,dy),maximum=Math.min(64,Math.min(rw,rh)*.18);
 return distance>maximum?{x:start.x+dx/distance*maximum/rw,y:start.y+dy/distance*maximum/rh}:{x:bubble.tailX,y:bubble.tailY};
}
const svgPath=(commands:Command[])=>commands.map(c=>c.kind==='Z'?'Z':c.kind==='Q'?`Q ${c.cx} ${c.cy} ${c.x} ${c.y}`:`${c.kind} ${c.x} ${c.y}`).join(' ');
export function computeBubbleLayout(bubble:ComicBubble,imageWidth:number,imageHeight:number,reference:BubbleReference={}):BubbleLayout{
 const rw=reference.referenceWidth??bubbleReferenceWidth,rh=reference.referenceHeight??bubbleReferenceHeight;
 if(![imageWidth,imageHeight,rw,rh].every(n=>Number.isFinite(n)&&n>0))throw Error('The image dimensions are invalid for comic balloons.');
 const fit=fitBubbleText(bubble.text,bubble.width*rw,bubble.height*rh,bubble.kind);
 if(!fit)throw Error('This balloon is too dense to render at a readable size. Shorten its text or enlarge its bounds.');
 const x=bubble.x*imageWidth,y=bubble.y*imageHeight,width=bubble.width*imageWidth,height=bubble.height*imageHeight,cx=x+width/2,cy=y+height/2,rx=width/2,ry=height/2;
 const sx=imageWidth/rw,sy=imageHeight/rh,scale=Math.min(sx,sy),strokeWidth=2.4*scale;
 const bodyCommands:Command[]=[],tailCommands:Command[]=[],circles:{x:number;y:number;r:number}[]=[];
 const start=bubbleTailStart(bubble),ax=start.x*imageWidth,ay=start.y*imageHeight;
 const tip=bubbleTailTip(bubble,reference),tx=tip.x*imageWidth,ty=tip.y*imageHeight;
 const hasTail=start.x!==bubble.x+bubble.width/2||start.y!==bubble.y+bubble.height/2;
 if(bubble.kind==='thought'){
  const lobes=11;
  for(let index=0;index<lobes;index++){
   const a=-Math.PI/2+index/lobes*Math.PI*2,b=a+Math.PI*2/lobes,m=(a+b)/2;
   if(!index)bodyCommands.push({kind:'M',x:cx+Math.cos(a)*rx*.9,y:cy+Math.sin(a)*ry*.9});
   bodyCommands.push({kind:'Q',cx:cx+Math.cos(m)*rx*1.13,cy:cy+Math.sin(m)*ry*1.13,x:cx+Math.cos(b)*rx*.9,y:cy+Math.sin(b)*ry*.9});
  }
  if(hasTail)for(const [index,t]of [.24,.6,.9].entries())circles.push({x:ax+(tx-ax)*t,y:ay+(ty-ay)*t,r:Math.min(9*scale,Math.min(width,height)*.065)*[1,.68,.4][index]});
 }else{
  const angle=Math.atan2((ty-cy)/ry,(tx-cx)/rx),opening=hasTail?.18:0,from=angle+opening,arc=Math.PI*2-opening*2,steps=16;
  bodyCommands.push({kind:'M',x:cx+Math.cos(from)*rx,y:cy+Math.sin(from)*ry});
  for(let index=0;index<steps;index++){
   const a=from+index/steps*arc,b=from+(index+1)/steps*arc,m=(a+b)/2,k=1/Math.cos((b-a)/2);
   bodyCommands.push({kind:'Q',cx:cx+Math.cos(m)*rx*k,cy:cy+Math.sin(m)*ry*k,x:cx+Math.cos(b)*rx,y:cy+Math.sin(b)*ry});
  }
  if(hasTail){
   const a=angle-opening,b=angle+opening,rootA={x:cx+Math.cos(a)*rx,y:cy+Math.sin(a)*ry},rootB={x:cx+Math.cos(b)*rx,y:cy+Math.sin(b)*ry};
   bodyCommands.push({kind:'Q',cx:rootA.x+(tx-rootA.x)*.48,cy:rootA.y+(ty-rootA.y)*.24,x:tx,y:ty},{kind:'Q',cx:rootB.x+(tx-rootB.x)*.18,cy:rootB.y+(ty-rootB.y)*.6,x:rootB.x,y:rootB.y});
  }
 }
 bodyCommands.push({kind:'Z'});
 const firstY=cy-(fit.lines.length-1)*fit.lineHeight*scale/2;
 const lines=fit.lines.map((text,index)=>({text,x:cx,y:firstY+index*fit.lineHeight*scale,width:comicTextWidth(text,fit.fontSize)*scale}));
 return {path:svgPath(bodyCommands),circles,lines,fontSize:fit.fontSize*scale,lineHeight:fit.lineHeight*scale,strokeWidth,bounds:{x,y,width,height},bodyCommands,tailCommands};
}
function trace(ctx:CanvasRenderingContext2D,commands:Command[]){
 ctx.beginPath();for(const c of commands){if(c.kind==='M')ctx.moveTo(c.x,c.y);else if(c.kind==='L')ctx.lineTo(c.x,c.y);else if(c.kind==='Q')ctx.quadraticCurveTo(c.cx,c.cy,c.x,c.y);else ctx.closePath();}ctx.fill();ctx.stroke();
}
export function paintComicBubbles(ctx:CanvasRenderingContext2D,bubbles:readonly ComicBubble[]|undefined,width:number,height:number,options:BubbleReference&{palette?:ComicBubblePalette}={}){
 const palette=options.palette??defaultComicBubblePalette;
 for(const bubble of bubbles||[]){
  const layout=computeBubbleLayout(bubble,width,height,options);ctx.save();
  try{
   ctx.fillStyle=palette.fill;ctx.strokeStyle=palette.stroke;ctx.lineWidth=layout.strokeWidth;ctx.lineJoin='round';
   for(const circle of layout.circles){ctx.beginPath();ctx.arc(circle.x,circle.y,circle.r,0,Math.PI*2);ctx.fill();ctx.stroke();}
   trace(ctx,layout.bodyCommands);ctx.fillStyle=palette.ink;ctx.font=`700 ${layout.fontSize}px ${comicBubbleFontFamily}`;ctx.fontKerning='none';ctx.textAlign='center';ctx.textBaseline='middle';
   for(const line of layout.lines)if(line.text)ctx.fillText(line.text,line.x,line.y);
  }finally{ctx.restore();}
 }
}
