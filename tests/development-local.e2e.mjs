// Start the actual pnpm development command with generation disabled and prove checkout-library isolation.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'node:net';
async function freePort(){const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;}
test('STORY-LIFECYCLE-C007: pnpm dev local ignores shared data settings and denies private database downloads',{timeout:30000},async t=>{
 const port=await freePort(),apiPort=await freePort(),run=process.env.SHIQU_E2E_RUN_ID||new Date().toISOString().replace(/[:.]/g,'-')+'-'+process.pid,directory=path.resolve('.data/e2e',run,'C007');
 await mkdir(directory,{recursive:true});const sentinel=path.join(directory,'must-not-open'),local=path.resolve('.data/dev-local');let output='';
 const child=spawn('pnpm',['dev','local','--port',String(port)],{env:{...process.env,SHIQU_DATA_DIR:sentinel,SHIQU_API_PORT:String(apiPort),SHIQU_AI_PROVIDER:'readonly'},detached:process.platform!=='win32',stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);
 async function stop(){
  if(child.exitCode===null&&child.signalCode===null){if(process.platform==='win32')child.kill('SIGTERM');else process.kill(-child.pid,'SIGTERM');await Promise.race([once(child,'exit'),new Promise(resolve=>setTimeout(resolve,5000).unref())]);if(child.exitCode===null&&child.signalCode===null){if(process.platform==='win32')child.kill('SIGKILL');else process.kill(-child.pid,'SIGKILL');}}
  await writeFile(path.join(directory,'startup.log'),output);
 }
 t.after(stop);
 const origin=`http://127.0.0.1:${port}`;let ready=false;
 for(let i=0;i<100;i++){try{ready=(await fetch(origin+'/api/reader/sessions')).ok;}catch{}if(ready)break;assert.equal(child.exitCode,null,output);await new Promise(resolve=>setTimeout(resolve,100));}
 assert.ok(ready,'Development service must become ready');assert.ok(output.includes(local));assert.ok(existsSync(path.join(local,'shiqu.sqlite')));assert.equal(existsSync(sentinel),false);
 for(const route of ['/.data/dev-local/shiqu.sqlite','/.data/dev-local/shiqu.sqlite?raw','/@fs/'+path.join(local,'shiqu.sqlite')])assert.ok([403,404].includes((await fetch(origin+route)).status));
 await stop();
 for(const serverPort of [port,apiPort])await assert.rejects(fetch(`http://127.0.0.1:${serverPort}/api/reader/sessions`),'Development listeners must close');
 await writeFile(path.join(directory,'result.json'),JSON.stringify({caseId:'C007',result:'PASS',build:process.env.SHIQU_E2E_BUILD_ID||'development',database:path.join(local,'shiqu.sqlite'),deniedPrivateFiles:true,ignoredSharedDirectory:true,releasedPorts:true},null,2));
});
