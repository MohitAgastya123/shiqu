// Display protected-aware production art transforms, clipping and compact text bands in every reader surface.
// Phone zoom and ordered transcripts expose full-size reading without changing source-frame indices.
import {useEffect,useId,useRef,useState} from 'react';
import type {Page} from '@/lib/content';
import {comicPageWidth,comicPageHeight,layoutComicPanel,type ComicPage} from '@/lib/comic-page-layout';
import {comicBubbleFontFamily} from '@/lib/comic-bubble-layout';
import {defaultComicBubblePalette,sampleComicBubblePalette,type ComicBubblePalette} from '@/lib/comic-bubble-palette';
import {ComicBubbleShapes,useComicFont} from './StoryBubbleLayer';
import Sheet from './StorySheet';
import './comic-pages.css';

export type ComicImageInfo={width:number;height:number;palette:ComicBubblePalette};
export function useComicImages(frames:Page[],reloads:Record<string,number>){
 const [images,setImages]=useState<Record<string,ComicImageInfo>>({});
 const signature=JSON.stringify(frames.map(frame=>[frame.image,reloads[frame.image]||0]));
 useEffect(()=>{let live=true;const pending:HTMLImageElement[]=[];
  for(const [source]of JSON.parse(signature) as [string,number][]){if(!source)continue;const image=new Image();pending.push(image);image.onload=()=>{if(!live)return;const info={width:image.naturalWidth||900,height:image.naturalHeight||1350,palette:sampleComicBubblePalette(image,document.createElement('canvas'))};setImages(old=>({...old,[source]:info}));};image.src=source;}
  return ()=>{live=false;for(const image of pending){image.onload=null;image.src='';}};
 },[signature]);return images;
}
type Props={watermarkFontSize?:number;frames:Page[];layout:ComicPage;selectedFrame:number;images:Record<string,ComicImageInfo>;reloads:Record<string,number>;onImageError:(index:number,image:string)=>void;onImageLoad:(image:string)=>void};
export default function StoryComicPage({frames,layout,selectedFrame,images,reloads,onImageError,onImageLoad,watermarkFontSize}:Props){
 const clipPrefix='comic-'+useId().replace(/[^a-zA-Z0-9_-]/g,''),{ready,error}=useComicFont(),[failed,setFailed]=useState<Record<string,boolean>>({}),reloadKey=JSON.stringify(reloads);
 useEffect(()=>{setFailed({});},[reloadKey]);
 if(error)return <p className="yu-comic-load-error" role="alert">{error}</p>;
 return <div className="yu-comic-sheet" data-comic-page={layout.index}>
  {!ready&&<p className="yu-comic-lettering-loading" role="status">Preparing comic lettering…</p>}
  <svg viewBox={`0 0 ${comicPageWidth} ${comicPageHeight}`} className="yu-comic-page-svg" aria-hidden="true" focusable="false" style={{visibility:ready?'visible':'hidden'}}>
   <rect width={comicPageWidth} height={comicPageHeight} fill={images[frames[layout.panels[0]?.frameIndex]?.image]?.palette.paper||defaultComicBubblePalette.paper}/>
   {layout.panels.map(panel=>{const frame=frames[panel.frameIndex],info=images[frame.image],p=layoutComicPanel(frame,panel,info,{watermarkFontSize}),palette=info?.palette||defaultComicBubblePalette;return <g key={panel.frameIndex} data-panel-index={panel.frameIndex} data-panel-span={panel.span} data-selected={panel.frameIndex===selectedFrame?'true':'false'}>
    <rect x={p.rect.x} y={p.rect.y} width={p.rect.width} height={p.rect.height} fill={palette.paper}/>
    <defs><clipPath id={`${clipPrefix}-${panel.frameIndex}`}><rect x={p.artViewport.x} y={p.artViewport.y} width={p.artViewport.width} height={p.artViewport.height}/></clipPath></defs>
    {frame.image&&!failed[frame.image]?<image key={frame.image+'-'+(reloads[frame.image]||0)} href={frame.image} x={p.art.x} y={p.art.y} width={p.art.width} height={p.art.height} preserveAspectRatio="none" clipPath={`url(#${clipPrefix}-${panel.frameIndex})`} data-art-cropped={p.cropped?'true':'false'} onError={()=>{setFailed(old=>({...old,[frame.image]:true}));onImageError(panel.frameIndex,frame.image);}} onLoad={()=>onImageLoad(frame.image)}/>:<><rect x={p.artViewport.x} y={p.artViewport.y} width={p.artViewport.width} height={p.artViewport.height} fill={palette.fill}/><text x={p.artViewport.x+p.artViewport.width/2} y={p.artViewport.y+35} fill={palette.ink} textAnchor="middle" fontFamily={comicBubbleFontFamily} fontWeight={700} fontSize={24}>PANEL {panel.frameIndex+1} · {frame.image?'IMAGE UNAVAILABLE':'DRAWING'}</text></>}
    {p.letteringBand&&<rect className="yu-comic-lettering-band" x={p.letteringBand.x} y={p.letteringBand.y} width={p.letteringBand.width} height={p.letteringBand.height} fill={palette.fill}/>}
    {p.captionLines.length>0&&<rect className="yu-comic-caption-strip" x={p.rect.x+1} y={p.narration.y-7} width={p.rect.width-2} height={p.narration.height+14} fill={palette.fill} stroke={palette.stroke} strokeWidth={1}/>}
    <g transform={`translate(${p.rect.x} ${p.rect.y})`}><ComicBubbleShapes bubbles={p.bubbles} width={p.rect.width} height={p.rect.height} referenceWidth={p.bubbleReference.width} referenceHeight={p.bubbleReference.height} palette={palette}/></g>
    {p.captionLines.map((line,i)=><text key={i} className="yu-comic-narration" x={line.x} y={line.y} dominantBaseline="text-before-edge" fontFamily={comicBubbleFontFamily} fontWeight={700} style={{fontKerning:'none'}} fontSize={p.captionFontSize} fill={palette.ink}>{line.text}</text>)}
    <rect x={p.rect.x} y={p.rect.y} width={p.rect.width} height={p.rect.height} fill="none" stroke={palette.stroke} strokeWidth={2}/>
    {selectedFrame!==layout.panels[0].frameIndex&&panel.frameIndex===selectedFrame&&<rect x={p.rect.x+3} y={p.rect.y+3} width={p.rect.width-6} height={p.rect.height-6} fill="none" stroke="#a67828" strokeWidth={3} strokeDasharray="8 5"/>}
   </g>;})}
  </svg>
 </div>;
}
export function ComicPageTranscript({frames,layout}:{frames:Page[];layout:ComicPage}){
 return <ol className="yu-comic-transcript" aria-label={`Comic page ${layout.index+1} transcript`}>{layout.panels.map(panel=>{const frame=frames[panel.frameIndex];return <li key={panel.frameIndex}><h4>Panel {panel.frameIndex+1}</h4>{frame.caption&&<p>{frame.caption}</p>}{frame.bubbles?.map(b=><p key={b.id}><strong>{b.speaker} {b.kind==='thought'?'thinks':'says'}:</strong> {b.text}</p>)}{!frame.image&&<p>Illustration is still being drawn.</p>}{!frame.caption&&!frame.bubbles?.length&&<p>A silent scene.</p>}</li>;})}</ol>;
}
export function StoryComicZoom(props:Props&{onClose:()=>void;initialScale?:number}){
 const [scale,setScale]=useState(props.initialScale||1),viewport=useRef<HTMLDivElement>(null),initial=useRef(props);
 // Position only once after the native dialog opens; later panning and scale changes stay with the reader.
 useEffect(()=>{const id=requestAnimationFrame(()=>{const element=viewport.current,p=initial.current,panel=p.layout.panels.find(panel=>panel.frameIndex===p.selectedFrame)||p.layout.panels[0];if(!element||!panel)return;const frame=p.frames[panel.frameIndex],layout=layoutComicPanel(frame,panel,p.images[frame.image],{watermarkFontSize:p.watermarkFontSize}),size=p.initialScale||1;element.scrollTo({left:Math.max(0,(layout.art.x+layout.art.width/2)*size-element.clientWidth/2),top:Math.max(0,layout.rect.y*size-12),behavior:'instant'});});return ()=>cancelAnimationFrame(id);},[]);
 return <Sheet title={`Comic page ${props.layout.index+1} — zoom`} onClose={props.onClose}><div className="yu-comic-zoom">
  <div className="yu-comic-zoom-tools" role="group" aria-label="Comic page zoom"><button type="button" disabled={scale<=.5} onClick={()=>setScale(value=>Math.max(.5,value-.25))}>Zoom out</button><output aria-live="polite">{Math.round(scale*100)}%</output><button type="button" disabled={scale>=2} onClick={()=>setScale(value=>Math.min(2,value+.25))}>Zoom in</button><button type="button" onClick={()=>setScale(Math.min(1,(viewport.current?.clientWidth||900)/comicPageWidth))}>Fit page</button></div>
  <p>Scroll or pan to explore. At 100%, lettering is shown at its full reading size.</p>
  <div className="yu-comic-zoom-viewport" ref={viewport} tabIndex={0} aria-label="Zoomed comic page. Scroll to pan."><div style={{width:comicPageWidth*scale,height:comicPageHeight*scale}}><StoryComicPage {...props}/></div></div>
  <details className="yu-comic-readable-transcript"><summary>Read page transcript</summary><ComicPageTranscript frames={props.frames} layout={props.layout}/></details>
 </div></Sheet>;
}
