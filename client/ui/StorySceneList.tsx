// English interface: labels, accessibility text, and workflow messages use English.
// Select a saved scene while preserving the reader's normal navigation and progress handling.
import type {Story} from '@/lib/content';

export default function StorySceneList({story,page,onSelect}:{story:Story;page:number;onSelect:(page:number)=>void}) {
 return <ol className="yu-scene-list" aria-label="Scene list">
  {story.pages.map((scene,index)=><li key={index}>
   <button type="button" onClick={()=>onSelect(index)} aria-label={`Go to page ${index+1}`} aria-current={index===page?'location':undefined}>
    {scene.image?<img src={scene.image} alt="" loading="lazy"/>:<span className="yu-scene-list-pending">Not drawn yet</span>}
    <span className="yu-scene-list-copy"><strong className="yu-scene-list-heading">Page {index+1}{index===page&&<span>Reading</span>}</strong><span className="yu-scene-list-caption">{scene.caption||"The caption for this page has not been saved."}</span></span>
   </button>
  </li>)}
 </ol>;
}
