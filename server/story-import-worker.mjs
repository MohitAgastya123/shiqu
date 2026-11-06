// Decode uploaded documents in an isolated, time-limited worker without rendering their HTML or scripts.
// Preserve readable pages, paragraphs and referenced notes; intermediate Word HTML becomes plain text only.
import {parentPort,workerData} from 'node:worker_threads';
import {fileURLToPath} from 'node:url';
import {crc32} from 'node:zlib';
import '@napi-rs/canvas';
import mammoth from 'mammoth';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {strFromU8,Unzip,UnzipInflate} from 'fflate';
import {parseDocument} from 'htmlparser2';
import {storyImportLimits} from '../lib/story-import-contract.ts';
import {canonicalImportText,importedSourceUnits} from '../lib/story-import-text.ts';

const bad=(message)=>{throw Error(message);};
function docxEntries(bytes){
 const limit=()=>bad('This Word document expands beyond the safe reading limit. Export a simpler .docx file.'),invalid=()=>bad('This Word document is damaged or its declared content sizes do not match. Save a fresh .docx copy and try again.');
 const expected=new Map(),seen=new Set(),complete=new Set(),entries=Object.create(null);let declared=0,actual=0;
 try{
  // Read metadata without expanding it, then independently validate every member's actual output.
  // Small compressed input chunks bound transient inflate buffers even when ZIP sizes are forged.
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),checksum=()=>bad('This Word document is damaged and its ZIP checksum does not match. Save a fresh .docx copy and try again.');
  const minimumEnd=Math.max(0,bytes.length-65557);let end=bytes.length-22;for(;end>=minimumEnd;end--)if(view.getUint32(end,true)===0x06054b50&&end+22+view.getUint16(end+20,true)===bytes.length)break;
  if(end<minimumEnd||view.getUint16(end+4,true)||view.getUint16(end+6,true)||view.getUint16(end+8,true)!==view.getUint16(end+10,true))invalid();
  const count=view.getUint16(end+10,true),directory=view.getUint32(end+16,true),directoryEnd=directory+view.getUint32(end+12,true);let cursor=directory;if(count>4096)limit();if(directoryEnd>end)invalid();
  for(let number=0;number<count;number++){
   if(cursor+46>directoryEnd||view.getUint32(cursor,true)!==0x02014b50)invalid();
   const flags=view.getUint16(cursor+8,true),nameEnd=cursor+46+view.getUint16(cursor+28,true),next=nameEnd+view.getUint16(cursor+30,true)+view.getUint16(cursor+32,true),local=view.getUint32(cursor+42,true);
   if(next>directoryEnd||local+30>directory||view.getUint32(local,true)!==0x04034b50||flags&1||view.getUint16(cursor+34,true))invalid();
   const entry={name:strFromU8(bytes.subarray(cursor+46,nameEnd),!(flags&2048)),compression:view.getUint16(cursor+10,true),size:view.getUint32(cursor+20,true),originalSize:view.getUint32(cursor+24,true),crc:view.getUint32(cursor+16,true)};
   if(!(view.getUint16(local+6,true)&8)&&view.getUint32(local+14,true)!==entry.crc)checksum();
   if(expected.has(entry.name))invalid();expected.set(entry.name,entry);declared+=entry.originalSize;cursor=next;
   if(expected.size>4096||declared>64*1024*1024||entry.originalSize>16*1024*1024)limit();
  }
  if(cursor!==directoryEnd)invalid();
  const stream=new Unzip(file=>{
   const entry=expected.get(file.name);if(!entry||seen.has(file.name)||file.compression!==entry.compression||file.size!==undefined&&file.size!==entry.size||file.originalSize!==undefined&&file.originalSize!==entry.originalSize)invalid();seen.add(file.name);
   const keep=['[Content_Types].xml','word/document.xml','word/styles.xml'].includes(file.name),chunks=[];let length=0,crc=0;
   file.ondata=(error,chunk,final)=>{
    if(error)throw error;length+=chunk.length;actual+=chunk.length;
    if(length>16*1024*1024||actual>64*1024*1024)limit();if(length>entry.originalSize)invalid();
    crc=crc32(chunk,crc);if(keep)chunks.push(chunk);
    if(final){if(length!==entry.originalSize)invalid();if(crc!==entry.crc)checksum();complete.add(file.name);if(keep){const value=new Uint8Array(length);let offset=0;for(const part of chunks){value.set(part,offset);offset+=part.length;}entries[file.name]=value;}}
   };file.start();
  });stream.register(UnzipInflate);
  for(let start=0;start<bytes.length;start+=1024)stream.push(bytes.subarray(start,start+1024),start+1024>=bytes.length);
  if(seen.size!==expected.size||complete.size!==expected.size)invalid();
  return entries;
 }catch(error){if(error instanceof Error&&/safe reading limit|declared content sizes|ZIP checksum/.test(error.message))throw error;bad('This Word document is damaged or is not a valid .docx file. Save a fresh .docx copy and try again.');}
}
function plainWordHtml(html){
 const document=parseDocument(html),notes=new Map(),expanded=new Set(),headings=[];
 function collect(node){if(node.type==='tag'&&node.name==='li'&&/^uploaded-(?:footnote|endnote)-/.test(node.attribs?.id||''))notes.set(node.attribs.id,node);for(const child of node.children||[])collect(child);}collect(document);
 function note(id){if(expanded.has(id))return '';const node=notes.get(id);if(!node)return '';expanded.add(id);const label=id.includes('endnote-')?'Endnote':'Footnote',text=render(node,true).trim();return text?` [${label}: ${text}] `:'';}
 function render(node,inNote=false){
  if(node.type==='text')return node.data;
  if(['script','style','img'].includes(node.name))return '';
  const id=node.attribs?.id,href=node.attribs?.href||'';
  if(node.name==='a'&&/^#uploaded-(?:footnote|endnote)-ref-/.test(href))return '';
  if(node.name==='a'&&notes.has(href.slice(1)))return note(href.slice(1));
  if(notes.has(id)&&!inNote)return '';
  const text=(node.children||[]).map(child=>render(child,inNote)).join('');
  if(/^h[1-6]$/.test(node.name)){if(text.trim())headings.push(text.trim());return '\n\n'+text+'\n\n';}
  if(node.name==='br')return '\n';
  if(['p','li','tr','div','blockquote'].includes(node.name))return '\n\n'+text+'\n\n';
  if(['td','th'].includes(node.name))return text+'\t';
  return text;
 }
 let text=render(document);for(const id of notes.keys())if(!expanded.has(id))text+='\n\n'+note(id);
 return {text:text.replace(/\n[\t ]+/g,'\n').replace(/\n{3,}/g,'\n\n'),headings};
}
function headingLocations(text,headings){
 const locations=new Map();
 for(const heading of new Set(headings.filter(value=>value.length<=160))){
  let cursor=0,index;
  while((index=text.indexOf(heading,cursor))>=0){const end=index+heading.length;cursor=end;if(index!==0&&text[index-1]!=='\n'||end<text.length&&text[end]!=='\n')continue;locations.set(index,{start:index,end,heading});}
 }
 return [...locations.values()].sort((a,b)=>a.start-b.start);
}
function pdfText(items){
 let text='',previous;
 for(const item of items){
  if(!('str'in item))continue;
  if(previous&&text&&!/\s$/.test(text)&&item.str&&!/^\s/.test(item.str)){
   const height=Math.max(Math.abs(item.height)||0,Math.abs(previous.height)||0,1),vertical=Math.abs(item.transform[5]-previous.transform[5]),gap=item.transform[4]-previous.transform[4]-previous.width;
   if(vertical>height*.4)text+='\n';else if(gap>height*.12)text+=' ';
  }
  text+=item.str;if(item.hasEOL)text+='\n';previous=item;
 }
 return text.replace(/[\t ]+\n/g,'\n').trim();
}
async function docx(bytes){
 const entries=docxEntries(bytes),decode=value=>value?new TextDecoder().decode(value):'';
 if(!entries['word/document.xml']||!entries['[Content_Types].xml']||!/application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document\.main\+xml/.test(decode(entries['[Content_Types].xml'])))bad('This is not a supported Word .docx document. Save it as .docx or a text PDF and try again.');
 const unsupported=()=>bad('This Word document contains unsupported content that could hide part of the story. Export it as a PDF with selectable text or a simpler .docx file and try again.');
 function checkContent(node){if(node.type==='tag'&&node.name.split(':').at(-1)==='altChunk')unsupported();for(const child of node.children||[])checkContent(child);}checkContent(parseDocument(decode(entries['word/document.xml']),{xmlMode:true}));
 let result;try{result=await mammoth.convertToHtml({buffer:Buffer.from(bytes)},{externalFileAccess:false,includeEmbeddedStyleMap:false,convertImage:()=>Promise.resolve([]),idPrefix:'uploaded-'});}catch{bad('This Word document could not be read. Save an unlocked, readable .docx copy and try again.');}
 // Only known style warnings are harmless to story text. Unknown elements, symbols and fields may lose content.
 const styleWarning=message=>message.type==='warning'&&(/^(?:Paragraph|Run) style with ID [\s\S]+ was referenced but not defined in the document$/.test(message.message)||/^Unrecognised (?:paragraph|run) style: '[\s\S]*' \(Style ID: [\s\S]*\)$/.test(message.message));
 if(result.messages.some(message=>!styleWarning(message)))unsupported();
 const plain=plainWordHtml(result.value),text=canonicalImportText(plain.text),headings=plain.headings;
 for(const match of text.matchAll(/^(?:chapter|part|book)\s+(?:\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten)\b[^\n]{0,120}$/gim))if(!headings.includes(match[0]))headings.push(match[0]);
 return {format:'docx',text,units:importedSourceUnits(text,headingLocations(text,headings)),pageCount:null,warnings:result.messages.length?['The document contains formatting that is not used in the plain-text story. Review the extracted preview before creating comics.']:[]};
}
async function pdf(bytes){
 let task;
 try{
  const library=import.meta.resolve('pdfjs-dist/legacy/build/pdf.mjs'),localAsset=name=>fileURLToPath(new URL('../../'+name+'/',library)).replaceAll('\\','/');
  task=getDocument({data:new Uint8Array(bytes),cMapUrl:localAsset('cmaps'),standardFontDataUrl:localAsset('standard_fonts'),cMapPacked:true,maxImageSize:16_000_000,isEvalSupported:false,enableXfa:false,stopAtErrors:true,useSystemFonts:false,disableFontFace:true,useWorkerFetch:false,useWasm:false,disableAutoFetch:true,disableStream:true,disableRange:true,verbosity:0});
  const document=await task.promise;
  if(document.numPages>storyImportLimits.pdfPages)bad('This PDF exceeds the 500-page limit. Upload a smaller complete story.');
  const metadata=await document.getMetadata();if(metadata.info.EncryptFilterName)bad('Encrypted PDFs are not supported. Save an unlocked text PDF and try again.');
  const pages=[],imageOnly=[];let characters=0,blank=0;
  const painting=new Set([OPS.paintImageXObject,OPS.paintInlineImageXObject,OPS.paintImageMaskXObject,OPS.paintImageMaskXObjectGroup,OPS.paintInlineImageXObjectGroup,OPS.paintSolidColorImageMask,OPS.paintImageXObjectRepeat,OPS.fill,OPS.eoFill,OPS.stroke,OPS.fillStroke,OPS.eoFillStroke]);
  for(let number=1;number<=document.numPages;number++){
   const page=await document.getPage(number);
   try{
    const content=await page.getTextContent(),text=pdfText(content.items);
    if(!text){const operators=await page.getOperatorList(),visible=operators.fnArray.some((operation,index)=>painting.has(operation)||operation===OPS.constructPath&&painting.has(operators.argsArray[index]?.[0])),nonblank=operators.fnArray.some(operation=>operation!==OPS.save&&operation!==OPS.restore);if(visible||nonblank)imageOnly.push(number);else blank++;}
    pages.push({page:number,text});characters+=text.length+2;
    if(characters>storyImportLimits.textCharacters)bad('This PDF exceeds the 2 million character text limit. Upload a smaller complete story.');
   }finally{page.cleanup();}
  }
  if(imageOnly.length)bad(`PDF ${imageOnly.length===1?'page':'pages'} ${imageOnly.slice(0,12).join(', ')}${imageOnly.length>12?' and others':''} ${imageOnly.length===1?'has':'have'} images or outlines without readable text. Upload a PDF with selectable text or a Word .docx file; scanned pages cannot be skipped.`);
  const nonempty=pages.filter(page=>page.text),text=canonicalImportText(nonempty.map(page=>page.text).join('\n\n')),locations=[];let start=0;
  for(const page of nonempty){const end=start+page.text.length+(page===nonempty.at(-1)?0:2);locations.push({start,end,page:page.page});start=end;}
  return {format:'pdf',text,units:importedSourceUnits(text,locations),pageCount:document.numPages,warnings:blank?[`${blank} blank PDF ${blank===1?'page contains':'pages contain'} no story text. Original page numbers are retained.`]:[]};
 }catch(error){
  if(error?.name==='PasswordException')bad('This PDF is password-protected. Save an unlocked text PDF and try again.');
  const message=error instanceof Error?error.message:'';
  if(/^(?:This PDF|PDF page|PDF pages|Encrypted PDFs|No readable|The (?:document|extracted))/.test(message))throw error;
  bad('This PDF is damaged or its complete text could not be read. Export a readable text PDF or Word .docx file and try again.');
 }finally{await task?.destroy().catch(()=>{});}
}
try{
 if(!parentPort||!workerData?.bytes||!['docx','pdf'].includes(workerData.format))bad('The document reader received an invalid request.');
 const bytes=new Uint8Array(workerData.bytes);
 if(bytes.length>storyImportLimits.fileBytes)bad('The file exceeds the 10 MiB upload limit.');
 const value=await (workerData.format==='docx'?docx(bytes):pdf(bytes));parentPort.postMessage({ok:true,value});
}catch(error){parentPort?.postMessage({ok:false,error:error instanceof Error?error.message:'The document could not be read completely.'});}
finally{parentPort?.close();}
