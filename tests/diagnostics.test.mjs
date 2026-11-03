// Test diagnostic privacy, bounded storage, unavailable disks and real CLI/desktop lifecycle integration.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm,symlink,stat} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {recordDiagnostic,diagnosticReport,diagnosticLimit,installDiagnostics} from '../server/diagnostics.ts';
import {startupFixture,startFixtureCli,freeStartupPort} from './fixtures/startup.mjs';
import {startDesktop} from '../server/desktop.ts';
import {defaultSystemSettings} from '../lib/system-settings.ts';

test('whitelist strips secrets, arbitrary messages/paths and hostile stored records; rotation stays bounded',async t=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'shiqu-diagnostics-test-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const privateText='sk-private-secret /Users/private story原文 prompt敏感';
 for(let i=0;i<1800;i++)assert.ok(recordDiagnostic(directory,'production_job_unsaved',{id:crypto.randomUUID(),code:'ENOSPC',message:privateText,key:privateText}));
 assert.equal(recordDiagnostic(directory,privateText,{code:privateText}),false);
 const logDirectory=path.join(directory,'.diagnostics');const names=await readdir(logDirectory);assert.deepEqual(names.sort(),['events.jsonl','events.jsonl.1']);
 for(const n of names)assert.ok((await stat(path.join(logDirectory,n))).size<=diagnosticLimit);
 await writeFile(path.join(logDirectory,'events.jsonl'),JSON.stringify({time:new Date().toISOString(),event:'request_failed',code:privateText,id:privateText,prompt:privateText})+'\n'+JSON.stringify({event:privateText})+'\n');
 const report=diagnosticReport(directory,'0.6.6');assert.equal(report.database.status,'missing');assert.doesNotMatch(JSON.stringify(report),/sk-private|Users|原文|敏感/);assert.equal(report.events.at(-1).code,'UNKNOWN');
 if(process.platform!=='win32')assert.equal((await stat(path.join(logDirectory,'events.jsonl.1'))).mode&0o777,0o600);
});
test('logging failures never throw and symlinks cannot write or leak outside the library',async t=>{
 const f=await startupFixture(t),directory=path.join(f.root,'library');await mkdir(directory);await writeFile(path.join(directory,'.diagnostics'),'obstructed');
 assert.equal(recordDiagnostic(directory,'service_started'),false);assert.equal(diagnosticReport(directory,'0.6.6').logsAvailable,false);
 if(process.platform!=='win32'){
  await rm(path.join(directory,'.diagnostics'));const outside=path.join(f.root,'outside');await mkdir(outside);await symlink(outside,path.join(directory,'.diagnostics'));
  assert.equal(recordDiagnostic(directory,'service_started'),false);assert.deepEqual(await readdir(outside),[]);assert.equal(diagnosticReport(directory,'0.6.6').logsAvailable,false);
 }
});
test('known console events are saved safely and capture is removed on shutdown',async t=>{
 const f=await startupFixture(t),directory=path.join(f.root,'library'),original=console.error,restore=installDiagnostics(directory);
 // Keep this test's expected console error out of the TAP error stream.
 const capture=console.error;try{capture('production_tick_failed',JSON.stringify({code:'SQLITE_BUSY',prompt:'do not store'}));}finally{restore();}
 assert.equal(diagnosticReport(directory,'0.6.6').events[0].code,'SQLITE_BUSY');assert.equal(console.error,original);
});
test('real CLI saves lifecycle events and exports a new metadata-only report, including corrupt libraries',async t=>{
 const f=await startupFixture(t),directory=path.join(f.root,'library'),port=await freeStartupPort();
 const service=startFixtureCli(f,['--data-dir',directory,'--port',String(port)],{SHIQU_AI_PROVIDER:'readonly'});await service.ready();
 const reportFile=path.join(f.root,'diagnostics.json'),run=startFixtureCli(f,['--data-dir',directory,'--diagnostics',reportFile]);assert.equal(await run.ended(),0,run.output());
 const report=JSON.parse(await readFile(reportFile));assert.equal(report.database.status,'ok');assert.ok(report.events.some(x=>x.event==='service_started'));
 assert.ok(!JSON.stringify(report).includes(f.root));const overwrite=startFixtureCli(f,['--data-dir',directory,'--diagnostics',reportFile]);assert.notEqual(await overwrite.ended(),0);
 await service.stop();assert.ok(diagnosticReport(directory,'0.6.6').events.some(x=>x.event==='service_stopped'));
 const broken=path.join(f.root,'broken');await mkdir(broken);await writeFile(path.join(broken,'shiqu.sqlite'),'broken data with private-secret');const out=path.join(f.root,'broken.json');
 const diagnostic=startFixtureCli(f,['--data-dir',broken,'--diagnostics',out]);assert.equal(await diagnostic.ended(),0);assert.equal(JSON.parse(await readFile(out)).database.status,'unreadable');assert.ok(!(await readFile(out,'utf8')).includes('private-secret'));
});
test('desktop lifecycle persists diagnostics without forwarding raw stderr or using credentials',async t=>{
 const f=await startupFixture(t),directory=path.join(f.root,'desktop-library'),settings={...defaultSystemSettings(directory),port:await freeStartupPort(),provider:'readonly'};
 const runtime=await startDesktop(settings,'',f.root);try{assert.ok(diagnosticReport(directory,'0.6.6').events.some(x=>x.event==='service_started'));}finally{await runtime.stop();}
 assert.ok(diagnosticReport(directory,'0.6.6').events.some(x=>x.event==='service_stopped'));
});
