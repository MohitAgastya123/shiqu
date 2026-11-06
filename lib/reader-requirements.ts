// English product text and generation contracts; canonical source evidence remains unchanged.
// Propose source-grounded adaptation choices and separately testable acceptance criteria.
// Saved suggestions identify automatic values on reselection; authored overrides remain intact.
import {z} from 'zod';
import {acceptanceCriteria,acceptancePromptSchema} from './reader-acceptance.ts';
import {normalizeProductionPrompt} from './reader-prompts.ts';
import type {Selection} from './reader-model.ts';

export const storyRequirementsSchema=z.object({
 productionPrompt:z.string().trim().min(1).max(1200),
 acceptancePrompt:acceptancePromptSchema.refine(text=>acceptanceCriteria(text).length>=2&&acceptanceCriteria(text).length<=4,'Automatic acceptance suggestions must contain 2–4 criteria.'),
});
export type StoryRequirements=z.infer<typeof storyRequirementsSchema>;
export type RequirementsSetup={suggestions?:StoryRequirements;overrides?:Partial<StoryRequirements>};
export const storyRequirementsJson={type:'object',properties:{productionPrompt:{type:'string',minLength:1,maxLength:1200},acceptancePrompt:{type:'string',minLength:1,maxLength:1200}},required:['productionPrompt','acceptancePrompt'],additionalProperties:false};
export const storyRequirementsDirection="When prepareRequirements=true also return requirements:{productionPrompt,acceptancePrompt} in English. Read the complete verifiedOriginal.text and chapterContext.text and use the same verified facts as the synopsis. The summary says what happened; productionPrompt explains specific adaptation choices: narrative emphasis, key exchanges and responses, dialogue or outcome to retain, and processes to compress. Apply existing reader preferences without inventing events, motives or a locked count. acceptancePrompt contains 2–4 independent, testable criteria, one per line, tied to these choices and verified against the source. Identify the person, action, response or outcome that must appear in captions, scene descriptions or reflection. Do not require inspection of finished artwork or repeat generic rules such as faithful to the source or vivid imagery. Each field is at most 1200 characters and remains reader-editable. Omit requirements when prepareRequirements is absent.";

export function suggestedSettings(selection:Selection,requirements:StoryRequirements,overrides:Partial<StoryRequirements>={}){return {
 artStyle:selection.artStyle,narrativeDetail:selection.narrativeDetail||'balanced' as const,length:'auto' as const,
 productionPrompt:normalizeProductionPrompt(selection.productionPrompt,selection.theme)||requirements.productionPrompt,
 acceptancePrompt:selection.acceptancePrompt?.trim()?selection.acceptancePrompt:requirements.acceptancePrompt,
 ...overrides,
};}
export function requirementsForReselection(selection:Selection,setup?:RequirementsSetup){
 const overrides={...setup?.overrides},next={...selection};
 for(const key of ['productionPrompt','acceptancePrompt'] as const){
  if(!setup?.suggestions){
   if(key in overrides)overrides[key]=selection[key]||'';
   continue;
  }
  if((selection[key]||'')===setup.suggestions[key]){next[key]='';delete overrides[key];}
  else overrides[key]=selection[key]||'';
 }
 return {selection:next,setup:{overrides} as RequirementsSetup};
}
