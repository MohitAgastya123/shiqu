// Verify all optional-condition combinations with title editing in the shared extraction window.
// Browser/data are disposable; inference is controlled and no production shelf or credentials are loaded.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {createHttpServer} from '../server/http.ts';
import {withLocalBooks} from '../server/local-generation.ts';
import {LocalBooks} from '../server/local-books.ts';
import {libraryFixture} from './fixtures/story-library.mjs';
import {productionFixture,until} from './fixtures/production.mjs';

const evidenceDirectory=process.env.SHIQU_E2E_RUN_ID?path.resolve('.data/e2e',process.env.SHIQU_E2E_RUN_ID,'optional-conditions'):'/tmp/shiqu-editable-title';

test('title, theme and original scope are independently optional in the creation UI', {timeout:120000},async t=>{
 const f=await productionFixture(t),library=libraryFixture();
 f.control.beforeText=async kind=>kind==='recommend'?{storySummary:'A philosopher dreams that he is a butterfly. After waking, he reflects on the boundary between his own life and the butterfly dream.',storyMatchReason:'The verified source describes the dream, awakening and question.'}:undefined;
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
 const vite=await createServer({envFile:false,cacheDir:path.join(f.root,'vite-cache'),logLevel:'error',server:{host:'127.0.0.1',port:uiPort,strictPort:true,proxy:{'/api':{target},'/art':{target}}}});
 await vite.listen();t.after(()=>vite.close());
 const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();
 await context.addInitScript(()=>localStorage.setItem('shiqu-last-tab','shelf'));
 const url=`http://127.0.0.1:${vite.httpServer.address().port}`;
 async function open(){
  await page.goto(url);
  await page.getByRole('button',{name:'New story',exact:true}).click();
  const sheet=page.getByRole('dialog',{name:'How would you like to read this story?'});
  await sheet.getByRole('group',{name:'Choose book'}).getByRole('button',{name:'Zhuangzi',exact:true}).click();
  return sheet;
 }
 for(let flags=0;flags<8;flags++){
  const title=!!(flags&1),theme=!!(flags&2),scope=!!(flags&4),sheet=await open();
  assert.equal(await sheet.getByLabel('Story title',{exact:true}).count(),0);
  assert.equal(await sheet.getByRole('group',{name:'Source scope'}).getByRole('button',{name:'Automatic',exact:true}).count(),1);
  const scopePosition=await sheet.getByRole('group',{name:'Source scope'}).boundingBox(),themePosition=await sheet.getByRole('group',{name:'Story theme'}).boundingBox();
  assert.ok(scopePosition.y<themePosition.y,'Original scope should appear before theme');
  if(theme){await sheet.getByRole('group',{name:'Story theme'}).getByRole('button',{name:'Other',exact:true}).click();await sheet.getByLabel('Enter a theme to explore').fill('Gratitude');}
  if(scope){
   await sheet.getByRole('group',{name:'Source scope'}).getByRole('button',{name:'Choose chapters or existing story passages'}).click();await sheet.getByRole('checkbox',{name:'Chapter 1',exact:true}).check();
   await sheet.getByRole('button',{name:'Done choosing source',exact:true}).click();
   assert.equal(await sheet.getByLabel('Search stories or chapters').isVisible(),false);
   await sheet.locator('.yu-scope-selection>summary').click();
   assert.equal(await sheet.getByRole('checkbox',{name:'Chapter 1',exact:true}).isChecked(),true);
   await sheet.getByRole('button',{name:'Done choosing source',exact:true}).click();
  }
  const gap=await sheet.getByRole('button',{name:'Find stories',exact:true}).evaluate(button=>button.getBoundingClientRect().top-button.previousElementSibling.getBoundingClientRect().bottom);
  assert.ok(gap>=23.5,`discovery button gap: ${gap}`);
  if(flags===0){
   await mkdir(evidenceDirectory,{recursive:true});
   await sheet.getByRole('button',{name:'Find stories',exact:true}).scrollIntoViewIfNeeded();
   await page.screenshot({path:path.join(evidenceDirectory,'source-button-gap.png')});
  }
  const response=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/reader/sessions'&&response.request().method()==='POST');
  await sheet.getByRole('button',{name:'Find stories',exact:true}).click();
  const created=await response;assert.equal(created.status(),201);
  const payload=created.request().postDataJSON().selection,saved=await created.json();
  assert.deepEqual(payload.discovery,{mode:'auto'});
  assert.equal(payload.theme,theme?'Gratitude':'原典故事');
  assert.equal(payload.discoverySources?.length,scope?1:undefined);
  assert.deepEqual(saved.selection.discovery,payload.discovery);assert.equal(saved.selection.theme,payload.theme);
  assert.equal(saved.selection.source,undefined);
  assert.equal(saved.intake.search.state,'idle');assert.deepEqual(saved.intake.batches,[]);
  const extraction=page.getByRole('dialog',{name:'Story settings',exact:true});
  await extraction.getByRole('group',{name:'Title mode'}).waitFor();
  assert.equal(await extraction.getByRole('button',{name:'Automatic title',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await extraction.getByLabel('Story title',{exact:true}).count(),0);
  const context=extraction.getByRole('region',{name:'Selected source and theme'});
  if(scope)await context.getByText('Chapter 1',{exact:true}).waitFor();
  else assert.ok((await context.textContent()).includes('Automatic (no chapter or passage limit)'));
  assert.ok((await context.textContent()).includes(theme?'Gratitude':'Any theme'));
  const contextPosition=await context.boundingBox(),modePosition=await extraction.getByRole('group',{name:'Title mode'}).boundingBox();
  assert.ok(contextPosition.y<modePosition.y,'Selected originals and theme should precede title mode');
  assert.equal((await f.app.services.production.queue.jobs(saved.id,'docker-local-owner')).filter(job=>job.kind==='discover').length,0);
  assert.equal(await extraction.locator('.yu-extraction-help').count(),1);
  assert.equal(await extraction.locator('.yu-extraction-help').textContent(),'Find stories in the selected source and theme, with automatically suggested titles.');
  if(flags===0)assert.equal(library.calls.catalog.length,0);
  if(title){
   await extraction.getByRole('button',{name:'Enter title',exact:true}).click();
   assert.equal(await extraction.locator('.yu-extraction-help').textContent(),'Find a complete story by title. The theme guides its emphasis.');
   assert.equal(await extraction.getByRole('button',{name:'Find by title',exact:true}).isDisabled(),true);
   await extraction.getByLabel('Story title',{exact:true}).fill('乌龟报恩');
   const search=page.waitForResponse(response=>response.url().endsWith(`/api/reader/sessions/${saved.id}/setup`)&&response.request().method()==='POST'&&response.request().postDataJSON().action==='search');
   await extraction.getByRole('button',{name:'Find by title',exact:true}).click();
   const searched=await search;assert.equal(searched.status(),200);const changed=await searched.json();
   assert.deepEqual(changed.selection.discovery,{mode:'title',title:'乌龟报恩'});
   assert.equal(changed.selection.theme,payload.theme);assert.deepEqual(changed.selection.discoverySources,payload.discoverySources);
  }else{
   const search=page.waitForResponse(response=>response.url().endsWith(`/api/reader/sessions/${saved.id}/setup`)&&response.request().method()==='POST'&&response.request().postDataJSON().action==='search');
   await extraction.getByRole('button',{name:'Start discovery',exact:true}).click();
   const started=await search;assert.equal(started.status(),200);assert.deepEqual((await started.json()).selection.discovery,{mode:'auto'});
  }
  await extraction.getByRole('button').filter({has:page.getByText('乌龟报恩',{exact:true})}).waitFor();
  assert.equal(await extraction.locator('.yu-extraction-help').textContent(),'Searching again replaces the current candidates.');
  if(flags===6){
   await page.setViewportSize({width:390,height:844});
   await extraction.getByRole('region',{name:'Selected source and theme'}).scrollIntoViewIfNeeded();
   assert.equal(await extraction.evaluate(element=>element.scrollWidth<=element.clientWidth),true);
   await page.screenshot({path:path.join(evidenceDirectory,'extraction-auto-mobile.png')});
   await page.setViewportSize({width:1280,height:900});
  }
  if(flags===7){
   await page.setViewportSize({width:390,height:844});
   assert.equal(await extraction.evaluate(element=>element.scrollWidth<=element.clientWidth),true);
   await page.screenshot({path:path.join(evidenceDirectory,'extraction-mobile.png')});
   // Editing and clearing a target is an explicit new extraction, without returning to the first window.
   await extraction.getByLabel('Story title',{exact:true}).fill('勇士护民');
   let response=page.waitForResponse(response=>response.url().endsWith(`/api/reader/sessions/${saved.id}/setup`)&&response.request().method()==='POST'&&response.request().postDataJSON().action==='search');
   await extraction.getByRole('button',{name:'Find by title',exact:true}).click();
   assert.equal((await(await response).json()).selection.discovery.title,'勇士护民');
   await extraction.getByRole('button',{name:'Automatic title',exact:true}).click();
   assert.equal(await extraction.getByLabel('Story title',{exact:true}).count(),0);
   response=page.waitForResponse(response=>response.url().endsWith(`/api/reader/sessions/${saved.id}/setup`)&&response.request().method()==='POST'&&response.request().postDataJSON().action==='search');
   await extraction.getByRole('button',{name:'Start discovery',exact:true}).click();
   assert.deepEqual((await(await response).json()).selection.discovery,{mode:'auto'});
   await page.setViewportSize({width:1280,height:900});
  }
 }
 // Selecting a book is a preference immediately, even when creation is cancelled before submission.
 let preference=await open();
 await preference.getByRole('group',{name:'Choose book'}).getByRole('button',{name:'Water Margin',exact:true}).click();
 await preference.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'New story',exact:true}).click();
 preference=page.getByRole('dialog',{name:'How would you like to read this story?'});
 assert.equal(await preference.getByRole('group',{name:'Choose book'}).getByRole('button',{name:'Water Margin',exact:true}).getAttribute('aria-pressed'),'true');
 await preference.getByRole('button',{name:'Close',exact:true}).click();
 await page.reload();await page.getByRole('button',{name:'New story',exact:true}).click();
 preference=page.getByRole('dialog',{name:'How would you like to read this story?'});
 assert.equal(await preference.getByRole('group',{name:'Choose book'}).getByRole('button',{name:'Water Margin',exact:true}).getAttribute('aria-pressed'),'true');
 await preference.getByRole('button',{name:'Close',exact:true}).click();
 // A single catalog story can be a title-query scope, and clearing the title preserves that choice.
 const real=new LocalBooks(process.cwd());library.books.book=selection=>real.book(selection);
 let sheet=await open();
 await sheet.getByRole('group',{name:'Choose book'}).getByRole('button',{name:'Strange Tales from a Chinese Studio',exact:true}).click();
 await sheet.getByRole('group',{name:'Source scope'}).getByRole('button',{name:'Choose chapters or existing story passages'}).click();
 const pearBook=await real.book({bookId:'liaozhai'}),pearUnit=pearBook.sections.flatMap(section=>section.units).find(unit=>unit.text.trim()==='種梨');assert.ok(pearUnit);
 const pearContents=await f.json('books/liaozhai/contents?q='+encodeURIComponent('种梨')),pearEntry=pearContents.entries.find(entry=>entry.source?.firstUnit===pearUnit.id);assert.ok(pearEntry);assert.match(pearEntry.title,/^Story \d+$/);
 await sheet.getByLabel('Search stories or chapters').fill('种梨');
 await sheet.getByRole('button').filter({has:page.getByText(pearEntry.title,{exact:true})}).click();
 await sheet.getByRole('button',{name:'Done choosing source',exact:true}).click();
 await sheet.getByRole('group',{name:'Story theme'}).getByRole('button',{name:'Desire and consequences',exact:true}).click();
 const request=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/reader/sessions'&&response.request().method()==='POST');
 await sheet.getByRole('button',{name:'Find stories',exact:true}).click();
 const submitted=await request;assert.equal(submitted.status(),201);const selected=submitted.request().postDataJSON().selection;
 assert.deepEqual(selected.discovery,{mode:'auto'});assert.equal(selected.theme,'欲望与代价');assert.equal(selected.discoverySources.length,1);assert.equal(selected.source,undefined);assert.equal(selected.discoverySources[0].firstUnit,pearUnit.id);
 const created=await submitted.json(),extraction=page.getByRole('dialog',{name:'Story settings',exact:true});
 await extraction.getByRole('region',{name:'Selected source and theme'}).getByText(pearEntry.title,{exact:true}).waitFor();
 await extraction.getByRole('button',{name:'Enter title',exact:true}).click();
 await extraction.getByLabel('Story title',{exact:true}).fill('种梨');
 const search=page.waitForResponse(response=>response.url().endsWith(`/api/reader/sessions/${created.id}/setup`)&&response.request().method()==='POST'&&response.request().postDataJSON().action==='search');
 await extraction.getByRole('button',{name:'Find by title',exact:true}).click();
 const changed=await(await search).json();assert.equal(changed.selection.discovery.title,'种梨');assert.deepEqual(changed.selection.discoverySources,selected.discoverySources);
 sheet=await open();await sheet.getByRole('group',{name:'Choose book'}).getByRole('button',{name:'Other',exact:true}).click();
 assert.equal(await sheet.getByLabel('Story title',{exact:true}).count(),0);
 assert.equal(f.control.calls.length,0);assert.equal(f.control.plans.length,0);
 // The actual three selected Water Margin chapters are listed, rather than just a range count.
 sheet=await open();
 await sheet.getByRole('group',{name:'Choose book'}).getByRole('button',{name:'Water Margin',exact:true}).click();
 await sheet.getByRole('group',{name:'Source scope'}).getByRole('button',{name:'Choose chapters or existing story passages'}).click();
 await sheet.getByLabel('Search stories or chapters').fill('高太尉');
 for(const chapter of ['Chapter 78','Chapter 79','Chapter 80'])await sheet.getByRole('checkbox',{name:new RegExp('^'+chapter+'$')}).check();
 await sheet.getByRole('button',{name:'Done choosing source',exact:true}).click();
 await sheet.getByRole('group',{name:'Story theme'}).getByRole('button',{name:'Desire and consequences',exact:true}).click();
 await sheet.getByRole('button',{name:'Find stories',exact:true}).click();
 const margin=page.getByRole('dialog',{name:'Story settings',exact:true}),chosen=margin.getByRole('region',{name:'Selected source and theme'});
 for(const chapter of ['Chapter 78','Chapter 79','Chapter 80'])await chosen.getByText(new RegExp('^'+chapter+'$')).waitFor();
 assert.ok((await chosen.textContent()).includes('Desire and consequences'));
 assert.equal(await margin.getByRole('button',{name:'Automatic title',exact:true}).getAttribute('aria-pressed'),'true');
 assert.equal(await margin.getByLabel('Story title',{exact:true}).count(),0);
 await page.setViewportSize({width:390,height:844});
 assert.equal(await margin.evaluate(element=>element.scrollWidth<=element.clientWidth),true);
 await margin.locator('.yu-sheet').evaluate(element=>{element.scrollTop=0;});
 await page.screenshot({path:path.join(evidenceDirectory,'three-chapter-context-mobile.png')});
 await margin.getByRole('button',{name:'Enter title',exact:true}).click();
 await margin.getByLabel('Story title',{exact:true}).fill('宋公明三败高俅');
 await page.screenshot({path:path.join(evidenceDirectory,'three-chapter-input-mobile.png')});
 // Returning edits the existing task and restores receipts outside the first directory page.
 const marginId=new URL(page.url()).searchParams.get('id'),shelfSize=(await f.json('sessions')).length;
 await margin.getByRole('link',{name:'Back to book, source, and theme',exact:true}).click();
 const returned=page.getByRole('dialog',{name:'How would you like to read this story?'});
 assert.equal(await returned.getByRole('group',{name:'Choose book'}).getByRole('button',{name:'Water Margin',exact:true}).getAttribute('aria-pressed'),'true');
 assert.equal(await returned.getByRole('group',{name:'Story theme'}).getByRole('button',{name:'Desire and consequences',exact:true}).getAttribute('aria-pressed'),'true');
 await returned.locator('.yu-scope-selection>summary').click();
 await returned.getByLabel('Search stories or chapters').fill('高太尉');
 for(const chapter of ['Chapter 78','Chapter 79','Chapter 80'])assert.equal(await returned.getByRole('checkbox',{name:new RegExp('^'+chapter+'$')}).isChecked(),true);
 await returned.getByRole('checkbox',{name:/^Chapter 79$/}).uncheck();
 await returned.getByRole('button',{name:'Done choosing source',exact:true}).click();
 await returned.getByRole('group',{name:'Story theme'}).getByRole('button',{name:'Other',exact:true}).click();
 await returned.getByLabel('Enter a theme to explore').fill('Finding a way forward');
 const update=page.waitForResponse(response=>response.url().endsWith(`/api/reader/sessions/${marginId}/setup`)&&response.request().method()==='POST'&&response.request().postDataJSON().action==='conditions');
 await returned.getByRole('button',{name:'Find stories',exact:true}).click();
 const updated=await update;assert.equal(updated.status(),200);assert.equal((await updated.json()).id,marginId);
 assert.equal(new URL(page.url()).searchParams.get('id'),marginId);assert.equal((await f.json('sessions')).length,shelfSize);
 const revised=page.getByRole('dialog',{name:'Story settings',exact:true});
 const revisedContext=revised.getByRole('region',{name:'Selected source and theme'});
 await revisedContext.getByText(/^Chapter 80$/).waitFor();
 assert.equal(await revisedContext.locator('li').count(),2);
 assert.ok((await revisedContext.textContent()).includes('Finding a way forward'));
 assert.equal(await revised.locator('.yu-sheet').evaluate(element=>getComputedStyle(element).scrollbarWidth==='thin'||getComputedStyle(element,'::-webkit-scrollbar').width==='6px'),true);
 await revised.getByRole('link',{name:'Back to book, source, and theme',exact:true}).click();
 assert.equal(await page.getByLabel('Enter a theme to explore').inputValue(),'Finding a way forward');
 await page.getByRole('dialog',{name:'How would you like to read this story?'}).getByRole('group',{name:'Choose book'}).getByRole('button',{name:'Zhuangzi',exact:true}).click();
 await page.getByRole('button',{name:'Find stories',exact:true}).click();
 await revised.getByRole('region',{name:'Selected source and theme'}).getByText('“Zhuangzi”',{exact:true}).waitFor();
 assert.equal(new URL(page.url()).searchParams.get('id'),marginId);assert.equal((await f.json('sessions')).length,shelfSize);
 assert.equal((await f.read(marginId)).selection.discoverySources,undefined);
 await revised.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'Shelf',exact:true}).click();
 await page.reload();
 assert.equal((await f.json('sessions')).filter(session=>session.id===marginId).length,1);
 await page.setViewportSize({width:1280,height:900});
 // The same editor is available inside a separate replacement draft; cancelling retains the parent.
 f.options.generation=f.generation;f.control.hold=false;
 f.generation.suggestions=async selection=>({stories:[{title:selection.discovery?.mode==='title'?selection.discovery.title:'重选候选',description:'可独立讲述的完整事件。'}],note:''});
 await f.restart();f.app.services.localBooks=real;
 const parentId=await f.create(2);await until(async()=>(await f.read(parentId)).state==='completed');const parent=await f.read(parentId);
 await page.goto(url+'/read?id='+parentId);
 await page.getByRole('button',{name:'Story settings',exact:true}).click();
 await page.getByRole('link',{name:'Replace story selection',exact:true}).click();
 const replacement=page.getByRole('dialog',{name:'Replace story selection',exact:true});
 await replacement.getByRole('button',{name:'Start discovery',exact:true}).waitFor();
 assert.equal(await replacement.locator('.yu-extraction-help').textContent(),'Find stories in the selected source and theme, with automatically suggested titles.');
 await replacement.getByRole('button',{name:'Enter title',exact:true}).click();
 await replacement.getByLabel('Story title',{exact:true}).fill('庄子的大葫芦');
 const query=page.waitForResponse(response=>/\/api\/reader\/sessions\/[^/]+\/setup$/.test(new URL(response.url()).pathname)&&response.request().method()==='POST'&&response.request().postDataJSON().action==='search');
 await replacement.getByRole('button',{name:'Find by title',exact:true}).click();
 const replacementQuery=await query;assert.equal(replacementQuery.status(),200);const draft=await replacementQuery.json();
 assert.equal(draft.selection.discovery.title,'庄子的大葫芦');assert.equal(draft.reselection.parentId,parentId);
 assert.deepEqual((await f.read(parentId)).story,parent.story);
 await replacement.getByRole('button',{name:'Cancel replacement',exact:true}).click();
 assert.deepEqual((await f.read(parentId)).story,parent.story);
});
