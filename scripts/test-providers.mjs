// Run regression tests with the full production-flow provider matrix and heavy cases (all files by default).
import {spawn} from 'node:child_process';
const env={...process.env,SHIQU_TEST_TIER:'full'};
// Run as a top-level test process, even when started from another test runner.
delete env.NODE_TEST_CONTEXT;
// Arguments select test files; none runs the whole regression suite.
const files=process.argv.slice(2);
const child=spawn(process.execPath,['--experimental-strip-types','--test',...(files.length?files:['tests/*.test.mjs'])],{env,stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));
child.once('exit',(code,signal)=>{process.exitCode=code??(signal?1:0);});
