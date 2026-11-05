// Regression test tiers. `unit` (pnpm test, PR CI) excludes the simulated-LLM production pipeline;
// `flows` (pnpm test:flows, release and npm gates) holds the files that drive it through productionFixture().
import path from 'node:path';
import {readdir,readFile} from 'node:fs/promises';
export async function tierTests(tier,root=process.cwd()){
 if(!['unit','flows'].includes(tier))throw Error('Test tier must be unit or flows');
 const files=[];
 for(const name of (await readdir(path.join(root,'tests'))).filter(name=>name.endsWith('.test.mjs')).sort()){
  const flow=/\bproductionFixture\(/.test(await readFile(path.join(root,'tests',name),'utf8'));
  if(flow===(tier==='flows'))files.push('tests/'+name);
 }
 return files;
}
