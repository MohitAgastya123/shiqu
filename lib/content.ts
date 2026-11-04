// Define shared story types and CLI themes; source text comes from the selected library edition.
import type {StoryPublication} from './story-publication';
export type Page = { caption: string; prompt: string; image: string; audio: string };
export type Story = { publication?:StoryPublication; id:string; title:string; summary:string; bookId:string; theme:string; status:'draft'|'review'|'published'; pages:Page[]; reflection:string; sourceText:string; sourceUrl:string; adaptationNote:string; checks:{source:boolean;plot:boolean;visual:boolean}; revision:number; createdAt:string; updatedAt:string };
export const themes = ['人情冷暖','意外之喜','执念与得失','聪明与糊涂','善意与误解'];
