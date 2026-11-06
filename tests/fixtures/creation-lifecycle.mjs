// English production controls preserve source IDs and evidence in browser scenarios.
// Share the full creation-to-reading browser flow between release smoke and exhaustive lifecycle coverage.
// Both entrypoints exercise the same production workflow and assertions with isolated controlled adapters.
import assert from 'node:assert/strict';
import {storyBrowser} from './story-browser.mjs';
import {until} from './production.mjs';
const dialog=(page,name)=>page.getByRole('dialog',{name,exact:true});
async function oneCard(f,id){assert.deepEqual((await f.json('sessions')).map(s=>s.id),[id]);}
export async function creationLifecycle(t){
 const b=await storyBrowser(t,'C001');await b.execute(async()=>{
  const {f,page,library}=b,initial=await b.create({prepare:false,theme:'知恩图报'});
  const picker=dialog(page,"Story settings");await picker.getByRole('button',{name:"Enter title",exact:true}).click();await picker.getByLabel("Story title",{exact:true}).fill('乌龟报恩');
  assert.equal(library.calls.catalog.length,0);await b.screenshot('before-start');
  await page.goto(b.url+'/?id='+initial.id);await dialog(page,"Story settings").getByRole('button',{name:"Start discovery",exact:true}).waitFor();assert.equal(library.calls.catalog.length,0);
  await b.extract(initial,'乌龟报恩');assert.equal(f.control.plans.length,0);assert.equal(f.control.calls.length,0);
  await page.getByRole('link',{name:"Production instructions",exact:true}).click();let editor=dialog(page,"Edit story");
  await editor.getByLabel(/^Production instructions/).fill('保留完整因果，动作清楚。');
  await editor.getByRole('button',{name:"Acceptance criteria",exact:true}).click();await editor.getByLabel(/^Acceptance criteria/).fill('关键反应落实到画面。');
  await editor.getByRole('button',{name:"Art style",exact:true}).click();await editor.getByRole('radio',{name:"Watercolor Storybook",exact:true}).check();
  await editor.getByRole('button',{name:"Narrative detail",exact:true}).click();await editor.getByRole('group',{name:"Narrative detail"}).getByRole('button',{name:/^Brief/}).click();
  const drafted=page.waitForResponse(r=>r.url().endsWith(`/sessions/${initial.id}/setup`)&&r.request().postDataJSON()?.action==='draft');
  await editor.getByRole('button',{name:"Done editing",exact:true}).click();assert.equal((await drafted).status(),200);
  await page.reload();await page.getByRole('link',{name:"Change art style",exact:true}).click();editor=dialog(page,"Edit story");assert.equal(await editor.getByRole('radio',{name:"Watercolor Storybook",exact:true}).isChecked(),true);
  await editor.getByRole('button',{name:"Production instructions",exact:true}).click();assert.equal(await editor.getByLabel(/^Production instructions/).inputValue(),'保留完整因果，动作清楚。');
  const recommendations=f.control.recommendations.length;await editor.getByRole('button',{name:"Prepare again with current instructions",exact:true}).click();
  await until(async()=>f.control.recommendations.length>recommendations&&(await f.read(initial.id)).intake.phase==='confirming',15000);
  assert.equal(f.control.plans.length,0);assert.equal(f.control.calls.length,0);
  await b.screenshot('prepared');await b.confirm();await b.completed(initial.id);await b.reader(initial.id);
  const saved=await f.read(initial.id);assert.equal(saved.selection.artStyle,'watercolor');assert.equal(saved.selection.narrativeDetail,'brief');assert.equal(saved.selection.acceptancePrompt,'关键反应落实到画面。');assert.equal(saved.ready,3);
  assert.equal(f.control.frameReviews.length,1);assert.equal(f.control.reviews.length,1);assert.equal(f.control.calls.length,3);await oneCard(f,initial.id);await b.screenshot('completed-reader');
 });
}
