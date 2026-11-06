// 适配器与配置契约使用受控输入；真实启动和制作流程由独立文件覆盖。
import test from 'node:test';

import assert from 'node:assert/strict';

import {mkdtemp,rm} from 'node:fs/promises';

import path from 'node:path';

import os from 'node:os';

import {createReaderProvider,withImageProvider} from '../server/generation.ts';

import {withLocalBooks} from '../server/local-generation.ts';

import {LocalBooks} from '../server/local-books.ts';

import {SystemSettingsStore} from '../server/system-settings.ts';

import {configureProvider,effectiveProviderVariables,providerReady} from '../server/cli-setup.ts';

import {testDesktopProvider,desktopVariables} from '../server/desktop.ts';

import {defaultSystemSettings,settingsVariables,resetProviderSettings,effectiveImageProvider} from '../lib/system-settings.ts';

import {geminiGenerationTimeoutMs} from '../lib/reader-limits.ts';

import {codexGenerationTimeoutMs} from '../lib/codex-settings.ts';

import {png} from './fixtures/images.mjs';

import {makePlan} from './fixtures/production.mjs';

function memoryMedia(){const stored=new Map();return {stored,async get(key){const value=stored.get(key);return value?{arrayBuffer:async()=>value.bytes.slice().buffer}:null;},async put(key,bytes,options){stored.set(key,{bytes:new Uint8Array(bytes),...options});}};}

function controlled({geminiStatus=200}={}){
 const calls={gemini:[],codex:[]};
 const transport=async(url,options)=>{
  assert.match(String(url),/^https:\/\/generativelanguage\.googleapis\.com\//);calls.gemini.push(JSON.parse(options.body));
  if(geminiStatus!==200)return new Response('{}',{status:geminiStatus});
  return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{inlineData:{mimeType:'image/png',data:Buffer.from(png).toString('base64')}}]}}]});
 };
 const runner={async status(){return {configured:true};},async run(job){calls.codex.push(job);if(job.generateImage)return {image:Buffer.from(png).toString('base64'),text:'',model:'controlled',requestId:'controlled',usage:null};throw Object.assign(new Error('INVALID_OUTPUT'),{name:'CodexError'});}};
 return {calls,transport,runner};
}

async function temporary(t){const root=await mkdtemp(path.join(os.tmpdir(),'shiqu separate providers '));t.after(()=>rm(root,{recursive:true,force:true}));return {root,file:path.join(root,'config','desktop.sqlite'),library:path.join(root,'library')};}

function prompts(answers,keys=[]){return {text:async()=>{assert.ok(answers.length,'unexpected text prompt');return answers.shift();},secret:async()=>{assert.ok(keys.length,'unexpected secret prompt');return keys.shift();}};}

test('Codex text with Gemini images: drawing, timeouts and status come from the image provider only',async()=>{
 const c=controlled(),media=memoryMedia();
 const provider=createReaderProvider({SHIQU_AI_PROVIDER:'codex',SHIQU_IMAGE_PROVIDER:'gemini',GEMINI_API_KEY:'controlled',GEMINI_IMAGE_MODEL:'test-image-model',CODEX_MODEL:'test-text-model'},media,c.transport,c.runner);
 const status=await provider.status();
 assert.equal(status.provider,'codex');assert.equal(status.imageProvider,'gemini');assert.equal(status.configured,true);
 assert.deepEqual(status.models,{text:'test-text-model',image:'test-image-model'});
 assert.equal(provider.generationTimeoutMs('image'),geminiGenerationTimeoutMs);assert.equal(provider.generationTimeoutMs('plan'),codexGenerationTimeoutMs);
 const stub=ms=>({generationTimeoutMs:()=>ms,status:async()=>({}),generator:()=>({}),safeError:()=>''});
 const composed=withImageProvider(stub(1),stub(2));assert.equal(composed.generationTimeoutMs('image'),2);assert.equal(composed.generationTimeoutMs('review'),1);
 const result=await provider.generator().image(makePlan(8),0,'story','');
 assert.equal(c.calls.gemini.length,1);assert.equal(c.calls.codex.length,0);assert.equal(result.model,'test-image-model');
 assert.ok(media.stored.has('reader/story/0.png'));assert.match(result.promptRecord.prompt||JSON.stringify(result.promptRecord),/Scene 1/);
});

test('image failures keep image-provider safe messages through the local-book wrapper; text failures keep text messages',async t=>{
 const f=await temporary(t),c=controlled({geminiStatus:403}),media=memoryMedia();
 const base=createReaderProvider({SHIQU_AI_PROVIDER:'codex',SHIQU_IMAGE_PROVIDER:'gemini',GEMINI_API_KEY:'controlled'},media,c.transport,c.runner);
 const wrapped=withLocalBooks(base,new LocalBooks(f.root),media),generator=wrapped.generator();
 const failure=await generator.image(makePlan(8),0,'story','').then(()=>assert.fail('expected failure'),error=>error);
 assert.match(generator.safeError(failure),/密钥或模型权限/);assert.match(wrapped.safeError(failure),/密钥或模型权限/);assert.doesNotMatch(generator.safeError(failure),/Codex/);
 assert.match(generator.safeError(new Error('text failure')),/Codex/);
});

test('status requires both sides and names the unready image service; read-only ignores the image setting',async()=>{
 const c=controlled();
 const missing=await createReaderProvider({SHIQU_AI_PROVIDER:'codex',SHIQU_IMAGE_PROVIDER:'gemini'},memoryMedia(),c.transport,c.runner).status();
 assert.equal(missing.configured,false);assert.match(missing.message,/^图片服务：/);
 const signedOut={async status(){return {configured:false,reason:'CHATGPT_LOGIN_REQUIRED'};},async run(){assert.fail('No inference while signed out');}};
 const codexImage=await createReaderProvider({SHIQU_AI_PROVIDER:'gemini',GEMINI_API_KEY:'controlled',SHIQU_IMAGE_PROVIDER:'codex'},memoryMedia(),c.transport,signedOut).status();
 assert.equal(codexImage.configured,false);assert.equal(codexImage.reason,'CHATGPT_LOGIN_REQUIRED');assert.match(codexImage.message,/^图片服务：.*codex login/);
 const openai=await createReaderProvider({SHIQU_AI_PROVIDER:'openai',OPENAI_API_KEY:'controlled',SHIQU_IMAGE_PROVIDER:'codex'},memoryMedia(),c.transport,c.runner).status();
 assert.equal(openai.provider,'openai');assert.equal(openai.imageProvider,'codex');assert.equal(openai.models.image,'codex-image-generation');assert.equal(openai.configured,true);
 assert.equal((await createReaderProvider({SHIQU_AI_PROVIDER:'readonly',SHIQU_IMAGE_PROVIDER:'unknown'},memoryMedia(),c.transport).status()).provider,'readonly');
 assert.throws(()=>createReaderProvider({SHIQU_AI_PROVIDER:'codex',SHIQU_IMAGE_PROVIDER:'unknown'},memoryMedia(),c.transport,c.runner),/SHIQU_IMAGE_PROVIDER/);
 const same=await createReaderProvider({SHIQU_AI_PROVIDER:'codex',SHIQU_IMAGE_PROVIDER:'codex'},memoryMedia(),c.transport,c.runner).status();
 assert.equal(same.imageProvider,undefined);assert.equal(same.models.image,'codex-image-generation');
});

test('settings keep the image provider optional, scoped to active credentials and cleared by reset',async t=>{
 const f=await temporary(t),store=new SystemSettingsStore(f.file,f.library);t.after(()=>store.close());
 store.save({provider:'gemini',providerConfigured:true},{provider:'gemini',value:'test-only-gemini'});
 const before=JSON.stringify(store.settings());assert.ok(!before.includes('imageProvider'));
 assert.equal(effectiveImageProvider(store.settings()),'gemini');
 store.save({provider:'openai',imageProvider:'gemini'},[{provider:'openai',value:'test-only-openai'},{provider:'gemini',value:'test-only-image'}]);
 assert.equal(store.settings().imageProvider,'gemini');assert.equal(store.key('gemini'),'test-only-image');assert.equal(store.key('openai'),'test-only-openai');
 const variables=settingsVariables(store.settings(),store.key('openai'),store.key('gemini'));
 assert.equal(variables.SHIQU_IMAGE_PROVIDER,'gemini');assert.equal(variables.OPENAI_API_KEY,'test-only-openai');assert.equal(variables.GEMINI_API_KEY,'test-only-image');
 const codexText=settingsVariables({...store.settings(),provider:'codex',imageProvider:'openai'},'unused','image-key');
 assert.equal(codexText.OPENAI_API_KEY,'image-key');assert.equal(codexText.GEMINI_API_KEY,undefined);
 assert.equal(settingsVariables({...store.settings(),provider:'readonly'},'','').SHIQU_IMAGE_PROVIDER,undefined);
 // An unused provider's credential can never be changed through this save.
 const revision=store.revision();assert.throws(()=>store.save({imageProvider:null},{provider:'gemini',value:null}));assert.equal(store.revision(),revision);
 store.save({imageProvider:'openai'});assert.ok(!JSON.stringify(store.settings()).includes('imageProvider'));
 store.save({imageProvider:'codex'});store.save({imageProvider:null});assert.ok(!JSON.stringify(store.settings()).includes('imageProvider'));
 store.save({imageProvider:'gemini'});store.resetProviders();assert.equal(store.settings().imageProvider,undefined);
 assert.equal(resetProviderSettings({...defaultSystemSettings(f.library),imageProvider:'codex'}).imageProvider,undefined);
});

test('invocation overrides select the image provider and its key for one run without saving',async t=>{
 const f=await temporary(t),store=new SystemSettingsStore(f.file,f.library);t.after(()=>store.close());
 store.save({provider:'openai',imageProvider:'gemini',providerConfigured:true},[{provider:'openai',value:'saved-openai'},{provider:'gemini',value:'saved-gemini'}]);
 const revision=store.revision(),saved=effectiveProviderVariables(store,{});
 assert.equal(saved.SHIQU_IMAGE_PROVIDER,'gemini');assert.equal(saved.GEMINI_API_KEY,'saved-gemini');assert.ok(providerReady(saved));
 const override=effectiveProviderVariables(store,{SHIQU_IMAGE_PROVIDER:'openai'});
 assert.equal(override.SHIQU_IMAGE_PROVIDER,undefined);assert.equal(override.GEMINI_API_KEY,undefined);assert.ok(providerReady(override));
 const env=effectiveProviderVariables(store,{SHIQU_AI_PROVIDER:'codex',GEMINI_API_KEY:'env-only'});
 assert.equal(env.SHIQU_IMAGE_PROVIDER,'gemini');assert.equal(env.GEMINI_API_KEY,'env-only');assert.equal(env.OPENAI_API_KEY,undefined);
 assert.equal(providerReady({SHIQU_AI_PROVIDER:'codex',SHIQU_IMAGE_PROVIDER:'gemini'}),false);
 assert.equal(effectiveProviderVariables(store,{SHIQU_AI_PROVIDER:'readonly',SHIQU_IMAGE_PROVIDER:'invalid'}).SHIQU_AI_PROVIDER,'readonly');
 assert.throws(()=>effectiveProviderVariables(store,{SHIQU_IMAGE_PROVIDER:'invalid'}),/SHIQU_IMAGE_PROVIDER/);
 assert.equal(store.revision(),revision);assert.equal(store.key('gemini'),'saved-gemini');assert.equal(store.settings().imageProvider,'gemini');
});

test('configure asks the image provider, saves its own key/model and Enter keeps saved choices',async t=>{
 const f=await temporary(t),store=new SystemSettingsStore(f.file,f.library);t.after(()=>store.close());
 // Codex text, Gemini image: Codex model, then the image key and image model.
 await configureProvider(store,prompts(['codex','gemini','','test-image-model'],['test-only-image']),'linux');
 assert.equal(store.settings().provider,'codex');assert.equal(store.settings().imageProvider,'gemini');assert.equal(store.settings().imageModel,'test-image-model');assert.equal(store.key('gemini'),'test-only-image');
 await configureProvider(store,prompts(['','','',''],['']),'linux');
 assert.equal(store.settings().imageProvider,'gemini');assert.equal(store.key('gemini'),'test-only-image');assert.equal(store.settings().imageModel,'test-image-model');
 // Separate image side: the text API provider is asked for its key and text model only.
 await configureProvider(store,prompts(['openai','','test-text-model',''],['test-only-text','']),'linux');
 assert.equal(store.settings().openaiTextModel,'test-text-model');assert.equal(store.key('openai'),'test-only-text');assert.equal(store.settings().imageProvider,'gemini');
 await configureProvider(store,prompts(['openai','0','',''],['']),'linux');assert.equal(store.settings().imageProvider,undefined);
 // Choosing the text provider itself as image provider is stored as "same".
 await configureProvider(store,prompts(['gemini','gemini','',''],['']),'linux');assert.equal(store.settings().imageProvider,undefined);
 await configureProvider(store,prompts(['readonly']),'linux');assert.equal(store.settings().provider,'readonly');
});

test('desktop checks each side with its own key and model, without generating content',async()=>{
 const settings={...defaultSystemSettings('/tmp/shiqu-test-library'),provider:'openai',imageProvider:'gemini',openaiTextModel:'text-model',imageModel:'image-model'},requests=[];
 const transport=async(url,options)=>{requests.push({url:String(url),headers:options.headers});return new Response('{}',{status:200});};
 const ok=await testDesktopProvider(settings,'text-key','/tmp',transport,'image-key');
 assert.equal(ok.ok,true);assert.match(ok.message,/文本服务.*图片服务/);
 assert.deepEqual(requests.map(r=>r.url),['https://api.openai.com/v1/models/text-model','https://generativelanguage.googleapis.com/v1beta/models/image-model']);
 assert.equal(requests[0].headers.Authorization,'Bearer text-key');assert.equal(requests[1].headers['x-goog-api-key'],'image-key');
 const missing=await testDesktopProvider(settings,'text-key','/tmp',transport,'');assert.equal(missing.ok,false);assert.match(missing.message,/^图片服务：/);
 const variables=desktopVariables(settings,'text-key','image-key');assert.equal(variables.GEMINI_API_KEY,'image-key');assert.equal(variables.OPENAI_API_KEY,'text-key');
 requests.length=0;const same=await testDesktopProvider({...settings,imageProvider:undefined},'text-key','/tmp',transport);
 assert.equal(same.ok,true);assert.deepEqual(requests.map(r=>r.url),['https://api.openai.com/v1/models/text-model','https://api.openai.com/v1/models/gpt-image-2.5-sunburst']);
});

test('invocation-only Claude text draws only through an explicit image provider with that provider key',async t=>{
 const f=await temporary(t),store=new SystemSettingsStore(f.file,f.library);t.after(()=>store.close());
 store.save({provider:'openai',providerConfigured:true},{provider:'openai',value:'saved-openai'});
 const plain=effectiveProviderVariables(store,{SHIQU_AI_PROVIDER:'claude'});
 assert.equal(plain.SHIQU_IMAGE_PROVIDER,undefined);assert.equal(plain.OPENAI_API_KEY,'');assert.ok(providerReady(plain));
 const drawing=effectiveProviderVariables(store,{SHIQU_AI_PROVIDER:'claude',SHIQU_IMAGE_PROVIDER:'openai'});
 assert.equal(drawing.SHIQU_IMAGE_PROVIDER,'openai');assert.equal(drawing.OPENAI_API_KEY,'saved-openai');assert.equal(drawing.GEMINI_API_KEY,undefined);assert.ok(providerReady(drawing));
 assert.equal(providerReady({SHIQU_AI_PROVIDER:'deepseek',DEEPSEEK_API_KEY:'k',SHIQU_IMAGE_PROVIDER:'gemini'}),false);
 const c=controlled(),media=memoryMedia();
 const provider=createReaderProvider({SHIQU_AI_PROVIDER:'claude',SHIQU_IMAGE_PROVIDER:'gemini',GEMINI_API_KEY:'controlled'},media,c.transport,{async status(){return {configured:true};},async run(){assert.fail('Claude must not draw');}});
 assert.equal((await provider.status()).imageProvider,'gemini');await provider.generator().image(makePlan(8),0,'story','');assert.equal(c.calls.gemini.length,1);
});
