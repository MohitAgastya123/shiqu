// Identify the actual source inputs, including migrations/books/lockfiles/new files, without ignored private runtime state.
import {execFileSync} from 'node:child_process';
import {readFile,lstat,readlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
export async function sourceIdentity(root=process.cwd()){
 const options={cwd:root,encoding:'utf8',maxBuffer:16*1024*1024};
 const commit=execFileSync('git',['rev-parse','HEAD'],options).trim();
 const changed=execFileSync('git',['diff','HEAD','--no-renames','--name-only','-z'],options);
 const untracked=execFileSync('git',['ls-files','--others','--exclude-standard','-z'],options);
 const files=[...new Set((changed+untracked).split('\0').filter(Boolean))].filter(file=>!/^\.(?:docs|tests)\//.test(file)&&file!=='AGENTS.md').sort(),hash=createHash('sha256');
 for(const file of files){
  hash.update(JSON.stringify(file)+'\0');
  try{
   const filename=path.join(root,file),stat=await lstat(filename);hash.update(String(stat.mode)+'\0');
   hash.update(stat.isSymbolicLink()?await readlink(filename):await readFile(filename));
  }catch(error){if(error.code!=='ENOENT')throw error;hash.update('deleted');}
 }
 return {commit,build:commit+'+worktree.'+hash.digest('hex').slice(0,12)};
}
