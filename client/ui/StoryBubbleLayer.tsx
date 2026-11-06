// Render the production balloon geometry without browser-specific text wrapping.
// Artwork and its SVG share one fitted rectangle; the ordered transcript remains accessible.
import {useEffect,useRef,useState} from 'react';
import {comicBubbleSchema,type ComicBubble} from '@/lib/reader-bubbles';
import {computeBubbleLayout,comicBubbleFontFamily} from '@/lib/comic-bubble-layout';
import './story-bubbles.css';

export function BubbleTranscript({bubbles}:{bubbles:ComicBubble[]}){
 return <ol className="yu-bubble-transcript" aria-label="Comic dialogue">{bubbles.map(b=><li key={b.id}>{b.speaker} {b.kind==='thought'?'thinks':'says'}: {b.text}</li>)}</ol>;
}
export default function StoryBubbleLayer({bubbles,width=900,height=1350}:{bubbles:ComicBubble[];width?:number;height?:number}){
 const layouts=bubbles.map(b=>{try{return {bubble:b,layout:computeBubbleLayout(comicBubbleSchema.parse(b),width,height)};}catch{return {bubble:b,layout:null};}});
 return <><svg className="yu-bubble-layer" viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
  {layouts.map(({bubble:b,layout:l})=>l&&<g key={b.id} data-bubble-id={b.id} data-bubble-kind={b.kind} fill="#fffefa" stroke="#17232c" strokeWidth={l.strokeWidth} strokeLinejoin="round">
   {l.tailPath&&<path className="yu-bubble-tail" d={l.tailPath}/>}
   {l.circles.map((c,i)=><circle key={i} cx={c.x} cy={c.y} r={c.r}/>)}
   <path className="yu-bubble-body" d={l.path}/>
   {l.lines.map((line,i)=><text key={i} x={line.x} y={line.y} fill="#17232c" stroke="none" fontFamily={comicBubbleFontFamily} fontSize={l.fontSize} textAnchor="middle" dominantBaseline="middle" textLength={line.width} lengthAdjust="spacingAndGlyphs">{line.text}</text>)}
  </g>)}
 </svg>{layouts.some(l=>!l.layout)&&<p className="yu-bubble-render-error" role="alert">This saved page has invalid balloon data. Its dialogue is available in the storyboard.</p>}</>;
}

type ArtworkProps={image:string;bubbles:ComicBubble[];alt:string;reload?:number;onLoad?:(image:string)=>void;onError?:()=>void;children?:React.ReactNode;embedded?:boolean};
export function StoryBubbleArtwork({image,bubbles,alt,reload=0,onLoad,onError,children,embedded=false}:ArtworkProps){
 const slot=useRef<HTMLDivElement>(null),[size,setSize]=useState({width:900,height:1350}),[available,setAvailable]=useState({width:0,height:0});
 useEffect(()=>{const element=slot.current;if(!element)return;const observer=new ResizeObserver(entries=>{const r=entries[0].contentRect;setAvailable({width:r.width,height:r.height});});observer.observe(element);return ()=>observer.disconnect();},[]);
 const scale=Math.min(available.width/size.width,available.height/size.height);
 return <div className="yu-comic-art-slot" ref={slot}><div className="yu-comic-art" style={{width:scale?size.width*scale:'100%',height:scale?size.height*scale:'100%'}}>
  {image&&<img key={image+'-'+reload} className="yu-comic-image" src={image} alt={alt} draggable={false} onError={onError} onLoad={e=>{setSize({width:e.currentTarget.naturalWidth||900,height:e.currentTarget.naturalHeight||1350});onLoad?.(image);}}/>}
  {!embedded&&<StoryBubbleLayer bubbles={bubbles} width={size.width} height={size.height}/>}{children}
 </div></div>;
}
