// English interface: labels, accessibility text, and workflow messages use English.
// Select a saved scene while preserving the reader's normal navigation and progress handling.
// Dialogue-only and silent comic panels remain valid when narration is intentionally empty.
// Source panel numbers stay stable while the reader groups them into comic pages.
import type {Story} from '@/lib/content';
import type {ComicPage} from '@/lib/comic-page-layout';

export default function StorySceneList({story,page,onSelect,comicPages=[]}:{story:Story;page:number;onSelect:(page:number)=>void;comicPages?:ComicPage[]}) {
 return <ol className="yu-scene-list" aria-label="Scene list">
  {story.pages.map((scene,index)=><li key={index}>
   <button type="button" onClick={()=>onSelect(index)} aria-label={`Go to panel ${index+1}`} aria-current={index===page?'location':undefined}>
    {scene.image?<img src={scene.image} alt="" loading="lazy"/>:<span className="yu-scene-list-pending">Not drawn yet</span>}
    <span className="yu-scene-list-copy"><strong className="yu-scene-list-heading">Panel {index+1}{index===page&&<span>Reading</span>}</strong>{!!comicPages.length&&<small>Comic page {comicPages.findIndex(sheet=>sheet.panels.some(panel=>panel.frameIndex===index))+1}</small>}<span className="yu-scene-list-caption">{scene.caption||scene.bubbles?.map(b=>`${b.speaker} ${b.kind==='thought'?'thinks':'says'}: ${b.text}`).join(' ')||'A silent scene.'}</span></span>
   </button>
  </li>)}
 </ol>;
}
