// English interface: labels, accessibility text, and workflow messages use English.
// Reuse saved script content in both the inline disclosure and the reader's standard sheet.
// Preserve balloon attribution and reading order beside optional narration.
import type {Story} from '@/lib/content';

export default function StoryScript({story,standalone=false}:{story:Story;standalone?:boolean}) {
 const content=<div className="yu-script-content">
   <h3>{story.title}</h3>
   {story.summary&&<p className="yu-script-intro">{story.summary}</p>}
   {story.pages.length?story.pages.map((scene,index)=><section className="yu-script-scene" key={index} aria-label={`Page ${index+1} script`}>
    <h4>Page {index+1}</h4>
    {scene.caption&&<p>{scene.caption}</p>}
    {!!scene.bubbles?.length&&<ol aria-label="Comic dialogue">{scene.bubbles.map(b=><li key={b.id}><strong>{b.speaker} {b.kind==='thought'?'thinks':'says'}:</strong> {b.text}</li>)}</ol>}
    <details className="yu-script-prompt"><summary>Image prompt</summary><p>{scene.prompt||"No image prompt was saved for this page."}</p></details>
   </section>):<p>No storyboard script was saved for this story yet.</p>}
   {story.reflection&&<section className="yu-script-scene"><h4>Reflection</h4><p>{story.reflection}</p></section>}
   {story.adaptationNote&&<details className="yu-script-prompt"><summary>Adaptation notes</summary><p>{story.adaptationNote}</p></details>}
  </div>;
 return standalone?content:<details className="yu-story-script"><summary>View script <span>{story.pages.length}  storyboard pages</span></summary>{content}</details>;
}
