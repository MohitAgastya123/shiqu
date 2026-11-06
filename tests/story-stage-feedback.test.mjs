// English stage feedback assertions preserve supplied fault details and execution boundaries.
// Render production components and verify that errors and next actions belong to their step.
// Source actions, measured preparation and editable confirmation each stay with their own step.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {parseDocument,DomUtils} from 'htmlparser2';
import {generationProgress} from '../lib/generation-progress.ts';

const bundle=await build({stdin:{contents:"export {default as Timeline} from './client/ui/StoryProductionTimeline.tsx';export {default as Control} from './client/ui/StoryGenerationControl.tsx';export {default as Action} from './client/ui/StoryFlowAction.tsx';export {default as Status} from './client/ui/StoryGenerationStatus.tsx';export {default as Review} from './client/ui/StoryReviewTools.tsx';export {default as Setup} from './client/ui/StoryCreationSetup.tsx';",resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',loader:{'.css':'empty'}});
const compiled={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),compiled,compiled.exports);
const {Status,Review,Setup,Action,Timeline,Control}=compiled.exports,noop=()=>{};
const base={id:'flow',selection:{bookId:'zhuangzi',storyTitle:'庄周梦蝶',theme:'原典故事',length:4,artStyle:'ink-pencil',productionPrompt:'保留原文因果。'},state:'failed',generationControl:'active',ready:0,story:null,error:'分镜生成等待超时。',retryAllowed:true,generationProgress:{sourceReady:true,frameCountConfirmed:true,frameCount:4,phase:'plan',startedAt:0,attempt:1}};
const defaults={busy:false,controlBusy:false,error:'',onControl:noop,onRetry:noop,onBack:noop};
function render(session,extra={}){return renderToStaticMarkup(createElement(Status,{...defaults,session,...extra}));}
function stage(html,id){const document=parseDocument(html),node=DomUtils.findOne(node=>node.name==='li'&&node.attribs?.['data-stage']===id,document.children);assert.ok(node,`Missing ${id}`);return DomUtils.textContent(node);}
function beforeSteps(html){return html.slice(0,html.indexOf('<ol '));}

test('the prominent heading names the story and progress shares the navigation row below',()=>{
 const session={...base,state:'running',productionState:'running',error:null,stage:'正在绘制第 1 幅',story:{title:'梦中化蝶',pages:Array(4).fill({})},generationProgress:{...base.generationProgress,phase:'image',reviewStatus:'passed'}};
 for(const [extra,title] of [[{},'梦中化蝶'],[{selection:{...session.selection,displayTitle:'自定故事名'}},'自定故事名'],[{story:null},'庄周梦蝶']]){
  const html=render({...session,...extra}),document=parseDocument(html);
  const summary=DomUtils.findOne(node=>node.attribs?.class==='yu-generation-summary',document.children);
  const heading=DomUtils.findOne(node=>node.name==='h3',summary.children);
  assert.equal(DomUtils.textContent(heading),title);assert.ok(!DomUtils.textContent(summary).includes('正在绘制'));
  const row=DomUtils.findOne(node=>node.attribs?.class==='yu-flow-header',document.children);
  assert.match(DomUtils.textContent(row),/Illustration progress · 正在绘制第 1 幅/);
 }
 const failed=parseDocument(render(base));
 const row=DomUtils.findOne(node=>node.attribs?.class==='yu-flow-header',failed.children);
 assert.match(DomUtils.textContent(row),/Production workflow · Failed/);
});

test('embedded flows omit the repeated story name while retaining progress and failure recovery',()=>{
 for(const state of ['running','failed','completed']){
  const html=render({...base,state}, {showSummary:false});
  assert.doesNotMatch(html,/yu-generation-summary|庄周梦蝶/);
  assert.match(html,/Full review workflow/);
  if(state==='failed'){assert.match(html,/分镜生成等待超时/);assert.match(html,/Retry generation/);}
 }
 const paused=render({...base,generationControl:'paused'},{showSummary:false});
 assert.doesNotMatch(paused,/yu-generation-summary|庄周梦蝶/);assert.match(paused,/Resume generation/);
});

test('a planning failure and retry are inside the planning step, once',()=>{
 const html=render(base);
 assert.match(stage(html,'plan'),/分镜生成等待超时。.*Retry generation/s);
 assert.doesNotMatch(beforeSteps(html),/分镜生成等待超时|Retry generation/);
 assert.equal(html.split(base.error).length-1,1);
 assert.doesNotMatch(stage(html,'source'),/等待超时|Retry generation/);
});

test('failed work replaces pause with one retry in the checkpoint footer after inspection links',()=>{
 const message='上次生成已中断，已保留保存的结果。请重试继续。';
 const session={...base,error:message,story:{original:{},pages:Array(4).fill({})},faults:[{id:'interrupted',stage:'generation',page:null,message,state:'pending',retryAllowed:true}],generationProgress:{...base.generationProgress,phase:'review',reviewStatus:'pending',reviewPhase:'frames',repairPasses:1}};
 const tools=createElement(Review,{session,busy:false,error:'',onScript:noop,onEdit:noop,onRetry:noop,onDrawAnyway:noop});
 const html=render(session,{reviewTools:tools}),document=parseDocument(html);
 const footer=DomUtils.findOne(node=>node.attribs?.class==='production-stage-footer'&&DomUtils.textContent(node).includes("Retry generation"),document.children);
 assert.ok(footer);assert.equal(DomUtils.textContent(footer),"Retry generation");
 assert.equal((html.match(/>Retry generation<\/a>/g)||[]).length,1);assert.doesNotMatch(html,/Pause generation/);
 assert.ok(html.indexOf("Edit manually")<html.indexOf('>Retry generation</a>'));assert.equal(html.split(message).length-1,1);
 const fallback=parseDocument(render(base));
 assert.ok(DomUtils.findOne(node=>node.attribs?.class==='production-stage-footer'&&DomUtils.textContent(node)==="Retry generation",fallback.children));
 const noRetry=render({...base,retryAllowed:false});assert.doesNotMatch(noRetry,/Pause generation|Retry generation/);
 const running=render({...base,state:'running',productionState:'running',error:null});assert.match(running,/Pause generation/);assert.doesNotMatch(running,/>Retry generation<\/a>/);
 const paused=render({...session,generationControl:'paused'});assert.match(paused,/Resume generation/);assert.doesNotMatch(paused,/Pause generation|>Retry generation<\/a>/);
});

test('shared production components place controls in the image card and history in the completed recheck',()=>{
 const session={...base,state:'running',productionState:'running',error:null,ready:4,story:{title:'庄周梦蝶',pages:Array(8).fill({})},generationProgress:{...base.generationProgress,phase:'image',reviewStatus:'passed',repairPasses:1}};
 const settings=(value)=>renderToStaticMarkup(createElement(Timeline,{session:value,stages:generationProgress(value,Date.now()).steps,onHistory:noop,onRetry:noop,currentContent:createElement(Control,{session:value,busy:false,onControl:noop,link:true})}));
 for(const surface of [value=>render(value,{onHistory:noop}),settings]){
  const document=parseDocument(surface(session));
  const image=DomUtils.findOne(node=>node.name==='li'&&node.attribs?.['data-stage']==='image',document.children);
  const recheck=DomUtils.findOne(node=>node.name==='li'&&node.attribs?.['data-stage']==='recheck',document.children);
  const footer=DomUtils.findOne(node=>node.attribs?.class==='production-stage-footer',image.children);
  assert.equal(DomUtils.textContent(footer),"Pause generation");assert.ok(DomUtils.textContent(recheck).includes("Review history"));
  assert.ok(!DomUtils.textContent(image).includes("Review history"));assert.equal(DomUtils.findAll(node=>node.name==='a'&&DomUtils.textContent(node)==="Review history",document.children).length,1);
  const failed=surface({...session,state:'failed',error:'上次生成已中断。',retryAllowed:true});
  assert.doesNotMatch(failed,/Pause generation/);assert.match(failed,/Retry generation/);
  const paused=parseDocument(surface({...session,generationControl:'paused'}));
  const pausedImage=DomUtils.findOne(node=>node.name==='li'&&node.attribs?.['data-stage']==='image',paused.children);
  assert.ok(DomUtils.textContent(pausedImage).includes("Resume generation"));
 }
});

test('independent faults keep their own stage, saved-image recovery and paused explanations',()=>{
 const faults=[{id:'source',stage:'source',page:null,message:'原文检索失败。'},{id:'prepare',stage:'prepare',page:null,message:'制作建议失败。'},{id:'image',stage:'redraw',page:2,message:'第三幅图片丢失。'},{id:'save',stage:'publication',page:1,message:'第二幅保存失败。'}].map(fault=>({...fault,state:'pending',retryAllowed:true}));
 const session={...base,error:null,faults};
 const html=render(session);
 assert.match(stage(html,'source'),/原文检索失败。.*Retry source lookup/s);
 assert.match(stage(html,'count'),/制作建议失败。.*Retry preparation/s);
 assert.match(stage(html,'image'),/第三幅图片丢失。.*Redraw page 3/s);
 assert.match(stage(html,'image'),/第二幅保存失败。.*without drawing it again..*Retry image save/s);
 for(const fault of faults){assert.equal(html.split(fault.message).length-1,1);assert.ok(!beforeSteps(html).includes(fault.message));}
 const paused=render({...session,generationControl:'paused'});
 assert.match(stage(paused,'image'),/Paused; other issues: /);
 assert.doesNotMatch(stage(paused,'image'),/Redraw page 3|Retry image save/);
 assert.match(stage(paused,'plan'),/Resume generation/);
 assert.equal((paused.match(/>Resume generation<\/a>/g)||[]).length,1);
});

test('review issue details and next actions live in the failed repair checkpoint',()=>{
 const session={...base,error:'修订未产生变化。',story:{original:{},pages:Array(4).fill({})},reviewIssues:[{page:2,category:'caption',problem:'第二幅没有说清主语。',instruction:'补充明确的主语。'}],generationProgress:{...base.generationProgress,phase:'review',reviewStatus:'blocked',reviewStopReason:'unchanged',repairPasses:1,repairTotal:1}};
 const tools=createElement(Review,{session,busy:false,error:'',onScript:noop,onEdit:noop,onRetry:noop,onDrawAnyway:noop});
 const html=render(session,{reviewTools:tools});
 assert.match(stage(html,'repair'),/没有说清主语/);assert.match(stage(html,'repair'),/Continue automatic repair/);assert.match(stage(html,'repair'),/Skip issues and draw/);
 assert.doesNotMatch(stage(html,'recheck'),/没有说清主语|Continue automatic repair/);
 assert.equal((html.match(/Continue automatic repair/g)||[]).length,1);
 assert.doesNotMatch(beforeSteps(html),/修订未产生变化|Continue automatic repair/);
});

test('recovering image errors remain visible beneath images while work continues',()=>{
 const session={...base,state:'running',productionState:'running',error:null,story:{pages:Array(4).fill({})},generationProgress:{...base.generationProgress,phase:'image'},faults:[{id:'recovering',stage:'redraw',page:1,message:'图片正在恢复。',state:'recovering',retryAllowed:false}]};
 const html=render(session);
 assert.match(stage(html,'image'),/Redrawing page 2/);assert.match(stage(html,'image'),/Previous error/);
 const disclosure=DomUtils.findOne(node=>node.name==='details'&&node.attribs?.class==='yu-recovery-detail',parseDocument(html).children);assert.ok(disclosure);assert.equal(disclosure.attribs.open,undefined);
 assert.doesNotMatch(stage(html,'plan'),/图片正在恢复/);
});

test('confirmation puts its start action directly under the confirmation step',()=>{
 const session={...base,state:'idle',error:null,retryAllowed:false,intake:{phase:'confirming',generation:1,search:{state:'idle'},selected:{batch:0,index:0},batches:[{stories:[{title:'庄周梦蝶',description:'梦与醒的故事。'}],note:''}]},generationProgress:{...base.generationProgress,phase:'production-confirmation',frameCountConfirmed:false}};
 const html=renderToStaticMarkup(createElement(Setup,{session,book:'Zhuangzi',busy:false,onAction:noop,progress:defaults}));
 assert.match(stage(html,'count'),/Start production/);
 assert.equal((html.match(/>Start production<\/a>/g)||[]).length,1);
 assert.doesNotMatch(beforeSteps(html),/Start production/);
 const searchError='后台提取失败，候选仍已保存。';
 const failedSearch=renderToStaticMarkup(createElement(Setup,{session:{...session,intake:{...session.intake,search:{state:'failed',error:searchError}}},book:'Zhuangzi',busy:false,onAction:noop,progress:defaults}));
 assert.ok(stage(failedSearch,'source').includes(searchError));assert.match(stage(failedSearch,'source'),/Retry search/);
 assert.ok(!beforeSteps(failedSearch).includes(searchError));
});

test('confirmation owns all four settings while extraction and preparation retain their real timing',()=>{
 const session={...base,state:'idle',error:null,retryAllowed:false,generationControl:'paused',selection:{...base.selection,source:{sectionId:'chapter',firstUnit:'p1',lastUnit:'p2'},artStyle:'cinematic',narrativeDetail:'balanced'},frameRecommendation:{count:7,reason:'保留完整因果。',storySummary:'悟空三次识破白骨精，除妖后仍被唐僧逐走。'},intake:{phase:'confirming',generation:1,search:{state:'idle'},selected:{batch:0,index:0},batches:[{stories:[{title:'庄周梦蝶',description:'梦与醒的故事。'}],note:''}]},generationProgress:{...base.generationProgress,phase:'production-confirmation',frameCountConfirmed:false,stageDurations:{source:12,count:26}}};
 const setup=value=>renderToStaticMarkup(createElement(Setup,{session:value,book:'Zhuangzi',busy:false,onAction:noop,progress:defaults}));
 const html=setup(session),document=parseDocument(html);
 const source=DomUtils.findOne(node=>node.name==='li'&&node.attribs?.['data-stage']==='source',document.children);
 const count=DomUtils.findOne(node=>node.name==='li'&&node.attribs?.['data-stage']==='count',document.children);
 assert.match(DomUtils.textContent(source),/Find stories.*“Zhuangzi” · Any theme.*Time: 0m 12s/s);
 assert.equal((html.match(/“Zhuangzi” · Any theme/g)||[]).length,1);
 assert.doesNotMatch(beforeSteps(html),/“Zhuangzi”/);
 const scoped=setup({...session,selection:{...session.selection,discoverySources:[session.selection.source]}});
 assert.match(stage(scoped,'source'),/“Zhuangzi” · Any theme · Selected 1 source sections/);
 assert.doesNotMatch(scoped,/已定位原文章节与段落/);
 assert.deepEqual(DomUtils.findAll(node=>node.name==='a',source.children).map(node=>DomUtils.textContent(node)),["Source","Choose another story"]);
 assert.doesNotMatch(beforeSteps(html),/原文<|Choose another story/);
 assert.doesNotMatch(html,/Production workflow navigation|（可选）/);
 const heading=DomUtils.findOne(node=>node.name==='strong',count.children);
 assert.equal(DomUtils.textContent(heading),"Production confirmation");
 assert.equal(DomUtils.findOne(node=>node.name==='a',heading.children),null);
 const settings=DomUtils.findOne(node=>node.attribs?.['aria-label']==="Production settings",count.children);
 assert.deepEqual(DomUtils.findAll(node=>node.name==='a',settings.children).map(node=>node.attribs['aria-label']||DomUtils.textContent(node)),["Production instructions","Acceptance criteria","Change art style","Change narrative detail"]);
 assert.match(DomUtils.textContent(settings),/Art style: Cinematic Realism.*Narrative detail: Balanced/s);
 assert.match(stage(html,'prepare'),/Prepare story.*Source text and summary verified.*Time: 0m 26s/s);
 assert.doesNotMatch(DomUtils.textContent(count),/耗时|Source text and summary verified/);
 assert.ok(DomUtils.textContent(count).indexOf("Production instructions")<DomUtils.textContent(count).indexOf("Start production"));
 const unknown=setup({...session,generationProgress:{...session.generationProgress,stageDurations:undefined}});
 assert.doesNotMatch(unknown,/Time:/);assert.match(stage(unknown,'prepare'),/Source text and summary verified/);
 const legacy=setup({...session,frameRecommendation:{count:7,reason:'历史制作建议。'}});
 assert.match(stage(legacy,'prepare'),/Source text and production suggestions saved/);assert.doesNotMatch(stage(legacy,'prepare'),/梗概已核对/);
 const preparing=setup({...session,intake:{...session.intake,phase:'preparing'},frameRecommendation:null,generationProgress:{...session.generationProgress,phase:'recommend'}});
 assert.match(stage(preparing,'count'),/Production instructions.*Acceptance criteria.*Art style: Cinematic Realism.*Narrative detail: Balanced/s);
 assert.doesNotMatch(stage(preparing,'prepare'),/梗概已核对|耗时|Start production/);
 assert.doesNotMatch(stage(preparing,'count'),/耗时|Start production/);
 const failed=setup({...session,state:'failed',error:'原文准备失败。',intake:{...session.intake,phase:'preparing'},frameRecommendation:null,faults:[{id:'prepare-fault',stage:'prepare',page:null,message:'原文准备失败。',state:'pending',retryAllowed:true}],generationProgress:{...session.generationProgress,phase:'recommend'}});
 assert.match(stage(failed,'prepare'),/原文准备失败/);assert.doesNotMatch(stage(failed,'count'),/原文准备失败/);
});

test('active steps show only their timeout countdown below the current step',()=>{
 const now=Date.now();
 const session={...base,state:'running',productionState:'running',error:null,generationProgress:{...base.generationProgress,startedAt:now-65000,timeoutAt:now+235000}};
 for(const [phase,target,review] of [['plan','plan',{}],['review','review',{reviewStatus:'pending'}],['repair','repair',{reviewStatus:'repair'}],['review','recheck',{reviewStatus:'pending',repairPasses:1}],['image','image',{reviewStatus:'passed'}]]){
  const active={...session,...(phase==='plan'?{}:{story:{pages:Array(4).fill({})}}),generationProgress:{...session.generationProgress,phase,...review}};
  const html=render(active);
  assert.match(stage(html,target),/Time until timeout:/);assert.doesNotMatch(stage(html,target),/本阶段|耗时|Generating整篇|Outline saved/);
  assert.doesNotMatch(beforeSteps(html),/本阶段|Time until timeout:|耗时/);
  assert.equal((html.match(/Time until timeout:/g)||[]).length,1);
  for(const id of ['source','count','plan','review','repair','recheck','image'])if(id!==target)assert.doesNotMatch(stage(html,id),/本阶段|Time until timeout:|耗时/);
 }
 const expired=render({...session,generationProgress:{...session.generationProgress,timeoutAt:now-1000}});
 assert.match(stage(expired,'plan'),/Timed out. Waiting for a status update/);
 assert.doesNotMatch(beforeSteps(expired),/已达超时/);
 for(const fields of [{generationControl:'paused'},{productionState:'queued'}])assert.doesNotMatch(render({...session,...fields}),/本阶段|Time until timeout:|已达超时/);
});

test('completed steps retain their own final duration as the current step changes or finishes',()=>{
 const now=Date.now(),meta={...base.generationProgress,startedAt:now-5000,timeoutAt:now+295000,stageDurations:{source:2,count:3,plan:65,review:12,repair:0,recheck:8,image:40}};
 const session={...base,state:'running',productionState:'running',error:null,story:{pages:Array(4).fill({})},generationProgress:{...meta,phase:'review',reviewStatus:'pending'}};
 const reviewing=render(session);
 assert.match(stage(reviewing,'plan'),/Time: 1m 05s/);assert.match(stage(reviewing,'source'),/Time: 0m 02s/);
 assert.doesNotMatch(stage(reviewing,'review'),/Time:/);
 const drawing=render({...session,generationProgress:{...meta,phase:'image',reviewStatus:'passed'}});
 assert.match(stage(drawing,'plan'),/Time: 1m 05s/);assert.match(stage(drawing,'review'),/Time: 0m 12s/);
 assert.doesNotMatch(stage(drawing,'repair'),/Time:/);
 const done=render({...session,state:'completed',ready:4,generationProgress:{...meta,phase:'completed',reviewStatus:'passed'}});
 assert.match(stage(done,'plan'),/Time: 1m 05s/);assert.match(stage(done,'image'),/Time: 0m 40s/);
 assert.doesNotMatch(beforeSteps(done),/Time:/);
 const unknown=render({...session,generationProgress:{...session.generationProgress,stageDurations:undefined}});
 assert.doesNotMatch(unknown,/Time:/);
});

test('active recovery is concise, retains the old error in a closed disclosure and has no retry button',()=>{
 const session={...base,state:'running',productionState:'running',error:null,ready:0,generationProgress:{...base.generationProgress,storyboardFrames:40,storyboardBatch:{first:41,last:60},frameCount:80,startedAt:Date.now()-49000,timeoutAt:Date.now()+851000},faults:[{id:'retrying',stage:'generation',page:null,message:'Codex 生成等待超时，已保留前面的内容。可稍后重试。',state:'recovering',retryAllowed:true}]};
 const html=render(session),document=parseDocument(html);
 assert.match(stage(html,'plan'),/Resuming generation/);assert.match(stage(html,'plan'),/Time until timeout:/);
 assert.doesNotMatch(stage(html,'plan'),/本阶段|batches of at most|Generating整篇/);
 assert.doesNotMatch(html,/>Retry generation<\/a>/);
 const detail=DomUtils.findOne(node=>node.name==='details'&&node.attribs?.class==='yu-recovery-detail',document.children);assert.ok(detail);assert.equal(detail.attribs.open,undefined);assert.ok(DomUtils.textContent(detail).includes(session.faults[0].message));
 const noDeadline=render({...session,generationProgress:{...session.generationProgress,timeoutAt:null}});
 assert.match(stage(noDeadline,'plan'),/Timeout details are syncing/);assert.doesNotMatch(noDeadline,/本阶段|耗时/);
});

test('finished steps contain only their name, result and final time, and flow operations are links',()=>{
 const session={...base,state:'completed',error:null,ready:4,story:{pages:Array(4).fill({})},generationProgress:{...base.generationProgress,phase:'completed',reviewStatus:'passed',stageDurations:{plan:65,review:12,image:40}}};
 const html=render(session,{timeline:{actions:{plan:{label:"View storyboard",onClick:noop}}},onHistory:noop}),document=parseDocument(html);
 const plan=DomUtils.findOne(node=>node.name==='li'&&node.attribs?.['data-stage']==='plan',document.children);
 assert.match(DomUtils.textContent(plan),/Storyboard batches.*4 frames of storyboard saved.*Time: 1m 05s/s);
 assert.ok(DomUtils.findOne(node=>node.attribs?.class==='production-stage-icon',plan.children));
 assert.equal(DomUtils.findOne(node=>node.attribs?.class==='production-stage-state',plan.children),null);
 assert.equal(DomUtils.findOne(node=>node.name==='button',document.children),null);
 assert.ok(DomUtils.findOne(node=>node.name==='a'&&node.attribs?.['aria-label']==="View storyboard",plan.children));
 const failed=parseDocument(render(base));assert.equal(DomUtils.findOne(node=>node.name==='button',failed.children),null);
 const paused=parseDocument(render({...base,generationControl:'paused'}));assert.ok(DomUtils.findOne(node=>node.name==='a'&&DomUtils.textContent(node)==="Resume generation",paused.children));
});

test('flow links prevent fragment navigation and respect both local and fieldset locks',()=>{
 let calls=0,prevented=0;
 const event=locked=>({preventDefault(){prevented++;},currentTarget:{closest(){return locked?{}:null;}}});
 const enabled=Action({children:"Resume generation",onClick(){calls++;}});assert.equal(enabled.type,'a');enabled.props.onClick(event(false));assert.equal(calls,1);
 const disabled=Action({children:"Resume generation",disabled:true,onClick(){calls++;}});assert.equal(disabled.props['aria-disabled'],true);assert.equal(disabled.props.tabIndex,-1);disabled.props.onClick(event(false));assert.equal(calls,1);
 enabled.props.onClick(event(true));assert.equal(calls,1);assert.equal(prevented,3);
});

test('running countdown and final duration occupy the same right-side metadata slot',()=>{
 const now=Date.now(),session={...base,state:'running',productionState:'running',error:null,story:{pages:Array(4).fill({})},generationProgress:{...base.generationProgress,phase:'review',reviewStatus:'pending',startedAt:now-5000,timeoutAt:now+295000,stageDurations:{plan:65}}};
 const document=parseDocument(render(session));
 for(const [id,text] of [['plan','Time: 1m 05s'],['review',"Time until timeout:"]]){
  const step=DomUtils.findOne(node=>node.name==='li'&&node.attribs?.['data-stage']===id,document.children);
  const meta=step.children.find(node=>node.attribs?.class==='production-stage-meta');assert.ok(meta);assert.ok(DomUtils.textContent(meta).includes(text));
  const note=step.children.find(node=>node.attribs?.class==='production-stage-notice');if(note)assert.ok(!DomUtils.textContent(note).includes(text));
 }
});
