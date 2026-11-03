// Fork edits into new sessions. Copy immutable media before one CAS publishes the child;
// family epochs serialize competing drafts without altering originals. Only content a draft was
// written against can conflict with it: saved images and progress never do. A file that is gone
// cannot be reused and is redrawn; one that cannot be read right now stops the submission.
import {createHash} from 'node:crypto';
import {ReaderError,selectionSchema} from '../lib/reader-model.ts';
import type {Document,SessionRow} from '../lib/reader-model.ts';
import type {ReaderRepository} from '../lib/reader-repository.ts';
import {familyRoot,familyNumber,supersededSql} from '../lib/reader-repository.ts';
import type {MediaStore} from '../lib/services.ts';
import {checkedRevision,reusableRevisionImages} from '../lib/reader-revision.ts';
import type {RevisionChanges,RevisionSnapshot,RevisionBase} from '../lib/reader-revision.ts';
import {localSourceKey} from '../lib/reader-source-key.ts';
import {readableImage} from './reader-image-health.ts';
import {commandReceipt} from './reader-commands.ts';
import {newReview} from '../lib/reader-review.ts';
import {readerImageAsset,referenceImageKey} from '../lib/reader-image-assets.ts';
import {mediaType,imageTypes} from '../lib/reader-generation-contract.ts';
import type {LocalBooks} from './local-books.ts';
import {sourceParts,mergeSources} from './local-source-ranges.ts';
const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
export const familyEpoch=`SELECT COALESCE(MAX(${familyNumber('reader_sessions')}),1) AS epoch FROM reader_sessions WHERE user_id=? AND (id=? OR ${familyRoot('reader_sessions')}=?)`;
export const currentFamilyVersion=(alias='p')=>`NOT ${supersededSql(alias)} AND NOT EXISTS(SELECT 1 FROM library_deletions WHERE story_id=${alias}.id AND user_id=${alias}.user_id)`;
export function editableSelection(selection:string){const {displayTitle:_,...value}=JSON.parse(selection);void _;return value;}
export const replacementToken=(selection:string,epoch:number)=>hash(JSON.stringify([editableSelection(selection),epoch]));
const savedFrameCount=(doc:Document)=>doc.draft?.pages.length??doc.storyboard?.outline.beats.length;
export async function revisionBasis(repo:ReaderRepository,row:SessionRow,allowInFlight=false){
 const doc=JSON.parse(row.document) as Document;
 if(doc.reselection||await repo.superseded(row.id,row.user_id))throw new ReaderError(409,'这是草稿或旧版本，请打开书架当前版本。');
 if(doc.intake&&doc.intake.phase!=='confirmed')throw new ReaderError(409,'请在制作确认前保存设置草稿。');
 if(!allowInFlight&&!doc.plan&&row.generation_control!=='paused'&&row.generation_control!=='stopped')throw new ReaderError(409,'请先暂停生成，再修改制作内容。');
 const rootId=doc.revision?.rootId||row.id;
 const epoch=(await repo.db.prepare(familyEpoch).bind(row.user_id,rootId,rootId).first<{epoch:number}>())!.epoch;
 const token=hash(JSON.stringify([editableSelection(row.selection),doc.plan,epoch]));
 return {doc,rootId,epoch,token};
}
export async function revisionSnapshot(repo:ReaderRepository,id:string,ownerId:string):Promise<RevisionSnapshot>{
 const row=await repo.get(id,ownerId),{doc,epoch,token}=await revisionBasis(repo,row);
 return {selection:selectionSchema.parse(JSON.parse(row.selection)),plan:doc.plan,images:doc.images,savedFrameCount:savedFrameCount(doc),...(doc.frameRecommendation?{frameRecommendation:doc.frameRecommendation}:{}),token,epoch,...(doc.revision?{revision:{parentId:doc.revision.parentId,rootId:doc.revision.rootId,number:doc.revision.number}}:{})};
}
export async function forkRevision(repo:ReaderRepository,media:MediaStore,ownerId:string,parentId:string,requestId:string,token:string,changes:RevisionChanges,paused=false,books?:LocalBooks){
 // Preserve fingerprints of requests saved before explicit paused submissions were added.
 const requestHash=hash(JSON.stringify([parentId,token,changes,...(paused?[true]:[])]));
 const replay=async()=>{
  const existing=await repo.db.prepare('SELECT * FROM reader_sessions WHERE id=?').bind(requestId).first<SessionRow>();
  if(!existing)return null;
  const revision=(JSON.parse(existing.document) as Document).revision;
  if(existing.user_id!==ownerId||revision?.parentId!==parentId||revision.requestHash!==requestHash)throw new ReaderError(409,'这个提交编号已用于其他修改，请重新打开编辑。');
  return repo.get(requestId,ownerId);
 };
 const existing=await replay();if(existing)return existing;
 if(await commandReceipt(repo.db,ownerId,requestId))throw new ReaderError(409,'这个操作编号已用于其他内容。');
 const row=await repo.get(parentId,ownerId),{doc,rootId,epoch,token:current}=await revisionBasis(repo,row);
 if(current!==token)throw new ReaderError(409,'故事或版本已更新，请重新载入后再修改。');
 const original:RevisionBase={selection:selectionSchema.parse(JSON.parse(row.selection)),plan:doc.plan,images:doc.images,savedFrameCount:savedFrameCount(doc),...(doc.frameRecommendation?{frameRecommendation:doc.frameRecommendation}:{})};
 const {selection,plan,impact}=checkedRevision(original,changes);
 let source=doc.original;
 if(changes.appendSource){
  if(!books||!plan||!source?.localSource||row.state!=='completed')throw new ReaderError(409,'请先完成有本地原文依据的故事，再追加后续原文。');
  const book=await books.book(selection);if(!book||!selection.source)throw new ReaderError(400,'追加只支持同一本本地原典。');
  const before=sourceParts(book,selection.source),added=sourceParts(book,changes.appendSource),last=before.at(-1)!,first=added[0];
  if(first.sectionIndex<last.sectionIndex||first.sectionIndex===last.sectionIndex&&first.first<=last.last)throw new ReaderError(400,'追加原文必须位于已有原文之后，不能重叠或倒序。');
  const selected=await books.selected(selection);
  if(!selected?.localSource||localSourceKey(selected.localSource)!==localSourceKey(source.localSource)||selected.text!==source.text)throw new ReaderError(409,'已存原文与当前本地版本不一致，未创建续篇。');
  selection.source=mergeSources(book,selection.source,changes.appendSource);
  selection.storyTitle=plan.title;selection.discovery={mode:'title',title:plan.title};delete selection.displayTitle;
  selection.length=selection.length==='auto'?'auto':plan.pages.length;
  source=(await books.storyOriginal(selection))!;
  plan.sourceReference=source.chapterContext?.title||source.title;
  original.preservedPages=original.plan!.pages.length;
 }
 const images:string[]=original.plan?.pages.map(()=> '')||[],lostPages:number[]=[];
 // Global image preferences cannot reuse old artwork. Other edits may reuse after planning.
 if(selection.artStyle===original.selection.artStyle&&selection.productionPrompt===original.selection.productionPrompt){
  for(let page=0;page<original.images.length;page++){
   const value=original.images[page]||'';
   if(!value)continue;
   const key=referenceImageKey(parentId,value);if(!key){if(changes.appendSource)throw new ReaderError(409,`第 ${page+1} 幅原图不可复用，未创建续篇。`);lostPages.push(page);continue;}
   const asset=await media.get(key).catch(()=>{throw new ReaderError(503,`第 ${page+1} 幅原图暂时无法读取，未创建新版，请稍后重试。`);});if(!asset){if(changes.appendSource)throw new ReaderError(409,`第 ${page+1} 幅原图缺失，未创建续篇。`);lostPages.push(page);continue;}
   const bytes=new Uint8Array(await asset.arrayBuffer()),type=mediaType(bytes);
   if(!type||!await readableImage(bytes).catch(()=>{throw new ReaderError(503,`第 ${page+1} 幅原图暂时无法核对，未创建新版，请稍后重试。`);})){if(changes.appendSource)throw new ReaderError(409,`第 ${page+1} 幅原图无法解码，未创建续篇。`);lostPages.push(page);continue;}
   const target=readerImageAsset(requestId,page,imageTypes[type],hash(bytes));
   await media.put(target.key,bytes,{contentType:type});images[page]=target.url;
  }
 }
 if(changes.appendSource&&images.filter(Boolean).length!==original.plan!.pages.length)throw new ReaderError(409,'前段原图不完整，未创建续篇。');
 const base={...original,images};
 const document:Document={publication:doc.publication,plan,original:source,frameRecommendation:changes.appendSource?undefined:doc.frameRecommendation,frameCountConfirmed:true,visualReview:newReview(),images:[],audio:[],usage:(doc.usage||[]).map(item=>({...item,originId:item.originId||parentId})),revision:{parentId,rootId,number:epoch+1,baseToken:token,requestHash,base,...(impact.replan?{}:{previewedRedraw:impact.redraw}),...(lostPages.length?{lostPages}:{})}};
 if(plan){const count=base.preservedPages;document.images=reusableRevisionImages(base,selection,plan,count?plan.pages.map((_,i)=>i<count?i:null):undefined);}
 if(impact.preserveScript){document.storyboard=doc.storyboard;document.draft=doc.draft;}
 const now=new Date().toISOString();
 const inserted=await repo.db.prepare(`INSERT INTO reader_sessions(id,user_id,selection,document,generation_mode,generation_control,state,step_attempts,lock_until,page,saved,last_read_at,created_at,updated_at)
  SELECT ?,?,json_patch(?,CASE WHEN ?=0 AND json_type(p.selection,'$.displayTitle')='text' THEN json_object('displayTitle',json_extract(p.selection,'$.displayTitle')) ELSE '{}' END),json_patch(?,json_object('publication',json_extract(p.document,'$.publication'))),'background',?,'idle',0,0,MIN(p.page,?),p.saved,p.last_read_at,?,? FROM reader_sessions p
  WHERE p.id=? AND p.user_id=? AND json_extract(p.document,'$.plan') IS json_extract(?,'$.plan') AND json_remove(p.selection,'$.displayTitle')=json_remove(?,'$.displayTitle')
  AND (json_extract(p.document,'$.plan') IS NOT NULL OR p.generation_control IN ('paused','stopped') OR ${supersededSql('p')})
  AND ${currentFamilyVersion('p')}
  AND (${familyEpoch.replace(' AS epoch','')})=?
  ON CONFLICT(id) DO NOTHING`)
  .bind(requestId,ownerId,JSON.stringify(selection),changes.appendSource?1:0,JSON.stringify(document),paused?'paused':'active',impact.total-1,now,now,parentId,ownerId,row.document,row.selection,ownerId,rootId,rootId,epoch).run();
 if(!inserted.meta.changes){const raced=await replay();if(raced)return raced;throw new ReaderError(409,'故事或版本已更新，请重新载入后再修改。');}
 return repo.get(requestId,ownerId);
}
