// Add public XMP to static WebP without touching encoded pixels. Hash exact, documented byte scopes.
import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex} from '@noble/hashes/utils.js';
import type {Story} from './content';
import {imageDimensions} from './reader-image-dimensions.ts';
import {aiDisclosure,publicationText} from './story-publication.ts';
import type {PublicationStory} from './story-publication.ts';

export type StoryImageHashes={sha256:string;originalSha256:string;imagePayloadSha256:string};
type ImageMetadataStory=PublicationStory&Pick<Story,'id'|'title'|'revision'|'sourceUrl'>;

const encoder=new TextEncoder(),decoder=new TextDecoder();
export const payloadHashScope='RIFF ICCP/ALPH/VP8/VP8L chunks including headers and padding, in file order';
export const sha256Hex=(bytes:Uint8Array)=>bytesToHex(sha256(bytes));
function chunks(bytes:Uint8Array){
 if(bytes.length<20||decoder.decode(bytes.subarray(0,4))!=='RIFF'||decoder.decode(bytes.subarray(8,12))!=='WEBP'||new DataView(bytes.buffer,bytes.byteOffset).getUint32(4,true)+8!==bytes.length)throw Error('无效的 WebP 文件。');
 const result:{tag:string;bytes:Uint8Array;data:Uint8Array}[]=[];
 let offset=12;
 while(offset<bytes.length){
  if(offset+8>bytes.length)throw Error('WebP 数据不完整。');
  const size=new DataView(bytes.buffer,bytes.byteOffset+offset+4,4).getUint32(0,true),end=offset+8+size+(size%2);
  if(end>bytes.length)throw Error('WebP 数据不完整。');
  result.push({tag:decoder.decode(bytes.subarray(offset,offset+4)),bytes:bytes.subarray(offset,end),data:bytes.subarray(offset+8,offset+8+size)});offset=end;
 }
 return result;
}
function chunk(tag:string,data:Uint8Array){
 const result=new Uint8Array(8+data.length+(data.length%2));result.set(encoder.encode(tag));new DataView(result.buffer).setUint32(4,data.length,true);result.set(data,8);return result;
}
export function webpPayloadHash(bytes:Uint8Array){
 const digest=sha256.create();let images=0;
 for(const part of chunks(bytes))if(['ICCP','ALPH','VP8 ','VP8L'].includes(part.tag)){digest.update(part.bytes);if(part.tag==='VP8 '||part.tag==='VP8L')images++;}
 if(images!==1)throw Error('只支持单幅 WebP 插图。');
 return bytesToHex(digest.digest());
}
export function xmlText(value:string){
 return Array.from(value).filter(char=>{const n=char.codePointAt(0)!;return n===9||n===10||n===13||n>=32&&n<=0xd7ff||n>=0xe000&&n<=0xfffd||n>=0x10000&&n<=0x10ffff;}).join('').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
export function publicImageXmp(story:ImageMetadataStory,page:number,originalHash:string,payloadHash:string){
 const properties:Record<string,string>={StoryId:story.id,Revision:String(story.revision),Frame:String(page+1),AIGenerated:'generated'in story&&story.generated===true?'true':'unknown',OriginalFileSHA256:originalHash,ImagePayloadSHA256:payloadHash,HashScope:payloadHashScope,WorkURL:story.publication?.workUrl||'',SourceURL:story.sourceUrl,Contact:story.publication?.contact||'',SourceLicense:story.publication?.sourceNote||'',Reuse:story.publication?.reuse||''};
 return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:shiqu="https://github.com/yysun/shiqu/ns/1.0/" ${Object.entries(properties).map(([key,value])=>`shiqu:${key}="${xmlText(value)}"`).join(' ')}><dc:creator><rdf:Seq><rdf:li>${xmlText(story.publication?.author||'未署名')}</rdf:li></rdf:Seq></dc:creator><dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xmlText(story.title)}</rdf:li></rdf:Alt></dc:title><dc:description>${xmlText(aiDisclosure(story))}</dc:description><dc:rights><rdf:Alt><rdf:li xml:lang="x-default">${xmlText(publicationText(story))}</rdf:li></rdf:Alt></dc:rights></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
}
// Validate the same hashes and XMP declarations the browser writes; retain historical title/rights text.
export function assertStoryWebp(bytes:Uint8Array,story:ImageMetadataStory,page:number,hashes:StoryImageHashes){
 const fail=(message:string)=>{throw Error(`第 ${page+1} 幅${message}`);};
 if(!imageDimensions(bytes))fail(' WebP 图片结构或尺寸无效。');
 for(const key of ['sha256','originalSha256','imagePayloadSha256'] as const)if(!/^[a-f0-9]{64}$/.test(hashes[key]))fail(`缺少有效的 ${key}。`);
 if(sha256Hex(bytes)!==hashes.sha256)fail('图片 SHA-256 不符。');
 if(webpPayloadHash(bytes)!==hashes.imagePayloadSha256)fail('图片像素载荷哈希不符。');
 const records=chunks(bytes).filter(part=>part.tag==='XMP ');
 if(records.length!==1)fail('缺少唯一的 XMP 署名；请重新从拾趣下载 ZIP。');
 const actual=decoder.decode(records[0].data),expected=publicImageXmp(story,page,hashes.originalSha256,hashes.imagePayloadSha256);
 for(const [attribute] of expected.matchAll(/shiqu:\w+="[^"]*"/g))if(!actual.includes(attribute))fail(` XMP ${attribute.split('=')[0]} 与故事不符；请重新从拾趣下载 ZIP。`);
 for(const [tag,label] of [['creator','制作署名'],['description','AI 披露']]){
  const value=expected.match(new RegExp(`<dc:${tag}>[\\s\\S]*?</dc:${tag}>`))![0];
  if(!actual.includes(value))fail(` XMP ${label}不符。`);
 }
}
export function withWebpXmp(bytes:Uint8Array,xmp:string){
 const dimensions=imageDimensions(bytes);if(!dimensions)throw Error('无效的静态 WebP 图片。');
 const parts=chunks(bytes);if(parts.some(part=>['ANIM','ANMF'].includes(part.tag)))throw Error('只支持单幅 WebP 插图。');
 const header=parts.find(part=>part.tag==='VP8X')?.data.slice()||new Uint8Array(10);
 // Rebuild feature bits from retained chunks, not stale metadata flags.
 const lossless=parts.find(part=>part.tag==='VP8L');
 const alpha=parts.some(part=>part.tag==='ALPH')||!!(lossless?.data[4]&&lossless.data[4]&16);
 header[0]=(parts.some(part=>part.tag==='ICCP')?32:0)|(alpha?16:0)|4;
 header.fill(0,1,4);
 for(const [index,value] of [[4,dimensions.width-1],[7,dimensions.height-1]])for(let i=0;i<3;i++)header[index+i]=(value>>>(8*i))&255;
 const retained=parts.filter(part=>!['VP8X','XMP ','EXIF'].includes(part.tag));
 const encoded=[chunk('VP8X',header),...retained.map(part=>part.bytes),chunk('XMP ',encoder.encode(xmp))];
 const result=new Uint8Array(12+encoded.reduce((sum,part)=>sum+part.length,0));result.set(encoder.encode('RIFF'));new DataView(result.buffer).setUint32(4,result.length-8,true);result.set(encoder.encode('WEBP'),8);
 let offset=12;for(const part of encoded){result.set(part,offset);offset+=part.length;}
 return result;
}
