// English product messages; source evidence and machine identifiers remain stable.
// Save creation intent before extraction, and serialize each explicit choice independently of queue progress.
// Continuation and setting drafts preserve the chosen story; title changes reset only unselected intake.
// Changing discovery conditions updates the same task, fencing obsolete searches without starting a new one.
// An explicit query keeps the original scope and controls, and never bypasses a production lock.
import type {RequirementsSetup} from '../lib/reader-requirements.ts';
import {requirementsForReselection} from '../lib/reader-requirements.ts';
import {directBookChoice,selectedChapterScope} from './local-book-contents.ts';
import type {LocalBooks} from './local-books.ts';
import {localBookId} from './local-books.ts';
import {createHash} from 'node:crypto';
import {emptyDocument,selectionSchema,ReaderError} from '../lib/reader-model.ts';
import type {Document,Selection,SessionRow} from '../lib/reader-model.ts';
import {effectiveIntakePhase,intakeSearch} from '../lib/reader-intake.ts';
import type {IntakeAction,IntakeSearch,ReselectionDraft} from '../lib/reader-intake.ts';
import type {ReaderRepository} from '../lib/reader-repository.ts';
import {maxSuggestionBatches} from '../lib/reader-suggestions.ts';
import {storyBriefVerified} from '../lib/reader-story-brief.ts';
import {commandReceipt,recordNoop} from './reader-commands.ts';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const visible='NOT EXISTS(SELECT 1 FROM library_deletions WHERE story_id=stories.id AND user_id=stories.user_id)';
async function intakeSelection(input:Selection,books?:LocalBooks){
 if(input.discovery?.mode==='title'){
  if(input.source)throw new ReaderError(400,'Enter a target title and chapter range; do not also select a different story directly.');
  if(!books||!await books.book(input))throw new ReaderError(400,'Title discovery requires verified local text. Choose a built-in book.');
 }
 if(input.source&&input.discoverySources)throw new ReaderError(400,'Choose chapter discovery or a direct story selection; do not combine them.');
 if((input.source||input.discoverySources)&&!books)throw new ReaderError(503,'The local book collection is unavailable.');
 const local=input.discoverySources?await books!.book(input):null;
 if(input.discoverySources&&!local)throw new ReaderError(400,'Chapter discovery is supported only for built-in books.');
 const scope=local?selectedChapterScope(books!,local,input.discoverySources!):null;
 const choice=input.source?await directBookChoice(books!,input):null;
 const selection=selectionSchema.parse({...input,storyTitle:choice?.entry.title,source:choice?.entry.source,discoverySources:scope?.discoverySources,length:'auto',narrativeDetail:input.narrativeDetail||'balanced'});
 if(selection.bookId==='other'&&!selection.customBook?.trim())throw new ReaderError(400,'Enter a book title or URL first.');
 return {selection,choice};
}
export async function createIntake(repo:ReaderRepository,id:string,uid:string,input:Selection,books?:LocalBooks,reselection?:ReselectionDraft,setupRequirements?:RequirementsSetup){
 const {selection,choice}=await intakeSelection(input,books);
 const creationHash=hash(selection),doc:Document={...emptyDocument(),intake:{phase:'choosing',generation:0,creationHash,batches:[],briefRequired:true,search:{round:0,state:'idle'}}};
 if(choice){doc.original=choice.original;doc.intake!.phase='preparing';doc.intake!.search={round:0,state:'idle'};doc.intake!.selected={batch:0,index:0};doc.intake!.batches=[{stories:[{title:choice.entry.title,description:choice.entry.excerpt,source:choice.entry.source,sourceLabel:choice.entry.chapter}],note:''}];}
 if(setupRequirements)doc.setupRequirements=setupRequirements;
 if(reselection){doc.reselection=reselection;doc.intake!.manualArt=true;}
 const row=await repo.create(id,uid,selection,doc);
 if((JSON.parse(row.document) as Document).intake?.creationHash!==creationHash)throw new ReaderError(409,'This creation ID has already been used for different content. Start a new request.');
 return row;
}
// Manual search stands outside selection generations; automatic continuation must still be unselected at write time.
async function requestSearch(repo:ReaderRepository,row:SessionRow,doc:Document,requestId:string,fingerprint:string,automatic=false){
 const intake=doc.intake!,search=intakeSearch(intake);
 if(automatic&&(intake.selected||intake.phase!=='choosing'||search.state!=='idle'||!intake.batches.at(-1)?.stories.length)||search.state==='searching'||search.state==='idle'&&search.requestId===requestId){await recordNoop(repo.db,row.user_id,row.id,requestId,'setup',fingerprint);return row;}
 if(doc.plan||intake.phase==='confirmed')throw new ReaderError(409,'Production is confirmed. Create a revision to make changes.');
 if(intake.batches.length>=maxSuggestionBatches)throw new ReaderError(400,'Forty candidate batches have been saved. Choose from them or start with another book and theme.');
 const next:IntakeSearch={round:search.round+1,state:'searching',requestId,commandHash:fingerprint,cycleId:automatic?(search.cycleId||hash([row.id,search.round])):requestId};
 const changed=await repo.db.prepare(`UPDATE stories SET document=json_set(document,'$.intake.search',json(?),'$.intake.phase',CASE WHEN json_type(document,'$.intake.selected')='object' THEN json_extract(document,'$.intake.phase') ELSE 'discovering' END),updated_at=?
  WHERE id=? AND user_id=? AND COALESCE(json_extract(document,'$.intake.search.round'),0)=? AND json_extract(document,'$.intake.phase')!='confirmed'${automatic?" AND json_type(document,'$.intake.selected') IS NOT 'object' AND json_extract(document,'$.intake.phase')='choosing' AND json_extract(document,'$.intake.search.state')='idle'":''} AND ${visible}`)
  .bind(JSON.stringify(next),new Date().toISOString(),row.id,row.user_id,search.round).run();
 // A command that lost the CAS was accepted as a no-op; later replay cannot start a new round.
 if(!changed.meta.changes)await recordNoop(repo.db,row.user_id,row.id,requestId,'setup',fingerprint);
 return repo.get(row.id,row.user_id);
}
export async function changeIntake(repo:ReaderRepository,id:string,uid:string,action:IntakeAction,books?:LocalBooks,attempt=0):Promise<SessionRow>{
 const row=await repo.get(id,uid),doc=JSON.parse(row.document) as Document,intake=doc.intake,selection=selectionSchema.parse(JSON.parse(row.selection));
 const fingerprint=hash(action),receipt=await commandReceipt(repo.db,uid,action.requestId,fingerprint);
 if(receipt){if(receipt.action!=='setup'||receipt.session_id!==id)throw new ReaderError(409,'This request ID has already been used for different content.');return row;}
 if(doc.reselection&&!['more','search'].includes(action.action))throw new ReaderError(409,'Submit your choice in the replacement story dialog. Drafts cannot start production.');
 if(!intake)throw new ReaderError(409,'This story uses an older production workflow. Continue its existing steps.');
 intake.phase=effectiveIntakePhase(doc,selection)!;
 if(action.action==='more')return requestSearch(repo,row,doc,action.requestId,fingerprint,action.automatic);
 if(intake.lastAction?.id===action.requestId){if(intake.lastAction.hash!==fingerprint)throw new ReaderError(409,'This request ID has already been used for different content.');return row;}
 if(intake.generation!==action.generation)throw new ReaderError(409,'Another request changed the production content. Reopen it to continue.');
 if(doc.plan||intake.phase==='confirmed')throw new ReaderError(409,'Production is confirmed. Create a revision to make changes.');
 if(action.action==='conditions'){
  if(intake.selected||!['discovering','choosing'].includes(intake.phase))throw new ReaderError(409,'The story is already selected. Discovery conditions cannot be changed.');
  if(row.state==='running'&&row.lock_until>Date.now())throw new ReaderError(409,'The current task is saving. Wait before changing discovery conditions.');
  const {selection:next}=await intakeSelection(selectionSchema.parse({...selection,...action.conditions,customBook:action.conditions.customBook,discoverySources:action.conditions.discoverySources,discovery:{mode:'auto'},storyTitle:undefined,source:undefined,displayTitle:undefined}),books);
  const conditions=(value:Selection)=>JSON.stringify([value.bookId,value.customBook,value.theme,value.discoverySources,value.productionPrompt]);
  if(conditions(next)===conditions(selection)){await recordNoop(repo.db,uid,id,action.requestId,'setup',fingerprint);return row;}
  // Search rounds fence late extraction results; generations fence stale candidate selections.
  const round=intakeSearch(intake).round+1;
  intake.phase='choosing';intake.generation++;intake.batches=[];
  intake.search={round,state:'idle'};intake.lastAction={id:action.requestId,hash:fingerprint};
  delete intake.draft;delete doc.original;delete doc.frameRecommendation;doc.frameCountConfirmed=false;
  const result=await repo.db.prepare(`UPDATE stories SET selection=?,document=?,state='idle',error=NULL,lock_token=NULL,lock_until=0,step_key=NULL,step_attempts=0,updated_at=?
   WHERE id=? AND user_id=? AND document=? AND selection=? AND state=? AND ${visible}`)
   .bind(JSON.stringify(next),JSON.stringify(doc),new Date().toISOString(),id,uid,row.document,row.selection,row.state).run();
  if(!result.meta.changes){if(attempt<3)return changeIntake(repo,id,uid,action,books,attempt+1);throw new ReaderError(409,'Discovery conditions have changed. Reopen to continue.');}
  return repo.get(id,uid);
 }
 if(action.action==='search'){
  if(intake.selected||!['discovering','choosing'].includes(intake.phase))throw new ReaderError(409,'The story is already selected. Change the target title in a replacement draft.');
  if(row.state==='running'&&row.lock_until>Date.now())throw new ReaderError(409,'The current task is saving. Wait before changing the target title.');
  if(action.title&&!localBookId(selection))throw new ReaderError(400,'Title discovery requires a built-in book with verified original text.');
  const discovery=action.title?{mode:'title' as const,title:action.title}:{mode:'auto' as const},search=intakeSearch(intake);
  if(search.state==='searching'&&JSON.stringify(selection.discovery)===JSON.stringify(discovery)){
   await recordNoop(repo.db,uid,id,action.requestId,'setup',fingerprint);return row;
  }
  // The new round fences old paid results; the generation also fences stale candidate choices.
  selection.discovery=discovery;delete selection.storyTitle;delete selection.source;selection.length='auto';
  intake.phase='discovering';intake.generation++;intake.batches=[];
  intake.search={round:search.round+1,state:'searching',requestId:action.requestId,commandHash:fingerprint,cycleId:action.requestId};
  delete doc.original;delete doc.frameRecommendation;doc.frameCountConfirmed=false;
  const result=await repo.db.prepare(`UPDATE stories SET selection=?,document=?,state='idle',error=NULL,lock_token=NULL,lock_until=0,step_key=NULL,step_attempts=0,updated_at=?
   WHERE id=? AND user_id=? AND document=? AND selection=? AND state=? AND ${visible}`)
   .bind(JSON.stringify(selection),JSON.stringify(doc),new Date().toISOString(),id,uid,row.document,row.selection,row.state).run();
  if(!result.meta.changes){if(attempt<3)return changeIntake(repo,id,uid,action,books,attempt+1);throw new ReaderError(409,'Search conditions have changed. Reopen to continue.');}
  return repo.get(id,uid);
 }
 const manual=(artStyle:Selection['artStyle'])=>artStyle!==selection.artStyle||!!intake.manualArt;
 if(action.action==='draft'){
  // The running step keeps its lock and its input version; confirming applies these settings.
  if(!['preparing','confirming'].includes(intake.phase))throw new ReaderError(409,'Select a story first.');
  await repo.db.prepare(`UPDATE stories SET document=json_set(document,'$.intake.draft',json(?),'$.intake.manualArt',json(?)),updated_at=? WHERE id=? AND user_id=? AND json_extract(document,'$.intake.generation')=? AND json_extract(document,'$.intake.phase')!='confirmed' AND ${visible}`)
   .bind(JSON.stringify(action.settings),JSON.stringify(manual(action.settings.artStyle)),new Date().toISOString(),id,uid,action.generation).run();
  return repo.get(id,uid);
 }
 // The lock of a service that died cannot be released by a story that will not run again.
 if(row.state==='running'&&row.lock_until>Date.now())throw new ReaderError(409,'The current task is saving. Wait before changing your selection.');
 if(action.action==='choose'){
  const candidate=intake.batches[action.batch]?.stories[action.index];if(!candidate)throw new ReaderError(400,'Select a saved story candidate.');
  if(intake.selected?.batch===action.batch&&intake.selected.index===action.index&&['preparing','confirming'].includes(intake.phase))return row;
  const settings=action.settings||intake.draft;
  if(settings){intake.manualArt=manual(settings.artStyle);Object.assign(selection,settings);}
  const reset=requirementsForReselection(selection,doc.setupRequirements);
  Object.assign(selection,reset.selection);doc.setupRequirements=reset.setup;
  selection.storyTitle=candidate.title;selection.source=candidate.source;
  if(!intake.manualArt&&candidate.artRecommendation)selection.artStyle=candidate.artRecommendation.artStyle;
  intake.selected={batch:action.batch,index:action.index};intake.phase='preparing';
  intake.search={...intakeSearch(intake),state:'idle',error:null};
  delete doc.original;delete doc.frameRecommendation;doc.frameCountConfirmed=false;selection.length='auto';
 }else{
  if(!intake.selected||intake.phase!=='confirming')throw new ReaderError(409,'Select a story and wait for the production recommendations to be saved.');
  intake.manualArt=manual(action.settings.artStyle);Object.assign(selection,action.settings);
  if(action.action==='recommend'){intake.draft={...action.settings,length:'auto'};delete doc.frameRecommendation;doc.frameCountConfirmed=false;intake.phase='preparing';selection.length='auto';}
  else{
   if(!doc.original||!doc.frameRecommendation)throw new ReaderError(409,'The source and production recommendations have not been saved yet.');
   const chosen=intake.batches[intake.selected.batch]?.stories[intake.selected.index];
   if((intake.briefRequired||chosen?.storyBrief||doc.original.storyBrief)&&!storyBriefVerified(doc.original))throw new ReaderError(409,'The story summary has not been verified against the original. Prepare the story again.');
   doc.frameCountConfirmed=true;intake.phase='confirmed';
   // Results could no longer be chosen. A call in flight stops at its end and saves its reading position.
   intake.search={...intakeSearch(intake),state:'idle',error:null};
  }
 }
 if(action.action!=='recommend')delete intake.draft;
 intake.generation++;intake.lastAction={id:action.requestId,hash:fingerprint};
 const result=await repo.db.prepare(`UPDATE stories SET selection=?,document=?,state='idle',error=NULL,lock_token=NULL,lock_until=0,step_key=NULL,step_attempts=0,updated_at=?${action.action==='confirm'?",generation_mode='background',generation_control='active'":''}
  WHERE id=? AND user_id=? AND document=? AND selection=? AND state=? AND ${visible}`)
  .bind(JSON.stringify(selection),JSON.stringify(doc),new Date().toISOString(),id,uid,row.document,row.selection,row.state).run();
 if(!result.meta.changes){
  const current=await repo.get(id,uid),saved=(JSON.parse(current.document) as Document).intake;
  if(saved?.lastAction?.id===action.requestId&&saved.lastAction.hash===fingerprint)return current;
  // Search results and drafts land without a new generation, and they do not conflict with this choice.
  if(saved?.generation===action.generation&&attempt<3)return changeIntake(repo,id,uid,action,books,attempt+1);
  throw new ReaderError(409,'Production content has changed. Reopen to continue.');
 }
 return repo.get(id,uid);
}
