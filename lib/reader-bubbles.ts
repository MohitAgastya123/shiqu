// Validate attributed comic balloons and exact source evidence without changing historical pages.
// Pack content-sized oval bodies close to planned speakers, using final-sheet pixel references for reflow.
import {z} from 'zod';
import {measureBubbleText,bubbleTailStart,bubbleReferenceWidth,bubbleReferenceHeight} from './comic-bubble-layout.ts';
import type {BubbleReference} from './comic-bubble-layout.ts';

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
const overlap=(a:ComicBubble,b:ComicBubble)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
function connectorCrosses(bubble:ComicBubble,other:ComicBubble){
 const start=bubbleTailStart(bubble),dx=bubble.tailX-start.x,dy=bubble.tailY-start.y,pad=.008;
 // A bounded slab intersection includes connector endpoints and a small rendering clearance.
 let low=0,high=1;
 for(const [origin,direction,min,max] of [[start.x,dx,other.x-pad,other.x+other.width+pad],[start.y,dy,other.y-pad,other.y+other.height+pad]]){
  if(Math.abs(direction)<1e-12){if(origin<min||origin>max)return false;continue;}
  const a=(min-origin)/direction,b=(max-origin)/direction;low=Math.max(low,Math.min(a,b));high=Math.min(high,Math.max(a,b));if(low>high)return false;
 }
 return high>=0&&low<=1;
}
function connectorsCross(a:ComicBubble,b:ComicBubble){
 // Two balloons may belong to the same speaker; meeting at that target is intentional.
 if(Math.hypot(a.tailX-b.tailX,a.tailY-b.tailY)<.01)return false;
 const start=bubbleTailStart(a),other=bubbleTailStart(b),dx=a.tailX-start.x,dy=a.tailY-start.y,ox=b.tailX-other.x,oy=b.tailY-other.y,det=dx*oy-dy*ox;
 if(Math.abs(det)<1e-12)return false;
 const px=other.x-start.x,py=other.y-start.y,t=(px*oy-py*ox)/det,u=(px*dy-py*dx)/det;
 return t>0&&t<1&&u>0&&u<1;
}
export function autoPlaceBubbles(input:ComicBubble[],reference:BubbleReference={}):ComicBubble[]{
 const bubbles=pageBubblesSchema.parse(input);if(!bubbles.length)return bubbles;
 const rw=reference.referenceWidth??bubbleReferenceWidth,rh=reference.referenceHeight??bubbleReferenceHeight;
 if(![rw,rh].every(n=>Number.isFinite(n)&&n>0))throw new BubbleDensityError();
 const margin=12,placed:ComicBubble[]=[];
 const candidates=bubbles.map(bubble=>{
  const result:ComicBubble[]=[];
  for(const fraction of [.72,.88,.96]){
   const fit=measureBubbleText(bubble.text,bubble.kind,{maxWidth:rw*fraction-margin*2,maxHeight:rh*(bubbles.length>2?.48:.62)});if(!fit)continue;
   const width=fit.width,height=fit.height,tx=bubble.tailX*rw,ty=bubble.tailY*rh,gap=bubble.kind==='thought'?48:18;
   // Saved positions guide placement, but the short attached tail and reading order take precedence.
   const positions=[[tx-width/2,ty-height-gap],[tx-width-gap,ty-height-gap],[tx+gap,ty-height-gap],[tx-width-gap,ty-height/2],[tx+gap,ty-height/2],[tx-width/2,ty+gap],[bubble.x*rw,bubble.y*rh]];
   for(const [px,py]of positions){
    const x=Math.max(margin,Math.min(rw-margin-width,px)),y=Math.max(margin,Math.min(rh-margin-height,py));
    if(width>rw-margin*2||height>rh-margin*2)continue;
    const next={...bubble,x:x/rw,y:y/rh,width:width/rw,height:height/rh},start=bubbleTailStart(next);
    if(start.x===next.x+next.width/2&&start.y===next.y+next.height/2)continue;
    if(Math.hypot((start.x-bubble.tailX)*rw,(start.y-bubble.tailY)*rh)>Math.min(90,Math.min(rw,rh)*.25))continue;
    result.push(next);
   }
  }
  return result;
 });
 function search(index:number):boolean{
  if(index===bubbles.length)return true;
  for(const candidate of candidates[index]){
   const previous=placed.at(-1);
   if(previous&&(candidate.y+candidate.height/2<previous.y+previous.height/2-.04||Math.abs(candidate.y-previous.y)<.035&&candidate.x<previous.x))continue;
   if(placed.some(other=>overlap(candidate,other)||connectorCrosses(candidate,other)||connectorCrosses(other,candidate)||connectorsCross(candidate,other)))continue;
   placed.push(candidate);if(search(index+1))return true;placed.pop();
  }
  return false;
 }
 if(search(0))return pageBubblesSchema.parse(placed);
 throw new BubbleDensityError();
}
