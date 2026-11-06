// Render real shared UI to guard the confirmation boundary and hide obsolete duplicate controls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const noop=()=>{};
test('discovery stays in the picker and selection opens one continuous story flow',async()=>{
 const bundle=await build({stdin:{contents:"export {default as Control} from './client/ui/StoryGenerationControl.tsx';export {default as Paused} from './client/ui/StoryPausedEditing.tsx';export {default as Editor,revisionDraftSteps} from './client/ui/StoryRevisionEditor.tsx';export {default as Setup,storyCreationTitle} from './client/ui/StoryCreationSetup.tsx';export {default as Review} from './client/ui/StoryReviewTools.tsx';export {StoryRevisionActions as Actions} from './client/ui/StoryRevisionEditor.tsx';export {default as Fields,StoryEditorTabs as Tabs} from './client/ui/StoryProductionEditor.tsx';",resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',loader:{'.css':'empty'}});
 const compiled={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),compiled,compiled.exports);
 const {Setup,storyCreationTitle,Fields,Tabs,Review,Actions,Paused,Editor,revisionDraftSteps,Control}=compiled.exports;
 const selection={bookId:'zhuangzi',storyTitle:'庄周梦蝶',theme:'选择',artStyle:'paper-cut',productionPrompt:'清楚的旁白。',narrativeDetail:'brief',length:'auto',voice:false};
 const session={id:'creating',selection,state:'idle',ready:0,story:null,error:null,awaitingFrameCount:false,retryAllowed:false,generationMode:'background',generationControl:'active',frameRecommendation:{count:7,reason:'保留因果。'},intake:{phase:'confirming',generation:1,search:{state:'idle'},selected:{batch:0,index:0},batches:[{stories:[{title:'庄周梦蝶',description:'不应铺开的候选介绍。'}],note:''}]},generationProgress:{sourceReady:true,frameCountConfirmed:false,phase:'production-confirmation'}};
 const html=renderToStaticMarkup(createElement(Setup,{session,book:'庄子',busy:false,onAction:async()=>{},progress:{busy:false,controlBusy:false,error:'',onControl:async()=>{},onRetry:noop,onBack:noop}}));
 assert.equal((html.match(/<ol /g)||[]).length,1);assert.match(html,/Choose another/);assert.match(html,/>Start production<\/(?:button|a)>/);assert.match(html,/Art style: Paper Cut/);assert.match(html,/Narrative detail: Brief/);assert.match(html,/Production instructions/);
 for(const label of ["Source","Production instructions","Change art style","Change narrative detail"])assert.ok(html.includes(label),label);
 assert.doesNotMatch(html,/<textarea|type="radio"|不应铺开的候选介绍|Edit storyboard|制作内容可从流程步骤修改|确认前不会/);
 assert.match(html,/data-stage="plan" data-state="pending"/);assert.match(html,/data-stage="image" data-state="pending"/);assert.doesNotMatch(html,/制作故事|yu-creation-confirmation|yu-creation-summary/);
 const props={session,book:'庄子',busy:false,onAction:async()=>{},progress:{busy:false,controlBusy:false,error:'',onControl:async()=>{},onRetry:noop,onBack:noop}};
 const choosing={...session,intake:{...session.intake,phase:'choosing',selected:undefined}};
 // Discovery, an empty result, and late candidate updates keep the same picker title and layout.
 for(const phase of ['discovering','choosing']){
  const waiting={...choosing,state:'running',intake:{...choosing.intake,phase,search:{state:'searching'},batches:[]}};
  assert.equal(storyCreationTitle(waiting),"Choose a story");
  const opening=renderToStaticMarkup(createElement(Setup,{...props,session:waiting}));
  assert.match(opening,/Extracting stories. Results appear as they are found/);assert.doesNotMatch(opening,/data-stage=|Generation progress|制作故事|Story workflow|yu-generation-stage/);
 }
 for(const phase of ['preparing','confirming','confirmed'])assert.equal(storyCreationTitle({...session,intake:{...session.intake,phase}}),"Story workflow");
 const incomplete=renderToStaticMarkup(createElement(Setup,{...props,session:{...choosing,intake:{...choosing.intake,batches:[{stories:[],note:'原文已读完，但有未能判断的故事，主题检查尚不完整。'}]}}}));
 assert.match(incomplete,/未能判断的故事/);assert.doesNotMatch(incomplete,/还没有找到符合主题/);
 const candidates=renderToStaticMarkup(createElement(Setup,{...props,session:choosing}));
 assert.match(candidates,/Found 1.*stories/);assert.doesNotMatch(candidates,/Full review workflow|Start production|<textarea|Narrative detail|<select|候选批次/);
 // The review tools stay reachable once a reused first image exists; a clean story has no need of them.
 const reviewProps={busy:false,error:'',onScript:noop,onEdit:noop,onRetry:noop,onDrawAnyway:noop},story=image=>({original:{},pages:[{image}]}),issue={page:3,problem:'配文含混。',instruction:'说清楚。'};
 assert.match(renderToStaticMarkup(createElement(Review,{...reviewProps,session:{story:story('/a.png'),reviewIssues:[issue]}})),/Skip issues and draw/);
 const endingReview=renderToStaticMarkup(createElement(Review,{...reviewProps,session:{story:story('/a.png'),reviewIssues:[{...issue,page:0,category:'reflection'}]}}));
 assert.match(endingReview,/<strong>Ending<\/strong>/);assert.doesNotMatch(endingReview,/第 0 幅/);
 assert.equal(renderToStaticMarkup(createElement(Review,{...reviewProps,session:{story:story('/a.png')}})),'');
 const unreviewed=renderToStaticMarkup(createElement(Review,{...reviewProps,session:{story:story('')}}));assert.match(unreviewed,/View storyboard/);assert.doesNotMatch(unreviewed,/Skip issues and draw/);
 // Each issue carries its own saved frame number, including zero for the separate ending.
 const targeted=[];
 const reviewTree=Review({...reviewProps,onEdit:page=>targeted.push(page),session:{story:story(''),reviewIssues:[issue,{...issue,page:18},{...issue,page:0,category:'reflection'}]}});
 const visit=node=>{
  if(Array.isArray(node)){node.forEach(visit);return;}
  if(!node?.props)return;
  if(node.props['aria-label']?.startsWith('Edit '))node.props.onClick();
  visit(node.props.children);
 };
 visit(reviewTree);assert.deepEqual(targeted,[3,18,0]);
 const reviewMarkup=renderToStaticMarkup(reviewTree);assert.match(reviewMarkup,/aria-label="Edit page 18"/);assert.match(reviewMarkup,/aria-label="Edit ending manually"/);
 // Both the editor and the settings sheet show these actions, so a conflict cannot go unseen.
 const conflict=renderToStaticMarkup(createElement(Actions,{editor:{impact:{changed:true,replan:false,reused:1,redraw:0,conflict:false},conflict:true,error:'',busy:false,submit:noop,discard:noop,load:noop,setChanges:noop}}));
 assert.match(conflict,/Discard draft and load latest/);assert.match(conflict,/will not merge automatically/);
 // Search and selection report separately; each offers only the action that applies.
 const failedSearch=renderToStaticMarkup(createElement(Setup,{...props,session:{...session,intake:{...session.intake,search:{state:'failed',error:'查找暂未完成。'}}}}));
 assert.match(failedSearch,/查找暂未完成/);assert.match(failedSearch,/Retry search/);assert.match(failedSearch,/Start production/);assert.doesNotMatch(failedSearch,/Prepare this story/);
 const firstFailed=renderToStaticMarkup(createElement(Setup,{...props,session:{...choosing,intake:{...choosing.intake,batches:[],search:{state:'failed',error:'查找暂未完成。'}}}}));
 assert.match(firstFailed,/Retry search/);
 const searching=renderToStaticMarkup(createElement(Setup,{...props,session:{...session,intake:{...session.intake,search:{state:'searching'}}}}));
 assert.doesNotMatch(searching,/正在寻找更多故事|Extracting stories. Results appear as they are found/);assert.match(searching,/Start production/);assert.doesNotMatch(searching,/<button[^>]*disabled[^>]*>Start production/);
 const pausedSearch=renderToStaticMarkup(createElement(Setup,{...props,session:{...session,generationControl:'paused',intake:{...session.intake,search:{state:'searching'}}}}));
 assert.match(pausedSearch,/Extraction is paused/);assert.doesNotMatch(pausedSearch,/正在寻找更多故事/);
 const pausedConfirmation=renderToStaticMarkup(createElement(Setup,{...props,session:{...session,generationControl:'paused'}}));
 assert.match(pausedConfirmation,/>Start production<\/(?:button|a)>/);assert.doesNotMatch(pausedConfirmation,/>Resume generation<\/a>/);
 const unprepared={...session,frameRecommendation:null,intake:{...session.intake,phase:'choosing'}};
 assert.match(renderToStaticMarkup(createElement(Setup,{...props,session:unprepared})),/Prepare this story/);
 const failedPreparation=renderToStaticMarkup(createElement(Setup,{...props,session:{...unprepared,state:'failed',error:'准备失败。',retryAllowed:true,intake:{...session.intake,phase:'preparing'}}}));
 assert.doesNotMatch(failedPreparation,/Prepare this story/);assert.match(failedPreparation,/yu-retry-control/);
 assert.match(renderToStaticMarkup(createElement(Setup,{...props,session:{...session,intake:{...session.intake,draft:{artStyle:'paper-cut',productionPrompt:'手改',narrativeDetail:'brief',length:5}}}})),/Narrative detail: Brief/);
 const preparing=renderToStaticMarkup(createElement(Setup,{...props,session:{...session,state:'running',frameRecommendation:null,intake:{...session.intake,phase:'preparing'}}}));
 assert.match(preparing,/Generation progress/);assert.match(preparing,/data-stage="count"/);assert.doesNotMatch(preparing,/>Start production<\/(?:button|a)>/);
 const pausedPreparation=renderToStaticMarkup(createElement(Setup,{...props,session:{...session,state:'idle',generationControl:'paused',frameRecommendation:null,intake:{...session.intake,phase:'preparing'}}}));
 assert.match(pausedPreparation,/Resume preparation/);assert.match(pausedPreparation,/Generation progress/);
 for(const label of ["Production instructions","Change art style","Change narrative detail","Choose another story"])assert.ok(pausedPreparation.includes(label),label);
 const pausedProps={navigation:{source:{onClick:noop}},session:{...session,intake:undefined,generationControl:'paused'},...props.progress,editor:{base:null,changes:{},impact:null,busy:false,open:noop},onReselect:noop};
 const pausedWithoutPlan=renderToStaticMarkup(createElement(Paused,pausedProps));
 const pausedTimeline=pausedWithoutPlan.match(/<ol .*?<\/ol>/s)[0];
 for(const label of ["Production instructions","Change art style","Change narrative detail"])assert.ok(pausedTimeline.includes(label),label);
 assert.doesNotMatch(pausedTimeline,/Choose another story/);
 const assertFlowNavigation=(markup,reselect="Choose another story")=>{const nav=markup.match(/<nav aria-label="Production workflow navigation">.*?<\/nav>/s)?.[0];assert.ok(nav);assert.match(nav,/>Source<\/a>/);assert.ok(nav.includes('>'+reselect+'</a>'));assert.ok(nav.indexOf('>Source</a>')<nav.indexOf('>'+reselect+'</a>'));assert.equal((markup.match(/aria-label="Production workflow navigation"/g)||[]).length,1);assert.doesNotMatch(markup.match(/<ol .*?<\/ol>/s)?.[0]||'',/Choose another story/);};
 assert.doesNotMatch(html,/<nav aria-label="Production workflow navigation"/);assertFlowNavigation(pausedWithoutPlan,"Replace story selection");
 const lockedPaused=renderToStaticMarkup(createElement(Paused,{...pausedProps,controlBusy:true}));assert.match(lockedPaused,/<a[^>]*aria-disabled="true"[^>]*>Replace story selection<\/a>/);
 assert.match(lockedPaused,/<a[^>]*aria-disabled="true"[^>]*>Source<\/a>/);
 assert.equal((pausedWithoutPlan.match(/>Resume generation<\/a>/g)||[]).length,1);
 assert.match(pausedWithoutPlan,/<a[^>]*class="story-flow-link"[^>]*>Resume generation<\/a>/);
 assert.doesNotMatch(pausedWithoutPlan,/暂停后修改|Start production|yu-review-tools/);
 assert.equal(renderToStaticMarkup(createElement(Paused,{...pausedProps,session})), '');
 const opened=[],controls=[];
 const pausedSurface=Paused({...pausedProps,editor:{...pausedProps.editor,open:tab=>opened.push(tab)}});
 pausedSurface.props.timeline.links.source[0].onClick();pausedSurface.props.timeline.detailActions.source.onClick();pausedSurface.props.timeline.actions.count.onClick();
 assert.deepEqual(opened,['requirements','style','count']);assert.deepEqual(controls,[]);
 const resume=Control({session:pausedProps.session,busy:false,primary:true,onControl:async(id,action)=>controls.push([id,action])});
 await resume.props.onClick();assert.deepEqual(controls,[[session.id,'resume']]);
 // The shared control stays compact unless the flow dialog explicitly asks for a primary action.
 const shelfControl=renderToStaticMarkup(createElement(Control,{session:pausedProps.session,busy:false,onControl:noop}));
 assert.match(shelfControl,/class="yu-generation-control"/);assert.doesNotMatch(shelfControl,/class="yu-primary"/);
 const emptyPlanEditor=renderToStaticMarkup(createElement(Editor,{editor:{base:{selection:{...selection,length:5},plan:null,images:[]},changes:{},tab:'count',busy:false,loading:false,setTab:noop,setChanges:noop,impact:{changed:true,replan:true,total:5},submit:noop,discard:noop}}));
 assert.match(emptyPlanEditor,/Narrative detail/);assert.doesNotMatch(emptyPlanEditor,/type="number"|type="range"/);assert.match(emptyPlanEditor,/Start production/);assert.doesNotMatch(emptyPlanEditor,/保持暂停|Resume generation/);assert.doesNotMatch(emptyPlanEditor,/>Storyboard<|保存修改并加入队列/);
 const targetedPlan={pages:Array.from({length:20},(_,i)=>({caption:`第 ${i+1} 幅已保存的旁白。`,prompt:`Saved scene ${i+1}.`})),characters:'已保存的人物设定。',reflection:'已保存的余味。'};
 const targetEditor={base:{selection,plan:targetedPlan,images:[]},changes:{},tab:'script',scriptPage:18,busy:false,loading:false,setTab:noop,setScriptPage:noop,setChanges:noop,impact:{changed:false,replan:false,total:20},submit:noop,discard:noop};
 const targetMarkup=renderToStaticMarkup(createElement(Editor,{editor:targetEditor}));
 assert.match(targetMarkup,/<option value="18" selected="">Page 18<\/option>/);assert.match(targetMarkup,/aria-label="Edit page 18"/);assert.match(targetMarkup,/>第 18 幅已保存的旁白。<\/textarea>/);assert.doesNotMatch(targetMarkup,/aria-label="Edit page 1"/);
 const endingMarkup=renderToStaticMarkup(createElement(Editor,{editor:{...targetEditor,scriptPage:0}}));
 assert.match(endingMarkup,/<option value="0" selected="">Ending<\/option>/);assert.match(endingMarkup,/>已保存的余味。<\/textarea>/);assert.doesNotMatch(endingMarkup,/aria-label="Edit page|Image prompt/);
 const reviewIssues=[{page:18,category:'action',problem:'缺少第18幅的关键动作。',instruction:'补充第18幅的动作和反应。'},{page:3,category:'caption',problem:'第3幅旁白含混。',instruction:'第3幅补充明确的主语。'},{page:0,category:'reflection',problem:'结语超出了原文。',instruction:'结语收回到原文支持的判断。'}];
 const referenced=renderToStaticMarkup(createElement(Editor,{editor:targetEditor,reviewIssues}));
 assert.match(referenced,/<details open="" class="yu-revision-review" aria-label="Page 18 review notes"/);assert.match(referenced,/<dt>Review issue<\/dt><dd>缺少第18幅的关键动作。<\/dd>/);assert.match(referenced,/<dt>Revision suggestions<\/dt><dd>补充第18幅的动作和反应。<\/dd>/);
 assert.doesNotMatch(referenced,/第3幅旁白含混|结语超出了原文/);assert.ok(referenced.indexOf('缺少第18幅')<referenced.indexOf('aria-label="Edit page 18"'));
 const switchedReview=renderToStaticMarkup(createElement(Editor,{editor:{...targetEditor,scriptPage:3},reviewIssues}));
 assert.match(switchedReview,/第3幅旁白含混/);assert.match(switchedReview,/第3幅补充明确的主语/);assert.doesNotMatch(switchedReview,/缺少第18幅|结语超出了原文/);
 const endingReference=renderToStaticMarkup(createElement(Editor,{editor:{...targetEditor,scriptPage:0},reviewIssues}));
 assert.match(endingReference,/aria-label="Ending review notes"/);assert.match(endingReference,/结语超出了原文/);assert.match(endingReference,/结语收回到原文支持的判断/);assert.doesNotMatch(endingReference,/缺少第18幅|第3幅旁白含混/);
 const cleanReview=renderToStaticMarkup(createElement(Editor,{editor:{...targetEditor,scriptPage:2},reviewIssues}));
 assert.doesNotMatch(cleanReview,/yu-revision-review|Review issue|Revision suggestions/);
 const changedReview=renderToStaticMarkup(createElement(Editor,{editor:{...targetEditor,changes:{plan:{...targetedPlan,pages:targetedPlan.pages.map((p,i)=>i===17?{...p,caption:'手改后的第十八幅旁白。'}:p)}}},reviewIssues}));
 assert.match(changedReview,/缺少第18幅的关键动作/);assert.match(changedReview,/手改后的第十八幅旁白/);
 // Review corrections submit immediately even from settings or a paused editor with onDone.
 // A manual frame correction requires review (lib/reader-revision.ts), unlike a style-only change.
 for(const resuming of [false,true]){
  const saving=renderToStaticMarkup(createElement(Editor,{editor:{...targetEditor,impact:{...targetEditor.impact,changed:true,review:true}},reviewIssues,onDone:noop,resuming}));
  assert.match(saving,resuming?/>Apply changes and resume<\/button>/:/>Save and review again<\/button>/);assert.match(saving,/Drawing follows approval/);assert.doesNotMatch(saving,/>Done editing<\/button>|>Resume generation<\/a>|>Start production<\/(?:button|a)>/);
 }
 let submitted=0,finished=0;
 const saveTree=Actions({editor:{...targetEditor,impact:{...targetEditor.impact,changed:true,review:true},submit:()=>{submitted++;}},reviewOnSave:true,onDone:()=>{finished++;}});
 const findPrimary=node=>{
  if(Array.isArray(node))return node.map(findPrimary).find(Boolean);
  if(!node?.props)return;
  return node.type==='button'&&node.props.className==='yu-primary'?node:findPrimary(node.props.children);
 };
 findPrimary(saveTree).props.onClick();assert.equal(submitted,1);assert.equal(finished,0);
 for(const state of [{impact:{...targetEditor.impact,changed:false}},{impact:{...targetEditor.impact,changed:true,conflict:true}},{impact:{...targetEditor.impact,changed:true,review:true},conflict:true},{impact:{...targetEditor.impact,changed:true,review:true},busy:true}]){
  const disabled=Actions({editor:{...targetEditor,...state},reviewOnSave:true,onDone:noop});assert.equal(findPrimary(disabled).props.disabled,true);
 }
 const shorterMarkup=renderToStaticMarkup(createElement(Editor,{editor:{...targetEditor,changes:{plan:{...targetedPlan,pages:targetedPlan.pages.slice(0,3)}}}}));
 assert.match(shorterMarkup,/aria-label="Edit page 3"/);

 // Settings edits return to a draft preview; only the explicit production action submits.
 const draftEditor={base:{selection:{...selection,length:5},plan:null,images:[]},changes:{length:'auto',narrativeDetail:'detailed',artStyle:'ink-pencil'},tab:'count',busy:false,loading:false,setTab:noop,setChanges:noop,impact:{changed:true,replan:true,total:30},submit:noop,discard:noop};
 const editing=renderToStaticMarkup(createElement(Editor,{editor:draftEditor,onDone:noop}));
 assert.match(editing,/>Done editing<\/button>/);assert.doesNotMatch(editing,/>Start production<\/(?:button|a)>|保持暂停|Resume generation/);
 const confirmation=renderToStaticMarkup(createElement(Actions,{editor:draftEditor}));
 assert.match(confirmation,/>Start production<\/(?:button|a)>/);assert.doesNotMatch(confirmation,/>Done editing<\/button>|保持暂停|Resume generation/);
 const pausedDraft=renderToStaticMarkup(createElement(Paused,{...pausedProps,editor:draftEditor}));
 assert.match(pausedDraft,/Planned by narrative detail · Count confirmed after review/);assert.doesNotMatch(pausedDraft,/Start production|暂停后修改/);
 assert.equal((pausedDraft.match(/>Apply changes and resume<\/a>/g)||[]).length,1);
 const pausedEditor=renderToStaticMarkup(createElement(Editor,{editor:draftEditor,onDone:noop,resuming:true}));
 assert.match(pausedEditor,/>Done editing<\/button>/);assert.doesNotMatch(pausedEditor,/>Resume generation<\/a>|Start production/);
 const pausedConflict=renderToStaticMarkup(createElement(Paused,{...pausedProps,editor:{...draftEditor,conflict:true}}));
 assert.match(pausedConflict,/<a[^>]*aria-disabled="true"[^>]*>Apply changes and resume<\/a>/);
 const draftSteps=revisionDraftSteps(draftEditor.base,draftEditor.changes);
 assert.equal(draftSteps.find(s=>s.id==='count').detail,"Planned by narrative detail · Count confirmed after review");
 assert.equal(draftSteps.find(s=>s.id==='count').state,'current');
 assert.equal(draftSteps.find(s=>s.id==='source').detail,'Art style: Colored Pencil');
 for(const id of ['plan','review','repair','recheck','image'])assert.equal(draftSteps.find(s=>s.id===id).state,'pending',id);
 const savedPlan={pages:Array(5).fill({caption:'已保存的旁白。',prompt:'Saved scene.'})};
 const styleSteps=revisionDraftSteps({...draftEditor.base,plan:savedPlan,reviewStatus:'passed'},{artStyle:'ink-pencil'});
 assert.equal(styleSteps.find(s=>s.id==='plan').state,'done');assert.equal(styleSteps.find(s=>s.id==='review').state,'done');assert.equal(styleSteps.find(s=>s.id==='review').detail,'Keep existing review progress');assert.equal(styleSteps.find(s=>s.id==='image').state,'current');
 const manualSteps=revisionDraftSteps({...draftEditor.base,plan:savedPlan},{plan:{...savedPlan,reflection:'手改余味。'}});
 assert.equal(manualSteps.find(s=>s.id==='plan').detail,"Storyboard edited · Awaiting review");

 const transportFailure=renderToStaticMarkup(createElement(Setup,{...props,session:{...session,retryAllowed:true,intake:{...session.intake,phase:'preparing'}},progress:{...props.progress,error:'网络暂时不可用'}}));
 assert.match(transportFailure,/网络暂时不可用/);assert.match(transportFailure,/yu-retry-control/);
 const started=renderToStaticMarkup(createElement(Setup,{...props,session:{...session,state:'running',intake:{...session.intake,phase:'confirmed'},generationProgress:{...session.generationProgress,phase:'plan',frameCount:7,frameCountConfirmed:true}}}));
 assert.match(started,/Generation progress/);assert.match(started,/data-stage="plan"/);assert.doesNotMatch(started,/>Start production<\/(?:button|a)>/);
 const collected={...choosing,intake:{...choosing.intake,batches:[...choosing.intake.batches,{stories:[{title:'佝偻承蜩',description:'追加找到的故事。'},{title:'庄周梦蝶',description:'同名但出处不同的选项。',sourceLabel:'另一处原文'}],note:''}]}};
 const all=renderToStaticMarkup(createElement(Setup,{...props,session:collected}));
 assert.match(all,/Found 3.*stories/);assert.match(all,/佝偻承蜩|追加找到的故事/);assert.match(all,/另一处原文/);assert.equal((all.match(/<strong>庄周梦蝶<\/strong>/g)||[]).length,2);assert.doesNotMatch(all,/<select|候选批次/);

 const paused=renderToStaticMarkup(createElement(Setup,{...props,session:{...choosing,generationControl:'paused'}}));
 assert.match(paused,/Resume generation/);
 const failed=renderToStaticMarkup(createElement(Setup,{...props,session:{...choosing,state:'failed',error:'受控提取失败',retryAllowed:true}}));
 assert.match(failed,/重试|受控提取失败/);

 const createTabs=renderToStaticMarkup(createElement(Tabs,{tab:'style',onChange:noop})),revisionTabs=renderToStaticMarkup(createElement(Tabs,{tab:'script',onChange:noop,script:true}));
 assert.doesNotMatch(createTabs,/Storyboard/);assert.match(revisionTabs,/Storyboard/);
 const count=renderToStaticMarkup(createElement(Fields,{tab:'count',settings:{artStyle:'paper-cut',productionPrompt:'',length:'auto',narrativeDetail:'balanced'},disabled:true,creation:true,onChange:noop}));
 assert.match(count,/disabled/);assert.match(count,/Narrative detail/);assert.doesNotMatch(count,/type="number"|type="range"|保存修改并加入队列/);
 const patches=[];const detailTree=Fields({tab:'count',settings:{artStyle:'paper-cut',productionPrompt:'',length:7,narrativeDetail:'balanced'},disabled:false,onChange:p=>patches.push(p)});
 const choose=node=>{if(Array.isArray(node)){node.forEach(choose);return;}if(!node?.props)return;if(node.type==='button'&&node.props.children?.[0]?.props?.children==="Detailed")node.props.onClick();choose(node.props.children);};
 choose(detailTree);assert.deepEqual(patches,[{narrativeDetail:'detailed',length:'auto'}]);
 const style=renderToStaticMarkup(createElement(Fields,{tab:'style',settings:{artStyle:'paper-cut',productionPrompt:'',length:7},artRecommendation:{artStyle:'woodblock',reason:'鲜明轮廓适合人物动作。'},disabled:false,creation:true,onChange:noop}));
 assert.match(style,/Recommended: Woodblock Print/);assert.match(style,/鲜明轮廓适合人物动作。/);assert.match(style,/Current choice: Paper Cut/);assert.match(style,/Use recommendation/);
});
