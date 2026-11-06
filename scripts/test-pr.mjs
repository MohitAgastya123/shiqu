// Execute the shared impact plan with isolated fast/full flags and evidence of files, exclusions and outcomes.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createWriteStream} from 'node:fs';
import {createPlan,changeScope,fullScope} from './test-plan.mjs';
import {detectScope} from './ci-scope.mjs';
import {sourceIdentity} from './test-source.mjs';

export function inputScope(args,env=process.env){
 if(args.includes('--full'))return fullScope('explicit full qualification');
 if(args.includes('--changed')){
  try{
   const options={encoding:'utf8',maxBuffer:16*1024*1024};
   const changed=execFileSync('git',['diff','HEAD','--no-renames','--name-only','-z'],options);
   const untracked=execFileSync('git',['ls-files','--others','--exclude-standard','-z'],options);
   return changeScope([...new Set((changed+untracked).split('\0').filter(Boolean))]);
  }catch{return fullScope('working-tree comparison failed');}
 }
 const filesAt=args.indexOf('--files');
 if(filesAt!==-1)return changeScope(args.slice(filesAt+1));
 if(env.SHIQU_TEST_SCOPE){try{return JSON.parse(env.SHIQU_TEST_SCOPE);}catch{return fullScope('malformed CI scope');}}
 return detectScope(env.BASE,env.HEAD);
}
export async function executePlan(plan,{root=process.cwd()}={}){
 const runId=new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8),directory=path.join(root,'.data/test-plans',runId);
 await mkdir(directory,{recursive:true});
 const {commit,build}=await sourceIdentity(root),startedAt=new Date().toISOString(),batches=[];
 const log=createWriteStream(path.join(directory,'test.log'));
 let exitCode=0;
 console.log(`PR test plan: ${plan.tests.length} files; evidence ${directory}`);
 for(const mode of ['fast','full']){
  const files=plan.tests.filter(test=>test.mode===mode).map(test=>test.file);if(!files.length)continue;
  const env={...process.env,SHIQU_E2E_RUN_ID:runId,SHIQU_E2E_BUILD_ID:build};
  delete env.NODE_TEST_CONTEXT;delete env.SHIQU_TEST_TIER;delete env.SHIQU_TEST_BOOKS;
  if(mode==='full')env.SHIQU_TEST_TIER='full';
  const start=performance.now(),child=spawn(process.execPath,['--experimental-strip-types','--test','--test-concurrency=4',...files],{cwd:root,env,stdio:['ignore','pipe','pipe']});
  for(const [stream,target] of [[child.stdout,process.stdout],[child.stderr,process.stderr]])stream.on('data',chunk=>{target.write(chunk);log.write(chunk);});
  const stop=signal=>child.kill(signal),onInt=()=>stop('SIGINT'),onTerm=()=>stop('SIGTERM');
  process.once('SIGINT',onInt);process.once('SIGTERM',onTerm);
  const code=await new Promise(resolve=>{child.once('error',error=>{log.write(String(error));resolve(1);});child.once('exit',code=>resolve(code??1));});
  process.removeListener('SIGINT',onInt);process.removeListener('SIGTERM',onTerm);
  batches.push({mode,files,exitCode:code,durationMs:Math.round(performance.now()-start)});
  if(code){exitCode=code;break;}
 }
 await new Promise(resolve=>log.end(resolve));
 await writeFile(path.join(directory,'run.json'),JSON.stringify({...plan,runId,build,commit,startedAt,finishedAt:new Date().toISOString(),batches,exitCode},null,2));
 return exitCode;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),filesAt=args.indexOf('--files');
 if(args.slice(0,filesAt===-1?args.length:filesAt).some(arg=>!['--json','--plan','--full','--changed'].includes(arg)))throw Error('Usage: test-pr.mjs [--plan|--json] [--full|--changed|--files paths...]');
 const plan=createPlan(inputScope(args));
 if(args.includes('--json'))console.log(JSON.stringify(plan,null,2));
 else if(args.includes('--plan')){console.log(JSON.stringify({scope:plan.scope,native:plan.native,files:plan.tests.length,excluded:plan.excluded},null,2));for(const test of plan.tests)console.log(`${test.mode.padEnd(4)} ${test.level.padEnd(12)} ${test.file}`);}
 else process.exitCode=await executePlan(plan);
}
