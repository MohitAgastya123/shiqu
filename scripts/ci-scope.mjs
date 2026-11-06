// Git 改名按删除与新增处理，保留两端影响；比较失败时回退全量，输出统一计划输入。
import {execFileSync} from 'node:child_process';
import {appendFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {changeScope,fullScope,createPlan} from './test-plan.mjs';
export {changeScope};
export function detectScope(base,head,root=process.cwd()){
 try{
  if(!base||!head)throw Error('缺少比较提交');
  const changed=execFileSync('git',['diff','--no-renames','--name-only','-z',`${base}...${head}`],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']});
  return changeScope(changed.split('\0').filter(Boolean));
 }catch{
  console.error('无法确认变更范围，运行全部检查。');return fullScope('Git comparison failed');
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const scope=detectScope(process.env.BASE,process.env.HEAD);
 const output=`code=${scope.code}\nbooks=${scope.books}\nnative=${scope.native}\nbrowser=${createPlan(scope,undefined,{platform:'darwin'}).tests.some(test=>test.level==='browser-e2e')}\nscope=${JSON.stringify(scope)}\n`;
 if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,output);
 process.stdout.write(output);
}
