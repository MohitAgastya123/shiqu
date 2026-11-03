// Exercise in-place discovery edits through the production API, including stale and late writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {productionFixture,until,selection} from './fixtures/production.mjs';
import {libraryFixture} from './fixtures/story-library.mjs';
import {indexBookContents} from '../server/local-book-contents.ts';

const conditions={bookId:'other',customBook:'测试书籍',theme:'新的主题',productionPrompt:'新的讲述重点'};
const candidate={stories:[{title:'旧候选',description:'一次完整的经历。'}],note:''};
async function fixture(t){
 const f=await productionFixture(t),library=libraryFixture();f.app.services.localBooks=library.books;
 f.generation.suggestions=async()=>structuredClone(candidate);
 const saved=await f.json('sessions','POST',{requestId:crypto.randomUUID(),intake:true,selection:{...selection,storyTitle:undefined}});
 const edit=(patch={},snapshot=saved,requestId=crypto.randomUUID())=>({requestId,generation:snapshot.intake.generation,action:'conditions',conditions:{...conditions,...patch}});
 return {...f,id:saved.id,saved,edit,library};
}
test('discovery edits keep the task identity, shelf count and settings while validating source receipts',async t=>{
 const f=await fixture(t),before=await f.json('sessions');
 const sources=indexBookContents(f.library.books,f.library.book).entries.map(entry=>entry.source);
 const edited=await f.json(`sessions/${f.id}/setup`,'POST',f.edit({bookId:'zhuangzi',customBook:undefined,discoverySources:sources}));
 assert.equal(edited.id,f.id);assert.equal(edited.createdAt,f.saved.createdAt);assert.equal((await f.json('sessions')).length,before.length);
 assert.equal(edited.selection.bookId,'zhuangzi');assert.deepEqual(edited.selection.discoverySources,sources);assert.equal(edited.selection.theme,conditions.theme);
 for(const key of ['artStyle','acceptancePrompt','narrativeDetail'])assert.deepEqual(edited.selection[key],f.saved.selection[key]);
 assert.equal(edited.intake.search.state,'idle');assert.deepEqual(edited.intake.batches,[]);assert.equal(f.control.plans.length,0);assert.equal(f.control.calls.length,0);
 const cleared=await f.json(`sessions/${f.id}/setup`,'POST',f.edit({},edited));
 assert.equal(cleared.selection.bookId,'other');assert.equal(cleared.selection.customBook,conditions.customBook);assert.equal(cleared.selection.discoverySources,undefined);
 await f.restart();assert.equal((await f.read(f.id)).selection.theme,conditions.theme);assert.equal((await f.json('sessions')).length,before.length);
});
test('discovery edits reject forged source receipts without altering the saved task',async t=>{
 const f=await fixture(t),source=f.library.stories[0].source;
 const result=await f.request(`sessions/${f.id}/setup`,'POST',f.edit({bookId:'zhuangzi',discoverySources:[{...source,edition:'b'.repeat(64)}]}));
 assert.equal(result.status,400);assert.deepEqual((await f.read(f.id)).selection,f.saved.selection);
 assert.equal((await f.read(f.id)).intake.generation,f.saved.intake.generation);assert.equal((await f.json('sessions')).length,1);
});
test('discovery edit replay and competing updates cannot create duplicates or overwrite a newer edit',async t=>{
 const f=await fixture(t),command=f.edit(),competing=f.edit({theme:'另一个主题'});
 const [first,second]=await Promise.all([f.request(`sessions/${f.id}/setup`,'POST',command),f.request(`sessions/${f.id}/setup`,'POST',competing)]);
 assert.deepEqual([first.status,second.status].sort(),[200,409]);
 const winner=first.ok?command:competing,current=await f.read(f.id);
 assert.equal((await f.json(`sessions/${f.id}/setup`,'POST',winner)).intake.generation,current.intake.generation);
 const conflict=await f.request(`sessions/${f.id}/setup`,'POST',f.edit({theme:'过期编辑'}));assert.equal(conflict.status,409);
 const noop=await f.json(`sessions/${f.id}/setup`,'POST',f.edit({theme:current.selection.theme},current));
 assert.equal(noop.intake.generation,current.intake.generation);assert.equal((await f.json('sessions')).length,1);
});
test('late extraction results and stale candidate choices cannot reappear after discovery conditions change',async t=>{
 const f=await fixture(t);let release;
 f.generation.suggestions=async()=>{await new Promise(resolve=>release=resolve);return candidate;};
 await f.startDiscovery(f.id);await f.demand(f.id);await until(()=>release);
 const old=await f.read(f.id),edited=await f.json(`sessions/${f.id}/setup`,'POST',f.edit({},old));
 release();await f.app.services.production.queue.settle();await f.app.services.production.tick();
 const current=await f.read(f.id);assert.equal(current.id,f.id);assert.equal(current.intake.generation,edited.intake.generation);assert.deepEqual(current.intake.batches,[]);assert.equal(current.intake.search.state,'idle');
 const stale=await f.request(`sessions/${f.id}/setup`,'POST',{action:'choose',batch:0,index:0,requestId:crypto.randomUUID(),generation:old.intake.generation});assert.equal(stale.status,409);
 assert.equal((await f.json('sessions')).length,1);
});
test('conditions cannot replace a story that has already been selected',async t=>{
 const f=await fixture(t);f.control.hold=false;
 await f.startDiscovery(f.id);await f.demand(f.id);await until(async()=>(await f.read(f.id)).intake.batches.length);
 const saved=await f.read(f.id);
 await f.json(`sessions/${f.id}/setup`,'POST',{action:'choose',batch:0,index:0,requestId:crypto.randomUUID(),generation:saved.intake.generation});
 const current=await f.read(f.id),result=await f.request(`sessions/${f.id}/setup`,'POST',f.edit({},current));
 assert.equal(result.status,409);assert.deepEqual((await f.read(f.id)).selection,current.selection);
});
