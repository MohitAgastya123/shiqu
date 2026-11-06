// Render real shared controls to verify independent requirement editors and honest history/result labels.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const bundle=await build({stdin:{contents:"export {default as Editor,StoryEditorTabs as Tabs} from './client/ui/StoryProductionEditor.tsx';export {PromptDetailsContent as Details} from './client/ui/StoryPromptDetails.tsx';export {default as Review} from './client/ui/StoryReviewTools.tsx';export {default as Back} from './client/ui/StoryBackToShelf.tsx';export {default as Status} from './client/ui/StoryGenerationStatus.tsx';export {default as Setup} from './client/ui/StoryCreationSetup.tsx';export {default as Control} from './client/ui/StoryGenerationControl.tsx';",resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',loader:{'.css':'empty'}});
const module={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);const {Editor,Tabs,Details,Review,Back,Status,Setup,Control}=module.exports;
const render=(component,props)=>renderToStaticMarkup(createElement(component,props));
const noop=()=>{},record={instructions:'系统约束 <script>bad()</script>',input:'{"productionPrompt":"保留对白"}',schema:{type:'object'}};
const data={criteria:['可见反应','核对实际图像'],records:[{step:'plan',model:'controlled',originId:'old',index:0,record},{step:'review:0',model:'controlled',originId:'current',index:1,record}],results:[{criterion:1,status:'passed',pages:[2],evidence:'第二幅已有可见反应。'},{criterion:2,status:'unknown',pages:[],evidence:'文字分镜不能判断实际成图。'}],previews:{production:record,acceptance:record}};
test('production and acceptance are sibling links/tabs; acceptance editing is an independent local patch',()=>{
 const tabs=render(Tabs,{tab:'acceptance',onChange:noop});assert.match(tabs,/Production instructions.*Acceptance criteria/s);assert.equal((tabs.match(/>Acceptance criteria<\/button>/g)||[]).length,1);
 const changes=[],fields=Editor({tab:'acceptance',settings:{productionPrompt:'保留对白',acceptancePrompt:'可见反应',artStyle:'ink-pencil',narrativeDetail:'balanced',length:'auto'},disabled:false,onChange:value=>changes.push(value)});
 fields.props.children.flat().find(child=>child?.type==='label').props.children.find(child=>child?.type==='textarea').props.onChange({target:{value:'新的验收条目'}});
 assert.deepEqual(changes,[{acceptancePrompt:'新的验收条目'}]);
 const html=render(Editor,{tab:'acceptance',settings:{productionPrompt:'保留对白',artStyle:'ink-pencil',narrativeDetail:'balanced',length:'auto'},disabled:false,onChange:noop});assert.match(html,/One criterion per line/);assert.match(html,/reviews again/);
});
test('prompt history distinguishes inherited/current records, previews and missing history; model data is escaped',()=>{
 const production=render(Details,{data,kind:'production',sessionId:'current',preferences:{productionPrompt:'编辑中的要求',acceptancePrompt:'验收专用标记',acceptanceCriteria:['验收专用标记']}});
 assert.match(production,/Inherited from an older version/);assert.doesNotMatch(production,/review:0/);assert.match(production,/preview/);assert.match(production,/编辑中的要求/);assert.doesNotMatch(production,/验收专用标记/);assert.match(production,/Copy complete prompt/);assert.doesNotMatch(production,/<script>bad/);
 const acceptance=render(Details,{data,kind:'acceptance',sessionId:'current',preferences:{}});assert.match(acceptance,/Used by this version/);assert.match(acceptance,/Criterion 1.*Passed/);assert.match(acceptance,/Criterion 2.*Cannot determine/);assert.match(acceptance,/文字分镜不能判断实际成图/);assert.match(acceptance,/可见反应/);assert.match(acceptance,/Page 2/);
 const missing=render(Details,{data:{...data,records:[],results:[]},kind:'acceptance',sessionId:'old',preferences:{}});assert.match(missing,/Not recorded/);assert.match(missing,/History is never invented for older versions/);assert.match(missing,/No review results for this story/);
});
test('an unknown criterion without fabricated frame issues still exposes the acceptance repair route',()=>{
 const session={id:'blocked',selection:{length:1},state:'failed',ready:1,story:{pages:[{image:'saved'}],original:{}},reviewIssues:[],generationProgress:{phase:'review',reviewStatus:'blocked',reviewStopReason:'requirements',reviewAudits:1}};
 const tools=render(Review,{session,busy:false,error:'',onScript:noop,onRetry:noop,onDrawAnyway:noop});
 assert.doesNotMatch(tools,/Acceptance criteria need changes|View and edit acceptance criteria|Continue automatic repair/);
 for(const audits of [1,2]){
  const html=render(Status,{session:{...session,generationProgress:{...session.generationProgress,reviewAudits:audits}},busy:false,controlBusy:false,error:'',onControl:noop,onRetry:noop,onBack:noop,onAcceptance:noop});
  const target=audits===1?'review':'recheck',stage=html.match(new RegExp(`<li[^>]*data-stage="${target}"[^>]*>(.*?)</li>`,'s'))?.[1];
  assert.ok(stage);assert.match(stage,/Acceptance criteria need changes/);assert.match(stage,/View and edit acceptance criteria/);assert.equal((html.match(/Acceptance criteria need changes/g)||[]).length,1);assert.doesNotMatch(html,/Continue automatic repair/);
  assert.doesNotMatch(html,/yu-generation-description/);
  const other=html.match(new RegExp(`<li[^>]*data-stage="${audits===1?'recheck':'review'}"[^>]*>(.*?)</li>`,'s'))?.[1];assert.doesNotMatch(other,/Acceptance criteria need changes/);
 }
});

test('flow recovery and exits are links while controls outside the flow retain their presentation',()=>{
 const session={id:'flow',selection:{bookId:'zhuangzi',theme:'选择',artStyle:'ink-pencil',productionPrompt:'保留对白',length:3},state:'idle',generationControl:'paused',story:null,error:null,ready:0,awaitingFrameCount:false,retryAllowed:false};
 const calls=[],props={session,busy:false,controlBusy:false,error:'',onControl:()=>calls.push('control'),onRetry:noop,onBack:()=>calls.push('back')};
 for(const state of ['idle','failed','running']){
  const html=render(Status,{...props,session:{...session,state}});assert.match(html,/<a[^>]*class="story-flow-link"[^>]*>Resume generation<\/a>/);assert.match(html,/<a[^>]*class="story-flow-link"[^>]*>.*?Back to shelf<\/a>/s);
 }
 const primary=render(Control,{session,busy:false,onControl:noop,primary:true});assert.match(primary,/class="yu-primary"/);
 const compact=render(Control,{session,busy:false,onControl:noop});assert.match(compact,/class="yu-generation-control"/);
 const back=Back({onBack:props.onBack});back.props.onClick();assert.deepEqual(calls,['back']);assert.equal(back.props.className,'yu-generation-back');
 for(const phase of ['discovering','choosing','confirming']){
  const intake={phase,generation:0,search:{state:phase==='discovering'?'searching':'idle'},batches:phase==='confirming'?[{stories:[{title:'庄周梦蝶',description:'故事简介'}],note:''}]:[],...(phase==='confirming'?{selected:{batch:0,index:0}}:{})};
  const html=render(Setup,{session:{...session,intake,selection:{...session.selection,narrativeDetail:'balanced'}},book:'庄子',busy:false,onAction:noop,progress:props});assert.equal((html.match(/>Back to shelf<\/(?:button|a)>/g)||[]).length,1,phase);
 }
});
