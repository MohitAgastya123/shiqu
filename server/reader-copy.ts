// English product messages; source evidence and machine identifiers remain stable.
// Copy saved checkpoints without inference; unreviewed drafts require an explicit text-only choice. Both libraries use
// production initialization and exclusive ownership; the new independent story starts paused.
// An optional rendering style changes only new image inputs, retaining the exact saved script/review.
// The Skill controls the text/image checkpoints; this service executes only explicit image choices.
import {createHash} from 'node:crypto';
import {existsSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {createApplication} from './app.ts';
import {ownDesktopData} from './desktop-owner.ts';
import {ReaderRepository} from '../lib/reader-repository.ts';
import {ReaderError,selectionSchema,planSchema,view} from '../lib/reader-model.ts';
import type {Document} from '../lib/reader-model.ts';
import {readerImageAsset,referenceImageKey} from '../lib/reader-image-assets.ts';
import {mediaType,imageTypes} from '../lib/reader-generation-contract.ts';
import {readableImage} from './reader-image-health.ts';

type StoryCopyOptions={images?:boolean;existing?:boolean;draft?:boolean};

export async function copySavedStory(target:ReturnType<typeof createApplication>,root:string,targetDirectory:string,sourceDirectory:string,sourceId:string,requestId:string,artStyle?:unknown,options:StoryCopyOptions={}){
 if(options.draft&&(options.images||options.existing))throw new ReaderError(400,'Draft copies include text only; images cannot be copied.');
 if(!existsSync(path.join(sourceDirectory,'shiqu.sqlite')))throw new ReaderError(404,'The source library does not exist.');
 if(realpathSync(sourceDirectory)===realpathSync(targetDirectory))throw new ReaderError(400,'Select a different source library.');
 const release=await ownDesktopData(sourceDirectory);let source:ReturnType<typeof createApplication>|undefined;
 try{
  source=createApplication({root,dataDirectory:sourceDirectory,variables:{SHIQU_AI_PROVIDER:'readonly'},commandOnly:true,production:{autoStart:false}});
  const repo=new ReaderRepository(source.services.database),row=await repo.current(sourceId,source.services.ownerId);
  if(row.id!==sourceId)throw new ReaderError(409,'Copy the current revision of the source story.');
  const saved=JSON.parse(row.document) as Document;
  if(row.state==='running'||!saved.plan||!saved.original||saved.intake&&saved.intake.phase!=='confirmed'||saved.reselection)throw new ReaderError(409,'Only stopped stories with a saved complete source and storyboard can be copied.');
  if(!options.draft&&(saved.visualReview?.status!=='passed'||saved.visualReview.overridden))throw new ReaderError(409,'Only stories with a saved source and an approved storyboard can be copied. Explicitly choose a draft copy for unapproved text.');
  if(options.draft){
   planSchema.parse(saved.plan);
   if(!saved.visualReview||typeof saved.original.text!=='string'||!saved.original.text.trim())throw new ReaderError(409,'A draft requires a complete storyboard, original text, and a saved review checkpoint.');
  }
  const sourceSelection=selectionSchema.parse(JSON.parse(row.selection));
  const contentHash=createHash('sha256').update(JSON.stringify([sourceSelection,row.document])).digest('hex');
  const selection=selectionSchema.parse({...sourceSelection,...(artStyle===undefined?{}:{artStyle})});
  const styleChanged=selection.artStyle!==sourceSelection.artStyle;
  if(options.images&&styleChanged)throw new ReaderError(400,'Existing images cannot be copied when changing art style. Skip images and draw them later in the new style.');
  // Keep runtime/family state in the source; attach independent media only after the optional step.
  const document:Document={plan:saved.plan,original:saved.original,visualReview:saved.visualReview,frameRecommendation:saved.frameRecommendation,frameCountConfirmed:options.draft?saved.frameCountConfirmed:true,...(options.draft?{storyboard:saved.storyboard}:{}),reflectionCandidates:saved.reflectionCandidates,setupRequirements:saved.setupRequirements,publication:saved.publication,images:[],audio:[],usage:saved.usage.map(call=>({...call,originId:call.originId||sourceId})),copiedFrom:{storyId:saved.copiedFrom?.storyId||sourceId,contentHash,...(options.draft?{draft:true}:{}),...(options.images===undefined?{}:{imageChoice:options.images})}};
  const destination=new ReaderRepository(target.services.database),owner=target.services.ownerId;
  let result=options.existing?await destination.get(requestId,owner):await destination.create(requestId,owner,selection,document),current=JSON.parse(result.document) as Document;
  if(current.copiedFrom?.storyId!==document.copiedFrom!.storyId||current.copiedFrom.contentHash!==contentHash)throw new ReaderError(409,'This creation ID has already been used for different content.');
  if(options.existing&&current.copiedFrom.draft)throw new ReaderError(409,'Images cannot be added to a draft copy until formal review passes.');
  const progress=current.copiedFrom.images;
  if(progress==='complete'||progress==='skipped'&&!options.existing)return view(result);
  if(result.generation_control!=='paused'||result.state==='running'||current.images.some(Boolean)||await destination.superseded(requestId,owner)){
   if(options.images||progress==='pending')throw new ReaderError(409,'The target story has started production or has a newer revision. Images cannot be copied now.');
   return view(result);
  }
  const include=progress==='pending'||options.images===true;
  async function checkpoint(images:Document['images'],status:'pending'|'complete'|'skipped'){
   const next={...current,images,copiedFrom:{...current.copiedFrom!,images:status}};
   const updated=await destination.db.prepare("UPDATE stories SET document=?,updated_at=? WHERE id=? AND user_id=? AND document=? AND generation_control='paused' AND state!='running'")
    .bind(JSON.stringify(next),new Date().toISOString(),requestId,owner,result.document).run();
   if(!updated.meta.changes)throw new ReaderError(409,'The target story has changed. Text has been retained. Reload before continuing.');
   result=await destination.get(requestId,owner);current=JSON.parse(result.document) as Document;
  }
  if(!include){await checkpoint(current.images,'skipped');return view(result);}
  if(styleChanged)throw new ReaderError(400,'Existing images cannot be copied when changing art style. Text has been retained.');
  if(progress!=='pending')await checkpoint(current.images,'pending');
  const images=saved.plan.pages.map(()=> '');
  for(let page=0;page<images.length;page++){
   if(!saved.images[page])continue;
   try{
    const key=referenceImageKey(sourceId,saved.images[page]),asset=key?await source.services.media.get(key):null;
    if(!asset)throw Error('IMAGE_MISSING');
    const bytes=new Uint8Array(await asset.arrayBuffer()),type=mediaType(bytes);
    if(!type||!await readableImage(bytes))throw Error('IMAGE_UNREADABLE');
    const image=readerImageAsset(requestId,page,imageTypes[type],createHash('sha256').update(bytes).digest('hex'));
    await target.services.media.put(image.key,bytes,{contentType:type});images[page]=image.url;
   }catch{throw new ReaderError(503,`Text and review records have been retained. Image copying is incomplete: frame ${page+1} could not be read or saved. Retry with the same copy request ID ${requestId}.`);}
  }
  await checkpoint(images,'complete');
  return view(result);
 }finally{try{await source?.close();}finally{await release();}}
}
