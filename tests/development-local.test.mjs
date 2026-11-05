// Resolve development mode before opening any shelf; local must ignore shared data directory settings.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {developmentArguments} from '../scripts/development-server.mjs';
test('local mode selects only the checkout development shelf and preserves ordinary dev defaults',()=>{
 const cwd=path.resolve('checkout');
 assert.deepEqual(developmentArguments(['local','--port','4000'],{SHIQU_DATA_DIR:'/private/shared',SHIQU_API_PORT:'4002'},cwd),{local:true,port:4000,apiPort:4002,library:path.join(cwd,'.data/dev-local')});
 assert.deepEqual(developmentArguments([],{SHIQU_DATA_DIR:'/private/shared'},cwd),{local:false,port:3000,apiPort:3002});
 for(const args of [['typo'],['--port'],['local','--port','0'],['local','--port','NaN'],['local','--port','3002']])assert.throws(()=>developmentArguments(args,{},cwd));
});
test('setup leaves provider configuration in the shared store and preserves an existing standalone env file',async t=>{
 const cwd=await mkdtemp(path.join(os.tmpdir(),'shiqu-setup-'));t.after(()=>rm(cwd,{recursive:true,force:true}));
 const setup=fileURLToPath(new URL('../scripts/setup.mjs',import.meta.url));
 const run=()=>spawnSync(process.execPath,[setup],{cwd,encoding:'utf8'});
 const first=run();assert.equal(first.status,0,first.stderr);await assert.rejects(access(path.join(cwd,'.env')));
 const content='PORT=3100\n';await writeFile(path.join(cwd,'.env'),content);
 const second=run();assert.equal(second.status,0,second.stderr);assert.equal(await readFile(path.join(cwd,'.env'),'utf8'),content);
});
