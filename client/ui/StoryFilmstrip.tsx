// Turn shared comic sheets while canonical source-frame progress remains unchanged.
// Drag offsets update only the strip; protected artwork and lettering share publication-aware production geometry.
import {memo,useEffect,useRef} from 'react';
import type {Page} from '@/lib/content';
import type {ComicPage} from '@/lib/comic-page-layout';
import {useDragOffset,type DragOffset} from './useDragOffset';
import StoryComicPage,{type ComicImageInfo} from './StoryComicPage';

type Props={watermarkFontSize?:number;pages:Page[];layouts:ComicPage[];comicPage:number;selectedFrame:number;images:Record<string,ComicImageInfo>;drag:DragOffset;reloads:Record<string,number>;onImageError:(index:number,image:string)=>void;onImageLoad:(image:string)=>void};
export default memo(function StoryFilmstrip({pages,layouts,comicPage,selectedFrame,images,drag,reloads,onImageError,onImageLoad,watermarkFontSize}:Props){
 const offset=useDragOffset(drag),strip=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const reader=strip.current?.parentElement,header=reader?.querySelector<HTMLElement>('.yu-reader-top'),footer=reader?.querySelector<HTMLElement>('.yu-reader-bottom');if(!reader||!header||!footer)return;
  const measure=()=>{const r=reader.getBoundingClientRect(),h=header.getBoundingClientRect(),f=footer.getBoundingClientRect(),hidden=reader.classList.contains('yu-metadata-hidden'),top=Math.max(0,h.bottom-r.top+8),bottom=Math.max(0,r.bottom-f.top+10);reader.style.setProperty('--yu-comic-header',top+'px');reader.style.setProperty('--yu-comic-footer',bottom+'px');const width=Math.max(1,Math.min(r.width-(hidden?24:window.innerWidth<=540?0:36),(r.height-(hidden?12:top)-(hidden?18:bottom))*2/3));reader.style.setProperty('--yu-comic-sheet-width',width+'px');reader.style.setProperty('--yu-comic-sheet-height',width*1.5+'px');};
  const observer=new ResizeObserver(measure),classes=new MutationObserver(measure);observer.observe(reader);observer.observe(header);observer.observe(footer);classes.observe(reader,{attributes:true,attributeFilter:['class']});measure();return ()=>{observer.disconnect();classes.disconnect();};
 },[]);
 return <div className="yu-comic-filmstrip" ref={strip} style={{transform:`translateX(calc(${-comicPage*100}% + ${offset}px))`,transition:offset?'none':undefined}}>
  {layouts.map(layout=><div key={layout.index} className="yu-comic-film-page" aria-hidden={layout.index!==comicPage}><StoryComicPage watermarkFontSize={watermarkFontSize} frames={pages} layout={layout} selectedFrame={selectedFrame} images={images} reloads={reloads} onImageError={onImageError} onImageLoad={onImageLoad}/></div>)}
 </div>;
});
