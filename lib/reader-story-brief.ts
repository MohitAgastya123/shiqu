// English product text and generation contracts; canonical source evidence remains unchanged.
// Prepare and audit a verified synopsis; production reads originals without synopsis metadata.
import {z} from 'zod';
import type {OriginalSource} from './reader-source-types.ts';
export const storySummaryDirection="Write a concise, complete English summary in 2–3 sentences, normally 50–100 words. Preserve cause, key actions and actual outcome. Do not pad a simple story; extend only for essential causation. Do not retell every paragraph, stop at the setup or plan, or invent closure for a genuinely open ending.";
export const storySummarySchema=z.string().trim().min(1).max(2400);
export const storyBriefSchema=z.object({summary:storySummarySchema,matchReason:z.string().trim().min(1).max(1200)});
export type StoryBrief=z.infer<typeof storyBriefSchema>;
export type StoryBriefRecord=StoryBrief&{verified:boolean};
export function storyBriefVerified(original:OriginalSource|undefined){return original?.storyBrief?.verified===true&&storyBriefSchema.safeParse(original.storyBrief).success;}
export function assertStoryBriefReady(original:OriginalSource|undefined){
 if(original?.storyBrief&&!storyBriefVerified(original))throw Error('STORY_BRIEF_UNVERIFIED');
}
export function withoutStorySummary<T extends {summary:string}>(story:T){const {summary:_,...rest}=story;void _;return rest;}
export function storyBriefPayload(original:OriginalSource|undefined,allowUnverified=false){
 if(!original?.storyBrief)return {};
 if(!allowUnverified)assertStoryBriefReady(original);
 return {storyBrief:storyBriefSchema.parse(original.storyBrief)};
}
