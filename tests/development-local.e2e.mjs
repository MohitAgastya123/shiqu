// Start the actual pnpm development command with disposable homes, settings and shelves.
// Fake configured providers are observed only through status; no inference is requested.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {savedStartupState} from './fixtures/startup.mjs';
import {checkoutFixture,startDevelopment,assertStopped,saveGoogle} from './fixtures/development.mjs';
const fixtureKey='test-only-saved-google-key';

test('dev uses saved Google settings and ignores conflicting project .env without changing the saved profile',{timeout:45000},async t=>{
 const f=await checkoutFixture(t);saveGoogle(f);const before=await savedStartupState(f),poisoned=path.join(f.root,'dotenv-must-not-open');
 await writeFile(path.join(f.checkout,'.env'),`SHIQU_AI_PROVIDER=codex\nGEMINI_API_KEY=wrong-dotenv-key\nGEMINI_TEXT_MODEL=wrong-text\nGEMINI_IMAGE_MODEL=wrong-image\nSHIQU_REASONING_PLAN=low\nSHIQU_DATA_DIR=${JSON.stringify(poisoned)}\n`);
 const server=await startDevelopment(t,f),response=await fetch(server.origin+'/api/reader/status'),status=await response.json();
 assert.equal(response.status,200);assert.equal(status.provider,'gemini');assert.equal(status.configured,true);assert.equal(status.models.text,'saved-google-text');assert.equal(status.models.image,'saved-google-image');assert.equal(status.taskReasoningEfforts.plan,'medium');assert.equal(status.taskReasoningEfforts.frames,'high');
 assert.ok(!JSON.stringify(status).includes(fixtureKey));assert.ok(!server.output().includes(fixtureKey));assert.ok(server.output().includes(f.locations.library));assert.ok(existsSync(path.join(f.locations.library,'shiqu.sqlite')));assert.equal(existsSync(poisoned),false);
 await assertStopped(server);assert.deepEqual(await savedStartupState(f),before);
});

test('dev shell overrides saved Google configuration only for the current invocation',{timeout:45000},async t=>{
 const f=await checkoutFixture(t);saveGoogle(f);const before=await savedStartupState(f),library=path.join(f.root,'explicit-shelf');
 const server=await startDevelopment(t,f,{variables:{SHIQU_AI_PROVIDER:'readonly',SHIQU_DATA_DIR:library}});
 const status=await (await fetch(server.origin+'/api/reader/status')).json();assert.equal(status.provider,'readonly');assert.equal(status.configured,false);assert.ok(server.output().includes(library));assert.ok(existsSync(path.join(library,'shiqu.sqlite')));assert.equal(existsSync(f.locations.library),false);
 await assertStopped(server);assert.deepEqual(await savedStartupState(f),before);
});

test('STORY-LIFECYCLE-C007: pnpm dev local ignores shared data settings and denies private database downloads',{timeout:45000},async t=>{
 const f=await checkoutFixture(t),store=f.store();store.save({provider:'readonly',providerConfigured:true});store.close();const before=await savedStartupState(f);
 const sentinel=path.join(f.root,'must-not-open'),local=path.join(f.checkout,'.data/dev-local');
 const server=await startDevelopment(t,f,{local:true,variables:{SHIQU_DATA_DIR:sentinel}});
 assert.ok(server.output().includes(local));assert.ok(existsSync(path.join(local,'shiqu.sqlite')));assert.equal(existsSync(sentinel),false);
 assert.equal((await (await fetch(server.origin+'/api/reader/status')).json()).provider,'readonly');
 for(const route of ['/.data/dev-local/shiqu.sqlite','/.data/dev-local/shiqu.sqlite?raw','/@fs/'+path.join(local,'shiqu.sqlite')])assert.ok([403,404].includes((await fetch(server.origin+route)).status));
 await assertStopped(server);assert.deepEqual(await savedStartupState(f),before);
 const run=process.env.SHIQU_E2E_RUN_ID||new Date().toISOString().replace(/[:.]/g,'-')+'-'+process.pid,directory=path.resolve('.data/e2e',run,'C007');await mkdir(directory,{recursive:true});
 await writeFile(path.join(directory,'startup.log'),server.output());
 await writeFile(path.join(directory,'result.json'),JSON.stringify({caseId:'C007',result:'PASS',build:process.env.SHIQU_E2E_BUILD_ID||'development',database:path.join(local,'shiqu.sqlite'),deniedPrivateFiles:true,ignoredSharedDirectory:true,releasedPorts:true},null,2));
});
