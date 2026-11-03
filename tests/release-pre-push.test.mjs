// Exercise real Git pushes into a temporary bare remote; pnpm is controlled to avoid recursive suites.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,copyFile,chmod,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {userFlowTests} from '../scripts/test-story-e2e.mjs';

test('both local publication gates require the production-backed lifecycle E2E',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
 for(const name of ['release:check','npm:check'])assert.match(manifest.scripts[name],/&& pnpm test:e2e(?: &&|$)/);
 assert.match(manifest.scripts['test:e2e'],/scripts\/test-story-e2e\.mjs/);
 for(const filename of ['tests/story-lifecycle.playwright.e2e.mjs','tests/headless-cli.test.mjs','tests/cli-skill.test.mjs','tests/library-maintenance.test.mjs','tests/diagnostics.test.mjs','tests/system-settings.test.mjs','tests/settings-faults.test.mjs'])assert.ok(userFlowTests.includes(filename),filename+' must gate release tags');
});

async function fixture(t,{failedFlow}={}){
 const root=await mkdtemp(path.join(os.tmpdir(),'shiqu hook test '));t.after(()=>rm(root,{recursive:true,force:true}));
 const checkout=path.join(root,'checkout'),remote=path.join(root,'remote.git'),bin=path.join(root,'bin'),log=path.join(root,'checks.log');
 await mkdir(checkout);await mkdir(bin);await mkdir(path.join(checkout,'scripts'));await mkdir(path.join(checkout,'.githooks'));
 for(const file of ['scripts/pre-push.mjs','scripts/test-story-e2e.mjs','.githooks/pre-push'])await copyFile(new URL('../'+file,import.meta.url),path.join(checkout,file));
 // Only the release runner is under test here; disposable cases make its exit propagation observable.
 await mkdir(path.join(checkout,'tests'));
 for(const file of userFlowTests)await writeFile(path.join(checkout,file),`import test from 'node:test';\ntest('release flow probe',()=>{${file===failedFlow?"throw Error('CONTROLLED_USER_FLOW_FAILURE');":''}});\n`);
 await chmod(path.join(checkout,'.githooks/pre-push'),0o755);
 await writeFile(path.join(checkout,'.nvmrc'),process.versions.node);
 await writeFile(path.join(checkout,'package.json'),JSON.stringify({packageManager:'pnpm@11.25.0'}));
 await writeFile(path.join(checkout,'marker'),'tagged content');
 await writeFile(path.join(bin,'pnpm'),`#!/usr/bin/env node
const fs=require('node:fs');
const args=process.argv.slice(2);
if(args[0]==='--version'){console.log('11.25.0');process.exit(0);}
fs.appendFileSync(process.env.PRE_PUSH_LOG,JSON.stringify({args,marker:fs.readFileSync('marker','utf8'),cwd:process.cwd(),gitDir:process.env.GIT_DIR})+'\\n');
if(args[0]==='run'&&process.env.PRE_PUSH_FAIL==='1')process.exit(1);
if(args[0]==='run'&&args[1]==='release:check'&&process.env.PRE_PUSH_REAL_FLOWS==='1'){
 const result=require('node:child_process').spawnSync(process.execPath,['scripts/test-story-e2e.mjs'],{env:process.env,stdio:'inherit'});
 process.exit(result.status??1);
}
`);
 await chmod(path.join(bin,'pnpm'),0o755);
 const env={...process.env,PATH:bin+path.delimiter+process.env.PATH,PRE_PUSH_LOG:log};
 // A hook can inherit Git-local variables; fixture commands must target only their own repository.
 for(const name of spawnSync('git',['rev-parse','--local-env-vars'],{encoding:'utf8'}).stdout.trim().split('\n'))delete env[name];
 function git(args,extra={},success=true){
  const result=spawnSync('git',args,{cwd:checkout,env:{...env,...extra},encoding:'utf8'});
  if(success)assert.equal(result.status,0,result.stdout+result.stderr);
  return result;
 }
 git(['init','--initial-branch=main']);git(['config','user.name','Hook test']);git(['config','user.email','hook@example.invalid']);
 git(['config','core.hooksPath','.githooks']);git(['add','.']);git(['commit','-m','Fixture']);
 git(['init','--bare',remote]);git(['remote','add','origin',remote]);
 const receipts=async()=>{try{return (await readFile(log,'utf8')).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}catch(error){if(error.code==='ENOENT')return [];throw error;}};
 return {checkout,git,receipts};
}

test('release pushes check the tagged snapshot once for lightweight and annotated tags; branches and deletions bypass', {skip:process.platform==='win32'},async t=>{
 const f=await fixture(t);
 f.git(['push','origin','main']);assert.deepEqual(await f.receipts(),[]);
 f.git(['tag','notes']);f.git(['push','origin','notes']);assert.deepEqual(await f.receipts(),[]);
 f.git(['tag','v0.0.1']);f.git(['tag','-a','v0.0.2','-m','Annotated release']);
 await writeFile(path.join(f.checkout,'marker'),'uncommitted content');
 await writeFile(path.join(f.checkout,'untracked'),'keep this file');
 f.git(['push','origin','--tags']);
 const receipts=await f.receipts();assert.deepEqual(receipts.map(r=>r.args),[['install','--frozen-lockfile'],['run','release:check']]);
 assert.ok(receipts.every(r=>r.marker==='tagged content'&&r.cwd!==f.checkout&&!r.gitDir));
 assert.equal(await readFile(path.join(f.checkout,'marker'),'utf8'),'uncommitted content');
 assert.equal(await readFile(path.join(f.checkout,'untracked'),'utf8'),'keep this file');
 f.git(['push','origin',':refs/tags/v0.0.1']);assert.equal((await f.receipts()).length,2);
 assert.equal((f.git(['worktree','list','--porcelain']).stdout.match(/^worktree /gm)||[]).length,1);
});

for(const failedFlow of ['tests/headless-cli.test.mjs','tests/cli-skill.test.mjs','tests/library-maintenance.test.mjs'])test('critical flow failure rejects a real v* tag push: '+failedFlow,{skip:process.platform==='win32'},async t=>{
 const f=await fixture(t,{failedFlow});f.git(['tag','v0.0.4']);
 await writeFile(path.join(f.checkout,'marker'),'uncommitted content');
 const pushed=f.git(['push','origin','v0.0.4'],{PRE_PUSH_REAL_FLOWS:'1'},false);
 assert.notEqual(pushed.status,0,pushed.stdout+pushed.stderr);assert.match(pushed.stdout+pushed.stderr,/CONTROLLED_USER_FLOW_FAILURE/);
 assert.match(pushed.stderr,/Release pre-push check failed/);assert.equal(f.git(['ls-remote','--tags','origin']).stdout,'');
 assert.equal(await readFile(path.join(f.checkout,'marker'),'utf8'),'uncommitted content');
 assert.equal((f.git(['worktree','list','--porcelain']).stdout.match(/^worktree /gm)||[]).length,1);
});

test('passing critical flows execute under an inherited test environment before a v* tag is accepted',{skip:process.platform==='win32'},async t=>{
 const f=await fixture(t);f.git(['tag','v0.0.5']);
 const pushed=f.git(['push','origin','v0.0.5'],{PRE_PUSH_REAL_FLOWS:'1'});
 assert.match(pushed.stdout+pushed.stderr,/release flow probe/);assert.match(pushed.stdout+pushed.stderr,/Story E2E PASS/);
 assert.match(f.git(['ls-remote','--tags','origin']).stdout,/refs\/tags\/v0\.0\.5/);
 assert.equal((f.git(['worktree','list','--porcelain']).stdout.match(/^worktree /gm)||[]).length,1);
});

test('failed checks reject the actual tag push and clean up the isolated worktree', {skip:process.platform==='win32'},async t=>{
 const f=await fixture(t);f.git(['tag','v0.0.3']);
 const pushed=f.git(['push','origin','v0.0.3'],{PRE_PUSH_FAIL:'1'},false);
 assert.notEqual(pushed.status,0);assert.match(pushed.stderr,/Release pre-push check failed/);
 assert.equal(f.git(['ls-remote','--tags','origin']).stdout,'');
 assert.equal((f.git(['worktree','list','--porcelain']).stdout.match(/^worktree /gm)||[]).length,1);
});
