// English interface: labels, accessibility text, and workflow messages use English.
// Recheck live defaults for every output attempt before unsigned consent or cached-file reuse.
import {useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import type {Story} from '@/lib/content';
import {hasPublicationAuthor,publicationSchema,withPublicationDefaults} from '@/lib/story-publication';
import Sheet from './StorySheet';
import {request} from './shared';
import './story-publication.css';

export default function StoryExportControl({story,format,disabled,busy,className,onExport,onEdit,children}:{story:Story;format:'pdf'|'png'|'zip';disabled:boolean;busy:boolean;className:string;onExport:(story:Story)=>Promise<void>|void;onEdit?:()=>void;children:ReactNode}){
 const [confirming,setConfirming]=useState<Story|null>(null),[checking,setChecking]=useState(false),[error,setError]=useState('');
 const lock=useRef(false),live=useRef(true);
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 async function start(allowUnsigned=false){
  if(disabled||lock.current)return;
  lock.current=true;setChecking(true);setError('');
  try{
   const result=await request('reader/publication-defaults');
   if(!live.current)return;
   const defaults=result.publication===null?null:publicationSchema.parse(result.publication);
   const output=withPublicationDefaults(story,defaults);
   if(!allowUnsigned&&!hasPublicationAuthor(output.publication)){setConfirming(output);return;}
   setConfirming(null);await onExport(output);
  }catch(error){if(live.current)setError(error instanceof Error?error.message:"Could not verify the credits. Try again.");}
  finally{lock.current=false;if(live.current)setChecking(false);}
 }
 return <><button type="button" className={className} aria-busy={busy||checking} disabled={disabled||checking} onClick={()=>void start()}>{checking&&!busy?"Checking credits…":children}</button>{error&&!confirming&&<p className="yu-export-credit-error" role="alert">{error}</p>}{confirming&&<Sheet title="No creator credit set" busy={checking} onClose={()=>setConfirming(null)}><div className="yu-export-confirmation"><p className="yu-publication-work">{confirming.title}</p><p>No creator credit is set for this export. {format.toUpperCase()}  will show “Created by: Uncredited”. Add a credit first or continue.</p>{error&&<p role="alert">{error}</p>}<div className="yu-export-confirmation-actions">
  {onEdit&&<button type="button" className="yu-primary" disabled={disabled||checking} onClick={()=>{setConfirming(null);onEdit();}}>Add creator credit</button>}
  <button type="button" className="yu-export-unsigned" disabled={disabled||checking} onClick={()=>void start(true)}>{checking?"Checking credits…":"Export without credit "+format.toUpperCase()}</button>
  <button type="button" className="yu-revision-open" disabled={checking} onClick={()=>setConfirming(null)}>Cancel</button>
 </div></div></Sheet>}</>;
}
