// Run registered real-book suites covering content, loading, provenance and reading for selected CI scope.
import {spawn} from 'node:child_process';
import {tierTests} from './test-tiers.mjs';
const files=await tierTests('books');
const env={...process.env,SHIQU_TEST_BOOKS:'1'};delete env.NODE_TEST_CONTEXT;
// Run complete files, including byte-level checks and loading/validation/production boundaries.
const child=spawn(process.execPath,['--experimental-strip-types','--test',...files],{env,stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));
child.once('exit',(code,signal)=>{process.exitCode=code??(signal?1:0);});
