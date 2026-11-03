// Protect poll snapshot reuse: identical data keeps old references so React state setters skip renders.
import test from 'node:test';
import assert from 'node:assert/strict';
import {keepSnapshot,sameSnapshot,shareRows} from '../lib/reader-snapshots.ts';

test('identical poll rows return the previous array',()=>{
 const previous=[{id:'a',page:1,story:{pages:[{image:'/a.webp'}]}},{id:'b',page:0}];
 const next=JSON.parse(JSON.stringify(previous));
 assert.equal(shareRows(previous,next,row=>row.id),previous);
});

test('changed rows are replaced while unchanged rows keep their identity',()=>{
 const previous=[{id:'a',page:1},{id:'b',page:0}];
 const next=[{id:'a',page:2},{id:'b',page:0}];
 const shared=shareRows(previous,next,row=>row.id);
 assert.notEqual(shared,previous);
 assert.equal(shared[0],next[0]);
 assert.equal(shared[1],previous[1]);
});

test('reordered, added and removed rows produce a new array',()=>{
 const a={id:'a'},b={id:'b'};
 const reordered=shareRows([a,b],[{id:'b'},{id:'a'}],row=>row.id);
 assert.deepEqual(reordered,[b,a]);assert.equal(reordered[0],b);
 assert.equal(shareRows([a,b],[{id:'a'}],row=>row.id).length,1);
 assert.equal(shareRows([a],[{id:'a'},{id:'b'}],row=>row.id).length,2);
});

test('single snapshots keep the previous value only when equal',()=>{
 const old={id:'s',state:'running'};
 assert.equal(keepSnapshot(old,{id:'s',state:'running'}),old);
 const changed={id:'s',state:'completed'};
 assert.equal(keepSnapshot(old,changed),changed);
 assert.equal(keepSnapshot(null,changed),changed);
 assert.equal(sameSnapshot(undefined,undefined),true);
});
