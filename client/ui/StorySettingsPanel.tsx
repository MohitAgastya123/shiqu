// English interface: labels, accessibility text, and workflow messages use English.
// One story panel owns the title, downloads, credits and workflow for every entry point.
// Saved sessions can be named before a storyboard or artwork exists.
// Downloads and publication credits share one visibility rule: every saved frame must have an image.
import type {ReactNode} from 'react';
import type {Story} from '@/lib/content';
import type {SessionView} from '@/lib/reader-model';
import Sheet from './StorySheet';
import {StoryPublicationSummary} from './StoryPublication';
import StoryBackToShelf from './StoryBackToShelf';

type Props={story:Story|null;session?:SessionView|null;busy:boolean;disabled:boolean;onClose:()=>void;onBack:()=>void;onRename?:(id:string,title:string)=>void;downloads:ReactNode;exportStatus:string;exporting:boolean;onPublicationEdit?:()=>void;workflow?:ReactNode};
export default function StorySettingsPanel({story,session,busy,disabled,onClose,onBack,onRename,downloads,exportStatus,exporting,onPublicationEdit,workflow}:Props){
 const title=session?.selection.displayTitle||story?.title||session?.selection.storyTitle||"Awaiting story selection";
 const storyId=session?.id||story?.id;
 const canDownload=!!story?.pages.length&&story.pages.every(page=>!!page.image);
 return <Sheet title="Story settings" busy={busy} onClose={onClose}><fieldset className="yu-revision-fields" disabled={disabled}>
  <div className="yu-setting-row yu-story-name"><div><strong>Story title</strong><p>{title}</p></div><button type="button" className="yu-revision-open" disabled={!onRename||!storyId} onClick={()=>{if(onRename&&storyId)onRename(storyId,title);}}>Edit story title</button></div>
  {canDownload&&<div className="yu-pdf-setting"><div className="yu-settings-formats" aria-label="Download story">{downloads}</div><p className="yu-export-status" role="status">{exportStatus}</p>
   {story&&<StoryPublicationSummary story={story} onEdit={onPublicationEdit} disabled={exporting}/>}
  </div>}
  {workflow&&<section className="yu-settings-flow" aria-label="Production workflow">{workflow}</section>}
  <StoryBackToShelf onBack={onBack} disabled={busy} link/>
 </fieldset></Sheet>;
}
