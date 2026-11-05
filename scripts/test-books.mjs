// Check the shipped book contents after adding or replacing books; CI skips these unchanged-data checks.
import {spawn} from 'node:child_process';
import {readdir,readFile} from 'node:fs/promises';
const files=[];
for(const name of (await readdir('tests')).filter(name=>name.endsWith('.test.mjs')).sort()){
 if(/import \{[^}]*\bbooks\b[^}]*\} from '\.\/fixtures\/test-tier\.mjs'/.test(await readFile('tests/'+name,'utf8')))files.push('tests/'+name);
}
const env={...process.env,SHIQU_TEST_BOOKS:'1'};delete env.NODE_TEST_CONTEXT;
// Runs the whole files: the book-content checks plus their fast loader and integrity tests.
const child=spawn(process.execPath,['--experimental-strip-types','--test',...files],{env,stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));
child.once('exit',(code,signal)=>{process.exitCode=code??(signal?1:0);});
