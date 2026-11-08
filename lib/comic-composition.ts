// Validate planned comic staging independently of narrative evidence and actual pixel recognition.
// Explicit canvas intent participates in image inputs; unchanged scene repairs retain saved staging.
import {z} from 'zod';

export type NormalizedRect={x:number;y:number;width:number;height:number};
export const comicCanvases=['9:16','4:5','3:2','2:3'] as const;
export type ComicCanvas=typeof comicCanvases[number];
const coordinate=z.number().finite().min(0).max(1);
const rectFields={x:coordinate,y:coordinate,width:z.number().finite().positive().max(1),height:z.number().finite().positive().max(1)};
export const comicProtectedAreaSchema=z.object({kind:z.enum(['face','action']),...rectFields}).strict().superRefine((area,ctx)=>{
 if(area.x+area.width>1+1e-9||area.y+area.height>1+1e-9)ctx.addIssue({code:z.ZodIssueCode.custom,message:'Keep protected scene areas completely inside the image.'});
});
export type ComicProtectedArea=z.infer<typeof comicProtectedAreaSchema>;
export const comicCompositionSchema=z.object({canvas:z.enum(comicCanvases),focus:z.object({x:coordinate,y:coordinate}).strict(),protectedAreas:z.array(comicProtectedAreaSchema).max(12)}).strict();
export type ComicComposition=z.infer<typeof comicCompositionSchema>;
const number={type:'number',minimum:0,maximum:1};
export const comicCompositionJsonSchema={type:'object',properties:{canvas:{type:'string',enum:[...comicCanvases]},focus:{type:'object',properties:{x:number,y:number},required:['x','y'],additionalProperties:false},protectedAreas:{type:'array',maxItems:12,items:{type:'object',properties:{kind:{type:'string',enum:['face','action']},x:number,y:number,width:{type:'number',exclusiveMinimum:0,maximum:1},height:{type:'number',exclusiveMinimum:0,maximum:1}},required:['kind','x','y','width','height'],additionalProperties:false}}},required:['canvas','focus','protectedAreas'],additionalProperties:false};
const targets:Record<ComicCanvas,{width:number;height:number}>={'9:16':{width:864,height:1536},'4:5':{width:1024,height:1280},'3:2':{width:1536,height:1024},'2:3':{width:1024,height:1536}};
export function comicCanvasTarget(canvas:ComicCanvas='9:16'){return {...targets[canvas]};}
export function sameComicImageInput(a:{prompt:string;composition?:ComicComposition},b:{prompt:string;composition?:ComicComposition}){
 return a.prompt===b.prompt&&JSON.stringify(a.composition??null)===JSON.stringify(b.composition??null);
}
export function retainSceneComposition<T extends {prompt:string;composition?:ComicComposition}>(previous:{prompt:string;composition?:ComicComposition}|undefined,next:T):T{
 if(!previous||previous.prompt!==next.prompt)return next;
 const {composition,...rest}=next;void composition;
 return {...rest,...(previous.composition?{composition:structuredClone(previous.composition)}:{})} as T;
}
