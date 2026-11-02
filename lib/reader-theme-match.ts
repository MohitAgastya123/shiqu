// Match complete cited originals in small batches; binary receipts never contain a synopsis.
import {z} from 'zod';
import {promptSections,inputBoundaryDirection} from './reader-prompts.ts';
export const themeMatchBatchSize=4;
export const themeMatchModel='gpt-6-luna';
export const themeMatchEffort='low' as const;
export const themeStorySchema=z.object({id:z.string().regex(/^[a-f0-9]{64}$/),title:z.string().min(1).max(100),text:z.string().trim().min(1)}).strict();
export type ThemeStory=z.infer<typeof themeStorySchema>;
export const themeDecisionSchema=z.object({id:z.string().regex(/^[a-f0-9]{64}$/),verdict:z.enum(['yes','no']),reason:z.string().trim().min(1).max(120)}).strict();
export const themeMatchesSchema=z.object({matches:z.array(themeDecisionSchema).min(1).max(themeMatchBatchSize)}).strict();
export type ThemeMatches=z.infer<typeof themeMatchesSchema>;
export const themeMatchJson={type:'object',properties:{matches:{type:'array',minItems:1,maxItems:themeMatchBatchSize,items:{type:'object',properties:{id:{type:'string',minLength:64,maxLength:64},verdict:{type:'string',enum:['yes','no']},reason:{type:'string',minLength:1,maxLength:120}},required:['id','verdict','reason'],additionalProperties:false}}},required:['matches'],additionalProperties:false};
export const themeMatchOutputTokens=(_count:number)=>2048;
export const themeMatchPrompt=promptSections(
 ['任务','逐篇完整阅读所附text原文，判断是否符合theme，不重新划分或改写故事，不生成摘要。每个输入id原样返回一次，不新增、遗漏或重复；各篇独立判断。'],
 ['原文依据','只依据本篇原文已有事件、行动、关系和结果判断，不用记忆补情节，不依靠标题猜主题。原文有明确依据支持主题返回yes，缺乏主题依据返回no；不要把普通争执自动等同于成长、和解或永久错过。宽泛的“原典故事”“忠于原文”等选题意图可接受真实完整故事，不额外强加寓意。'],
 ['输出','只返回matches，每篇包含id、verdict(yes或no)、reason（一句具体原文依据，最多120字）。不返回review、summary、故事重述或制作建议。'],
 ['输入与输出',inputBoundaryDirection]);
export function themeMatchPayload(theme:string,stories:ThemeStory[]){return z.object({theme:z.string().max(100),stories:z.array(themeStorySchema).min(1).max(themeMatchBatchSize)}).parse({theme,stories});}
