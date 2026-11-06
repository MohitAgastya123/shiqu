// Render actual reader controls to verify batch progress and automatic frame arrangement without a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {defaultProductionDirection} from '../lib/reader-prompts.ts';
import {revisionImpact} from '../lib/reader-revision.ts';
import {makePlan,selection} from './fixtures/production.mjs';

test('style-only revision UI preserves review progress and offers drawing without a fresh audit',async()=>{
 const bundle=await build({stdin:{contents:"export {StoryRevisionActions,revisionDraftSteps} from './client/ui/StoryRevisionEditor.tsx';",resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',loader:{'.css':'empty'}});
 const compiled={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),compiled,compiled.exports);
 const {StoryRevisionActions,revisionDraftSteps}=compiled.exports,base={selection,plan:makePlan(3),images:[],reviewStatus:'passed'},changes={artStyle:'paper-cut'};
 const editor={base,changes,impact:revisionImpact(base,changes),busy:false,submit(){},discard(){}};
 const html=renderToStaticMarkup(createElement(StoryRevisionActions,{editor,reviewOnSave:true}));
 assert.match(html,/Keep existing review progress/);assert.match(html,/If review passed, images are redrawn directly/);assert.match(html,/Save changes/);assert.doesNotMatch(html,/Save and review again|review again/);
 const steps=revisionDraftSteps(base,changes);
 assert.equal(steps.find(s=>s.id==='count').state,'done');assert.equal(steps.find(s=>s.id==='review').state,'done');assert.equal(steps.find(s=>s.id==='image').state,'current');
 assert.match(steps.find(s=>s.id==='review').detail,/Keep existing review progress/);
 assert.notEqual(revisionDraftSteps({...base,reviewStatus:'blocked'},changes).find(s=>s.id==='image').state,'current');
 const mixed={...changes,acceptancePrompt:'保留关键行动。'},mixedEditor={...editor,changes:mixed,impact:revisionImpact(base,mixed)};
 assert.match(renderToStaticMarkup(createElement(StoryRevisionActions,{editor:mixedEditor,reviewOnSave:true})),/Save and review again/);
});

test('reader renders saved directory, batch range, honest progress and automatic frame controls',async()=>{
 const bundle=await build({stdin:{contents:"export {default as Status} from './client/ui/StoryGenerationStatus.tsx';export {default as Count} from './client/ui/StoryFrameCount.tsx';export {default as Retry} from './client/ui/StoryRetry.tsx';export {default as Review} from './client/ui/StoryReviewTools.tsx';export {default as Editor} from './client/ui/StoryRevisionEditor.tsx';",resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',loader:{'.css':'empty'}});
 const compiled={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),compiled,compiled.exports);
 const {Status,Count,Retry,Review}=compiled.exports,session={id:'render',selection:{length:45},state:'running',productionState:'running',ready:0,story:null,error:null,stage:'正在编排第 21–40 幅分镜',awaitingFrameCount:false,frameRecommendation:null,generationProgress:{sourceReady:true,frameCountConfirmed:true,frameCount:45,phase:'plan',startedAt:Date.now(),attempt:1,storyboardFrames:20,storyboardBatch:{first:21,last:40}}};
 const status=renderToStaticMarkup(createElement(Status,{session,busy:false,error:'',onRetry(){},onBack(){}}));
 const timedSession={...session,generationProgress:{...session.generationProgress,startedAt:Date.now()-65000,timeoutAt:Date.now()+235000}};
 const timed=renderToStaticMarkup(createElement(Status,{session:timedSession,busy:false,error:'',onRetry(){},onBack(){}}));
 assert.doesNotMatch(timed,/本阶段|已用时/);assert.match(timed,/Time until timeout: 3m 5[45]s/);
 const expired=renderToStaticMarkup(createElement(Status,{session:{...timedSession,generationProgress:{...timedSession.generationProgress,timeoutAt:Date.now()-1000}},busy:false,error:'',onRetry(){},onBack(){}}));
 assert.match(expired,/Timed out. Waiting for a status update/);
 assert.match(status,/Saved 20 \/ 45 frames/);assert.match(status,/writing 21–40/);assert.doesNotMatch(status,/分镜目录已保存|正在生成整篇，离开页面后继续/);
 assert.doesNotMatch(status,/<progress/);assert.match(status,/In progress/);
 for(const label of ['Prepare English source','Detail and length','Storyboard batches','Full-story review','Targeted repairs','Recheck','Drawing'])assert.ok(status.includes(label),label);
 assert.match(status,/data-stage="review" data-state="pending"/);
 const count=renderToStaticMarkup(createElement(Count,{recommendation:{count:80,reason:'展开关键动作与转折。'},disabled:false,onConfirm(){}}));
 assert.doesNotMatch(count,/type="range"|type="number"/);assert.match(count,/80\s+pages/);assert.match(count,/Storyboarding and review determine/);
 const reviewing={...session,story:{pages:Array(45).fill({})},stage:'正在审核全篇分镜',generationProgress:{...session.generationProgress,phase:'review',reviewStatus:'pending',reviewRound:0}};
 const review=renderToStaticMarkup(createElement(Status,{session:reviewing,busy:false,error:'',onRetry(){},onBack(){}}));
 assert.match(review,/Full-story review/);assert.match(review,/Waiting for review approval/);assert.doesNotMatch(review,/<progress/);
 const blocked={...reviewing,state:'failed',error:'第 2 幅动作不清楚。',retryStage:'review',retryAllowed:true,generationProgress:{...reviewing.generationProgress,reviewStatus:'blocked',repairTotal:1}};
 const retry=renderToStaticMarkup(createElement(Status,{session:blocked,busy:false,error:blocked.error,onRetry(){},onBack(){}}));
 assert.match(retry,/Continue automatic repair/);assert.match(retry,/1 issues remain/);assert.match(retry,/第 2 幅动作不清楚/);
 const reviewProps={session:{...blocked,story:{original:{},pages:[{}]},reviewIssues:[{page:18,problem:'收尾缺少对应动作。',instruction:'补上掩面作哭状。'}],generationProgress:{...blocked.generationProgress,reviewStopReason:'limit',repairPasses:20,reviewAudits:21}},busy:false,error:'',onRetry(){},onScript(){},onEdit(){},onDrawAnyway(){}};
 const tools=renderToStaticMarkup(createElement(Review,reviewProps));
 const trimmed={...reviewProps.session,story:{pages:[{image:'/api/reader/images/saved.webp'}]},generationProgress:{...reviewProps.session.generationProgress,sourceReady:true}};
 const shelfTools=renderToStaticMarkup(createElement(Review,{...reviewProps,session:trimmed}));
 assert.match(shelfTools,/收尾缺少对应动作/);assert.match(shelfTools,/Continue automatic repair/);
 assert.equal(renderToStaticMarkup(createElement(Review,{...reviewProps,session:{...trimmed,story:null}})),'');
 assert.match(tools,/Completed 20.*automatic repair rounds; recheck still failed/);assert.match(tools,/Repaired for 20 rounds · Reviewed 21 times/);
 assert.match(tools,/up to 20 rounds/);assert.match(tools,/<a[^>]*class="story-flow-link"[^>]*>Continue automatic repair/);assert.match(tools,/Edit manually/);assert.match(tools,/Skip issues and draw/);assert.match(tools,/<details><summary>Revision suggestions/);
 const combined=renderToStaticMarkup(createElement(Status,{session:reviewProps.session,reviewTools:createElement(Review,reviewProps),busy:false,error:blocked.error,onRetry(){},onBack(){}}));
 assert.equal((combined.match(/Continue automatic repair/g)||[]).length,1,'Only the issue panel owns review recovery');assert.match(combined,/has-review-issues/);
 const unchanged=renderToStaticMarkup(createElement(Review,{...reviewProps,session:{...reviewProps.session,generationProgress:{reviewStopReason:'unchanged',repairPasses:1,reviewAudits:1}}}));
 assert.match(unchanged,/The previous revision made no actual changes/);assert.doesNotMatch(unchanged,/recheck still failed/);
 const incomplete=renderToStaticMarkup(createElement(Review,{...reviewProps,onReplan(){},session:{...reviewProps.session,retryAllowed:false,reviewIssues:[{page:18,requiresReplan:true,problem:'缺少原文已有的结局。',instruction:'重新分配全篇画幅。'}],generationProgress:{reviewStopReason:'replan',repairPasses:0,reviewAudits:1}}}));
 assert.match(incomplete,/Edit production instructions/);assert.match(incomplete,/Full story structure/);assert.match(incomplete,/Local repairs and drawing have stopped/);
 assert.doesNotMatch(incomplete,/Continue automatic repair|Edit page 18|已完成 20 轮/);
 const legacy=defaultProductionDirection.replace('按原文自身的事件、人物与因果展开，不额外套入主题或要求反转。','用相遇、犹疑与错过的具体细节表现感情，克制煽情，让未说出口的话和选择留下余味。');
 const editor={tab:'requirements',base:{selection:{artStyle:'chibi',theme:'爱情与错过',productionPrompt:legacy,length:18},plan:null},changes:{},impact:null,setTab(){},setChanges(){}};
 const neutral=renderToStaticMarkup(createElement(compiled.exports.Editor,{editor}));
 assert.doesNotMatch(neutral,/按原文自身的事件、人物与因果展开/);assert.doesNotMatch(neutral,/用相遇、犹疑与错过/);
 const authored=renderToStaticMarkup(createElement(compiled.exports.Editor,{editor:{...editor,changes:{productionPrompt:'保留人物原话，并在第一幅介绍当前处境。'}}}));
 assert.match(authored,/保留人物原话，并在第一幅介绍当前处境/);
 const oldLimit=renderToStaticMarkup(createElement(Review,{...reviewProps,session:{...reviewProps.session,generationProgress:{reviewStopReason:'limit',repairPasses:3,reviewAudits:4}}}));
 assert.match(oldLimit,/Completed 3.*automatic repair rounds/);assert.match(oldLimit,/up to 20 rounds/);
 for(const extra of [{busy:true},{session:{...reviewProps.session,retryAllowed:false}},{session:{...reviewProps.session,generationControl:'paused'}}]){
  const locked=renderToStaticMarkup(createElement(Review,{...reviewProps,...extra}));assert.match(locked,/<a[^>]*aria-disabled="true"/);
 }
 const pausedReview=renderToStaticMarkup(createElement(Review,{...reviewProps,session:{...reviewProps.session,generationControl:'paused'}}));assert.match(pausedReview,/Resume generation before/);
 for(const [retryStage,label] of [['source',"Retry source lookup"],['publication',"Retry image save"],['review',"Continue automatic repair"],['redraw',"Redraw image"],[undefined,"Retry generation"]]){
  const action=renderToStaticMarkup(createElement(Retry,{session:{...blocked,retryStage},busy:false,onRetry(){}}));
  assert.match(action,new RegExp(label));assert.doesNotMatch(action,/收费|计费|额度/);
  if(retryStage==='publication'){assert.match(action,/Retry image save/);assert.doesNotMatch(action,/重试展开/);}
 }
 const drawing={...reviewing,ready:3,stage:'正在生成画面',generationProgress:{...reviewing.generationProgress,phase:'image',reviewStatus:'passed'}};
 const images=renderToStaticMarkup(createElement(Status,{session:drawing,busy:false,error:'',onRetry(){},onBack(){}}));
 assert.doesNotMatch(images,/<progress/);assert.match(images,/3 \/ 45 images saved/);
 const paused=renderToStaticMarkup(createElement(Status,{session:{...session,generationControl:'paused'},busy:false,error:'',onRetry(){},onBack(){}}));
 assert.match(paused,/Paused/);assert.match(paused,/>Resume generation<\/a>/);assert.match(paused,/continue generation from your shelf/);assert.doesNotMatch(paused,/is-generating|production-stage-spin|class="spin"|<progress/);
 const queued=renderToStaticMarkup(createElement(Status,{session:{...session,productionState:'queued'},busy:false,error:'',onRetry(){},onBack(){}}));
 assert.match(queued,/Waiting/);assert.doesNotMatch(queued,/is-generating|production-stage-spin|class="spin"|<progress/);
});
