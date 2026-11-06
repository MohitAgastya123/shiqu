// The production desktop HTTP service uses isolated settings; native IPC fixtures verify interactions without claiming operating-system packaging coverage.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,rename} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';
import {build,createServer} from 'vite';
import {startupFixture,freeStartupPort} from './fixtures/startup.mjs';
import {SystemSettingsStore} from '../server/system-settings.ts';
import {defaultSystemSettings} from '../lib/system-settings.ts';
import {startDesktop} from '../server/desktop.ts';
const output=path.resolve(process.env.SHIQU_TEST_OUTPUT||'.data/e2e/desktop-service-console');

test('console-only desktop, lifecycle IPC and actual desktop browser settings',{timeout:120000},async t=>{
 await mkdir(output,{recursive:true});
 const browser=await chromium.launch({headless:true});t.after(()=>browser.close());const page=await browser.newPage({viewport:{width:1040,height:820}}),errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(10000);
 try {
 const preview=await createServer({configFile:path.resolve('desktop/vite.config.ts'),optimizeDeps:{noDiscovery:true,include:['react','react-dom/client','@tauri-apps/api/core','qrcode','lucide-react','zod']},server:{port:await freeStartupPort(),strictPort:true}});await preview.listen();t.after(()=>preview.close());const consoleUrl=preview.resolvedUrls.local[0];
 const settings=defaultSystemSettings('/tmp/isolated-console/library');
 await page.addInitScript(({settings})=>{
  const mock={settings,revision:0,calls:[],mode:'stopped',unknown:false,status:{running:false,phoneUrls:[],state:'stopped'}};
  window.consoleFixture=mock;window.isTauri=true;
  window.__TAURI_INTERNALS__={invoke:async(cmd,args)=>{
   mock.calls.push({cmd,args});
   if(cmd==='get_settings')return {settings:{...mock.settings},revision:mock.revision};
   if(cmd==='detect_node')return {version:'24.22.1'};
   if(cmd==='server_status'){if(mock.unknown)throw Error('Could not read service status');return {...mock.status};}
   if(cmd==='save_settings'){if(args.expectedRevision!==mock.revision)throw Error('Settings changed in another entry point. Reload before saving.');Object.assign(mock.settings,args.settings);mock.revision++;return {settings:{...mock.settings},revision:mock.revision};}
   if(cmd==='choose_path')return '/tmp/isolated-console/chosen';
   if(cmd==='start_server'){
    mock.releaseStart=null;
    mock.status={running:false,state:'upgrading',phoneUrls:[]};await new Promise(resolve=>{mock.releaseStart=resolve;});
    if(mock.mode==='fail'){mock.status={running:false,state:'failed',phoneUrls:[],error:'Upgrade failed; backup: /tmp/isolated-console/verified-backup'};throw Error(mock.status.error);}
    mock.status={running:true,state:'running',url:'http://127.0.0.1:43123',phoneUrls:['http://192.0.2.8:43123'],backup:'/tmp/isolated-console/verified-backup',provider:{provider:'gemini',configured:true,models:{text:'runtime-text',image:'runtime-image'}},restartRequired:true,generating:true};return {...mock.status};
   }
   if(cmd==='stop_server'){mock.status={running:false,state:'stopped',phoneUrls:[]};return {...mock.status};}
   if(cmd==='open_reader'&&mock.mode==='opener-fail')throw Error('Could not open browser');
  }};
 },{settings});
 console.log('ET: native preview');await page.goto(consoleUrl);await page.getByRole('button',{name:'Start service',exact:true}).waitFor({state:'visible'});
 await page.waitForFunction(()=>document.querySelector('.service-label')?.textContent.includes('Stopped'));
 assert.equal(await page.getByRole('tablist').count(),0);assert.equal(await page.locator('input[type=password]').count(),0);assert.ok(await page.getByText('Saved configuration · Generation is not configured').isVisible());
 await page.getByRole('button',{name:'Start service',exact:true}).click();console.log('ET: waiting upgrade');await page.getByText('Upgrading library',{exact:true}).waitFor();console.log('ET: upgrade observed');await page.evaluate(()=>window.consoleFixture.releaseStart());await page.waitForFunction(()=>!document.querySelector('button.browser-link')?.disabled);
 assert.ok(await page.getByText('runtime-text',{exact:false}).isVisible());assert.ok(await page.getByText('Verified upgrade backup: /tmp/isolated-console/verified-backup').isVisible());
 assert.equal(await page.getByLabel('Story data directory',{exact:false}).isEnabled(),false);
 await page.getByRole('button',{name:'Generation service and models ↗',exact:true}).click();assert.ok((await page.evaluate(()=>window.consoleFixture.calls)).some(c=>c.cmd==='open_reader'&&c.args?.generationSettings===true));
 console.log('ET: restart confirmation');const before=(await page.evaluate(()=>window.consoleFixture.calls)).filter(c=>c.cmd==='stop_server').length;
 page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Restart service',exact:true}).click();assert.equal((await page.evaluate(()=>window.consoleFixture.calls)).filter(c=>c.cmd==='stop_server').length,before);
 page.once('dialog',async dialog=>{assert.match(dialog.message(),/stop the current work.*continue it in the browser/);await dialog.accept();});await page.getByRole('button',{name:'Restart service',exact:true}).click();await page.waitForFunction(()=>!!window.consoleFixture.releaseStart);await page.evaluate(()=>window.consoleFixture.releaseStart());await page.waitForFunction(()=>!document.querySelector('button.browser-link')?.disabled);
 for(const width of [1040,390]){await page.setViewportSize({width,height:820});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,`console-running-${width}.png`),fullPage:true});}
 console.log('ET: native edits and failures');await page.getByRole('button',{name:'Stop',exact:true}).click();await page.getByLabel('Service port',{exact:true}).fill('43124');
 await page.evaluate(()=>window.consoleFixture.revision++);await page.getByRole('button',{name:'Save local settings',exact:true}).click();await page.getByText('Settings changed in another entry point. Reload before saving.',{exact:false}).waitFor();
 await page.getByRole('button',{name:'Reload settings',exact:true}).click();await page.getByLabel('Service port',{exact:true}).fill('43125');await page.getByRole('button',{name:'Save local settings',exact:true}).click();await page.getByText('Local settings saved.').waitFor();
 const saved=(await page.evaluate(()=>window.consoleFixture.calls)).filter(c=>c.cmd==='save_settings').at(-1);assert.deepEqual(Object.keys(saved.args.settings).sort(),['cloudflaredPath','codexHome','codexPath','dataDirectory','internetEnabled','port']);
 await page.evaluate(()=>{window.consoleFixture.unknown=true;});await page.getByText('Could not read service status. Retrying.').waitFor();assert.equal(await page.getByRole('button',{name:'Start service',exact:true}).isEnabled(),false);
 await page.evaluate(()=>{window.consoleFixture.unknown=false;window.consoleFixture.mode='fail';});await page.waitForFunction(()=>document.querySelector('.service-label')?.textContent.includes('Stopped'));
 await page.getByRole('button',{name:'Start service',exact:true}).click();await page.waitForFunction(()=>!!window.consoleFixture.releaseStart);await page.evaluate(()=>window.consoleFixture.releaseStart());await page.getByText('Upgrade failed; backup: /tmp/isolated-console/verified-backup',{exact:false}).first().waitFor();

 // Build only the reader frontend into a temporary directory; the production desktop launcher serves HTTP without native resources or installer preparation.
 console.log('ET: actual desktop HTTP browser');const f=await startupFixture(t),file=path.join(f.root,'native-config/desktop.sqlite'),store=new SystemSettingsStore(file,path.join(f.root,'library')),native=store.save({port:await freeStartupPort(),codexPath:'/native/codex',codexHome:'/native/login'});store.close();
 await build({configFile:path.resolve('vite.config.ts'),build:{outDir:path.join(f.root,'dist/client'),emptyOutDir:true},logLevel:'silent'});
 let runtime=await startDesktop(native,'',f.root,{settingsFile:file,transport:async()=>Response.json({})});f.defer(()=>runtime.stop());
 const reader=await browser.newPage({viewport:{width:1040,height:820}});reader.setDefaultTimeout(10000);reader.on('pageerror',error=>errors.push(error.message));await reader.goto(runtime.status.url+'/#provider-settings');
 await reader.getByRole('dialog',{name:'Generation service and models'}).waitFor();assert.equal(await reader.locator('input[type=password]').count(),0);assert.equal(await reader.getByLabel('Codex executable').count(),0);
 await reader.getByRole('radiogroup',{name:'Text service',exact:true}).getByText('OpenAI',{exact:true}).click();
 await reader.getByRole('radiogroup',{name:'API key action',exact:true}).getByText('Enter key',{exact:true}).click();await reader.getByLabel('New API key',{exact:true}).fill('synthetic-browser-key');await reader.getByRole('button',{name:'Save settings',exact:true}).click();
 await reader.getByText('Restart required',{exact:true}).waitFor();assert.equal(await reader.locator('input[type=password]').count(),0);assert.equal((await reader.content()).includes('synthetic-browser-key'),false);assert.equal(runtime.status.restartRequired,true);assert.equal(runtime.status.provider.provider,'gemini');
 await reader.getByRole('button',{name:'Check saved connection',exact:true}).click();await reader.getByText('Connection check passed. Only model metadata or sign-in status was checked; no content was generated.').waitFor();
 reader.once('dialog',dialog=>dialog.accept());await reader.getByRole('button',{name:'Reset all generation settings',exact:true}).click();await reader.getByText('Generation settings reset. Restart the service to apply them.').waitFor();
 const after=new SystemSettingsStore(file,native.dataDirectory,{existingOnly:true});assert.equal(after.settings().codexPath,native.codexPath);assert.equal(after.settings().codexHome,native.codexHome);assert.equal(after.key('openai'),'');after.close();
 await reader.screenshot({path:path.join(output,'browser-provider-settings.png'),fullPage:true});
 await reader.getByRole('button',{name:'Close',exact:true}).click();await reader.getByRole('link',{name:'Open generation service and models',exact:true}).click();await reader.getByRole('dialog',{name:'Generation service and models'}).waitFor();
 await rename(file,file+'.held');await reader.reload();await reader.getByRole('dialog',{name:'Generation service and models'}).waitFor();await reader.getByText('Shared provider settings could not be read or saved. Check the local configuration and reload.').waitFor();
 assert.equal(existsSync(file),false);assert.equal(await reader.locator('input[type=password]').count(),0);
 await rename(file+'.held',file);await reader.getByRole('button',{name:'Reload settings',exact:true}).click();await reader.getByRole('radiogroup',{name:'Text service',exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 }catch(error){await page.screenshot({path:path.join(output,'failed-console.png'),fullPage:true}).catch(()=>{});console.log(await page.locator('body').innerText().catch(()=>''));throw error;}
});
