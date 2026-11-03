// Distribute a version-matched skill without relying on npm cache paths or modifying existing instructions.
import path from 'node:path';
import {readFile,lstat,mkdir,writeFile} from 'node:fs/promises';

export async function bundledSkill(root:string){return readFile(path.join(root,'skills/shiqu/SKILL.md'),'utf8');}
export async function installSkill(root:string,base=process.cwd()){
 const text=await bundledSkill(root);let directory=path.resolve(base);
 for(const segment of ['.agents','skills','shiqu']){
  directory=path.join(directory,segment);
  try{await mkdir(directory,{mode:0o700});}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}
  const info=await lstat(directory);if(info.isSymbolicLink()||!info.isDirectory())throw Error('SKILL_UNSAFE_PATH');
 }
 const filename=path.join(directory,'SKILL.md');
 try{await writeFile(filename,text,{flag:'wx',mode:0o600});}
 catch(error){
  if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;
  const info=await lstat(filename);if(info.isSymbolicLink()||!info.isFile())throw Error('SKILL_UNSAFE_PATH');
  if(await readFile(filename,'utf8')!==text)throw Error('SKILL_EXISTS: existing instructions differ; review and update them explicitly');
  return {path:filename,installed:false,unchanged:true};
 }
 return {path:filename,installed:true,unchanged:false};
}
