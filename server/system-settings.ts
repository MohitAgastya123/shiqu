// Own the shared private settings database, compatible with the native v2 store.
// Transactions migrate old rows and patch the latest settings; no raw key reaches public views or errors.
import {DatabaseSync} from 'node:sqlite';
import {existsSync,mkdirSync,lstatSync,openSync,closeSync,chmodSync,constants,readFileSync} from 'node:fs';
import path from 'node:path';
import {defaultSystemSettings,systemSettingsSchema,validApiKey,resetProviderSettings,effectiveImageProvider} from '../lib/system-settings.ts';
import type {SystemSettings,ProviderName,ApiProviderName} from '../lib/system-settings.ts';
export type KeyChange={provider:ApiProviderName;value:string|null};
const failure='无法读取或保存共享设置数据库；请检查权限或使用兼容版本，不会自动重建已有配置。';
export class SystemSettingsStore{
 private db:DatabaseSync;
 constructor(filename:string,library:string){
  const folder=path.dirname(filename);mkdirSync(folder,{recursive:true,mode:0o700});
  if(!lstatSync(folder).isDirectory())throw Error(failure);
  if(!existsSync(filename)){
   try{closeSync(openSync(filename,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600));}
   catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw Error(failure);}
  }
  if(!lstatSync(filename).isFile())throw Error(failure);
  if(process.platform!=='win32'){chmodSync(folder,0o700);chmodSync(filename,0o600);}
  this.db=new DatabaseSync(filename);
  try{
   this.db.exec('PRAGMA busy_timeout=2000; PRAGMA secure_delete=ON; PRAGMA temp_store=MEMORY; BEGIN IMMEDIATE');
   const version=this.db.prepare('PRAGMA user_version').get()!.user_version;
   if(version===0){
    if(this.db.prepare("SELECT count(*) AS n FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%'").get()!.n!==0)throw Error();
    const legacy=path.join(folder,'settings.json');
    const settings=existsSync(legacy)?this.validate(JSON.parse(readFileSync(legacy,'utf8'))):defaultSystemSettings(library);
    if(existsSync(legacy)){settings.libraryConfigured=true;settings.providerConfigured=settings.provider==='codex'||settings.provider==='readonly';}
    this.db.exec("CREATE TABLE desktop_settings(id INTEGER PRIMARY KEY CHECK(id=1),value TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0); CREATE TABLE desktop_credentials(name TEXT PRIMARY KEY CHECK(name IN ('gemini','openai')),value TEXT NOT NULL); PRAGMA user_version=2;");
    this.db.prepare('INSERT INTO desktop_settings(id,value) VALUES(1,?)').run(JSON.stringify(settings));
   }else if(version===1){
    const settings=this.settings();
    settings.libraryConfigured=true;settings.providerConfigured=settings.provider==='codex'||this.key('gemini').length>0;
    this.db.exec("ALTER TABLE desktop_settings ADD COLUMN revision INTEGER NOT NULL DEFAULT 0; ALTER TABLE desktop_credentials RENAME TO old_credentials; CREATE TABLE desktop_credentials(name TEXT PRIMARY KEY CHECK(name IN ('gemini','openai')),value TEXT NOT NULL); INSERT INTO desktop_credentials SELECT * FROM old_credentials; DROP TABLE old_credentials; PRAGMA user_version=2;");
    this.db.prepare('UPDATE desktop_settings SET value=? WHERE id=1').run(JSON.stringify(settings));
   }else if(version!==2)throw Error();
   this.settings();this.revision();this.db.prepare('SELECT name,value FROM desktop_credentials LIMIT 0').all();
   if(this.db.prepare('PRAGMA quick_check').get()!.quick_check!=='ok')throw Error();
   this.db.exec('COMMIT');
  }catch{try{this.db.exec('ROLLBACK');}catch{/* No transaction for an unreadable database. */}this.db.close();throw Error(failure);}
 }
 private validate(value:unknown){
  const settings=systemSettingsSchema.parse(value);
  if(!path.isAbsolute(settings.dataDirectory)||settings.cloudflaredPath&&!path.isAbsolute(settings.cloudflaredPath))throw Error();
  if(process.platform==='win32'&&(settings.provider==='codex'||effectiveImageProvider(settings)==='codex'))throw Error('Codex 不支持原生 Windows，请选择 OpenAI API、Gemini 或只读。');
  const {lanEnabled:_,...saved}=settings;void _;
  // "Same as text" is stored as unset so older builds can still read the settings.
  if(saved.imageProvider===saved.provider)delete saved.imageProvider;
  return saved;
 }
 settings():SystemSettings{
  try{return this.validate(JSON.parse(this.db.prepare('SELECT value FROM desktop_settings WHERE id=1').get()!.value as string));}
  catch{throw Error(failure);}
 }
 revision(){return Number(this.db.prepare('SELECT revision FROM desktop_settings WHERE id=1').get()!.revision);}
 snapshot(){
  const row=this.db.prepare("SELECT value,revision,EXISTS(SELECT 1 FROM desktop_credentials WHERE name='gemini' AND length(value)>0) AS gemini,EXISTS(SELECT 1 FROM desktop_credentials WHERE name='openai' AND length(value)>0) AS openai FROM desktop_settings WHERE id=1").get()!;
  return {settings:this.validate(JSON.parse(row.value as string)),revision:Number(row.revision),keyPresent:{gemini:!!row.gemini,openai:!!row.openai}};
 }
 key(provider:ProviderName){
  if(provider!=='gemini'&&provider!=='openai')return '';
  return (this.db.prepare('SELECT value FROM desktop_credentials WHERE name=?').get(provider)?.value as string|undefined)||'';
 }
 // Key changes may target the text provider or a separate image provider, never an unused provider.
 save(patch:Partial<SystemSettings>,key?:KeyChange|KeyChange[],expectedRevision?:number){
  this.db.exec('BEGIN IMMEDIATE');
  try{
   if(expectedRevision!==undefined&&this.revision()!==expectedRevision)throw Error('SETTINGS_CHANGED');
   const settings=this.validate({...this.settings(),...patch}),changes=key?Array.isArray(key)?key:[key]:[];
   const active=new Set([settings.provider,effectiveImageProvider(settings)]);
   if(changes.some(change=>!active.has(change.provider))||new Set(changes.map(change=>change.provider)).size!==changes.length)throw Error();
   for(const change of changes){
    if(change.value===null)this.db.prepare('DELETE FROM desktop_credentials WHERE name=?').run(change.provider);
    else this.db.prepare('INSERT INTO desktop_credentials VALUES(?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value').run(change.provider,validApiKey(change.value));
   }
   this.db.prepare('UPDATE desktop_settings SET value=?,revision=revision+1 WHERE id=1').run(JSON.stringify(settings));
   this.db.exec('COMMIT');return settings;
  }catch(error){this.db.exec('ROLLBACK');throw Error((error as Error).message==='SETTINGS_CHANGED'?'设置已由另一入口修改，请重新读取后保存。':failure);}
 }
 resetProviders(){
  this.db.exec('BEGIN IMMEDIATE');
  try{
   const settings=resetProviderSettings(this.settings());this.db.exec('DELETE FROM desktop_credentials');
   this.db.prepare('UPDATE desktop_settings SET value=?,revision=revision+1 WHERE id=1').run(JSON.stringify(settings));this.db.exec('COMMIT');
  }catch{this.db.exec('ROLLBACK');throw Error(failure);}
 }
 close(){this.db.close();}
}
