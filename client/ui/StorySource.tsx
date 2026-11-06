// English interface: labels, accessibility text, and workflow messages use English.
'use client';
// Display saved full chapter context when available, retaining historical passage-only originals.
import {useEffect,useState} from 'react';
import {ArrowRight,BookOpen,Loader2,RefreshCw} from 'lucide-react';
import type {Story} from '@/lib/content';
import type {GeneratedStory} from '@/lib/reader-model';
import type {SourceResult} from '@/lib/reader-source-types';
import {request} from './shared';

type Props=({story:Story;sessionId?:never}|{story?:never;sessionId:string})&{book:string};
export default function StorySource({story,sessionId,book}:Props){
 const generated=!story||'generated'in story&&story.generated===true,id=story?.id||sessionId,sourceText=story?.sourceText||'';
 const [result,setResult]=useState<SourceResult|null>(null),[loading,setLoading]=useState(generated&&!sourceText),[error,setError]=useState(''),[saving,setSaving]=useState(false);
 useEffect(()=>{
  if(!generated||sourceText)return;
  let cancelled=false;setLoading(true);setError('');setResult(null);
  request('reader/sessions/'+id+'/source').then((data:SourceResult)=>{if(!cancelled)setResult(data);}).catch(()=>{if(!cancelled)setError("Could not load the source text. Try again.");}).finally(()=>{if(!cancelled)setLoading(false);});
  return()=>{cancelled=true;};
 },[id,generated,sourceText]);
 async function saveOriginal(){
  setLoading(true);setSaving(true);setError('');
  try{setResult(await request('reader/sessions/'+id+'/source','POST'));}
  catch(e){setError(e instanceof Error?e.message:story?"Could not save the source text. Try again.":"Could not load the source text. Try again.");}
  finally{setLoading(false);setSaving(false);}
 }
 const original=(story&&generated?(story as GeneratedStory).original:undefined)||result?.source;
 const text=original?.chapterContext?.text||sourceText||original?.text||'';
 const reference=story&&generated?(story as GeneratedStory).sourceReference:'';
 const adaptation=(story?.adaptationNote||"After confirmation, adaptation uses the saved source text.").replace("; device narration is currently available.",'.');
 return <><div className="yu-source-heading"><BookOpen size={24}/><div><h3>{original?.chapterContext?.title||original?.title||book||"Story source"}</h3><p>{original?.chapterContext?"Complete source chapter · Scroll to read":original?.kind==='chapter'?"Source chapter excerpt · Scroll to read":text?"Source excerpt":"Source text"}</p></div></div>
 {loading?<div className="yu-source-status" role="status"><Loader2 size={19} className="spin"/>{saving&&story?"Saving source text…":"Loading saved source text…"}</div>:text?<p className="yu-original">{text}</p>:<div className="yu-source-status" role="status"><p>{error||result?.message||"No verifiable source text has been found for this story yet."}</p><button onClick={saveOriginal}><RefreshCw size={15}/>{story?"Translate source":"Translate source"}</button></div>}
 {(story?.sourceUrl||original?.url)&&<a className="yu-source-link" href={story?.sourceUrl||original?.url} target="_blank" rel="noreferrer">View original source{original?.provider?' · '+original.provider:''}<ArrowRight size={16}/></a>}
 {original&&<p className="yu-source-reference">{original.localSource?"Local chapter scope verified. Source text is saved with the story.":"Source text is saved with the story for later reading."}</p>}
 {!loading&&!text&&result?.searchUrl&&<a className="yu-source-link" href={result.searchUrl} target="_blank" rel="noreferrer">Find original source<ArrowRight size={16}/></a>}
 {reference&&!text&&<p className="yu-source-reference">Source reference: {reference}</p>}
 {original?.kind==='chapter'&&<p className="yu-source-reference">This excerpt may contain other stories from the same chapter. See the original source for the complete text.</p>}
 <h3 className="yu-adaptation-heading">About this adaptation</h3><p className="yu-adaptation">{original?adaptation.replace("; source references were supplied by the model and have not been verified individually.","; source excerpts and adaptations are saved separately."):adaptation}</p></>;
}
