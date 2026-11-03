// Verify all optional-condition combinations with title editing in the shared extraction window.
// Browser/data are disposable; inference is controlled and no production shelf or credentials are loaded.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {createHttpServer} from '../server/http.ts';
import {withLocalBooks} from '../server/local-generation.ts';
import {LocalBooks} from '../server/local-books.ts';
import {libraryFixture} from './fixtures/story-library.mjs';
import {productionFixture,until} from './fixtures/production.mjs';

test('title, theme and original scope are independently optional in the creation UI', {timeout:120000},async t=>{
 const f=await productionFixture(t),library=libraryFixture();
 f.generation.suggestions=async(selection,excluded,input)=>{
  const result=await library.provider.suggestions(selection,excluded,input);
  if(input.scan?.targetStoryTitle)return {...result,stories:library.stories.filter(story=>story.title===input.scan.targetStoryTitle&&input.text.includes('['+story.source.firstUnit+']')),scan:{blockComplete:true,pendingEvents:[],resolvedEventIds:[]}};
  return result;
 };
 f.generation.matchStories=library.provider.matchStories;
 f.options.generation=withLocalBooks(f.generation,library.books,f.media);await f.restart();f.app.services.localBooks=library.books;
 const api=createHttpServer(request=>f.app.handle(request));await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{api.closeAllConnections();api.close(resolve);}));
 const target=`http://127.0.0.1:${api.address().port}`;
 // Vite treats port 0 as its default port; reserve an ephemeral port to coexist with other suites.
 const reservation=createHttpServer(async()=>new Response('reserved'));
 await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));const uiPort=reservation.address().port;
 await new Promise(resolve=>reservation.close(resolve));
 const vite=await createServer({envFile:false,logLevel:'error',server:{host:'127.0.0.1',port:uiPort,strictPort:true,proxy:{'/api':{target},'/art':{target}}}});
 await vite.listen();t.after(()=>vite.close());
 const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();
 await context.addInitScript(()=>localStorage.setItem('shiqu-last-tab','shelf'));
 const url=`http://127.0.0.1:${vite.httpServer.address().port}`;
 async function open(){
  await page.goto(url);
  await page.getByRole('button',{name:'新建故事',exact:true}).click();
  const sheet=page.getByRole('dialog',{name:'这一篇，想怎样读？'});
  await sheet.getByRole('group',{name:'选择书籍'}).getByRole('button',{name:'庄子',exact:true}).click();
  return sheet;
 }
 for(let flags=0;flags<8;flags++){
  const title=!!(flags&1),theme=!!(flags&2),scope=!!(flags&4),sheet=await open();
  assert.equal(await sheet.getByLabel(/故事标题（可选）/).count(),0);
  assert.equal(await sheet.getByRole('group',{name:'原文范围'}).getByRole('button',{name:'自动',exact:true}).count(),1);
  if(theme){await sheet.getByRole('group',{name:'故事主题'}).getByRole('button',{name:'其他',exact:true}).click();await sheet.getByLabel('写下想看的主题').fill('知恩图报');}
  if(scope){await sheet.getByRole('group',{name:'原文范围'}).getByRole('button',{name:'选择章节或已有故事段落'}).click();await sheet.getByRole('checkbox',{name:'第一章',exact:true}).check();}
  const gap=await sheet.getByRole('button',{name:'开始发现故事',exact:true}).evaluate(button=>button.getBoundingClientRect().top-button.previousElementSibling.getBoundingClientRect().bottom);
  assert.ok(gap>=23.5,`discovery button gap: ${gap}`);
  if(flags===0){
   await mkdir('/tmp/shiqu-editable-title',{recursive:true});
   await sheet.getByRole('button',{name:'开始发现故事',exact:true}).scrollIntoViewIfNeeded();
   await page.screenshot({path:'/tmp/shiqu-editable-title/source-button-gap.png'});
  }
  const response=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/reader/sessions'&&response.request().method()==='POST');
  await sheet.getByRole('button',{name:'开始发现故事',exact:true}).click();
  const created=await response;assert.equal(created.status(),201);
  const payload=created.request().postDataJSON().selection,saved=await created.json();
  assert.deepEqual(payload.discovery,{mode:'auto'});
  assert.equal(payload.theme,theme?'知恩图报':'原典故事');
  assert.equal(payload.discoverySources?.length,scope?1:undefined);
  assert.deepEqual(saved.selection.discovery,payload.discovery);assert.equal(saved.selection.theme,payload.theme);
  assert.equal(saved.selection.source,undefined);
  const extraction=page.getByRole('dialog',{name:'选择故事',exact:true});
  await extraction.getByLabel(/故事标题（可选）/).waitFor();
  if(title){
   await extraction.getByLabel(/故事标题（可选）/).fill('乌龟报恩');
   const search=page.waitForResponse(response=>response.url().endsWith(`/api/reader/sessions/${saved.id}/setup`)&&response.request().method()==='POST'&&response.request().postDataJSON().action==='search');
   await extraction.getByRole('button',{name:'按标题提取',exact:true}).click();
   const searched=await search;assert.equal(searched.status(),200);const changed=await searched.json();
   assert.deepEqual(changed.selection.discovery,{mode:'title',title:'乌龟报恩'});
   assert.equal(changed.selection.theme,payload.theme);assert.deepEqual(changed.selection.discoverySources,payload.discoverySources);
  }
  if(flags===7){
   await page.setViewportSize({width:390,height:844});
   assert.equal(await extraction.evaluate(element=>element.scrollWidth<=element.clientWidth),true);
   await page.screenshot({path:'/tmp/shiqu-editable-title/extraction-mobile.png'});
   // Editing and clearing a target is an explicit new extraction, without returning to the first window.
   await extraction.getByLabel(/故事标题（可选）/).fill('勇士护民');
   let response=page.waitForResponse(response=>response.url().endsWith(`/api/reader/sessions/${saved.id}/setup`)&&response.request().method()==='POST'&&response.request().postDataJSON().action==='search');
   await extraction.getByRole('button',{name:'按标题提取',exact:true}).click();
   assert.equal((await(await response).json()).selection.discovery.title,'勇士护民');
   await extraction.getByLabel(/故事标题（可选）/).fill('');
   response=page.waitForResponse(response=>response.url().endsWith(`/api/reader/sessions/${saved.id}/setup`)&&response.request().method()==='POST'&&response.request().postDataJSON().action==='search');
   await extraction.getByRole('button',{name:'自动提取故事',exact:true}).click();
   assert.deepEqual((await(await response).json()).selection.discovery,{mode:'auto'});
   await page.setViewportSize({width:1280,height:900});
  }
 }
 // A single catalog story can be a title-query scope, and clearing the title preserves that choice.
 const real=new LocalBooks(process.cwd());library.books.book=selection=>real.book(selection);
 let sheet=await open();
 await sheet.getByRole('group',{name:'选择书籍'}).getByRole('button',{name:'聊斋志异',exact:true}).click();
 await sheet.getByRole('group',{name:'原文范围'}).getByRole('button',{name:'选择章节或已有故事段落'}).click();
 await sheet.getByLabel('搜索故事或章节').fill('种梨');
 await sheet.getByRole('button').filter({has:page.getByText('種梨',{exact:true})}).click();
 await sheet.getByRole('group',{name:'故事主题'}).getByRole('button',{name:'欲望与代价',exact:true}).click();
 const request=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/reader/sessions'&&response.request().method()==='POST');
 await sheet.getByRole('button',{name:'开始发现故事',exact:true}).click();
 const submitted=await request;assert.equal(submitted.status(),201);const selected=submitted.request().postDataJSON().selection;
 assert.deepEqual(selected.discovery,{mode:'auto'});assert.equal(selected.theme,'欲望与代价');assert.equal(selected.discoverySources.length,1);assert.equal(selected.source,undefined);
 const created=await submitted.json(),extraction=page.getByRole('dialog',{name:'选择故事',exact:true});
 await extraction.getByLabel(/故事标题（可选）/).fill('种梨');
 const search=page.waitForResponse(response=>response.url().endsWith(`/api/reader/sessions/${created.id}/setup`)&&response.request().method()==='POST'&&response.request().postDataJSON().action==='search');
 await extraction.getByRole('button',{name:'按标题提取',exact:true}).click();
 const changed=await(await search).json();assert.equal(changed.selection.discovery.title,'种梨');assert.deepEqual(changed.selection.discoverySources,selected.discoverySources);
 sheet=await open();await sheet.getByRole('group',{name:'选择书籍'}).getByRole('button',{name:'其他',exact:true}).click();
 assert.equal(await sheet.getByLabel(/故事标题（可选）/).count(),0);
 assert.equal(f.control.calls.length,0);assert.equal(f.control.plans.length,0);
 // The same editor is available inside a separate replacement draft; cancelling retains the parent.
 f.options.generation=f.generation;f.control.hold=false;
 f.generation.suggestions=async selection=>({stories:[{title:selection.discovery?.mode==='title'?selection.discovery.title:'重选候选',description:'可独立讲述的完整事件。'}],note:''});
 await f.restart();f.app.services.localBooks=real;
 const parentId=await f.create(2);await until(async()=>(await f.read(parentId)).state==='completed');const parent=await f.read(parentId);
 await page.goto(url+'/read?id='+parentId);
 await page.getByRole('button',{name:'故事设置',exact:true}).click();
 await page.getByRole('button',{name:'替换选题',exact:true}).click();
 const replacement=page.getByRole('dialog',{name:'替换选题',exact:true});
 await replacement.getByLabel(/故事标题（可选）/).fill('庄子的大葫芦');
 const query=page.waitForResponse(response=>/\/api\/reader\/sessions\/[^/]+\/setup$/.test(new URL(response.url()).pathname)&&response.request().method()==='POST'&&response.request().postDataJSON().action==='search');
 await replacement.getByRole('button',{name:'按标题提取',exact:true}).click();
 const replacementQuery=await query;assert.equal(replacementQuery.status(),200);const draft=await replacementQuery.json();
 assert.equal(draft.selection.discovery.title,'庄子的大葫芦');assert.equal(draft.reselection.parentId,parentId);
 assert.deepEqual((await f.read(parentId)).story,parent.story);
 await replacement.getByRole('button',{name:'取消替换',exact:true}).click();
 assert.deepEqual((await f.read(parentId)).story,parent.story);
});
