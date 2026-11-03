// Prove visible creation, editing, control, recovery and replacement paths over the real production state machine.
// Controlled provider gates inject failures; browser actions own every business mutation, with read-only DB/API oracles.
import test from 'node:test';
import assert from 'node:assert/strict';
import {storyBrowser} from './fixtures/story-browser.mjs';
import {until} from './fixtures/production.mjs';
const options={timeout:180000};
const dialog=(page,name)=>page.getByRole('dialog',{name,exact:true});
async function oneCard(f,id){assert.deepEqual((await f.json('sessions')).map(s=>s.id),[id]);}
async function revisionResponse(page,action){
 const [result]=await Promise.all([page.waitForResponse(r=>/\/api\/reader\/sessions\/[^/]+\/revisions$/.test(new URL(r.url()).pathname)&&r.request().method()==='POST'),action()]);
 assert.equal(result.status(),201);return result.json();
}
test('STORY-LIFECYCLE-C001: create, wait, extract, edit preparation, confirm and read',options,async t=>{
 const b=await storyBrowser(t,'C001');await b.execute(async()=>{
  const {f,page,library}=b,initial=await b.create({prepare:false,theme:'知恩图报'});
  const picker=dialog(page,'选择故事');await picker.getByRole('button',{name:'输入标题',exact:true}).click();await picker.getByLabel('故事标题',{exact:true}).fill('乌龟报恩');
  assert.equal(library.calls.catalog.length,0);await b.screenshot('before-start');
  await page.goto(b.url+'/?id='+initial.id);await dialog(page,'选择故事').getByRole('button',{name:'开始提取',exact:true}).waitFor();assert.equal(library.calls.catalog.length,0);
  await b.extract(initial,'乌龟报恩');assert.equal(f.control.plans.length,0);assert.equal(f.control.calls.length,0);
  await page.getByRole('button',{name:'制作要求（可选）',exact:true}).click();let editor=dialog(page,'修改故事');
  await editor.getByLabel(/^制作要求/).fill('保留完整因果，动作清楚。');
  await editor.getByRole('button',{name:'验收要求',exact:true}).click();await editor.getByLabel(/^验收要求/).fill('关键反应落实到画面。');
  await editor.getByRole('button',{name:'画风',exact:true}).click();await editor.getByRole('radio',{name:'水彩绘本',exact:true}).check();
  await editor.getByRole('button',{name:'叙事详略',exact:true}).click();await editor.getByRole('group',{name:'叙事详略'}).getByRole('button',{name:/^简短/}).click();
  const drafted=page.waitForResponse(r=>r.url().endsWith(`/sessions/${initial.id}/setup`)&&r.request().postDataJSON()?.action==='draft');
  await editor.getByRole('button',{name:'完成编辑',exact:true}).click();assert.equal((await drafted).status(),200);
  await page.reload();await page.getByRole('button',{name:'修改画风',exact:true}).click();editor=dialog(page,'修改故事');assert.equal(await editor.getByRole('radio',{name:'水彩绘本',exact:true}).isChecked(),true);
  await editor.getByRole('button',{name:'制作要求',exact:true}).click();assert.equal(await editor.getByLabel(/^制作要求/).inputValue(),'保留完整因果，动作清楚。');
  const recommendations=f.control.recommendations.length;await editor.getByRole('button',{name:'按当前要求重新准备',exact:true}).click();
  await until(async()=>f.control.recommendations.length>recommendations&&(await f.read(initial.id)).intake.phase==='confirming',15000);
  assert.equal(f.control.plans.length,0);assert.equal(f.control.calls.length,0);
  await b.screenshot('prepared');await b.confirm();await b.completed(initial.id);await b.reader(initial.id);
  const saved=await f.read(initial.id);assert.equal(saved.selection.artStyle,'watercolor');assert.equal(saved.selection.narrativeDetail,'brief');assert.equal(saved.selection.acceptancePrompt,'关键反应落实到画面。');assert.equal(saved.ready,3);
  assert.equal(f.control.frameReviews.length,1);assert.equal(f.control.reviews.length,1);assert.equal(f.control.calls.length,3);await oneCard(f,initial.id);await b.screenshot('completed-reader');
 });
});
test('STORY-LIFECYCLE-C002: all edit paths preserve one family, history and eligible images',options,async t=>{
 const b=await storyBrowser(t,'C002');await b.execute(async()=>{
  const {f,page}=b,initial=await b.create();await b.confirm();await b.completed(initial.id);await b.reader(initial.id);
  const original=await f.read(initial.id),originalSource=(await f.json(`sessions/${initial.id}/source`)).source;let current=initial.id;
  let settings=await b.settings();await settings.getByRole('button',{name:'修改故事名',exact:true}).click();const name=dialog(page,'修改故事名');await name.getByLabel('故事名',{exact:true}).fill('开发测试·保存的故事名');await name.getByRole('button',{name:'保存故事名',exact:true}).click();
  await until(async()=>(await f.read(current)).story.title==='开发测试·保存的故事名');assert.equal(f.control.calls.length,3);assert.equal(f.control.plans.length,1);
  await settings.getByRole('button',{name:'制作要求',exact:true}).click();let editor=dialog(page,'修改故事');await editor.getByLabel(/^制作要求/).fill('这段草稿应被丢弃。');await editor.getByRole('button',{name:'关闭',exact:true}).click();
  await settings.getByRole('button',{name:'制作要求',exact:true}).click();editor=dialog(page,'修改故事');assert.equal(await editor.getByLabel(/^制作要求/).inputValue(),'这段草稿应被丢弃。');await editor.getByRole('button',{name:'丢弃草稿',exact:true}).click();assert.equal((await f.read(current)).selection.productionPrompt,original.selection.productionPrompt);
  const edits=[
   {name:'制作要求',change:async e=>e.getByLabel(/^制作要求/).fill('开发验证：完整保留关键行动。'),check:s=>assert.equal(s.selection.productionPrompt,'开发验证：完整保留关键行动。')},
   {name:'验收要求',change:async e=>e.getByLabel(/^验收要求/).fill('关键反应落实到画面。'),reuse:true,check:s=>assert.equal(s.selection.acceptancePrompt,'关键反应落实到画面。')},
   {name:'修改画风',change:async e=>e.getByRole('radio',{name:'剪纸艺术',exact:true}).check(),check:s=>assert.equal(s.selection.artStyle,'paper-cut')},
   {name:'修改叙事详略',change:async e=>e.getByRole('group',{name:'叙事详略'}).getByRole('button',{name:/^详细/}).click(),check:s=>assert.equal(s.selection.narrativeDetail,'detailed')},
   {name:'查看分镜',script:true,change:async e=>e.getByLabel(/^旁白/).fill('渔夫伸出双手，将搁浅的乌龟送回河流。'),reuse:true,check:s=>assert.equal(s.story.pages[0].caption,'渔夫伸出双手，将搁浅的乌龟送回河流。')},
   {name:'查看分镜',script:true,change:async e=>{await e.getByLabel(/^选择分镜/).selectOption('2');await e.getByLabel(/^画面提示词/).fill('The fisherman carefully lifts the turtle beside a quiet river, with one clear visible gesture.');},redraw:1,check:s=>assert.match(s.story.pages[1].prompt,/carefully lifts the turtle/)},
   {name:'查看分镜',script:true,change:async e=>{await e.getByText('人物设定（修改后重绘全篇）',{exact:true}).click();await e.getByLabel(/^人物设定/).fill('An adult Chinese fisherman in a blue linen robe, consistent clothing and facial features across every scene.');},redraw:3,check:()=>{}},
   {name:'查看分镜',script:true,change:async e=>{await e.getByLabel(/^选择分镜/).selectOption('0');await e.getByLabel(/^余味/).fill('一时的善意，也会在后来抵达。');},reuse:true,check:s=>assert.equal(s.story.reflection,'一时的善意，也会在后来抵达。')},
  ];
  for(const [index,edit] of edits.entries()){
   await b.reader(current);settings=await b.settings();await settings.getByRole('button',{name:edit.name,exact:true}).click();
   if(edit.script)await dialog(page,'分镜剧本').getByRole('button',{name:'修改分镜',exact:true}).click();
   editor=dialog(page,'修改故事');await edit.change(editor);const images=f.control.calls.length,previous=await f.read(current),before=f.control.plans.length;
   await editor.getByRole('button',{name:'完成编辑',exact:true}).click();assert.equal(f.control.calls.length,images);assert.equal(f.control.plans.length,before);
   if(edit.script)await dialog(page,'分镜剧本').getByRole('button',{name:'关闭',exact:true}).click();
   const next=await revisionResponse(page,()=>settings.getByRole('button',{name:'开始制作',exact:true}).click());await b.completed(next.id);current=next.id;const saved=await f.read(current);edit.check(saved);
   assert.equal(saved.revision.rootId,initial.id);await oneCard(f,current);assert.deepEqual((await f.read(previous.id)).story.pages,previous.story.pages);
   if(edit.reuse)assert.equal(f.control.calls.length,images,edit.name+' must preserve eligible image pixels');
   if(edit.redraw)assert.equal(f.control.calls.length-images,edit.redraw,'Only the affected images should redraw');
   assert.equal((await f.json(`sessions/${current}/source`)).source.text,originalSource.text);await b.reader(current);await b.screenshot(`edit-${index+1}`);
  }
  settings=await b.settings();await settings.getByRole('button',{name:'审核记录',exact:true}).click();const history=dialog(page,'审核记录');await history.getByRole('button',{name:'查看上一版本',exact:true}).waitFor();await history.getByRole('button',{name:'查看上一版本',exact:true}).click();await history.getByRole('button',{name:'返回当前版本',exact:true}).waitFor();
  assert.deepEqual((await f.read(initial.id)).story.pages,original.story.pages);await b.screenshot('history');
 });
});
test('STORY-LIFECYCLE-C003: pause drains in-flight work, refresh stays paused, explicit resume completes',options,async t=>{
 const b=await storyBrowser(t,'C003');await b.execute(async()=>{
  const {f,page}=b,saved=await b.create();f.control.hold=true;await b.confirm();await until(()=>f.control.calls.length===1,15000);
  await dialog(page,'故事流程').getByRole('button',{name:'暂停生成',exact:true}).click();await until(async()=>(await f.read(saved.id)).generationControl==='paused');
  f.control.calls[0].resolve();await until(async()=>(await f.read(saved.id)).ready===1);await b.reader(saved.id);const settings=await b.settings();await settings.getByRole('button',{name:'恢复生成',exact:true}).waitFor();
  assert.equal(f.control.calls.length,1);await b.screenshot('paused');f.control.hold=false;await settings.getByRole('button',{name:'恢复生成',exact:true}).click();await b.completed(saved.id);assert.equal(f.control.calls.length,3);await b.reader(saved.id);await b.screenshot('resumed');
 });
});
test('STORY-LIFECYCLE-C004: failure survives observation and only a retry button authorizes a new attempt',options,async t=>{
 const b=await storyBrowser(t,'C004');await b.execute(async()=>{
  const {f,page}=b,saved=await b.create();f.control.hold=true;await b.confirm();await until(()=>f.control.calls.length===1,15000);f.control.calls[0].reject(Error('controlled browser image failure'));
  await until(async()=>(await f.read(saved.id)).state==='failed');const failed=await f.read(saved.id);assert.ok(failed.faults.length);const plans=f.control.plans.length,reviews=f.control.reviews.length;
  await page.reload();await dialog(page,'故事流程').getByRole('button',{name:'重试生成',exact:true}).waitFor();assert.equal(f.control.calls.length,1);await b.screenshot('failed');
  f.control.hold=false;await dialog(page,'故事流程').getByRole('button',{name:'重试生成',exact:true}).click();await b.completed(saved.id);assert.equal(f.control.calls.length,4);assert.equal(f.control.plans.length,plans);assert.equal(f.control.reviews.length,reviews);assert.equal((await f.read(saved.id)).faults,undefined);await b.reader(saved.id);await b.screenshot('recovered');
 });
});
test('STORY-LIFECYCLE-C005: replacement waits, cancel conserves parent, choosing commits one new version',options,async t=>{
 const b=await storyBrowser(t,'C005');await b.execute(async()=>{
  const {f,page,library}=b,saved=await b.create();await b.confirm();await b.completed(saved.id);await b.reader(saved.id);const parent=await f.read(saved.id),calls=library.calls.catalog.length;
  let settings=await b.settings();await settings.getByRole('button',{name:'替换选题',exact:true}).click();let picker=dialog(page,'替换选题');await picker.getByRole('button',{name:'开始提取',exact:true}).waitFor();assert.equal(library.calls.catalog.length,calls);await oneCard(f,saved.id);await b.screenshot('replacement-waiting');
  await picker.getByRole('button',{name:'取消替换',exact:true}).click();assert.deepEqual((await f.read(saved.id)).story,parent.story);await oneCard(f,saved.id);
  await b.reader(saved.id);settings=await b.settings();await settings.getByRole('button',{name:'替换选题',exact:true}).click();picker=dialog(page,'替换选题');await picker.getByRole('button',{name:'输入标题',exact:true}).click();await picker.getByLabel('故事标题',{exact:true}).fill('勇士护民');await picker.getByRole('button',{name:'按标题提取',exact:true}).click();
  const response=page.waitForResponse(r=>/\/reselection\/[^/]+$/.test(new URL(r.url()).pathname)&&r.request().method()==='POST');
  await picker.getByRole('button').filter({has:page.getByText('勇士护民',{exact:true})}).click();const next=await(await response).json();assert.notEqual(next.id,saved.id);await until(async()=>(await f.read(next.id)).intake.phase==='confirming',15000);await page.getByRole('button',{name:'开始制作',exact:true}).waitFor();assert.equal(f.control.calls.length,3);await oneCard(f,next.id);
  await b.confirm();await b.completed(next.id);assert.equal(f.control.calls.length,6);assert.deepEqual((await f.read(saved.id)).story,parent.story);assert.notEqual((await f.json(`sessions/${next.id}/source`)).source.text,(await f.json(`sessions/${saved.id}/source`)).source.text);await b.reader(next.id);await b.screenshot('replacement-completed');
 });
});
for(const manual of [true,false])test(`STORY-LIFECYCLE-C004-${manual?'review-edit':'review-override'}: blocked audit requires an explicit user decision before drawing`,options,async t=>{
 const b=await storyBrowser(t,manual?'C004-review-edit':'C004-review-override');await b.execute(async()=>{
  const {f,page}=b,base=f.control.beforeText;let blocked=true;
  f.control.beforeText=async(kind,payload,schema)=>{
   if(kind==='review'&&blocked)return {issues:[{page:1,category:'caption',problem:'受控审核：配文未说明可见行动。',instruction:'保留原文事件，明确第一幅的可见动作。'}]};
   if(kind==='repair'&&blocked)return {pages:payload.requestedPages.map(page=>({page,...payload.plan.pages[page-1]}))};
   return base(kind,payload,schema);
  };
  const saved=await b.create();await b.confirm();await until(async()=>(await f.read(saved.id)).state==='failed',15000);assert.equal(f.control.calls.length,0);await b.screenshot('audit-blocked');
  if(manual){
   await dialog(page,'故事流程').getByRole('button',{name:'手动修改第 1 幅',exact:true}).click();const editor=dialog(page,'修改故事');await editor.getByLabel(/^旁白/).fill('渔夫俯身伸手，把岸上的乌龟轻轻放回水中。');blocked=false;
   const next=await revisionResponse(page,()=>editor.getByRole('button',{name:'保存并重新审核',exact:true}).click());await b.completed(next.id);await oneCard(f,next.id);assert.equal((await f.read(next.id)).story.pages[0].caption,'渔夫俯身伸手，把岸上的乌龟轻轻放回水中。');assert.equal((await f.read(saved.id)).state,'failed');await b.reader(next.id);
  }else{
   await dialog(page,'故事流程').getByRole('button',{name:'跳过问题并绘图',exact:true}).click();await b.completed(saved.id);const row=await f.app.services.database.prepare('SELECT document FROM reader_sessions WHERE id=?').bind(saved.id).first();assert.equal(JSON.parse(row.document).visualReview.overridden,true);await b.reader(saved.id);
  }
  assert.equal(f.control.calls.length,3);await b.screenshot('audit-explicit-resolution');
 });
});
