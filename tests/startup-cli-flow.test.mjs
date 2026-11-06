// 使用隔离夹具验证真实生产流程，保持适配器契约可独立快速运行。
import test from 'node:test';

import assert from 'node:assert/strict';

import {mkdir,writeFile} from 'node:fs/promises';

import path from 'node:path';

import {startupFixture,freeStartupPort,startFixtureCli,savedStartupState,fixtureBytes} from './fixtures/startup.mjs';

const launches=[
 {name:'saved profile and saved port',expected:'gemini',port:'saved'},
 {name:'config file overrides saved provider/models/library/port',file:true,expected:'openai',port:'file',library:'file'},
 {name:'shell overrides config file provider/models/library/port',file:true,shell:true,expected:'gemini',port:'shell',library:'shell'},
 {name:'flags override shell and config file port/library',file:true,shell:true,flags:true,expected:'gemini',port:'flag',library:'flag'},
 {name:'unselected .env is ignored',dotenv:true,expected:'gemini',port:'saved'},
 {name:'no saved profile with complete config-file override',fresh:true,file:true,expected:'openai',port:'file',library:'file'},
 {name:'no saved profile with complete environment override',fresh:true,shell:true,expected:'gemini',port:'shell',library:'shell'},
 {name:'explicit empty shell key beats file and saved key',file:true,emptyKey:true,error:/交互终端/},
 {name:'invalid explicit provider fails without mutation',invalidProvider:true,error:/SHIQU_AI_PROVIDER/},
 {name:'missing provider credentials fail noninteractively',missingKeys:true,error:/交互终端/},
 {name:'incomplete explicit provider never borrows another provider key',onlyGemini:true,openaiOverride:true,error:/交互终端/},
 {name:'fully explicit read-only startup bypasses corrupt saved settings',corrupt:true,explicit:true,expected:'readonly',port:'flag',library:'flag'},
];

for(const row of launches)test('CLI startup matrix: '+row.name,{timeout:30000},async t=>{
 const f=await startupFixture(t),ports={};for(const source of ['saved','file','shell','flag'])ports[source]=await freeStartupPort();
 const directories=Object.fromEntries(['saved','file','shell','flag'].map(source=>[source,path.join(f.root,source+' shelf')]));
 if(!row.fresh&&!row.corrupt){
  const store=f.store();
  if(!row.missingKeys){store.save({provider:'gemini'},{provider:'gemini',value:'test-only-db-gemini'});if(!row.onlyGemini)store.save({provider:'openai'},{provider:'openai',value:'test-only-db-openai'});}
  store.save({provider:'gemini',providerConfigured:!row.missingKeys,libraryConfigured:true,dataDirectory:directories.saved,port:ports.saved});store.close();
 }
 if(row.corrupt){await mkdir(path.dirname(f.locations.settings),{recursive:true});await writeFile(f.locations.settings,'test-only-corrupt-database');}
 const beforeBytes=await fixtureBytes(f.locations.settings),before=beforeBytes&&!row.corrupt?await savedStartupState(f):null;
 const config=path.join(f.root,'selected.env'),content=`SHIQU_AI_PROVIDER=openai\nOPENAI_API_KEY=test-only-file-key\nOPENAI_TEXT_MODEL=test-file-model\nPORT=${ports.file}\nSHIQU_DATA_DIR="${directories.file.replaceAll('\\','/')}"\n`;
 await writeFile(row.dotenv?path.join(f.root,'.env'):config,content);
 const args=row.file?['--config',config]:[],variables={};
 if(row.shell)Object.assign(variables,{SHIQU_AI_PROVIDER:'gemini',GEMINI_API_KEY:'test-only-shell-key',GEMINI_TEXT_MODEL:'test-shell-model',PORT:String(ports.shell),SHIQU_DATA_DIR:directories.shell});
 if(row.flags||row.explicit)args.push('--port',String(ports.flag),'--data-dir',directories.flag);
 if(row.explicit)variables.SHIQU_AI_PROVIDER='readonly';
 if(row.emptyKey)Object.assign(variables,{SHIQU_AI_PROVIDER:'openai',OPENAI_API_KEY:''});
 if(row.invalidProvider)variables.SHIQU_AI_PROVIDER='unknown';
 if(row.openaiOverride)variables.SHIQU_AI_PROVIDER='openai';
 const run=startFixtureCli(f,args,variables);t.after(()=>run.stop());
 if(row.error){assert.equal(await run.ended(),1);assert.match(run.output(),row.error);}
 else{
  const output=await run.ready(),port=ports[row.port];assert.ok(output.includes(`http://127.0.0.1:${port}`));assert.ok(output.includes('data: '+directories[row.library||'saved']));
  const status=await(await fetch(`http://127.0.0.1:${port}/api/reader/status`,{signal:AbortSignal.timeout(5000)})).json();assert.equal(status.provider,row.expected);
  assert.equal(status.configured,row.expected!=='readonly');
  if(row.file&&!row.shell)assert.equal(status.models.text,'test-file-model');
  if(row.shell)assert.equal(status.models.text,'test-shell-model');
  assert.doesNotMatch(output,/test-only-(?:db|file|shell)-/);await run.stop();
 }
 if(before)assert.deepEqual(await savedStartupState(f),before,'runtime overrides must not rewrite settings or keys');
 else assert.deepEqual(await fixtureBytes(f.locations.settings),beforeBytes,'explicit invocation must not initialize or replace settings');
});
