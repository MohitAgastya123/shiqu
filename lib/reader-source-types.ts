// Preserve source evidence for editorial checks and save complete English reading translations.
// English projections never expose untranslated passages or partial translation checkpoints.
import type {LocalSourceReference} from './reader-local-contract.ts';
import type {StoryBriefRecord} from './reader-story-brief.ts';
export type ChapterContext={title:string;text:string;source:LocalSourceReference};
export type EnglishSource={title:string;text:string;chapterTitle?:string;chapterText?:string};
export type SourceTranslationProgress={parts:string[];titles:string[]};
export type OriginalSource={title:string;text:string;url:string;kind:'passage'|'chapter';provider:string;retrievedAt:string;localSource?:LocalSourceReference;localParts?:{sectionId:string;title:string;text:string}[];chapterContext?:ChapterContext;storyBrief?:StoryBriefRecord;englishSource?:EnglishSource;translationProgress?:SourceTranslationProgress};
export const containsChinese=(text:string)=>/\p{Script=Han}/u.test(text);
export function sourceTranslationReady(original:OriginalSource){
 const english=original.englishSource;
 if(english)return !!english.title.trim()&&!!english.text.trim()&&(!original.chapterContext||!!english.chapterTitle?.trim()&&!!english.chapterText?.trim())&&!containsChinese([english.title,english.text,english.chapterTitle,english.chapterText].join(' '));
 return !containsChinese([original.title,original.text,original.chapterContext?.title,original.chapterContext?.text].join(' '));
}
export function englishOriginal(original:OriginalSource|undefined):OriginalSource|null{
 if(!original)return null;
 if(!sourceTranslationReady(original))return null;
 const {englishSource,translationProgress:_,localParts:__,...source}=original;void _;void __;
 return {...source,title:englishSource?.title||source.title,text:englishSource?.text||source.text,provider:containsChinese(source.provider)?'Verified source edition':source.provider,...(source.chapterContext?{chapterContext:{...source.chapterContext,title:englishSource?.chapterTitle||source.chapterContext.title,text:englishSource?.chapterText||source.chapterContext.text}}:{})};
}
export function verifiedOriginalPayload(original:OriginalSource){const source=englishOriginal(original)||original;return {title:source.title,text:source.text,url:source.url,...(source.chapterContext?{chapterContext:source.chapterContext}:{})};}
export type SourceFailure={code:'SOURCE_HTTP_ERROR'|'SOURCE_INVALID_RESPONSE'|'SOURCE_TIMEOUT'|'SOURCE_NETWORK_ERROR';status?:number};
export type SourceResult={source:OriginalSource|null;message:string;searchUrl:string;failure?:SourceFailure};
// Source lookup can run before storyboarding; only citation clues are required.
export type SourceHint={sourceReference:string;adaptationNote?:string;pages?:{caption:string}[]};
