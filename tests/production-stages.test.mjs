// English timelines retain checkpoint semantics and translated-source readiness.
// Review stages must agree across reader metadata and read-only native/preview summaries.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {productionSteps} from '../lib/production-stages.ts';
import {readLibrarySummary} from '../desktop/library-preview.ts';
import {migrate} from '../server/database-migrations.ts';
import {view} from '../lib/reader-model.ts';
import {generationProgress} from '../lib/generation-progress.ts';
const base={sourceReady:true,frameCountConfirmed:true,planReady:true,total:45,ready:0,reviewStatus:'pending',reviewRound:0};
const states=input=>productionSteps({...base,...input}).map(s=>s.state);
test('seven steps distinguish initial review, targeted repair, recheck, skipped work and legacy stories',()=>{
 assert.deepEqual(productionSteps(base).map(s=>s.label),['Prepare English source','Detail and length','Storyboard batches','Full-story review','Targeted repairs','Recheck','Drawing']);
 assert.deepEqual(states({phase:'source',planReady:false,sourceReady:false,frameCountConfirmed:false,reviewStatus:null}),['current','pending','pending','pending','pending','pending','pending']);
 assert.deepEqual(states({phase:'frame-count',planReady:false,frameCountConfirmed:false,reviewStatus:null}),['done','current','pending','pending','pending','pending','pending']);
 assert.deepEqual(states({phase:'plan',planReady:false,reviewStatus:null}),['done','done','current','pending','pending','pending','pending']);
 assert.deepEqual(states({phase:'review'}),['done','done','done','current','pending','pending','pending']);
 assert.deepEqual(states({phase:'repair',reviewStatus:'repair',reviewRound:1}),['done','done','done','done','current','pending','pending']);
 assert.deepEqual(states({phase:'review',reviewRound:1}),['done','done','done','done','done','current','pending']);
 assert.deepEqual(states({phase:'image',reviewStatus:'passed',reviewRound:2}),['done','done','done','done','done','done','current']);
 assert.deepEqual(states({phase:'image',reviewStatus:'passed',reviewRound:1}),['done','done','done','done','skipped','skipped','current']);
 assert.deepEqual(states({phase:'image',reviewStatus:null}),['done','done','done','unavailable','unavailable','unavailable','current']);
 assert.equal(states({phase:'review',activeState:'paused'})[3],'paused');
 assert.equal(states({phase:'repair',reviewStatus:'repair',activeState:'failed'})[4],'failed');
 const blocked=productionSteps({...base,phase:'review',reviewStatus:'blocked',reviewRound:2,repairTotal:2,activeState:'failed'});
 assert.equal(blocked[5].state,'failed');assert.match(blocked[5].detail,/2 issues remain; drawing is blocked/);assert.equal(blocked[6].state,'pending');
 const replan=productionSteps({...base,phase:'review',reviewStatus:'blocked',reviewStopReason:'replan',reviewRound:1,repairTotal:1});
 assert.deepEqual(replan.map(s=>s.state),['done','done','done','failed','skipped','pending','pending']);
 assert.match(replan[4].detail,/local repairs did not run/);assert.match(replan[6].detail,/Waiting for replanning/);
 const criteria=productionSteps({...base,phase:'review',reviewStatus:'blocked',reviewStopReason:'requirements',reviewRound:1,repairTotal:0});
 assert.deepEqual(criteria.map(s=>s.state),['done','done','done','failed','skipped','pending','pending']);assert.match(criteria[3].detail,/Acceptance criteria conflict or cannot be judged/);assert.match(criteria[4].detail,/[Nn]o automatic repairs/);assert.doesNotMatch(criteria[5].detail,/0 项待修订/);
 assert.equal(states({phase:'image',reviewStatus:'blocked',ready:45})[6],'pending');
 assert.equal(states({phase:'image',reviewStatus:'passed',reviewRound:2,ready:45})[6],'done');
});
test('acceptance blockers mark the audit that produced them without erasing completed repairs',()=>{
 const blocked={...base,phase:'review',reviewStatus:'blocked',reviewStopReason:'requirements',repairTotal:0};
 const initial=productionSteps({...blocked,reviewRound:5,reviewAudits:1,repairPasses:2});
 assert.equal(initial[3].state,'failed');assert.equal(initial[4].state,'done');assert.equal(initial[5].state,'pending');
 const recheck=productionSteps({...blocked,reviewRound:2,reviewAudits:2,repairPasses:1,repairBatches:1});
 assert.deepEqual(recheck.slice(3).map(s=>s.state),['done','done','failed','pending']);assert.match(recheck[4].detail,/Completed 1 repair batches/);assert.match(recheck[5].detail,/Acceptance criteria conflict or cannot be judged/);
 const noRepair=productionSteps({...blocked,reviewRound:2,reviewAudits:2,repairPasses:0});assert.equal(noRepair[4].state,'skipped');assert.match(noRepair[4].detail,/[Nn]o automatic repairs/);
});
test('native/preview SQL and reader show the same saved stages without exporting private content',()=>{
 const directory=mkdtempSync(path.join(tmpdir(),'shiqu-stages-'));
 try{
  const database=new DatabaseSync(path.join(directory,'shiqu.sqlite'));
  migrate(database,process.cwd(),directory);
  const original={title:'原文',text:'private-original',url:'https://example.org',englishSource:{title:'Source',text:'private-original'}},plan={title:'测试故事',pages:Array.from({length:45},()=>({caption:'测试',prompt:'private-image-prompt'}))};
  const selection={bookId:'liaozhai',storyTitle:'测试故事',theme:'人情冷暖',artStyle:'ink-pencil',length:45,narrativeDetail:'balanced',voice:false,productionPrompt:'private-production-prompt'};
  const review=(status,round,extra={})=>({status,round,repairs:round?1:0,issues:[],repaired:[],reports:[],...extra});
  const fixtures=[
   {name:'source',doc:{storyboard:{outline:{beats:Array(45).fill('beat')},pages:[]},frameCountConfirmed:true}},
   {name:'count',doc:{original,frameRecommendation:{count:45}}},
   {name:'batches',doc:{original,frameCountConfirmed:true,storyboard:{outline:{beats:Array(45).fill('beat')},pages:Array(20).fill({})}}},
   {name:'review',doc:{original,plan,visualReview:review('pending',0)}},
   {name:'auto-count-initial',selection:{...selection,length:'auto'},doc:{original,plan,visualReview:review('pending',0)}},
   {name:'auto-count-keep',selection:{...selection,length:'auto'},doc:{original,plan,visualReview:review('pending',0,{phase:'full',repairs:0})}},
   {name:'count-structure-recheck',selection:{...selection,length:'auto'},doc:{original,plan,visualReview:review('pending',0,{phase:'frames',repairs:1})}},
   {name:'count-structure-passed',selection:{...selection,length:'auto'},doc:{original,plan,visualReview:review('passed',1,{phase:'full',repairs:1})}},
   {name:'repair',doc:{original,plan,visualReview:review('repair',1,{issues:[{page:2},{page:21}],repaired:[2]})}},
   {name:'recheck',doc:{original,plan,visualReview:review('pending',1,{issues:[{page:2}],repaired:[2]})}},
   {name:'blocked',state:'failed',doc:{original,plan,visualReview:review('blocked',2,{issues:[{page:2}]})}},
   {name:'replan',state:'failed',doc:{original,plan,visualReview:review('blocked',1,{stopReason:'replan',issues:[{page:45,requiresReplan:true}]})}},
   {name:'requirements',state:'failed',doc:{original,plan,visualReview:review('blocked',1,{stopReason:'requirements'})}},
   {name:'requirements-recheck',state:'failed',doc:{original,plan,visualReview:review('blocked',2,{stopReason:'requirements',reports:[{},{}],history:[{}]})}},
   {name:'first-pass',doc:{original,plan,visualReview:review('passed',1)}},
   {name:'rechecked-pass',doc:{original,plan,visualReview:review('passed',2)}},
   {name:'legacy',doc:{original,plan}},
  ];
  const insert=database.prepare('INSERT INTO stories(id,user_id,selection,document,state,page,saved,created_at,updated_at) VALUES(?,?,?,?,?,0,0,?,?)');
  for(const f of fixtures)insert.run(f.name,'owner',JSON.stringify(f.selection||selection),JSON.stringify({plan:null,images:[],audio:[],usage:[],...f.doc}),f.state||'running','2026-10-29','2026-10-29');
  const before=readFileSync(path.join(directory,'shiqu.sqlite'));
  const summary=readLibrarySummary(directory);
  for(const item of summary.stories){
   const row=database.prepare('SELECT * FROM stories WHERE id=?').get(item.id);
   const reader=generationProgress(view(row),0).steps;
   const desktop=productionSteps({...item.production,total:item.total||null,ready:item.ready,activeState:item.state==='failed'?'failed':'current'});
   assert.deepEqual(desktop.map(s=>[s.id,s.state]),reader.map(s=>[s.id,s.state]),item.id);
  }
  assert.match(JSON.stringify(summary.stories.find(s=>s.id==='batches').production),/20/);
  const countRepaired=summary.stories.find(s=>s.id==='count-structure-passed');
  const countStages=productionSteps({...countRepaired.production,total:45,ready:0});
  assert.equal(countStages.find(s=>s.id==='repair').state,'done');assert.equal(countStages.find(s=>s.id==='recheck').state,'done');assert.doesNotMatch(countStages.find(s=>s.id==='repair').detail,/repairs unnecessary/);
  assert.doesNotMatch(JSON.stringify(summary),/private-original|private-image-prompt|private-production-prompt/);
  assert.deepEqual(readFileSync(path.join(directory,'shiqu.sqlite')),before);
  database.close();
 }finally{rmSync(directory,{recursive:true,force:true});}
});

test('desktop source readiness matches complete English translations without writing or generating',()=>{
 const directory=mkdtempSync(path.join(tmpdir(),'shiqu-english-stages-'));
 try{
  const database=new DatabaseSync(path.join(directory,'shiqu.sqlite'));migrate(database,process.cwd(),directory);
  const selection={bookId:'zhuangzi',theme:'原典故事',artStyle:'ink-pencil',length:3,narrativeDetail:'balanced',voice:false,productionPrompt:''};
  const source={title:'原文',text:'人物救助乌龟。',url:'https://example.org/source',provider:'fixture',kind:'passage',retrievedAt:'2026-11-05'};
  const chapterContext={title:'章节',text:'完整章节原文。',source:{edition:'a'.repeat(64),sectionId:'s1',firstUnit:'u1',lastUnit:'u2'}};
  const cases=[
   ['untranslated',source,false],
   ['translated',{...source,englishSource:{title:'A rescue',text:'A fisherman rescues a turtle.'}},true],
   ['partial-chapter',{...source,chapterContext,englishSource:{title:'A rescue',text:'A fisherman rescues a turtle.'}},false],
   ['complete-chapter',{...source,chapterContext,englishSource:{title:'A rescue',text:'A fisherman rescues a turtle.',chapterTitle:'Chapter one',chapterText:'The complete translated chapter.'}},true],
   ['already-english',{...source,title:'A rescue',text:'A fisherman rescues a turtle.'},true],
   ['han-number',{...source,title:'Source',text:'\u3007'},false],
   ['han-extension',{...source,title:'Source',text:'\u{20000}'},false],
   ['invalid-translation',{...source,englishSource:{title:'Rescue',text:'仍有中文'}},false],
  ];
  const insert=database.prepare("INSERT INTO stories(id,user_id,selection,document,state,page,saved,created_at,updated_at) VALUES(?,?,?,?,'idle',0,0,'2026-11-05','2026-11-05')");
  for(const [id,original] of cases)insert.run(id,'owner',JSON.stringify(selection),JSON.stringify({plan:null,original,images:[],audio:[],usage:[]}));
  const before=readFileSync(path.join(directory,'shiqu.sqlite')),summary=readLibrarySummary(directory);
  for(const [id,,expected] of cases){
   const actual=summary.stories.find(story=>story.id===id).production.sourceReady;
   assert.equal(actual,expected,id);assert.equal(actual,view(database.prepare('SELECT * FROM stories WHERE id=?').get(id)).generationProgress.sourceReady,id+' matches reader');
  }
  assert.deepEqual(readFileSync(path.join(directory,'shiqu.sqlite')),before,'Reading readiness does not change the library');database.close();
 }finally{rmSync(directory,{recursive:true,force:true});}
});
