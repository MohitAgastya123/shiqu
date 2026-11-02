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
export const editorialAuditDirection=`原文与分镜双向核对：先独立从完整原文确定主事件边界、改变关系的言行、承受者的回应、有独立作用的停顿与自然结果，再检查实际分镜；不要先看幅数再凑清单，也不把摘要、旧提纲或作者自写的覆盖说明当成正确答案。逐项区分“配文提到了”“画面真正承担了”“先后过程得到展开”：一句配文包含整场戏，或画面只在表现无关传饭、站姿，不能自证这场戏已经讲出。简短可合并次要内容，但关键因果/结果仍须保留；适中保留关键人物关系；详细展开有依据的动作、反应及停顿，不逐字配图、不用重复姿态拉长。
返回 coverage（1–32项，按主事件的实际复杂度决定，不为凑数）：每项 quote 是所给原文中连续、可定位的短引，不能概括或拼接；task 说明这段言行、回应、停顿或结果的独立叙事作用；pages 列实际承担任务的幅号，整段缺失则为空；assessment 为 adequate 或 needs-change；reason 说明充分或实质损失的依据；充分项 issuePage=0，需改项 issuePage 指向对应 issues 的问题幅号。覆盖关键因果与人物戏，省略重复论证和无关支线。引用允许简繁、标点与空白差别，不得改字、意译或用省略号拼接。需改项必须报告具体问题和可执行修法，不能靠多列覆盖项通过。
按故事顺序逐对连读全部画幅，包括批次边界：比较主要动作、接触、视线、第一焦点、物件持有者与完成状态、时间及已揭示信息。换台词、换论点、换景别或“坐着/端坐”不等于新任务。拿到纸、读纸、带纸离开可以分别成立，连续案旁托纸低头则须核对是否重复；动作已经完成，后幅不能再次“刚刚”完成。停顿允许存在，但必须有原文依据和承接作用。
再反向查每幅的事实、说话者与对象、条件/否定/反问力度、古今异义及必要语境。保持人物判断、内心独白、转述、诗中设想和编造故事的归属，不画成眼前现实。只报告有具体证据的理解、性格、关系或节奏损失；合理压缩不是错误，不强加心理解说或华丽改写。能在原幅修清就局部修，确需拆/合/补重要阶段才标 requiresReplan=true，并说明插入/删除/替换范围及各幅不同任务。`;
