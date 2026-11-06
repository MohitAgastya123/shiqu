// Optional corrections to automatically placed balloons stay in the existing unsaved revision draft.
// Pointer, keyboard and percentage controls share normalized image coordinates and source-aware edits.
// Reuse the LAN-safe UUID helper so optional edits also work over local-network HTTP.
import {useRef,useState} from 'react';
import type {KeyboardEvent,PointerEvent} from 'react';
import {pageBubblesSchema,type ComicBubble} from '@/lib/reader-bubbles';
import {computeBubbleLayout} from '@/lib/comic-bubble-layout';
import {StoryBubbleArtwork} from './StoryBubbleLayer';
import {randomId} from '@/lib/reader-random-id';
import './story-bubbles.css';

type Handle='move'|'resize'|'tail';
type Drag={handle:Handle;pointer:number;x:number;y:number;width:number;height:number;initial:ComicBubble};
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
export function changedBubbleGeometry(b:ComicBubble,handle:Handle,dx:number,dy:number):ComicBubble{
 if(handle==='tail')return {...b,tailX:clamp(b.tailX+dx,.01,.99),tailY:clamp(b.tailY+dy,.01,.99)};
 if(handle==='resize')return {...b,width:clamp(b.width+dx,.12,1-b.x),height:clamp(b.height+dy,.08,1-b.y)};
 return {...b,x:clamp(b.x+dx,0,1-b.width),y:clamp(b.y+dy,0,1-b.height)};
}
export function bubbleDraftError(bubbles:ComicBubble[]){
 const parsed=pageBubblesSchema.safeParse(bubbles);
 if(!parsed.success)return parsed.error.issues[0].message;
 try{for(const b of bubbles)computeBubbleLayout(b,900,1350);}catch(e){return e instanceof Error?e.message:'Shorten this balloon or increase its size.';}
 return '';
}
export default function StoryBubbleEditor({image,bubbles=[],onChange,disabled=false}:{image:string;bubbles?:ComicBubble[];onChange:(bubbles:ComicBubble[])=>void;disabled?:boolean}){
 const [selected,setSelected]=useState<string|null>(bubbles[0]?.id??null),drag=useRef<Drag|null>(null);
 const bubble=bubbles.find(b=>b.id===selected)||bubbles[0],index=bubble?bubbles.indexOf(bubble):-1,error=bubbleDraftError(bubbles);
 function patch(value:Partial<ComicBubble>,editorial=false){if(!bubble||disabled)return;onChange(bubbles.map(b=>b.id===bubble.id?{...b,...value,...(editorial?{sourceQuote:undefined}:{})}:b));}
 function add(kind:ComicBubble['kind']){
  const b:ComicBubble={id:randomId(),kind,speaker:'Character',text:kind==='thought'?'A thought supported by the source.':'Words supported by the source.',x:bubbles.length%2?.52:.04,y:bubbles.length>=2?.29:.04,width:.44,height:.21,tailX:bubbles.length%2?.72:.28,tailY:.72};
  onChange([...bubbles,b]);setSelected(b.id);
 }
 function start(e:PointerEvent<HTMLButtonElement>,handle:Handle){
  if(!bubble||disabled)return;e.preventDefault();const rectangle=e.currentTarget.parentElement!.getBoundingClientRect();
  drag.current={handle,pointer:e.pointerId,x:e.clientX,y:e.clientY,width:rectangle.width,height:rectangle.height,initial:{...bubble}};e.currentTarget.setPointerCapture(e.pointerId);
 }
 function move(e:PointerEvent<HTMLButtonElement>){const d=drag.current;if(!d||d.pointer!==e.pointerId)return;const next=changedBubbleGeometry(d.initial,d.handle,(e.clientX-d.x)/d.width,(e.clientY-d.y)/d.height);onChange(bubbles.map(b=>b.id===d.initial.id?next:b));}
 function cancel(){const d=drag.current;if(d)onChange(bubbles.map(b=>b.id===d.initial.id?d.initial:b));drag.current=null;}
 function key(e:KeyboardEvent<HTMLButtonElement>,handle:Handle){
  if(!bubble||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const step=e.shiftKey?.05:.01;
  patch(changedBubbleGeometry(bubble,handle,e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0));
 }
 function reorder(offset:number){if(!bubble)return;const next=[...bubbles],target=index+offset;if(target<0||target>=next.length)return;[next[index],next[target]]=[next[target],next[index]];onChange(next);}
 const handles=bubble?[{kind:'move' as const,label:'Move balloon',x:bubble.x,y:bubble.y},{kind:'resize' as const,label:'Resize balloon',x:bubble.x+bubble.width,y:bubble.y+bubble.height},{kind:'tail' as const,label:'Aim balloon tail',x:bubble.tailX,y:bubble.tailY}]:[];
 return <section className="yu-bubble-editor" aria-label="Optional comic balloon editor">
  <h4>Comic balloons</h4><p>Balloons are placed automatically when your comic is created. These optional controls only change this draft.</p>
  <div className="yu-bubble-toolbar"><button type="button" disabled={disabled||bubbles.length>=4} onClick={()=>add('speech')}>Add speech</button><button type="button" disabled={disabled||bubbles.length>=4} onClick={()=>add('thought')}>Add thought</button></div>
  {!!bubbles.length&&<><div className="yu-bubble-list" role="group" aria-label="Balloon reading order">{bubbles.map((b,i)=><button key={b.id} type="button" disabled={disabled} aria-pressed={b===bubble} onClick={()=>setSelected(b.id)}>{i+1}. {b.speaker||'Character'} · {b.kind}</button>)}</div>
   <div className="yu-bubble-editor-preview"><StoryBubbleArtwork image={image} bubbles={bubbles} alt="Storyboard artwork with comic balloons">
    {bubble&&<div className="yu-bubble-selection" style={{left:bubble.x*100+'%',top:bubble.y*100+'%',width:bubble.width*100+'%',height:bubble.height*100+'%'}}/>}
    {handles.map(h=><button key={h.kind} type="button" className="yu-bubble-handle" aria-label={h.label} title={`${h.label}: drag or use arrow keys; Shift for larger steps`} disabled={disabled} style={{left:`clamp(22px, ${h.x*100}%, calc(100% - 22px))`,top:`clamp(22px, ${h.y*100}%, calc(100% - 22px))`}} onPointerDown={e=>start(e,h.kind)} onPointerMove={move} onPointerUp={()=>{drag.current=null;}} onPointerCancel={cancel} onKeyDown={e=>key(e,h.kind)}>{h.kind==='move'?'↔':h.kind==='resize'?'↘':'◎'}</button>)}
   </StoryBubbleArtwork></div>
   <p>Drag the blue handles, or focus one and use arrow keys. Hold Shift for larger steps. Percentages below offer precise placement.</p>
   {bubble&&<><label>Balloon type<select aria-label="Balloon type" disabled={disabled} value={bubble.kind} onChange={e=>patch({kind:e.target.value as ComicBubble['kind']},true)}><option value="speech">Speech</option><option value="thought">Thought</option></select></label><label>Speaker<input aria-label="Speaker" disabled={disabled} maxLength={80} value={bubble.speaker} onChange={e=>patch({speaker:e.target.value},true)}/></label><label>Balloon text<textarea aria-label="Balloon text" disabled={disabled} rows={3} maxLength={220} value={bubble.text} onChange={e=>patch({text:e.target.value},true)}/></label>
    <div className="yu-bubble-numbers">{(['x','y','width','height','tailX','tailY'] as const).map(field=><label key={field}>{({x:'X position',y:'Y position',width:'Width',height:'Height',tailX:'Tail X',tailY:'Tail Y'})[field]} (%)<input disabled={disabled} type="number" min={0} max={100} step={1} value={Number.isFinite(bubble[field])?Math.round(bubble[field]*10000)/100:''} onChange={e=>patch({[field]:e.target.value===''?0:Number(e.target.value)/100})}/></label>)}</div>
    <div className="yu-bubble-order"><button type="button" disabled={disabled||index===0} onClick={()=>reorder(-1)}>Read earlier</button><button type="button" disabled={disabled||index===bubbles.length-1} onClick={()=>reorder(1)}>Read later</button><button type="button" disabled={disabled} onClick={()=>{onChange(bubbles.filter(b=>b.id!==bubble.id));setSelected(null);}}>Remove balloon</button></div>
   </>}
  </>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
