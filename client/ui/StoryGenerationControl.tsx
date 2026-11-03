// Pause and resume are the only reader-facing controls for durable whole-story production.
import StoryFlowAction from './StoryFlowAction';
import type {ProductionAction,SessionView} from '@/lib/reader-model';

type Props={session:SessionView;busy:boolean;onControl:(id:string,action:ProductionAction)=>Promise<void>;primary?:boolean;link?:boolean};
export default function StoryGenerationControl({session,busy,onControl,primary=false,link=false}:Props){
 if(session.state==='completed')return null;
 if(session.superseded)return <p className="yu-generation-control">这是旧版本，请打开书架中的最新版本继续生成。</p>;
 const preparing=!!session.intake&&['preparing','discovering'].includes(session.intake.phase);
 const manual=!!session.generationControl&&session.generationControl!=='active';
 return <StoryFlowAction asLink={link} type="button" className={primary?'yu-primary':'yu-generation-control'} disabled={busy} aria-busy={busy} onClick={()=>void onControl(session.id,manual?'resume':'pause')}>{manual?(preparing?'恢复准备':'恢复生成'):'暂停生成'}</StoryFlowAction>;
}
