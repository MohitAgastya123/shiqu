// The registered regression entry enables all provider and heavy cases while retaining explicit file selection.
import {spawn} from 'node:child_process';
import {loadMetadata,supported} from './test-metadata.mjs';
const env={...process.env,SHIQU_TEST_TIER:'full'};
// Clear inherited Node test context for child runs.
delete env.NODE_TEST_CONTEXT;
// Without explicit files, run every registered JavaScript regression.
const files=process.argv.slice(2);
const child=spawn(process.execPath,['--experimental-strip-types','--test',...(files.length?files:loadMetadata().tests.filter(entry=>['unit','flows','books'].includes(entry.suite)&&supported(entry)).map(entry=>entry.file))],{env,stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));
child.once('exit',(code,signal)=>{process.exitCode=code??(signal?1:0);});
