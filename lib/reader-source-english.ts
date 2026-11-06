// Translate one bounded source chunk per production checkpoint, retaining paid progress on restart.
// Both explicit source conversion and normal preparation call this implementation.
import {z} from 'zod';
import {sourceTranslationReady,containsChinese} from './reader-source-types.ts';
import type {OriginalSource} from './reader-source-types.ts';
import type {Generated,StoryGenerator} from './reader-engine.ts';
export const sourceTranslationChunkSize=1800;
export const englishTranslationSchema=z.object({title:z.string().trim().min(1).max(320),text:z.string().trim().min(1).max(24000)}).strict().refine(value=>!containsChinese(value.title+' '+value.text),'Translate every source character into English; do not return Chinese text.');
export function sourceTranslationChunks(original:OriginalSource){
 const fields=[{field:'text' as const,title:original.title,text:original.text},...(original.chapterContext?[{field:'chapterText' as const,title:original.chapterContext.title,text:original.chapterContext.text}]:[])];
 return fields.flatMap(({field,title,text})=>{
  const characters=Array.from(text),chunks=[];
  for(let start=0;start<characters.length;){
   let end=Math.min(start+sourceTranslationChunkSize,characters.length);
   if(end<characters.length){const segment=characters.slice(start,end).join(''),boundary=Math.max(segment.lastIndexOf('\n'),segment.lastIndexOf('。'),segment.lastIndexOf('. '));if(boundary>sourceTranslationChunkSize/2)end=start+Array.from(segment.slice(0,boundary+1)).length;}
   chunks.push({field,title,text:characters.slice(start,end).join('')});start=end;
  }
  return chunks;
 });
}
export async function translateSourceCheckpoint(original:OriginalSource,generator:Pick<StoryGenerator,'translateSource'>):Promise<Generated<unknown>|null>{
 if(sourceTranslationReady(original))return null;
 if(!generator.translateSource)throw Error('English source translation is unavailable. Configure a text generation provider and prepare this story again.');
 const chunks=sourceTranslationChunks(original),progress=original.translationProgress??={parts:[],titles:[]},index=progress.parts.length,chunk=chunks[index];
 if(!chunk)throw Error('Source translation checkpoint is invalid. Prepare this source again.');
 const result=await generator.translateSource(chunk.text,chunk.title),translated=englishTranslationSchema.parse(result.value);
 progress.parts.push(translated.text);progress.titles.push(translated.title);
 if(progress.parts.length===chunks.length){
  const joined=(field:'text'|'chapterText')=>chunks.flatMap((part,i)=>part.field===field?[progress.parts[i]]:[]).join('\n\n');
  original.englishSource={title:progress.titles[0],text:joined('text'),...(original.chapterContext?{chapterTitle:progress.titles[chunks.findIndex(part=>part.field==='chapterText')],chapterText:joined('chapterText')}:{})};
  delete original.translationProgress;
 }
 return result;
}
