// Check real shared-page SVG, full artwork transforms, narration and accessible zoom controls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {layoutComicPages,layoutComicPanel} from '../lib/comic-page-layout.ts';
const compiled=build({stdin:{contents:"export {default as ComicPage,ComicPageTranscript,StoryComicZoom} from './client/ui/StoryComicPage.tsx';export {default as Scenes} from './client/ui/StorySceneList.tsx';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',loader:{'.css':'empty'}}).then(bundle=>{const module={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);return module.exports;});
const frames=Array.from({length:8},(_,i)=>({caption:`The traveler reaches village ${i+1}.`,prompt:'An adult traveler walks beside a village.',image:`/panel-${i+1}.png`,audio:'',panel:'normal',bubbles:i===0?[{id:'first',kind:'speech',speaker:'Traveler',text:'Hello!',x:.3,y:.4,width:.3,height:.15,tailX:.45,tailY:.75}]:[]}));
const props=()=>({frames,layout:layoutComicPages(frames)[0],selectedFrame:0,images:{},reloads:{},onImageError:()=>{},onImageLoad:()=>{}});
test('reader page uses the same ordered panel rectangles, artwork transforms and captions as exports',async()=>{
 const {ComicPage}=await compiled,p=props(),html=renderToStaticMarkup(createElement(ComicPage,p));
 assert.equal(p.layout.panels.length,4);assert.equal((html.match(/data-panel-index=/g)||[]).length,4);assert.ok(html.indexOf('data-panel-index="0"')<html.indexOf('data-panel-index="3"'));
 for(const panel of p.layout.panels){const layout=layoutComicPanel(frames[panel.frameIndex],panel);assert.ok(html.includes(`x="${layout.art.x}"`));assert.ok(html.includes(`y="${layout.art.y}"`));for(const line of layout.captionLines)assert.ok(html.includes(line.text));}
 assert.match(html,/HELLO!/);assert.doesNotMatch(html,/Traveler:/);assert.doesNotMatch(html,/textLength|foreignObject/);assert.match(html,/font-kerning:none/);
});
test('transcript retains source panel order, narration and speaker while incomplete panels stay explicit',async()=>{
 const {ComicPageTranscript,ComicPage}=await compiled,p=props(),missing=structuredClone(frames);missing[2].image='';
 const html=renderToStaticMarkup(createElement(ComicPageTranscript,{frames:missing,layout:p.layout}));assert.match(html,/Traveler says:/);assert.match(html,/Illustration is still being drawn/);assert.ok(html.indexOf('Panel 1')<html.indexOf('Panel 4'));
 const svg=renderToStaticMarkup(createElement(ComicPage,{...p,frames:missing}));assert.match(svg,/PANEL 3 · DRAWING/);assert.equal((svg.match(/data-panel-index=/g)||[]).length,4);
});
test('phone zoom exposes full-size native panning and scene selection labels identify canonical panels',async()=>{
 const {StoryComicZoom,Scenes}=await compiled,p=props(),html=renderToStaticMarkup(createElement(StoryComicZoom,{...p,onClose:()=>{}}));for(const text of ['Zoom in','Zoom out','Fit page','100%','Scroll to pan','Read page transcript'])assert.ok(html.includes(text),text);assert.match(html,/width:900px;height:1350px/);
 const scenes=renderToStaticMarkup(createElement(Scenes,{story:{pages:frames},page:5,comicPages:layoutComicPages(frames),onSelect:()=>{}}));assert.match(scenes,/Go to panel 6/);assert.match(scenes,/Comic page 2/);assert.match(scenes,/aria-current="location"/);
});
