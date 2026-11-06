// Isolated fixtures verify the real production flow while adapter contracts remain fast to run separately.
import test from 'node:test';

import assert from 'node:assert/strict';

import {executeHeadless} from '../server/headless-cli.ts';

import {withLocalBooks} from '../server/local-generation.ts';

import {productionFixture,selection} from './fixtures/production.mjs';

import {libraryFixture} from './fixtures/story-library.mjs';

test('Claude uses public production CLI, scene batches, count review and targeted repairs and stops before images',{timeout:30000},async t=>{
 const f=await productionFixture(t,'claude');await f.stop();const library=libraryFixture();f.control.autoLength=21;
 f.control.beforeText=async kind=>kind==='recommend'?{storySummary:library.stories[0].summary,storyMatchReason:'原文的行动和结果支持本篇故事。'}:kind==='review'&&f.control.reviews.length===1?{issues:[{page:2,category:'action',problem:'人物动作不清楚。',instruction:'明确人物接触物件的手势。'}]}:undefined;
 const context={generation:withLocalBooks(f.generation,library.books,f.media),localBooks:library.books,variables:{}};
 const call=(args,input={})=>executeHeadless(process.cwd(),[...args,'--data-dir',f.dataDirectory],{...context,input});
 const created=await call(['stories','create'],{requestId:crypto.randomUUID(),intake:false,selection:{...selection,length:'auto',narrativeDetail:'balanced',theme:'原典故事',storyTitle:library.stories[0].title,source:library.stories[0].source}});
 const result=await call(['run',created.session.id,'--until','reviewed','--timeout','15']);assert.equal(result.reason,'reviewed',JSON.stringify(result.session));
 assert.equal(result.session.generationProgress.reviewStatus,'passed');assert.equal(result.session.generationProgress.reviewOverridden,false);assert.equal(result.session.story.pages.length,21);assert.equal(result.session.ready,0);assert.ok(result.session.story.pages.every(page=>!page.image));
 assert.deepEqual(f.control.batches.map(p=>p.batch),[{first:1,last:20},{first:21,last:21}]);assert.ok(f.control.frameReviews.length);assert.equal(f.control.reviews.length,2);assert.equal(f.control.repairs.length,1);assert.equal(f.control.calls.length,0);
});
