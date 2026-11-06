// Isolated fixtures verify the real production flow while adapter contracts remain fast to run separately.
import test from 'node:test';

import assert from 'node:assert/strict';

import {productionFixture,until} from './fixtures/production.mjs';

test('Gemini task effort survives real queued review checkpoints alongside existing usage',async t=>{
 const f=await productionFixture(t,'gemini'),id=await f.createLegacyReader();
 await f.demand(id);await until(()=>f.control.calls.length===1);
 const row=await f.app.services.database.prepare('SELECT document FROM stories WHERE id=?').bind(id).first();
 const doc=JSON.parse(row.document),review=doc.usage.find(entry=>entry.step==='review:0');
 assert.equal(review.reasoningEffort,'high');assert.deepEqual(review.usage,{calls:1});
});
