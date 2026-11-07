// Read local uploads with two bounded workers; parser failures never publish a partial source.
// Resolve only trusted application worker resources for source, development and installed editions.
// Node watch mode shares this channel for dependency reports; accept only tagged parser results.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {existsSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import {ReaderError} from '../lib/reader-model.ts';
import {storyImportLimits} from '../lib/story-import-contract.ts';
import type {ExtractedStoryImport,StoryImportFormat} from '../lib/story-import-contract.ts';
import {canonicalImportText,validateImportedSource} from '../lib/story-import-text.ts';

let active=0;
const defaultRoot=fileURLToPath(new URL('../',import.meta.url));
function formatOf(filename:string,bytes:Uint8Array):StoryImportFormat{
 if(bytes.length>storyImportLimits.fileBytes)throw new ReaderError(413,'The file exceeds the 10 MiB upload limit. Choose a smaller Word or PDF story.');
 if(!bytes.length)throw new ReaderError(400,'The uploaded file is empty. Choose a readable Word or PDF story.');
 const extension=path.extname(filename).toLowerCase();
 if(extension==='.doc')throw new ReaderError(400,'Older Word .doc files are not supported. Save the file as .docx or a text PDF, then upload it again.');
 if(extension==='.pdf'&&Buffer.from(bytes.subarray(0,5)).toString()==='%PDF-')return 'pdf';
 if(extension==='.docx'&&bytes[0]===0x50&&bytes[1]===0x4b&&bytes[2]===0x03&&bytes[3]===0x04)return 'docx';
 if(extension==='.docx'&&Buffer.from(bytes.subarray(0,8)).toString('hex')==='d0cf11e0a1b11ae1')throw new ReaderError(400,'This Word file is encrypted or uses an older format. Save an unlocked .docx copy and try again.');
 throw new ReaderError(400,'Choose a valid Word .docx document or a PDF with selectable text. Renaming another file does not convert it.');
}
function workerFile(root:string){
 const source=path.join(root,'server/story-import-worker.mjs');if(existsSync(source))return source;
 const compiled=path.join(root,'dist/server/story-import-worker.mjs');if(existsSync(compiled))return compiled;
 return fileURLToPath(new URL('./story-import-worker.mjs',import.meta.url));
}
export async function extractStoryImport(filename:string,bytes:Uint8Array,root=defaultRoot):Promise<ExtractedStoryImport>{
 const format=formatOf(filename,bytes);
 if(active>=storyImportLimits.extractionWorkers)throw new ReaderError(429,'Two documents are already being read. Wait a moment and upload this story again.');
 active++;
 try{return await new Promise<ExtractedStoryImport>((resolve,reject)=>{
  // A source worker needs only Node's type stripping, not host/test/inspector flags that workers reject.
  const data=new Uint8Array(bytes),worker=new Worker(workerFile(path.resolve(root)),{workerData:{format,bytes:data.buffer},transferList:[data.buffer],resourceLimits:{maxOldGenerationSizeMb:192,maxYoungGenerationSizeMb:32,stackSizeMb:4},execArgv:['--experimental-strip-types']});
  let settled=false;
  const finish=(error?:unknown,value?:ExtractedStoryImport)=>{if(settled)return;settled=true;clearTimeout(timer);void worker.terminate().finally(()=>error?reject(error):resolve(value!));};
  const timer=setTimeout(()=>finish(new ReaderError(400,'Reading this document exceeded 30 seconds. Export a simpler text PDF or Word .docx file and try again.')),storyImportLimits.extractionTimeoutMs);
  worker.on('message',(message:unknown)=>{
   if(settled||!message||typeof message!=='object'||!('type' in message)||message.type!=='story-import-result')return;
   const result=message as {ok?:boolean;error?:string;value?:ExtractedStoryImport};
   if(result.ok!==true||!result.value){finish(new ReaderError(400,typeof result.error==='string'&&result.error||'The complete document could not be read.'));return;}
   try{const value=result.value;if(value.format!==format||canonicalImportText(value.text)!==value.text||value.units.length>50_000||!Array.isArray(value.warnings)||value.warnings.some(item=>typeof item!=='string')||format==='pdf'&&(value.pageCount===null||!Number.isInteger(value.pageCount)||value.pageCount<1||value.pageCount>storyImportLimits.pdfPages)||format==='docx'&&value.pageCount!==null)throw Error('Invalid parser result');validateImportedSource(value);finish(undefined,value);}catch{finish(new ReaderError(400,'The complete document could not be verified. Export a readable copy and try again.'));}
  });
  worker.once('error',()=>finish(new ReaderError(400,'The document is too complex to read safely or the local document reader is unavailable. Export a simpler text PDF or Word .docx file and try again.')));
  worker.once('exit',()=>{if(!settled)finish(new ReaderError(400,'The document reader stopped before the complete story was extracted. Try a fresh readable copy.'));});
 });}finally{active--;}
}
