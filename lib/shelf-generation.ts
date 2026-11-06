// English product text and generation contracts; canonical source evidence remains unchanged.
// Explain saved generation checkpoints without treating a shelf visit as demand for new work.
import type {SessionView} from './reader-model.ts';

export function shelfGenerationStatus(session:SessionView){
 if(session.state!=='completed'&&session.generationControl&&session.generationControl!=='active')return {group:'Paused',message:'Paused',detail:'Saved results are retained. Resume generation to continue; active work will still finish and save.',action:'View details'};
 if(session.state==='failed'||session.error)return {group:'Failed',message:'Failed',detail:session.error||'Saved results are retained. Retry to continue.',action:'View details'};
 if(session.state==='completed')return {group:'Complete',message:'Story complete',detail:'All images are saved.',action:'Read story'};
 if(session.intake?.phase==='choosing'&&!session.intake.selected&&session.intake.search?.state==='idle'&&!session.intake.batches.length)return {group:'Ready to discover',message:'Ready to discover',detail:'Source scope and theme are saved. Open discovery and start searching.',action:'Discover stories'};
 if(session.intake?.phase==='choosing')return {group:'Choose a story',message:'Waiting for story selection',detail:session.intake.search?.state==='failed'?'Discovery did not finish. Candidates are saved; retry the search.':'Book, theme and candidates are saved. Choose one to prepare production.',action:'Choose story'};
 if(session.intake?.phase==='confirming')return {group:'Confirm production',message:'Waiting for production confirmation',detail:'Confirm story, style, frame count and creative requirements before storyboarding.',action:'Confirm production'};
 if(session.awaitingFrameCount)return {group:'Choose frame count',message:'Waiting for frame count',detail:'Generation starts after confirming the frame count.',action:'Choose frame count'};
 if(session.productionState==='running'||!session.productionState&&session.state==='running')return {group:'Generating',message:session.stage,detail:session.intake&&session.intake.phase!=='confirmed'?'Preparing production in the background. Storyboarding and drawing wait for confirmation.':'Generating the whole story in the background. You can pause at any time.',action:'View progress'};
 if(session.productionState==='queued'||session.generationMode==='background')return {group:'Queued',message:'Queued',detail:'Queued; production starts automatically when its turn arrives.',action:'View progress'};
 return {group:'Paused',message:'Paused',detail:'Continue generation to resume. Saved results are retained.',action:'View details'};
}
