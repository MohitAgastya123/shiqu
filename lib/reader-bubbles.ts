// Validate attributed comic balloons and exact source evidence without changing historical pages.
// Generated balloons are automatically packed with the same readable text metrics as production rendering.
import {z} from 'zod';
import {fitBubbleText,bubbleTailStart,bubbleReferenceWidth,bubbleReferenceHeight} from './comic-bubble-layout.ts';

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
function partitions(count:number):number[][]{
 if(!count)return [[]];
 return Array.from({length:count},(_,index)=>index+1).flatMap(first=>partitions(count-first).map(rest=>[first,...rest]));
}
export function autoPlaceBubbles(input:ComicBubble[]):ComicBubble[]{
 const bubbles=pageBubblesSchema.parse(input);if(!bubbles.length)return bubbles;
 const margin=.03,gap=.025,available=1-margin*2;
 // Place compact readable rows near their speakers instead of attaching long needles to the image top.
 const bottom=Math.min(.6,...bubbles.map(bubble=>bubble.tailY-.06));
 for(const rows of partitions(bubbles.length).sort((a,b)=>a.length-b.length))for(const height of [.22,.28,.34,.42,.50,.57]){
  const top=bottom-height,rowHeight=(height-gap*(rows.length-1))/rows.length;if(top<margin-1e-9||rowHeight<=0)continue;
  let offset=0;
  const placed=rows.flatMap((count,row)=>{
   const width=(available-gap*(count-1))/count;
   return Array.from({length:count},(_,column)=>({...bubbles[offset++],x:margin+column*(width+gap),y:top+row*(rowHeight+gap),width,height:rowHeight}));
  });
  if(placed.some(bubble=>!fitBubbleText(bubble.text,bubble.width*bubbleReferenceWidth,bubble.height*bubbleReferenceHeight,bubble.kind,bubble.speaker)))continue;
  if(placed.some((bubble,index)=>placed.some((other,j)=>index!==j&&(overlap(bubble,other)||connectorCrosses(bubble,other)||connectorsCross(bubble,other)))))continue;
  // Tail targets identify visible speakers below the reserved area, never inside a balloon body.
  if(placed.some(bubble=>bubble.tailX>=bubble.x&&bubble.tailX<=bubble.x+bubble.width&&bubble.tailY>=bubble.y&&bubble.tailY<=bubble.y+bubble.height))continue;
  return pageBubblesSchema.parse(placed);
 }
 throw new BubbleDensityError();
}
