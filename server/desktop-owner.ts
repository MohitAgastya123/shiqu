// Hold an OS-released service lease; read-only format refusal must precede every ownership write.
import {openSync,readFileSync,writeFileSync,unlinkSync,mkdirSync,closeSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {inspectLibrary} from './library-schema.ts';
const owned=new Set<string>();
export function ownsDesktopData(directory:string){return owned.has(path.resolve(directory));}
export function ownDesktopDataSync(directory:string){
 inspectLibrary(directory);directory=path.resolve(directory);mkdirSync(directory,{recursive:true});
 const lock=new DatabaseSync(path.join(directory,'.desktop-owner.sqlite'));
 try{lock.exec('PRAGMA busy_timeout=0; BEGIN EXCLUSIVE');}catch{lock.close();throw Error('DATA_BUSY');}
 const filename=path.join(directory,'.desktop-owner.json'),id=randomUUID();
 try{
  for(let attempt=0;attempt<2;attempt++){
   let file:number;
   try{file=openSync(filename,'wx',0o600);}catch(error){
    if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;
    let previous:{pid:number};try{previous=JSON.parse(readFileSync(filename,'utf8'));}catch{throw Error('DATA_BUSY');}
    if(!Number.isSafeInteger(previous.pid)||previous.pid<1)throw Error('DATA_BUSY');
    try{process.kill(previous.pid,0);throw Error('DATA_BUSY');}catch(check){if((check as NodeJS.ErrnoException).code!=='ESRCH')throw Error('DATA_BUSY');}
    unlinkSync(filename);continue;
   }
   try{writeFileSync(file,JSON.stringify({pid:process.pid,id}));}finally{closeSync(file);}
   owned.add(directory);let released=false;
   return ()=>{if(released)return;released=true;owned.delete(directory);try{if(JSON.parse(readFileSync(filename,'utf8')).id===id)unlinkSync(filename);}catch{/* Already removed. */}finally{lock.close();}};
  }
  throw Error('DATA_BUSY');
 }catch(error){lock.close();throw error;}
}
export async function ownDesktopData(directory:string){return ownDesktopDataSync(directory);}
