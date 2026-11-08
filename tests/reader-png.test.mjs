// English product expectations; historical source fixtures remain explicit test data.
// Verify shared comic-sheet completeness, source order and readable narration across supported story sizes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeStory} from './fixtures/story.mjs';
import {layoutComicPanel} from '../lib/comic-page-layout.ts';
import {assertPngReady,layoutStoryPng,pngFilename} from '../lib/reader-png.ts';

const measure=(text,size)=>Array.from(text).length*size;
test('PNG export requires every image and produces a safe PNG filename',()=>{
 const story=makeStory();
 assert.throws(()=>assertPngReady({...story,pages:[]}),/Complete every image/);
 assert.throws(()=>assertPngReady({...story,pages:story.pages.map((p,i)=>i===4?{...p,image:''}:p)}),/Complete every image/);
 assert.equal(pngFilename('故事/名字?'),'故事名字-Shiqu-overview.png');
});

test('comic overviews retain every source panel in order for 4, 8, 10, 12, 16 and 30 frames',()=>{
 for(const count of [4,8,10,12,16,30]){
  const base=makeStory(),story={...base,pages:Array.from({length:count},(_,i)=>({...base.pages[i%10],caption:`Panel ${i+1} preserves its complete story detail.`}))},layout=layoutStoryPng(story,measure);
  assert.equal(layout.cells.length,layout.pages.length);assert.deepEqual(layout.pages.flatMap(page=>page.panels.map(panel=>panel.frameIndex)),Array.from({length:count},(_,index)=>index));
  assert.equal(new Set(layout.cells.map(cell=>`${cell.x},${cell.y}`)).size,layout.pages.length);assert.ok(layout.cells.every(cell=>cell.x>=0&&cell.x+900<=layout.width&&cell.y+1350<layout.footerY));
  for(const page of layout.pages)for(const panel of page.panels){const presentation=layoutComicPanel(story.pages[panel.frameIndex],panel);assert.equal(presentation.captionLines.map(line=>line.text).join(' '),story.pages[panel.frameIndex].caption);assert.ok(presentation.captionFontSize>=20);}
  assert.ok(layout.height>layout.footerY+layout.reflection.length*56);assert.equal(layout.columns,layout.pages.length>1?2:1);
 }
});

test('long titles, narration and reflections retain all content without overlapping comic sheets',()=>{
 const base=makeStory(),story={...base,title:'A very long story title '.repeat(10),reflection:'A final observation worth considering. '.repeat(20),pages:Array.from({length:12},(_,i)=>({...base.pages[i%10],caption:i===0?'The travelers pause to consider a difficult choice before continuing along the river. '.repeat(5).trim():'They continue beside the river.'}))},layout=layoutStoryPng(story,measure);
 assert.ok(layout.title.length>1);assert.ok(layout.reflection.length>1);
 for(const cell of layout.cells){const nextRow=layout.cells.find(other=>other.y>cell.y);assert.ok(cell.y+1350<(nextRow?.y??layout.footerY));for(const panel of cell.page.panels){const presentation=layoutComicPanel(story.pages[panel.frameIndex],panel);assert.ok(presentation.captionLines.every(line=>line.y+presentation.captionLineHeight<=presentation.signature.y));}}
 assert.ok(layout.title.every(line=>measure(line,52)<=layout.width-72));assert.ok(layout.reflection.every(line=>measure(line,36)<=layout.width-72));
 assert.notEqual(layout.pages[0].panels[0].span,'normal');assert.equal(layoutComicPanel(story.pages[0],layout.pages[0].panels[0]).captionLines.map(line=>line.text).join(' '),story.pages[0].caption);
 assert.equal(layout.reflection.join(' '),'A final thought: '+story.reflection.trim());
});

test('English captions wrap between words and generated exports require the saved English source',async()=>{
 const {wrapPdfText}=await import('../lib/reader-pdf.ts');
 const text='The philosopher wakes beside a tree and wonders whether his dream has truly ended.';
 const lines=wrapPdfText(text,28,value=>value.length);
 assert.ok(lines.length>1);assert.ok(lines.every(line=>line.length<=28));
 assert.equal(lines.join(' '),text);
 assert.throws(()=>assertPngReady({...makeStory(1),generated:true,sourceText:''}),/saved English source/);
});

test('an eighty-splash overview reports the canvas limit rather than dropping or clipping panels',()=>{const base=makeStory(1);assert.throws(()=>layoutStoryPng({...base,pages:Array.from({length:80},()=>({...base.pages[0],panel:'splash'}))},measure),/too large.*PDF/);});
