// Derive restrained artwork-toned paper and balloon ink from the same small source-image sample.
// Sampling happens before overlays; opaque pastel fills keep lettering strongly contrasted offline.
import type {ExportCanvas} from './story-export-runtime.ts';
export type ComicBubblePalette={fill:string;ink:string;stroke:string;paper:string};
export const defaultComicBubblePalette:ComicBubblePalette={fill:'#fff9e9',ink:'#28231e',stroke:'#433c32',paper:'#f7f1e4'};
const hex=(rgb:number[])=>'#'+rgb.map(n=>Math.round(n).toString(16).padStart(2,'0')).join('');
export function comicBubblePaletteFromPixels(pixels:ArrayLike<number>):ComicBubblePalette{
 const buckets=new Map<string,{count:number;rgb:number[]}>();
 for(let i=0;i+3<pixels.length;i+=4){const rgb=[pixels[i],pixels[i+1],pixels[i+2]];if(pixels[i+3]<128||rgb.some(n=>!Number.isFinite(n)||n<0||n>255))continue;
  const key=rgb.map(n=>Math.floor(n/32)).join(','),value=buckets.get(key)||{count:0,rgb:[0,0,0]};value.count++;rgb.forEach((n,c)=>value.rgb[c]+=n);buckets.set(key,value);
 }
 const dominant=[...buckets.values()].sort((a,b)=>b.count-a.count)[0];if(!dominant)return {...defaultComicBubblePalette};
 const tone=dominant.rgb.map(n=>n/dominant.count),fill=tone.map(n=>255*.88+n*.12),ink=tone.map(n=>24+n*.055),stroke=tone.map(n=>36+n*.1),paper=tone.map(n=>248*.9+n*.1);
 return {fill:hex(fill),ink:hex(ink),stroke:hex(stroke),paper:hex(paper)};
}
export function sampleComicBubblePalette(image:CanvasImageSource,canvas:ExportCanvas):ComicBubblePalette{
 canvas.width=32;canvas.height=32;
 try{const ctx=canvas.getContext('2d');if(!ctx)return {...defaultComicBubblePalette};ctx.drawImage(image,0,0,32,32);return comicBubblePaletteFromPixels(ctx.getImageData(0,0,32,32).data);}
 catch{return {...defaultComicBubblePalette};}
 finally{canvas.width=0;canvas.height=0;}
}
