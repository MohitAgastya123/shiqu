// English product text and generation contracts; canonical source evidence remains unchanged.
// Share export rendering across browser and CLI. Platform adapters own only image/canvas IO;
// layouts, credits, watermark drawing, archive rules and metadata stay in the existing exporters.
// Explicit font readiness keeps browser exports on the same bundled comic face as native exports.
import {ensureComicBubbleFont} from './comic-bubble-font.ts';
export type ExportCanvas={width:number;height:number;getContext:(kind:'2d')=>CanvasRenderingContext2D|null;toBlob:(callback:(blob:Blob|null)=>void,type?:string,quality?:number)=>void};
export type ExportImage={value:CanvasImageSource;width:number;height:number};
export type ExportRuntime={ready:()=>Promise<unknown>;canvas:()=>ExportCanvas;read:(url:string,page:number)=>Promise<Blob>;image:<T>(blob:Blob,work:(image:ExportImage)=>Promise<T>|T)=>Promise<T>};
export function browserExportRuntime():ExportRuntime{
 return {
  ready:async()=>{await ensureComicBubbleFont();await document.fonts?.ready;},
  canvas:()=>document.createElement('canvas'),
  read:async(source,page)=>{
   const url=new URL(source,location.origin);if(url.origin!==location.origin)throw Error('The image source is unavailable for export.');
   const response=await fetch(url.href,{credentials:'same-origin',signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw Error(`Frame ${page+1} could not be read. Check your connection and retry.`);
   const blob=await response.blob();if(!/^image\/(png|jpeg|webp)(;|$)/.test(blob.type)||!blob.size)throw Error(`Frame ${page+1} is unavailable.`);return blob;
  },
  image:async(blob,work)=>{const image=new Image(),url=URL.createObjectURL(blob);try{image.src=url;await image.decode();if(!image.naturalWidth||!image.naturalHeight)throw Error('INVALID_IMAGE');return await work({value:image,width:image.naturalWidth,height:image.naturalHeight});}finally{image.src='';URL.revokeObjectURL(url);}},
 };
}
