// Exercise real page selection and paid-dispatch boundaries with SQLite/files and controlled images.
import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import {rm} from 'node:fs/promises';
import {productionFixture,until,makePlan} from './fixtures/production.mjs';import {savedStory,star,unstar,owner} from './fixtures/book-reference.mjs';import {png,jpeg} from './fixtures/images.mjs';
const original={title:'测试原文',text:'人物采取行动，回应彼此，故事在实际结果处结束。',kind:'passage',url:'https://example.org/original',provider:'fixture',retrievedAt:'2026-11-01'};
async function target(f,{bookId='红楼梦',length=3,images=[]}={}){
 const id=crypto.randomUUID(),doc={plan:makePlan(length),original,frameCountConfirmed:true,images,audio:[],usage:[]},now=new Date().toISOString();
 await f.app.services.database.prepare("INSERT INTO stories(id,user_id,selection,document,generation_mode,generation_control,state,created_at,updated_at) VALUES(?,?,?,?,'reader','active','idle',?,?)").bind(id,owner,JSON.stringify({bookId,theme:'原典故事',artStyle:'cartoon',length,voice:false,productionPrompt:''}),JSON.stringify(doc),now,now).run();return id;
}
const doc=async(f,id)=>JSON.parse((await f.app.services.database.prepare('SELECT document FROM stories WHERE id=?').bind(id).first()).document);

test('in-flight references stay fixed; new calls use replacement and cancellation restores own anchor without redrawing',async t=>{
 const f=await productionFixture(t,'codex',{SHIQU_IMAGE_WORKERS:'1'}),a=await savedStory(f),b=await savedStory(f,{bytes:jpeg}),id=await target(f);
 await star(f,a.id);await f.demand(id);await until(()=>f.control.calls.length===1);assert.equal(f.control.calls[0].reference,Buffer.from(png).toString('base64'));
 const firstJobs=await f.app.services.production.queue.jobs(id,owner),ids=firstJobs.map(job=>job.id).sort();
 const selected=(await star(f,b.id)).reference;assert.equal(f.control.calls[0].reference,Buffer.from(png).toString('base64'));
 f.control.calls[0].resolve();await until(()=>f.control.calls.length===2);assert.equal(f.control.calls[1].reference,Buffer.from(jpeg).toString('base64'));
 const firstImage=(await doc(f,id)).images[0],paid=(await f.app.services.production.queue.jobs(id,owner)).find(job=>job.kind==='image'&&JSON.parse(job.payload).page===0);
 await unstar(f,b.id,selected);f.control.calls[1].resolve();await until(()=>f.control.calls.length===3);assert.equal(f.control.calls[2].reference,Buffer.from(png).toString('base64'));
 f.control.calls[2].resolve();await until(async()=>(await f.read(id)).state==='completed');
 const finalJobs=await f.app.services.production.queue.jobs(id,owner),saved=await doc(f,id);assert.equal(saved.images[0],firstImage);assert.equal(saved.images.filter(Boolean).length,3);assert.equal(f.control.calls.length,3);
 assert.deepEqual(finalJobs.map(job=>job.id).sort(),ids);const preserved=finalJobs.find(job=>job.id===paid.id);assert.equal(preserved.result,paid.result);assert.equal(preserved.attempts,paid.attempts);
});

test('no-star defaults and other-book isolation remain first-frame empty then own-first reference',async t=>{
 const f=await productionFixture(t),source=await savedStory(f);await star(f,source.id);const id=await target(f,{bookId:'三国演义',length:2});
 await f.demand(id);await until(()=>f.control.calls.length===1);assert.equal(f.control.calls[0].reference,undefined);f.control.calls[0].resolve();await until(()=>f.control.calls.length===2);assert.equal(f.control.calls[1].reference,Buffer.from(png).toString('base64'));f.control.calls[1].resolve();await until(async()=>(await f.read(id)).state==='completed');
});

test('restart keeps the selected bytes and legacy advance uses the same book reference',async t=>{
 const f=await productionFixture(t),source=await savedStory(f,{bytes:jpeg});await star(f,source.id);await f.restart();f.control.hold=false;const id=await target(f,{length:2});
 const response=await f.request(`sessions/${id}/advance`,'POST',{throughPage:0});assert.ok([200,202].includes(response.status));await until(async()=>!!(await doc(f,id)).images[0]);assert.equal(f.control.calls.length,1);assert.equal(f.control.calls[0].reference,Buffer.from(jpeg).toString('base64'));assert.ok((await doc(f,id)).images[0]);
});

test('a valid book reference can serve a later frame without loading its unused missing first-image file',async t=>{
 const f=await productionFixture(t),source=await savedStory(f,{bytes:jpeg});await star(f,source.id);const id=await target(f,{length:2});
 await f.app.services.database.prepare("UPDATE stories SET document=json_set(document,'$.images[0]',?) WHERE id=?").bind(`/api/reader/media/${id}/0.png`,id).run();
 await f.demand(id);await until(()=>f.control.calls.length===1);assert.equal(f.control.calls[0].page,1);assert.equal(f.control.calls[0].reference,Buffer.from(jpeg).toString('base64'));f.control.calls[0].resolve();await until(async()=>!!(await doc(f,id)).images[1]);
});

test('missing snapshot blocks the model but cancellation is still possible',async t=>{
 const f=await productionFixture(t),source=await savedStory(f),selected=(await star(f,source.id)).reference,row=await f.app.services.database.prepare('SELECT asset_key FROM book_image_references').first();await rm(path.join(f.dataDirectory,'media',row.asset_key));
 const id=await target(f,{length:2});await f.demand(id);await until(async()=>(await f.read(id)).state==='failed');assert.equal(f.control.calls.length,0);assert.match((await f.read(id)).error,/book reference image is unavailable/);assert.equal((await unstar(f,source.id,selected)).reference,null);
});

test('current stories may reference previously uploaded local pictures; deleted sources cannot',async t=>{
 const f=await productionFixture(t),source=await savedStory(f,{image:'/api/media/test-0.jpg'});await f.media.put('test-0.jpg',jpeg,{contentType:'image/jpeg'});
 await star(f,source.id);const id=await target(f,{length:2});f.control.hold=false;await f.demand(id);await until(async()=>(await f.read(id)).state==='completed');assert.equal(f.control.calls[0].reference,Buffer.from(jpeg).toString('base64'));
 await f.json(`library/${source.id}`,'DELETE');assert.equal((await f.request(`library/${source.id}/reference`)).status,404);assert.equal((await f.json(`library/${id}/reference`)).reference,null);
});
