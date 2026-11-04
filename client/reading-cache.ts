// Retire local story payloads only with a complete owner inventory, including hidden revisions/trash.
import type {DeletedStory} from './ui/DeletedStories.tsx';
type Progress={storyId:string;page:number;saved?:number;updatedAt?:string|null};
export type LibraryInventory={deletions:DeletedStory[];currentStoryIds:string[];complete:true};
export async function pruneReadingCaches(value:unknown,storage:Storage,offline?:CacheStorage){
 const data=value as LibraryInventory;
 if(!data||data.complete!==true||!Array.isArray(data.currentStoryIds)||!data.currentStoryIds.every(id=>typeof id==='string'&&id.length>0)||!Array.isArray(data.deletions)||!data.deletions.every(item=>item&&typeof item.storyId==='string'&&typeof item.deletedAt==='string'&&typeof item.title==='string'&&typeof item.kind==='string'))throw Error('Incomplete library inventory');
 const ids=new Set(data.currentStoryIds);
 let progress:Progress[]=[],lastReadId='';
 try{
  const saved=JSON.parse(storage.getItem('yiyu-reading')||'[]');
  if(Array.isArray(saved))progress=saved.filter(row=>row&&ids.has(row.storyId));
  lastReadId=storage.getItem('shiqu-last-read')||progress[0]?.storyId||'';
  if(!ids.has(lastReadId))lastReadId='';
  storage.setItem('yiyu-reading',JSON.stringify(progress));
  if(lastReadId)storage.setItem('shiqu-last-read',lastReadId);else storage.removeItem('shiqu-last-read');
 }catch{/* Storage restrictions must not make a valid online library unusable. */}
 if(offline)try{
  const cache=await offline.open('yiyu-offline-v1');
  for(const key of await cache.keys()){
   const pathname=new URL(key.url).pathname,match=pathname.match(/^\/offline-data\/([^/]+)$/);
   if(match&&!ids.has(decodeURIComponent(match[1])))await cache.delete(key);
  }
 }catch{/* Offline storage may be unavailable. Never clear shared media caches. */}
 return {deletions:data.deletions,progress,lastReadId,ids};
}
