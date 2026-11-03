// Persist source-to-frame editorial evidence; references are checked against the saved edition.
import {z} from 'zod';
import {Converter} from 'opencc-js';
import type {OriginalSource} from './reader-source-types.ts';
const simplify=Converter({from:'t',to:'cn'});
const normalized=(text:string)=>simplify(text).replaceAll('著','着').replace(/[\p{P}\p{S}\s]/gu,'');
export const editorialCoverageSchema=z.object({
 quote:z.string().trim().min(2).max(120),task:z.string().trim().min(1).max(120),
 pages:z.array(z.number().int().min(1)).max(80),assessment:z.enum(['adequate','needs-change']),
 reason:z.string().trim().min(1).max(180),issuePage:z.number().int().min(0),
});
export type EditorialCoverage=z.infer<typeof editorialCoverageSchema>;
export const editorialCoverageJson=(count:number)=>({type:'array',minItems:1,maxItems:32,items:{type:'object',properties:{
 quote:{type:'string',minLength:2,maxLength:120},task:{type:'string',minLength:1,maxLength:120},
 pages:{type:'array',maxItems:count,items:{type:'integer',minimum:1,maximum:count}},
 assessment:{type:'string',enum:['adequate','needs-change']},reason:{type:'string',minLength:1,maxLength:180},issuePage:{type:'integer',minimum:0,maximum:count},
},required:['quote','task','pages','assessment','reason','issuePage'],additionalProperties:false}});
export function validateEditorialCoverage(coverage:EditorialCoverage[],original:OriginalSource){
 const source=normalized(original.text+'\n'+(original.chapterContext?.text||''));
 for(const item of coverage){const quote=normalized(item.quote);if(quote.length<2||!source.includes(quote))throw Error('EDITORIAL_SOURCE_QUOTE');}
}
export const editorialAuditDirection=`原文与分镜双向核对：按共同标准先找关键任务，再定位caption及prompt中的承担方式；提到整场戏或呈现事后状态不能自证过程已展开。核对核心因果、各人有作用的言行与回应、身体和环境处境及自然结果，不按旧稿已有内容凑清单。
返回coverage：每项quote为原文一个连续可定位短引，允许简繁、标点和空白差别，不改字、意译、拼接或用省略号；task写独立叙事作用，pages列承担幅号，整段缺失则空。assessment=adequate时reason说明如何落实、issuePage=0；needs-change时reason指出实质损失，issuePage指向对应issues。按任务复杂度选1–32项，不以多列覆盖项代替有效核对。`;
