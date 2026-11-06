// Render shared comic lettering and attached balloons with artwork-derived colours.
// Multi-panel pages and the optional editor consume the same shapes; speaker names stay in transcripts.
import {useEffect,useRef,useState} from 'react';
import {comicBubbleSchema,type ComicBubble} from '@/lib/reader-bubbles';
import {computeBubbleLayout,comicBubbleFontFamily} from '@/lib/comic-bubble-layout';
import {ensureComicBubbleFont} from '@/lib/comic-bubble-font';
import {defaultComicBubblePalette,sampleComicBubblePalette,type ComicBubblePalette} from '@/lib/comic-bubble-palette';
import './story-bubbles.css';

export function BubbleTranscript({bubbles}:{bubbles:ComicBubble[]}){
 return <ol className="yu-bubble-transcript" aria-label="Comic dialogue">{bubbles.map(b=><li key={b.id}>{b.speaker} {b.kind==='thought'?'thinks':'says'}: {b.text}</li>)}</ol>;
}
export function useComicFont(){
 const [ready,setReady]=useState(typeof document==='undefined'),[error,setError]=useState('');
 useEffect(()=>{let live=true;void ensureComicBubbleFont().then(()=>{if(live)setReady(true);}).catch(()=>{if(live)setError('The bundled comic font could not load. Reload this page.');});return ()=>{live=false;};},[]);
 return {ready,error};
}
type LayerProps={bubbles:ComicBubble[];width?:number;height?:number;referenceWidth?:number;referenceHeight?:number;palette?:ComicBubblePalette};
function layoutsFor({bubbles,width=900,height=1350,referenceWidth=900,referenceHeight=1350}:LayerProps){return bubbles.map(b=>{try{return {bubble:b,layout:computeBubbleLayout(comicBubbleSchema.parse(b),width,height,{referenceWidth,referenceHeight})};}catch{return {bubble:b,layout:null};}});}
export function ComicBubbleShapes(props:LayerProps){
 const palette=props.palette||defaultComicBubblePalette;
 return <>{layoutsFor(props).map(({bubble:b,layout:l})=>l&&<g key={b.id} data-bubble-id={b.id} data-bubble-kind={b.kind} fill={palette.fill} stroke={palette.stroke} strokeWidth={l.strokeWidth} strokeLinejoin="round">
   {l.tailPath&&<path className="yu-bubble-tail" d={l.tailPath}/>}
   {l.circles.map((c,i)=><circle key={i} cx={c.x} cy={c.y} r={c.r}/>)}
   <path className="yu-bubble-body" d={l.path}/>
   {l.lines.map((line,i)=><text key={i} x={line.x} y={line.y} fill={palette.ink} stroke="none" fontFamily={comicBubbleFontFamily} fontWeight={700} style={{fontKerning:'none'}} fontSize={l.fontSize} textAnchor="middle" dominantBaseline="middle">{line.text}</text>)}
  </g>)}</>;
}
export default function StoryBubbleLayer(props:LayerProps){
 const {width=900,height=1350}=props,{ready,error}=useComicFont();
 if(error)return <p className="yu-bubble-render-error" role="alert">{error}</p>;
 return <><svg className="yu-bubble-layer" viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false" style={{visibility:ready?'visible':'hidden'}}><ComicBubbleShapes {...props}/></svg>{layoutsFor(props).some(l=>!l.layout)&&<p className="yu-bubble-render-error" role="alert">This saved page has invalid balloon data. Its dialogue is available in the storyboard.</p>}</>;
}

type ArtworkProps={image:string;bubbles:ComicBubble[];alt:string;reload?:number;onLoad?:(image:string)=>void;onError?:()=>void;children?:React.ReactNode;embedded?:boolean};
export function StoryBubbleArtwork({image,bubbles,alt,reload=0,onLoad,onError,children,embedded=false}:ArtworkProps){
 const slot=useRef<HTMLDivElement>(null),[size,setSize]=useState({width:900,height:1350}),[available,setAvailable]=useState({width:0,height:0}),[palette,setPalette]=useState(defaultComicBubblePalette);
 useEffect(()=>{const element=slot.current;if(!element)return;const observer=new ResizeObserver(entries=>{const r=entries[0].contentRect;setAvailable({width:r.width,height:r.height});});observer.observe(element);return ()=>observer.disconnect();},[]);
 const scale=Math.min(available.width/size.width,available.height/size.height);
 return <div className="yu-comic-art-slot" ref={slot}><div className="yu-comic-art" style={{width:scale?size.width*scale:'100%',height:scale?size.height*scale:'100%'}}>
  {image&&<img key={image+'-'+reload} className="yu-comic-image" src={image} alt={alt} draggable={false} onError={onError} onLoad={e=>{setSize({width:e.currentTarget.naturalWidth||900,height:e.currentTarget.naturalHeight||1350});setPalette(sampleComicBubblePalette(e.currentTarget,document.createElement('canvas')));onLoad?.(image);}}/>}
  {!embedded&&<StoryBubbleLayer bubbles={bubbles} width={size.width} height={size.height} palette={palette}/>}{children}
 </div></div>;
}
