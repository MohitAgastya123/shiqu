// Verify English presentation across actual reader surfaces while preserving canonical selections.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const compiled=build({stdin:{contents:"export {default as Discovery,discoveryThemes} from './client/ui/StoryDiscoveryForm.tsx';export {default as Scenes} from './client/ui/StorySceneList.tsx';export {ReviewHistoryContent as History} from './client/ui/StoryReviewHistory.tsx';export {default as Revision} from './client/ui/StoryRevisionEditor.tsx';export {themeLabel} from './client/english-labels.ts';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',loader:{'.css':'empty'}}).then(bundle=>{const module={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);return module.exports;});
const noop=()=>{};
function assertEnglish(html){assert.doesNotMatch(html.replace(/<[^>]*>/g,''),/[\p{Script=Han}]/u);}
test('discovery displays English themes while saved canonical values stay unchanged',async()=>{
 const {Discovery,discoveryThemes,themeLabel}=await compiled;
 const selection={bookId:'liaozhai',theme:'善意与误解',artStyle:'ink-pencil',productionPrompt:'',length:'auto',narrativeDetail:'balanced',voice:false};
 const html=renderToStaticMarkup(createElement(Discovery,{selection,books:[{id:'liaozhai',title:'Strange Tales from a Chinese Studio'}],busy:false,error:'',onBookChange:noop,onSubmit:async()=>{}}));
 assertEnglish(html);assert.match(html,/Which book will you begin with/);assert.match(html,/Kindness and misunderstanding/);assert.match(html,/Any theme/);assert.match(html,/Find stories/);
 assert.equal(selection.theme,'善意与误解');assert.ok(discoveryThemes.includes(selection.theme));assert.equal(themeLabel(selection.theme),'Kindness and misunderstanding');
});
test('scene navigation and review history use English labels and correct page/version terminology',async()=>{
 const {Scenes,History}=await compiled;
 const scenes=renderToStaticMarkup(createElement(Scenes,{story:{pages:[{caption:'A traveler reaches a quiet village.',image:''}]},page:0,onSelect:noop}));
 assertEnglish(scenes);assert.match(scenes,/aria-label="Go to page 1"/);assert.match(scenes,/Not drawn yet/);assert.doesNotMatch(scenes,/Page 1\s+pages/);
 const history=renderToStaticMarkup(createElement(History,{data:{title:'The Traveler',revision:2,entries:[],status:'passed'}}));
 assertEnglish(history);assert.match(history,/Version 2/);assert.match(history,/Review passed/);assert.match(history,/No saved review history/);
});
test('English storyboard editors accept production prose limits',async()=>{
 const {Revision}=await compiled;
 const plan={title:'The Traveler',summary:'A traveler learns to listen.',sourceReference:'Source',adaptationNote:'AI adaptation.',reflection:'Listen before judging.',characters:'A traveler in a plain brown coat.',pages:[{caption:'A traveler reaches a quiet village.',prompt:'A traveler stands beside the village gate.'}]};
 const html=renderToStaticMarkup(createElement(Revision,{editor:{base:{selection:{artStyle:'ink-pencil',productionPrompt:'',theme:'原典故事',length:1},plan,images:[]},changes:{},tab:'script',scriptPage:1,busy:false,loading:false,impact:null,setTab:noop,setChanges:noop,setScriptPage:noop},reviewIssues:[]}));
 assertEnglish(html);for(const max of [500,4000,6000,400])assert.ok(html.includes(`maxLength="${max}"`),String(max));assert.match(html,/Character definitions/);assert.match(html,/Caption/);
});
