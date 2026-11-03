// Skill lifecycle uses isolated homes and registry transport; updates preserve local edits and production state.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,rm,readFile,writeFile,mkdir,symlink,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {executeHeadless} from '../server/headless-cli.ts';

test('bundled skill copies independently, is idempotent, and refuses different instructions and symlink paths',async t=>{
 const cwd=await mkdtemp(path.join(os.tmpdir(),'shiqu-skill-'));t.after(()=>rm(cwd,{recursive:true,force:true}));
 const home=path.join(cwd,'isolated-home');await mkdir(home);const root=process.cwd(),call=(args,directory=cwd)=>executeHeadless(root,args,{cwd:directory,home,variables:{}});
 const shown=await call(['skill','show']);assert.equal(shown.text,await readFile(path.join(root,'skills/shiqu/SKILL.md'),'utf8'));
 await assert.rejects(call(['skill','install']),error=>error.code==='SKILL_SCOPE_REQUIRED');
 const first=await call(['skill','install','--scope','project']);assert.equal(first.installed,true);assert.equal(await readFile(first.path,'utf8'),shown.text);
 assert.equal((await call(['skill','install','--scope','project'])).unchanged,true);assert.deepEqual((await readdir(cwd)).sort(),['.agents','isolated-home']);
 const global=await call(['skill','install','--scope','global']);assert.equal(global.path,path.join(home,'.agents/skills/shiqu/SKILL.md'));assert.equal(await readFile(global.path,'utf8'),shown.text);assert.equal((await call(['skill','install','--scope','global'],home)).unchanged,true);
 await writeFile(first.path,'user instructions');await assert.rejects(call(['skill','install','--scope','project']),/SKILL_EXISTS/);assert.equal(await readFile(first.path,'utf8'),'user instructions');
 for(const components of [['.agents'],['.agents','skills'],['.agents','skills','shiqu'],['.agents','skills','shiqu','SKILL.md']]){
  const target=await mkdtemp(path.join(os.tmpdir(),'shiqu-skill-symlink-'));t.after(()=>rm(target,{recursive:true,force:true}));
  const parent=path.join(target,...components.slice(0,-1));await mkdir(parent,{recursive:true});await symlink(first.path,path.join(target,...components));
  await assert.rejects(call(['skill','install','--scope','project'],target),/SKILL_UNSAFE_PATH/);
 }
});

async function fixture(t){
 const base=await mkdtemp(path.join(os.tmpdir(),'shiqu-skill-update-'));t.after(()=>rm(base,{recursive:true,force:true}));
 const cwd=path.join(base,'project'),home=path.join(base,'home');await mkdir(cwd);await mkdir(home);
 async function release(version,text){const root=path.join(base,'package-'+version);await mkdir(path.join(root,'skills/shiqu'),{recursive:true});await writeFile(path.join(root,'package.json'),JSON.stringify({version}));await writeFile(path.join(root,'skills/shiqu/SKILL.md'),text);return root;}
 const old=await release('0.6.6','official old instructions'),next=await release('0.7.0','official new instructions');
 let requests=0,time=1000000000,mode='ok';
 const transport=async(url,options)=>{requests++;assert.equal(url,'https://registry.npmjs.org/@apprun%2fshiqu/latest');assert.equal(options.redirect,'error');assert.ok(options.signal);if(mode==='offline')throw Error('offline');return new Response(mode==='invalid'?'{"name":"@apprun/shiqu","version":"1.2.3;run"}':mode==='oversize'?'x'.repeat(65537):JSON.stringify({name:'@apprun/shiqu',version:'0.7.0',updateCommand:['UNTRUSTED']}));};
 const call=(root,args,directory=cwd)=>executeHeadless(root,['skill',...args],{cwd:directory,home,variables:{},skill:{transport,now:()=>time}});
 return {base,cwd,home,old,next,call,requests:()=>requests,advance:n=>time+=n,mode:m=>mode=m};
}

test('check reports pinned update without replacing files; cache is outside project and policy is opt-in',async t=>{
 const f=await fixture(t),installed=await f.call(f.old,['install','--scope','project']);
 const stateFile=path.join(path.dirname(installed.path),'.shiqu-skill.json'),initial=await readFile(stateFile,'utf8');
 const checked=await f.call(f.old,['check']);assert.equal(checked.installedVersion,'0.6.6');assert.equal(checked.updateAvailable,true);assert.equal(checked.autoUpdate,false);assert.equal(checked.autoUpdateReady,false);
 assert.deepEqual(checked.updateCommand,['npx','--yes','@apprun/shiqu@0.7.0','skill','update','--scope','project']);assert.equal(checked.updateCwd,f.cwd);
 assert.equal(await readFile(installed.path,'utf8'),'official old instructions');assert.equal(await readFile(stateFile,'utf8'),initial);
 assert.equal((await f.call(f.old,['check'])).registry.cached,true);assert.equal(f.requests(),1);
 const enabled=await f.call(f.old,['check','--auto-update','on']);assert.equal(enabled.autoUpdateReady,true);assert.equal(enabled.updateCommand.at(-1),'--automatic');
 await f.call(f.old,['check','--auto-update','off']);await assert.rejects(f.call(f.next,['update','--scope','project','--automatic']),e=>e.code==='SKILL_AUTO_UPDATE_DISABLED');
 await f.call(f.old,['check','--auto-update','on']);const updated=await f.call(f.next,['update','--scope','project','--automatic']);
 assert.equal(updated.version,'0.7.0');assert.equal(updated.previousVersion,'0.6.6');assert.equal(updated.autoUpdate,true);assert.equal(await readFile(installed.path,'utf8'),'official new instructions');
 const current=await f.call(f.next,['check']);assert.equal(current.updateAvailable,false);assert.equal(current.updateCommand,null);assert.equal(current.installedVersion,'0.7.0');
 await assert.rejects(f.call(f.old,['update','--scope','project']),e=>e.code==='SKILL_DOWNGRADE');
 assert.deepEqual((await readdir(f.cwd)).sort(),['.agents']);assert.deepEqual((await readdir(path.dirname(installed.path))).sort(),['.shiqu-skill.json','SKILL.md']);
});

test('local edits, unknown legacy content and corrupt state are preserved; matching legacy copies can be adopted',async t=>{
 const f=await fixture(t),installed=await f.call(f.old,['install','--scope','project']),stateFile=path.join(path.dirname(installed.path),'.shiqu-skill.json');
 await f.call(f.old,['check','--auto-update','on']);await writeFile(installed.path,'my custom instructions');
 const checked=await f.call(f.old,['check']);assert.equal(checked.status,'modified');assert.equal(checked.autoUpdateReady,false);assert.equal(checked.updateCommand,null);
 await assert.rejects(f.call(f.next,['update','--scope','project']),e=>e.code==='SKILL_MODIFIED');assert.equal(await readFile(installed.path,'utf8'),'my custom instructions');
 await rm(stateFile);assert.equal((await f.call(f.old,['check'])).status,'unmanaged');
 await assert.rejects(f.call(f.next,['update','--scope','project']),e=>e.code==='SKILL_UNMANAGED');
 await assert.rejects(f.call(f.old,['check','--auto-update','on']),e=>e.code==='SKILL_UNMANAGED');
 await writeFile(installed.path,'official old instructions');await f.call(f.old,['install','--scope','project']);
 await writeFile(stateFile,'invalid');await assert.rejects(f.call(f.next,['update','--scope','project']),e=>e.code==='SKILL_STATE_INVALID');assert.equal(await readFile(stateFile,'utf8'),'invalid');
 await rm(stateFile);const adopted=await f.call(f.old,['update','--scope','project']);assert.equal(adopted.updated,false);assert.equal(adopted.autoUpdate,false);
});

test('registry failures are non-blocking, bounded, cached briefly, and refreshable',async t=>{
 const f=await fixture(t);await f.call(f.old,['install','--scope','global']);f.mode('offline');
 const offline=await f.call(f.old,['check']);assert.equal(offline.registry.status,'unavailable');assert.equal(offline.autoUpdateReady,false);
 assert.equal((await f.call(f.old,['check'])).registry.cached,true);assert.equal(f.requests(),1);
 f.mode('invalid');assert.equal((await f.call(f.old,['check','--refresh'])).registry.status,'unavailable');
 f.mode('oversize');assert.equal((await f.call(f.old,['check','--refresh'])).registry.status,'unavailable');
 f.mode('ok');f.advance(300001);assert.equal((await f.call(f.old,['check'])).registry.status,'ok');assert.equal(f.requests(),4);
 f.advance(86400001);assert.equal((await f.call(f.old,['check'])).registry.cached,false);assert.equal(f.requests(),5);
 const filename=path.join(f.home,'.cache/shiqu/skill-version.json');await writeFile(filename,'invalid cache');assert.equal((await f.call(f.old,['check'])).registry.status,'ok');
});

test('auto discovery respects Git roots, ancestor projects, global fallback and correct update cwd',async t=>{
 const f=await fixture(t);await f.call(f.old,['install','--scope','global']);assert.equal((await f.call(f.old,['check'])).scope,'global');
 await f.call(f.old,['install','--scope','project']);await mkdir(path.join(f.cwd,'.git'));const nested=path.join(f.cwd,'child/deep');await mkdir(nested,{recursive:true});
 const found=await f.call(f.old,['check'],nested);assert.equal(found.scope,'project');assert.equal(found.updateCwd,f.cwd);
 const other=path.join(f.cwd,'other-repository');await mkdir(other);await mkdir(path.join(other,'.git'));assert.equal((await f.call(f.old,['check'],other)).scope,'global');
 assert.equal((await f.call(f.old,['check','--scope','project'],nested)).status,'not_installed');
});

test('state symlinks and active operation locks reject mutations without changing their targets',async t=>{
 const f=await fixture(t),installed=await f.call(f.old,['install','--scope','project']),dir=path.dirname(installed.path),stateFile=path.join(dir,'.shiqu-skill.json');
 const outside=path.join(f.base,'external');await writeFile(outside,'do not touch');await rm(stateFile);await symlink(outside,stateFile);
 for(const args of [['check'],['install','--scope','project'],['update','--scope','project']])await assert.rejects(f.call(f.next,args),e=>e.code==='SKILL_UNSAFE_PATH');
 assert.equal(await readFile(outside,'utf8'),'do not touch');await rm(stateFile);await f.call(f.old,['install','--scope','project']);
 await mkdir(path.join(dir,'.update-lock'));await assert.rejects(f.call(f.next,['update','--scope','project']),e=>e.code==='SKILL_BUSY');assert.equal(await readFile(installed.path,'utf8'),'official old instructions');
});


test('CLI process emits one JSON receipt for check, help and managed update refusal',async t=>{
 const f=await fixture(t),script=path.join(process.cwd(),'scripts/library-maintenance.mjs');
 const run=(args)=>{const result=spawnSync(process.execPath,['--experimental-strip-types',script,...args],{cwd:f.cwd,env:{...process.env,HOME:f.home,XDG_CACHE_HOME:path.join(f.home,'cache'),SHIQU_HOME:path.join(f.home,'shiqu')},encoding:'utf8',timeout:15000});assert.equal(result.error,undefined);const lines=result.stdout.trim().split('\n');assert.equal(lines.length,1,result.stdout);return {status:result.status,...JSON.parse(lines[0])};};
 const empty=run(['skill','check','--scope','project']);assert.equal(empty.ok,true);assert.equal(empty.data.status,'not_installed');
 const help=run(['help','--json']);assert.equal(help.ok,true);assert.ok(help.data.commands.some(c=>c.name.includes('skill')&&c.name.includes('check')));
 const installed=run(['skill','install','--scope','project']);assert.equal(installed.ok,true);await writeFile(installed.data.path,'modified');
 const refused=run(['skill','update','--scope','project']);assert.equal(refused.status,1);assert.equal(refused.ok,false);assert.equal(refused.error.code,'SKILL_MODIFIED');assert.equal(await readFile(installed.data.path,'utf8'),'modified');
 assert.deepEqual((await readdir(f.cwd)).sort(),['.agents']);
});

test('user cache location can be created independently; unsafe cache paths cannot overwrite external files',async t=>{
 const f=await fixture(t);await f.call(f.old,['install','--scope','project']);
 const cache=path.join(f.home,'new-cache-root'),context={cwd:f.cwd,home:f.home,variables:{XDG_CACHE_HOME:cache},skill:{transport:async()=>new Response(JSON.stringify({name:'@apprun/shiqu',version:'0.7.0'}))}};
 const checked=await executeHeadless(f.old,['skill','check'],context);assert.equal(checked.registry.status,'ok');assert.equal(JSON.parse(await readFile(path.join(cache,'shiqu/skill-version.json'),'utf8')).latestVersion,'0.7.0');
 await rm(path.join(cache,'shiqu/skill-version.json'));const outside=path.join(f.base,'external-cache');await writeFile(outside,'keep');await symlink(outside,path.join(cache,'shiqu/skill-version.json'));
 const again=await executeHeadless(f.old,['skill','check','--refresh'],context);assert.equal(again.registry.status,'ok');assert.equal(await readFile(outside,'utf8'),'keep');
});

test('failed or malformed cache entries cannot authorize any automatic update or version range',async t=>{
 const f=await fixture(t);await f.call(f.old,['install','--scope','project']);const initial=await f.call(f.old,['check','--auto-update','on']);
 const filename=path.join(f.home,'.cache/shiqu/skill-version.json');
 for(const latestVersion of ['9.0.0','9','9.0.0;run']){
  await writeFile(filename,JSON.stringify({status:'unavailable',checkedAt:initial.registry.checkedAt,latestVersion}));
  const checked=await f.call(f.old,['check']);assert.equal(checked.registry.status,'unavailable');assert.equal(checked.registry.latestVersion,undefined);assert.equal(checked.updateAvailable,false);assert.equal(checked.autoUpdateReady,false);assert.equal(checked.updateCommand,null);
 }
 f.mode('offline');await writeFile(filename,JSON.stringify({status:'ok',checkedAt:initial.registry.checkedAt,latestVersion:'9'}));
 const malformed=await f.call(f.old,['check']);assert.equal(malformed.registry.status,'unavailable');assert.equal(malformed.updateCommand,null);assert.equal(malformed.autoUpdateReady,false);
});
