// Rebuilding a concurrent Vite server must preserve the first reader's versioned React URL.
// Use the reader's default cache and a separate preview cache; never open a story library.
// Owned launch caches also preserve the real lazy production PDF exporter after a competing port failure.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,rm,realpath,readFile,access,cp,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createServer as createSocket} from 'node:net';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {PDFDocument} from 'pdf-lib';
import {createDevelopmentCache,developmentServerOptions} from '../scripts/development-server.mjs';
import {checkoutFixture,startDevelopment,assertStopped} from './fixtures/development.mjs';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

async function freePort(){
 const socket=createSocket();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));
 const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));return port;
}

test('concurrent development optimizers retain each reader dependency URL',{timeout:30000},async t=>{
 const root=await realpath(await mkdtemp(path.join(os.tmpdir(),'shiqu-vite-cache-'))),servers=[];
 t.after(async()=>{await Promise.all(servers.map(server=>server.close()));await rm(root,{recursive:true,force:true});});
 await mkdir(path.join(root,'node_modules'));
 await writeFile(path.join(root,'package.json'),'{"type":"module"}');
 await writeFile(path.join(root,'index.html'),'<script type="module" src="/main.js"></script>');
 await writeFile(path.join(root,'main.js'),'import {createElement} from "react"; console.log(createElement("div"));');
 await symlink(path.resolve('node_modules/react'),path.join(root,'node_modules/react'),'junction');
 async function start({cacheDir,force=false}={}){
  const port=await freePort();
  const server=await createServer({configFile:false,root,cacheDir,logLevel:'silent',optimizeDeps:{include:['react'],force},server:{host:'127.0.0.1',port,strictPort:true}});
  servers.push(server);await server.listen();
  const origin=`http://127.0.0.1:${port}`,main=await fetch(origin+'/main.js');assert.equal(main.status,200);
  const source=await main.text(),dependency=source.match(/"([^"\n]*\/react\.js\?v=[^"\n]+)"/);
  assert.ok(dependency,source);
  const url=new URL(dependency[1],origin),response=await fetch(url);assert.equal(response.status,200);
  return {server,cacheDir:server.config.cacheDir,url,source:await response.text()};
 }
 const reader=await start(),other=await start({cacheDir:path.join(root,'preview-cache'),force:true});
 assert.notEqual(reader.cacheDir,other.cacheDir);
 await other.server.close();servers.splice(servers.indexOf(other.server),1);
 await rm(other.cacheDir,{recursive:true,force:true});
 const response=await fetch(reader.url);assert.equal(response.status,200);
 assert.equal(await response.text(),reader.source,'The original versioned React module must survive another optimizer and its cleanup');
});

test('development cache allocations are unique and their cleanup owns an immutable path',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'shiqu-owned-cache-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const first=await createDevelopmentCache(root),second=await createDevelopmentCache(root),own=first.directory;
 assert.notEqual(first.directory,second.directory);assert.equal(path.dirname(own),path.join(root,'node_modules','.cache'));
 first.directory=second.directory;await Promise.all([first.remove(),first.remove()]);await first.remove();
 await assert.rejects(access(own));await access(second.directory);await second.remove();
});

test('a failed competing optimizer preserves an actual lazy production PDF browser download',{timeout:60000},async t=>{
 const root=await realpath(await mkdtemp(path.join(os.tmpdir(),'shiqu-lazy-pdf-'))),repo=process.cwd(),servers=[],caches=[];let browser;
 t.after(async()=>{await browser?.close();for(const server of servers.reverse())await server.close();for(const cache of caches)await cache.remove();await rm(root,{recursive:true,force:true});});
 await mkdir(path.join(root,'node_modules'));
 for(const dependency of ['react','pdf-lib'])await symlink(path.resolve('node_modules',dependency),path.join(root,'node_modules',dependency),'junction');
 await writeFile(path.join(root,'package.json'),'{"type":"module"}');await writeFile(path.join(root,'index.html'),'<html lang="en"><body><button id="download">Download PDF</button><output id="progress"></output><script type="module" src="/main.js"></script></body></html>');
 await cp('tests/fixtures/images/portrait.png',path.join(root,'fixture.png'));
 const story={id:'isolated-pdf',generated:true,title:'The river crossing',summary:'Two travelers cross the river.',theme:'Courage',sourceText:'Mara and Ivo cross the river and return safely. FINAL_SOURCE_SENTINEL',sourceUrl:'https://example.test/source',sourceReference:'The river crossing',reflection:'Careful steps bring them home.',adaptationNote:'An original synthetic export verification.',publication:{author:'PDF cache fixture',workUrl:'',contact:'',sourceNote:'Original fixture',reuse:''},pages:[{caption:'Mara and Ivo cross safely.',prompt:'Two adult travelers reach the river bank together.',image:'/fixture.png',audio:''}]};
 const exporter='/@fs/'+path.join(repo,'lib/reader-pdf.ts');
 await writeFile(path.join(root,'main.js'),`import {createElement} from 'react';document.title=createElement('span').type+' PDF download';document.querySelector('#download').onclick=async()=>{try{const {downloadStoryPdf}=await import(${JSON.stringify(exporter)});await downloadStoryPdf(${JSON.stringify(story)},text=>document.querySelector('#progress').textContent=text);document.querySelector('#progress').textContent='PDF complete';}catch(error){document.querySelector('#progress').textContent=error.message;}};`);
 const firstCache=await createDevelopmentCache(root);caches.push(firstCache);const port=await freePort();
 const first=await createServer({configFile:false,root,cacheDir:firstCache.directory,logLevel:'silent',optimizeDeps:{include:['react','pdf-lib']},server:{...developmentServerOptions({port,apiPort:await freePort(),library:path.join(root,'unused-library')}),host:'127.0.0.1',fs:{allow:[root,repo],deny:['**/.data/**','**/*.sqlite','.env','.env.*']}}});servers.push(first);await first.listen();const origin=`http://127.0.0.1:${port}`;
 browser=await chromium.launch({headless:true});const page=await browser.newPage({acceptDownloads:true}),requests=[];page.on('response',response=>requests.push({url:response.url(),status:response.status()}));await page.goto(origin);await page.getByRole('button',{name:'Download PDF',exact:true}).waitFor();
 // No PDF dependency is requested until the real export action; a warm module graph would hide the bug.
 assert.equal(requests.some(request=>/\/pdf-lib\.js\?/.test(request.url)),false);
 const secondCache=await createDevelopmentCache(root);caches.push(secondCache);const second=await createServer({configFile:false,root,cacheDir:secondCache.directory,logLevel:'silent',optimizeDeps:{include:['react','pdf-lib'],force:true},server:{host:'127.0.0.1',port,strictPort:true}});servers.push(second);
 await assert.rejects(second.listen(),/already in use/);await second.close();servers.pop();await secondCache.remove();await access(firstCache.directory);await assert.rejects(access(secondCache.directory));
 const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Download PDF',exact:true}).click();const download=await downloading,file=await download.path();assert.ok(file);const pdf=await PDFDocument.load(await readFile(file));assert.equal(pdf.getTitle(),story.title);assert.ok(pdf.getPageCount()>=2);await page.getByText('PDF complete',{exact:true}).waitFor();
 const modules=requests.filter(request=>/\/pdf-lib\.js\?/.test(request.url));assert.ok(modules.length>0);assert.ok(modules.every(request=>request.status===200));for(const request of modules)assert.equal((await fetch(request.url)).status,200);
 assert.equal(requests.some(request=>new URL(request.url).pathname.startsWith('/api/')),false,'Exporting this saved fixture commissions no backend inference.');
});

test('an occupied-port dev launch opens no second library and preserves the running frontend cache',{timeout:60000},async t=>{
 const f=await checkoutFixture(t),store=f.store();store.save({provider:'readonly',providerConfigured:true});store.close();
 const first=await startDevelopment(t,f),source=await(await fetch(first.origin+'/client/main.tsx')).text(),url=source.match(/"([^"\n]*\/react\.js\?v=[^"\n]+)"/)?.[1];assert.ok(url,source);assert.equal((await fetch(new URL(url,first.origin))).status,200);
 const secondLibrary=path.join(f.root,'second-library-must-not-open'),second=spawn(process.execPath,['scripts/dev.mjs','--port',String(first.port)],{cwd:f.checkout,env:{...f.env,PATH:process.env.PATH,SHIQU_DATA_DIR:secondLibrary,SHIQU_API_PORT:String(first.apiPort)},stdio:['ignore','pipe','pipe']});let output='';second.stdout.on('data',chunk=>output+=chunk);second.stderr.on('data',chunk=>output+=chunk);f.defer(()=>{if(second.exitCode===null&&second.signalCode===null)second.kill('SIGTERM');});
 const [code]=await once(second,'exit');assert.equal(code,1,output);assert.match(output,/already in use/);await assert.rejects(access(secondLibrary));assert.equal((await fetch(new URL(url,first.origin))).status,200);assert.equal((await fetch(first.origin+'/api/reader/sessions')).status,200);await assertStopped(first);
});

test('an unconfirmed frontend close preserves its owned cache and still settles failed startup',{timeout:45000},async t=>{
 const f=await checkoutFixture(t),occupied=createSocket();await new Promise(resolve=>occupied.listen(0,'0.0.0.0',resolve));t.after(()=>new Promise(resolve=>occupied.close(resolve)));const port=occupied.address().port,library=path.join(f.root,'must-not-open');
 await writeFile(path.join(f.checkout,'vite.config.ts'),`export default {server:{host:'0.0.0.0',strictPort:true},plugins:[{name:'controlled-close-fault',configureServer(server){server.close=async()=>{throw Error('CONTROLLED_FRONTEND_CLOSE_FAILURE')};}}]};`);
 const child=spawn(process.execPath,['scripts/dev.mjs','--port',String(port)],{cwd:f.checkout,env:{...f.env,PATH:process.env.PATH,SHIQU_DATA_DIR:library,SHIQU_API_PORT:String(await freePort())},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);f.defer(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGTERM');});
 const [code]=await once(child,'exit');assert.equal(code,1,output);assert.match(output,/CONTROLLED_FRONTEND_CLOSE_FAILURE/);assert.match(output,/unclosed frontend cache was preserved/);await assert.rejects(access(library));const cacheParent=path.join(f.checkout,'node_modules','.cache'),preserved=(await readdir(cacheParent)).filter(name=>name.startsWith('shiqu-dev-'));assert.equal(preserved.length,1,'Without confirmed close the frontend cache remains available to any surviving writer.');await access(path.join(cacheParent,preserved[0]));
});

for(const signal of ['SIGINT','SIGTERM'])test(`controlled ${signal} during frontend creation never opens a late backend`,{timeout:45000},async t=>{
 const f=await checkoutFixture(t),port=await freePort(),library=path.join(f.root,'must-not-open');
 // IPC dispatches the real Node signal handlers on every platform, including Windows console tests.
 await writeFile(path.join(f.checkout,'vite.config.ts'),`export default {plugins:[{name:'controlled-create-gate',async configureServer(){console.log('CONTROLLED_FRONTEND_FACTORY_PENDING');await new Promise(resolve=>process.once('message',signal=>{process.emit(signal,signal,signal==='SIGTERM'?15:2);process.disconnect();setTimeout(resolve,25);}));}}]};`);
 const child=spawn(process.execPath,['scripts/dev.mjs','--port',String(port)],{cwd:f.checkout,env:{...f.env,PATH:process.env.PATH,SHIQU_DATA_DIR:library,SHIQU_API_PORT:String(await freePort())},stdio:['ignore','pipe','pipe','ipc']});let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);const exit=once(child,'exit');f.defer(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGTERM');});
 const deadline=Date.now()+15000;while(!output.includes('CONTROLLED_FRONTEND_FACTORY_PENDING')){assert.equal(child.exitCode,null,output);assert.ok(Date.now()<deadline,output);await new Promise(resolve=>setTimeout(resolve,5));}
 child.send(signal);const [code]=await exit;assert.equal(code,signal==='SIGINT'?0:143,output);assert.doesNotMatch(output,/Shiqu development:/);await assert.rejects(access(library));await assert.rejects(fetch(`http://127.0.0.1:${port}`));const remaining=(await readdir(path.join(f.checkout,'node_modules','.cache'))).filter(name=>name.startsWith('shiqu-dev-'));
 if(signal==='SIGINT')assert.deepEqual(remaining,[],'The late-created server is closed before its owned cache is removed.');
 else assert.equal(remaining.length,1,'Vite exits before its pending factory returns: keep the unconfirmed owned cache instead of deleting it underneath a writer.');
});
