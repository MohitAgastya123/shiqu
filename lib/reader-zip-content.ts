// English product text and generation contracts; canonical source evidence remains unchanged.
// Preserve comic balloon attribution and embedded-raster markers in shared archive serialization.
// Browser code owns image encoding; the collection command keeps those signed WebP bytes unchanged.
// Public series labels retain numeric part identity without leaking original upload bytes or continuity context.
import {layoutComicPages,validatedComicPages,validatedComicRendering} from './comic-page-layout.ts';
import type {ComicPage} from './comic-page-layout.ts';
import {themeLabel} from './reader-language.ts';
import {strToU8} from 'fflate';
import type {Story} from './content';
import type {StorySeriesMembership} from './story-import-contract.ts';
import {z} from 'zod';
import type {GeneratedStory} from './reader-model';
import type {StoryPromptHistory} from './reader-prompt-records.ts';
import {pdfFilename,storySourceReference} from './reader-pdf.ts';
import {aiDisclosure,archivedAiDisclosure,publicationText,emptyPublication,publicationSchema} from './story-publication.ts';
import type {StoryPublication} from './story-publication.ts';
import type {StoryImageHashes} from './story-webp-metadata.ts';
import {pageBubblesSchema} from './reader-bubbles.ts';
import type {ComicBubble} from './reader-bubbles.ts';

export type StoryZipData={
 series?:StorySeriesMembership;
 id:string;title:string;summary:string;bookId:string;theme:string;sourceReference:string;sourceText:string;sourceUrl:string;
 artStyleLabel:string|null;author:string;publication:StoryPublication|null;aiGenerated:boolean|null;aiDisclosure:string;
 comicPages?:ComicPage[];generationModels:{step:string;model:string}[];pages:({caption:string;prompt?:string|null;image:string;bubbles?:ComicBubble[];bubbleRendering?:'embedded';panel?:'normal'|'wide'|'large'|'splash';comicRendering?:{width:number;height:number;minFontSize:number|null}}&StoryImageHashes)[];
 reflection:string;adaptationNote:string;revision:number;createdAt:string;updatedAt:string;
 productionPrompt?:string|null;acceptancePrompt?:string|null;promptHistoryFile?:string;
};
const publicFields=['id','title','summary','bookId','theme','sourceReference','sourceText','sourceUrl','artStyleLabel','author','publication','aiGenerated','aiDisclosure','generationModels','pages','reflection','adaptationNote','revision','createdAt','updatedAt'] as const;
const seriesMembershipSchema=z.object({id:z.string().uuid(),title:z.string().min(1).max(140),part:z.number().int().min(1).max(200),parts:z.number().int().min(1).max(200)}).strict().refine(value=>value.part<=value.parts,'Invalid comic series part.');
const publicPublication=publicationSchema.omit({watermarkFontSize:true}).strip();
export function zipFilename(title:string){return pdfFilename(title).replace(/-Shiqu\.pdf$/,'.zip');}
export function zipImageFilename(index:number,count:number){return `图片/${String(index+1).padStart(Math.max(2,String(count).length),'0')}.webp`;}
export function assertZipReady(story:Pick<Story,'pages'>&Partial<Story>){
 if('generated' in story&&story.generated&&!story.sourceText?.trim())throw Error('Prepare the saved English source before exporting this story.');
 if(!story.pages.length||story.pages.some(page=>!page.image))throw Error('Complete every image before exporting the storyboard ZIP.');
}
export function zipMetadataStory(data:StoryZipData){
 return {...data,generated:data.aiGenerated===true,publication:data.publication||{...emptyPublication,author:data.author}};
}
export function storyZipData(story:Story,images:string[],hashes:StoryImageHashes[],history:StoryPromptHistory|null,{bubbleRendering,comicPages,comicRenderings}:{bubbleRendering?:'embedded';comicPages?:ComicPage[];comicRenderings?:{width:number;height:number;minFontSize:number|null}[]}={}):StoryZipData{
 const generated='generated'in story&&story.generated===true?story as GeneratedStory:null;
 return {
  ...(story.series?{series:seriesMembershipSchema.parse(story.series)}:{}),
  id:story.id,title:story.title,summary:story.summary,bookId:story.bookId,theme:themeLabel(story.theme),
  sourceReference:storySourceReference(story),sourceText:story.sourceText,sourceUrl:story.sourceUrl,
  artStyleLabel:generated?.artStyleLabel??null,author:story.publication?.author||'',publication:story.publication||null,
  aiGenerated:generated?true:null,aiDisclosure:aiDisclosure(story),generationModels:generated?.generationModels??[],
  productionPrompt:history?.productionPrompt??null,acceptancePrompt:history?.acceptancePrompt??null,promptHistoryFile:'提示词.json',
  comicPages:comicPages||layoutComicPages(story.pages),
  pages:story.pages.map((page,index)=>({caption:page.caption,prompt:page.prompt||null,image:images[index],...hashes[index],...(page.panel?{panel:page.panel}:{}),...(comicRenderings?.[index]||page.comicRendering?{comicRendering:validatedComicRendering(comicRenderings?.[index]||page.comicRendering)}:{}),...(page.bubbles?.length?{bubbles:pageBubblesSchema.parse(page.bubbles),...(bubbleRendering==='embedded'||page.bubbleRendering==='embedded'?{bubbleRendering:'embedded' as const}:{})}:{})})),
  reflection:story.reflection,adaptationNote:story.adaptationNote,revision:story.revision,createdAt:story.createdAt,updatedAt:story.updatedAt,
 };
}
export function publicStoryZipData(input:StoryZipData):StoryZipData{
 for(const key of publicFields)if(!Object.hasOwn(input,key))throw Error(`Story archive is missing public field: ${key}`);
 if(input.pages.some(page=>page.comicRendering)&&!input.comicPages)throw Error('Embedded comic panels require their saved comic page layout.');
 if(input.comicPages){const pages=validatedComicPages(input.comicPages,input.pages.length);for(const panel of pages.flatMap(page=>page.panels)){const rendering=input.pages[panel.frameIndex].comicRendering;if(rendering){const saved=validatedComicRendering(rendering);if(saved.minFontSize===null&&panel.span!=='splash'||saved.minFontSize!==null&&saved.minFontSize*Math.min(panel.width*900/saved.width,panel.height*1350/saved.height)<24-1e-6)throw Error(`Panel ${panel.frameIndex+1} lettering is too small for its saved comic layout.`);}}}
 if(input.publication&&input.publication.author!==input.author)throw Error('Public creator credit does not match.');
 if(input.aiDisclosure!==archivedAiDisclosure(zipMetadataStory(input)))throw Error('Public AI disclosure does not match the production method.');
 return {
  ...(input.series?{series:seriesMembershipSchema.parse(input.series)}:{}),
  // Presence checks above and this explicit whitelist define the dynamic public projection.
  ...Object.fromEntries(publicFields.map(key=>[key,input[key]])) as unknown as StoryZipData,
  ...(input.comicPages?{comicPages:validatedComicPages(input.comicPages,input.pages.length)}:{}),
  publication:input.publication===null?null:publicPublication.parse(input.publication),
  generationModels:input.generationModels.map(({step,model})=>({step,model})),
  pages:input.pages.map(({caption,image,sha256,originalSha256,imagePayloadSha256,bubbles,bubbleRendering,panel,comicRendering})=>{
   if(bubbles?.length&&bubbleRendering!=='embedded')throw Error('Public comic balloon images must already contain their saved balloons.');
   if(panel!==undefined&&!['normal','wide','large','splash'].includes(panel))throw Error('Invalid comic panel emphasis.');
   return {caption,image,sha256,originalSha256,imagePayloadSha256,...(panel?{panel}:{}),...(comicRendering?{comicRendering:validatedComicRendering(comicRendering)}:{}),...(bubbles?.length?{bubbles:pageBubblesSchema.parse(bubbles),bubbleRendering:'embedded' as const}:{})};
  }),
 };
}
export function storyZipFiles(data:StoryZipData,{includePrompts=true}={}):Record<string,Uint8Array>{
 const story=includePrompts?data:publicStoryZipData(data),credits=publicationText(zipMetadataStory(story));
 const markdown=[
  `# ${story.title}`,story.series?`Series: ${story.series.title} · Part ${story.series.part} of ${story.series.parts}`:'',story.summary,`Theme: ${themeLabel(story.theme)}`,`Source: ${story.sourceReference}`,
  story.sourceUrl&&`Source URL: ${story.sourceUrl}`,story.artStyleLabel&&`Art style: ${story.artStyleLabel}`,
  `## Credits and reuse\n\n${credits}`,
  ...(story.comicPages?.length?[`## Comic pages\n\n`+story.comicPages.map(page=>`Page ${page.index+1}: `+page.panels.map(panel=>`panel ${panel.frameIndex+1} (${panel.span})`).join(', ')).join('\n')]:[]),
  ...story.pages.map((page,index)=>`## Frame ${index+1}\n\nImage: ${page.image}${page.panel?'\n\nPanel emphasis: '+page.panel:''}\n\n### Caption\n\n${page.caption}`+(page.bubbles?.length?'\n\n### Dialogue and thoughts\n\n'+page.bubbles.map((bubble,order)=>`${order+1}. ${bubble.speaker} (${bubble.kind}): ${bubble.text}`).join('\n'):'')+(includePrompts?`\n\n### Scene prompt\n\n${page.prompt||'Not recorded.'}`:'')),
  story.reflection&&`## A final thought\n\n${story.reflection}`,story.adaptationNote&&`## Adaptation notes\n\n${story.adaptationNote}`,
  story.sourceText&&`## Saved English source\n\n${story.sourceText}`,
 ].filter(Boolean).join('\n\n')+'\n';
 return {
  '分镜.md':strToU8(markdown),
  '故事.json':strToU8(JSON.stringify(story,null,2)+'\n'),
  '署名与转载.txt':strToU8(`${story.title}\n\n${credits}\n\nOriginal source: ${story.sourceReference}\n${story.sourceUrl}\n\nWork ID: ${story.id}\nVersion: ${story.revision}\nSaved at: ${story.updatedAt}\n`),
 };
}
