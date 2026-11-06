// English product messages; source identities and historical evidence stay stable.
// Persist owner-scoped defaults/checkpoints and serialize immediate retries without duplicating paid steps.
// Series children may be created paused; their immutable uploaded-source identity binds creation replay.
import {createHash} from 'node:crypto';
import {emptyDocument,ReaderError,selectionSchema,awaitingFrameCount} from './reader-model.ts';
import type {Selection,SessionRow,Document,Step,ProductionAction} from './reader-model.ts';
import type {OriginalSource} from './reader-source-types.ts';
import type {StoryPublication} from './story-publication';
import type {ArtRecommendation} from './reader-art-recommendation.ts';
// The interface keeps the same SQL testable against SQLite without a Worker runtime.
export interface Database{prepare(query:string):Statement}
interface Statement{bind(...values:unknown[]):Statement;first<T>():Promise<T|null>;all<T>():Promise<{results:T[]}>;run():Promise<{meta:{changes:number}}>}
const visible="NOT EXISTS (SELECT 1 FROM library_deletions d WHERE d.story_id=stories.id AND d.user_id=stories.user_id)";
export const familyRoot=(alias:string)=>`COALESCE(json_extract(CASE WHEN json_valid(${alias}.document) THEN ${alias}.document ELSE '{}' END,'$.revision.rootId'),${alias}.id)`;
export const familyNumber=(alias:string)=>`COALESCE(json_extract(CASE WHEN json_valid(${alias}.document) THEN ${alias}.document ELSE '{}' END,'$.revision.number'),1)`;
export const supersededSql=(alias='stories')=>`EXISTS(SELECT 1 FROM stories newer WHERE newer.user_id=${alias}.user_id AND ${familyRoot('newer')}=${familyRoot(alias)} AND ${familyNumber('newer')}>${familyNumber(alias)})`;
export const latestVersionMessage='This is an older version. Open the latest bookshelf version to continue.';
// A failed write says nothing about the work, so callers must not report it as a provider failure.
export const persistenceError=(error:unknown)=>(error as {code?:string}|null)?.code==='ERR_SQLITE_ERROR';
// Full checkpoints own the intake phase and may initialize an absent setup draft.
// A draft saved beside inference, including empty fields, wins as a complete object.
// Candidates, search and drafts change beside a running step,
// and the generation fence on every write below rejects a worker whose selection was replaced.
// Keep public metadata written during inference out of stale full-worker snapshots.
const checkpoint="json_patch(?,CASE WHEN json_type(document,'$.publication')='object' THEN json_object('publication',json_extract(document,'$.publication')) ELSE '{}' END)";
const workerDocument=`CASE WHEN json_type(document,'$.intake')='object' THEN json_set(${checkpoint},'$.intake',json(json_patch(json_set(json_extract(document,'$.intake'),'$.phase',json_extract(?,'$.intake.phase')),CASE WHEN json_type(document,'$.intake.draft') IS NOT 'object' AND json_type(?,'$.intake.draft')='object' THEN json_object('draft',json_extract(?,'$.intake.draft')) ELSE '{}' END))) ELSE ${checkpoint} END`;
export class ReaderRepository{
 db:Database;
 constructor(db:Database){this.db=db;}
 async superseded(id:string,uid:string){return !!await this.db.prepare(`SELECT id FROM stories WHERE id=? AND user_id=? AND ${supersededSql()}`).bind(id,uid).first();}
 async get(id:string,uid:string){const row=await this.db.prepare(`SELECT * FROM stories WHERE id = ? AND user_id = ? AND ${visible}`).bind(id,uid).first<SessionRow>();if(!row)throw new ReaderError(404,'This story is not on your bookshelf.');return row;}
 async current(id:string,uid:string){
  const origin=await this.db.prepare('SELECT * FROM stories WHERE id=? AND user_id=?').bind(id,uid).first<SessionRow>();
  if(!origin)throw new ReaderError(404,'This story is not on your bookshelf.');
  const doc=JSON.parse(origin.document) as Document;if(doc.reselection)throw new ReaderError(409,'This selection draft has not been submitted.');
  const root=doc.revision?.rootId||id;
  const latest=await this.db.prepare(`SELECT s.id FROM stories s WHERE s.user_id=? AND ${familyRoot('s')}=? ORDER BY ${familyNumber('s')} DESC,s.created_at DESC LIMIT 1`).bind(uid,root).first<{id:string}>();
  if(!latest)throw new ReaderError(404,'The current story version is unavailable.');return this.get(latest.id,uid);
 }
 // Explicit source translation uses the same CAS lock and preserves paused controls and retry identities.
 // Names belong to saved sessions, including source-only drafts; naming never starts production.
 // Target selection metadata only: an in-flight generation checkpoint cannot overwrite this name.
 async rename(id:string,uid:string,title:string){
  await this.get(id,uid);
  const result=await this.db.prepare(`UPDATE stories SET selection=json_set(selection,'$.displayTitle',?),updated_at=? WHERE id=? AND user_id=? AND ${visible}`)
   .bind(title,new Date().toISOString(),id,uid).run();
  if(!result.meta.changes)throw new ReaderError(404,'This story is not on your bookshelf.');
  return this.get(id,uid);
 }
 // Compare only publication metadata; independent image/progress saves must not conflict.
 async savePublication(id:string,uid:string,publication:StoryPublication,expected:StoryPublication|null){
  await this.get(id,uid);
  const result=await this.db.prepare(`UPDATE stories SET document=json_set(document,'$.publication',json(?)),updated_at=?
   WHERE id=? AND user_id=? AND json_type(document,'$.plan')='object' AND ${visible} AND NOT ${supersededSql()}
   AND json_extract(document,'$.publication') IS json_extract(?,'$')`)
   .bind(JSON.stringify(publication),new Date().toISOString(),id,uid,JSON.stringify(expected)).run();
  if(!result.meta.changes)throw new ReaderError(409,'Credits or the story version have changed. Reopen before saving.');
  return this.get(id,uid);
 }
 async publicationDefaults(uid:string){
  const row=await this.db.prepare('SELECT publication FROM reader_publication_defaults WHERE owner_id=?').bind(uid).first<{publication:string}>();
  return row?JSON.parse(row.publication) as StoryPublication:null;
 }
 async savePublicationDefaults(uid:string,publication:StoryPublication,expected:StoryPublication|null){
  const value=JSON.stringify(publication);
  const result=expected===null
   ?await this.db.prepare('INSERT INTO reader_publication_defaults(owner_id,publication) VALUES(?,?) ON CONFLICT(owner_id) DO NOTHING').bind(uid,value).run()
   :await this.db.prepare("UPDATE reader_publication_defaults SET publication=? WHERE owner_id=? AND json_extract(publication,'$') IS json_extract(?,'$')").bind(value,uid,JSON.stringify(expected)).run();
  if(!result.meta.changes)throw new ReaderError(409,'Default credits have changed in another operation. Reopen before saving.');
  return publication;
 }
 // Count every newer submission, including deleted ones, so deletion never promotes history.
 async list(uid:string){return (await this.db.prepare(`SELECT * FROM stories WHERE user_id = ? AND ${visible}
  AND json_type(CASE WHEN json_valid(document) THEN document ELSE '{}' END,'$.reselection') IS NULL
  AND NOT ${supersededSql()}
  ORDER BY COALESCE(last_read_at,created_at) DESC`).bind(uid).all<SessionRow>()).results;}
 async currentStoryIds(uid:string){return (await this.db.prepare('SELECT id FROM stories WHERE user_id=? ORDER BY id').bind(uid).all<{id:string}>()).results.map(row=>row.id);}
 async deletions(uid:string){
  return (await this.db.prepare(`SELECT d.story_id AS storyId,d.deleted_at AS deletedAt,d.kind,
   COALESCE(json_extract(s.selection,'$.displayTitle'),json_extract(s.document,'$.plan.title'),json_extract(s.selection,'$.storyTitle'),'Untitled story') AS title
   FROM library_deletions d
   LEFT JOIN stories s ON s.id=d.story_id AND s.user_id=d.user_id
   WHERE d.user_id=? AND d.kind='generated' AND (s.id IS NULL OR json_type(s.document,'$.reselection') IS NULL)
   ORDER BY d.deleted_at DESC,d.story_id`).bind(uid).all<{storyId:string;deletedAt:string;kind:'generated';title:string}>()).results;
 }
 async remove(id:string,uid:string){
  const owned=await this.db.prepare('SELECT id FROM stories WHERE id=? AND user_id=?').bind(id,uid).first();
  if(!owned)throw new ReaderError(404,'This story is not on your bookshelf.');
  const existing=await this.db.prepare('SELECT story_id AS storyId,deleted_at AS deletedAt FROM library_deletions WHERE user_id=? AND story_id=?').bind(uid,id).first<{storyId:string;deletedAt:string}>();if(existing)return existing;
  const deletedAt=new Date().toISOString();await this.db.prepare("INSERT INTO library_deletions(user_id,story_id,kind,deleted_at) VALUES(?,?,'generated',?) ON CONFLICT(user_id,story_id) DO NOTHING").bind(uid,id,deletedAt).run();
  return {storyId:id,deletedAt};
 }
 async restore(id:string,uid:string){
  const owned=await this.db.prepare('SELECT id FROM stories WHERE id=? AND user_id=?').bind(id,uid).first();
  if(!owned)throw new ReaderError(404,'This story is not on your bookshelf.');
  const result=await this.db.prepare('DELETE FROM library_deletions WHERE user_id=? AND story_id=?').bind(uid,id).run();
  return {storyId:id,restored:result.meta.changes>0};
 }
 async favorite(id:string,uid:string,saved:boolean){
  // Favorites never move a reading checkpoint or enqueue production.
  const row=await this.db.prepare(`UPDATE stories SET saved=? WHERE id=? AND user_id=? AND ${visible} RETURNING page,saved,COALESCE(last_read_at,created_at) AS updatedAt`)
   .bind(saved?1:0,id,uid).first<{page:number;saved:number;updatedAt:string}>();
  if(!row)throw new ReaderError(404,'This story is not on your bookshelf.');
  return {storyId:id,...row};
 }
 async control(id:string,uid:string,action:ProductionAction,handoffOnly=false){
  const row=await this.get(id,uid);
  const revision=(JSON.parse(row.document) as Document).revision;
  const startsGeneration=action==='resume'||action==='background';
  if(startsGeneration&&await this.superseded(id,uid))throw new ReaderError(409,latestVersionMessage);
  if(handoffOnly&&!revision?.handoff)return row;
  if(row.state==='completed')throw new ReaderError(409,'The story is complete; its generation mode does not need changing.');
  // Resume always continues the whole story; other legacy actions change only their own field.
  const field=action==='background'||action==='reader'?'generation_mode':'generation_control';
  const value=action==='pause'?'paused':action==='stop'?'stopped':action==='resume'?'active':action;
  const assignment=action==='resume'?"generation_mode='background',generation_control=?":`${field}=?`;
  const result=await this.db.prepare(`UPDATE stories SET ${assignment}${revision&&(action==='resume'||action==='pause')?",document=json_remove(document,'$.revision.handoff')":''} WHERE id=? AND user_id=? AND state!='completed' AND ${visible}${startsGeneration?` AND NOT ${supersededSql()}`:''}${handoffOnly?" AND json_extract(document,'$.revision.handoff')=1":''}`)
   .bind(value,id,uid).run();
  if(startsGeneration&&!result.meta.changes&&await this.superseded(id,uid))throw new ReaderError(409,latestVersionMessage);
  return this.get(id,uid);
 }
 async saveOriginal(row:SessionRow,original:OriginalSource){
  const recovered=row.state==='failed'&&(row.step_key==='source'||row.step_key==='plan');
  const result=await this.db.prepare("UPDATE stories SET document=json_set(document,'$.original',json(?)),state=CASE WHEN ? THEN 'idle' ELSE state END,error=CASE WHEN ? THEN NULL ELSE error END,updated_at=? WHERE id=? AND user_id=? AND document=? AND state!='running'").bind(JSON.stringify(original),recovered?1:0,recovered?1:0,new Date().toISOString(),row.id,row.user_id,row.document).run();
  if(!result.meta.changes)throw new ReaderError(409,'The story is updating. Save the source again shortly.');
  return this.get(row.id,row.user_id);
 }
 async create(id:string,uid:string,selection:Selection,document:Document=emptyDocument(),paused=false){
 const imported=document.original?.imported,sourceIdentity=imported?{sourceId:imported.sourceId,fileSha256:imported.fileSha256,textSha256:imported.textSha256,start:imported.start,end:imported.end,seriesId:imported.seriesId,partRootId:imported.partRootId,partNumber:imported.partNumber,partCount:imported.partCount,text:document.original!.text}:null;
 const normalized=selectionSchema.parse(selection),creationHash=createHash('sha256').update(JSON.stringify([normalized,!!document.intake,document.reselection||null,...(document.copiedFrom?[document.copiedFrom]:[]),...(sourceIdentity?[sourceIdentity]:[])])).digest('hex');
 const command=await this.db.prepare('SELECT request_id FROM reader_commands WHERE owner_id=? AND request_id=?').bind(uid,id).first();if(command)throw new ReaderError(409,'This creation ID was used for another operation.');
 const now=new Date().toISOString(),saved=JSON.stringify({...document,creationHash});
 // Read defaults inside the insert: retries cannot change a story's original attribution snapshot.
 await this.db.prepare(`INSERT INTO stories(id,user_id,selection,document,generation_mode,generation_control,state,step_attempts,lock_until,page,saved,created_at,updated_at) VALUES(?,?,?,COALESCE((SELECT json_set(?,'$.publication',json(publication)) FROM reader_publication_defaults WHERE owner_id=?),?),?,?,'idle',0,0,0,0,?,?) ON CONFLICT(id) DO NOTHING`).bind(id,uid,JSON.stringify(selection),saved,uid,saved,document.reselection?'reader':'background',document.copiedFrom||paused?'paused':'active',now,now).run();
 const row=await this.get(id,uid),doc=JSON.parse(row.document) as Document;
 if(doc.creationHash?doc.creationHash!==creationHash:doc.revision||doc.intake?.creationHash!==document.intake?.creationHash||JSON.stringify(selectionSchema.parse(JSON.parse(row.selection)))!==JSON.stringify(normalized))throw new ReaderError(409,'This creation ID has already been used for different content. Start a new request.');
 return row;}
 async confirmFrameCount(id:string,uid:string,count:Selection['length']){
  const row=await this.get(id,uid),selection=selectionSchema.parse(JSON.parse(row.selection)),doc=JSON.parse(row.document) as Document;
  if(doc.intake)throw new ReaderError(409,'Confirm the story, style, frame count and creative requirements together.');
  if(doc.frameCountConfirmed&&selection.length===count)return row;
  if(row.state==='running'||!awaitingFrameCount(doc,selection))throw new ReaderError(409,'The count is already set or the story is updating. Reopen to continue.');
  const updated=await this.db.prepare(`UPDATE stories SET selection=?,document=?,state='idle',error=NULL,updated_at=? WHERE id=? AND user_id=? AND state=? AND document=? AND selection=? AND ${visible}`)
   .bind(JSON.stringify({...selection,length:count}),JSON.stringify({...doc,frameCountConfirmed:true}),new Date().toISOString(),id,uid,row.state,row.document,row.selection).run();
  if(!updated.meta.changes){
   const current=await this.get(id,uid),saved=JSON.parse(current.document) as Document;
   if(saved.frameCountConfirmed&&selectionSchema.parse(JSON.parse(current.selection)).length===count)return current;
   throw new ReaderError(409,'Another operation set the frame count. Reopen to continue.');
  }
  return this.get(id,uid);
 }
 async stale(row:SessionRow){await this.db.prepare("UPDATE stories SET state='failed',error=?,lock_token=NULL,updated_at=? WHERE id=? AND user_id=? AND state='running' AND lock_until<=?").bind('Generation timed out. Progress is saved; retry explicitly.',new Date().toISOString(),row.id,row.user_id,Date.now()).run();return this.get(row.id,row.user_id);}
 async acquire(row:SessionRow,step:Step,sourceTranslation=false){const token=crypto.randomUUID(),now=Date.now();const r=await this.db.prepare(`UPDATE stories SET state='running',error=NULL,lock_token=?,lock_until=?,step_attempts=CASE WHEN ? THEN step_attempts WHEN step_key=? THEN step_attempts+1 ELSE 1 END,step_key=CASE WHEN ? THEN step_key ELSE ? END,updated_at=? WHERE id=? AND user_id=? AND state=? AND document=? AND state!='running' AND (generation_control='active' OR ?) AND ${visible} AND NOT ${supersededSql()}`).bind(token,now+180000,sourceTranslation&&step.kind==='source'?1:0,step.key,sourceTranslation&&step.kind==='source'?1:0,step.key,new Date(now).toISOString(),row.id,row.user_id,row.state,row.document,sourceTranslation&&step.kind==='source'?1:0).run();return r.meta.changes?token:null;}
 async saveArtRecommendation(row:SessionRow,token:string,doc:Document,recommendation:ArtRecommendation){
  const chosen=doc.intake?.selected;if(!chosen)throw new ReaderError(409,'Select a story first.');
  // Merge only this result; drafts and new search batches may have arrived during inference.
  // Read manualArt in SQLite so a concurrent manual choice always wins.
  const result=await this.db.prepare(`UPDATE stories SET document=json_set(document,?,json(?)),
   selection=CASE WHEN COALESCE(json_extract(document,'$.intake.manualArt'),0)=0 THEN json_set(selection,'$.artStyle',?) ELSE selection END,updated_at=?
   WHERE id=? AND user_id=? AND state='running' AND lock_token=? AND json_extract(document,'$.intake.generation')=?`)
   .bind(`$.intake.batches[${chosen.batch}].stories[${chosen.index}].artRecommendation`,JSON.stringify(recommendation),recommendation.artStyle,new Date().toISOString(),row.id,row.user_id,token,doc.intake!.generation).run();
  if(result.meta.changes!==1)throw new ReaderError(409,'The story has changed. Reopen it to continue.');
 }
 async saveImageProgress(row:SessionRow,token:string,snapshot:Document){
  // Deletion hides the session but must still retain results of calls already in flight.
  const saved=JSON.stringify(snapshot),result=await this.db.prepare(`UPDATE stories SET document=${workerDocument},updated_at=? WHERE id=? AND user_id=? AND state='running' AND lock_token=? AND COALESCE(json_extract(document,'$.intake.generation'),-1)=?`)
   .bind(saved,saved,saved,saved,saved,new Date().toISOString(),row.id,row.user_id,token,snapshot.intake?.generation??-1).run();
  if(result.meta.changes!==1)throw new ReaderError(409,'The story has changed. Reopen it to continue.');
 }
 async save(row:SessionRow,token:string,doc:Document,complete:boolean,error:string|null=null,progressMap?:number[]){const saved=JSON.stringify(doc),map=progressMap?JSON.stringify(progressMap):null,r=await this.db.prepare(`UPDATE stories SET document=${workerDocument},state=CASE WHEN ? THEN 'failed' WHEN ? AND NOT EXISTS(SELECT 1 FROM reader_faults f WHERE f.session_id=stories.id AND f.owner_id=stories.user_id AND f.state IN ('pending','recovering')) THEN 'completed' ELSE 'idle' END,error=?,page=CASE WHEN ? IS NULL THEN page ELSE COALESCE(json_extract(?, '$['||page||']'),MAX(0,MIN(page,?))) END,lock_token=NULL,lock_until=0,updated_at=? WHERE id=? AND user_id=? AND lock_token=? AND COALESCE(json_extract(document,'$.intake.generation'),-1)=?`).bind(saved,saved,saved,saved,saved,error?1:0,complete?1:0,error,map,map,Math.max(0,(doc.plan?.pages.length||1)-1),new Date().toISOString(),row.id,row.user_id,token,doc.intake?.generation??-1).run();if(!r.meta.changes)throw new ReaderError(409,'The story has changed. Reopen it to continue.');return this.get(row.id,row.user_id);}
 async progress(id:string,uid:string,page:number,saved:boolean){
  const row=await this.get(id,uid),doc=JSON.parse(row.document) as Document;if(!doc.plan||!doc.images[page])throw new ReaderError(400,'This frame is not ready yet.');
  // A late reader cannot overwrite a structural save's remapped position. Image publication is independent.
  const result=await this.db.prepare(`UPDATE stories SET page=?,saved=?,last_read_at=? WHERE id=? AND user_id=? AND ${visible} AND json_extract(document,'$.plan')=json(?)`).bind(page,saved?1:0,new Date().toISOString(),id,uid,JSON.stringify(doc.plan)).run();
  if(!result.meta.changes)throw new ReaderError(409,'The storyboard has changed. Reopen to continue reading.');return this.get(id,uid);
 }
}
