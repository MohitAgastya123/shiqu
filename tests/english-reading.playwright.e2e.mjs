// Run English comics and saved English source through the production browser workflow with controlled models.
import test from 'node:test';
import assert from 'node:assert/strict';
import {storyBrowser} from './fixtures/story-browser.mjs';

test('English comic and saved source remain English across reading and reload',{timeout:180000},async t=>{
 const b=await storyBrowser(t,'ENGLISH001');
 await b.execute(async()=>{
  const {f,page,library}=b;
  Object.assign(library.stories[0],{title:'The Grateful Turtle',description:'A fisherman saves a turtle and later receives its help.',summary:'A fisherman returns a stranded turtle to the river. During a later flood, the turtle carries him safely to shore.'});
  Object.assign(library.stories[1],{title:'The Village Protector',description:'A brave traveler protects a village from a tiger.',summary:'A traveler confronts a tiger to protect the villagers and returns safely.'});
  const plan={title:'The Grateful Turtle',summary:library.stories[0].summary,sourceReference:'The selected source passage',adaptationNote:'An English adaptation from the verified source.',characters:'An adult fisherman wears a plain brown robe beside a river. A large river turtle has a dark green shell.',pages:[
   {caption:'A fisherman finds a turtle stranded beside the river.',prompt:'An adult fisherman kneels beside a stranded dark green turtle on a dry riverbank.'},
   {caption:'He gently carries the turtle back into the water.',prompt:'The fisherman in a brown robe lowers the green turtle into the shallow river.'},
   {caption:'When a flood sweeps him away, the turtle carries him to safety.',prompt:'The green turtle carries the fisherman on its shell toward a safe riverbank during a flood.'},
  ]};
  f.control.beforeText=async(kind,payload)=>{
   if(kind==='recommend')return {reason:'Three pages preserve the rescue and its later consequence.',storySummary:plan.summary,storyMatchReason:'The source describes two acts of help.',requirements:{productionPrompt:'Keep the two rescues and their cause and consequence clear.',acceptancePrompt:'Both rescues appear in the storyboard.\nThe ending preserves the fisherman reaching safety.'}};
   if(kind==='outline'){const {pages,...metadata}=plan;return {...metadata,beats:pages.map(p=>p.caption)};}
   if(kind==='batch')return {pages:plan.pages.slice(payload.batch.first-1,payload.batch.last)};
   if(kind==='plan')return plan;
   if(kind==='reflection')return {title:plan.title,candidates:['Kindness may return in an unexpected form.','A small rescue can become a lasting bond.','Help given freely can change another life.']};
   if(kind==='review')return {issues:[],titleReview:{title:plan.title,reason:'The title identifies the central event.'},reflectionChoice:{index:1,reason:'The ending reflects the two rescues.'},...(payload.acceptanceCriteria?.length?{acceptanceResults:payload.acceptanceCriteria.map((_,i)=>({criterion:i+1,status:'passed',pages:[1,2,3],evidence:'The storyboard shows both rescues.'}))}:{})};
  };
  const prepared=await b.create({title:'The Grateful Turtle',theme:'Gratitude'});
  await b.confirm();await b.completed(prepared.id);await b.reader(prepared.id);
  assert.match(await page.locator('.yu-scene-caption').innerText(),/A fisherman finds a turtle/);
  assert.doesNotMatch(await page.locator('body').innerText(),/[\p{Script=Han}]/u);
  await b.screenshot('english-comic');
  await page.getByRole('button',{name:'Source',exact:true}).click();
  const source=page.getByRole('dialog',{name:'Story source',exact:true});
  await source.locator('.yu-original').waitFor();
  assert.match(await source.innerText(),/A fisherman returns a stranded turtle to the water/);
  assert.doesNotMatch(await source.innerText(),/[\p{Script=Han}]/u);
  await b.screenshot('english-source');
  const reads=f.control.recommendations.length;
  await page.reload();await page.getByRole('button',{name:'Source',exact:true}).click();
  await page.getByRole('dialog',{name:'Story source',exact:true}).locator('.yu-original').waitFor();
  assert.equal(f.control.recommendations.length,reads,'Reloading the saved source never calls generation');
 });
});
