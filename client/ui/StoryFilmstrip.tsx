// Slide the reader's frames as one strip; swipe offsets re-render only this strip, never Reader.
// Frames are memoized on primitive props, so drags, polling snapshots and toasts do not rebuild every image.
import {memo} from 'react';
import type {Page} from '@/lib/content';
import {useDragOffset,type DragOffset} from './useDragOffset';

type FrameProps={index:number;image:string;alt:string;current:boolean;reload:number;onError:(index:number,image:string)=>void;onLoad:(image:string)=>void};
const FilmFrame=memo(function FilmFrame({index,image,alt,current,reload,onError,onLoad}:FrameProps){
 return <div className="yu-film-frame">{image&&<img key={image+'-'+reload} onError={()=>onError(index,image)} onLoad={()=>onLoad(image)} className={'yu-scene '+(current?'is-current':'')} src={image} alt={alt} draggable={false}/>}</div>;
});

type Props={pages:Page[];page:number;drag:DragOffset;reloads:Record<string,number>;onImageError:(index:number,image:string)=>void;onImageLoad:(image:string)=>void};
export default memo(function StoryFilmstrip({pages,page,drag,reloads,onImageError,onImageLoad}:Props){
 const offset=useDragOffset(drag);
 return <div className="yu-filmstrip" style={{transform:`translateX(calc(${-page*100}% + ${offset}px))`,transition:offset?'none':undefined}}>
  {pages.map((p,i)=><FilmFrame key={i} index={i} image={p.image} alt={i===page?p.caption:''} current={i===page} reload={reloads[p.image]||0} onError={onImageError} onLoad={onImageLoad}/>)}
 </div>;
});
