// Match complete cited originals in small batches; binary receipts never contain a synopsis.
import {z} from 'zod';
import {promptSections,inputBoundaryDirection} from './reader-prompts.ts';
export const themeMatchBatchSize=4;
export const themeMatchModel='gpt-6-luna';
export const themeMatchEffort='low' as const;
export const themeStorySchema=z.object({id:z.string().regex(/^[a-f0-9]{64}$/),title:z.string().min(1).max(100),text:z.string().trim().min(1)}).strict();
export type ThemeStory=z.infer<typeof themeStorySchema>;
export const themeDecisionSchema=z.object({id:z.string().regex(/^[a-f0-9]{64}$/),verdict:z.enum(['yes','no']),reason:z.string().trim().min(1).max(120)}).strict();
export const themeMatchesSchema=z.object({matches:z.array(themeDecisionSchema).max(themeMatchBatchSize)}).strict();
export type ThemeMatches=z.infer<typeof themeMatchesSchema>;
export const themeMatchContract='original-binary-v1';
export const themeMatchJson={type:'object',properties:{matches:{type:'array',minItems:0,maxItems:themeMatchBatchSize,items:{type:'object',properties:{id:{type:'integer',minimum:1,maximum:4},reason:{type:'string',minLength:1,maxLength:120},verdict:{type:'string',enum:['yes','no']}},required:['id','reason','verdict'],additionalProperties:false}}},required:['matches'],additionalProperties:false};
export const themeMatchOutputTokens=(_count:number)=>2048;
export const themeMatchPrompt=promptSections(
 ['任务','逐篇完整阅读所附text原文，判断是否符合theme，不重新划分或改写故事，不生成摘要。每个输入批内短编号id原样返回一次，不新增、遗漏或重复；各篇独立判断。'],
 ['原文依据','只依据本篇原文已有事件、行动、关系和结果判断，不用记忆补情节，不依靠标题猜主题。原文有明确依据支持主题返回yes，缺乏主题依据返回no；不要把普通争执自动等同于成长、和解或永久错过。宽泛的“原典故事”“忠于原文”等选题意图可接受真实完整故事，不额外强加寓意。'],
 ['输出','只返回matches，每篇包含id、reason（一句具体原文依据，最多120字）、verdict(yes或no)，先给依据再判定。不返回review、summary、故事重述或制作建议。'],
 ['输入与输出',inputBoundaryDirection]);
export function themeMatchPayload(theme:string,stories:ThemeStory[]){
 z.string().max(100).parse(theme);z.array(themeStorySchema).min(1).max(themeMatchBatchSize).parse(stories);
 return {stories:stories.map((story,index)=>({id:index+1,title:story.title,text:story.text})),theme};
}
// Keep individually valid receipts even when another entry is missing, duplicated, or malformed.
export function parseThemeMatches(value:unknown,stories:ThemeStory[]):ThemeMatches{
 const raw=z.object({matches:z.array(z.unknown()).max(32)}).parse(value),counts=new Map<unknown,number>();
 for(const item of raw.matches){const id=(item as {id?:unknown})?.id;counts.set(id,(counts.get(id)||0)+1);}
 const matches:ThemeMatches['matches']=[];
 for(const item of raw.matches){
  const parsed=z.object({id:z.number().int().min(1).max(stories.length),reason:z.string().trim().min(1).max(120),verdict:z.enum(['yes','no'])}).strict().safeParse(item);
  if(parsed.success&&counts.get(parsed.data.id)===1){const {id,...decision}=parsed.data;matches.push({id:stories[id-1].id,...decision});}
 }
 return {matches};
}
