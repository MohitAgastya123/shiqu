// English discovery reuses exact complete reasons through cold/warm caches, browser parsing and saved intake.
// Legacy cache upgrades preserve original evidence and old candidates may omit match reasons.
import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {libraryFixture} from './fixtures/story-library.mjs';
import {previousDiscoveryNamespace,previousReadingPlanKey} from '../server/story-discovery-legacy.ts';
import {legacyThemeDecisionKey,legacyThemeStoryId} from '../server/story-theme-matching.ts';
import {themeMatchContract,themeDecisionSchema} from '../lib/reader-theme-match.ts';
import {suggestionBatchSchema} from '../lib/reader-suggestions.ts';
import {requestSuggestions} from '../lib/reader-suggestion-request.ts';
import {withLocalBooks} from '../server/local-generation.ts';
import {productionFixture,until} from './fixtures/production.mjs';

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


test('suggestion reasons retain the matching 480-character bound and legacy optional fields',()=>{
 const story={title:'The Choice at the River',description:'A difficult decision from the original source.'};
 const reason='The source shows courage and growth. '+('Careful action protects another person. '.repeat(12)).slice(0,442)+'.';assert.equal(reason.length,480);
 const decision={id:'a'.repeat(64),verdict:'yes',reason};assert.equal(themeDecisionSchema.safeParse(decision).success,true);
 const result=suggestionBatchSchema.parse({stories:[{...story,matchReason:reason}],note:''});assert.equal(result.stories[0].matchReason,reason);
 assert.equal(suggestionBatchSchema.safeParse({stories:[{...story,matchReason:reason+'!'}],note:''}).success,false);assert.equal(themeDecisionSchema.safeParse({...decision,reason:reason+'!'}).success,false);
 assert.deepEqual(suggestionBatchSchema.parse({stories:[story],note:''}),{stories:[story],note:''});
});

test('cold/warm production discovery, browser parsing and intake retain a complete 480-character match reason',async t=>{
 const f=await productionFixture(t),library=libraryFixture();englishInference(library);
 const reason='The source shows courage and growth. '+('Careful action protects another person. '.repeat(12)).slice(0,442)+'.';assert.equal(reason.length,480);
 library.provider.matchStories=async(_theme,entries)=>{library.calls.matches.push(entries);return {matches:entries.map(story=>({id:story.id,verdict:'yes',reason}))};};
 f.generation.suggestions=(...args)=>library.provider.suggestions(...args);f.generation.matchStories=(...args)=>library.provider.matchStories(...args);
 f.options.generation=withLocalBooks(f.generation,library.books,f.media);await f.restart();f.app.services.localBooks=library.books;
 const selection={bookId:'zhuangzi',theme:'Courage and growth',artStyle:'ink-pencil',length:'auto',voice:false,productionPrompt:'',narrativeDetail:'balanced'},progress=[];
 const request=()=>requestSuggestions(selection,new AbortController().signal,value=>progress.push(value),(url,options)=>f.app.handle(new Request('http://localhost'+url,options)));
 const cold=await request();assert.equal(cold.stories.length,1);assert.equal(cold.stories[0].matchReason,reason);assert.deepEqual(cold.stories[0].source,library.stories[0].source);assert.ok(cold.stories[0].sourceLabel);assert.ok(progress.length>0);
 const paid={extraction:library.calls.catalog.length,matching:library.calls.matches.length};assert.ok(paid.extraction>0);assert.ok(paid.matching>0);
 const warm=await request();assert.deepEqual(warm.stories,cold.stories);assert.equal(library.calls.catalog.length,paid.extraction);assert.equal(library.calls.matches.length,paid.matching);
 const saved=await f.json('sessions','POST',{requestId:crypto.randomUUID(),intake:true,selection});await f.startDiscovery(saved.id);await f.demand(saved.id);
 await until(async()=>{const current=await f.read(saved.id);return current.intake.phase==='choosing'&&current.intake.search.state==='idle'&&current.intake.batches.length===1;});
 const current=await f.read(saved.id),candidate=current.intake.batches[0].stories[0];assert.equal(candidate.matchReason,reason);assert.deepEqual(candidate.source,cold.stories[0].source);assert.equal(current.intake.search.error,null);
 assert.equal(library.calls.catalog.length,paid.extraction);assert.equal(library.calls.matches.length,paid.matching);assert.equal(f.control.plans.length,0);assert.equal(f.control.calls.length,0);
});
