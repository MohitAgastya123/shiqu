// Reuse actual dev launcher fixtures with disposable homes/checkouts and no user credentials.
import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {existsSync} from 'node:fs';
import os from 'node:os';
import {mkdir,writeFile,cp,symlink,readdir} from 'node:fs/promises';
import {startupFixture,freeStartupPort} from './startup.mjs';

export async function checkoutFixture(t){
 const f=await startupFixture(t),checkout=path.join(f.root,'checkout');await mkdir(checkout);
 for(const name of ['client','components','hooks','lib','server','db','drizzle','docker','scripts','public','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','.nvmrc','index.html','vite.config.ts','tsconfig.json']){
  if(existsSync(name))await cp(name,path.join(checkout,name),{recursive:true,filter:source=>!/(?:^|\/)\.env(?:\.|$)/.test(source)});
 }
 await mkdir(path.join(checkout,'data'));await symlink(path.resolve('data/library'),path.join(checkout,'data/library'),process.platform==='win32'?'junction':'dir');
 // Reuse installed dependencies, but keep Vite's cache inside this disposable checkout.
 await mkdir(path.join(checkout,'node_modules'));
 for(const entry of await readdir('node_modules',{withFileTypes:true})){
  if(!entry.name.startsWith('.vite')&&(entry.isDirectory()||entry.isSymbolicLink()))await symlink(path.resolve('node_modules',entry.name),path.join(checkout,'node_modules',entry.name),process.platform==='win32'?'junction':'dir');
 }
 return {...f,checkout};
}
export async function startDevelopment(t,f,{local=false,variables={}}={}){
 const port=await freeStartupPort();let apiPort=await freeStartupPort();while(apiPort===port)apiPort=await freeStartupPort();
 let output='';
 // Dependencies are already installed and symlinked: a fixture must not rewrite the live virtual store.
 const child=spawn('pnpm',['--config.verify-deps-before-run=false','dev',...(local?['local']:[]),'--port',String(port)],{cwd:f.checkout,env:{
  ...f.env,PATH:process.env.PATH,
  // Corepack's package cache contains tooling, not user settings; avoid downloads in a disposable HOME.
  COREPACK_HOME:process.env.COREPACK_HOME||path.join(os.homedir(),'.cache/node/corepack'),
  SHIQU_API_PORT:String(apiPort),...variables,
 },detached:process.platform!=='win32',stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);
 const exit=once(child,'exit');
 async function stop(){
  if(child.exitCode===null&&child.signalCode===null){
   if(process.platform==='win32')child.kill('SIGTERM');else process.kill(-child.pid,'SIGTERM');
   let timer;try{await Promise.race([exit,new Promise(resolve=>{timer=setTimeout(resolve,5000);})]);}finally{clearTimeout(timer);}
   if(child.exitCode===null&&child.signalCode===null){if(process.platform==='win32')child.kill('SIGKILL');else process.kill(-child.pid,'SIGKILL');await exit;}
  }
 }
 // Fixture cleanup stops servers before deleting their settings, database and Vite cache.
 f.defer(stop);
 const origin=`http://127.0.0.1:${port}`;let ready=false;
 for(let i=0;i<150;i++){
  try{ready=(await fetch(origin+'/api/reader/sessions')).ok;}catch{}
  if(ready)break;assert.equal(child.exitCode,null,output);assert.equal(child.signalCode,null,output);await new Promise(resolve=>setTimeout(resolve,100));
 }
 assert.ok(ready,'Development service must become ready: '+output);
 return {origin,port,apiPort,stop,output:()=>output};
}
export async function assertStopped(server){
 await server.stop();
 for(const port of [server.port,server.apiPort])await assert.rejects(fetch(`http://127.0.0.1:${port}/api/reader/sessions`),'Development listeners must close');
}
const fixtureKey='test-only-saved-google-key';
export function saveGoogle(f){
 const store=f.store();store.save({provider:'gemini',providerConfigured:true,libraryConfigured:true,dataDirectory:f.locations.library,textModel:'saved-google-text',imageModel:'saved-google-image',taskReasoningEfforts:{suggest:'low',art:'medium',frames:'high',outline:'low',plan:'medium',review:'high',repair:'low'}},{provider:'gemini',value:fixtureKey});store.close();
}

