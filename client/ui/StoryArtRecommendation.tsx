// English interface: labels, accessibility text, and workflow messages use English.
// Explain the selected story's recommendation without overriding manual changes.
import {getArtStyle} from '@/lib/reader-styles';
import type {ArtStyleId} from '@/lib/reader-styles';
import type {ArtRecommendation} from '@/lib/reader-art-recommendation';

export function StoryArtRecommendation({recommendation,selected,onApply,disabled=false}:{recommendation:ArtRecommendation;selected:ArtStyleId;onApply:()=>void;disabled?:boolean}){
 const applied=selected===recommendation.artStyle;
 return <aside className="yu-style-recommendation" aria-label="Art style recommendation" role="status">
  <strong>Recommended: {getArtStyle(recommendation.artStyle).label}</strong>
  <p>{recommendation.reason}</p>
  <div><small>{applied?"Recommendation applied. You can also select another art style.":`Current choice: ${getArtStyle(selected).label}`}</small>{!applied&&<button type="button" disabled={disabled} onClick={onApply}>Use recommendation</button>}</div>
 </aside>;
}
