// English product text and generation contracts; canonical source evidence remains unchanged.
// Stamp export pixels only; bounded visible names stay readable while full credits travel in metadata.
import type {Story} from './content';
import {publicationCredit,watermarkFontSize} from './story-publication.ts';

export function watermarkCredit(story:Story){
 const name=Array.from(story.publication?.author||'Uncredited');
 return publicationCredit({...story,publication:{author:name.slice(0,18).join('')+(name.length>18?'…':''),workUrl:'',contact:'',sourceNote:'',reuse:''}}).replace(/^Created by: /,'');
}
export function drawStoryWatermarks(ctx:CanvasRenderingContext2D,width:number,height:number,story:Story){
 const text=watermarkCredit(story),family='"PingFang SC", "Microsoft YaHei", sans-serif';
 const size=story.publication?.watermarkFontSize??watermarkFontSize.default;
 ctx.save();ctx.font=`300 ${size}px ${family}`;ctx.textAlign='right';ctx.textBaseline='bottom';ctx.shadowColor='rgba(0,0,0,.5)';ctx.shadowBlur=3;ctx.shadowOffsetY=1;ctx.fillStyle='rgba(255,250,239,.75)';ctx.fillText(text,width-width*.03,height-width*.03,width*.94);ctx.restore();
}
