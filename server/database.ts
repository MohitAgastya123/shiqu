// Own the local SQLite connection and apply each schema migration exactly once.
import {DatabaseSync} from 'node:sqlite';
import path from 'node:path';
import {drizzle} from 'drizzle-orm/sqlite-proxy';
import type {SQLInputValue} from 'node:sqlite';
import type {Database} from '../lib/reader-repository.ts';
import * as schema from '../db/schema.ts';
import {ensureLibraryReady} from './library-upgrade.ts';
export {migrate} from './database-migrations.ts';

export function openDatabase(directory:string,root:string){
 ensureLibraryReady(directory,root);
 const sqlite=new DatabaseSync(path.join(directory,'shiqu.sqlite'));
 try{
  sqlite.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON');
  const db=drizzle(async(query,params,method)=>{
   const statement=sqlite.prepare(query),values=params as SQLInputValue[];
   if(method==='run'){statement.run(...values);return {rows:[]};}
   statement.setReturnArrays(true);
   return {rows:(method==='get'?statement.get(...values):statement.all(...values)) as unknown[]};
  },{schema});
  const database:Database={prepare(query){
   const statement=sqlite.prepare(query);let values:SQLInputValue[]=[];
   return {bind(...args:unknown[]){values=args as SQLInputValue[];return this;},
    async first<T>(){return (statement.get(...values) as T|undefined)??null;},
    async all<T>(){return {results:statement.all(...values) as T[]};},
    async run(){return {meta:{changes:Number(statement.run(...values).changes)}};}};
  }};
  return {sqlite,db,database,close(){sqlite.close();}};
 }catch(error){sqlite.close();throw error;}
}
export type LocalDatabase=ReturnType<typeof openDatabase>;
