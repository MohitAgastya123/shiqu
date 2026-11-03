// Orchestrate production-backed browser and protocol suites into one retained development evidence run.
// This runner selects tests and records provenance; generation remains entirely in the production workflow.
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
const runId=new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8),directory=path.resolve('.data/e2e',runId);
await mkdir(directory,{recursive:true});
const tests=['tests/development-local.e2e.mjs','tests/story-lifecycle.playwright.e2e.mjs','tests/story-discovery-modes.e2e.mjs','tests/story-generation-state-machine.e2e.mjs','tests/unified-story-review.e2e.mjs','tests/story-generation-state-machine-flow.test.mjs','tests/story-generation-state-machine-reselection.test.mjs','tests/story-flow-control.test.mjs'];
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),fingerprint=createHash('sha256');
fingerprint.update(execFileSync('git',['diff','HEAD','--','client','lib','server','scripts','tests','package.json']));
const untracked=execFileSync('git',['ls-files','--others','--exclude-standard','-z','client','lib','server','scripts','tests'],{encoding:'utf8'}).split('\0').filter(Boolean);
for(const filename of untracked){fingerprint.update(filename);fingerprint.update(await readFile(filename));}
const build=commit+'+worktree.'+fingerprint.digest('hex').slice(0,12),startedAt=new Date().toISOString(),log=createWriteStream(path.join(directory,'test.log'));
console.log(`Story E2E: ${runId}\nBuild: ${build}\nEvidence: ${directory}`);
const child=spawn(process.execPath,['--experimental-strip-types','--test','--test-concurrency=2',...tests],{env:{...process.env,SHIQU_E2E_RUN_ID:runId,SHIQU_E2E_BUILD_ID:build},stdio:['ignore','pipe','pipe']});
for(const [stream,target] of [[child.stdout,process.stdout],[child.stderr,process.stderr]])stream.on('data',chunk=>{target.write(chunk);log.write(chunk);});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));
const exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code??1));});
await new Promise(resolve=>log.end(resolve));
await writeFile(path.join(directory,'run.json'),JSON.stringify({runId,build,commit,startedAt,finishedAt:new Date().toISOString(),exitCode,tests,model:'controlled production adapters; no live inference',databasePolicy:'isolated .data/e2e run stores; dev local startup probe uses .data/dev-local',browser:'independent Playwright Chromium'},null,2));
console.log(`Story E2E ${exitCode===0?'PASS':'FAIL'} — ${directory}`);process.exitCode=exitCode;
