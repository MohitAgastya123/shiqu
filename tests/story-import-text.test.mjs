// Verify complete canonical source spans, natural automatic parts and independent coverage input.
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalImportText,importedSourceUnits,validateImportedSource,planImportedStory,importCoverageUnits,importWordCount} from '../lib/story-import-text.ts';
const source=text=>({text,units:importedSourceUnits(text)});
test('canonical extraction preserves Unicode words, normalizes line endings and rejects unreadable text',()=>{
 assert.equal(canonicalImportText('  María meets Φίλιππος.\r\nОни читают.  '),'María meets Φίλιππος.\nОни читают.');assert.equal(importWordCount('Mara crosses the river.'),4);
 for(const text of ['', '  ','\u0000broken','Missing \uFFFD text','Broken \uE123 text','x'.repeat(2_000_001)])assert.throws(()=>canonicalImportText(text));
});
test('source units preserve all source characters, real page offsets, headings and the final sentinel',()=>{
 const first='Chapter One\n\n'+('The traveler follows a winding river. '.repeat(130)),second='Chapter Two\n\n'+('A friend finds a safe path. '.repeat(110))+'FINAL_SENTINEL',text=first+'\n\n'+second,start=first.length+2;
 const units=importedSourceUnits(text,[{start:0,end:start,page:1,heading:'Chapter One'},{start,end:text.length,page:2,heading:'Chapter Two'}]);validateImportedSource({text,units});assert.equal(units.map(unit=>text.slice(unit.start,unit.end)).join(''),text);assert.ok(units.every(unit=>unit.end-unit.start<=1200));assert.ok(units.some(unit=>unit.heading==='Chapter Two'&&unit.page===2));assert.match(text.slice(units.at(-1).start),/FINAL_SENTINEL$/);
});
test('long paragraphs divide at words and never split surrogate pairs or unbroken tokens',()=>{
 const text='🙂 '+('A meaningful sentence retains every complete word. '.repeat(200)),units=importedSourceUnits(text);assert.equal(units.map(unit=>text.slice(unit.start,unit.end)).join(''),text);assert.ok(units.every(unit=>text.slice(unit.start,unit.end).isWellFormed()));assert.throws(()=>importedSourceUnits('w'.repeat(1201)),/word|unbroken/);
});
test('saved ranges reject gaps, overlap, duplicate identities and missing final text',()=>{
 const original=source('A traveler walks through the mountains. '.repeat(100));for(const mutate of [v=>v.units[0].start++,v=>v.units[1].start--,v=>v.units[1].id=v.units[0].id,v=>v.units.pop()]){const value=structuredClone(original);mutate(value);assert.throws(()=>validateImportedSource(value));}
});
test('short stories remain one comic and four natural chapters become four complete ordered parts',()=>{
 const brief=source('A traveler frees a trapped bird. Later the bird leads her away from danger.');assert.equal(planImportedStory(brief,'The Traveler','balanced').length,1);
 const chapters=Array.from({length:4},(_,index)=>`Chapter ${index+1}\n\n`+(`The traveler completes action ${index+1} and keeps the shared promise. `.repeat(120))),text=chapters.join('\n\n'),locations=[];let start=0;
 for(const [index,chapter]of chapters.entries()){const end=start+chapter.length+(index===chapters.length-1?0:2);locations.push({start,end,heading:'Chapter '+(index+1)});start=end;}
 const book={text,units:importedSourceUnits(text,locations)},parts=planImportedStory(book,'The Promise','balanced');assert.equal(parts.length,4);assert.deepEqual(parts.map(part=>part.number),[1,2,3,4]);assert.equal(parts.map(part=>text.slice(part.start,part.end)).join(''),text);assert.equal(parts[3].title,'The Promise — Part 4');for(const part of parts)assert.ok(book.units.findIndex(unit=>unit.id===part.lastUnit)-book.units.findIndex(unit=>unit.id===part.firstUnit)<24);
});
test('detail budgets change part size without fixing the count or dropping the ending',()=>{
 const book=source('The travelers face a new choice and resolve it together. '.repeat(1000)+'FINAL_SENTINEL'),brief=planImportedStory(book,'Journey','brief'),balanced=planImportedStory(book,'Journey','balanced'),detailed=planImportedStory(book,'Journey','detailed');assert.ok(brief.length<=balanced.length&&balanced.length<=detailed.length);for(const parts of [brief,balanced,detailed])assert.equal(parts.at(-1).end,book.text.length);
});
test('excessive part count fails clearly instead of losing source units',()=>{
 const text='word '.repeat(24*24*201),units=Array.from({length:24*201},(_,index)=>({id:'u'+index,start:index*120,end:(index+1)*120}));assert.throws(()=>planImportedStory({text,units},'Long story','detailed'),/more than 200/);
});
test('English coverage evidence is complete, ordered and at most twenty-four chunks',()=>{
 for(const text of ['A complete short ending.','The friends keep their promise and reach the shore. '.repeat(600)+'FINAL_SENTINEL','W'.repeat(2000)]){const units=importCoverageUnits(text);assert.ok(units.length<=24);assert.equal(units.map(unit=>unit.text).join(''),text);assert.equal(new Set(units.map(unit=>unit.id)).size,units.length);assert.equal(units.at(-1).end,text.length);}
 assert.throws(()=>importCoverageUnits('  '),/no readable/);
});
test('short source articles stay one meaningful coverage unit and tiny trailing fragments merge',()=>{
 const short='A traveler returns home and shares the news.';assert.equal(importCoverageUnits(short).length,1);assert.equal(importCoverageUnits(short)[0].text,short);assert.throws(()=>importCoverageUnits('A'),/complete story passage/);
 const text='The traveler keeps the promise and returns to the shore. '.repeat(35)+'A ';const units=importCoverageUnits(text);assert.ok(units.every(unit=>(unit.text.match(/[\p{L}\p{N}]/gu)?.length||0)>=2));assert.equal(units.map(unit=>unit.text).join(''),text);
});
