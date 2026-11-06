// 仅跳过明确无关的 UI、桌面原生与文档变更；共享代码、运行配置和未知路径默认检查原著。
// Git 比较失败或范围为空时运行全部检查，避免变更检测故障造成漏检。
import {execFileSync} from 'node:child_process';
import {appendFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

function documentation(filename){
 if(/^(?:data|tests|scripts|server|lib|skills|db|drizzle)\//.test(filename))return false;
 return /\.md$|^\.docs\/|^(?:LICENSE|NOTICE)$/.test(filename);
}
export function changeScope(files){
 return {
  code:files.length===0||files.some(filename=>!documentation(filename)),
  books:files.length===0||files.some(filename=>!documentation(filename)&&!/^(?:client|desktop|src-tauri|public)\//.test(filename)),
 };
}
export function detectScope(base,head,root=process.cwd()){
 try{
  if(!base||!head)throw Error('缺少比较提交');
  const changed=execFileSync('git',['diff','--no-renames','--name-only','-z',`${base}...${head}`],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']});
  return changeScope(changed.split('\0').filter(Boolean));
 }catch{
  console.error('无法确认变更范围，运行全部检查。');return {code:true,books:true};
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const scope=detectScope(process.env.BASE,process.env.HEAD);
 const output=Object.entries(scope).map(([key,value])=>`${key}=${value}`).join('\n')+'\n';
 if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,output);
 process.stdout.write(output);
}
