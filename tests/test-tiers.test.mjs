// 验证测试分层不漏文件：冒烟和混合服务测试常跑，真实原著与制作流程按独立套件选择。
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readdir,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {tierTests} from '../scripts/test-tiers.mjs';

test('unit, flow and book selections partition all regression files and preserve mixed server checks',async()=>{
 const unit=await tierTests('unit'),flows=await tierTests('flows'),books=await tierTests('books');
 const all=(await readdir('tests')).filter(name=>name.endsWith('.test.mjs')).map(name=>'tests/'+name);
 assert.equal(unit.length+flows.length+books.length,new Set([...unit,...flows,...books]).size);
 assert.deepEqual(new Set([...unit,...flows,...books]),new Set(all));
 for(const name of ['book-integrity-smoke','local-server','story-discovery-speed-accuracy','ci-scope','test-tiers'])assert.ok(unit.includes(`tests/${name}.test.mjs`),name);
 for(const name of ['local-books','taiping-wyg','book-reading-plans','clean-three-originals','erke-unified','licensed-books','local-book-corrections','local-library-all-books','local-source-quality','priority-wiki-originals'])assert.ok(books.includes(`tests/${name}.test.mjs`),name);
 assert.ok(flows.length>0);
});
test('book markers select the whole file, including a file that also drives production flows',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'shiqu-tiers-'));t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(path.join(root,'tests'));
 const bookMarker="import {books} from '"+['.','fixtures','test-tier.mjs'].join('/')+"';";
 const flowMarker=['production','Fixture'].join('')+'();';
 for(const [name,source] of [['unit',''],['flow',flowMarker],['book',bookMarker],['book-flow',bookMarker+flowMarker]])await writeFile(path.join(root,'tests',name+'.test.mjs'),source);
 assert.deepEqual(await tierTests('unit',root),['tests/unit.test.mjs']);
 assert.deepEqual(await tierTests('flows',root),['tests/flow.test.mjs']);
 assert.deepEqual(await tierTests('books',root),['tests/book-flow.test.mjs','tests/book.test.mjs']);
 await assert.rejects(tierTests('invalid',root),/unit, flows or books/);
});
