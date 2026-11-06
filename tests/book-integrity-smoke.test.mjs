// 每个 PR 都用几 KB 的隔离原著调用正式加载器，验证哈希、路径边界和出处拒绝行为。
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {LocalBooks} from '../server/local-books.ts';

async function fixture(t){
 const root=await mkdtemp(path.join(os.tmpdir(),'shiqu-book-smoke-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const directory=path.join(root,'data/library'),filename=path.join(directory,'original.txt');await mkdir(directory,{recursive:true});
 const text=Array.from({length:33},(_,i)=>`卷${i+1} 第一 测试篇${i+1}\n\n昔者有人行于山间，见友人困于溪畔，遂伸手相助，二人平安归来。\n\n归来之后，友人设席道谢，二人谈及途中见闻，皆感念彼此之情。`).join('\n\n');
 const entry={id:'zhuangzi',title:'庄子测试原著',originalFile:'original.txt',source:{url:'https://example.org/original',provider:'test fixture',sha256:createHash('sha256').update(text).digest('hex')},supplements:[]};
 await writeFile(filename,text);const saveCatalog=()=>writeFile(path.join(directory,'catalog.json'),JSON.stringify({books:[entry]}));await saveCatalog();
 return {root,filename,text,entry,saveCatalog};
}
const select={bookId:'zhuangzi'};
const reference=book=>({edition:book.edition,sectionId:book.sections[0].id,firstUnit:book.sections[0].units[0].id,lastUnit:book.sections[0].units[0].id});
test('integrity smoke: production loader preserves bytes and resolves a valid source',async t=>{
 const f=await fixture(t),library=new LocalBooks(f.root),book=await library.book(select);
 assert.equal(book.sections.length,33);assert.equal(book.edition,f.entry.source.sha256);
 assert.equal(library.resolve(book,reference(book)).text,book.sections[0].units[0].text);assert.equal(await readFile(f.filename,'utf8'),f.text);
});
test('integrity smoke: changed bytes and missing originals fail closed',async t=>{
 const f=await fixture(t);await writeFile(f.filename,f.text+'已被篡改');
 await assert.rejects(new LocalBooks(f.root).book(select),error=>error.status===503);
 await rm(f.filename);await assert.rejects(new LocalBooks(f.root).book(select),error=>error.status===503);
});
test('integrity smoke: an original outside the library is rejected even with the correct hash',async t=>{
 const f=await fixture(t);await writeFile(path.join(f.root,'data/outside.txt'),f.text);f.entry.originalFile='../outside.txt';await f.saveCatalog();
 await assert.rejects(new LocalBooks(f.root).book(select),error=>error.status===503);
});
test('integrity smoke: stale, missing, reversed and unreadable citations are rejected',async t=>{
 const f=await fixture(t),library=new LocalBooks(f.root),book=await library.book(select),ref=reference(book);
 for(const invalid of [{...ref,edition:'0'.repeat(64)},{...ref,firstUnit:'missing'},{...ref,sectionId:'foreign'},{...ref,firstUnit:book.sections[0].units[1].id}]){
  assert.throws(()=>library.resolve(book,invalid),error=>error.status===400);
 }
 const unreadable=structuredClone(book);unreadable.sections[0].units[0].text+='□';assert.throws(()=>library.resolve(unreadable,ref),error=>error.status===400);
});
