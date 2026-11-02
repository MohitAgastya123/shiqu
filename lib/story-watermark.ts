// Stamp export pixels only; bounded visible names stay readable while full credits travel in metadata.
import type {Story} from './content';
import {publicationCredit} from './story-publication.ts';

export function watermarkCredit(story:Story){
 const name=Array.from(story.publication?.author||'未署名');
 return publicationCredit({...story,publication:{author:name.slice(0,18).join('')+(name.length>18?'…':''),workUrl:'',contact:'',sourceNote:'',reuse:''}}).replace(/^制作：/,'');
}
export function drawStoryWatermarks(ctx:CanvasRenderingContext2D,width:number,height:number,story:Story){
 const text=watermarkCredit(story),family='"PingFang SC", "Microsoft YaHei", sans-serif';
 ctx.save();ctx.font=`300 12px ${family}`;ctx.textAlign='right';ctx.textBaseline='bottom';ctx.shadowColor='rgba(0,0,0,.5)';ctx.shadowBlur=3;ctx.shadowOffsetY=1;ctx.fillStyle='rgba(255,250,239,.75)';ctx.fillText(text,width-width*.03,height-width*.03);ctx.restore();
}
