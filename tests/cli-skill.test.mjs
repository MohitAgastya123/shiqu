// Skill distribution has no library/provider side effects and never overwrites existing project instructions.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,rm,readFile,writeFile,mkdir,symlink,readdir} from 'node:fs/promises';
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
