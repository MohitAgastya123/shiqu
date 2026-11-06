// 快速层保留小型完整性冒烟；真实原著套件和受控制作流程分别按 books、flows 选择。
import path from 'node:path';
import {readdir,readFile} from 'node:fs/promises';
export async function tierTests(tier,root=process.cwd()){
 if(!['unit','flows','books'].includes(tier))throw Error('Test tier must be unit, flows or books');
 const files=[];
 for(const name of (await readdir(path.join(root,'tests'))).filter(name=>name.endsWith('.test.mjs')).sort()){
  const source=await readFile(path.join(root,'tests',name),'utf8');
  const book=/import \{[^}]*\bbooks\b[^}]*\} from '\.\/fixtures\/test-tier\.mjs'/.test(source);
  const flow=/\bproductionFixture\(/.test(source);
  if(tier==='books'?book:!book&&flow===(tier==='flows'))files.push('tests/'+name);
 }
 return files;
}
