// Stage the desktop application payload; the pinned Node runtime is bundled separately.
// Stage the isolated document-reader worker and copy its parser dependencies with the server's imports.
import {build} from 'esbuild';
import {cp,mkdir,readFile,rm,writeFile,stat} from 'node:fs/promises';
import {createRequire,isBuiltin} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function matchesTarget(values,current){return !values?.length||!values.includes('!'+current)&&(!values.some(value=>!value.startsWith('!'))||values.includes(current));}
export async function copyDesktopPackage(name,from,directory){
 if(isBuiltin(name))return;
 const require=createRequire(path.join(from,'package.json'));let location=path.dirname(require.resolve(name));
 while(true){
  try{if(JSON.parse(await readFile(path.join(location,'package.json'),'utf8')).name===name)break;}catch{}
  const parent=path.dirname(location);if(parent===location)throw Error('Cannot locate production package '+name);location=parent;
 }
 const manifest=JSON.parse(await readFile(path.join(location,'package.json'),'utf8'));
 if(!matchesTarget(manifest.os,process.platform)||!matchesTarget(manifest.cpu,process.arch))return;
 if(process.platform==='linux'&&manifest.libc){const libc=process.report?.getReport().header.glibcVersionRuntime?'glibc':'musl';if(!matchesTarget(manifest.libc,libc))return;}
 const destination=path.join(directory,'node_modules',name);
 await cp(location,destination,{recursive:true,dereference:true,filter:source=>source===location||path.relative(location,source).split(path.sep)[0]!=='node_modules'});
 for(const dependency of Object.keys(manifest.dependencies||{}))await copyDesktopPackage(dependency,location,destination);
 const packageRequire=createRequire(path.join(location,'package.json'));
 for(const dependency of Object.keys(manifest.optionalDependencies||{})){
  try{packageRequire.resolve(dependency);}catch(error){if(error.code==='MODULE_NOT_FOUND'||error.code==='ERR_PACKAGE_PATH_NOT_EXPORTED')continue;throw error;}
  await copyDesktopPackage(dependency,location,destination);
 }
}
export async function stageDesktopResources(entry='server/desktop.ts',target=path.join(root,'desktop/resources/runtime')){
 await rm(target,{recursive:true,force:true});await mkdir(path.join(target,'dist/server'),{recursive:true});
 const output=await build({entryPoints:[path.join(root,entry)],outfile:path.join(target,'dist/server/desktop.js'),bundle:true,platform:'node',format:'esm',target:'node24',packages:'external',metafile:true});
 const worker=await build({entryPoints:[path.join(root,'server/story-import-worker.mjs')],outfile:path.join(target,'dist/server/story-import-worker.mjs'),bundle:true,platform:'node',format:'esm',target:'node24',packages:'external',metafile:true});
 const dependencies=[...new Set([output,worker].flatMap(bundle=>Object.values(bundle.metafile.outputs).flatMap(file=>file.imports.filter(item=>item.external&&!item.path.startsWith('node:')).map(item=>item.path.startsWith('@')?item.path.split('/').slice(0,2).join('/'):item.path.split('/')[0]))))];
 for(const dependency of dependencies)await copyDesktopPackage(dependency,root,target);
 for(const [source,destination] of [['dist/client','dist/client'],['data/library','data/library'],['drizzle','drizzle'],['docker/seed.sql','docker/seed.sql']]){
  await mkdir(path.dirname(path.join(target,destination)),{recursive:true});await cp(path.join(root,source),path.join(target,destination),{recursive:true,dereference:true});
 }
 await writeFile(path.join(target,'package.json'),JSON.stringify({name:'shiqu-desktop-runtime',private:true,type:'module',engines:{node:'>=24 <25'}},null,2)+'\n');
 await writeFile(path.join(target,'payload.json'),JSON.stringify({edition:'standard',nodeBundled:true,dependencies},null,2)+'\n');
 // A fixed allowlist is deliberate: never copy a checkout, .env, .data, or writable ./data.
 return {target,dependencies};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.slice(2).some(value=>value.startsWith('--')))throw Error('Unknown desktop resource option');
 const entry=process.argv[2]||'server/desktop.ts';
 await stat(path.join(root,entry));
 const result=await stageDesktopResources(entry);console.log('Desktop application payload prepared ('+result.dependencies.length+' production entry packages).');
}
