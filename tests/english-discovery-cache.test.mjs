// English cache upgrades reuse only English display metadata; verified source evidence stays intact.
import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {libraryFixture} from './fixtures/story-library.mjs';
import {previousDiscoveryNamespace,previousReadingPlanKey} from '../server/story-discovery-legacy.ts';
import {legacyThemeDecisionKey,legacyThemeStoryId} from '../server/story-theme-matching.ts';
import {themeMatchContract} from '../lib/reader-theme-match.ts';

const manifest=f=>({mode:'whole',blocks:[{ranges:f.book.sections.map(section=>({sectionId:section.id,firstUnit:section.units[0].id,lastUnit:section.units.at(-1).id})),tokens:100}]});
const state=f=>({stories:structuredClone(f.stories),cursor:1,readThrough:1,pendingEvents:[],exhausted:true,rejected:false});
function englishInference(f){
 f.stories.forEach((story,index)=>Object.assign(story,{title:`Complete story ${index+1}`,description:'A complete event from the verified original.'}));
 f.provider.matchStories=async(_theme,entries)=>{f.calls.matches.push(entries);return {matches:entries.map(story=>({id:story.id,verdict:'yes',reason:'The recorded actions support this theme.'}))};};
}

test('Chinese legacy catalog prose triggers explicit English discovery without altering its source or old cache',async()=>{
 const f=libraryFixture(),old=previousDiscoveryNamespace(f.book,'codex','mock',undefined,'medium'),saved=state(f),raw=f.book.input.text;
 await f.cache.write(previousReadingPlanKey(f.book,'codex')+'/blocks',manifest(f));await f.cache.write(old+'/library',saved);
 englishInference(f);const result=await f.run('Any theme');
 assert.ok(f.calls.catalog.length>0);assert.ok(result.stories.length);assert.doesNotMatch(result.stories.map(story=>story.title+' '+story.description+' '+story.matchReason).join(' '),/\p{Script=Han}/u);
 assert.equal(f.book.input.text,raw);assert.deepEqual(await f.cache.read(old+'/library',z.any()),saved);
});

test('Chinese legacy matching reasons are rejudged under the English contract while English catalog ranges remain reusable',async()=>{
 const f=libraryFixture();englishInference(f);const old=previousDiscoveryNamespace(f.book,'codex','mock',undefined,'medium'),theme='Any theme',saved=state(f);
 await f.cache.write(previousReadingPlanKey(f.book,'codex')+'/blocks',manifest(f));await f.cache.write(old+'/library',saved);
 const decisions=Object.fromEntries(f.stories.map(story=>[legacyThemeStoryId(story),{id:legacyThemeStoryId(story),verdict:'yes',reason:'原文支持这个主题。'}]));
 const key=legacyThemeDecisionKey(old,theme,{model:'mock-match',reasoningEffort:'low'});await f.cache.write(key,{decisions});
 const result=await f.run(theme);assert.equal(f.calls.catalog.length,0);assert.ok(f.calls.matches.length>0);assert.match(themeMatchContract,/en-v2/);
 assert.ok(result.stories.every(story=>story.matchReason==='The recorded actions support this theme.'));assert.deepEqual(await f.cache.read(key,z.any()),{decisions});
});
