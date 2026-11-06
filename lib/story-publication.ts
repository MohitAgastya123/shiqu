// English product text and generation contracts; canonical source evidence remains unchanged.
// Keep public credits outside generation inputs and distinguish new contributions from source licenses.
import {z} from 'zod';
import type {Story} from './content';

const line=(max:number)=>z.string().trim().max(max).refine(value=>!/[\r\n\t]/.test(value),'Use a single line.');
export const watermarkFontSize={min:12,max:48,default:24};
export const publicationSchema=z.object({
 author:line(80),workUrl:line(1000).refine(value=>{if(!value)return true;try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password;}catch{return false;}},'Use an HTTP/HTTPS work URL without credentials.'),
 contact:line(200),sourceNote:z.string().trim().max(1200),reuse:z.string().trim().max(1200),
 // Optional for historical snapshots: parsing an old CAS expectation must not add new fields.
 watermarkFontSize:z.number().int('Watermark font size must be an integer.').min(watermarkFontSize.min,'Watermark font size must be at least 12 px.').max(watermarkFontSize.max,'Watermark font size must be at most 48 px.').optional(),
}).strict();
export type StoryPublication=z.infer<typeof publicationSchema>;
export type PublicationStory=Pick<Story,'publication'>&{generated?:boolean};
export const emptyPublication:StoryPublication={author:'',workUrl:'',contact:'',sourceNote:'',reuse:''};
export function hasPublicationAuthor(publication?:StoryPublication|null){const author=publication?.author.trim();return !!author&&!['Uncredited','未署名'].includes(author);}
// Resolve display/export credits without rewriting snapshots; explicit fields win and samples keep their credits.
export function withPublicationDefaults(story:Story,defaults:StoryPublication|null):Story{
 if(!('generated'in story&&story.generated===true)||!defaults)return story;
 const publication={...(story.publication||emptyPublication)};
 for(const field of ['author','workUrl','contact','sourceNote','reuse'] as const){
  if((!publication[field].trim()||field==='author'&&!hasPublicationAuthor(publication))&&defaults[field])publication[field]=defaults[field];
 }
 if(publication.watermarkFontSize===undefined&&defaults.watermarkFontSize!==undefined)publication.watermarkFontSize=defaults.watermarkFontSize;
 return {...story,publication};
}
export const rightsBoundary='The open-source code license does not automatically apply to story content. Original works and source editions retain their applicable rights and licenses. Unless separately licensed or permitted by law, contact the relevant rights holder before reusing protected adaptation contributions. Creator statements cannot restrict rights already granted by public-domain status or existing licenses.';
export function aiDisclosure(story:PublicationStory){return 'generated'in story&&story.generated===true?'This work contains AI-generated illustrations and adapted text.':'Refer to the creator statement for production methods.';}
// Archive imports may retain the exact disclosure signed by historical exporters.
// This is a verification boundary only; new exports always call aiDisclosure().
export function archivedAiDisclosure(story:PublicationStory&{aiDisclosure?:string}){
 const current=aiDisclosure(story),legacy='generated'in story&&story.generated===true?'本作品包含 AI 生成的画面与改编文字。':'创作方式请以制作人说明为准。';
 return story.aiDisclosure===legacy?legacy:current;
}
export function publicationCredit(story:PublicationStory){return `Created by: ${story.publication?.author||'Uncredited'} · Shiqu`+('generated'in story&&story.generated===true?' · AI-generated':'');}
export function publicationText(story:PublicationStory){
 const p=story.publication||emptyPublication;
 return [publicationCredit(story),aiDisclosure(story),p.workUrl&&`Work URL: ${p.workUrl}`,p.contact&&`Contact: ${p.contact}`,`Sources and licenses: ${p.sourceNote||'Check the original source and the license of the edition used.'}`,`Sharing and reuse: ${p.reuse||'No additional permission is granted. Check source licenses and contact the relevant rights holder when needed.'}`,rightsBoundary].filter(Boolean).join('\n\n');
}
// Include all rendered content so a late export or later metadata edit cannot reuse stale bytes.
export function storyExportKey(story:Story){return JSON.stringify(story);}
