// Share deterministic balloon geometry and fitted text between SVG reading and canvas exports.
// Canonical portrait metrics keep line breaks stable; exporters paint before existing signatures.
import type {ComicBubble} from './reader-bubbles.ts';

export const bubbleReferenceWidth=900;
export const bubbleReferenceHeight=1350;
export const bubbleMinimumFontSize=26;
export const comicBubbleFontFamily='Arial, Helvetica, sans-serif';
export type BubbleTextFit={fontSize:number;lines:string[];lineHeight:number};
type Command={kind:'M'|'L';x:number;y:number}|{kind:'Q';cx:number;cy:number;x:number;y:number}|{kind:'Z'};
export type BubbleLayout={path:string;tailPath?:string;circles:{x:number;y:number;r:number}[];lines:{text:string;x:number;y:number;width:number}[];fontSize:number;lineHeight:number;strokeWidth:number;bounds:{x:number;y:number;width:number;height:number};bodyCommands:Command[];tailCommands:Command[]};

function advance(character:string){
 if(/\p{Mark}/u.test(character))return 0;
 if(/\s/u.test(character))return .33;
 if(/[ilI.,'`:;!|]/u.test(character))return .34;
 if(/[MWmw@%&]/u.test(character))return .9;
 if(/[\p{Script=Han}\p{Extended_Pictographic}]/u.test(character))return 1;
 return /[A-Z0-9]/u.test(character)?.68:.6;
}
function textWidth(text:string,size:number){return Array.from(text).reduce((total,character)=>total+advance(character)*size,0);}
function wrapped(text:string,width:number,size:number):string[]|null{
 const lines:string[]=[];
 for(const paragraph of text.replace(/\r\n?/g,'\n').split('\n')){
  let line='';
  for(const word of paragraph.trim().split(/\s+/u).filter(Boolean)){
   const candidate=line?line+' '+word:word;
   if(textWidth(candidate,size)<=width){line=candidate;continue;}
   if(line){lines.push(line);line='';}
   for(const character of Array.from(word)){
    if(textWidth(character,size)>width)return null;
    if(line&&textWidth(line+character,size)>width){lines.push(line);line='';}
    line+=character;
   }
  }
  lines.push(line);
 }
 return lines;
}
export function fitBubbleText(text:string,widthPx:number,heightPx:number,kind:'speech'|'thought'='speech',speaker=''):BubbleTextFit|null{
 if(!Number.isFinite(widthPx)||!Number.isFinite(heightPx)||widthPx<=0||heightPx<=0||!text.trim())return null;
 const padding=kind==='thought'?.2:.14,innerWidth=widthPx*(1-padding*2),innerHeight=heightPx*(1-padding*2);
 const content=(speaker.trim()?speaker.trim()+':\n':'')+text.trim();
 for(let fontSize=40;fontSize>=bubbleMinimumFontSize;fontSize--){
  const lines=wrapped(content,innerWidth,fontSize),lineHeight=fontSize*1.25;
  if(lines&&lines.length*lineHeight<=innerHeight)return {fontSize,lines,lineHeight};
 }
 return null;
}
export function bubbleTailStart(bubble:ComicBubble){
 const cx=bubble.x+bubble.width/2,cy=bubble.y+bubble.height/2,dx=bubble.tailX-cx,dy=bubble.tailY-cy;
 if(Math.abs(dx)<=bubble.width/2&&Math.abs(dy)<=bubble.height/2)return {x:cx,y:cy};
 const factor=Math.min(dx?bubble.width/2/Math.abs(dx):Infinity,dy?bubble.height/2/Math.abs(dy):Infinity);
 return {x:cx+dx*factor,y:cy+dy*factor};
}
const svgPath=(commands:Command[])=>commands.map(command=>command.kind==='Z'?'Z':command.kind==='Q'?`Q ${command.cx} ${command.cy} ${command.x} ${command.y}`:`${command.kind} ${command.x} ${command.y}`).join(' ');
export function computeBubbleLayout(bubble:ComicBubble,imageWidth:number,imageHeight:number):BubbleLayout{
 if(!Number.isFinite(imageWidth)||!Number.isFinite(imageHeight)||imageWidth<=0||imageHeight<=0)throw Error('The image dimensions are invalid for comic balloons.');
 const fit=fitBubbleText(bubble.text,bubble.width*bubbleReferenceWidth,bubble.height*bubbleReferenceHeight,bubble.kind,bubble.speaker);
 if(!fit)throw Error('This balloon is too dense to render at a readable size. Shorten its text or enlarge its bounds.');
 const x=bubble.x*imageWidth,y=bubble.y*imageHeight,width=bubble.width*imageWidth,height=bubble.height*imageHeight,cx=x+width/2,cy=y+height/2;
 const sx=imageWidth/bubbleReferenceWidth,sy=imageHeight/bubbleReferenceHeight,scale=Math.min(sx,sy),strokeWidth=2.5*scale;
 const bodyCommands:Command[]=[],tailCommands:Command[]=[],circles:{x:number;y:number;r:number}[]=[];
 if(bubble.kind==='thought'){
  const lobes=16,rx=width/2,ry=height/2;
  for(let index=0;index<lobes;index++){
   const a=-Math.PI/2+index/lobes*Math.PI*2,b=a+Math.PI*2/lobes,m=(a+b)/2;
   if(index===0)bodyCommands.push({kind:'M',x:cx+Math.cos(a)*rx*.84,y:cy+Math.sin(a)*ry*.84});
   bodyCommands.push({kind:'Q',cx:cx+Math.cos(m)*rx*1.08,cy:cy+Math.sin(m)*ry*1.08,x:cx+Math.cos(b)*rx*.84,y:cy+Math.sin(b)*ry*.84});
  }
  bodyCommands.push({kind:'Z'});
 }else{
  const r=Math.min(width,height)*.15;
  bodyCommands.push({kind:'M',x:x+r,y},{kind:'L',x:x+width-r,y},{kind:'Q',cx:x+width,cy:y,x:x+width,y:y+r},{kind:'L',x:x+width,y:y+height-r},{kind:'Q',cx:x+width,cy:y+height,x:x+width-r,y:y+height},{kind:'L',x:x+r,y:y+height},{kind:'Q',cx:x,cy:y+height,x,y:y+height-r},{kind:'L',x,y:y+r},{kind:'Q',cx:x,cy:y,x:x+r,y},{kind:'Z'});
 }
 const start=bubbleTailStart(bubble),tx=bubble.tailX*imageWidth,ty=bubble.tailY*imageHeight,ax=start.x*imageWidth,ay=start.y*imageHeight;
 if(start.x!==bubble.x+bubble.width/2||start.y!==bubble.y+bubble.height/2){
  if(bubble.kind==='thought'){
   for(const [index,t]of [.28,.58,.84].entries())circles.push({x:ax+(tx-ax)*t,y:ay+(ty-ay)*t,r:Math.min(width,height)*[.055,.038,.023][index]});
  }else{
   const dx=tx-ax,dy=ty-ay,distance=Math.hypot(dx,dy),half=Math.min(width,height)*.055;
   const px=-dy/distance*half,py=dx/distance*half;
   tailCommands.push({kind:'M',x:ax+px,y:ay+py},{kind:'L',x:tx,y:ty},{kind:'L',x:ax-px,y:ay-py},{kind:'Z'});
  }
 }
 const firstY=cy-(fit.lines.length-1)*fit.lineHeight*sy/2;
 const lines=fit.lines.map((text,index)=>({text,x:cx,y:firstY+index*fit.lineHeight*sy,width:textWidth(text,fit.fontSize)*sx}));
 return {path:svgPath(bodyCommands),...(tailCommands.length?{tailPath:svgPath(tailCommands)}:{}),circles,lines,fontSize:fit.fontSize*scale,lineHeight:fit.lineHeight*sy,strokeWidth,bounds:{x,y,width,height},bodyCommands,tailCommands};
}
function trace(ctx:CanvasRenderingContext2D,commands:Command[]){
 ctx.beginPath();
 for(const command of commands){if(command.kind==='M')ctx.moveTo(command.x,command.y);else if(command.kind==='L')ctx.lineTo(command.x,command.y);else if(command.kind==='Q')ctx.quadraticCurveTo(command.cx,command.cy,command.x,command.y);else ctx.closePath();}
 ctx.fill();ctx.stroke();
}
export function paintComicBubbles(ctx:CanvasRenderingContext2D,bubbles:readonly ComicBubble[]|undefined,width:number,height:number){
 for(const bubble of bubbles||[]){
  const layout=computeBubbleLayout(bubble,width,height);
  ctx.save();
  try{
   ctx.fillStyle='#fffefa';ctx.strokeStyle='#17232c';ctx.lineWidth=layout.strokeWidth;ctx.lineJoin='round';
   if(layout.tailCommands.length)trace(ctx,layout.tailCommands);
   for(const circle of layout.circles){ctx.beginPath();ctx.arc(circle.x,circle.y,circle.r,0,Math.PI*2);ctx.fill();ctx.stroke();}
   trace(ctx,layout.bodyCommands);
   ctx.fillStyle='#17232c';ctx.font=`${layout.fontSize}px ${comicBubbleFontFamily}`;ctx.textAlign='center';ctx.textBaseline='middle';
   for(const line of layout.lines){if(!line.text)continue;const measured=ctx.measureText(line.text).width;ctx.save();ctx.translate(line.x,line.y);if(measured>0)ctx.scale(line.width/measured,1);ctx.fillText(line.text,0,0);ctx.restore();}
  }finally{ctx.restore();}
 }
}
