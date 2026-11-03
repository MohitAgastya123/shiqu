// Resolve development mode before opening any shelf; local must ignore shared data directory settings.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {developmentArguments} from '../scripts/development-server.mjs';
test('local mode selects only the checkout development shelf and preserves ordinary dev defaults',()=>{
 const cwd=path.resolve('checkout');
 assert.deepEqual(developmentArguments(['local','--port','4000'],{SHIQU_DATA_DIR:'/private/shared',SHIQU_API_PORT:'4002'},cwd),{local:true,port:4000,apiPort:4002,library:path.join(cwd,'.data/dev-local')});
 assert.deepEqual(developmentArguments([],{SHIQU_DATA_DIR:'/private/shared'},cwd),{local:false,port:3000,apiPort:3002});
 for(const args of [['typo'],['--port'],['local','--port','0'],['local','--port','NaN'],['local','--port','3002']])assert.throws(()=>developmentArguments(args,{},cwd));
});
