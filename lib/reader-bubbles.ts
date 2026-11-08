// Validate attributed comic balloons and exact source evidence without changing historical pages.
// Fit compact whole-word bodies with bounded ranked search; final presentation avoids protected faces and action.
// Canonical pre-image targets stay intact; protected/band presentations clip short tips before scene content.
import {z} from 'zod';
import {measureBubbleText,comicTextWidth,bubbleTailStart,bubbleTailTip,bubbleReferenceWidth,bubbleReferenceHeight,bubbleMinimumFontSize,bubbleTargetFontSize} from './comic-bubble-layout.ts';
import type {BubbleReference} from './comic-bubble-layout.ts';
import type {NormalizedRect} from './comic-composition.ts';

const coordinate=z.number().finite().min(0).max(1);
export const comicBubbleSchema=z.object({
 id:z.string().trim().min(1).max(64),kind:z.enum(['speech','thought']),speaker:z.string().trim().min(1).max(80),text:z.string().trim().min(1).max(220),
 x:coordinate,y:coordinate,width:z.number().finite().positive().max(1),height:z.number().finite().positive().max(1),tailX:coordinate,tailY:coordinate,
 sourceQuote:z.string().trim().min(2).max(240).optional(),
}).strict().superRefine((bubble,ctx)=>{
 if(bubble.x+bubble.width>1+1e-9||bubble.y+bubble.height>1+1e-9)ctx.addIssue({code:z.ZodIssueCode.custom,message:'Keep each balloon completely inside the image.'});
});
export type ComicBubble=z.infer<typeof comicBubbleSchema>;
export type BubblePlacementFeedback={message:string;previousPages:{caption:string;prompt:string;bubbles?:ComicBubble[]}[]};
export const pageBubblesSchema=z.array(comicBubbleSchema).max(4,'Use at most four balloons per frame.').superRefine((bubbles,ctx)=>{
 if(new Set(bubbles.map(bubble=>bubble.id)).size!==bubbles.length)ctx.addIssue({code:z.ZodIssueCode.custom,message:'Balloon IDs must be unique within a frame.'});
});
const string=(minLength:number,maxLength:number)=>({type:'string',minLength,maxLength});
const number={type:'number',minimum:0,maximum:1};
export const comicBubbleJsonSchema={type:'object',properties:{id:string(1,64),kind:{type:'string',enum:['speech','thought']},speaker:string(1,80),text:string(1,220),x:number,y:number,width:{type:'number',exclusiveMinimum:0,maximum:1},height:{type:'number',exclusiveMinimum:0,maximum:1},tailX:number,tailY:number,sourceQuote:string(2,240)},required:['id','kind','speaker','text','x','y','width','height','tailX','tailY','sourceQuote'],additionalProperties:false};
export const generatedBubblesJsonSchema={type:'array',maxItems:4,items:comicBubbleJsonSchema};
export const bubbleDensityMessage='The dialogue is too dense for readable automatic balloon placement. Shorten or rebalance the dialogue and retry this storyboard step.';
export class BubbleDensityError extends Error{constructor(){super(bubbleDensityMessage);this.name='BubbleDensityError';}}
const quoteText=(text:string)=>text.replace(/\s+/gu,' ').trim();
export function validateBubbleEvidence(pages:{bubbles?:ComicBubble[]}[],sourceText:string){
 const source=quoteText(sourceText);
 for(const page of pages)for(const bubble of page.bubbles||[]){
  const quote=quoteText(bubble.sourceQuote||'');
  if(quote.length<2||!source.includes(quote))throw Error('A generated balloon needs an exact quotation from the saved English source.');
 }
}
export type BubblePlacementOptions=BubbleReference&{protectedAreas?:readonly NormalizedRect[];bodyBounds?:NormalizedRect;allowDistantTails?:boolean;maxFontSize?:number};
type PixelRect={x:number;y:number;width:number;height:number};
type Candidate={bubble:ComicBubble;score:number;box:PixelRect;tail:PixelRect};
const overlap=(a:PixelRect,b:PixelRect)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
function validRect(rect:NormalizedRect){return !!rect&&typeof rect==='object'&&[rect.x,rect.y,rect.width,rect.height].every(Number.isFinite)&&rect.x>=0&&rect.y>=0&&rect.width>0&&rect.height>0&&rect.x+rect.width<=1+1e-9&&rect.y+rect.height<=1+1e-9;}
function expanded(rect:PixelRect,pad:number):PixelRect{return {x:rect.x-pad,y:rect.y-pad,width:rect.width+pad*2,height:rect.height+pad*2};}
const contains=(rect:PixelRect,point:{x:number;y:number})=>point.x>=rect.x&&point.x<=rect.x+rect.width&&point.y>=rect.y&&point.y<=rect.y+rect.height;
function segmentEntry(start:{x:number;y:number},end:{x:number;y:number},rect:PixelRect){
 let low=0,high=1;
 for(const [origin,direction,min,max]of [[start.x,end.x-start.x,rect.x,rect.x+rect.width],[start.y,end.y-start.y,rect.y,rect.y+rect.height]]){
  if(Math.abs(direction)<1e-12){if(origin<min||origin>max)return null;continue;}
  const a=(min-origin)/direction,b=(max-origin)/direction;low=Math.max(low,Math.min(a,b));high=Math.min(high,Math.max(a,b));if(low>high)return null;
 }
 return high>=0&&low<=1?Math.max(0,low):null;
}
function tailBounds(bubble:ComicBubble,rw:number,rh:number):PixelRect{
 const start=bubbleTailStart(bubble),tip=bubbleTailTip(bubble,{referenceWidth:rw,referenceHeight:rh});
 const cx=(bubble.x+bubble.width/2)*rw,cy=(bubble.y+bubble.height/2)*rh,rx=bubble.width*rw/2,ry=bubble.height*rh/2;
 const angle=Math.atan2((tip.y*rh-cy)/ry,(tip.x*rw-cx)/rx),opening=bubble.kind==='speech'?.18:0;
 const points=[{x:start.x*rw,y:start.y*rh},{x:tip.x*rw,y:tip.y*rh},...[-opening,opening].map(offset=>({x:cx+Math.cos(angle+offset)*rx,y:cy+Math.sin(angle+offset)*ry}))];
 const pad=bubble.kind==='thought'?Math.min(9,Math.min(rx,ry)*.13)+2:3,x=Math.min(...points.map(p=>p.x))-pad,y=Math.min(...points.map(p=>p.y))-pad;
 return {x,y,width:Math.max(...points.map(p=>p.x))-x+pad,height:Math.max(...points.map(p=>p.y))-y+pad};
}
function connectorCrosses(bubble:ComicBubble,other:ComicBubble,rw:number,rh:number){
 const start=bubbleTailStart(bubble),tip=bubbleTailTip(bubble,{referenceWidth:rw,referenceHeight:rh});
 return segmentEntry({x:start.x*rw,y:start.y*rh},{x:tip.x*rw,y:tip.y*rh},expanded({x:other.x*rw,y:other.y*rh,width:other.width*rw,height:other.height*rh},4))!==null;
}
function connectorsCross(a:ComicBubble,b:ComicBubble,rw:number,rh:number){
 const start=bubbleTailStart(a),other=bubbleTailStart(b),tip=bubbleTailTip(a,{referenceWidth:rw,referenceHeight:rh}),otherTip=bubbleTailTip(b,{referenceWidth:rw,referenceHeight:rh});
 const dx=tip.x-start.x,dy=tip.y-start.y,ox=otherTip.x-other.x,oy=otherTip.y-other.y,det=dx*oy-dy*ox;
 if(Math.abs(det)<1e-12||Math.hypot((tip.x-otherTip.x)*rw,(tip.y-otherTip.y)*rh)<2)return false;
 const px=other.x-start.x,py=other.y-start.y,t=(px*oy-py*ox)/det,u=(px*dy-py*dx)/det;
 return t>0&&t<1&&u>0&&u<1;
}
function protectedTip(bubble:ComicBubble,areas:PixelRect[],rw:number,rh:number){
 const start=bubbleTailStart(bubble),from={x:start.x*rw,y:start.y*rh},to={x:bubble.tailX*rw,y:bubble.tailY*rh},distance=Math.hypot(to.x-from.x,to.y-from.y);
 if(!distance)return null;
 const tip=bubbleTailTip(bubble,{referenceWidth:rw,referenceHeight:rh});let fraction=Math.min(1,Math.hypot((tip.x-start.x)*rw,(tip.y-start.y)*rh)/distance);
 for(const area of areas)if(contains(area,to)){const entry=segmentEntry(from,to,area);if(entry!==null)fraction=Math.min(fraction,Math.max(0,entry-12/distance));}
 // Resolve the intended subject first, so an earlier-listed distant obstacle cannot change the result.
 for(const area of areas)if(!contains(area,to)){const entry=segmentEntry(from,to,area);if(entry!==null&&entry<=fraction)return null;}
 if(fraction*distance<4)return null;
 return {...bubble,tailX:(from.x+(to.x-from.x)*fraction)/rw,tailY:(from.y+(to.y-from.y)*fraction)/rh};
}
export function autoPlaceBubbles(input:ComicBubble[],options:BubblePlacementOptions={}):ComicBubble[]{
 const bubbles=pageBubblesSchema.parse(input);if(!bubbles.length)return bubbles;
 const rw=options.referenceWidth??bubbleReferenceWidth,rh=options.referenceHeight??bubbleReferenceHeight,bodyBounds=options.bodyBounds??{x:0,y:0,width:1,height:1};
 if(![rw,rh].every(n=>Number.isFinite(n)&&n>0)||!validRect(bodyBounds)||options.protectedAreas!==undefined&&(!Array.isArray(options.protectedAreas)||options.protectedAreas.length>24||options.protectedAreas.some(area=>!validRect(area)))||options.maxFontSize!==undefined&&(!Number.isFinite(options.maxFontSize)||options.maxFontSize<bubbleMinimumFontSize))throw new BubbleDensityError();
 const pixel=(r:NormalizedRect):PixelRect=>({x:r.x*rw,y:r.y*rh,width:r.width*rw,height:r.height*rh});
 const bounds=pixel(bodyBounds),pad=8,left=Math.max(pad,bounds.x+pad),top=Math.max(pad,bounds.y+pad),right=Math.min(rw-pad,bounds.x+bounds.width-pad),bottom=Math.min(rh-pad,bounds.y+bounds.height-pad);
 const widthAvailable=right-left,heightAvailable=bottom-top,areas=(options.protectedAreas??[]).map(area=>expanded(pixel(area),8));
 if(widthAvailable<1||heightAvailable<1)throw new BubbleDensityError();
 const presentation=options.protectedAreas!==undefined||options.bodyBounds!==undefined||!!options.allowDistantTails,diagonal=Math.hypot(rw,rh),maxFontSize=Math.min(bubbleTargetFontSize,options.maxFontSize??bubbleTargetFontSize);
 const candidates=bubbles.map(bubble=>{
  const result:Candidate[]=[],seen=new Set<string>();
  const preserveWords=Math.max(...bubble.text.trim().toUpperCase().split(/\s+/u).map(word=>comicTextWidth(word,bubbleMinimumFontSize)))/.76<=widthAvailable;
  for(const fraction of [.46,.64,.82,1]){
   const fit=measureBubbleText(bubble.text,bubble.kind,{maxWidth:widthAvailable*fraction,maxHeight:Math.min(heightAvailable,rh*(bubbles.length>2?.48:.62)),fontSize:maxFontSize,preserveWords});if(!fit)continue;
   const width=fit.width,height=fit.height,tx=bubble.tailX*rw,ty=bubble.tailY*rh,gap=bubble.kind==='thought'?28:18;
   const positions=[[tx-width/2,ty-height-gap],[tx-width-gap,ty-height-gap],[tx+gap,ty-height-gap],[tx-width-gap,ty-height/2],[tx+gap,ty-height/2],[tx-width/2,ty+gap],[tx-width-gap,ty+gap],[tx+gap,ty+gap],[bubble.x*rw,bubble.y*rh]];
   for(const area of areas){
    positions.push([tx-width/2,area.y-height-gap],[tx-width/2,area.y+area.height+gap],[area.x-width-gap,ty-height/2],[area.x+area.width+gap,ty-height/2]);
    for(const x of [left,right-width])positions.push([x,area.y-height-gap],[x,area.y+area.height+gap]);
   }
   for(const x of [0,.25,.5,.75,1])for(const y of [0,1/3,2/3,1])positions.push([left+(widthAvailable-width)*x,top+(heightAvailable-height)*y]);
   for(const [px,py]of positions){
    if(width>widthAvailable||height>heightAvailable)continue;
    const x=Math.max(left,Math.min(right-width,px)),y=Math.max(top,Math.min(bottom-height,py)),box={x,y,width,height},key=[x,y,width,height].map(n=>Math.round(n*10)).join(':');
    if(seen.has(key))continue;seen.add(key);if(areas.some(area=>overlap(box,area)))continue;
    let next={...bubble,x:x/rw,y:y/rh,width:width/rw,height:height/rh};const start=bubbleTailStart(next);
    if(start.x===next.x+next.width/2&&start.y===next.y+next.height/2)continue;
    const distance=Math.hypot((start.x-bubble.tailX)*rw,(start.y-bubble.tailY)*rh);
    const origin={x:start.x*rw,y:start.y*rh},target={x:bubble.tailX*rw,y:bubble.tailY*rh};let clearDistance=distance;
    for(const area of areas)if(contains(area,target)){const entry=segmentEntry(origin,target,area);if(entry!==null)clearDistance=Math.min(clearDistance,distance*entry);}
    if(!options.allowDistantTails&&clearDistance>Math.min(90,Math.min(rw,rh)*.25))continue;
    if(presentation){const clipped=protectedTip(next,areas,rw,rh);if(!clipped)continue;next=clipped;}
    const tail=tailBounds(next,rw,rh);if(areas.some(area=>overlap(tail,area)))continue;
    const score=width*height/(rw*rh)*300+distance/diagonal*30+Math.hypot(x-bubble.x*rw,y-bubble.y*rh)/diagonal*.3+y/rh*.2;
    result.push({bubble:next,score,box,tail});
   }
  }
  return result.sort((a,b)=>a.score-b.score||a.box.y-b.box.y||a.box.x-b.box.x).slice(0,64);
 });
 type State={placed:Candidate[];score:number};let states:State[]=[{placed:[],score:0}];
 for(const choices of candidates){
  const next:State[]=[];
  for(const state of states)for(const candidate of choices){
   const previous=state.placed.at(-1)?.bubble,bubble=candidate.bubble;
   if(previous&&(bubble.y+bubble.height/2<previous.y+previous.height/2-.04||Math.abs(bubble.y-previous.y)<.035&&bubble.x<previous.x))continue;
   if(state.placed.some(other=>overlap(expanded(candidate.box,4),other.box)||connectorCrosses(bubble,other.bubble,rw,rh)||connectorCrosses(other.bubble,bubble,rw,rh)||connectorsCross(bubble,other.bubble,rw,rh)))continue;
   next.push({placed:[...state.placed,candidate],score:state.score+candidate.score});
  }
  states=next.sort((a,b)=>a.score-b.score).slice(0,32);if(!states.length)throw new BubbleDensityError();
 }
 return pageBubblesSchema.parse(states[0].placed.map(candidate=>candidate.bubble));
}
