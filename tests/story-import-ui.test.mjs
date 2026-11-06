// Verify actual import controls, complete-source previews and numeric series navigation using shared public views.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {defaultStoryImportSettings} from '../lib/story-import-contract.ts';
const compiled=build({stdin:{contents:"export {default as Import} from './client/ui/StoryImportSetup.tsx';export {default as Overview,StorySeriesShelf as Shelf} from './client/ui/StorySeriesOverview.tsx';export {default as ReaderShelf} from './client/ui/ReaderShelf.tsx';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',loader:{'.css':'empty'}}).then(bundle=>{const module={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);return module.exports;});
const source={id:'source',fileName:'A River Journey.docx',format:'docx',fileSha256:'file-hash',textSha256:'text-hash',characters:16000,wordCount:2400,pageCount:null,warnings:[],preview:{text:'Mara and Ivo follow the river. Final source sentinel.',start:0,end:51,total:16000,hasMore:true}};
const parts=Array.from({length:12},(_,i)=>({number:i+1,title:`A River Journey — Part ${i+1}`,firstUnit:`u${i}`,lastUnit:`u${i}`,start:i*100,end:(i+1)*100,sourceCharacters:100,wordCount:25,rootId:`root${i}`,sessionId:i===11?null:`part${i}`,state:i===0?'completed':i===1?'failed':'waiting',ready:i===0?3:0,total:i<2?3:null,stage:i===1?'Storyboard review needs revision':'Waiting',error:i===1?'A source passage still needs review.':null}));
const series={id:'series',title:'A River Journey',source,settings:defaultStoryImportSettings,version:3,state:'needs-attention',parts:[...parts].reverse(),completedParts:1,totalParts:12,error:null,createdAt:'now',updatedAt:'now'};
const props=()=>({source,plan:{sourceId:source.id,title:series.title,settings:defaultStoryImportSettings,parts:parts.slice(0,4),sourceCharacters:16000,wordCount:2400},title:series.title,settings:defaultStoryImportSettings,busy:'',error:'',planning:false,previewBusy:false,planReady:true,connected:true,onUpload:async()=>{},onTitle:()=>{},onSettings:()=>{},onCreate:async()=>{},onMoreSource:async()=>{},onConfigure:()=>{},onRetryPlan:()=>{}});

test('upload preview accepts actual document files and explains automatic complete-source parts before creation',async()=>{
 const {Import}=await compiled,html=renderToStaticMarkup(createElement(Import,props()));
 assert.match(html,/type="file"/);assert.match(html,/accept="\.docx,\.pdf/);assert.match(html,/Choose Word or PDF story/);assert.match(html,/4 comic parts/);assert.match(html,/Create all parts/);assert.match(html,/Final source sentinel/);assert.match(html,/Read more source/);assert.match(html,/Reading the file and dividing it into parts happen locally/);assert.doesNotMatch(html,/Find stories|Choose another story|position.*balloons/i);
});
test('unconfigured generation still exposes local extraction and blocks commissioning without hiding the saved source',async()=>{
 const {Import}=await compiled,html=renderToStaticMarkup(createElement(Import,{...props(),connected:false,error:'This PDF contains scanned images without readable text.'}));assert.match(html,/Choose Word or PDF story/);assert.match(html,/Final source sentinel/);assert.match(html,/Configure generation service/);assert.match(html,/role="alert"/);assert.doesNotMatch(html,/>Create all parts</);
 const pending=renderToStaticMarkup(createElement(Import,{...props(),planning:true,planReady:false}));assert.match(pending,/Updating automatic parts/);assert.match(pending,/disabled=""[^>]*>Create all parts/);
});
test('a valid source with no initial plan keeps its preview and preferences while creation waits for a valid plan',async()=>{
 const {Import}=await compiled,html=renderToStaticMarkup(createElement(Import,{...props(),plan:null,planReady:false,error:'This story needs more than 200 comic parts. Choose a briefer narrative detail.'}));assert.match(html,/Final source sentinel/);assert.match(html,/Art style and story preferences/);assert.match(html,/Comic title/);assert.match(html,/Automatic parts need an adjustment/);assert.match(html,/complete source is saved/);assert.match(html,/more than 200 comic parts/);assert.match(html,/disabled=""[^>]*>Create all parts/);assert.doesNotMatch(html,/<h3>0 comic parts<\/h3>/);
});
test('series overview and shelf preserve numeric part order and prevent opening uncreated parts',async()=>{
 const {Overview,Shelf}=await compiled,html=renderToStaticMarkup(createElement(Overview,{series,busy:'',error:'',onControl:async()=>{},onOpenPart:()=>{},onRefresh:async()=>{}}));
 assert.ok(html.indexOf('A River Journey — Part 2')<html.indexOf('A River Journey — Part 10'));assert.match(html,/1 of 12 parts complete/);assert.match(html,/A source passage still needs review/);assert.match(html,/Open the part that needs attention/);assert.match(html,/disabled=""[^>]*aria-label="Open Part 12"/);assert.match(html,/Read Part 1/);assert.match(html,/Stop series/);assert.doesNotMatch(html,/Resume series/);
 const shelf=renderToStaticMarkup(createElement(Shelf,{items:[series],onOpen:()=>{}}));assert.ok(shelf.indexOf('Part 9')<shelf.indexOf('Part 10'));assert.match(shelf,/Open series/);assert.match(shelf,/Parts in reading order/);
});

test('series preparation has an explicit retry while failed children keep their own recovery action',async()=>{
 const {Overview}=await compiled,callbacks={busy:'',error:'',onControl:async()=>{},onOpenPart:()=>{},onRefresh:async()=>{}},preparation={...series,error:'The next comic part could not be prepared.',parts:parts.map(part=>part.state==='failed'?{...part,state:'waiting',error:null}:part)};
 const html=renderToStaticMarkup(createElement(Overview,{...callbacks,series:preparation}));assert.match(html,/Retry preparation/);assert.match(html,/continue creating the next part/);assert.doesNotMatch(html,/Open the part that needs attention/);
 const failed=renderToStaticMarkup(createElement(Overview,{...callbacks,series:{...series,error:preparation.error}}));assert.doesNotMatch(failed,/Retry preparation|Resume series/);assert.match(failed,/Open the part that needs attention/);
 const busy=renderToStaticMarkup(createElement(Overview,{...callbacks,busy:'resume',series:preparation}));assert.match(busy,/disabled=""[^>]*><svg[^]*?Retry preparation/);
});

test('series summaries respect the existing favorites filter and can be found by a part title',async()=>{
 const {ReaderShelf}=await compiled,no=()=>{},base={series:[series],onOpenSeries:no,stories:[],pending:[],sessions:[],progress:[],loading:false,refreshing:false,onRefresh:no,error:'',tab:'saved',onTab:no,query:'',onQuery:no,grouping:'none',onGrouping:no,bookName:()=>'',onOpen:no,onResume:no,onRetry:no,onDelete:no,onFavorite:no,favoriteBusy:'',onCreate:no,onDiscover:no,onControl:async()=>{},controlBusy:''};
 const empty=renderToStaticMarkup(createElement(ReaderShelf,base));assert.doesNotMatch(empty,/Open series/);assert.match(empty,/Keep the stories you love/);
 const favorite=renderToStaticMarkup(createElement(ReaderShelf,{...base,progress:[{storyId:'part0',page:0,saved:1}]}));assert.match(favorite,/Open series/);
 const searched=renderToStaticMarkup(createElement(ReaderShelf,{...base,tab:'recent',query:'Part 10'}));assert.match(searched,/Open series/);
});
