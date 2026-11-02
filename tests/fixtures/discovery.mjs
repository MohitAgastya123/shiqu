// Citation-valid isolated discovery books, shared by service regressions and the local browser harness.
import {libraryFixture} from './story-library.mjs';
import {productionFixture} from './production.mjs';
import {withLocalBooks} from '../../server/local-generation.ts';
import {StoryDiscoveryCache} from '../../server/story-discovery-cache.ts';
import {discoveryCall} from '../../lib/reader-discovery-call.ts';
export function discoveryBook(count=16){
 const f=libraryFixture();f.stories.splice(0);f.book.sections[0].units.splice(0);
 for(let i=0;i<count;i++){const unit={id:'u'+i,text:'人物'+i+'面对危难，选择帮助乡人，经过行动终于平安归来，事情得到明确结果。',narrative:true};f.book.sections[0].units.push(unit);f.stories.push({title:'故事'+i,description:'一场有起因、行动和结果的完整事件。',source:{edition:f.book.edition,sectionId:'s1',firstUnit:unit.id,lastUnit:unit.id}});}
 f.book.input.text='篇章 s1：第一章\n'+f.book.sections[0].units.map(u=>'['+u.id+']\n'+u.text).join('\n\n');return f;
}
export async function discoveryService(t,count=16){
 const f=await productionFixture(t),library=discoveryBook(count),events=[];f.control.hold=false;library.control.model='controlled';library.control.matchModel='controlled-match';f.generation.status=library.provider.status;
 f.generation.suggestions=(selection,excluded,input,reading)=>discoveryCall({stage:'extraction',provider:'codex',model:'controlled',effort:'medium',requestedCount:input.scan.maxStories},reading,async report=>{const result=await library.provider.suggestions(selection,excluded,input,reading);report({acceptedCount:result.stories.length,usage:{inputTokens:10,outputTokens:5}});return result;});
 f.generation.matchStories=(theme,stories,context)=>discoveryCall({stage:'matching',provider:'codex',model:'controlled-match',effort:'low',requestedCount:stories.length}, {...context,onCall:event=>{events.push(event);context?.onCall?.(event);}},async report=>{const result=await library.provider.matchStories(theme,stories,context);report({acceptedCount:result.matches.length,usage:{inputTokens:10,outputTokens:5}});return result;});
 let cache;
 const restart=async()=>{cache=new StoryDiscoveryCache(f.media);f.options.generation=withLocalBooks(f.generation,library.books,f.media,cache);await f.restart();f.app.services.localBooks=library.books;};
 await restart();
 return {f,library,events,restart,get cache(){return cache;}};
}
