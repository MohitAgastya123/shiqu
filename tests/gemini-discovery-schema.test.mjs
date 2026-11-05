// Exercise the production Gemini adapter's grammar limits and unchanged local receipt validation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createReaderProvider} from '../server/generation.ts';
import {localCatalogJson,localScanJson,localChoicesJson} from '../lib/reader-local-contract.ts';

const selection={bookId:'西游记',theme:'原典故事',length:'auto',artStyle:'ink-pencil',voice:false};
const range={sectionId:'xiyou-001',firstUnit:'xiyou-001-001',lastUnit:'xiyou-001-002'};
const story={title:'石猴出世',description:'石猴寻到水帘洞。',source:{...range,continuations:[]}};
const receipt=()=>({stories:[structuredClone(story)],note:'',scan:{blockComplete:false,pendingEvents:[],resolvedEventIds:[]}});
const input=(purpose='catalog',maxStories=1)=>({title:'西游记',edition:'a'.repeat(64),text:'[xiyou-001-001]\n石猴出世。\n[xiyou-001-002]\n石猴寻到水帘洞。',purpose,scan:{maxStories,excludedSources:[],pendingEvents:[],contextText:''}});
const response=value=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}]});
const provider=transport=>createReaderProvider({SHIQU_AI_PROVIDER:'gemini',GEMINI_API_KEY:'controlled'}, {},transport);

test('Gemini catalog and legacy scan avoid counted story and continuation grammars without changing shared contracts',async()=>{
 const shared=JSON.stringify([localCatalogJson,localScanJson,localChoicesJson]);
 const schemas=[];
 const p=provider(async(_url,init)=>{
  const body=JSON.parse(init.body),schema=body.generationConfig.responseFormat.text.schema;
  schemas.push(schema);
  // The live Gemini API rejects this nested counted-array grammar with INVALID_ARGUMENT.
  const sources=[schema.properties.stories.items.properties.source,schema.properties.scan.properties.pendingEvents.items.properties.source];
  for(const source of sources){
   const array=source.properties.continuations;
   assert.equal(array.maxItems,undefined);
   assert.match(array.description,/23/);
   assert.deepEqual(array.items.required,['sectionId','firstUnit','lastUnit']);
   assert.equal(array.items.additionalProperties,false);
  }
  assert.equal(schema.properties.scan.properties.pendingEvents.maxItems,undefined);
  assert.match(schema.properties.scan.properties.pendingEvents.description,/At most 16 items/);
  assert.equal(body.store,false);
  return response(receipt());
 });
 for(const count of [1,32])assert.equal((await p.suggestions(selection,[],input('catalog',count))).stories.length,1);
 assert.equal((await p.suggestions(selection,[],input('scan',5))).stories.length,1);
 assert.deepEqual(schemas.map(schema=>schema.properties.stories.maxItems),[undefined,undefined,undefined]);
 assert.deepEqual(schemas.map(schema=>schema.properties.stories.description),['At most 1 items.','At most 32 items.','At most 5 items.']);
 assert.equal(JSON.stringify([localCatalogJson,localScanJson,localChoicesJson]),shared);
});

test('Gemini catalog still rejects excessive story counts and invalid source continuations locally',async()=>{
 let result=receipt();
 const p=provider(async()=>response(result));
 result.stories.push(structuredClone(story));
 await assert.rejects(p.suggestions(selection,[],input()),error=>error.name==='ZodError');

 result=receipt();result.stories[0].source.continuations=Array.from({length:24},()=>({...range}));
 const invalidStory=await p.suggestions(selection,[],input());
 assert.equal(invalidStory.stories.length,0);assert.equal(invalidStory.scan.invalidStories,true);

 result=receipt();result.scan.pendingEvents=[{id:'pending',title:'未完事件',source:{...range,continuations:Array.from({length:24},()=>({...range}))}}];
 const invalidPending=await p.suggestions(selection,[],input());
 assert.equal(invalidPending.stories.length,1);assert.equal(invalidPending.scan.invalid,true);assert.equal(invalidPending.scan.blockComplete,false);
 assert.deepEqual(invalidPending.scan.pendingEvents,[]);
});
