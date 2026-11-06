// Verify real SVG geometry, accessible dialogue and optional draft controls without paid generation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {computeBubbleLayout} from '../lib/comic-bubble-layout.ts';
const compiled=build({stdin:{contents:"export {default as Layer,BubbleTranscript} from './client/ui/StoryBubbleLayer.tsx';export {default as Editor,bubbleDraftError,changedBubbleGeometry} from './client/ui/StoryBubbleEditor.tsx';export {default as Script} from './client/ui/StoryScript.tsx';export {ReviewHistoryEvent as HistoryEvent} from './client/ui/StoryReviewHistory.tsx';export {default as Scenes} from './client/ui/StorySceneList.tsx';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',loader:{'.css':'empty'}}).then(bundle=>{const module={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);return module.exports;});
const bubbles=[{id:'speech-1',kind:'speech',speaker:'Fisherman',text:'Back to the river you go.',x:.04,y:.03,width:.44,height:.22,tailX:.28,tailY:.72},{id:'thought-1',kind:'thought',speaker:'Fisherman',text:'The river is its home.',x:.52,y:.03,width:.44,height:.22,tailX:.7,tailY:.73}];
test('reader SVG uses shared production paths, exact line widths and separate speech/thought connectors',async()=>{
 const {Layer,BubbleTranscript}=await compiled,html=renderToStaticMarkup(createElement(Layer,{bubbles}));
 assert.match(html,/data-bubble-kind="speech"/);assert.match(html,/data-bubble-kind="thought"/);assert.match(html,/<circle/);assert.match(html,/yu-bubble-tail/);assert.doesNotMatch(html,/foreignObject/);
 for(const b of bubbles){const layout=computeBubbleLayout(b,900,1350);assert.ok(html.includes(layout.path));for(const line of layout.lines)assert.ok(html.includes(`textLength="${line.width}"`));}
 const transcript=renderToStaticMarkup(createElement(BubbleTranscript,{bubbles}));assert.ok(transcript.indexOf('Fisherman says:')<transcript.indexOf('Fisherman thinks:'));
 const invalid=renderToStaticMarkup(createElement(Layer,{bubbles:[{...bubbles[0],x:.99}]}));assert.match(invalid,/invalid balloon data/);assert.doesNotMatch(invalid,/data-bubble-kind/);
});
test('bubble-only repair history shows attributed before and after dialogue',async()=>{
 const {HistoryEvent}=await compiled,frame={caption:'The fisherman kneels beside the river.',prompt:'An adult fisherman kneels beside a river.',bubbles:[bubbles[0]]};
 const html=renderToStaticMarkup(createElement(HistoryEvent,{expanded:true,entry:{id:'repair:0',kind:'repair',title:'Repair batch 1',position:0,recordedAt:null,model:'controlled',outcome:'changed',issues:[],repair:{requested:[1],pages:[{page:1,before:frame,after:{...frame,bubbles:[bubbles[1]]}}]}}}));
 assert.match(html,/Comic dialogue/);assert.match(html,/Fisherman says:/);assert.match(html,/Fisherman thinks:/);
});
test('optional controls expose safe numeric and keyboard alternatives and report invalid drafts',async()=>{
 const {Editor,bubbleDraftError,changedBubbleGeometry}=await compiled,html=renderToStaticMarkup(createElement(Editor,{image:'/art.png',bubbles,onChange:()=>{}}));
 for(const label of ['Add speech','Add thought','Balloon text','Speaker','Move balloon','Resize balloon','Aim balloon tail','Read earlier','Read later','Remove balloon','X position','Tail Y'])assert.ok(html.includes(label),label);
 assert.match(html,/placed automatically/);assert.equal(bubbleDraftError(bubbles),'');assert.ok(bubbleDraftError([{...bubbles[0],x:.99}]));assert.ok(bubbleDraftError([{...bubbles[0],text:'x'.repeat(221)}]));
 const moved=changedBubbleGeometry(bubbles[0],'move',2,-2);assert.equal(moved.x,1-moved.width);assert.equal(moved.y,0);assert.equal(moved.text,bubbles[0].text);
 const aimed=changedBubbleGeometry(bubbles[0],'tail',2,-2);assert.equal(aimed.tailX,.99);assert.equal(aimed.tailY,.01);
 const resized=changedBubbleGeometry(bubbles[0],'resize',-2,2);assert.equal(resized.width,.12);assert.equal(resized.height,1-resized.y);
});
test('storyboard transcript includes attributed dialogue with empty narration',async()=>{
 const {Script}=await compiled,html=renderToStaticMarkup(createElement(Script,{standalone:true,story:{title:'The Turtle',summary:'A small rescue.',pages:[{caption:'',prompt:'A fisherman returns a turtle to the river.',bubbles}],reflection:'Kindness returns.'}}));
 assert.match(html,/Fisherman says:/);assert.match(html,/Fisherman thinks:/);assert.doesNotMatch(html,/caption for this page has not been saved/);
});
test('scene navigation describes dialogue-only and silent pages without missing-caption errors',async()=>{
 const {Scenes}=await compiled,html=renderToStaticMarkup(createElement(Scenes,{page:0,onSelect:()=>{},story:{pages:[{caption:'',bubbles,image:'/first.png'},{caption:'',bubbles:[],image:'/second.png'},{caption:'A narrated scene.',image:''}]}}));
 assert.match(html,/Fisherman says: Back to the river you go/);assert.match(html,/Fisherman thinks: The river is its home/);assert.ok(html.indexOf('Fisherman says:')<html.indexOf('Fisherman thinks:'));
 assert.match(html,/A silent scene\./);assert.match(html,/A narrated scene\./);assert.doesNotMatch(html,/caption.*not been saved/);
});
