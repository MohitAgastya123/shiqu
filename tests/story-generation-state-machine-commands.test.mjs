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
