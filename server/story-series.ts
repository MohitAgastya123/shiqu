// Keep uploaded bytes private and commission lossless ordered parts through ordinary production sessions.
// Reads never activate work; immutable source plans, versioned actions and atomic activation survive replay.
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {ReaderError,emptyDocument,view,readableStory,selectionSchema} from '../lib/reader-model.ts';
import type {Document,SessionRow,SessionView} from '../lib/reader-model.ts';
import {ReaderRepository,familyRoot,familyNumber,supersededSql} from '../lib/reader-repository.ts';
import type {Database} from '../lib/reader-repository.ts';
import type {MediaStore} from '../lib/services.ts';
import type {ReaderProduction} from '../lib/reader-production.ts';
import type {OriginalSource} from '../lib/reader-source-types.ts';
import {storyImportLimits,defaultStoryImportSettings,storyImportTitleSchema,storyImportSettingsSchema} from '../lib/story-import-contract.ts';
import type {ImportedSourceMetadata,ImportedSourceView,StoryImportPlan,StoryImportResult,StorySeriesCreate,StorySeriesControl,StorySeriesView,ImportPartPlan,ImportSourceUnit,StoryImportSettings} from '../lib/story-import-contract.ts';
import {planImportedStory,importWordCount,ImportTextError} from '../lib/story-import-text.ts';
import {extractStoryImport} from './story-import-extract.ts';
import {BookImageReferences} from './book-image-reference.ts';
import {completePredecessorsSql,storySeriesMembership,seriesMemberSql,seriesEligibleSql} from './story-series-membership.ts';
const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
const uuid=z.string().uuid();
export function mergeSeriesCharacters(earlier:string,current:string){
 const lines:string[]=[],named=new Map<string,number>(),seen=new Set<string>();
 for(const line of [earlier,current].flatMap(text=>text.split(/\r?\n/)).map(line=>line.trim()).filter(Boolean)){
  const label=/^([^:\n]{1,100}):\s*(.+)$/u.exec(line),key=label?.[1].normalize('NFKC').toLowerCase();
  if(key){const index=named.get(key);if(index!==undefined)lines[index]=line;else{named.set(key,lines.length);lines.push(line);}}
  else if(!seen.has(line)){seen.add(line);lines.push(line);}
 }
 const value=lines.join('\n');if(value.length>64000)throw new ReaderError(409,'The shared character history exceeds 64,000 characters. The source and completed parts are retained; simplify the character descriptions before continuing.');return value;
}
type SourceRow={id:string;owner_id:string;file_name:string;format:'docx'|'pdf';file_sha256:string;text_sha256:string;text:string;units:string;characters:number;word_count:number;page_count:number|null;warnings:string;created_at:string};
type ReservedPart=ImportPartPlan&{rootId:string};
type SeriesRow={id:string;owner_id:string;source_id:string;title:string;settings:string;parts:string;fingerprint:string;state:'active'|'paused'|'stopped'|'completed';version:number;error:string|null;created_at:string;updated_at:string};
type PartRow={series_id:string;owner_id:string;number:number;root_id:string;plan:string;activated:number};
const sourceColumns='id,owner_id,file_name,format,file_sha256,text_sha256,text,units,characters,word_count,page_count,warnings,created_at';
const metadata=(row:Omit<SourceRow,'text'|'units'>):ImportedSourceMetadata=>({id:row.id,fileName:row.file_name,format:row.format,fileSha256:row.file_sha256,textSha256:row.text_sha256,characters:row.characters,wordCount:row.word_count,pageCount:row.page_count,warnings:JSON.parse(row.warnings)});
function plan(source:SourceRow,title:string,settings:StoryImportSettings):StoryImportPlan{
 try{return {sourceId:source.id,title,settings,parts:planImportedStory({text:source.text,units:JSON.parse(source.units)},title,settings.narrativeDetail),sourceCharacters:source.characters,wordCount:source.word_count};}
 catch(error){if(error instanceof ImportTextError)throw new ReaderError(error.status,error.message);throw error;}
}
function preview(source:SourceRow,offset=0,limit=6000):ImportedSourceView{
 let start=Math.min(source.text.length,offset),end=Math.min(source.text.length,start+limit);
 if(start>0&&/[\uDC00-\uDFFF]/.test(source.text[start]||''))start--;
 if(end<source.text.length&&/[\uDC00-\uDFFF]/.test(source.text[end]||''))end++;
 return {...metadata(source),preview:{text:source.text.slice(start,end),start,end,total:source.characters,hasMore:end<source.characters}};
}
export class StorySeries{
 readonly database:Database;readonly repository:ReaderRepository;private media:MediaStore;private root:string;private syncing:Promise<void>|undefined;private production:Pick<ReaderProduction,'snapshot'>|undefined;
 constructor(database:Database,media:MediaStore,root:string){this.database=database;this.repository=new ReaderRepository(database);this.media=media;this.root=root;}
 connectProduction(production:Pick<ReaderProduction,'snapshot'>){this.production=production;}
 private async source(id:string,owner:string){const row=await this.database.prepare(`SELECT ${sourceColumns} FROM story_import_sources WHERE id=? AND owner_id=?`).bind(id,owner).first<SourceRow>();if(!row)throw new ReaderError(404,'This uploaded story is not in your library.');if(hash(row.text)!==row.text_sha256)throw new ReaderError(409,'The saved uploaded text could not be verified. Upload a fresh readable copy.');return row;}
 private async row(id:string,owner:string){const row=await this.database.prepare('SELECT * FROM story_series WHERE id=? AND owner_id=?').bind(id,owner).first<SeriesRow>();if(!row)throw new ReaderError(404,'This comic series is not in your library.');return row;}
 async upload(owner:string,fileName:string,bytes:Uint8Array,requestId:string):Promise<StoryImportResult>{
  uuid.parse(requestId);if(bytes.length>storyImportLimits.fileBytes)throw new ReaderError(413,'Choose a Word or PDF file of at most 10 MB.');
  const name=Array.from(fileName.split(/[\\/]/).at(-1)!).filter(character=>character.codePointAt(0)!>=32&&character.codePointAt(0)!==127).join(''),digest=hash(bytes);
  if(name.length>240)throw new ReaderError(400,'Use a file name of at most 240 characters.');
  const existing=await this.database.prepare(`SELECT ${sourceColumns} FROM story_import_sources WHERE id=?`).bind(requestId).first<SourceRow>();
  if(existing&&(existing.owner_id!==owner||existing.file_sha256!==digest||existing.file_name!==name))throw new ReaderError(409,'This upload request was already used for another file. Choose the file again.');
  if(!existing){
   const extracted=await extractStoryImport(name,bytes,this.root),now=new Date().toISOString();
   await this.database.prepare('INSERT INTO story_import_sources(id,owner_id,file_name,format,file_sha256,text_sha256,original_bytes,text,units,characters,word_count,page_count,warnings,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING')
    .bind(requestId,owner,name,extracted.format,digest,hash(extracted.text),bytes,extracted.text,JSON.stringify(extracted.units),extracted.text.length,importWordCount(extracted.text),extracted.pageCount,JSON.stringify(extracted.warnings),now).run();
  }
  const saved=await this.source(requestId,owner);if(saved.file_sha256!==digest||saved.file_name!==name)throw new ReaderError(409,'This upload request was already used for another file.');
  const title=storyImportTitleSchema.parse(name.replace(/\.(docx|pdf)$/i,'').trim().slice(0,140)||'Imported story');
  try{return {source:preview(saved),plan:plan(saved,title,{...defaultStoryImportSettings})};}
  catch(error){if(error instanceof ReaderError&&error.status===400)return {source:preview(saved),plan:null,planningError:error.message};throw error;}
 }
 async importedSource(owner:string,id:string,offset=0,limit=6000){return preview(await this.source(uuid.parse(id),owner),offset,limit);}
 async plan(owner:string,id:string,title:string,settings:StoryImportSettings){return plan(await this.source(uuid.parse(id),owner),storyImportTitleSchema.parse(title),storyImportSettingsSchema.parse(settings));}
 private async reserve(row:SeriesRow,source:SourceRow){
  for(const part of JSON.parse(row.parts) as ReservedPart[])await this.database.prepare('INSERT INTO story_series_parts(series_id,owner_id,number,root_id,plan,source_text) VALUES(?,?,?,?,?,?) ON CONFLICT(series_id,number) DO NOTHING').bind(row.id,row.owner_id,part.number,part.rootId,JSON.stringify(part),source.text.slice(part.start,part.end)).run();
 }
 async create(owner:string,input:StorySeriesCreate):Promise<StorySeriesView>{
  const source=await this.source(input.sourceId,owner),fingerprint=hash(JSON.stringify([source.id,source.file_sha256,source.text_sha256,input.title,input.settings]));
  const existing=await this.database.prepare('SELECT * FROM story_series WHERE id=?').bind(input.requestId).first<SeriesRow>();
  if(existing&&(existing.owner_id!==owner||existing.fingerprint!==fingerprint))throw new ReaderError(409,'This creation request was already used with different story settings. Start a new request.');
  if(await this.database.prepare('SELECT request_id FROM story_series_actions WHERE request_id=? AND owner_id=?').bind(input.requestId,owner).first())throw new ReaderError(409,'This request ID was already used for a series action.');
  if(!existing){
   const planned=plan(source,input.title,input.settings),parts=planned.parts.map(part=>({...part,rootId:randomUUID()})),now=new Date().toISOString();
   await this.database.prepare('INSERT INTO story_series(id,owner_id,source_id,title,settings,parts,fingerprint,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(input.requestId,owner,source.id,input.title,JSON.stringify(input.settings),JSON.stringify(parts),fingerprint,now,now).run();
  }
  const saved=await this.row(input.requestId,owner);if(saved.fingerprint!==fingerprint)throw new ReaderError(409,'This creation request was already used with different story settings.');
  await this.reserve(saved,source);return this.get(owner,saved.id);
 }
 async list(owner:string){const rows=(await this.database.prepare('SELECT id FROM story_series WHERE owner_id=? ORDER BY created_at DESC,id').bind(owner).all<{id:string}>()).results;return Promise.all(rows.map(row=>this.get(owner,row.id)));}
 private async latest(owner:string,rootId:string){return this.database.prepare(`SELECT s.*,EXISTS(SELECT 1 FROM library_deletions d WHERE d.story_id=s.id AND d.user_id=s.user_id) AS deleted FROM stories s WHERE s.user_id=? AND ${familyRoot('s')}=? ORDER BY ${familyNumber('s')} DESC,s.created_at DESC LIMIT 1`).bind(owner,rootId).first<SessionRow&{deleted:number}>();}
 async get(owner:string,id:string):Promise<StorySeriesView>{
  const row=await this.row(uuid.parse(id),owner),source=await this.database.prepare('SELECT id,owner_id,file_name,format,file_sha256,text_sha256,characters,word_count,page_count,warnings,created_at FROM story_import_sources WHERE id=? AND owner_id=?').bind(row.source_id,owner).first<Omit<SourceRow,'text'|'units'>>();
  if(!source)throw new ReaderError(409,'The saved source for this comic series is unavailable.');
  type Summary={number:number;root_id:string;activated:number;id:string|null;state:SessionRow['state']|null;generation_control:string|null;error:string|null;deleted:number;valid:number;ready:number;total:number|null;faulted:number;member:number;imported:string|null;copied:string|null;matchesText:number};
  // Materialize validity once and project only compact source proof/status; prompt histories never enter JS.
  const summaries=(await this.database.prepare(`WITH current_parts AS MATERIALIZED (
    SELECT p.number,p.root_id,p.activated,p.source_text,s.id,s.user_id,s.state,s.generation_control,s.error,s.document,json_valid(s.document) AS valid
    FROM story_series_parts p LEFT JOIN stories s ON s.id=(SELECT candidate.id FROM stories candidate WHERE candidate.user_id=p.owner_id AND ${familyRoot('candidate')}=p.root_id ORDER BY ${familyNumber('candidate')} DESC,candidate.created_at DESC LIMIT 1)
    WHERE p.series_id=? AND p.owner_id=?
   ),compact AS MATERIALIZED (
    SELECT number,root_id,activated,id,user_id,state,generation_control,error,valid,
     CASE WHEN valid THEN json_extract(document,'$.original.imported') END AS imported,
     CASE WHEN valid THEN json_extract(document,'$.copiedFrom') END AS copied,
     CASE WHEN valid THEN json_extract(document,'$.original.text')=source_text ELSE 0 END AS matchesText,
     CASE WHEN valid THEN json_extract(document,'$.images') END AS images,
     CASE WHEN valid THEN json_array_length(document,'$.plan.pages') END AS total
    FROM current_parts
   ) SELECT number,root_id,activated,id,state,generation_control,error,valid,imported,copied,matchesText,total,
    EXISTS(SELECT 1 FROM library_deletions d WHERE d.story_id=compact.id AND d.user_id=compact.user_id) AS deleted,
    (SELECT COUNT(*) FROM json_each(compact.images) image WHERE image.value!='' AND image.value IS NOT NULL) AS ready,
    EXISTS(SELECT 1 FROM reader_faults fault WHERE fault.session_id=compact.id AND fault.owner_id=compact.user_id AND fault.state IN ('pending','recovering')) AS faulted
    FROM compact ORDER BY number`).bind(id,owner).all<Summary>()).results;
  const reserved=JSON.parse(row.parts) as ReservedPart[],byNumber=new Map(summaries.map(summary=>[summary.number,summary]));
  for(const summary of summaries){
   let proof;try{proof=JSON.parse(summary.imported||'null');}catch{proof=null;}
   const part=reserved.find(part=>part.number===summary.number);
   summary.member=Number(!!part&&summary.root_id===part.rootId&&summary.matchesText===1&&summary.copied===null&&proof?.partRootId===part.rootId&&proof.seriesId===row.id&&proof.sourceId===source.id&&proof.fileSha256===source.file_sha256&&proof.textSha256===source.text_sha256&&proof.start===part.start&&proof.end===part.end&&proof.partNumber===part.number&&proof.partCount===reserved.length);
  }
  const parts=await Promise.all((JSON.parse(row.parts) as ReservedPart[]).map(async part=>{
   const child=byNumber.get(part.number);
   let state:'waiting'|'running'|'paused'|'failed'|'completed'='waiting',ready=child?.ready||0,total=child?.total??null,stage='Waiting for earlier parts',error:string|null=null;
   if(child?.id){
    if(child.deleted){state='failed';error='This part was removed from the bookshelf. Restore it before continuing the series.';stage='Part removed';}
    else if(!child.valid||!child.member){state='failed';error='The reserved part belongs to different source content or cannot be read. Saved stories have been retained.';stage='Part needs attention';}
    else if(child.state==='completed'&&!child.faulted&&total!==null&&total>0&&ready===total){state='completed';stage='Story complete';}
    else{
     try{
      const current=this.production?await this.production.snapshot(owner,child.id):view((await this.latest(owner,part.rootId))!);ready=current.ready;total=current.story?.pages.length??null;stage=current.stage;error=current.error;
      state=current.state==='completed'?'completed':!child.activated?'waiting':current.state==='failed'?'failed':row.state!=='active'||current.generationControl!=='active'?'paused':!await this.eligible({id:child.id,user_id:owner})?'waiting':'running';
      if(state==='waiting')stage='Waiting for earlier parts';
     }catch{state='failed';error='This part cannot be read. Its saved source has been retained.';stage='Part needs attention';}
    }
   }
   return {...part,rootId:part.rootId,sessionId:child?.id&&!child.deleted&&child.member?child.id:null,state,ready,total,stage,error};
  }));
  const completed=parts.filter(part=>part.state==='completed').length,problem=row.error||parts.find(part=>part.state==='failed')?.error||null;
  const state=completed===parts.length?'completed':row.state==='paused'||row.state==='stopped'?row.state:problem||parts.some(part=>part.state==='paused')?'needs-attention':'active';
  return {id:row.id,title:row.title,source:metadata(source),settings:JSON.parse(row.settings),version:row.version,state,parts,completedParts:completed,totalParts:parts.length,error:problem,createdAt:row.created_at,updatedAt:row.updated_at};
 }
 async control(owner:string,id:string,input:StorySeriesControl){
  const row=await this.row(id,owner),fingerprint=hash(JSON.stringify([id,input.version,input.action]));
  const replay=await this.database.prepare('SELECT fingerprint FROM story_series_actions WHERE request_id=? AND owner_id=?').bind(input.requestId,owner).first<{fingerprint:string}>();
  if(replay){if(replay.fingerprint!==fingerprint)throw new ReaderError(409,'This request ID was already used for another series action.');return this.get(owner,id);}
  if(await this.database.prepare('SELECT id FROM story_series WHERE id=? AND owner_id=?').bind(input.requestId,owner).first())throw new ReaderError(409,'This request ID was already used to create a series.');
  if(row.state==='completed')throw new ReaderError(409,'This comic series is complete.');
  await this.database.prepare(`INSERT INTO story_series_actions(request_id,owner_id,series_id,action,fingerprint,expected_version,result_version,created_at) SELECT ?,?,?,?,?,?,?,? FROM story_series WHERE id=? AND owner_id=? AND version=? AND state!='completed' ON CONFLICT(owner_id,request_id) DO NOTHING`).bind(input.requestId,owner,id,input.action,fingerprint,input.version,input.version+1,new Date().toISOString(),id,owner,input.version).run();
  const saved=await this.database.prepare('SELECT fingerprint FROM story_series_actions WHERE request_id=? AND owner_id=?').bind(input.requestId,owner).first<{fingerprint:string}>();
  if(!saved||saved.fingerprint!==fingerprint)throw new ReaderError(409,'The series changed. Refresh before choosing an action.');return this.get(owner,id);
 }
 async decorate(session:SessionView,row:Pick<SessionRow,'id'|'user_id'>){
  if(!session.story||!session.story.original?.imported&&!session.story.series)return session;
  const membership=await storySeriesMembership(this.database,row),story={...session.story};delete story.series;if(membership)story.series=membership;return {...session,story};
 }
 async eligible(row:Pick<SessionRow,'id'|'user_id'>){return !!await this.database.prepare(`SELECT s.id FROM stories s WHERE s.id=? AND s.user_id=? AND ${seriesEligibleSql('s')}`).bind(row.id,row.user_id).first();}
 async requireStarted(owner:string,id:string){
  if(await this.database.prepare(`SELECT s.id FROM stories s JOIN story_series_parts p ON p.root_id=${familyRoot('s')} AND p.owner_id=s.user_id WHERE s.id=? AND s.user_id=? AND p.activated=0 AND ${seriesMemberSql('s')}`).bind(id,owner).first())throw new ReaderError(409,'This part is waiting to start. Open the comic series to pause or resume it; earlier parts must finish first.');
 }
 async requireRecoveryAllowed(owner:string,id:string){
  if(await this.database.prepare(`SELECT s.id FROM stories s JOIN story_series_parts p ON p.root_id=${familyRoot('s')} AND p.owner_id=s.user_id JOIN story_series r ON r.id=p.series_id AND r.owner_id=s.user_id WHERE s.id=? AND s.user_id=? AND r.state IN ('paused','stopped') AND ${seriesMemberSql('s')}`).bind(id,owner).first())throw new ReaderError(409,'Resume the comic series before retrying this part.');
 }
 async sync(targetSessionId?:string){if(this.syncing)return this.syncing;const task=this.reconcile(targetSessionId);this.syncing=task;try{await task;}finally{if(this.syncing===task)this.syncing=undefined;}}
 private async reconcile(targetSessionId?:string){
  const rows=(await this.database.prepare("SELECT * FROM story_series WHERE state='active' AND error IS NULL ORDER BY created_at,id").all<SeriesRow>()).results;
  for(const row of rows){
   if(targetSessionId&&!(JSON.parse(row.parts) as ReservedPart[]).some(part=>part.rootId===targetSessionId))continue;
   try{
    const source=await this.source(row.source_id,row.owner_id);await this.reserve(row,source);const parts=(JSON.parse(row.parts) as ReservedPart[]);
    let previous:SessionRow|null=null,allComplete=true;
    for(const part of parts){
     let child=await this.latest(row.owner_id,part.rootId);
     if(child?.deleted)break;
     if(child?.state==='completed'&&!await this.database.prepare("SELECT id FROM reader_faults WHERE session_id=? AND owner_id=? AND state IN ('pending','recovering') LIMIT 1").bind(child.id,child.user_id).first()){previous=child;continue;}
     allComplete=false;
     if(targetSessionId&&part.rootId!==targetSessionId)break;
     const slot=await this.database.prepare('SELECT * FROM story_series_parts WHERE series_id=? AND owner_id=? AND number=?').bind(row.id,row.owner_id,part.number).first<PartRow>();
     if(slot?.activated)break;
     const settings=storyImportSettingsSchema.parse(JSON.parse(row.settings)),units=JSON.parse(source.units) as ImportSourceUnit[];
     const original:OriginalSource={title:part.title,text:source.text.slice(part.start,part.end),url:'',kind:'passage',provider:`Uploaded ${source.format.toUpperCase()} document`,retrievedAt:source.created_at,imported:{sourceId:source.id,fileName:source.file_name,format:source.format,fileSha256:source.file_sha256,textSha256:source.text_sha256,start:part.start,end:part.end,unitIds:units.filter(unit=>unit.start>=part.start&&unit.end<=part.end).map(unit=>unit.id),seriesId:row.id,seriesTitle:row.title,partRootId:part.rootId,partNumber:part.number,partCount:parts.length}};
     if(previous){const prior=JSON.parse(previous.document) as Document;if(prior.plan)original.imported!.continuity={characters:mergeSeriesCharacters(prior.original?.imported?.continuity?.characters||'',prior.plan.characters),previousSummary:prior.plan.summary,previousEnding:[prior.plan.pages.at(-1)?.caption||'',...(prior.plan.pages.at(-1)?.bubbles||[]).map(bubble=>bubble.text)].join('\n')};}
     if(!child){const document={...emptyDocument(),original};child={...await this.repository.create(part.rootId,row.owner_id,selectionSchema.parse({bookId:'other',customBook:row.title,storyTitle:part.title.slice(0,100),displayTitle:part.title,theme:'Original story',length:'auto',...settings}),document,true),deleted:0};}
     else if(!readableStory(child))throw new ReaderError(409,'The next part cannot be read. Its source has been retained.');
     else if(!await storySeriesMembership(this.database,child))throw new ReaderError(409,'The reserved part belongs to different source content. Saved stories have been retained.');
     else{
      const saved=JSON.parse(child.document) as Document;
      if(saved.original?.imported&&JSON.stringify(saved.original.imported.continuity)!==JSON.stringify(original.imported?.continuity)){
       saved.original.imported.continuity=original.imported?.continuity;
       await this.database.prepare(`UPDATE stories AS s SET document=? WHERE id=? AND user_id=? AND document=? AND generation_control='paused' AND state='idle' AND ${seriesMemberSql('s')} AND EXISTS(SELECT 1 FROM story_series_parts p WHERE p.root_id=? AND p.owner_id=? AND p.activated=0)`).bind(JSON.stringify(saved),child.id,child.user_id,child.document,part.rootId,row.owner_id).run();
      }
     }
     if(previous){
      const first=await this.latest(row.owner_id,parts[0].rootId);if(!first||first.deleted||first.state!=='completed')break;
      const references=new BookImageReferences(this.database,this.media,row.owner_id);if(!(await references.get(first.id)).reference)await references.set(first.id,0,true);
     }
     await this.database.prepare(`UPDATE story_series_parts AS p SET activated=1 WHERE series_id=? AND owner_id=? AND number=? AND activated=0
      AND EXISTS(SELECT 1 FROM story_series r WHERE r.id=p.series_id AND r.owner_id=p.owner_id AND r.state='active' AND r.error IS NULL AND json_array_length(r.parts)=(SELECT COUNT(*) FROM story_series_parts reserved WHERE reserved.series_id=r.id AND reserved.owner_id=r.owner_id))
      AND ${completePredecessorsSql('p')} AND EXISTS(SELECT 1 FROM stories s WHERE s.user_id=p.owner_id AND ${familyRoot('s')}=p.root_id AND s.generation_control='paused' AND s.state='idle' AND NOT ${supersededSql('s')} AND ${seriesMemberSql('s')} AND NOT EXISTS(SELECT 1 FROM library_deletions d WHERE d.user_id=s.user_id AND d.story_id=s.id))`).bind(row.id,row.owner_id,part.number).run();
     break;
    }
    if(allComplete)await this.database.prepare("UPDATE story_series SET state='completed',updated_at=? WHERE id=? AND owner_id=? AND state='active' AND NOT EXISTS(SELECT 1 FROM story_series_parts p WHERE p.series_id=story_series.id AND p.owner_id=story_series.owner_id AND NOT EXISTS(SELECT 1 FROM stories s WHERE s.user_id=p.owner_id AND "+familyRoot('s')+"=p.root_id AND s.state='completed' AND NOT "+supersededSql('s')+" AND NOT EXISTS(SELECT 1 FROM reader_faults fault WHERE fault.session_id=s.id AND fault.owner_id=s.user_id AND fault.state IN ('pending','recovering')) AND NOT EXISTS(SELECT 1 FROM library_deletions d WHERE d.user_id=s.user_id AND d.story_id=s.id)))").bind(new Date().toISOString(),row.id,row.owner_id).run();
   }catch(error){if((error as {code?:string})?.code==='ERR_SQLITE_ERROR')throw error;await this.database.prepare("UPDATE story_series SET error=?,updated_at=? WHERE id=? AND owner_id=? AND state='active'").bind(error instanceof ReaderError?error.message:'The next comic part could not be prepared. Saved work has been retained. Resume the series to retry.',new Date().toISOString(),row.id,row.owner_id).run();}
  }
 }
}
