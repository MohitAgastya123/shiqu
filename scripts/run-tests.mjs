// Run one regression tier: `unit` by default (pnpm test, PR CI) or `flows` (pnpm test:flows).
import {spawn} from 'node:child_process';
import {tierTests} from './test-tiers.mjs';
const files=await tierTests(process.argv[2]||'unit');
const env={...process.env};
// Run as a top-level test process, even when started from another test runner.
delete env.NODE_TEST_CONTEXT;
const child=spawn(process.execPath,['--experimental-strip-types','--test',...files],{env,stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));
child.once('exit',(code,signal)=>{process.exitCode=code??(signal?1:0);});
