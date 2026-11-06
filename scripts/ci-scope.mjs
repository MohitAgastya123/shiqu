// Keep both sides of renamed paths and emit shared scope; comparison failures select full coverage.
import {execFileSync} from 'node:child_process';
import {appendFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {changeScope,fullScope,createPlan} from './test-plan.mjs';
export {changeScope};
export function detectScope(base,head,root=process.cwd()){
 try{
  if(!base||!head)throw Error('Missing comparison commits');
  const changed=execFileSync('git',['diff','--no-renames','--name-only','-z',`${base}...${head}`],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']});
  return changeScope(changed.split('\0').filter(Boolean));
 }catch{
  console.error('Cannot determine changed paths; running all checks.');return fullScope('Git comparison failed');
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const scope=detectScope(process.env.BASE,process.env.HEAD);
 const output=`code=${scope.code}\nbooks=${scope.books}\nnative=${scope.native}\nbrowser=${createPlan(scope,undefined,{platform:'darwin'}).tests.some(test=>test.level==='browser-e2e')}\nscope=${JSON.stringify(scope)}\n`;
 if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,output);
 process.stdout.write(output);
}
