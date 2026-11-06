// English CLI guidance; canonical archive names and source identities stay stable.
// Export named stories with the production Node renderer and the running app's read-only API.
// Preserve signed artwork in ZIP inputs; validate current revisions and public archives before replacement.
import assert from 'node:assert/strict';
import {copyFile,lstat,mkdir,mkdtemp,readFile,readdir,rename,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {sha256Hex as digest} from '../lib/story-webp-metadata.ts';
import {zipFilename} from '../lib/reader-zip-content.ts';
import {savedJSON,publicStoryZip} from '../lib/public-story-zip.mjs';
export {publicStoryZip} from '../lib/public-story-zip.mjs';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const collection=path.resolve(project,'../awesome-shiqu');


async function collectionCheck(bytes){
 const parser=path.join(collection,'site/assets/story-archive.mjs');
 try{await lstat(parser);}catch(error){if(error.code==='ENOENT')return;throw error;}
 const {parseStoryArchive}=await import(pathToFileURL(parser).href);
 await parseStoryArchive(bytes,{id:'yysun--export-check',author:'yysun',publishedAt:new Date().toISOString().slice(0,10)});
}

export async function exportStory(input,{output,outputDirectory=path.join(collection,'works/yysun'),resolveCurrentId}={}){
 const {bytes,story}=publicStoryZip(new Uint8Array(await readFile(input)));
 await collectionCheck(bytes);
 await mkdir(output?path.dirname(path.resolve(output)):outputDirectory,{recursive:true});
 let target=output?path.resolve(output):path.join(outputDirectory,zipFilename(story.title));
 if(!output){
  const matches=[];
  for(const name of await readdir(outputDirectory)){
   if(!name.endsWith('.zip'))continue;
   const filename=path.join(outputDirectory,name),saved=savedJSON(new Uint8Array(await readFile(filename)));
   if(saved.id===story.id||resolveCurrentId&&await resolveCurrentId(saved.id)===story.id)matches.push(filename);
  }
  assert(matches.length<=1,'The output directory has multiple ZIPs for this work. Remove duplicates first.');
  if(matches.length)target=matches[0];
 }
 let existing;
 try{assert((await lstat(target)).isFile(),'The output path must be a regular file.');existing=await readFile(target);}
 catch(error){if(error.code!=='ENOENT')throw error;}
 if(existing&&!output){
  const id=savedJSON(new Uint8Array(existing)).id;
  assert(id===story.id||resolveCurrentId&&await resolveCurrentId(id)===story.id,'The ZIP with this name belongs to another work. Specify --output explicitly.');
 }
 const temporary=target+'.tmp',backup=await mkdtemp(path.join(tmpdir(),'shiqu-export-'));
 let replaced=false,wroteTemporary=false;
 try{
  await writeFile(temporary,bytes,{flag:'wx'});wroteTemporary=true;
  if(existing)await copyFile(target,path.join(backup,'previous.zip'));
  await rename(temporary,target);replaced=true;
  const saved=await readFile(target);assert(digest(saved)===digest(bytes),'The saved ZIP does not match the exported bytes.');
  await collectionCheck(saved);
 }catch(error){
  if(replaced){if(existing){await copyFile(path.join(backup,'previous.zip'),temporary);await rename(temporary,target);}else await rm(target);}
  throw error;
 }finally{if(wroteTemporary)await rm(temporary,{force:true});await rm(backup,{recursive:true,force:true});}
 return {path:target,title:story.title,pages:story.pages.length,bytes:bytes.length,sha256:digest(bytes)};
}

export function selectExportSession(sessions,name){
 const matches=sessions.filter(session=>!session.superseded&&(session.id===name||session.story?.title===name||session.selection?.storyTitle===name));
 assert(matches.length,`Not found on the bookshelf: ${name}`);
 assert(matches.length===1,`Multiple stories have this title. Specify a work ID: ${matches.map(session=>`${session.story?.title||name} (${session.id})`).join('; ')}`);
 const session=matches[0],pages=session.story?.pages;
 assert(pages?.length,'This story has no saved storyboard yet.');
 const missing=pages.flatMap((page,index)=>page.image?[]:[index+1]);
 assert(!missing.length,`Missing images for frames ${missing.join(', ')}. Complete the current revision; an older revision will not be exported.`);
 assert(session.state==='completed','The current story revision is incomplete. Finish it before exporting.');
 return session;
}

export async function exportNamedStory(name,{appUrl='http://localhost:3000',onProgress=()=>{},...options}={}){
 const base=new URL(appUrl);assert(['http:','https:'].includes(base.protocol),'The app address must use HTTP or HTTPS.');
 const app={handle:request=>{const url=new URL(request.url);return fetch(new URL(url.pathname+url.search,base),{redirect:'error',signal:AbortSignal.timeout(30000)});}};
 async function api(route,optional=false){
  const response=await app.handle(new Request('http://shiqu.local/api/reader/'+route));
  if(optional&&response.status===404)return null;
  assert(response.ok,`Could not read Shiqu ${route}: HTTP ${response.status}. Check the app address and access permissions.`);
  return response.json();
 }
 const selected=selectExportSession(await api('sessions'),name);
 // Shelf summaries omit saved original text; the production exporter needs the complete current story.
 const session=selectExportSession([await api(`sessions/${selected.id}`)],selected.id);
 assert((await api(`sessions/${session.id}/current`)).id===session.id,'The bookshelf has switched to a newer revision. Export again.');
 onProgress(`Selected: ${session.story.title} · Revision ${session.revision?.number||1} · ${session.story.pages.length} frames`);
 const temporary=await mkdtemp(path.join(tmpdir(),'shiqu-native-export-'));
 try{
  const {exportLocalStory}=await import('../server/story-export.ts');
  const input=path.join(temporary,'story.zip');
  onProgress('Generating public ZIP through Node…');
  await exportLocalStory(project,app,session,{format:'zip',output:input});
  const data=savedJSON(new Uint8Array(await readFile(input)));
  assert(data.id===session.id&&data.revision===(session.revision?.number||1),'The export is not the selected current revision.');
  assert((await api(`sessions/${session.id}/current`)).id===session.id,'The bookshelf switched to a newer revision during export. Export again.');
  const currentIds=new Map();
  async function resolveCurrentId(id){
   if(!currentIds.has(id)){
    const current=/^[0-9a-f-]{36}$/i.test(id)?await api(`sessions/${id}/current`,true):null;
    currentIds.set(id,current?.id);
   }
   return currentIds.get(id);
  }
  onProgress('Verifying and saving public ZIP…');
  return await exportStory(input,{...options,resolveCurrentId});
 }finally{await rm(temporary,{recursive:true,force:true});}
}

async function main(){
 const {values,positionals}=parseArgs({options:{output:{type:'string'},url:{type:'string',default:'http://localhost:3000'},help:{type:'boolean',short:'h'}},allowPositionals:true});
 if(values.help){
  console.log('Usage: pnpm export:story <story-title, work-id, or downloaded.zip> [--url http://localhost:3000] [--output output.zip]\nStory title/ID: read the current revision from the running app and create a public ZIP using the production Node exporter. No browser or Playwright is needed.\nZIP file: convert an existing download while preserving image bytes. Output defaults to ../awesome-shiqu/works/yysun and retains the existing filename for the same work.');return;
 }
 assert(positionals.length===1,'Provide a story title, work ID, or downloaded ZIP. See pnpm export:story --help.');
 const input=positionals[0],options={output:values.output};
 const result=/\.zip$/i.test(input)?await exportStory(input,options):await exportNamedStory(input,{...options,appUrl:values.url,onProgress:console.log});
 console.log(`Exported: ${result.path}\n${result.pages} frames, ${(result.bytes/1024/1024).toFixed(2)} MiB\nSHA-256: ${result.sha256}`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{console.error(error.message);process.exitCode=1;});
