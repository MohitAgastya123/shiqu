// Recommend pacing and English story guidance from verified source evidence before production.
import {storyRequirementsSchema,storyRequirementsJson,storyRequirementsDirection} from './reader-requirements.ts';
import {promptSections,inputBoundaryDirection,normalizeProductionPrompt,storyScopeDirection,storyOpeningDirection,storyEditorialContext} from './reader-prompts.ts';
import {z} from 'zod';
import {localStoryContextConstraint} from './reader-local-contract.ts';
import {readerMinFrames,readerMaxFrames} from './reader-limits.ts';
import type {Selection} from './reader-model.ts';
import {verifiedOriginalPayload} from './reader-source-types.ts';
import type {OriginalSource} from './reader-source-types.ts';
import {storySummarySchema,storyBriefPayload,storySummaryDirection} from './reader-story-brief.ts';
export const narrativeDetailSchema=z.enum(['brief','balanced','detailed']);
export type NarrativeDetail=z.infer<typeof narrativeDetailSchema>;
export const narrativeDetails=[
 {id:'brief',label:'Brief',description:'Follow the main story and combine secondary details'},
 {id:'balanced',label:'Balanced',description:'Explain causes and consequences, keeping key turns'},
 {id:'detailed',label:'Detailed',description:'Develop meaningful actions, reactions and pauses'},
] as const;
export const frameRecommendationSchema=z.object({count:z.number().int().min(readerMinFrames).max(readerMaxFrames),reason:z.string().trim().min(1).max(720),requirements:storyRequirementsSchema.optional(),storySummary:storySummarySchema.optional(),storyMatchReason:z.string().trim().min(1).max(1200).optional()});
export type FrameRecommendation=z.infer<typeof frameRecommendationSchema>;
export const frameRecommendationJson={type:'object',properties:{count:{type:'integer',minimum:readerMinFrames,maximum:readerMaxFrames},reason:{type:'string',minLength:1,maxLength:720}},required:['count','reason'],additionalProperties:false};
export function frameRecommendationOutputSchema(original:OriginalSource,prepareRequirements=false){
 const schema=original.storyBrief?frameRecommendationSchema.extend({storySummary:storySummarySchema,storyMatchReason:z.string().trim().min(1).max(1200)}):frameRecommendationSchema;
 return prepareRequirements?schema.extend({requirements:storyRequirementsSchema}):schema;
}
export function frameRecommendationOutputJson(original:OriginalSource,prepareRequirements=false){
 const schema=original.storyBrief?{...frameRecommendationJson,properties:{...frameRecommendationJson.properties,storySummary:{type:'string',minLength:1,maxLength:2400},storyMatchReason:{type:'string',minLength:1,maxLength:1200}},required:[...frameRecommendationJson.required,'storySummary','storyMatchReason']}:frameRecommendationJson;
 return prepareRequirements?{...schema,properties:{...schema.properties,requirements:storyRequirementsJson},required:[...schema.required,'requirements']}:schema;
}
export const narrativeDetailInstructions='Narrative detail controls treatment, not a fixed frame count. brief: follow the main story and combine secondary details while preserving key causes and turns. balanced: explain the complete causal chain and key turns. detailed: develop necessary actions, reactions, meaningful environmental detail and pauses. Do not bind these levels to fixed counts or repeat scenes to pad the story. Default to balanced. In automatic mode, a requested count in productionPrompt is a preference, not a locked target.';
export const frameRecommendationPrompt=promptSections(
 ['Task','You are an illustrated story writer. Read all verifiedOriginal.text and any chapterContext.text. Check the summary against that evidence and recommend the frame count needed for a complete adaptation at the selected narrative detail. Do not generate a storyboard, captions or images. Count story illustrations only; the separate ending page is excluded. Write every authored response in natural English, including titles, reasons, summaries and requirements.'],
 ['Story scope and opening',storyScopeDirection+'\n'+storyOpeningDirection],
 ['Summary',storySummaryDirection],
 ['Verification','When storyBrief is present, verify people, actions, causes, scope and ending against the complete source. Correct unsupported motives, misreadings, omissions and premature endings. Return storySummary (complete checked English summary, at most 2400 characters) and storyMatchReason (evidence-based English matching explanation, at most 1200 characters). Keep an accurate existing meaning. A summary must tell the actual actions, changes and result, rather than only an intention or setup. Preserve an open ending when that is the source ending. Without storyBrief, return count/reason without inventing a summary.'],
 ['Selection and estimate','A theme helps verify the matching rationale; it cannot add events or motives. Direct source mode adds no theme. Estimate from meaningful actions, responses, causes and consequences, not summary sentences or word counts.'],
 ['Narrative detail',narrativeDetailInstructions],
 ['Count',`Choose an integer from ${readerMinFrames} to ${readerMaxFrames} based on the story. The count is an estimate; later planning and review may increase or reduce it. Short stories need few frames; complex stories need enough space for their key scenes. Do not omit decisive turns or pad the story.`],
 ['Source boundaries','Use verified evidence only. Distinguish commentary and layout markers from the narrative. Do not guess missing or unknown characters. '+localStoryContextConstraint],
 ['Output','Return the supplied JSON schema. reason is a concise English sentence explaining why the count suits this story and detail level without spoilers (at most 720 characters). Include checked storySummary/storyMatchReason when requested.'],
 ['Story-specific production and acceptance suggestions',storyRequirementsDirection],['Input boundary',inputBoundaryDirection]);

export function frameRecommendationPayload(selection:Selection,original:OriginalSource,prepareRequirements=false){return {chosenStory:selection.storyTitle,editorialContext:storyEditorialContext(selection.theme),...storyBriefPayload(original,true),narrativeDetail:selection.narrativeDetail||'balanced',...(prepareRequirements?{prepareRequirements:true}:{}),productionPrompt:normalizeProductionPrompt(selection.productionPrompt||'',selection.theme),verifiedOriginal:verifiedOriginalPayload(original)};}
