// Verify all eight optional-condition combinations through the real UI and production HTTP intake.
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
import {productionFixture} from './fixtures/production.mjs';

test('title, theme and original scope are independently optional in the creation UI', {timeout:120000},async t=>{
 const f=await productionFixture(t),library=libraryFixture();
 f.generation.suggestions=library.provider.suggestions;
 f.generation.matchStories=library.provider.matchStories;
 f.options.generation=withLocalBooks(f.generation,library.books,f.media);await f.restart();f.app.services.localBooks=library.books;
 const api=createHttpServer(request=>f.app.handle(request));await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{api.closeAllConnections();api.close(resolve);}));
 const target=`http://127.0.0.1:${api.address().port}`;
 const vite=await createServer({envFile:false,logLevel:'error',server:{host:'127.0.0.1',port:0,strictPort:false,proxy:{'/api':{target},'/art':{target}}}});
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
  if(title)await sheet.getByLabel(/故事标题（可选）/).fill('乌龟报恩');
  if(theme){await sheet.getByRole('group',{name:'故事主题'}).getByRole('button',{name:'其他',exact:true}).click();await sheet.getByLabel('写下想看的主题').fill('知恩图报');}
  if(scope){await sheet.getByRole('group',{name:'原文范围'}).getByRole('button',{name:'选择章节或已有故事段落'}).click();await sheet.getByRole('checkbox',{name:'第一章',exact:true}).check();}
  if(flags===7){
   await mkdir('/tmp/shiqu-discovery-modes',{recursive:true});
   await sheet.locator('.yu-sheet').evaluate(element=>{element.scrollTop=0;});
   await page.screenshot({path:'/tmp/shiqu-discovery-modes/desktop.png'});
   await page.setViewportSize({width:390,height:844});
   assert.equal(await sheet.evaluate(element=>element.scrollWidth<=element.clientWidth),true);
   await sheet.locator('.yu-sheet').evaluate(element=>{element.scrollTop=0;});
   await page.screenshot({path:'/tmp/shiqu-discovery-modes/mobile.png'});
   await sheet.getByRole('button',{name:'按标题核对并提取',exact:true}).scrollIntoViewIfNeeded();
   await page.screenshot({path:'/tmp/shiqu-discovery-modes/mobile-scope.png'});
   await page.setViewportSize({width:1280,height:900});
  }
  const response=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/reader/sessions'&&response.request().method()==='POST');
  await sheet.getByRole('button',{name:title?'按标题核对并提取':'开始发现故事',exact:true}).click();
  const created=await response;assert.equal(created.status(),201);
  const payload=created.request().postDataJSON().selection,saved=await created.json();
  assert.deepEqual(payload.discovery,title?{mode:'title',title:'乌龟报恩'}:{mode:'auto'});
  assert.equal(payload.theme,theme?'知恩图报':'原典故事');
  assert.equal(payload.discoverySources?.length,scope?1:undefined);
  assert.deepEqual(saved.selection.discovery,payload.discovery);assert.equal(saved.selection.theme,payload.theme);
  assert.equal(saved.selection.source,undefined);
 }
 // A single catalog story can be a title-query scope, and clearing the title preserves that choice.
 const real=new LocalBooks(process.cwd());library.books.book=selection=>real.book(selection);
 let sheet=await open();
 await sheet.getByRole('group',{name:'选择书籍'}).getByRole('button',{name:'聊斋志异',exact:true}).click();
 await sheet.getByLabel(/故事标题（可选）/).fill('种梨');
 await sheet.getByRole('group',{name:'原文范围'}).getByRole('button',{name:'选择章节或已有故事段落'}).click();
 await sheet.getByLabel('搜索故事或章节').fill('种梨');
 await sheet.getByRole('button').filter({has:page.getByText('種梨',{exact:true})}).click();
 await sheet.getByRole('group',{name:'故事主题'}).getByRole('button',{name:'欲望与代价',exact:true}).click();
 await sheet.getByLabel(/故事标题（可选）/).fill('');
 assert.equal(await sheet.getByRole('button',{name:'选择这篇并准备制作'}).isEnabled(),true);
 assert.equal(await sheet.getByRole('group',{name:'故事主题'}).getByRole('button',{name:'欲望与代价'}).getAttribute('aria-pressed'),'true');
 await sheet.getByLabel(/故事标题（可选）/).fill('种梨');
 const request=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/reader/sessions'&&response.request().method()==='POST');
 await sheet.getByRole('button',{name:'按标题核对并提取'}).click();
 const submitted=await request;assert.equal(submitted.status(),201);const selected=submitted.request().postDataJSON().selection;
 assert.equal(selected.discovery.title,'种梨');assert.equal(selected.theme,'欲望与代价');assert.equal(selected.discoverySources.length,1);assert.equal(selected.source,undefined);
 sheet=await open();await sheet.getByLabel(/故事标题（可选）/).fill('乌龟报恩');
 await sheet.getByRole('group',{name:'选择书籍'}).getByRole('button',{name:'其他',exact:true}).click();
 assert.equal(await sheet.getByLabel(/故事标题（可选）/).inputValue(),'');assert.equal(await sheet.getByLabel(/故事标题（可选）/).isDisabled(),true);
 assert.equal(f.control.calls.length,0);assert.equal(f.control.plans.length,0);
});
