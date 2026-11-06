// English interface: labels, accessibility text, and workflow messages use English.
// Keep discovery compact so available stories stay visible; disclose real reading scope on demand.
import {themeLabel} from '../english-labels';
import {readingChapterLabel} from '@/lib/reader-suggestions';
import {BookOpen,ChevronDown,Loader2} from 'lucide-react';
import type {SuggestionProgress} from '@/lib/reader-suggestions';

export function StoryReadingState({book,theme,progress,elapsed,onCancel,hasStories=false}:{book:string;theme:string;progress:SuggestionProgress|null;elapsed:number;onCancel:()=>void;hasStories?:boolean}){
 const chapters=progress?.currentChapters||[],checking=progress?.stage==='checking';
 const stage=checking?"Verifying story source":progress?.stage==='selecting'?"Organizing story candidates":progress?.stage==='reading'||chapters.length?"Reading source text":"Opening source text";
 return <section className="yu-reading-panel" aria-label="Find a story">
  <div className="yu-reading-panel-heading">
   <div className="yu-reading-book" aria-hidden="true"><BookOpen size={22}/></div>
   <div className="yu-reading-title"><h3>{hasStories?"Keep searching while you choose":"Finding a good story"}</h3><p>“{book}”<span> · {themeLabel(theme)}</span></p></div>
  </div>
  <div className="yu-reading-status"><span role="status"><Loader2 size={14} className="spin" aria-hidden="true"/>{stage}</span><span className="yu-reading-elapsed">Elapsed: {elapsed}  seconds</span></div>
  <details className="yu-reading-details">
   <summary><span>View reading progress</span>{!!progress?.completedChars&&<small>Read {progress.completedChars.toLocaleString('en-US')}  characters</small>}<ChevronDown size={14} aria-hidden="true"/></summary>
   <p className="yu-reading-scope">{chapters.length?"Reading: "+readingChapterLabel(chapters):progress?`Reading “${book}” source text.`:"Preparing source text. The current chapter will appear shortly."}</p>
   {checking&&<p className="yu-reading-scope">Verify the source scope and confirm the story is complete.</p>}
  </details>
  <div className="yu-reading-panel-footer"><small>{hasStories?"You can select a story already found.":"Stories appear here as they are found. Choose an art style afterward."}</small><button type="button" onClick={onCancel}>Stop searching</button></div>
 </section>;
}
