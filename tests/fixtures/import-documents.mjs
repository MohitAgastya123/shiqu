// Produce genuine small Office/PDF fixtures for the production importer and browser flows.
// Text and synthetic page images are controlled test data, without private documents or external downloads.
import {zipSync,strToU8} from 'fflate';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
const xml=text=>String(text).replace(/[&<>"']/g,value=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[value]));
export function importDocx(paragraphs,{headingIndexes=[],externalReference=false,footnote='',endnote=''}={}){
 const document='<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+paragraphs.map((text,index)=>`<w:p>${headingIndexes.includes(index)?'<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>':''}<w:r><w:t xml:space="preserve">${xml(text)}</w:t></w:r>${footnote&&index===0?'<w:r><w:footnoteReference w:id="1"/></w:r>':''}${endnote&&index===paragraphs.length-1?'<w:r><w:endnoteReference w:id="1"/></w:r>':''}</w:p>`).join('')+'<w:sectPr/></w:body></w:document>';
 const relationships=[...(externalReference?['<Relationship Id="outside" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="file:///not-a-real-private-test-path" TargetMode="External"/>']:[]),...(footnote?['<Relationship Id="footnotes" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>']:[]),...(endnote?['<Relationship Id="endnotes" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/endnotes" Target="endnotes.xml"/>']:[])];
 return zipSync({
  '[Content_Types].xml':strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'),
  '_rels/.rels':strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
  'word/document.xml':strToU8(document),
  'word/styles.xml':strToU8('<?xml version="1.0"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style></w:styles>'),
  ...(relationships.length?{'word/_rels/document.xml.rels':strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+relationships.join('')+'</Relationships>')}:{}),
  ...(footnote?{'word/footnotes.xml':strToU8('<?xml version="1.0"?><w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:footnote w:id="1"><w:p><w:r><w:t>'+xml(footnote)+'</w:t></w:r></w:p></w:footnote></w:footnotes>')}:{}),
  ...(endnote?{'word/endnotes.xml':strToU8('<?xml version="1.0"?><w:endnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:endnote w:id="1"><w:p><w:r><w:t>'+xml(endnote)+'</w:t></w:r></w:p></w:endnote></w:endnotes>')}:{}),
 });
}
export async function importPdf(pages,{imageOnlyPages=[]}={}){
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
 for(const [index,text]of pages.entries()){
  let page=pdf.addPage([612,792]),y=750;
  if(imageOnlyPages.includes(index+1)){page.drawRectangle({x:50,y:100,width:300,height:400,color:rgb(.3,.5,.6)});continue;}
  for(const paragraph of text.split('\n')){
   const words=paragraph.split(/\s+/).filter(Boolean);let line='';
   const draw=()=>{if(y<40){page=pdf.addPage([612,792]);y=750;}page.drawText(line,{x:40,y,size:11,font});y-=16;line='';};
   for(const word of words){if(line&&font.widthOfTextAtSize(line+' '+word,11)>530)draw();line+=(line?' ':'')+word;}if(line)draw();y-=6;
  }
 }
 return new Uint8Array(await pdf.save({useObjectStreams:false}));
}
