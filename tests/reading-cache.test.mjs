// Cache deletion depends on the complete owner inventory, never the visible shelf response.
import test from 'node:test';
import assert from 'node:assert/strict';
import {pruneReadingCaches} from '../client/reading-cache.ts';
function fixture(){
 const map=new Map([['yiyu-reading',JSON.stringify(['current','history','trash','reselection','demo','foreign'].map(storyId=>({storyId,page:2,saved:1})))],['shiqu-last-read','demo']]);
 const storage={getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};
 const paths=new Set(['/offline-data/current','/offline-data/history','/offline-data/trash','/offline-data/reselection','/offline-data/demo','/offline-data/foreign','/api/media/shared.png']);
 const offline={open:async()=>({keys:async()=>[...paths].map(p=>new Request('http://shiqu.local'+p)),delete:async key=>paths.delete(new URL(key.url).pathname)})};
 return {map,storage,paths,offline};
}
test('valid inventory keeps every current revision/trash payload and shared media, removes retired/foreign payloads',async()=>{
 const f=fixture(),currentStoryIds=['current','history','trash','reselection'];
 const result=await pruneReadingCaches({complete:true,currentStoryIds,deletions:[]},f.storage,f.offline);
 assert.deepEqual(result.progress.map(row=>row.storyId),currentStoryIds);assert.equal(f.map.has('shiqu-last-read'),false);
 assert.deepEqual([...f.paths],currentStoryIds.map(id=>'/offline-data/'+id).concat('/api/media/shared.png'));
});
for(const inventory of [null,[],{currentStoryIds:[],deletions:[]},{complete:false,currentStoryIds:[],deletions:[]},{complete:true,currentStoryIds:[3],deletions:[]}])test('incomplete or invalid metadata never changes caches: '+JSON.stringify(inventory),async()=>{
 const f=fixture(),before=[...f.map],paths=[...f.paths];await assert.rejects(pruneReadingCaches(inventory,f.storage,f.offline));assert.deepEqual([...f.map],before);assert.deepEqual([...f.paths],paths);
});
test('a valid empty inventory clears retired payloads while keeping shared media',async()=>{
 const f=fixture();await pruneReadingCaches({complete:true,currentStoryIds:[],deletions:[]},f.storage,f.offline);assert.equal(f.map.get('yiyu-reading'),'[]');assert.deepEqual([...f.paths],['/api/media/shared.png']);
});
