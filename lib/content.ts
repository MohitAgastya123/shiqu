// English product messages; source identities and historical evidence stay stable.
// Define shared story types and CLI themes; source text comes from the selected library edition.
import type {StoryPublication} from './story-publication';
export type Page = { caption: string; prompt: string; image: string; audio: string };
export type Story = { publication?:StoryPublication; id:string; title:string; summary:string; bookId:string; theme:string; status:'draft'|'review'|'published'; pages:Page[]; reflection:string; sourceText:string; sourceUrl:string; adaptationNote:string; checks:{source:boolean;plot:boolean;visual:boolean}; revision:number; createdAt:string; updatedAt:string };
export const themes = ['Human kindness and indifference','Unexpected joy','Attachment, gain and loss','Wisdom and folly','Kindness and misunderstanding'];
