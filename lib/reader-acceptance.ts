// Number story-specific criteria consistently across production, review validation and UI.
// Unknown/conflicting requirements block review; only evidenced failures can request repair.
import {z} from 'zod';
export const acceptanceCriteria=(text='')=>text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
export const acceptancePromptSchema=z.string().max(1200).refine(text=>acceptanceCriteria(text).length<=20,'验收要求最多20条，每行一条。');
export const acceptanceInput=(selection:{acceptancePrompt?:string})=>selection.acceptancePrompt?.trim()?{acceptancePrompt:selection.acceptancePrompt,acceptanceCriteria:acceptanceCriteria(selection.acceptancePrompt)}:{};
export const acceptanceDirection='本篇验收要求由 acceptanceCriteria 按行编号。制作与修订时逐条落实，仍须服从已核原文事实、选定故事、画风、总幅数策略和输出格式。制作要求与验收要求冲突、要求无原文依据的事件或超出文字分镜可判断范围时，审核必须明确指出，不擅自取舍或伪造事实。';
export const acceptanceReviewDirection=acceptanceDirection+'存在验收条目时必须返回 acceptanceResults，按编号逐条且仅一次：criterion 为1起始编号；status 为 passed/failed/unknown；pages 为相关画幅号（结语为0，可无相关幅）；evidence 引用具体配文、画面指令或原文说明判定。failed 必须在 pages 中标出对应 issues 的幅号并提出可执行修订；unknown 用于要求冲突、缺少依据、实际图像等无法从文字分镜判断的要求，evidence 明说原因，不编造可修问题。不得把未知当通过，不得只给总体结论。';
export const acceptanceResultSchema=z.object({criterion:z.number().int().min(1).max(20),status:z.enum(['passed','failed','unknown']),pages:z.array(z.number().int().min(0)).max(80),evidence:z.string().trim().min(1).max(600)}).strict();
export type AcceptanceResult=z.infer<typeof acceptanceResultSchema>;
export const acceptanceResultsJson={type:'array',maxItems:20,items:{type:'object',properties:{criterion:{type:'integer',minimum:1,maximum:20},status:{type:'string',enum:['passed','failed','unknown']},pages:{type:'array',maxItems:80,items:{type:'integer',minimum:0}},evidence:{type:'string',minLength:1,maxLength:600}},required:['criterion','status','pages','evidence'],additionalProperties:false}};
