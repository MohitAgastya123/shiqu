// Verify English runtime messages while preserving source/content fixtures.
// Exercise configuration precedence through real isolated CLI processes and explicit provider/library tables.
import test from 'node:test';

import assert from 'node:assert/strict';

import {mkdir,writeFile,access} from 'node:fs/promises';

import path from 'node:path';

import {DatabaseSync} from 'node:sqlite';

import {cliConfiguration} from '../server/cli-options.ts';

import {cliProviderConfiguration} from '../server/cli-setup.ts';

import {settingsFixture,savedStartupState,fixtureBytes} from './fixtures/startup.mjs';

const providers=process.platform==='win32'?['gemini','openai','readonly']:['gemini','openai','codex','readonly'];

for(const saved of providers)for(const override of [undefined,...providers])for(const keySource of ['saved','explicit','empty','unrelated']){
 test(`provider matrix: saved=${saved}, override=${override||'none'}, key=${keySource}`,async t=>{
  const f=await settingsFixture(t),store=f.store();t.after(()=>store.close());
  store.save({provider:'gemini',providerConfigured:true},{provider:'gemini',value:'test-only-saved-gemini'});
  store.save({provider:'openai'},{provider:'openai',value:'test-only-saved-openai'});store.save({provider:saved});
  const active=override||saved,isApi=['gemini','openai'].includes(active),keyName=active==='openai'?'OPENAI_API_KEY':'GEMINI_API_KEY';
  const variables={...(override?{SHIQU_AI_PROVIDER:override}:{}),...(keySource==='explicit'?{[keyName]:'test-only-explicit'}:keySource==='empty'?{[keyName]:''}:keySource==='unrelated'?{[active==='openai'?'GEMINI_API_KEY':'OPENAI_API_KEY']:'test-only-wrong-provider'}:{})};
  const before={settings:store.settings(),revision:store.revision(),gemini:store.key('gemini'),openai:store.key('openai')};
  let questions=0;const prompt={text:async()=>{questions++;throw Error('SETUP_REQUIRED');},secret:async()=>assert.fail('unexpected secret input')};
  if(isApi&&keySource==='empty')await assert.rejects(cliProviderConfiguration(store,variables,prompt),/SETUP_REQUIRED/);
  else{const effective=await cliProviderConfiguration(store,variables,prompt);assert.equal(effective.SHIQU_AI_PROVIDER,active);if(isApi)assert.equal(effective[keyName],keySource==='explicit'?'test-only-explicit':'test-only-saved-'+active);}
  assert.equal(questions,isApi&&keySource==='empty'?1:0);
  assert.deepEqual({settings:store.settings(),revision:store.revision(),gemini:store.key('gemini'),openai:store.key('openai')},before);
 });
}

for(const source of ['saved','legacy','default','prompt','unconfirmed'])test('library discovery matrix: '+source,async t=>{
 const f=await settingsFixture(t),legacy=path.join(f.root,'legacy shelf'),saved=path.join(f.root,'saved shelf');let questions=0;
 if(source==='saved'||source==='unconfirmed'){const store=f.store();store.save({dataDirectory:saved,libraryConfigured:source==='saved'});store.close();}
 if(source==='saved'||source==='legacy'){await mkdir(path.dirname(f.locations.cliSelection),{recursive:true});await writeFile(f.locations.cliSelection,JSON.stringify({dataDirectory:legacy}));}
 if(source==='default'){await mkdir(f.locations.library,{recursive:true});const db=new DatabaseSync(path.join(f.locations.library,'shiqu.sqlite'));db.close();}
 const legacyBefore=await fixtureBytes(f.locations.cliSelection);
 const result=await cliConfiguration({},{home:f.home,variables:f.env,cwd:f.root,ask:async()=>{questions++;return 'chosen shelf';}});
 assert.equal(result.SHIQU_DATA_DIR,source==='saved'?saved:source==='legacy'?legacy:source==='default'?f.locations.library:path.join(f.root,'chosen shelf'));
 assert.equal(questions,['prompt','unconfirmed'].includes(source)?1:0);
 if(source==='legacy'){const state=await savedStartupState(f);assert.equal(state.settings.dataDirectory,legacy);assert.equal(state.settings.libraryConfigured,true);assert.equal(state.gemini,'');assert.equal(state.openai,'');}
 assert.deepEqual(await fixtureBytes(f.locations.cliSelection),legacyBefore,'legacy directory file must remain untouched');
 if(source==='saved'||source==='legacy')await assert.rejects(access(result.SHIQU_DATA_DIR));
});
