// Apply immutable historical migrations; callers stage files and own recovery before invoking hooks.
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import type {DatabaseSync} from 'node:sqlite';
import {storySummaryMigration,migrateStorySummary} from './story-summary-migration.ts';
import {readerInputMigration,migrateReaderInputs,legacyInputFaultMigration,retainLegacyInputFaults} from './reader-input-migration.ts';
export function migrate(sqlite:DatabaseSync,root:string,directory?:string,through='0018_consolidate_story_storage.sql'){
 sqlite.exec('CREATE TABLE IF NOT EXISTS app_migrations(name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
 for(const name of readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')&&f<=through).sort()){
  sqlite.exec('BEGIN IMMEDIATE');
  try{
   if(!sqlite.prepare('SELECT 1 FROM app_migrations WHERE name=?').get(name)){
    const legacy=sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='d1_migrations'").get();
    const applied=legacy&&sqlite.prepare('SELECT 1 FROM d1_migrations WHERE name=?').get(name);
    if(!applied){const sql=readFileSync(path.join(root,'drizzle',name),'utf8');if(name===storySummaryMigration)migrateStorySummary(sqlite,sql,directory);else if(name===readerInputMigration)migrateReaderInputs(sqlite);else if(name===legacyInputFaultMigration)retainLegacyInputFaults(sqlite);else sqlite.exec(sql);}
    sqlite.prepare('INSERT INTO app_migrations VALUES(?,?)').run(name,new Date().toISOString());
   }
   sqlite.exec('COMMIT');
  }catch(error){sqlite.exec('ROLLBACK');throw error;}
 }
}
