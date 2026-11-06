// English interface: labels, accessibility text, and workflow messages use English.
// Present owner-scoped deletion records; restoration preserves saved checkpoints and never opens a story.
import {RotateCcw,Trash2} from 'lucide-react';

export type DeletedStory={storyId:string;title:string;deletedAt:string;kind:'generated'};
type Props={items:DeletedStory[];loading:boolean;error:string;busy:string;onRestore:(item:DeletedStory)=>void;onRetry:()=>void};
export default function DeletedStories({items,loading,error,busy,onRestore,onRetry}:Props){
 return <div className="yu-deleted-stories">
  <p>Story files and reading progress are kept. Restoring returns the story to your shelf without starting generation.</p>
  {error&&<div className="yu-recovery-error" role="alert">{error}<button type="button" disabled={loading||!!busy} onClick={onRetry}>Reload</button></div>}
  {loading?<p role="status">Loading deleted stories…</p>:items.length?<ul>{items.map(item=><li key={item.storyId}><div><strong>{item.title}</strong><small>Deleted {new Date(item.deletedAt).toLocaleDateString('en-US')}</small></div><button type="button" aria-label={"Restore “"+item.title+'”'} disabled={!!busy} onClick={()=>onRestore(item)}><RotateCcw size={17}/>{busy===item.storyId?"Restoring…":"Restore"}</button></li>)}</ul>:!error&&<div className="yu-deleted-empty"><Trash2 size={28}/><h3>No deleted stories</h3><p>Stories you delete from your shelf can be restored here.</p></div>}
 </div>;
}
