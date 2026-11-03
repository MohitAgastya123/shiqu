// Probe the actual migration/queue/receipt path with isolated SQLite and controlled work.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {ProductionQueue} from '../server/production-queue.ts';
import {authorizeRecovery,sessionFaults,commandReceipt} from '../server/reader-commands.ts';

function fixture(t){
 const sqlite=new DatabaseSync(':memory:');for(const name of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+name,'utf8'));t.after(()=>sqlite.close());
 const db={prepare(sql){const q=sqlite.prepare(sql);let args=[];return {bind(...values){args=values;return this;},async first(){return q.get(...args)||null;},async all(){return {results:q.all(...args)};},async run(){return {meta:{changes:Number(q.run(...args).changes)}};}};}};
 let fail=true,calls=0;
 const queue=new ProductionQueue(db,{limits:{image:1},handlers:{image:{pool:'image',async run(){calls++;if(fail)throw Error('controlled failure');return {value:'image'};}}}});
 const spec={id:'work',sessionId:'story',ownerId:'owner',kind:'image',pool:'image',version:'v1',dependencies:[],payload:{page:2},priority:0};
 return {sqlite,db,queue,spec,get calls(){return calls;},succeed(){fail=false;}};
}
test('one durable recovery command cannot pay again after its response is lost and work fails again',async t=>{
 const f=fixture(t);await f.queue.enqueue(f.spec);await f.queue.pump();await f.queue.settle();
 const first=(await sessionFaults(f.db,'story','owner'))[0];assert.equal(first.state,'pending');assert.equal(f.calls,1);
 const command={ownerId:'owner',sessionId:'story',requestId:crypto.randomUUID(),faultId:first.id,jobs:['work'],resolutionJob:'work'};
 const accepted=await authorizeRecovery(f.db,command);assert.equal(accepted.status,'queued');
 assert.equal((await f.queue.job('work')).attempts,0);assert.equal((await sessionFaults(f.db,'story','owner'))[0].state,'recovering');
 await f.queue.pump();await f.queue.settle();assert.equal(f.calls,2);
 const second=(await sessionFaults(f.db,'story','owner'))[0];assert.notEqual(second.id,first.id);assert.equal(second.state,'pending');
 assert.equal((await authorizeRecovery(f.db,command)).status,'failed');
 await f.queue.pump();await f.queue.settle();assert.equal(f.calls,2);assert.equal((await f.queue.job('work')).state,'failed');
 f.succeed();await authorizeRecovery(f.db,{...command,requestId:crypto.randomUUID(),faultId:second.id});
 await f.queue.pump();await f.queue.settle();assert.equal(f.calls,3);assert.deepEqual(await sessionFaults(f.db,'story','owner'),[]);
 assert.equal((await commandReceipt(f.db,'owner',command.requestId)).status,'failed');
});
test('two different commands cannot claim the same failure, and mismatched replay is rejected',async t=>{
 const f=fixture(t);await f.queue.enqueue(f.spec);await f.queue.pump();await f.queue.settle();
 const fault=(await sessionFaults(f.db,'story','owner'))[0],body={ownerId:'owner',sessionId:'story',faultId:fault.id,jobs:['work'],resolutionJob:'work'};
 const ids=[crypto.randomUUID(),crypto.randomUUID()];
 const result=await Promise.allSettled(ids.map(requestId=>authorizeRecovery(f.db,{...body,requestId})));
 assert.equal(result.filter(r=>r.status==='fulfilled').length,1);
 assert.equal((await f.queue.job('work')).attempts,0);
 const used=result.findIndex(r=>r.status==='fulfilled');
 await assert.rejects(authorizeRecovery(f.db,{...body,requestId:ids[used],redraw:true}),error=>error.status===409);
});

test('migration removes display title from existing identities without resetting paid receipts or failures',async t=>{
 const {migrate}=await import('../server/database.ts'),{selectionSchema}=await import('../lib/reader-model.ts'),{inputVersion,productionJobId}=await import('../server/production-queue.ts');
 const sqlite=new DatabaseSync(':memory:');t.after(()=>sqlite.close());sqlite.exec('CREATE TABLE app_migrations(name TEXT PRIMARY KEY,applied_at TEXT NOT NULL)');
 for(const name of readdirSync('drizzle').filter(f=>f.endsWith('.sql')&&f<'0014').sort()){sqlite.exec(readFileSync('drizzle/'+name,'utf8'));sqlite.prepare('INSERT INTO app_migrations VALUES(?,?)').run(name,'before');}
 const selection=selectionSchema.parse({bookId:'zhuangzi',theme:'测试',displayTitle:'用户显示名',length:1}),plan={title:'原题',pages:[{caption:'已保存旁白',prompt:'原有画面'}]},doc={plan,images:['/saved.png'],audio:[],usage:[]};
 sqlite.prepare("INSERT INTO reader_sessions(id,user_id,selection,document,state,created_at,updated_at) VALUES('story','owner',?,?,'idle','created','updated')").run(JSON.stringify(selection),JSON.stringify(doc));
 const oldScript=inputVersion({selection}),oldVersion=inputVersion({scriptVersion:oldScript,plan,style:selection.artStyle,prompt:selection.productionPrompt}),{displayTitle:_,...input}=selection;
 const nextScript=inputVersion({selection:input}),nextVersion=inputVersion({scriptVersion:nextScript,plan,style:selection.artStyle,prompt:selection.productionPrompt});
 const oldId=productionJobId('story','image',oldVersion,'0'),nextId=productionJobId('story','image',nextVersion,'0');
 sqlite.prepare("INSERT INTO production_jobs(id,session_id,owner_id,kind,pool,version,dependencies,payload,result,state,attempts,created_at,updated_at) VALUES(?,'story','owner','image','image',?,'[]','{\"page\":0}','{\"value\":\"/paid.png\"}','succeeded',2,1,2)").run(oldId,oldVersion);
 sqlite.prepare("INSERT INTO production_jobs(id,session_id,owner_id,kind,pool,version,dependencies,payload,state,created_at,updated_at) VALUES('publication','story','owner','image-publish','local',?,?,'{\"page\":0}','queued',1,2)").run(oldVersion,JSON.stringify([oldId]));
 sqlite.prepare("UPDATE production_jobs SET state='failed',error='saved failure' WHERE id='publication'").run();
 const fault=sqlite.prepare("SELECT * FROM reader_faults WHERE job_id='publication'").get();migrate(sqlite,process.cwd());
 const saved=sqlite.prepare('SELECT * FROM production_jobs WHERE id=?').get(nextId);assert.equal(saved.attempts,2);assert.equal(saved.result,'{"value":"/paid.png"}');assert.equal(saved.state,'succeeded');
 const publication=sqlite.prepare("SELECT * FROM production_jobs WHERE kind='image-publish'").get();assert.deepEqual(JSON.parse(publication.dependencies),[nextId]);assert.equal(publication.state,'failed');
 const history=sqlite.prepare('SELECT * FROM reader_faults WHERE id=?').get(fault.id);assert.equal(history.job_id,publication.id);assert.equal(history.version,nextVersion);assert.equal(history.message,fault.message);
 migrate(sqlite,process.cwd());assert.equal(sqlite.prepare('SELECT count(*) AS n FROM production_jobs').get().n,2);
});

test('restarting an accepted recovery shares its three interrupted attempts; replay cannot reset the cap',async t=>{
 const f=fixture(t);await f.queue.enqueue(f.spec);await f.queue.pump();await f.queue.settle();const fault=(await sessionFaults(f.db,'story','owner'))[0];
 const command={ownerId:'owner',sessionId:'story',requestId:crypto.randomUUID(),faultId:fault.id,jobs:['work'],resolutionJob:'work'};await authorizeRecovery(f.db,command);
 const restarted=new ProductionQueue(f.db,{limits:{image:1},handlers:{image:{pool:'image',run:async()=>assert.fail('No new remote call in recovery audit')}},resumeInterrupted:async job=>job.attempts<3});
 for(let attempt=1;attempt<=3;attempt++){
  f.sqlite.prepare("UPDATE production_jobs SET state='running',attempts=?,lease_token='dead-runtime',lease_until=1 WHERE id='work'").run(attempt);
  await restarted.recoverExpired();const job=await restarted.job('work');assert.equal(job.attempts,attempt);assert.equal(job.state,attempt<3?'queued':'failed');
  await authorizeRecovery(f.db,command);assert.equal((await restarted.job('work')).attempts,attempt);
 }
 assert.equal((await commandReceipt(f.db,'owner',command.requestId)).status,'failed');assert.equal(f.calls,1);
});
