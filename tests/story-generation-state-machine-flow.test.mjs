// Drive production REST, SQLite, queue and media with controlled providers and disposable stories.
import test from 'node:test';
import assert from 'node:assert/strict';
import {rm} from 'node:fs/promises';
import path from 'node:path';
import {productionFixture,until,turn} from './fixtures/production.mjs';

const recover=(f,id,fault,requestId=crypto.randomUUID())=>f.json(`sessions/${id}/recover`,'POST',{requestId,faultId:fault.id});
async function lose(f,id,page){
 const image=(await f.read(id)).story.pages[page].image;
 await rm(path.join(f.dataDirectory,'media','reader',id,image.split(`/media/${id}/`)[1]));
 return f.json(`sessions/${id}/image-health`,'POST',{page,image});
}
test('renaming a running image preserves task identity and does not buy a duplicate anchor',async t=>{
 const f=await productionFixture(t),id=await f.create();await until(()=>f.control.calls.length===1);
 await f.json(`sessions/${id}/title`,'POST',{title:'只修改显示名'});
 f.control.hold=false;f.control.calls[0].resolve();await until(async()=>(await f.read(id)).state==='completed');
 assert.equal(f.control.calls.length,8);assert.equal(f.control.calls.filter(call=>call.page===0).length,1);
});
test('real failed work needs a current fault authorization; replay after another failure never spends again',async t=>{
 const f=await productionFixture(t),id=await f.create(3);await until(()=>f.control.calls.length===1);
 f.control.calls[0].reject(Error('controlled first failure'));await until(async()=>(await f.read(id)).state==='failed');
 const first=(await f.read(id)).faults[0],requestId=crypto.randomUUID();
 await f.json(`sessions/${id}/title`,'POST',{title:'失败后只改名'});await turn();assert.equal(f.control.calls.length,1);
 assert.equal((await f.request(`sessions/${id}/production`,'POST',{viewerId:crypto.randomUUID(),page:0,retry:true})).status,400);
 await recover(f,id,first,requestId);await until(()=>f.control.calls.length===2);
 f.control.calls[1].reject(Error('controlled second failure'));await until(async()=>(await f.read(id)).state==='failed');
 const second=(await f.read(id)).faults[0];assert.notEqual(second.id,first.id);
 const replay=await recover(f,id,first,requestId);assert.equal(replay.recoveryReceipt.status,'failed');await turn();assert.equal(f.control.calls.length,2);
 f.control.hold=false;await recover(f,id,second);await until(async()=>(await f.read(id)).state==='completed');
 assert.equal(f.control.calls.length,5);assert.deepEqual((await f.read(id)).faults,undefined);
});
test('two images lost after completion can recover separately without clearing or blocking the other fault',async t=>{
 const f=await productionFixture(t);f.control.hold=false;const id=await f.create(4);await until(async()=>(await f.read(id)).state==='completed');
 await lose(f,id,1);let session=await lose(f,id,2);
 assert.equal(session.state,'failed');assert.equal(session.faults.length,2);assert.equal(session.ready,2);assert.equal(f.control.calls.length,4);
 const second=session.faults.find(fault=>fault.page===1);await recover(f,id,second);
 await until(async()=>{const s=await f.read(id);return s.faults?.length===1&&s.faults[0].page===2;});
 session=await f.read(id);assert.equal(session.state,'failed');assert.equal(session.ready,3);assert.equal(f.control.calls.length,5);
 await recover(f,id,session.faults[0]);await until(async()=>(await f.read(id)).state==='completed');assert.equal(f.control.calls.length,6);
});

test('restored files are reused by both health checks and a durable redraw command without inference',async t=>{
 const f=await productionFixture(t);f.control.hold=false;const id=await f.create(3);await until(async()=>(await f.read(id)).state==='completed');
 const image=(await f.read(id)).story.pages[1].image,key=`reader/${id}/${image.split(`/media/${id}/`)[1]}`,asset=await f.media.get(key),bytes=new Uint8Array(await asset.arrayBuffer());
 let session=await lose(f,id,1);const fault=session.faults[0],requestId=crypto.randomUUID();await f.media.put(key,bytes,{contentType:asset.contentType});
 session=await recover(f,id,fault,requestId);assert.equal(session.recoveryReceipt.status,'succeeded');await until(async()=>(await f.read(id)).state==='completed');
 await recover(f,id,fault,requestId);assert.equal(f.control.calls.length,3);
 await lose(f,id,1);await f.media.put(key,bytes,{contentType:asset.contentType});await f.json(`sessions/${id}/image-health`,'POST',{page:1,image});await until(async()=>(await f.read(id)).state==='completed');assert.equal(f.control.calls.length,3);
});
test('temporary storage errors and stale image reports cannot create redraw permission; truncated images do',async t=>{
 const f=await productionFixture(t);f.control.hold=false;const id=await f.create(2);await until(async()=>(await f.read(id)).state==='completed');
 const image=(await f.read(id)).story.pages[1].image,get=f.app.services.media.get.bind(f.app.services.media);f.app.services.media.get=async()=>{throw Error('temporary storage outage');};
 assert.equal((await f.request(`sessions/${id}/image-health`,'POST',{page:1,image})).status,503);assert.equal((await f.read(id)).state,'completed');f.app.services.media.get=get;
 assert.equal((await f.request(`sessions/${id}/image-health`,'POST',{page:1,image:image+'stale'})).status,409);
 const key=`reader/${id}/${image.split(`/media/${id}/`)[1]}`,asset=await get(key),bytes=new Uint8Array(await asset.arrayBuffer());await f.media.put(key,bytes.slice(0,24),{contentType:'image/png'});
 const session=await f.json(`sessions/${id}/image-health`,'POST',{page:1,image});assert.equal(session.state,'failed');assert.equal(session.ready,1);assert.equal(f.control.calls.length,2);
});
test('first-image loss preserves in-flight work, blocks new dependent calls and survives pause/restart',async t=>{
 const f=await productionFixture(t),id=await f.create(8);await until(()=>f.control.calls.length===1);f.control.calls[0].resolve();await until(()=>f.control.calls.length===4);
 let s=await lose(f,id,0);assert.ok(s.faults.some(fault=>fault.page===0));
 for(const call of f.control.calls)call.resolve();await until(async()=>{const s=await f.read(id);return s.ready===3&&s.state==='failed';});assert.equal(f.control.calls.length,4);
 await f.json(`sessions/${id}/production-control`,'POST',{action:'pause'});await f.restart();s=await f.read(id);assert.equal(s.generationControl,'paused');assert.equal(s.faults[0].page,0);
 assert.equal((await f.request(`sessions/${id}/recover`,'POST',{requestId:crypto.randomUUID(),faultId:s.faults[0].id})).status,409);
 await f.json(`sessions/${id}/production-control`,'POST',{action:'resume'});await f.app.services.production.tick();assert.equal(f.control.calls.length,4);
 await recover(f,id,(await f.read(id)).faults[0]);await until(async()=>(await f.read(id)).state==='completed');assert.equal(f.control.calls.length,9);
});
test('independent publication recovery does not draw or clear an unrelated missing image',async t=>{
 const f=await productionFixture(t),id=await f.create(5),get=f.app.services.media.get.bind(f.app.services.media);let blocked=true;
 f.app.services.media.get=async key=>blocked&&key.startsWith(`reader/${id}/artifacts/1-`)?Promise.reject(Error('controlled publication outage')):get(key);
 await until(()=>f.control.calls.length===1);f.control.calls[0].resolve();await until(()=>f.control.calls.length===4);for(const call of f.control.calls)call.resolve();await until(async()=>(await f.read(id)).state==='failed');
 const before=f.control.calls.length;await lose(f,id,2);let s=await f.read(id);assert.equal(s.faults.length,2);blocked=false;
 const publication=s.faults.find(fault=>fault.stage==='publication');await recover(f,id,publication);
 await until(async()=>{const s=await f.read(id);return s.faults?.length===1&&s.story.pages[1].image;});s=await f.read(id);assert.equal(s.faults[0].page,2);assert.equal(s.state,'failed');assert.equal(f.control.calls.length,before);
});
test('a lost paid publication file requires a new explicit redraw rather than upgrading save authorization',async t=>{
 const f=await productionFixture(t),id=await f.create(2),get=f.app.services.media.get.bind(f.app.services.media);let blocked=true;
 f.app.services.media.get=async key=>blocked&&key.startsWith(`reader/${id}/artifacts/1-`)?Promise.reject(Error('controlled outage')):get(key);
 await until(()=>f.control.calls.length===1);f.control.calls[0].resolve();await until(()=>f.control.calls.length===2);f.control.calls[1].resolve();await until(async()=>(await f.read(id)).state==='failed');
 const fault=(await f.read(id)).faults[0],job=(await f.app.services.production.queue.jobs(id,'docker-local-owner')).find(j=>j.kind==='image'&&JSON.parse(j.payload).page===1),image=JSON.parse(job.result).value;
 await rm(path.join(f.dataDirectory,'media','reader',id,image.split(`/media/${id}/`)[1]));blocked=false;
 assert.equal((await f.request(`sessions/${id}/recover`,'POST',{requestId:crypto.randomUUID(),faultId:fault.id})).status,409);
 const next=(await f.read(id)).faults;assert.equal(next.length,1);assert.notEqual(next[0].id,fault.id);assert.equal(next[0].stage,'redraw');assert.equal(f.control.calls.length,2);
 f.control.hold=false;await recover(f,id,next[0]);await until(async()=>(await f.read(id)).state==='completed');assert.equal(f.control.calls.length,3);
});
test('independent recoveries can run together; first-image loss fences nonfirst redraws',async t=>{
 const f=await productionFixture(t);f.control.hold=false;const id=await f.create(4);await until(async()=>(await f.read(id)).state==='completed');
 await lose(f,id,1);let s=await lose(f,id,2);f.control.hold=true;const a=s.faults.find(f=>f.page===1),b=s.faults.find(f=>f.page===2);
 await Promise.all([recover(f,id,a),recover(f,id,b)]);await until(()=>f.control.calls.length===6);s=await f.read(id);assert.equal(s.state,'running');assert.equal(s.faults.length,2);
 f.control.hold=false;for(const call of f.control.calls)call.resolve();await until(async()=>(await f.read(id)).state==='completed');
 await lose(f,id,0);s=await lose(f,id,1);const before=f.control.calls.length;
 assert.equal((await f.request(`sessions/${id}/recover`,'POST',{requestId:crypto.randomUUID(),faultId:s.faults.find(f=>f.page===1).id})).status,409);assert.equal(f.control.calls.length,before);
});
test('control request replay cannot undo a later pause; concurrent fault grants spend only once across restart',async t=>{
 const f=await productionFixture(t),id=await f.create(2);await until(()=>f.control.calls.length===1);f.control.calls[0].reject(Error('controlled failure'));await until(async()=>(await f.read(id)).state==='failed');
 const requestId=crypto.randomUUID();await f.json(`sessions/${id}/production-control`,'POST',{requestId,action:'resume'});await f.json(`sessions/${id}/production-control`,'POST',{action:'pause'});
 await f.json(`sessions/${id}/production-control`,'POST',{requestId,action:'resume'});assert.equal((await f.read(id)).generationControl,'paused');assert.equal(f.control.calls.length,1);
 await f.json(`sessions/${id}/production-control`,'POST',{action:'resume'});const fault=(await f.read(id)).faults[0],grant=crypto.randomUUID();
 const results=await Promise.all([f.request(`sessions/${id}/recover`,'POST',{requestId:grant,faultId:fault.id}),f.request(`sessions/${id}/recover`,'POST',{requestId:crypto.randomUUID(),faultId:fault.id})]);assert.deepEqual(results.map(r=>r.status).sort(),[202,409]);
 f.control.hold=false;await until(async()=>(await f.read(id)).state==='completed');await f.restart();const before=f.control.calls.length;
 if(results[0].ok)await recover(f,id,fault,grant);await f.app.services.production.tick();assert.equal(f.control.calls.length,before);
 await assert.rejects(f.app.services.production.recover('foreign',id,{requestId:grant,faultId:fault.id}),error=>error.status===404);
});

test('checking a restored anchor settles only its pre-inference dependent failure and completes without a retry',async t=>{
 const f=await productionFixture(t,'codex',{SHIQU_IMAGE_WORKERS:'1'}),id=await f.create(4);await until(()=>f.control.calls.length===1);f.control.calls[0].resolve();await until(()=>f.control.calls.length===2);
 const image=(await f.read(id)).story.pages[0].image,key=`reader/${id}/${image.split(`/media/${id}/`)[1]}`,asset=await f.media.get(key),bytes=new Uint8Array(await asset.arrayBuffer());await rm(path.join(f.dataDirectory,'media',key));
 f.control.calls[1].resolve();await until(async()=>(await f.read(id)).state==='failed');assert.equal(f.control.calls.length,2);
 await f.media.put(key,bytes,{contentType:asset.contentType});f.control.hold=false;await f.json(`sessions/${id}/image-health`,'POST',{page:0,image});await until(async()=>(await f.read(id)).state==='completed');
 assert.equal(f.control.calls.length,4);assert.deepEqual((await f.app.services.production.queue.jobs(id,'docker-local-owner')).filter(j=>j.state==='failed'),[]);
});
test('restoring a file after a new ordinary redraw failure preserves its fault until an explicit free reuse',async t=>{
 const f=await productionFixture(t);f.control.hold=false;const id=await f.create(2);await until(async()=>(await f.read(id)).state==='completed');
 const image=(await f.read(id)).story.pages[1].image,key=`reader/${id}/${image.split(`/media/${id}/`)[1]}`,asset=await f.media.get(key),bytes=new Uint8Array(await asset.arrayBuffer());let s=await lose(f,id,1);f.control.hold=true;await recover(f,id,s.faults[0]);await until(()=>f.control.calls.length===3);f.control.calls[2].reject(Error('new ordinary redraw failure'));await until(async()=>(await f.read(id)).state==='failed');
 await f.media.put(key,bytes,{contentType:asset.contentType});s=await f.json(`sessions/${id}/image-health`,'POST',{page:1,image});assert.equal(s.faults.length,1,'Checking a file does not acknowledge an ordinary model failure');const fault=s.faults[0];
 await recover(f,id,fault);await until(async()=>(await f.read(id)).state==='completed');assert.equal(f.control.calls.length,3);assert.deepEqual((await f.app.services.production.queue.jobs(id,'docker-local-owner')).filter(j=>j.state==='failed'),[]);
});

test('creation binds immutable parameters and request IDs cannot be reused across actions',async t=>{
 const f=await productionFixture(t),id=await f.create(2);const changed=await f.request('sessions','POST',{requestId:id,selection:{bookId:'zhuangzi',theme:'different',length:2}});assert.equal(changed.status,409);
 await f.json(`sessions/${id}/production-control`,'POST',{action:'pause'});assert.equal((await f.request(`sessions/${id}/production-control`,'POST',{requestId:id,action:'resume'})).status,409);
 const requestId=crypto.randomUUID();await f.json(`sessions/${id}/production-control`,'POST',{requestId,action:'pause'});
 assert.equal((await f.request('sessions','POST',{requestId,selection:{bookId:'zhuangzi',theme:'different',length:2}})).status,409);assert.equal((await f.json('sessions')).length,1);
});

for(const action of ['pause','stop','reader'])test(`healthy restored files complete locally with ${action} and no viewers`,async t=>{
 const f=await productionFixture(t);f.control.hold=false;const id=await f.create(2);await until(async()=>(await f.read(id)).state==='completed');
 const image=(await f.read(id)).story.pages[1].image,key=`reader/${id}/${image.split(`/media/${id}/`)[1]}`,asset=await f.media.get(key),bytes=new Uint8Array(await asset.arrayBuffer());await lose(f,id,1);
 await f.json(`sessions/${id}/production-control`,'POST',{action});await f.media.put(key,bytes,{contentType:asset.contentType});const checked=await f.json(`sessions/${id}/image-health`,'POST',{page:1,image});assert.equal(checked.state,'completed');assert.equal(checked.generationControl,action==='pause'?'paused':action==='stop'?'stopped':'active');assert.equal(f.control.calls.length,2);
 const raw=await f.app.services.database.prepare('SELECT state FROM reader_sessions WHERE id=?').bind(id).first();assert.equal(raw.state,'completed');
 await f.app.services.database.prepare("UPDATE reader_sessions SET state='idle' WHERE id=?").bind(id).run();await f.restart();await until(async()=>(await f.read(id)).state==='completed');assert.equal(f.control.calls.length,2);
});
test('a display-title change during publication cannot fail the already-paid image',async t=>{
 const f=await productionFixture(t),id=await f.create(2),database=f.app.services.database,prepare=database.prepare.bind(database);let renamed=false;
 database.prepare=sql=>{const statement=prepare(sql);if(!renamed&&sql.includes("UPDATE reader_sessions SET document=json_set(document,?, ?, '$.usage'")){const run=statement.run.bind(statement);statement.run=async()=>{renamed=true;await prepare("UPDATE reader_sessions SET selection=json_set(selection,'$.displayTitle','发布时改名') WHERE id=?").bind(id).run();return run();};}return statement;};
 f.control.hold=false;await until(async()=>(await f.read(id)).state==='completed');assert.equal(renamed,true);assert.equal(f.control.calls.length,2);assert.equal((await f.read(id)).story.title,'发布时改名');assert.equal((await f.read(id)).faults,undefined);
});

test('an old-name failed publication keeps and republishes its paid receipt after upgrading without another draw',async t=>{
 const {DatabaseSync}=await import('node:sqlite'),{inputVersion,productionJobId}=await import('../server/production-queue.ts');
 const f=await productionFixture(t),id=await f.create(2),get=f.app.services.media.get.bind(f.app.services.media);
 f.app.services.media.get=async key=>key.startsWith(`reader/${id}/artifacts/1-`)?Promise.reject(Error('old publication read failed')):get(key);
 f.control.hold=false;await until(async()=>(await f.read(id)).state==='failed');assert.equal(f.control.calls.length,2);const oldFault=(await f.read(id)).faults[0];await f.stop();
 const db=new DatabaseSync(path.join(f.dataDirectory,'shiqu.sqlite')),row=db.prepare('SELECT * FROM reader_sessions WHERE id=?').get(id),doc=JSON.parse(row.document),selection=JSON.parse(row.selection),named={...selection,displayTitle:'A'};
 const version=inputVersion({scriptVersion:inputVersion({selection:named}),plan:doc.plan,style:selection.artStyle,prompt:selection.productionPrompt}),jobs=db.prepare("SELECT * FROM production_jobs WHERE session_id=? AND kind IN ('image','image-publish') AND json_extract(payload,'$.page')=1").all(id),mapping=new Map();
 for(const job of jobs)mapping.set(job.id,productionJobId(id,job.kind,version,'1'));
 for(const job of jobs)db.prepare('UPDATE production_jobs SET id=?,version=?,dependencies=? WHERE id=?').run(mapping.get(job.id),version,JSON.stringify(JSON.parse(job.dependencies).map(id=>mapping.get(id)||id)),job.id);
 db.prepare('UPDATE reader_faults SET job_id=?,version=? WHERE id=?').run(mapping.get(jobs.find(j=>j.kind==='image-publish').id),version,oldFault.id);
 db.prepare("UPDATE reader_sessions SET selection=?,generation_control='paused' WHERE id=?").run(JSON.stringify({...selection,displayTitle:'B'}),id);
 db.prepare("DELETE FROM app_migrations WHERE name='0016_legacy_input_faults.sql'").run();db.close();
 await f.restart();let saved=await f.read(id);assert.equal(saved.faults[0].stage,'publication');await f.app.services.production.tick();assert.equal(f.control.calls.length,2);
 await f.json(`sessions/${id}/production-control`,'POST',{action:'resume'});await recover(f,id,saved.faults[0]);await until(async()=>(await f.read(id)).state==='completed');saved=await f.read(id);assert.equal(saved.story.title,'B');assert.equal(saved.ready,2);assert.equal(f.control.calls.length,2);assert.equal(saved.faults,undefined);
});

test('an uncertain reference read cannot reach a provider that has a separately readable media handle',async t=>{
 const f=await productionFixture(t,'codex',{SHIQU_IMAGE_WORKERS:'1'}),id=await f.create(4);await until(()=>f.control.calls.length===1);f.control.calls[0].resolve();await until(()=>f.control.calls.length===2);
 const image=(await f.read(id)).story.pages[0].image,key=`reader/${id}/${image.split(`/media/${id}/`)[1]}`,get=f.app.services.media.get.bind(f.app.services.media);f.app.services.media.get=async value=>{if(value===key)throw Error('temporarily cannot verify reference');return get(value);};
 f.control.calls[1].resolve();await until(async()=>(await f.read(id)).state==='failed');const s=await f.read(id);assert.equal(s.retryStage,'generation');assert.equal(f.control.calls.length,2,'Unknown upstream readability must stop before inference');
 f.app.services.media.get=get;f.control.hold=false;await recover(f,id,s.faults[0]);await until(async()=>(await f.read(id)).state==='completed');assert.equal(f.control.calls.length,4);
});
