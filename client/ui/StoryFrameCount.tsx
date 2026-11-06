// English interface: labels, accessibility text, and workflow messages use English.
// Resume older count-confirmation checkpoints in automatic mode without asking readers to size a script.
import type {FrameRecommendation} from '@/lib/reader-frame-recommendation';
export default function StoryFrameCount({recommendation,disabled,onConfirm}:{recommendation:FrameRecommendation;disabled:boolean;onConfirm:(count:number|'auto')=>void}){
 return <section className="yu-frame-recommendation" aria-label="Storyboarding"><h3>Storyboard from the source text</h3><p className="yu-count-help">Initial estimate: {recommendation.count}  pages. Storyboarding and review determine the final count.</p><p className="yu-count-help">{recommendation.reason}</p><p className="yu-count-help">Review may add or remove pages. Images are generated once the script is stable.</p><button type="button" className="yu-primary" disabled={disabled} onClick={()=>onConfirm('auto')}>{disabled?"Starting…":"Continue storyboarding"}</button></section>;
}
