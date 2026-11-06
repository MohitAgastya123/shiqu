// English interface: labels, accessibility text, and workflow messages use English.
// Pause active production or resume a manual pause; failed work uses its fault recovery action.
import StoryFlowAction from './StoryFlowAction';
import type {ProductionAction,SessionView} from '@/lib/reader-model';

type Props={session:SessionView;busy:boolean;onControl:(id:string,action:ProductionAction)=>Promise<void>;primary?:boolean;link?:boolean};
export default function StoryGenerationControl({session,busy,onControl,primary=false,link=false}:Props){
 if(session.state==='completed')return null;
 if(session.superseded)return <p className="yu-generation-control">This is an older version. Open the latest version on your shelf to continue generation.</p>;
 const preparing=!!session.intake&&['preparing','discovering'].includes(session.intake.phase);
 const manual=!!session.generationControl&&session.generationControl!=='active';
 if(!manual&&(session.state==='failed'||session.error))return null;
 return <StoryFlowAction asLink={link} type="button" className={primary?'yu-primary':'yu-generation-control'} disabled={busy} aria-busy={busy} onClick={()=>void onControl(session.id,manual?'resume':'pause')}>{manual?(preparing?"Resume preparation":"Resume generation"):"Pause generation"}</StoryFlowAction>;
}
