// Release gates select smoke coverage; extended and full suites share execution and evidence recording.
// Run each file once; default test:e2e preserves the established user-flow gate.
import path from 'node:path';
import {loadMetadata,supported} from './test-metadata.mjs';
import {sourceIdentity} from './test-source.mjs';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {createWriteStream,realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const gateFiles=(gate,root=process.cwd())=>loadMetadata(root).tests.filter(entry=>entry.level!=='native'&&supported(entry)&&(gate==='full'||entry.gates.includes(gate))).map(entry=>entry.file);
export const userFlowTests=gateFiles('user-flows');
export const extendedFlowTests=gateFiles('extended');
export async function selectTests(gate,root=process.cwd()){
 if(gate!==undefined&&!['release','npm','extended','full'].includes(gate))throw Error('Usage: pnpm test:e2e [--gate=release|--gate=npm|--gate=extended|--gate=full]');
 return gateFiles(gate??'user-flows',root);
}

async function runUserFlows(gate){
 const tests=await selectTests(gate);
 const runId=new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8),directory=path.resolve('.data/e2e',runId);
 await mkdir(directory,{recursive:true});
 const {commit,build}=await sourceIdentity(),startedAt=new Date().toISOString(),log=createWriteStream(path.join(directory,'test.log'));
 console.log(`Story E2E: ${runId}\nBuild: ${build}\nEvidence: ${directory}`);
 // Gate execution enables complete provider and heavy-case coverage.
 const env={...process.env,SHIQU_E2E_RUN_ID:runId,SHIQU_E2E_BUILD_ID:build,SHIQU_TEST_TIER:'full'};
 // Clear nested Node context so child suites execute as top-level tests.
 delete env.NODE_TEST_CONTEXT;
 const child=spawn(process.execPath,['--experimental-strip-types','--test','--test-concurrency=2',...tests],{env,stdio:['ignore','pipe','pipe']});
 for(const [stream,target] of [[child.stdout,process.stdout],[child.stderr,process.stderr]])stream.on('data',chunk=>{target.write(chunk);log.write(chunk);});
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));
 const exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code??1));});
 await new Promise(resolve=>log.end(resolve));
 await writeFile(path.join(directory,'run.json'),JSON.stringify({runId,gate:gate??'user-flows',build,commit,startedAt,finishedAt:new Date().toISOString(),exitCode,tests,model:'controlled production adapters; no live inference',databasePolicy:'isolated .data/e2e browser stores; disposable CLI/configuration/recovery libraries and homes; dev local startup uses a disposable checkout',browser:gate==='extended'?'none (service/engine E2E)':'independent Playwright Chromium'},null,2));
 console.log(`Story E2E ${exitCode===0?'PASS':'FAIL'} — ${directory}`);process.exitCode=exitCode;
}

if(process.argv[1]&&realpathSync(process.argv[1])===realpathSync(fileURLToPath(import.meta.url))){
 const args=process.argv.slice(2);
 if(args.length>1||(args.length&&!['--gate=release','--gate=npm','--gate=extended','--gate=full'].includes(args[0])))throw Error('Usage: pnpm test:e2e [--gate=release|--gate=npm|--gate=extended|--gate=full]');
 await runUserFlows(args[0]?.slice('--gate='.length));
}
