// English product messages; source evidence and machine identifiers remain stable.
// Index chapter scan scopes and isolated stories without altering original source glyphs.
// Chapters can be scanned despite local defects; direct stories and extracted candidates retain strict quality gates.
import {ReaderError} from '../lib/reader-model.ts';
import type {Selection} from '../lib/reader-model.ts';
import {contentSearchText,contentSearchTerms} from '../lib/reader-contents.ts';
import type {BookContents,BookContentEntry} from '../lib/reader-contents.ts';
import {localSourceKey} from '../lib/reader-local-contract.ts';
import type {LocalBooks,LocalBook} from './local-books.ts';
import {readerBooks} from '../lib/reader-books.ts';
import type {LocalSourceReference} from '../lib/reader-local-contract.ts';
import {sourceRanges} from '../lib/reader-local-contract.ts';
const namedHeading=(text:string)=>/^[\p{Script=Han}0-9]{1,12}$/u.test(text);
// A LocalBook is immutable and edition-bound; cache normalized text without exposing it in API responses.
const searchIndexes=new WeakMap<LocalBook,Map<string,string>>();
// Display labels never reuse Chinese source headings or change source range identities.
export function englishSourceLabel(book:LocalBook,source:LocalSourceReference){
 const title=readerBooks.find(item=>item.id===book.id)?.title||'Selected book';
 const chapters=sourceRanges(source).map(range=>book.sections.findIndex(section=>section.id===range.sectionId)+1);
 return `${title} · ${chapters.length===1?'Chapter':'Chapters'} ${[...new Set(chapters)].join(', ')}`;
}
export function indexBookContents(books:LocalBooks,book:LocalBook,query=''):BookContents{
 const entries:BookContentEntry[]=[],terms=contentSearchTerms(query);
 let searchIndex=searchIndexes.get(book);if(!searchIndex){searchIndex=new Map();searchIndexes.set(book,searchIndex);}
 let storyNumber=0;
 for(const [sectionIndex,section]of book.sections.entries()){
  const starts=book.id==='shishuo'?section.units.map((_,i)=>i):book.id==='liaozhai'?section.units.flatMap((u,i)=>namedHeading(u.text)?[i]:[]):[0];
  for(const [n,first]of starts.entries()){
   const last=(starts[n+1]??section.units.length)-1,unit=section.units[first];if(!unit)continue;
   const sourceTitle=(book.id==='liaozhai'?unit.text:book.id==='shishuo'?`${section.title} · ${first+1}`:section.title).slice(0,100);
   const kind=book.id==='liaozhai'||book.id==='shishuo'?'story':'chapter';
   const chapter=`Chapter ${sectionIndex+1}`,title=kind==='story'?`Story ${++storyNumber}`:chapter;
   const source={edition:book.edition,sectionId:section.id,firstUnit:unit.id,lastUnit:section.units[last].id};
   const body=section.units.slice(book.id==='liaozhai'?first+1:first,last+1).map(u=>u.text).join(' ');
   if(terms.length){
    let text=searchIndex.get(unit.id);if(text===undefined){text=contentSearchText(title+' '+chapter+' '+sourceTitle+' '+section.title+' '+body);searchIndex.set(unit.id,text);}
    if(!terms.every(term=>text.includes(term)))continue;
   }
   const entry:BookContentEntry={kind,id:unit.id,title,chapter,excerpt:'English source translation is prepared after selecting a story.'};
   try{if(kind==='story')books.resolve(book,source);entry.source=source;}
   catch(error){if(!(error instanceof ReaderError)||error.status!==400)throw error;entry.unavailable='This source has missing text or exceeds the production input budget and cannot be selected.';}
   entries.push(entry);
  }
 }
 return {bookId:book.id,title:readerBooks.find(item=>item.id===book.id)?.title||'Selected book',entries};
}
export async function bookContents(books:LocalBooks,selection:Selection,query=''){
 const book=await books.book(selection);if(!book)throw new ReaderError(400,'Direct selection is unavailable for this book. Search by theme instead.');
 return indexBookContents(books,book,query);
}
export async function directBookChoice(books:LocalBooks,selection:Selection){
 const book=await books.book(selection);if(!book||!selection.source)throw new ReaderError(400,'Select a built-in story or chapter again.');
 const key=localSourceKey(selection.source),entry=indexBookContents(books,book).entries.find(entry=>entry.source&&localSourceKey(entry.source)===key);
 if(!entry?.source)throw new ReaderError(400,'The selected story or chapter is no longer valid. Select it again.');
 return {entry,original:books.resolve(book,entry.source)};
}

// Canonical scopes allow whole chapters or one catalog story, never arbitrary slices or gaps within a chapter.
export function selectedChapterScope(books:LocalBooks,book:LocalBook,references:NonNullable<Selection['discoverySources']>){
 const requested=new Set(references.map(localSourceKey));
 if(!references.length||references.length>24||requested.size!==references.length)throw new ReaderError(400,'Choose 1–24 distinct chapters.');
 const entries=indexBookContents(books,book).entries.filter(entry=>entry.source&&requested.has(localSourceKey(entry.source)));
 if(entries.length!==references.length)throw new ReaderError(400,'The chapter range is no longer valid. Select chapters from the same book again.');
 if(entries.some(entry=>entry.kind==='story')&&entries.length!==1)throw new ReaderError(400,'Select one existing story passage, or choose complete chapters for a cross-chapter story.');
 const discoverySources=entries.map(entry=>entry.source!),ids=new Set(discoverySources.map(source=>source.sectionId));
 const sections=book.sections.filter(section=>ids.has(section.id)).map(section=>{
  const source=discoverySources.find(source=>source.sectionId===section.id)!;
  return {...section,units:section.units.slice(section.units.findIndex(unit=>unit.id===source.firstUnit),section.units.findIndex(unit=>unit.id===source.lastUnit)+1)};
 });
 const text=sections.map(section=>`篇章 ${section.id}：${section.title}\n`+section.units.map(unit=>`[${unit.id}]\n${unit.text}`).join('\n\n')).join('\n\n');
 return {discoverySources,book:{...book,sections,input:{...book.input,text}}};
}
