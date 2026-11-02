// Resume older count-confirmation checkpoints in automatic mode without asking readers to size a script.
import type {FrameRecommendation} from '@/lib/reader-frame-recommendation';
export default function StoryFrameCount({recommendation,disabled,onConfirm}:{recommendation:FrameRecommendation;disabled:boolean;onConfirm:(count:number|'auto')=>void}){
 return <section className="yu-frame-recommendation" aria-label="故事编排"><h3>按原文编排故事</h3><p className="yu-count-help">初步估计 {recommendation.count} 幅，最终数量由编排和审核确定。</p><p className="yu-count-help">{recommendation.reason}</p><p className="yu-count-help">审核可增减画幅，文字稿稳定后再生成图片。</p><button type="button" className="yu-primary" disabled={disabled} onClick={()=>onConfirm('auto')}>{disabled?'正在开启…':'继续编排故事'}</button></section>;
}
