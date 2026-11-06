// 使用隔离夹具验证真实生产流程，保持适配器契约可独立快速运行。
import test from 'node:test';

import assert from 'node:assert/strict';

import {productionFixture,until} from './fixtures/production.mjs';

test('production queue draws every frame through the separate image provider and keeps text on the text provider',async t=>{
 const f=await productionFixture(t,'codex',{},{imageProvider:'gemini'}),id=await f.createLegacyReader();
 f.control.hold=false;await f.demand(id);await until(async()=>(await f.read(id)).ready===7);
 assert.equal(f.control.calls.length,7);assert.ok(f.control.calls.every(call=>call.via==='gemini'));
 assert.deepEqual([...f.control.textVia],['codex']);assert.equal(f.control.plans.length,1);
});
