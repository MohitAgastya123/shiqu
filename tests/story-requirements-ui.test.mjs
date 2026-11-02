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
 const tabs=render(Tabs,{tab:'acceptance',onChange:noop});assert.match(tabs,/制作要求.*验收要求/s);assert.equal((tabs.match(/>验收要求<\/button>/g)||[]).length,1);
 const changes=[],fields=Editor({tab:'acceptance',settings:{productionPrompt:'保留对白',acceptancePrompt:'可见反应',artStyle:'ink-pencil',narrativeDetail:'balanced',length:'auto'},disabled:false,onChange:value=>changes.push(value)});
 fields.props.children.flat().find(child=>child?.type==='label').props.children.find(child=>child?.type==='textarea').props.onChange({target:{value:'新的验收条目'}});
 assert.deepEqual(changes,[{acceptancePrompt:'新的验收条目'}]);
 const html=render(Editor,{tab:'acceptance',settings:{productionPrompt:'保留对白',artStyle:'ink-pencil',narrativeDetail:'balanced',length:'auto'},disabled:false,onChange:noop});assert.match(html,/每行一条/);assert.match(html,/重新审核/);
});
test('prompt history distinguishes inherited/current records, previews and missing history; model data is escaped',()=>{
 const production=render(Details,{data,kind:'production',sessionId:'current',preferences:{productionPrompt:'编辑中的要求'}});
 assert.match(production,/沿用旧版本记录/);assert.doesNotMatch(production,/review:0/);assert.match(production,/预览/);assert.match(production,/编辑中的要求/);assert.match(production,/复制完整提示词/);assert.doesNotMatch(production,/<script>bad/);
 const acceptance=render(Details,{data,kind:'acceptance',sessionId:'current',preferences:{}});assert.match(acceptance,/本版本实际使用/);assert.match(acceptance,/第 1 条 · 通过/);assert.match(acceptance,/第 2 条 · 无法判断/);assert.match(acceptance,/文字分镜不能判断实际成图/);assert.match(acceptance,/可见反应/);assert.match(acceptance,/第 2 幅/);
 const missing=render(Details,{data:{...data,records:[],results:[]},kind:'acceptance',sessionId:'old',preferences:{}});assert.match(missing,/未留存/);assert.match(missing,/旧版本不会补造历史记录/);assert.match(missing,/尚无本篇验收条目的审核结果/);
});
test('an unknown criterion without fabricated frame issues still exposes the acceptance repair route',()=>{
 const html=render(Review,{session:{story:{pages:[{image:'saved'}],original:{}},reviewIssues:[],generationProgress:{reviewStopReason:'requirements'}},busy:false,error:'',onScript:noop,onRetry:noop,onDrawAnyway:noop,onAcceptance:noop});
 assert.match(html,/验收要求需要调整/);assert.match(html,/查看并修改验收要求/);assert.doesNotMatch(html,/继续自动修复/);
});

test('flow resume is primary, shelf return is secondary and all creation/status states retain an explicit exit',()=>{
 const session={id:'flow',selection:{bookId:'zhuangzi',theme:'选择',artStyle:'ink-pencil',productionPrompt:'保留对白',length:3},state:'idle',generationControl:'paused',story:null,error:null,ready:0,awaitingFrameCount:false,retryAllowed:false};
 const calls=[],props={session,busy:false,controlBusy:false,error:'',onControl:()=>calls.push('control'),onRetry:noop,onBack:()=>calls.push('back')};
 for(const state of ['idle','failed','running']){
  const html=render(Status,{...props,session:{...session,state}});assert.match(html,/<button[^>]*class="yu-primary"[^>]*>恢复生成<\/button>/);assert.match(html,/<button[^>]*class="yu-generation-back"[^>]*>.*?返回书架<\/button>/s);
 }
 const primary=render(Control,{session,busy:false,onControl:noop,primary:true});assert.match(primary,/class="yu-primary"/);
 const compact=render(Control,{session,busy:false,onControl:noop});assert.match(compact,/class="yu-generation-control"/);
 const back=Back({onBack:props.onBack});back.props.onClick();assert.deepEqual(calls,['back']);assert.equal(back.props.className,'yu-generation-back');
 for(const phase of ['discovering','choosing','confirming']){
  const intake={phase,generation:0,search:{state:phase==='discovering'?'searching':'idle'},batches:phase==='confirming'?[{stories:[{title:'庄周梦蝶',description:'故事简介'}],note:''}]:[],...(phase==='confirming'?{selected:{batch:0,index:0}}:{})};
  const html=render(Setup,{session:{...session,intake,selection:{...session.selection,narrativeDetail:'balanced'}},book:'庄子',busy:false,onAction:noop,progress:props});assert.match(html,/class="yu-generation-back"/);assert.equal((html.match(/>返回书架<\/button>/g)||[]).length,1,phase);
 }
});
