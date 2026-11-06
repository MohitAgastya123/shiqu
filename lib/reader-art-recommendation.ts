// English product text and generation contracts; canonical source evidence remains unchanged.
// Recommend from already-read story content; preserve manual choices on reselect
// and accept old cached candidates without inventing a recommendation.
import {promptSections,inputBoundaryDirection} from './reader-prompts.ts';
import {localSourceKey} from './reader-source-key.ts';
import {z} from 'zod';
import {artStyleIds,artStyles} from './reader-styles.ts';
import type {Selection} from './reader-model.ts';
import type {LocalSourceReference} from './reader-local-contract.ts';
import type {OriginalSource} from './reader-source-types.ts';

export const artRecommendationSchema=z.object({artStyle:z.enum(artStyleIds),reason:z.string().trim().min(1).max(480)});
export type ArtRecommendation=z.infer<typeof artRecommendationSchema>;
export const artRecommendationJson={type:'object',properties:{artStyle:{type:'string',enum:[...artStyleIds]},reason:{type:'string',minLength:1,maxLength:480}},required:['artStyle','reason'],additionalProperties:false};
const artSelectionDirection="Choose the available style that best serves this particular story's mood, key actions, relationships or setting. Do not classify mechanically by book or genre, follow a previous reader choice, always choose colored pencil or force variety. reason is one spoiler-free English sentence, at most 480 characters. Recommend only; generate no image.";
const availableArtStyles=artStyles.map(style=>`${style.id} (${style.label}: ${style.description})`).join('; ')+'.';
export const artRecommendationInstructions=promptSections(['Per-story style','For every story also return artRecommendation:{artStyle,reason}.'+artSelectionDirection],['Available styles',availableArtStyles]);
export const selectedArtRecommendationPrompt=promptSections(['Task','Recommend an art style for the selected story from verifiedOriginal. Return only top-level artStyle and an English reason, not a story, storyboard or image.'],['Selection standards',artSelectionDirection],['Available styles',availableArtStyles],['Input and output',inputBoundaryDirection]);

export function selectedArtRecommendationPayload(selection:Selection,original:OriginalSource){return {chosenStory:selection.storyTitle,theme:selection.theme,verifiedOriginal:{title:original.title,text:original.text}};}
type Candidate={title:string;source?:LocalSourceReference;artRecommendation?:z.infer<typeof artRecommendationSchema>};
export function storyCandidateKey(story:Candidate){return JSON.stringify([story.title,story.source?localSourceKey(story.source):null]);}
export function isSelectedStory(selection:Selection,story:Candidate){return selection.storyTitle===story.title&&(selection.source&&story.source?localSourceKey(selection.source)===localSourceKey(story.source):selection.source===story.source);}
export function selectSuggestedStory(selection:Selection,story:Candidate):Selection{
 const sameStory=isSelectedStory(selection,story);
 return {...selection,storyTitle:story.title,source:story.source,artStyle:sameStory?selection.artStyle:story.artRecommendation?.artStyle||selection.artStyle};
}
