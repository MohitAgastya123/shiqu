// Publish one canonical story store only after a verified whole-library backup. The pending journal
// survives every destructive step; recovery restores files in place so service/gate lock inodes stay stable.
import {DatabaseSync} from 'node:sqlite';
import {existsSync,mkdirSync,readFileSync,writeFileSync,renameSync,rmSync,readdirSync,lstatSync,openSync,closeSync,fsyncSync} from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {createLibraryBackup,verifyLibraryBackup,restoreLibraryBackup,containsPath} from './library-backup.ts';
import {inspectLibrary,withLibraryGate,pendingUpgrade,upgradeJournal,libraryFormat} from './library-schema.ts';
import {ownsDesktopData,ownDesktopDataSync} from './desktop-owner.ts';
import {migrate} from './database-migrations.ts';
import {mediaKey} from './media.ts';

export const consolidationMigration='0018_consolidate_story_storage.sql';
const demos=new Set([...Array.from({length:10},(_,i)=>`legacy-art/pear-${i+1}.png`),...Array.from({length:30},(_,i)=>`legacy-art/dongguo-${i+1}.png`)]);
export function localMediaKey(value:string):string|null{
 let key=value.startsWith('/api/reader/media/')?'reader/'+value.slice(18):value.startsWith('/api/media/')?value.slice(11):value.startsWith('/art/')?'legacy-art/'+value.slice(5):value;
 try{key=decodeURIComponent(key);mediaKey(key);}catch{return null;}
 return key.includes('/')||value.startsWith('/api/media/')?key:null;
}
function references(value:unknown,result=new Set<string>()){
 if(typeof value==='string'){const key=localMediaKey(value);if(key)result.add(key);}
 else if(Array.isArray(value))for(const item of value)references(item,result);
 else if(value&&typeof value==='object')for(const item of Object.values(value))references(item,result);
 return result;
}
function walk(folder:string,prefix=''):string[]{
 if(!existsSync(folder))return [];
 if(lstatSync(folder).isSymbolicLink())throw Error('LIBRARY_MEDIA_SYMLINK');
 const result:string[]=[];
 for(const entry of readdirSync(folder,{withFileTypes:true})){
  if(entry.name.toLowerCase()==='.ds_store'){rmSync(path.join(folder,entry.name));continue;}
  if(entry.isSymbolicLink())throw Error('LIBRARY_MEDIA_SYMLINK');
  if(entry.name.startsWith('.desktop'))continue;
  const key=prefix+entry.name;
  if(entry.isDirectory())result.push(...walk(path.join(folder,entry.name),key+'/'));
  else if(entry.isFile())result.push(key);else throw Error('LIBRARY_UNSUPPORTED_FILE');
 }
 return result;
}
const hash=(file:string)=>createHash('sha256').update(readFileSync(file)).digest('hex');
export function currentMediaKeys(db:DatabaseSync,directory:string,table='stories'){
 // table is internal migration context, never user input.
 const rows=db.prepare(`SELECT * FROM ${table}`).all(),ids=new Set(rows.map(row=>String(row.id))),keep=new Set<string>();
 for(const row of rows){references(JSON.parse(String(row.selection)),keep);references(JSON.parse(String(row.document)),keep);}
 for(const table of ['production_jobs','reader_commands','reader_faults'])for(const row of db.prepare(`SELECT * FROM ${table}`).all())if(ids.has(String(row.session_id)))for(const field of ['payload','result','image'])if(typeof row[field]==='string'){
  try{references(JSON.parse(String(row[field])),keep);}catch{references(String(row[field]),keep);}
 }
 for(const row of db.prepare('SELECT * FROM book_image_references').all())if(ids.has(String(row.story_id))&&!demos.has(String(row.asset_key)))keep.add(String(row.asset_key));
 const files=walk(path.join(directory,'media'));
 for(const key of walk(directory).filter(key=>!key.split('/').some(part=>part.startsWith('.desktop'))&&!key.startsWith('media/')&&/\.(json|html|md)$/.test(key))){
  const text=readFileSync(path.join(directory,key),'utf8');
  try{references(JSON.parse(text),keep);}catch{for(const match of text.matchAll(/\/(?:api\/(?:reader\/)?media|art)\/[-a-zA-Z0-9_./]+/g))references(match[0],keep);}
 }
 // Saved originals/revision bases belong to the complete current namespace. Existing exports are
 // also protected roots; unknown files are never candidates for deletion.
 for(const file of files)if((file.startsWith('reader/')||file.startsWith('reader-cache/'))&&ids.has(file.split('/')[1])||file.startsWith('exports/'))keep.add(file);
 // Follow local references inside saved JSON, including snapshots and frozen input receipts.
 const queue=[...keep],visited=new Set<string>();
 for(let i=0;i<queue.length;i++){
  const key=queue[i];if(visited.has(key))continue;visited.add(key);
  if(!key.endsWith('.json')||!files.includes(key))continue;
  let value;try{value=JSON.parse(readFileSync(path.join(directory,'media',key),'utf8'));}catch{continue;}
  for(const ref of references(value))if(!keep.has(ref)){keep.add(ref);queue.push(ref);}
 }
 return keep;
}
function purgePlan(db:DatabaseSync,directory:string){
 const candidates=new Set(demos);
 for(const row of db.prepare('SELECT pages FROM stories').all()){
  let pages;try{pages=JSON.parse(String(row.pages));}catch{continue;}
  references(pages,candidates);
 }
 const current=new Set(db.prepare('SELECT id FROM reader_sessions').all().map(row=>String(row.id)));
 for(const row of db.prepare('SELECT * FROM book_image_references').all()){
  let demo=demos.has(String(row.asset_key));
  const source=db.prepare('SELECT document FROM reader_sessions WHERE id=?').get(row.story_id);
  if(source){const doc=JSON.parse(String(source.document));demo||=demos.has(localMediaKey(String(doc.images?.[Number(row.page)]||''))||'');}
  if(!current.has(String(row.story_id))||demo){
   candidates.add(String(row.asset_key));
   db.prepare('DELETE FROM book_image_references WHERE owner_id=? AND book_key=?').run(row.owner_id,row.book_key);
  }
 }
 const keep=currentMediaKeys(db,directory,'reader_sessions');
 const present=new Set(walk(path.join(directory,'media')));
 return {remove:[...candidates].filter(key=>{try{mediaKey(key);return present.has(key)&&!keep.has(key);}catch{return false;}}),keep:[...keep].filter(key=>present.has(key))};
}
function syncDirectory(directory:string){
 // Windows does not expose directory fsync through Node; file handles still sync before rename.
 if(process.platform==='win32')return;
 const fd=openSync(directory,'r');try{fsyncSync(fd);}finally{closeSync(fd);}
}
function durableFile(filename:string,bytes:string|Buffer){
 mkdirSync(path.dirname(filename),{recursive:true,mode:0o700});const temp=filename+'.'+randomUUID()+'.tmp';
 try{
  const fd=openSync(temp,'wx',0o600);try{writeFileSync(fd,bytes);fsyncSync(fd);}finally{closeSync(fd);}
  renameSync(temp,filename);syncDirectory(path.dirname(filename));
 }finally{rmSync(temp,{force:true});}
}
function clearSidecars(directory:string){for(const suffix of ['-wal','-shm','-journal'])rmSync(path.join(directory,'shiqu.sqlite'+suffix),{force:true});}
function recover(directory:string){
 const journal=pendingUpgrade(directory);if(!journal)return;
 if(journal.backup){
  const allowed=path.join(path.dirname(directory),path.basename(directory)+'-backups');
  if(!containsPath(allowed,journal.backup))throw Error('LIBRARY_INVALID_BACKUP_PATH');
  const manifest=verifyLibraryBackup(journal.backup);
  clearSidecars(directory);
  // Restore DB last. Access remains excluded until every original file has been verified/restored.
  for(const file of [...manifest.files].sort((a,b)=>Number(a.path==='shiqu.sqlite')-Number(b.path==='shiqu.sqlite'))){
   const target=path.join(directory,file.path);durableFile(target,readFileSync(path.join(journal.backup,file.path)));
   if(hash(target)!==file.sha256)throw Error('LIBRARY_RECOVERY_HASH_MISMATCH');
  }
 }else{clearSidecars(directory);rmSync(path.join(directory,'shiqu.sqlite'),{force:true});}
 rmSync(path.join(directory,'.desktop-upgrade-result.json'),{force:true});
 rmSync(path.join(directory,journal.work),{recursive:true,force:true});
 rmSync(path.join(directory,upgradeJournal));syncDirectory(directory);
}
export type UpgradePoint='journal'|'staged'|'quarantined'|'database-retired'|'database-published'|'files-published'|'cleanup';
export function ensureLibraryReady(directory:string,root:string,options:{onStep?:(point:UpgradePoint)=>void}={}){
 const initial=inspectLibrary(directory);if(initial==='current')return;
 const release=ownsDesktopData(directory)?()=>{}:ownDesktopDataSync(directory);
 try{return withLibraryGate(directory,()=>{
  const pending=pendingUpgrade(directory);
  if(pending)try{recover(directory);}catch(error){throw Error(`LIBRARY_RECOVERY_FAILED; backup: ${pending.backup||'fresh library'}; ${String(error)}`,{cause:error});}
  const state=inspectLibrary(directory);if(state==='current')return;
  const workName='.desktop-upgrade-'+randomUUID(),work=path.join(directory,workName);
  let backup:string|null=null;
  if(state==='legacy'){
   backup=path.join(path.dirname(directory),path.basename(directory)+'-backups','pre-upgrade-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8));
   createLibraryBackup(directory,backup,'0.8.0');const manifest=verifyLibraryBackup(backup);
   for(const file of [...manifest.files.map(f=>f.path),'shiqu-backup.json']){const fd=openSync(path.join(backup,file),'r');try{fsyncSync(fd);}finally{closeSync(fd);}}
   syncDirectory(backup);syncDirectory(path.dirname(backup));
   console.warn('升级前备份已校验：'+backup);
  }
  durableFile(path.join(directory,upgradeJournal),JSON.stringify({version:libraryFormat.schemaVersion,work:workName,backup})+'\n');
  try{
   options.onStep?.('journal');
   if(backup)restoreLibraryBackup(backup,work);else mkdirSync(work,{mode:0o700});
   const sqlite=new DatabaseSync(path.join(work,'shiqu.sqlite'));
   let removal:string[]=[],kept=new Map<string,string>();
   try{
    sqlite.exec('PRAGMA legacy_alter_table=OFF; PRAGMA foreign_keys=ON');
    migrate(sqlite,root,work,'0017_command_receipt_links.sql');
    // Keep immutable current values across consolidation; prior historical hooks have their own mapping.
    const rows=sqlite.prepare('SELECT * FROM reader_sessions ORDER BY id').all();
    const durableTables=['production_jobs','production_demand','reader_commands','reader_faults','reader_publication_defaults'];
    const values=durableTables.map(t=>sqlite.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all());
    const plan=purgePlan(sqlite,work);removal=plan.remove;kept=new Map(plan.keep.map(key=>[key,hash(path.join(work,'media',key))]));
    migrate(sqlite,root,work);sqlite.exec(readFileSync(path.join(root,'docker/seed.sql'),'utf8'));
    if(!isDeepStrictEqual(rows,sqlite.prepare('SELECT * FROM stories ORDER BY id').all()))throw Error('LIBRARY_STORY_PRESERVATION_FAILED');
    for(let i=0;i<durableTables.length;i++)if(!isDeepStrictEqual(values[i],sqlite.prepare(`SELECT * FROM ${durableTables[i]} ORDER BY rowid`).all()))throw Error('LIBRARY_QUEUE_PRESERVATION_FAILED');
    if(sqlite.prepare("SELECT name FROM sqlite_schema WHERE type='trigger' AND sql LIKE '%reader_sessions%'").get())throw Error('LIBRARY_TRIGGER_RENAME_FAILED');
    if(sqlite.prepare('PRAGMA integrity_check').get()!.integrity_check!=='ok')throw Error('LIBRARY_DATABASE_CORRUPT');
    sqlite.exec('PRAGMA wal_checkpoint(TRUNCATE)');
   }finally{sqlite.close();}
   options.onStep?.('staged');
   // Only positively retired files move out of live media, each with reversible backup bytes.
   for(const key of removal){
    const live=path.join(directory,'media',key);if(!existsSync(live))continue;
    const target=path.join(work,'quarantine',key);mkdirSync(path.dirname(target),{recursive:true});renameSync(live,target);syncDirectory(path.dirname(live));
   }
   options.onStep?.('quarantined');
   clearSidecars(directory);
   const live=path.join(directory,'shiqu.sqlite');if(existsSync(live))renameSync(live,path.join(work,'original.sqlite'));
   syncDirectory(directory);options.onStep?.('database-retired');
   renameSync(path.join(work,'shiqu.sqlite'),live);syncDirectory(directory);
   options.onStep?.('database-published');
   // Historical hooks may update saved JSON. Publish only changed files from the staged library.
   for(const file of walk(path.join(work,'media'))){
    if(removal.includes(file))continue;
    const staged=path.join(work,'media',file),target=path.join(directory,'media',file);
    if(!existsSync(target)||hash(staged)!==hash(target))durableFile(target,readFileSync(staged));
   }
   for(const [key,digest] of kept)if(hash(path.join(directory,'media',key))!==digest)throw Error('LIBRARY_MEDIA_PRESERVATION_FAILED');
   if(inspectLibraryWithoutJournal(directory)!=='current')throw Error('LIBRARY_PUBLICATION_FAILED');
   options.onStep?.('files-published');
   rmSync(work,{recursive:true,force:true});syncDirectory(directory);options.onStep?.('cleanup');
   if(backup)durableFile(path.join(directory,'.desktop-upgrade-result.json'),JSON.stringify({backup})+'\n');
   rmSync(path.join(directory,upgradeJournal));syncDirectory(directory);
   return {backup,removed:removal,retained:[...kept.keys()]};
  }catch(error){
   try{recover(directory);}catch(recovery){throw Error(`LIBRARY_RECOVERY_FAILED; backup: ${backup||'fresh library'}; ${String(recovery)}`,{cause:error});}
   throw Error(`LIBRARY_UPGRADE_FAILED; restored original library; backup: ${backup||'fresh library'}; ${String(error)}`,{cause:error});
  }
 });}finally{release();}
}
function inspectLibraryWithoutJournal(directory:string){
 // Pending journal deliberately takes precedence in public preflight. Inspect the published DB
 // directly here without making the journal disappear before all file work is complete.
 const db=new DatabaseSync(path.join(directory,'shiqu.sqlite'),{readOnly:true});
 try{return Number(db.prepare('PRAGMA user_version').get()!.user_version)===libraryFormat.schemaVersion&&db.prepare("SELECT 1 FROM pragma_table_info('stories') WHERE name='document'").get()?'current':'invalid';}finally{db.close();}
}
export function restoreAndUpgradeLibrary(source:string,target:string,root:string){
 if(existsSync(target))throw Error('BACKUP_TARGET_EXISTS');
 const stage=target+'.restore-'+randomUUID();
 try{
  const manifest=restoreLibraryBackup(source,stage);ensureLibraryReady(stage,root);
  // The original backup remains the recovery point; move the automatic safety snapshot alongside
  // the final target so the reported path remains valid and no transient destination is published.
  renameSync(stage,target);return manifest;
 }finally{rmSync(stage,{recursive:true,force:true});}
}

export function libraryUpgradeBackup(directory:string):string|undefined{
 if(inspectLibrary(directory)!=='current')return;
 const filename=path.join(directory,'.desktop-upgrade-result.json');
 if(!existsSync(filename))return;
 try{const value=JSON.parse(readFileSync(filename,'utf8'));return typeof value.backup==='string'?value.backup:undefined;}catch{return;}
}
