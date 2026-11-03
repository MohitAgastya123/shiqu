// Run the real command dispatcher with production API/queue/SQLite and controlled adapters, without HTTP or DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile,readFile,mkdir,symlink,readdir} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {unzipSync,strFromU8} from 'fflate';
import {PDFDocument} from 'pdf-lib';
import {loadImage} from '@napi-rs/canvas';
import {executeHeadless,CliCommandError} from '../server/headless-cli.ts';
import {productionFixture,selection} from './fixtures/production.mjs';
import {startupFixture} from './fixtures/startup.mjs';
import {libraryFixture} from './fixtures/story-library.mjs';
import {withLocalBooks} from '../server/local-generation.ts';
import {emptyPublication} from '../lib/story-publication.ts';
import {assertStoryWebp} from '../lib/story-webp-metadata.ts';
import {zipMetadataStory} from '../lib/reader-zip-content.ts';
import {DatabaseSync} from 'node:sqlite';
import {createApplication} from '../server/app.ts';

async function fixture(t){
 const f=await productionFixture(t);await f.stop();
 const library=libraryFixture();f.control.autoLength=3;f.control.hold=false;
 f.control.beforeText=async(kind,payload)=>kind==='recommend'?{storySummary:library.stories.find(s=>payload.verifiedOriginal.text.includes(library.book.sections[0].units.find(u=>u.id===s.source.firstUnit).text))?.summary||library.stories[0].summary,storyMatchReason:'原文的行动和结果支持故事。'}:undefined;
 f.generation.suggestions=library.provider.suggestions;f.generation.matchStories=library.provider.matchStories;
 const generation=withLocalBooks(f.generation,library.books,f.media),context={generation,localBooks:library.books,variables:{}};
 const call=(args,input)=>executeHeadless(process.cwd(),[...args,'--data-dir',f.dataDirectory],{...context,input:input||{}});
 const inspect=()=>new DatabaseSync(path.join(f.dataDirectory,'shiqu.sqlite'),{readOnly:true});
 return {f,library,call,context,inspect};
}
test('in-process CLI saves intent without inference, runs bounded discovery/preparation/review and completes one story', {timeout:60000},async t=>{
 const {f,library,call,inspect}=await fixture(t),requestId=crypto.randomUUID();
 const created=await call(['stories','create','--request-id',requestId],{bookId:'zhuangzi',theme:'原典故事'}),id=created.session.id;
 assert.equal((await call(['stories','create','--request-id',requestId],{bookId:'zhuangzi',theme:'原典故事'})).session.id,id);
 assert.equal(library.calls.catalog.length,0);assert.equal(f.control.plans.length,0);
 await assert.rejects(call(['stories','search',id]),error=>error.code==='GENERATION_REQUIRED');
 const searchId=crypto.randomUUID(),searchInput={generation:created.session.intake.generation};await call(['stories','search',id,'--request-id',searchId],searchInput);await call(['stories','search',id,'--request-id',searchId],searchInput);assert.equal(library.calls.catalog.length,0);
 const candidates=await call(['run',id,'--until','candidates','--timeout','10']);assert.equal(candidates.reason,'candidates');assert.ok(candidates.session.intake.batches[0].stories.length);
 const chooseId=crypto.randomUUID(),chooseInput={generation:candidates.session.intake.generation};await call(['stories','choose',id,'--request-id',chooseId],chooseInput);await call(['stories','choose',id,'--request-id',chooseId],chooseInput);assert.equal(f.control.recommendations.length,0);
 await assert.rejects(call(['stories','choose',id],chooseInput),error=>error.code==='CONFLICT');
 const prepared=await call(['run',id,'--until','prepared','--timeout','10']);assert.equal(prepared.reason,'prepared');assert.equal(f.control.plans.length,0);
 const confirmId=crypto.randomUUID(),confirmInput={generation:prepared.session.intake.generation};await call(['stories','confirm',id,'--request-id',confirmId],confirmInput);await call(['stories','confirm',id,'--request-id',confirmId],confirmInput);assert.equal((await call(['run',id,'--until','prepared','--timeout','1'])).reason,'already_prepared');assert.equal(f.control.plans.length,0);
 const pauseId=crypto.randomUUID();await call(['stories','pause',id,'--request-id',pauseId]);await call(['stories','pause',id,'--request-id',pauseId]);assert.equal((await call(['run',id,'--timeout','1'])).reason,'paused');assert.equal(f.control.plans.length,0);
 await call(['stories','resume',id]);const reviewed=await call(['run',id,'--until','reviewed','--timeout','10']);assert.equal(reviewed.reason,'reviewed');assert.equal(f.control.calls.length,0);
 const completed=await call(['run',id,'--timeout','10']);assert.equal(completed.reason,'completed');assert.equal(f.control.calls.length,3);
 const before=f.control.plans.length;
 await call(['stories','rename',id,'--title','离线故事']);assert.equal((await call(['stories','get',id])).story.title,'离线故事');
 const editId=crypto.randomUUID(),changes={token:(await call(['stories','revisions',id])).token,changes:{acceptancePrompt:'保留原文关键行动'}};
 const edited=await call(['stories','edit',id,'--request-id',editId],changes);assert.notEqual(edited.session.id,id);assert.equal(f.control.plans.length,before);
 const replay=await call(['stories','edit',id,'--request-id',editId],changes);assert.equal(replay.session.id,edited.session.id);
 await assert.rejects(call(['run',id,'--timeout','1']),error=>error.code==='SUPERSEDED_VERSION');
 const db=inspect();assert.equal(db.prepare('SELECT count(*) AS n FROM reader_sessions').get().n,2);db.close();
 const backup=path.join(f.root,'backup'),restored=path.join(f.root,'restored');await call(['backup',backup]);await call(['verify-backup',backup]);
 await executeHeadless(process.cwd(),['restore',backup,'--data-dir',restored],{variables:{}});
 const copied=await executeHeadless(process.cwd(),['stories','get',edited.session.id,'--data-dir',restored],{variables:{}});assert.equal(copied.id,edited.session.id);assert.equal(f.control.plans.length,before);
});
test('targeted run cannot dispatch another active story and direct-inference API routes never execute', {timeout:30000},async t=>{
 const {f,library,call,inspect}=await fixture(t);
 const localSelection={...selection,source:library.stories[0].source,storyTitle:library.stories[0].title};const first=await call(['stories','create','--no-intake'],localSelection),second=await call(['stories','create','--no-intake'],{...selection,theme:'善意与误解'});
 const dormant=createApplication({...f.options,production:{autoStart:false}});await dormant.services.production.request(dormant.services.ownerId,second.session.id,crypto.randomUUID(),0);await dormant.close();
 const beforeDb=inspect(),beforeJobs=beforeDb.prepare('SELECT * FROM production_jobs WHERE session_id=? ORDER BY id').all(second.session.id);beforeDb.close();assert.ok(beforeJobs.length);
 assert.equal(f.control.plans.length,0);const result=await call(['run',first.session.id,'--timeout','10']);assert.equal(result.reason,'completed',JSON.stringify(result.session));
 const db=inspect();assert.deepEqual(db.prepare('SELECT * FROM production_jobs WHERE session_id=? ORDER BY id').all(second.session.id),beforeJobs);db.close();
 await assert.rejects(call(['run',second.session.id,'--until','prepared']),error=>error.code==='BOUNDARY_UNAVAILABLE');
 const gate=await call(['stories','create','--no-intake'],{...localSelection,narrativeDetail:'balanced'});assert.equal((await call(['run',gate.session.id,'--until','prepared','--timeout','10'])).reason,'frame_count_required');
 const count=f.control.calls.length+f.control.plans.length;
 for(const [method,route]of [['POST','reader/suggestions'],['POST','reader/art-recommendation'],['POST',`reader/sessions/${first.session.id}/advance`],['POST','admin/generate'],['GET','reader/unknown']])await assert.rejects(call(['api',method,route]),error=>error.code==='EXECUTION_REQUIRED');
 assert.equal(f.control.calls.length+f.control.plans.length,count);
});
test('timeout and explicit fault recovery retain checkpoints and request identities', {timeout:30000},async t=>{
 const {f,library,call}=await fixture(t),local={...selection,source:library.stories[0].source,storyTitle:library.stories[0].title};
 const first=await call(['stories','create','--no-intake'],local),id=first.session.id;
 const original=f.control.beforeText;let slow=true;f.control.beforeText=async(...args)=>{if(slow){slow=false;await new Promise(r=>setTimeout(r,100));}return original(...args);};
 await assert.rejects(call(['run',id,'--timeout','0.01']),error=>error.code==='TIMEOUT');
 assert.equal((await call(['run',id,'--timeout','10'])).reason,'completed');
 const next=(await call(['stories','create','--no-intake'],local)).session.id;let failed=false;
 f.control.beforeText=async(...args)=>{if(!failed){failed=true;throw Error('controlled command failure');}return original(...args);};
 const blocked=await call(['run',next,'--timeout','10']);assert.equal(blocked.reason,'blocked');const fault=blocked.session.faults.find(f=>f.retryAllowed);assert.ok(fault);
 assert.equal((await call(['run',next])).reason,'blocked');
 await assert.rejects(call(['stories','retry',next],{faultId:crypto.randomUUID()}),error=>error.code==='CONFLICT');
 const request=crypto.randomUUID();await call(['stories','retry',next,'--request-id',request],{faultId:fault.id});
 await call(['stories','retry',next,'--request-id',request],{faultId:fault.id});
 const recovered=await call(['run',next,'--timeout','10']);assert.equal(recovered.reason,'completed',JSON.stringify(recovered.session));
});
test('same native/browser export core produces credited public ZIP, PDF, PNG and escaped offline preview', {timeout:60000},async t=>{
 const {f,library,call}=await fixture(t);const created=await call(['stories','create','--no-intake'],{...selection,source:library.stories[0].source,storyTitle:library.stories[0].title}),id=created.session.id;const produced=await call(['run',id,'--timeout','10']);assert.equal(produced.reason,'completed',JSON.stringify(produced.session));
 await assert.rejects(call(['export',id,'--format','zip','--output',path.join(f.root,'unsigned.zip')]),/EXPORT_UNSIGNED/);
 await call(['api','POST','reader/publication-defaults'],{publication:{...emptyPublication,author:'测试作者'},expected:null});
 const snapshot=await call(['stories','get',id]),source=snapshot.story.pages[0].image.replace('/api/reader/media/','reader/'),original=await readFile(path.join(f.dataDirectory,'media',source));
 const zipFile=path.join(f.root,'story.zip');await call(['export',id,'--format','zip','--output',zipFile]);
 const files=unzipSync(await readFile(zipFile)),saved=JSON.parse(strFromU8(files['故事.json']));assert.equal(saved.author,'测试作者');assert.equal(saved.pages.length,8);
 assert.deepEqual(Object.keys(files).filter(n=>!n.startsWith('图片/')).sort(),['分镜.md','故事.json','署名与转载.txt']);
 for(const [i,page]of saved.pages.entries())assertStoryWebp(files[page.image],zipMetadataStory(saved),i,page);
 assert.deepEqual(await readFile(path.join(f.dataDirectory,'media',source)),original);
 const pdfFile=path.join(f.root,'story.pdf'),pngFile=path.join(f.root,'story.png');await call(['export',id,'--format','pdf','--output',pdfFile]);await call(['export',id,'--format','png','--output',pngFile]);
 assert.ok((await PDFDocument.load(await readFile(pdfFile))).getPageCount()>=9);assert.ok((await loadImage(await readFile(pngFile))).height>1000);
 await call(['stories','rename',id,'--title','<script>alert(1)</script>']);const preview=path.join(f.root,'preview.html');await call(['preview',id,'--output',preview]);const html=await readFile(preview,'utf8');assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('data:image/png;base64,'));
 await assert.rejects(call(['export',id,'--output',zipFile]),/EEXIST/);
});
test('real CLI subcommands initialize/inspect/export diagnostics with one JSON stdout and no network listener', {timeout:30000},async t=>{
 const f=await startupFixture(t),source=new URL('../server/cli.ts',import.meta.url).href,directory=path.join(f.root,'headless-library');
 async function cli(args){
  const code=`import net from 'node:net';net.Server.prototype.listen=()=>{throw Error('LISTEN_FORBIDDEN')};globalThis.fetch=async()=>{throw Error('NETWORK_FORBIDDEN')};const {runCli}=await import(${JSON.stringify(source)});await runCli(process.argv[1],process.argv.slice(2));`;
  const child=spawn(process.execPath,['--experimental-strip-types','--input-type=module','-e',code,f.root,...args],{cwd:f.root,env:f.env,stdio:['ignore','pipe','pipe']});let output='',errors='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>errors+=c);const [exit]=await once(child,'exit');return {exit,value:JSON.parse(output),errors};
 }
 for(const args of [['help','--json'],['catalog'],['init','--data-dir',directory],['stories','list','--data-dir',directory],['status','--data-dir',directory],['diagnostics','--data-dir',directory,'--output',path.join(f.root,'diagnostic.json')]]){const result=await cli(args);assert.equal(result.exit,0,result.errors);assert.equal(result.value.ok,true);assert.equal(result.value.schemaVersion,1);}
 const failure=await cli(['api','POST','reader/suggestions','--data-dir',directory]);assert.notEqual(failure.exit,0);assert.equal(failure.value.error.code,'EXECUTION_REQUIRED');
 const missing=await cli(['stories','list','--data-dir',path.join(f.root,'missing')]);assert.notEqual(missing.exit,0);assert.equal(missing.value.error.code,'LIBRARY_NOT_FOUND');
});
