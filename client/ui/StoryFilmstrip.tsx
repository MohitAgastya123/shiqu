// Slide the reader's frames as one strip; swipe offsets re-render only this strip, never Reader.
// Frames are memoized on primitive props, so drags, polling snapshots and toasts do not rebuild every image.
// Balloon pages preserve the full artwork and fit the shared SVG overlay outside narration and controls.
import {memo,useEffect,useRef} from 'react';
import type {Page} from '@/lib/content';
import {useDragOffset,type DragOffset} from './useDragOffset';
import {StoryBubbleArtwork,BubbleTranscript} from './StoryBubbleLayer';
import type {ComicBubble} from '@/lib/reader-bubbles';

type FrameProps={index:number;image:string;alt:string;current:boolean;reload:number;bubbleJson:string;embedded:boolean;onError:(index:number,image:string)=>void;onLoad:(image:string)=>void};
const FilmFrame=memo(function FilmFrame({index,image,alt,current,reload,bubbleJson,embedded,onError,onLoad}:FrameProps){
 const bubbles=JSON.parse(bubbleJson) as ComicBubble[];
 if(bubbles.length)return <div className="yu-film-frame yu-film-comic" aria-hidden={!current}><StoryBubbleArtwork image={image} bubbles={bubbles} alt={alt} reload={reload} embedded={embedded} onError={()=>onError(index,image)} onLoad={onLoad}/>{current&&<BubbleTranscript bubbles={bubbles}/>}</div>;
 return <div className="yu-film-frame">{image&&<img key={image+'-'+reload} onError={()=>onError(index,image)} onLoad={()=>onLoad(image)} className={'yu-scene '+(current?'is-current':'')} src={image} alt={alt} draggable={false}/>}</div>;
});

type Props={pages:Page[];page:number;drag:DragOffset;reloads:Record<string,number>;onImageError:(index:number,image:string)=>void;onImageLoad:(image:string)=>void};
export default memo(function StoryFilmstrip({pages,page,drag,reloads,onImageError,onImageLoad}:Props){
 const offset=useDragOffset(drag),strip=useRef<HTMLDivElement>(null),comic=!!pages[page]?.bubbles?.length;
 useEffect(()=>{
  const reader=strip.current?.parentElement;if(!reader||!comic)return;
  const header=reader.querySelector<HTMLElement>('.yu-reader-top'),caption=reader.querySelector<HTMLElement>('.yu-scene-caption');if(!header||!caption)return;
  const measure=()=>{const r=reader.getBoundingClientRect(),h=header.getBoundingClientRect(),c=caption.getBoundingClientRect();reader.style.setProperty('--yu-comic-top',Math.max(0,h.bottom-r.top+8)+'px');reader.style.setProperty('--yu-comic-bottom',Math.max(0,r.bottom-c.top+8)+'px');};
  const observer=new ResizeObserver(measure);observer.observe(reader);observer.observe(header);observer.observe(caption);measure();return ()=>observer.disconnect();
 },[page,comic]);
 return <div className="yu-filmstrip" ref={strip} style={{transform:`translateX(calc(${-page*100}% + ${offset}px))`,transition:offset?'none':undefined}}>
  {pages.map((p,i)=><FilmFrame key={i} index={i} image={p.image} alt={i===page?p.caption:''} current={i===page} reload={reloads[p.image]||0} bubbleJson={JSON.stringify(p.bubbles||[])} embedded={p.bubbleRendering==='embedded'} onError={onImageError} onLoad={onImageLoad}/>)}
 </div>;
});
