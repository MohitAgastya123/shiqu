// Verify the public command protocol over a real loopback HTTP connection, using the production
// application, queue, SQLite and file store with controlled adapters and disposable story data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {productionFixture,until,selection} from './fixtures/production.mjs';

test('lost HTTP recovery reply, restart and old replay cannot buy another attempt or revive a paused version',async t=>{
 const f=await productionFixture(t),server=createServer(async(req,res)=>{
  try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=chunks.length?Buffer.concat(chunks):undefined;
   const response=await f.app.handle(new Request(`http://127.0.0.1${req.url}`,{method:req.method,headers:{'Content-Type':'application/json'},body}));
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
 const origin=`http://127.0.0.1:${server.address().port}/api/reader/`,request=(path,body)=>fetch(origin+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const id=crypto.randomUUID(),create={requestId:id,selection:{...selection,length:2}};assert.equal((await request('sessions',create)).status,201);assert.equal((await request('sessions',create)).status,201);
 await until(()=>f.control.calls.length===1);f.control.calls[0].reject(Error('controlled first failure'));await until(async()=>(await f.read(id)).state==='failed');
 const first=(await(await request(`sessions/${id}`)).json()).faults[0],command={requestId:crypto.randomUUID(),faultId:first.id};
 // Consume the request, deliberately discard its response, then observe the new ordinary failure.
 await(await request(`sessions/${id}/recover`,command)).arrayBuffer();await until(()=>f.control.calls.length===2);f.control.calls[1].reject(Error('controlled second failure'));await until(async()=>(await f.read(id)).state==='failed');
 await f.restart();const replay=await(await request(`sessions/${id}/recover`,command)).json();assert.equal(replay.recoveryReceipt.status,'failed');assert.equal(f.control.calls.length,2);
 const fault=replay.faults[0];assert.notEqual(fault.id,first.id);f.control.hold=false;
 assert.equal((await request(`sessions/${id}/recover`,{requestId:crypto.randomUUID(),faultId:fault.id})).status,202);await until(async()=>(await f.read(id)).state==='completed');assert.equal(f.control.calls.length,4);
 const snapshot=await(await request(`sessions/${id}/revisions`)).json(),child=crypto.randomUUID(),revision={requestId:child,token:snapshot.token,changes:{artStyle:'paper-cut'}};
 assert.equal((await request(`sessions/${id}/revisions`,revision)).status,201);assert.equal((await request(`sessions/${child}/production-control`,{requestId:crypto.randomUUID(),action:'pause'})).status,200);
 const repeated=await(await request(`sessions/${id}/revisions`,revision)).json();assert.equal(repeated.id,child);assert.equal(repeated.generationControl,'paused');assert.equal((await(await request('sessions')).json()).length,1);
});
