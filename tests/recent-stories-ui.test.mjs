// Keep partially restored reading history hidden until the home library is ready.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {makeStory} from './fixtures/story.mjs';
import {recentHeroes} from '../lib/reader-home.ts';

const bundle=await build({entryPoints:['client/ui/RecentStories.tsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external'});
const compiled={exports:{}};
new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),compiled,compiled.exports);
const RecentStories=compiled.exports.default;
const story=makeStory(),items=recentHeroes([story],story.id,[{storyId:story.id,page:2}]);
const render=(loading,rows=items)=>renderToStaticMarkup(createElement(RecentStories,{items:rows,loading,bookName:()=> '聊斋志异',onOpen(){}}));

test('loading hides both cached story cards and the first-use empty state',()=>{
 for(const rows of [items,[]]){
  const html=render(true,rows);
  assert.match(html,/role="status" aria-busy="true"/);
  assert.match(html,/Opening story…/);
  assert.doesNotMatch(html,/Continue reading|Make room for your next story|<img/);
 }
});

test('settled history shows the resume card or the first-use empty state',()=>{
 const html=render(false);
 assert.match(html,new RegExp(story.title));
 assert.match(html,/Continue reading · 3/);
 assert.doesNotMatch(html,/Opening story…/);
 const empty=render(false,[]);
 assert.match(empty,/Make room for your next story/);
 assert.doesNotMatch(empty,/Opening story…/);
});
