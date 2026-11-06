// English product text and generation contracts; canonical source evidence remains unchanged.
// Match complete cited originals in small batches; binary receipts never contain a synopsis.
import {z} from 'zod';
import {promptSections,inputBoundaryDirection} from './reader-prompts.ts';
export const themeMatchBatchSize=4;
export const themeMatchModel='gpt-6-luna';
export const themeMatchEffort='low' as const;
export const themeStorySchema=z.object({id:z.string().regex(/^[a-f0-9]{64}$/),title:z.string().min(1).max(100),text:z.string().trim().min(1)}).strict();
export type ThemeStory=z.infer<typeof themeStorySchema>;
export const themeDecisionSchema=z.object({id:z.string().regex(/^[a-f0-9]{64}$/),verdict:z.enum(['yes','no']),reason:z.string().trim().min(1).max(480)}).strict();
export const themeMatchesSchema=z.object({matches:z.array(themeDecisionSchema).max(themeMatchBatchSize)}).strict();
export type ThemeMatches=z.infer<typeof themeMatchesSchema>;
export const themeMatchContract='original-binary-en-v2';
export const themeMatchJson={type:'object',properties:{matches:{type:'array',minItems:0,maxItems:themeMatchBatchSize,items:{type:'object',properties:{id:{type:'integer',minimum:1,maximum:4},reason:{type:'string',minLength:1,maxLength:480},verdict:{type:'string',enum:['yes','no']}},required:['id','reason','verdict'],additionalProperties:false}}},required:['matches'],additionalProperties:false};
export const themeMatchOutputTokens=(_count:number)=>2048;
export const themeMatchPrompt=promptSections(
 ['Task','Read every complete supplied text and independently judge theme fit without splitting, rewriting or summarizing stories. Return each batch-local id exactly once, without additions, omissions or duplicates.'],
 ['Source evidence','Judge only from source events, actions, relationships and outcomes; never fill gaps from memory or infer from titles. yes requires clear evidence; otherwise no. Ordinary disagreement is not automatically growth, reconciliation or permanent loss. Broad Source story or Faithful to the source requests accept authentic complete stories without an imposed moral.'],
 ['Output','Return only matches with id, reason (one concrete English sentence, at most 480 characters), and verdict yes/no. Give evidence before verdict. No review, summary, retelling or production advice.'],
 ['Input and output',inputBoundaryDirection]);
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
  const parsed=z.object({id:z.number().int().min(1).max(stories.length),reason:z.string().trim().min(1).max(480),verdict:z.enum(['yes','no'])}).strict().safeParse(item);
  if(parsed.success&&counts.get(parsed.data.id)===1){const {id,...decision}=parsed.data;matches.push({id:stories[id-1].id,...decision});}
 }
 return {matches};
}
