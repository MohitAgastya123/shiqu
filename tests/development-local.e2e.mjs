// Start the actual pnpm development command with disposable homes, settings and shelves.
// Fake configured providers are observed only through status; no inference is requested.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {existsSync} from 'node:fs';
import os from 'node:os';
import {mkdir,writeFile,cp,symlink,readdir} from 'node:fs/promises';
import {startupFixture,freeStartupPort,savedStartupState} from './fixtures/startup.mjs';

async function checkoutFixture(t){
 const f=await startupFixture(t),checkout=path.join(f.root,'checkout');await mkdir(checkout);
 for(const name of ['client','components','hooks','lib','server','db','drizzle','docker','scripts','public','package.json','pnpm-lock.yaml','.nvmrc','index.html','vite.config.ts','tsconfig.json']){
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
async function startDevelopment(t,f,{local=false,variables={}}={}){
 const port=await freeStartupPort();let apiPort=await freeStartupPort();while(apiPort===port)apiPort=await freeStartupPort();
 let output='';
 const child=spawn('pnpm',['dev',...(local?['local']:[]),'--port',String(port)],{cwd:f.checkout,env:{
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
async function assertStopped(server){
 await server.stop();
 for(const port of [server.port,server.apiPort])await assert.rejects(fetch(`http://127.0.0.1:${port}/api/reader/sessions`),'Development listeners must close');
}
const fixtureKey='test-only-saved-google-key';
function saveGoogle(f){
 const store=f.store();store.save({provider:'gemini',providerConfigured:true,libraryConfigured:true,dataDirectory:f.locations.library,textModel:'saved-google-text',imageModel:'saved-google-image',taskReasoningEfforts:{suggest:'low',art:'medium',frames:'high',outline:'low',plan:'medium',review:'high',repair:'low'}},{provider:'gemini',value:fixtureKey});store.close();
}

test('dev uses saved Google settings and ignores conflicting project .env without changing the saved profile',{timeout:45000},async t=>{
 const f=await checkoutFixture(t);saveGoogle(f);const before=await savedStartupState(f),poisoned=path.join(f.root,'dotenv-must-not-open');
 await writeFile(path.join(f.checkout,'.env'),`SHIQU_AI_PROVIDER=codex\nGEMINI_API_KEY=wrong-dotenv-key\nGEMINI_TEXT_MODEL=wrong-text\nGEMINI_IMAGE_MODEL=wrong-image\nSHIQU_REASONING_PLAN=low\nSHIQU_DATA_DIR=${JSON.stringify(poisoned)}\n`);
 const server=await startDevelopment(t,f),response=await fetch(server.origin+'/api/reader/status'),status=await response.json();
 assert.equal(response.status,200);assert.equal(status.provider,'gemini');assert.equal(status.configured,true);assert.equal(status.models.text,'saved-google-text');assert.equal(status.models.image,'saved-google-image');assert.equal(status.taskReasoningEfforts.plan,'medium');assert.equal(status.taskReasoningEfforts.frames,'high');
 assert.ok(!JSON.stringify(status).includes(fixtureKey));assert.ok(!server.output().includes(fixtureKey));assert.ok(server.output().includes(f.locations.library));assert.ok(existsSync(path.join(f.locations.library,'shiqu.sqlite')));assert.equal(existsSync(poisoned),false);
 await assertStopped(server);assert.deepEqual(await savedStartupState(f),before);
});

test('dev shell overrides saved Google configuration only for the current invocation',{timeout:45000},async t=>{
 const f=await checkoutFixture(t);saveGoogle(f);const before=await savedStartupState(f),library=path.join(f.root,'explicit-shelf');
 const server=await startDevelopment(t,f,{variables:{SHIQU_AI_PROVIDER:'readonly',SHIQU_DATA_DIR:library}});
 const status=await (await fetch(server.origin+'/api/reader/status')).json();assert.equal(status.provider,'readonly');assert.equal(status.configured,false);assert.ok(server.output().includes(library));assert.ok(existsSync(path.join(library,'shiqu.sqlite')));assert.equal(existsSync(f.locations.library),false);
 await assertStopped(server);assert.deepEqual(await savedStartupState(f),before);
});

test('STORY-LIFECYCLE-C007: pnpm dev local ignores shared data settings and denies private database downloads',{timeout:45000},async t=>{
 const f=await checkoutFixture(t),store=f.store();store.save({provider:'readonly',providerConfigured:true});store.close();const before=await savedStartupState(f);
 const sentinel=path.join(f.root,'must-not-open'),local=path.join(f.checkout,'.data/dev-local');
 const server=await startDevelopment(t,f,{local:true,variables:{SHIQU_DATA_DIR:sentinel}});
 assert.ok(server.output().includes(local));assert.ok(existsSync(path.join(local,'shiqu.sqlite')));assert.equal(existsSync(sentinel),false);
 assert.equal((await (await fetch(server.origin+'/api/reader/status')).json()).provider,'readonly');
 for(const route of ['/.data/dev-local/shiqu.sqlite','/.data/dev-local/shiqu.sqlite?raw','/@fs/'+path.join(local,'shiqu.sqlite')])assert.ok([403,404].includes((await fetch(server.origin+route)).status));
 await assertStopped(server);assert.deepEqual(await savedStartupState(f),before);
 const run=process.env.SHIQU_E2E_RUN_ID||new Date().toISOString().replace(/[:.]/g,'-')+'-'+process.pid,directory=path.resolve('.data/e2e',run,'C007');await mkdir(directory,{recursive:true});
 await writeFile(path.join(directory,'startup.log'),server.output());
 await writeFile(path.join(directory,'result.json'),JSON.stringify({caseId:'C007',result:'PASS',build:process.env.SHIQU_E2E_BUILD_ID||'development',database:path.join(local,'shiqu.sqlite'),deniedPrivateFiles:true,ignoredSharedDirectory:true,releasedPorts:true},null,2));
});
