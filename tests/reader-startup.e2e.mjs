// Delay actual startup responses to protect a single current-library load and persisted reader actions.
import test from 'node:test';
import assert from 'node:assert/strict';
import {storyBrowser} from './fixtures/story-browser.mjs';
import {insertReaderStory,makeStory} from './fixtures/story.mjs';
import {png} from './fixtures/images.mjs';
import {until} from './fixtures/production.mjs';

for(const delayed of ['sessions','deletions'])test(`startup waits for ${delayed}, reads the library once, and ignores cached studio history`,async t=>{
 const b=await storyBrowser(t,'reader-startup-'+delayed),{page,f,context,url}=b;
 const story=await insertReaderStory(f.app,{...makeStory(4),title:'当前书库故事',pages:makeStory(4).pages.map(p=>({...p,image:'/api/media/current.png'}))});
 await f.app.services.media.put('current.png',png,{contentType:'image/png'});
 await f.app.services.database.prepare("UPDATE stories SET last_read_at='2026-11-04T00:00:00Z' WHERE id=?").bind(story.id).run();
 await context.addInitScript(()=>{
  localStorage.setItem('yiyu-reading',JSON.stringify([{storyId:'zhongli',page:7,updatedAt:'2099-01-01'}]));
  localStorage.setItem('shiqu-last-read','zhongli');
 });
 const requests=[];page.on('request',request=>{const path=new URL(request.url()).pathname;if(path.startsWith('/api/'))requests.push(path);});
 let release,arrived;
 const pending=new Promise(resolve=>release=resolve),started=new Promise(resolve=>arrived=resolve);
 t.after(()=>release());
 await page.route('**/api/reader/'+delayed+(delayed==='deletions'?'?inventory=1':''),async route=>{
  const response=await route.fetch();arrived();await pending;await route.fulfill({response});
 });
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});await started;
 await page.getByRole('button',{name:'发现',exact:true}).click();
 await page.getByText('正在打开故事…',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'继续阅读'+story.title,exact:true}).count(),0);
 assert.equal(await page.getByText('把下一篇故事留在这里',{exact:true}).count(),0);
 release();
 await page.getByRole('button',{name:'继续阅读'+story.title,exact:true}).waitFor();
 assert.equal(requests.filter(path=>path==='/api/reader/sessions').length,1);
 assert.equal(requests.filter(path=>path==='/api/reader/deletions').length,1);
 assert.equal(requests.filter(path=>/^\/api\/(admin|stories|books|me|events)(?:\/|$)/.test(path)).length,0);
 assert.equal(await page.getByText('一车梨的秘密',{exact:true}).count(),0);
 await b.screenshot('current-library-ready');
 assert.equal(f.control.calls.length,0);

 if(delayed==='sessions'){
  await page.getByRole('button',{name:'继续阅读'+story.title,exact:true}).click();
  await page.getByRole('button',{name:'下一页',exact:true}).click();
  await until(async()=>(await f.read(story.id)).page===1);
  await page.getByRole('button',{name:'收藏故事',exact:true}).click();
  await until(async()=>(await f.read(story.id)).saved===true);
  await page.reload();
  await page.getByRole('button',{name:'取消收藏',exact:true}).waitFor();
  assert.equal((await f.read(story.id)).page,1);
  await page.getByRole('button',{name:'返回发现',exact:true}).click();
  await page.getByRole('button',{name:'书架',exact:true}).click();
  await page.getByRole('button',{name:'删除《'+story.title+'》',exact:true}).click();
  await page.getByRole('dialog',{name:'删除这篇故事？',exact:true}).getByRole('button',{name:'删除故事',exact:true}).click();
  await page.getByRole('button',{name:'撤销删除',exact:true}).click();
  await page.getByRole('button',{name:'继续阅读《'+story.title+'》',exact:true}).waitFor();
  const restored=await f.read(story.id);assert.equal(restored.page,1);assert.equal(restored.saved,true);
  assert.equal(f.control.calls.length,0);assert.equal(f.control.plans.length,0);
 }
});
