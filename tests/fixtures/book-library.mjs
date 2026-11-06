// 复制测试所需的原著及补卷，保留正式目录与原始字节，避免每个故障用例复制整套书库。
import assert from 'node:assert/strict';
import {cp,mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export async function copyBookLibrary(root,ids){
 const source=fileURLToPath(new URL('../../data/library/',import.meta.url)),target=path.join(root,'data/library');
 const catalog=JSON.parse(await readFile(path.join(source,'catalog.json'),'utf8')),files=new Set();
 for(const id of ids){
  const entry=catalog.books.find(book=>book.id===id);assert.ok(entry,`测试书籍不存在：${id}`);
  files.add(entry.originalFile);for(const supplement of entry.supplements||[])files.add(supplement.file);
 }
 await mkdir(target,{recursive:true});await cp(path.join(source,'catalog.json'),path.join(target,'catalog.json'));
 for(const file of files){
  await mkdir(path.dirname(path.join(target,file)),{recursive:true});
  await cp(path.join(source,file),path.join(target,file),{recursive:true});
 }
 return target;
}
