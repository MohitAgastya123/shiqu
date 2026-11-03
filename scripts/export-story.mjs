// Download named stories through the app UI, then export the public collection format without re-encoding artwork.
// Public fields are allowlisted; complete frames and saved hashes are checked before replacement.
import assert from 'node:assert/strict';
import {copyFile,lstat,mkdir,mkdtemp,readFile,readdir,rename,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {unzipSync,zipSync,strFromU8} from 'fflate';
import {sha256Hex as digest,assertStoryWebp} from '../lib/story-webp-metadata.ts';
import {zipFilename,zipImageFilename,publicStoryZipData,zipMetadataStory,storyZipFiles} from '../lib/reader-zip-content.ts';
import {hasPublicationAuthor,publicationSchema,withPublicationDefaults} from '../lib/story-publication.ts';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const collection=path.resolve(project,'../awesome-shiqu');

function savedJSON(bytes){
 assert(bytes.length<=100*1024*1024,'ZIP 超过 100 MiB。');
 const files=unzipSync(bytes,{filter:file=>file.name==='故事.json'});
 assert(files['故事.json']?.length<=1024*1024,'缺少故事.json，或故事.json 超过 1 MiB。');
 return JSON.parse(strFromU8(files['故事.json']));
}

export function publicStoryZip(bytes){
 const input=savedJSON(bytes);
 assert(input&&typeof input==='object'&&!Array.isArray(input),'故事.json 必须是对象。');
 for(const key of ['id','title','sourceReference','sourceText','aiDisclosure'])assert(typeof input[key]==='string'&&input[key].trim(),`缺少${key}，不能导出完整作品。`);
 assert(Array.isArray(input.pages)&&input.pages.length>=1&&input.pages.length<=80,'故事需要 1–80 幅。');
 const story=publicStoryZipData(input),files={},metadata=zipMetadataStory(story);
 const wanted=new Set(input.pages.map((page,index)=>{
  const expected=zipImageFilename(index,input.pages.length);
  assert(page.image===expected,`第 ${index+1} 幅必须有连续编号的 WebP 图片：${expected}`);
  return expected;
 }));
 const images=unzipSync(bytes,{filter:file=>wanted.has(file.name)&&file.originalSize<=12*1024*1024});
 story.pages.forEach((page,index)=>{
  const image=images[page.image];
  assert(image?.length,`缺少第 ${index+1} 幅图片，或图片超过 12 MiB。`);
  assertStoryWebp(image,metadata,index,page);
  assert(typeof page.caption==='string'&&page.caption.trim(),`第 ${index+1} 幅缺少旁白。`);
  files[page.image]=image;
 });
 Object.assign(files,storyZipFiles(story,{includePrompts:false}));
 for(const name of ['分镜.md','故事.json','署名与转载.txt'])assert(files[name].length<=1024*1024,`${name} 超过 1 MiB。`);
 const output=zipSync(files,{level:0});assert(output.length<=100*1024*1024,'导出 ZIP 超过 100 MiB。');
 return {bytes:output,story};
}

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
  assert(matches.length<=1,'输出目录已有同一作品的多个 ZIP，请先清理重复文件。');
  if(matches.length)target=matches[0];
 }
 let existing;
 try{assert((await lstat(target)).isFile(),'输出路径必须是普通文件。');existing=await readFile(target);}
 catch(error){if(error.code!=='ENOENT')throw error;}
 if(existing&&!output){
  const id=savedJSON(new Uint8Array(existing)).id;
  assert(id===story.id||resolveCurrentId&&await resolveCurrentId(id)===story.id,'同名 ZIP 属于另一作品，请用 --output 明确指定输出路径。');
 }
 const temporary=target+'.tmp',backup=await mkdtemp(path.join(tmpdir(),'shiqu-export-'));
 let replaced=false,wroteTemporary=false;
 try{
  await writeFile(temporary,bytes,{flag:'wx'});wroteTemporary=true;
  if(existing)await copyFile(target,path.join(backup,'previous.zip'));
  await rename(temporary,target);replaced=true;
  const saved=await readFile(target);assert(digest(saved)===digest(bytes),'保存后的 ZIP 与导出内容不符。');
  await collectionCheck(saved);
 }catch(error){
  if(replaced){if(existing){await copyFile(path.join(backup,'previous.zip'),temporary);await rename(temporary,target);}else await rm(target);}
  throw error;
 }finally{if(wroteTemporary)await rm(temporary,{force:true});await rm(backup,{recursive:true,force:true});}
 return {path:target,title:story.title,pages:story.pages.length,bytes:bytes.length,sha256:digest(bytes)};
}

export function selectExportSession(sessions,name){
 const matches=sessions.filter(session=>!session.superseded&&(session.id===name||session.story?.title===name||session.selection?.storyTitle===name));
 assert(matches.length,`书架没有找到：${name}`);
 assert(matches.length===1,`同名故事不止一篇，请指定作品 ID：${matches.map(session=>`${session.story?.title||name} (${session.id})`).join('；')}`);
 const session=matches[0],pages=session.story?.pages;
 assert(pages?.length,'这篇故事尚未保存分镜。');
 const missing=pages.flatMap((page,index)=>page.image?[]:[index+1]);
 assert(!missing.length,`缺少第 ${missing.join('、')} 幅图片；请完成当前版本，不导出旧版。`);
 assert(session.state==='completed','当前故事版本尚未制作完成，请完成后再导出。');
 return session;
}

export async function exportNamedStory(name,{appUrl='http://localhost:3000',onProgress=()=>{},...options}={}){
 const base=new URL(appUrl);assert(['http:','https:'].includes(base.protocol),'应用地址必须使用 http 或 https。');
 const {chromium}=await import('playwright');
 let browser;
 try{browser=await chromium.launch({headless:true});}
 catch(error){if(error.message.includes("Executable doesn't exist"))throw Error('请先安装导出浏览器：pnpm exec playwright install chromium --only-shell');throw error;}
 try{
  const page=await browser.newPage({acceptDownloads:true});page.setDefaultTimeout(30000);
  async function api(route,optional=false){
   const response=await page.request.get(new URL('/api/reader/'+route,base).href);
   if(optional&&response.status()===404)return null;
   assert(response.ok(),`无法读取拾趣 ${route}：HTTP ${response.status()}。请确认应用地址及访问权限。`);
   return response.json();
  }
  const session=selectExportSession(await api('sessions'),name);
  const defaults=await api('publication-defaults');
  const credited=withPublicationDefaults(session.story,defaults.publication===null?null:publicationSchema.parse(defaults.publication));
  assert(hasPublicationAuthor(credited.publication),'这篇故事未署名，请在拾趣中填写署名后重试；需要未署名导出时，请在应用内确认并用 ZIP 输入模式。');
  onProgress(`已选择：${session.story.title} · 版本 ${session.revision?.number||1} · ${session.story.pages.length} 幅`);
  await page.goto(new URL('/read?id='+encodeURIComponent(session.id),base).href);
  await page.getByRole('button',{name:'故事设置',exact:true}).click();
  const settings=page.getByRole('dialog',{name:'故事设置',exact:true});
  onProgress('正在通过拾趣下载 ZIP…');
  const [download]=await Promise.all([
   page.waitForEvent('download',{timeout:300000}),
   settings.getByRole('button',{name:/^下载 ZIP/}).click(),
  ]);
  const input=await download.path(),failure=await download.failure();assert(!failure,`应用下载失败：${failure}`);
  const data=savedJSON(new Uint8Array(await readFile(input)));
  assert(data.id===session.id&&data.revision===(session.revision?.number||1),'下载文件不是所选的当前版本。');
  assert((await api(`sessions/${session.id}/current`)).id===session.id,'下载期间书架已切换到新版，请重新导出。');
  const currentIds=new Map();
  async function resolveCurrentId(id){
   if(!currentIds.has(id)){
    const current=/^[0-9a-f-]{36}$/i.test(id)?await api(`sessions/${id}/current`,true):null;
    currentIds.set(id,current?.id);
   }
   return currentIds.get(id);
  }
  onProgress('正在移除提示词并验证公开 ZIP…');
  return await exportStory(input,{...options,resolveCurrentId});
 }finally{await browser.close();} // Closing the context also removes Playwright's temporary full ZIP.
}

async function main(){
 const {values,positionals}=parseArgs({options:{output:{type:'string'},url:{type:'string',default:'http://localhost:3000'},help:{type:'boolean',short:'h'}},allowPositionals:true});
 if(values.help){
  console.log('用法：pnpm export:story <故事名、作品ID或已下载的.zip> [--url http://localhost:3000] [--output 输出.zip]\n故事名/ID：启动无头浏览器，点击应用的下载 ZIP，再移除提示词。应用需已启动；首次运行先执行 pnpm exec playwright install chromium --only-shell。\nZIP 文件：直接转换现有下载。默认保存到 ../awesome-shiqu/works/yysun，并沿用同作品的已有文件名。');return;
 }
 assert(positionals.length===1,'请提供一个故事名、作品 ID 或已下载的 ZIP；详见 pnpm export:story --help。');
 const input=positionals[0],options={output:values.output};
 const result=/\.zip$/i.test(input)?await exportStory(input,options):await exportNamedStory(input,{...options,appUrl:values.url,onProgress:console.log});
 console.log(`已导出：${result.path}\n${result.pages} 幅，${(result.bytes/1024/1024).toFixed(2)} MiB\nSHA-256：${result.sha256}`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{console.error(error.message);process.exitCode=1;});
