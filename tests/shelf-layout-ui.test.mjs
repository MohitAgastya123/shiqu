// Preserve English shelf regions, priority, readable-card sizing and finished-story restart.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const bundle=await build({stdin:{contents:"export {default} from './client/ui/ReaderShelf.tsx';",resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,loader:{'.css':'empty'},platform:'node',format:'cjs',packages:'external'});
const compiled={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),compiled,compiled.exports);
const Shelf=compiled.exports.default,noop=()=>{};
const story=(id,title,frames=3)=>({id,bookId:'honglou',title,theme:'爱情与错过',pages:Array.from({length:frames},()=>({image:'/saved.png'}))});
const session=(id,title,extra={})=>({id,selection:{bookId:'honglou',theme:'原典故事',artStyle:'chibi',storyTitle:title},state:'idle',error:null,ready:0,story:null,page:0,saved:false,stage:'Planning story',...extra});
const paused=(id,title)=>session(id,title,{generationControl:'paused'});
function render({stories=[],pending=[],progress=[],...extra}={}){
 return renderToStaticMarkup(createElement(Shelf,{stories,pending,sessions:pending,progress,loading:false,refreshing:false,error:'',tab:'recent',query:'',grouping:'none',bookName:()=> 'Dream of the Red Chamber',controlBusy:'',favoriteBusy:'',onControl:noop,onRetry:noop,onRefresh:noop,onTab:noop,onQuery:noop,onGrouping:noop,onOpen:noop,onResume:noop,onDelete:noop,onFavorite:noop,onCreate:noop,onDiscover:noop,...extra}));
}
const rows=html=>[...html.matchAll(/<li class="yu-production-row (\w+)">.*?<strong>(.*?)<\/strong>/g)].map(([,tone,title])=>`${tone}:${title}`);

test('unfinished productions come first as rows, ordered by what needs the user, each with at most one control',()=>{
 const html=render({stories:[story('read','A Visit to a Friend')],pending:[
  paused('p','Paused story'),
  session('run','Running story',{productionState:'running'}),
  session('frames','Story awaiting frame count',{awaitingFrameCount:true}),
  session('fail','Failed story',{state:'failed',error:'The drawing service is unavailable.',retryAllowed:true}),
 ]});
 assert.ok(html.indexOf('yu-production')<html.indexOf('yu-shelf-row-readable'),'Productions precede readable stories');
 assert.deepEqual(rows(html),['needs:Story awaiting frame count','failed:Failed story','active:Running story','paused:Paused story']);
 assert.match(html,/<h2>In production<\/h2><span>4 tasks<\/span><em>2 need attention<\/em>/);
 assert.match(html,/<h2 class="yu-shelf-region-title">Ready to read<span>1 stories<\/span><\/h2>/);
 const row=title=>html.slice(html.indexOf(`<strong>${title}</strong>`),html.indexOf('</li>',html.indexOf(`<strong>${title}</strong>`)));
 assert.doesNotMatch(row('Story awaiting frame count'),/yu-generation-control/,'The row itself is the action for user decisions');
 assert.equal((row('Failed story').match(/yu-generation-control/g)||[]).length,1);assert.match(row('Failed story'),/Retry generation/);
 assert.match(row('Running story'),/Pause generation/);assert.match(row('Paused story'),/Resume generation/);
 // Show actionable errors while keeping generic explanations available to screen readers.
 assert.match(row('Failed story'),/<small class="yu-production-error">The drawing service is unavailable.<\/small>/);
 assert.match(row('Paused story'),/<span class="sr-only">Saved results are retained./);
});

test('a long production list shows needs-you rows plus up to five in total, and a search shows every match',()=>{
 const pending=[...Array.from({length:7},(_,i)=>paused('p'+i,'Paused '+i)),session('frames','Awaiting frames',{awaitingFrameCount:true})];
 const html=render({pending});
 assert.deepEqual(rows(html),['needs:Awaiting frames','paused:Paused 0','paused:Paused 1','paused:Paused 2','paused:Paused 3']);
 assert.match(html,/Show all 8 tasks/);
 const many=Array.from({length:6},(_,i)=>session('n'+i,'Awaiting '+i,{awaitingFrameCount:true}));
 assert.equal(rows(render({pending:[...many,paused('p','Paused ')]})).length,6,'Every needs-you row stays visible');
 const searched=render({pending,query:'Paused '});
 assert.equal(rows(searched).length,7);assert.doesNotMatch(searched,/Show all/);
});

test('readable cards are the same size in single-story groups and show finished reading',()=>{
 const stories=[story('done','The Flower Burial',4),story('mid','First Visit to the Mansion',4)];
 const progress=[{storyId:'done',page:3,saved:false},{storyId:'mid',page:1,saved:false}];
 const html=render({stories,progress,grouping:'book',bookName:s=>s.id==='done'?'Dream of the Red Chamber':'The Story of the Stone'});
 assert.doesNotMatch(html,/yu-shelf-grid-single|yu-shelf-row-compact/);
 assert.equal((html.match(/class="yu-shelf-row yu-shelf-row-readable"/g)||[]).length,2);
 assert.match(html,/aria-label="Read again “The Flower Burial”"><span class="yu-shelf-progress" aria-hidden="true"><i style="width:100%"><\/i><\/span><span class="yu-shelf-reading-meta"><span>Finished · 4 pages<\/span><span class="yu-shelf-continue">Read again/);
 assert.match(html,/<span>Page 2 \/ 4<\/span><span class="yu-shelf-continue">Continue reading/);
 assert.doesNotMatch(html,/yu-shelf-region-title/,'No region heading without productions');
 // Finished stories restart; partially read stories keep their existing resume position.
 const opened=[],tree=Shelf({stories,pending:[],sessions:[],progress,loading:false,refreshing:false,error:'',tab:'recent',query:'',grouping:'none',bookName:()=> 'Dream of the Red Chamber',controlBusy:'',favoriteBusy:'',onOpen:(...args)=>opened.push(args)});
 const button=(node,label)=>{if(!node||typeof node!=='object')return;if(node.type==='button'&&node.props['aria-label']===label)return node;for(const child of [node.props?.children].flat(Infinity)){const found=button(child,label);if(found)return found;}};
 button(tree,'Read again “The Flower Burial”').props.onClick();button(tree,'Continue reading “First Visit to the Mansion”').props.onClick();
 assert.deepEqual(opened,[[stories[0],true],[stories[1]]]);
});

test('filters apply to both regions; production-only shelves explain where stories will appear',()=>{
 const pending=[{...paused('fav','Favorite draft'),saved:true},paused('other','Another draft')];
 const stories=[story('read','A Visit to a Friend')];
 const saved=render({pending,stories,tab:'saved'});
 assert.deepEqual(rows(saved),['paused:Favorite draft']);assert.doesNotMatch(saved,/A Visit to a Friend/);
 assert.match(saved,/Found 1 \/ 3 stories/);assert.doesNotMatch(saved,/Completed stories will appear here/);
 assert.match(saved,/My favorites <span>1<\/span>/);assert.match(saved,/All stories <span>3<\/span>/);
 assert.match(render({pending}),/Completed stories will appear here when production finishes./);
 assert.match(render({}),/Your stories begin here/);
 assert.match(render({stories,query:'not found'}),/No matching story/);
});
