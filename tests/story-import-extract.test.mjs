// Exercise genuine DOCX/PDF bytes through the production bounded worker, never a second extraction pipeline.
// Actual Node watch subprocesses must distinguish dependency reports from document results.
import test from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,unzipSync,strToU8,strFromU8} from 'fflate';
import {mkdtemp,mkdir,writeFile,rm,readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {build} from 'esbuild';
import {extractStoryImport} from '../server/story-import-extract.ts';
import {planImportedStory} from '../lib/story-import-text.ts';
import {copyDesktopPackage} from '../scripts/desktop-resources.mjs';
import {importDocx,importPdf} from './fixtures/import-documents.mjs';

test('real Word paragraphs, XML characters and styled headings remain complete in the canonical source',async()=>{
 const paragraphs=['The Promise','Mara & Ivo find a traveler beside the river.','The Second Rescue','They help the traveler cross safely. FINAL_SENTINEL'];
 const value=await extractStoryImport('story.docx',importDocx(paragraphs,{headingIndexes:[0,2],externalReference:true}));assert.equal(value.format,'docx');assert.equal(value.pageCount,null);assert.equal(value.text,paragraphs.join('\n\n'));assert.ok(value.units.some(unit=>unit.heading==='The Second Rescue'));assert.equal(value.units.map(unit=>value.text.slice(unit.start,unit.end)).join(''),value.text);assert.equal(planImportedStory(value,'The Promise').length,1);
});
test('actual watched development reads Word and PDF despite worker dependency notifications',async t=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'shiqu-import-watch-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const script=path.join(directory,'watched.mjs'),moduleUrl=name=>JSON.stringify(pathToFileURL(path.resolve(name)).href);
 await writeFile(script,`import {extractStoryImport} from ${moduleUrl('server/story-import-extract.ts')};
import {planImportedStory} from ${moduleUrl('lib/story-import-text.ts')};
import {importDocx,importPdf} from ${moduleUrl('tests/fixtures/import-documents.mjs')};
try {
 const text='Mara finds the lost lantern and returns home safely. FINAL_SENTINEL';
 const word=await extractStoryImport('story.docx',importDocx([text]));
 const pdf=await extractStoryImport('story.pdf',await importPdf([text]));
 let invalid='';try{await extractStoryImport('empty.docx',importDocx(['']));}catch(error){invalid=error.message;}
 console.log('IMPORT_RESULT:'+JSON.stringify({ok:true,word:word.text,pdf:pdf.text,parts:planImportedStory(word,'The Lost Lantern').length,invalid}));
}catch(error){console.log('IMPORT_RESULT:'+JSON.stringify({ok:false,error:error.message}));}`);
 const child=spawn(process.execPath,['--watch',script],{stdio:['ignore','pipe','pipe']}),exited=new Promise(resolve=>child.once('exit',resolve));let log='',timer;
 try{
  const result=await new Promise((resolve,reject)=>{const output=chunk=>{log+=chunk;const line=log.split('\n').slice(0,-1).find(value=>value.startsWith('IMPORT_RESULT:'));if(line){try{resolve(JSON.parse(line.slice('IMPORT_RESULT:'.length)));}catch(error){reject(error);}}};child.stdout.on('data',output);child.stderr.on('data',output);child.once('error',reject);child.once('exit',()=>reject(Error('Watched import exited without its result: '+log)));timer=setTimeout(()=>reject(Error('Watched import timed out: '+log)),20000);});
  assert.equal(result.ok,true,JSON.stringify(result));assert.match(result.word,/FINAL_SENTINEL$/);assert.equal(result.pdf,result.word);assert.equal(result.parts,1);assert.match(result.invalid,/No readable/);
 }finally{clearTimeout(timer);child.kill('SIGTERM');await exited;}
});
test('Word footnotes and endnotes remain once at their reading references as plain annotation context',async()=>{
 const value=await extractStoryImport('notes.docx',importDocx(['Mara finds a safe road.','Ivo follows the road and reaches home.'],{footnote:'The road was built by their village.',endnote:'They return before sunset.'}));assert.equal(value.text.match(/road was built/g)?.length,1);assert.equal(value.text.match(/return before sunset/g)?.length,1);assert.ok(value.text.indexOf('road was built')<value.text.indexOf('Ivo follows'));assert.match(value.text,/\[Footnote: The road was built by their village\.\]/);assert.match(value.text,/\[Endnote: They return before sunset\.\]/);assert.doesNotMatch(value.text,/↑|<a|<sup/);
 const literal=await extractStoryImport('literal.docx',importDocx(['<script>alert("test-only")</script> is text written by a character.']));assert.match(literal.text,/^<script>alert/);
});
test('Word imported HTML and unknown story-bearing wrappers reject rather than silently losing the ending',async()=>{
 const files=unzipSync(importDocx(['Mara finds a lost lantern beside the river.']));
 files['word/document.xml']=strToU8(strFromU8(files['word/document.xml']).replace('<w:sectPr/>','<w:altChunk r:id="htmlpart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><w:sectPr/>'));
 files['word/_rels/document.xml.rels']=strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="htmlpart" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/aFChunk" Target="ending.html"/></Relationships>');
 files['word/ending.html']=strToU8('<html><body><p>Finally, Mara returns the lantern and everyone escapes the flood.</p></body></html>');
 files['[Content_Types].xml']=strToU8(strFromU8(files['[Content_Types].xml']).replace('</Types>','<Default Extension="html" ContentType="text/html"/></Types>'));
 await assert.rejects(extractStoryImport('imported-ending.docx',zipSync(files)),/unsupported content.*hide part of the story/);
 const wrapped=unzipSync(importDocx(['Mara begins her journey.']));wrapped['word/document.xml']=strToU8(strFromU8(wrapped['word/document.xml']).replace('<w:sectPr/>','<story:chapter xmlns:story="urn:story-test"><w:p><w:r><w:t>Finally, Mara reaches home safely.</w:t></w:r></w:p></story:chapter><w:sectPr/>'));
 await assert.rejects(extractStoryImport('unknown-ending.docx',zipSync(wrapped)),/unsupported content.*hide part of the story/);
 const styled=unzipSync(importDocx(['Mara reaches home safely.']));styled['word/document.xml']=strToU8(strFromU8(styled['word/document.xml']).replace('<w:p>','<w:p><w:pPr><w:pStyle w:val="CustomParagraph"/></w:pPr>').replace('<w:r>','<w:r><w:rPr><w:rStyle w:val="CustomRun"/></w:rPr>'));
 const value=await extractStoryImport('custom-style.docx',zipSync(styled));assert.equal(value.text,'Mara reaches home safely.');assert.match(value.warnings[0],/formatting/);
});
test('every Word ZIP member is bounded against its actual output even when declared note sizes are forged',async()=>{
 const bytes=importDocx(['Mara finds the safe road.'],{footnote:'The complete annotation explains the final rescue. '.repeat(80)}),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),target='word/footnotes.xml';let patched=0;
 for(let index=0;index+46<bytes.length;index++){
  const signature=view.getUint32(index,true),local=signature===0x04034b50,central=signature===0x02014b50;if(!local&&!central)continue;
  const header=local?30:46,nameLength=view.getUint16(index+(local?26:28),true);if(strFromU8(bytes.subarray(index+header,index+header+nameLength))!==target)continue;
  view.setUint32(index+(local?22:24),1,true);patched++;
 }
 assert.equal(patched,2,'The local and central sizes are both forged; metadata consistency alone cannot catch this.');
 await assert.rejects(extractStoryImport('forged-notes.docx',bytes),/declared content sizes do not match/);
});
test('Word ZIP checksums reject same-length corrupted story text and notes before accepting a source',async()=>{
 const files=unzipSync(importDocx(['Mara saves the village before the flood.'],{footnote:'Mara returns the lantern at sunset.'}));
 for(const phrase of ['Mara saves the village','Mara returns the lantern']){
  const bytes=zipSync(files,{level:0}),offset=Buffer.from(bytes).indexOf(phrase);assert.ok(offset>=0);bytes[offset]='S'.charCodeAt(0);
  await assert.rejects(extractStoryImport('damaged-story.docx',bytes),/damaged.*ZIP checksum/);
 }
 const bytes=zipSync(files,{level:0}),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);assert.equal(view.getUint32(0,true),0x04034b50);view.setUint32(14,view.getUint32(14,true)^1,true);
 await assert.rejects(extractStoryImport('damaged-header.docx',bytes),/damaged.*ZIP checksum/);
});
test('real multi-page text PDF retains reading order, page identities and the final source text',async()=>{
 const value=await extractStoryImport('story.pdf',await importPdf(['Mara begins the journey beside the river.','Ivo finds a bridge and helps her cross. FINAL_SENTINEL']));assert.equal(value.format,'pdf');assert.equal(value.pageCount,2);assert.ok(value.text.indexOf('Mara begins')<value.text.indexOf('Ivo finds'));assert.match(value.text,/FINAL_SENTINEL$/);assert.deepEqual([...new Set(value.units.map(unit=>unit.page))],[1,2]);assert.equal(value.units.map(unit=>value.text.slice(unit.start,unit.end)).join(''),value.text);
});
test('blank PDF pages are retained as provenance while image-only pages cannot be silently skipped',async()=>{
 const value=await extractStoryImport('blank-page.pdf',await importPdf(['Mara begins her journey.','','She reaches the shore.']));assert.equal(value.pageCount,3);assert.deepEqual([...new Set(value.units.map(unit=>unit.page))],[1,3]);assert.match(value.warnings[0],/blank PDF page/);
 await assert.rejects(extractStoryImport('mixed.pdf',await importPdf(['Mara begins her journey.','', 'The journey ends.'],{imageOnlyPages:[2]})),/page 2.*without readable text/);
});
test('PDF font-run boundaries do not insert spaces inside a source word',async()=>{
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold),page=pdf.addPage([612,792]);page.drawText('A com',{x:40,y:720,size:12,font});page.drawText('plete story ends safely.',{x:40+font.widthOfTextAtSize('A com',12),y:720,size:12,font:bold});const value=await extractStoryImport('font-runs.pdf',new Uint8Array(await pdf.save()));assert.match(value.text,/A complete story ends safely\./);
});
test('genuine encrypted PDFs are rejected even when the user password is empty',async()=>{
 for(const filename of ['import-protected.pdf','import-empty-password.pdf'])await assert.rejects(extractStoryImport(filename,new Uint8Array(await readFile(new URL('./fixtures/'+filename,import.meta.url)))),/password-protected|Encrypted PDFs/);
});
test('actual file signatures, legacy Word, corrupt packages, expansion limits and empty text fail clearly',async()=>{
 for(const [name,bytes,pattern]of [['story.doc',new Uint8Array([1]),/older|Older/],['story.docx',new TextEncoder().encode('not a zip'),/valid Word/],['story.pdf',new TextEncoder().encode('not pdf'),/valid Word/],['broken.pdf',new TextEncoder().encode('%PDF-1.7\nnot a document'),/damaged/],['empty.docx',importDocx(['']),/No readable/],['plain.zip',importDocx(['Readable text.']),/valid Word/],['wrong.docx',zipSync({'word/document.xml':strToU8('<x/>')}),/supported Word/]])await assert.rejects(extractStoryImport(name,bytes),pattern);
 await assert.rejects(extractStoryImport('large.pdf',new Uint8Array(10*1024*1024+1)),/10 MiB/);
 const expanded=importDocx(['Readable story.']),files={'unused.bin':new Uint8Array(17*1024*1024)};const bomb=zipSync({...Object.fromEntries(Object.entries((await import('fflate')).unzipSync(expanded))),...files});await assert.rejects(extractStoryImport('expanded.docx',bomb),/safe reading limit/);
});
test('isolated application roots use the trusted adjacent production worker and distribution scripts ship it',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'shiqu-import-root-'));t.after(()=>rm(root,{recursive:true,force:true}));const value=await extractStoryImport('story.docx',importDocx(['A traveler reaches the end safely.']),root);assert.match(value.text,/end safely/);
 for(const name of ['scripts/build.mjs','scripts/build-npm.mjs','scripts/desktop-resources.mjs'])assert.match(await readFile(name,'utf8'),/story-import-worker\.mjs/);
});
test('PDF page and extracted text caps reject the entire upload rather than truncating it',async()=>{
 await assert.rejects(extractStoryImport('many-pages.pdf',await importPdf(Array.from({length:501},()=>''))),/500-page limit/);
 await assert.rejects(extractStoryImport('too-much-text.docx',importDocx(['word '.repeat(400001)])),/2 million character/);
});
test('two-worker concurrency, the real deadline and cleanup are shared production boundaries',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'shiqu-import-deadline-'));t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(path.join(root,'server'));await writeFile(path.join(root,'server/story-import-worker.mjs'),'setInterval(()=>{},1000);');
 t.mock.timers.enable({apis:['setTimeout']});
 const bytes=importDocx(['A traveler reaches the end safely.']),first=assert.rejects(extractStoryImport('story.docx',bytes,root),/30 seconds/),second=assert.rejects(extractStoryImport('story.docx',bytes,root),/30 seconds/);
 await assert.rejects(extractStoryImport('story.docx',bytes,root),error=>error.status===429);t.mock.timers.tick(30001);await Promise.all([first,second]);t.mock.timers.reset();
 assert.match((await extractStoryImport('story.docx',bytes)).text,/end safely/);
});
test('the independently bundled worker with only staged parser dependencies reads an upload',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'shiqu-import-installed-'));t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(path.join(root,'dist/server'),{recursive:true});
 const result=await build({entryPoints:['server/story-import-worker.mjs'],outfile:path.join(root,'dist/server/story-import-worker.mjs'),bundle:true,platform:'node',format:'esm',target:'node24',packages:'external',metafile:true});
 const imports=Object.values(result.metafile.outputs).flatMap(output=>output.imports.map(item=>item.path));assert.ok(imports.includes('mammoth'));assert.ok(imports.includes('pdfjs-dist/legacy/build/pdf.mjs'));
 for(const name of new Set(imports.filter(name=>!name.startsWith('node:')).map(name=>name.startsWith('@')?name.split('/').slice(0,2).join('/'):name.split('/')[0])))await copyDesktopPackage(name,process.cwd(),root);
 const native=await readdir(path.join(root,'node_modules/@napi-rs/canvas/node_modules/@napi-rs'));assert.ok(native.length>=1);assert.ok(native.every(name=>name.includes(process.platform)&&name.includes(process.arch)),'Only installed host-native bindings are staged.');
 const value=await extractStoryImport('story.pdf',await importPdf(['The installed reader preserves its final source sentence.']),root);assert.match(value.text,/final source sentence\./);
});
