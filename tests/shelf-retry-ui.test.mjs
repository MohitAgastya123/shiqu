// Failed shelf cards must retry saved work, including readable compact cards, without pausing it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const bundle=await build({stdin:{contents:"export {default} from './client/ui/ReaderShelf.tsx';",resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,loader:{'.css':'empty'},platform:'node',format:'cjs',packages:'external'});
const compiled={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),compiled,compiled.exports);
const Shelf=compiled.exports.default,noop=()=>{};
const story={id:'failed-story',bookId:'honglou',title:'雪日探钗，黛玉含酸',theme:'爱情与错过',artStyleLabel:'软萌 Q 版',pages:Array.from({length:30},(_,i)=>({image:i<16?'/saved.png':''}))};
const failed={id:story.id,selection:{bookId:story.bookId,theme:story.theme,artStyle:'chibi'},state:'failed',error:'绘图失败',retryAllowed:true,generationControl:'active',ready:16,story,page:1};
function props(session=failed,extra={}){
 return {stories:session.story?[story]:[],pending:session.story?[]:[session],sessions:[session],progress:[],loading:false,refreshing:false,error:'',tab:'recent',query:'',grouping:'none',bookName:()=> '红楼梦',controlBusy:'',favoriteBusy:'',onControl:noop,onRetry:noop,onRefresh:noop,onTab:noop,onQuery:noop,onGrouping:noop,onOpen:noop,onSettings:noop,onResume:noop,onDelete:noop,onFavorite:noop,onCreate:noop,onDiscover:noop,...extra};
}
function retryButton(node){
 if(!node||typeof node!=='object')return;
 if(node.type==='button'&&node.props.children==='重试生成')return node;
 for(const child of [node.props?.children].flat(Infinity)){
  const found=retryButton(child);if(found)return found;
 }
}

test('failed compact, full-width and pending cards show one retry action instead of pause',()=>{
 for(const options of [props(),props(failed,{grouping:'book'}),props({...failed,story:null,ready:0})]){
  const html=renderToStaticMarkup(createElement(Shelf,options));
  assert.match(html,/生成失败/);
  assert.equal((html.match(/重试生成/g)||[]).length,1);
  assert.doesNotMatch(html,/暂停生成|恢复生成/);
 }
});

test('retry dispatches the existing session and is disabled during conflicting shelf operations',()=>{
 const retries=[],controls=[],options=props(failed,{onRetry:session=>retries.push(session),onControl:(...args)=>controls.push(args)});
 const button=retryButton(Shelf(options));assert.ok(button);assert.equal(button.props.disabled,false);
 button.props.onClick();assert.deepEqual(retries,[failed]);assert.deepEqual(controls,[]);
 for(const busy of [{refreshing:true},{favoriteBusy:story.id},{controlBusy:story.id}]){
  assert.equal(retryButton(Shelf({...options,...busy})).props.disabled,true);
 }
});

test('manual pause and stop retain resume; running cards retain pause; completed cards have neither',()=>{
 for(const generationControl of ['paused','stopped']){
  const html=renderToStaticMarkup(createElement(Shelf,props({...failed,generationControl})));
  assert.match(html,/恢复生成/);assert.doesNotMatch(html,/重试生成|暂停生成/);
 }
 const running=renderToStaticMarkup(createElement(Shelf,props({...failed,state:'running',productionState:'running',error:null})));
 assert.match(running,/暂停生成/);assert.doesNotMatch(running,/重试生成/);
 const completed=renderToStaticMarkup(createElement(Shelf,props({...failed,state:'completed',error:null,retryAllowed:false})));
 assert.doesNotMatch(completed,/重试生成|暂停生成|恢复生成/);
});

test('a failure with no retryable step does not offer pause or dispatch recovery',()=>{
 const html=renderToStaticMarkup(createElement(Shelf,props({...failed,retryAllowed:false})));
 assert.match(html,/生成失败/);assert.doesNotMatch(html,/重试生成|暂停生成/);
});


test('settings opens the selected story while card clicks keep reading',()=>{
 const opened=[],settings=[],options=props(failed,{onOpen:story=>opened.push(story),onSettings:story=>settings.push(story)});
 const tree=Shelf(options);
 function button(node,label){
  if(!node||typeof node!=='object')return;
  if(node.type==='button'&&node.props['aria-label']===label)return node;
  for(const child of [node.props?.children].flat(Infinity)){const found=button(child,label);if(found)return found;}
 }
 button(tree,'《'+story.title+'》的故事设置').props.onClick();assert.deepEqual(settings,[story.id]);assert.deepEqual(opened,[]);
 button(tree,'继续阅读《'+story.title+'》').props.onClick();assert.deepEqual(opened,[story]);assert.deepEqual(settings,[story.id]);
});
