// Exercise the production local-settings handler/store and original-peer guard without inference.
import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {once} from 'node:events';
import {get} from 'node:http';
import {browserProviderSettings} from '../server/browser-provider-settings.ts';
import {createHttpServer} from '../server/http.ts';
import {effectiveProviderVariables} from '../server/cli-setup.ts';
import {createReaderProvider} from '../server/generation.ts';
import {createApplication} from '../server/app.ts';
import {startDesktop} from '../server/desktop.ts';
import {defaultSystemSettings} from '../lib/system-settings.ts';
import {protectLocalProviderSettings} from '../scripts/development-server.mjs';
import {providerSettingsPath,providerSettingsSchema,loopbackAddress} from '../lib/provider-settings.ts';
import {startupFixture,startFixtureCli,freeStartupPort,savedStartupState} from './fixtures/startup.mjs';

const origin='http://127.0.0.1:3456',peer={remoteAddress:'127.0.0.1'};
const googleKey='test-only-google-private-key',openaiKey='test-only-openai-private-key';
async function fixture(t,overrides={}){
 const f=await startupFixture(t),store=f.store();
 store.save({provider:'gemini',providerConfigured:true,libraryConfigured:true,textModel:'saved-google-text',imageModel:'saved-google-image'},{provider:'gemini',value:googleKey});
 store.save({provider:'openai',openaiTextModel:'saved-openai-text',openaiImageModel:'saved-openai-image'},{provider:'openai',value:openaiKey});store.save({provider:'gemini'});
 const variables=effectiveProviderVariables(store,overrides),generation=createReaderProvider(variables,{},()=>assert.fail('No inference'));
 const handler=browserProviderSettings({variables,overrides,ports:[3456,3457],locations:f.locations,status:()=>generation.status()});
 const read=(headers={},remote=peer,url=origin+providerSettingsPath)=>handler(new Request(url,{headers}),remote);
 const save=(body,headers={},remote=peer)=>handler(new Request(origin+providerSettingsPath,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)}),remote);
 const view=async()=>{const response=await read();assert.equal(response.status,200);return response.json();};
 return {...f,settingsStore:store,variables,handler,read,save,view};
}
const body=(view,settings=view.settings,extra={})=>({settings,expectedRevision:view.revision,keyAction:'keep',...extra});
async function safeJson(response){const result=await response.json(),serialized=JSON.stringify(result);assert.ok(!serialized.includes(googleKey));assert.ok(!serialized.includes(openaiKey));assert.ok(!serialized.includes('replacement-secret'));return result;}

test('local view and revision-checked save preserve unrelated shared settings and immutable running models',async t=>{
 const f=await fixture(t),before=f.settingsStore.settings(),current=await f.view();
 assert.equal(current.settings.provider,'gemini');assert.equal(current.runtime.provider,'gemini');assert.equal(current.runtime.models.text,'saved-google-text');assert.equal(current.restartRequired,false);assert.equal(current.keyPresent.openai,true);assert.equal(current.settings.dataDirectory,undefined);await safeJson(await f.read());
 const settings={...current.settings,textModel:'updated-google-text',taskReasoningEfforts:{...current.settings.taskReasoningEfforts,plan:'medium'}};
 const response=await f.save(body(current,settings));assert.equal(response.status,200);const saved=await safeJson(response);
 assert.equal(saved.settings.textModel,'updated-google-text');assert.equal(saved.runtime.models.text,'saved-google-text');assert.equal(saved.restartRequired,true);assert.equal(saved.revision,current.revision+1);
 assert.equal(f.settingsStore.settings().dataDirectory,before.dataDirectory);assert.equal(f.settingsStore.settings().port,before.port);assert.equal(f.settingsStore.settings().internetEnabled,before.internetEnabled);assert.equal(f.settingsStore.key('gemini'),googleKey);
 const snapshot=f.settingsStore.snapshot();assert.equal(snapshot.revision,saved.revision);assert.equal(snapshot.settings.textModel,saved.settings.textModel);assert.ok(!JSON.stringify(snapshot).includes(googleKey));
});

test('provider profiles and explicit key keep/replace/remove never return credentials',async t=>{
 const f=await fixture(t);let current=await f.view();
 let response=await f.save(body(current,{...current.settings,provider:'openai'}));assert.equal(response.status,200);current=await safeJson(response);assert.equal(f.settingsStore.key('openai'),openaiKey);assert.equal(current.settings.textModel,'saved-google-text');
 response=await f.save(body(current,current.settings,{keyAction:'replace',key:'replacement-secret'}));assert.equal(response.status,200);current=await safeJson(response);assert.equal(f.settingsStore.key('openai'),'replacement-secret');assert.equal(f.settingsStore.key('gemini'),googleKey);
 response=await f.save(body(current,current.settings,{keyAction:'remove'}));assert.equal(response.status,200);current=await safeJson(response);assert.equal(current.keyPresent.openai,false);assert.equal(f.settingsStore.key('openai'),'');
 response=await f.save(body(current));assert.equal(response.status,400);await safeJson(response);
 response=await f.save(body(current,{...current.settings,provider:'codex'}));assert.equal(response.status,200);current=await safeJson(response);assert.equal(current.settings.openaiTextModel,'saved-openai-text');
 response=await f.save(body(current,{...current.settings,provider:'readonly'}));assert.equal(response.status,200);current=await safeJson(response);
 response=await f.save(body(current,{...current.settings,provider:'gemini'}));assert.equal(response.status,200);assert.equal(f.settingsStore.key('gemini'),googleKey);await safeJson(response);
});

test('invocation overrides report names only and drift follows the effective active provider',async t=>{
 const f=await fixture(t,{GEMINI_API_KEY:'override-private-key',GEMINI_TEXT_MODEL:'override-text'}),current=await f.view();
 assert.equal(current.runtime.models.text,'override-text');assert.equal(current.restartRequired,false);assert.deepEqual(current.overrides,['GEMINI_API_KEY','GEMINI_TEXT_MODEL']);assert.ok(!JSON.stringify(current).includes('override-private-key'));
 let response=await f.save(body(current,{...current.settings,textModel:'saved-under-override'},{keyAction:'replace',key:'replacement-secret'}));assert.equal(response.status,200);let next=await safeJson(response);assert.equal(next.restartRequired,false);assert.equal(next.runtime.models.text,'override-text');
 response=await f.save(body(next,{...next.settings,openaiTextModel:'inactive-change'}));assert.equal(response.status,200);next=await safeJson(response);assert.equal(next.restartRequired,false);
 response=await f.save(body(next,{...next.settings,imageModel:'effective-image-change'}));assert.equal(response.status,200);next=await safeJson(response);assert.equal(next.restartRequired,true);
});

test('stale, malformed, invalid effort and unrelated-field writes fail without partial settings or key updates',async t=>{
 const f=await fixture(t),current=await f.view();f.settingsStore.save({port:4567});const before=await savedStartupState(f);
 let response=await f.save(body(current,{...current.settings,textModel:'stale'},{keyAction:'replace',key:'replacement-secret'}));assert.equal(response.status,409);await safeJson(response);assert.deepEqual(await savedStartupState(f),before);
 const fresh=await f.view();
 for(const input of [
  {...body(fresh),expectedRevision:undefined}, {...body(fresh),unexpected:true},body(fresh,{...fresh.settings,dataDirectory:'/forbidden'}),
  body(fresh,{...fresh.settings,textModel:'invalid/model'}),body(fresh,{...fresh.settings,taskReasoningEfforts:{...fresh.settings.taskReasoningEfforts,plan:'xhigh'}}),
  body(fresh,fresh.settings,{keyAction:'replace',key:'replacement-secret\ninvalid'}),body(fresh,fresh.settings,{keyAction:'keep',key:'replacement-secret'}),
  body(fresh,{...fresh.settings,provider:'codex'},{keyAction:'replace',key:'replacement-secret'}),
 ]){response=await f.save(input);assert.equal(response.status,400);await safeJson(response);assert.deepEqual(await savedStartupState(f),before);}
 response=await f.save(body(fresh),{'Content-Type':'text/plain'});assert.equal(response.status,415);
 response=await f.handler(new Request(origin+providerSettingsPath,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{replacement-secret'}),peer);assert.equal(response.status,400);await safeJson(response);
});

test('real peer, exact loopback hosts, origins and fetch-site guard settings without trusting forwarded headers',async t=>{
 const f=await fixture(t),current=await f.view(),before=await savedStartupState(f);
 for(const remoteAddress of ['192.0.2.3','::ffff:192.0.2.3',undefined]){
  assert.equal((await f.read({'X-Forwarded-For':'127.0.0.1'}, {remoteAddress})).status,403);
  assert.equal((await f.save(body(current),{'X-Forwarded-For':'127.0.0.1'}, {remoteAddress})).status,403);
 }
 for(const hostname of ['192.0.2.3:3456','evil.local:3456','localhost.evil:3456','127.0.0.1:9999'])assert.equal((await f.read({},peer,'http://'+hostname+providerSettingsPath)).status,403);
 assert.equal((await f.read({Origin:'https://evil.example'})).status,403);assert.equal((await f.read({'Sec-Fetch-Site':'cross-site'})).status,403);
 assert.equal((await f.save(body(current),{Origin:'https://evil.example'})).status,403);
 const noOrigin=new Request(origin+providerSettingsPath,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body(current))});assert.equal((await f.handler(noOrigin,peer)).status,403);
 for(const remoteAddress of ['127.0.0.1','::1','::ffff:127.0.0.1'])assert.equal((await f.read({}, {remoteAddress})).status,200);
 assert.equal((await f.read({},peer,'http://localhost:3457'+providerSettingsPath)).status,200);assert.equal((await f.read({},peer,'http://[::1]:3456'+providerSettingsPath)).status,200);
 assert.equal(loopbackAddress('::ffff:127.0.0.1'),true);assert.deepEqual(await savedStartupState(f),before);
});

test('Vite guard rejects original LAN peers even through normalized proxy path variants',()=>{
 let middleware;protectLocalProviderSettings().configureServer({middlewares:{use(fn){middleware=fn;}}});
 for(const url of [providerSettingsPath,providerSettingsPath+'?x=1','/art/../api/local/provider-settings','/api/x/%2e%2e/local/provider-settings','/api/x/../../api/local/provider-settings']){
  let next=false,ended=false;const response={statusCode:200,setHeader(){},end(){ended=true;}};
  middleware({url,socket:{remoteAddress:'192.0.2.3'},headers:{'x-forwarded-for':'127.0.0.1'}},response,()=>{next=true;});assert.equal(response.statusCode,403,url);assert.equal(ended,true);assert.equal(next,false);
 }
 for(const [url,remoteAddress] of [[providerSettingsPath,'127.0.0.1'],['/api/reader/sessions','192.0.2.3']]){
  let next=false;middleware({url,socket:{remoteAddress}}, {setHeader(){},end(){assert.fail('Reader or actual local request must pass');}},()=>{next=true;});assert.equal(next,true);
 }
});

test('HTTP adapter supplies socket metadata; forwarded headers cannot change the actual peer',async t=>{
 const f=await fixture(t),observed=[];const server=createHttpServer(async(request,remote)=>{observed.push(remote.remoteAddress);return f.handler(request,remote);});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const port=server.address().port;
 const result=await new Promise((resolve,reject)=>get({host:'127.0.0.1',port,path:providerSettingsPath,headers:{Host:'127.0.0.1:3456','X-Forwarded-For':'192.0.2.3'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));}).on('error',reject));
 assert.equal(result,200);assert.deepEqual(observed,['127.0.0.1']);
});

test('browser CLI edits share the production store and leave runtime unchanged until restart',async t=>{
 const f=await startupFixture(t),store=f.store(),port=await freeStartupPort();store.save({provider:'gemini',providerConfigured:true,libraryConfigured:true,textModel:'cli-saved-text',imageModel:'cli-saved-image',port},{provider:'gemini',value:googleKey});store.close();
 const process=startFixtureCli(f);await process.ready();const base=`http://127.0.0.1:${port}`;
 let response=await fetch(base+providerSettingsPath);assert.equal(response.status,200);let current=await safeJson(response);assert.equal(current.restartRequired,false);
 response=await fetch(base+providerSettingsPath,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(body(current,{...current.settings,textModel:'cli-new-text'}))});assert.equal(response.status,200);current=await safeJson(response);assert.equal(current.restartRequired,true);assert.equal(current.runtime.models.text,'cli-saved-text');
 await process.stop();const state=await savedStartupState(f);assert.equal(state.settings.textModel,'cli-new-text');assert.equal(state.gemini,googleKey);
 const restarted=startFixtureCli(f);await restarted.ready();current=await (await fetch(base+providerSettingsPath)).json();assert.equal(current.runtime.models.text,'cli-new-text');assert.equal(current.restartRequired,false);await restarted.stop();
});

test('fully explicit CLI startup survives a corrupt saved store; settings failures stay safe',async t=>{
 const f=await startupFixture(t);await mkdir(path.dirname(f.locations.settings),{recursive:true});await writeFile(f.locations.settings,'corrupt-private-store');
 const port=await freeStartupPort(),process=startFixtureCli(f,['--data-dir',path.join(f.root,'explicit-library'),'--port',String(port)],{SHIQU_AI_PROVIDER:'readonly'});await process.ready();
 const base=`http://127.0.0.1:${port}`,response=await fetch(base+providerSettingsPath);assert.equal(response.status,503);assert.ok(!(await response.text()).includes('corrupt-private-store'));assert.equal((await fetch(base+'/api/reader/status')).status,200);await process.stop();
});

test('generic reader and native desktop listeners do not expose browser credential settings',async t=>{
 const f=await startupFixture(t),app=createApplication({root:f.root,dataDirectory:path.join(f.root,'generic-library'),variables:{SHIQU_AI_PROVIDER:'readonly'}});f.defer(()=>app.close());
 assert.equal((await app.handle(new Request(origin+providerSettingsPath))).status,404);
 const port=await freeStartupPort(),desktop=await startDesktop({...defaultSystemSettings(path.join(f.root,'native-library')),provider:'readonly',port},'',f.root);f.defer(()=>desktop.stop());
 const base=`http://127.0.0.1:${port}`;assert.equal((await fetch(base+providerSettingsPath)).status,404);
 assert.equal((await fetch(base+providerSettingsPath,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{}'})).status,404);
});
