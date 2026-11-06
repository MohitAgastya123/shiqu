// English product messages; source evidence and machine identifiers remain stable.
// Draft discovery stays off the shelf; one current-family CAS promotes only an explicit new choice.
// Existing rows are the durable version receipts, so replay never reapplies inherited control.
import {requirementsForReselection} from '../lib/reader-requirements.ts';
import {ReaderError,selectionSchema} from '../lib/reader-model.ts';
import type {Document,SessionRow} from '../lib/reader-model.ts';
import type {ReaderRepository} from '../lib/reader-repository.ts';
import type {LocalBooks} from './local-books.ts';
import type {ReplacementChoice} from '../lib/reader-reselection.ts';
import {localSourceKey} from '../lib/reader-source-key.ts';
import {createIntake} from './reader-intake.ts';
import {revisionBasis,replacementToken,familyEpoch,currentFamilyVersion} from './reader-revisions.ts';
import {commandFingerprint,commandReceipt,recordNoop} from './reader-commands.ts';

export async function openReselection(repo:ReaderRepository,parentId:string,ownerId:string,requestId:string,books?:LocalBooks){
 const existing=await repo.db.prepare('SELECT * FROM stories WHERE id=?').bind(requestId).first<SessionRow>();
 if(existing){
  const doc=JSON.parse(existing.document) as Document;
  if(existing.user_id!==ownerId||(doc.reselection?.parentId!==parentId&&!(doc.revision?.kind==='selection'&&doc.revision.parentId===parentId)))throw new ReaderError(409,'This request ID has already been used for different content.');
  return repo.get(requestId,ownerId);
 }
 if(await commandReceipt(repo.db,ownerId,requestId))throw new ReaderError(409,'This request ID has already been used for different content.');
 const row=await repo.get(parentId,ownerId),{epoch,rootId}=await revisionBasis(repo,row,true);
 const reset=requirementsForReselection(selectionSchema.parse(JSON.parse(row.selection)),(JSON.parse(row.document) as Document).setupRequirements),selection=reset.selection;
 const {displayTitle:_,storyTitle:__,source:___,...settings}=selection;void _;void __;void ___;
 return createIntake(repo,requestId,ownerId,{...settings,length:'auto'},books,{parentId,rootId,epoch,baseToken:replacementToken(row.selection,epoch)},reset.setup);
}

export async function commitReselection(repo:ReaderRepository,parentId:string,draftId:string,ownerId:string,choice:ReplacementChoice,attempt=0):Promise<SessionRow>{
 const fingerprint=commandFingerprint(['replace',parentId,draftId,choice]);
 const receipt=await commandReceipt(repo.db,ownerId,choice.requestId,fingerprint);
 if(receipt){if(receipt.session_id!==parentId)throw new ReaderError(409,'Request ID conflict.');if(receipt.action==='replace'&&receipt.result_id)return repo.get(receipt.result_id,ownerId);if(receipt.action==='same-selection')return repo.current(parentId,ownerId);throw new ReaderError(409,'Request ID conflict.');}
 const row=await repo.get(draftId,ownerId),doc=JSON.parse(row.document) as Document;
 if(doc.revision?.kind==='selection'){
  if(doc.revision.parentId!==parentId||doc.revision.selectionRequest!==choice.requestId||doc.revision.requestHash!==fingerprint)throw new ReaderError(409,'This replacement was already submitted or its request ID conflicts. Refresh the current revision.');
  return row;
 }
 const draft=doc.reselection;
 if(!draft||draft.parentId!==parentId||!doc.intake)throw new ReaderError(409,'This is not a replacement draft for the current story.');
 const parent=await repo.get(parentId,ownerId),basis=await revisionBasis(repo,parent,true);
 if(basis.epoch!==draft.epoch||replacementToken(parent.selection,basis.epoch)!==draft.baseToken)throw new ReaderError(409,'The story selection or production settings have changed. Keep the draft and check again.');
 const candidate=doc.intake.batches[choice.batch]?.stories[choice.index];if(!candidate)throw new ReaderError(400,'Select a saved story candidate.');
 const previous=selectionSchema.parse(JSON.parse(parent.selection));
 const same=!!candidate.source&&!!previous.source&&localSourceKey(candidate.source)===localSourceKey(previous.source);
 if(same){await recordNoop(repo.db,ownerId,parentId,choice.requestId,'same-selection',fingerprint);await repo.remove(draftId,ownerId);return repo.current(parentId,ownerId);}
 const baseline=selectionSchema.parse(JSON.parse(row.selection)),inherited=(JSON.parse(parent.document) as Document).setupRequirements?.suggestions;
 const settings={...doc.intake.draft,...choice.settings},overrides={...doc.setupRequirements?.overrides};
 // A draft starts with inherited automatic text removed. Preserve edits to that baseline,
 // including blanks; older callers may still submit the parent's unchanged suggestions.
 for(const key of ['productionPrompt','acceptancePrompt'] as const){
  const value=settings[key];
  if(value===undefined)continue;
  if(value===inherited?.[key]){settings[key]='';delete overrides[key];}
  else if(value!==(baseline[key]||''))overrides[key]=value;
 }
 const selection=selectionSchema.parse({...baseline,...settings,storyTitle:candidate.title,source:candidate.source,length:'auto'});
 doc.setupRequirements={overrides};
 delete selection.displayTitle;
 if(!doc.intake.manualArt&&!choice.settings&&candidate.artRecommendation)selection.artStyle=candidate.artRecommendation.artStyle;
 delete doc.reselection;delete doc.original;delete doc.frameRecommendation;delete doc.storyboard;delete doc.draft;delete doc.visualReview;
 doc.plan=null;doc.images=[];doc.audio=[];doc.usage=[];doc.frameCountConfirmed=false;
 doc.intake.phase='preparing';doc.intake.selected={batch:choice.batch,index:choice.index};doc.intake.generation++;
 doc.intake.search={...(doc.intake.search||{round:0}),state:'idle',error:null};
 delete doc.intake.draft;
 doc.revision={kind:'selection',selectionRequest:choice.requestId,parentId,rootId:draft.rootId,number:draft.epoch+1,baseToken:draft.baseToken,requestHash:fingerprint,base:{selection,plan:null,images:[]}};
 const now=new Date().toISOString();
 const changed=await repo.db.prepare(`UPDATE stories AS d SET
  selection=?,document=json_patch(?,json_object('publication',json_extract(p.document,'$.publication'))),
  generation_mode=p.generation_mode,generation_control=p.generation_control,state='idle',error=NULL,
  step_key=NULL,step_attempts=0,lock_token=NULL,lock_until=0,page=0,saved=p.saved,last_read_at=NULL,updated_at=?
  FROM stories p WHERE d.id=? AND d.user_id=? AND d.document=? AND p.id=? AND p.user_id=?
   AND ${currentFamilyVersion('p')} AND json_remove(p.selection,'$.displayTitle')=json_remove(?,'$.displayTitle')
   AND NOT EXISTS(SELECT 1 FROM library_deletions x WHERE x.story_id=d.id AND x.user_id=d.user_id)
   AND NOT EXISTS(SELECT 1 FROM reader_commands c WHERE c.owner_id=? AND c.request_id=?)
   AND NOT EXISTS(SELECT 1 FROM stories occupied WHERE occupied.user_id=? AND occupied.id=?)
   AND (${familyEpoch.replace(' AS epoch','')})=?`)
  .bind(JSON.stringify(selection),JSON.stringify(doc),now,draftId,ownerId,row.document,parentId,ownerId,parent.selection,ownerId,choice.requestId,ownerId,choice.requestId,ownerId,draft.rootId,draft.rootId,draft.epoch).run();
 if(!changed.meta.changes){
  const current=await repo.get(draftId,ownerId),saved=JSON.parse(current.document) as Document;
  if(saved.revision?.kind==='selection'||saved.reselection?.baseToken===draft.baseToken&&attempt<3)return commitReselection(repo,parentId,draftId,ownerId,choice,attempt+1);
  throw new ReaderError(409,'The current revision or draft has changed. Check again.');
 }
 return repo.get(draftId,ownerId);
}

export async function cancelReselection(repo:ReaderRepository,parentId:string,draftId:string,ownerId:string){
 const row=await repo.db.prepare('SELECT document FROM stories WHERE id=? AND user_id=?').bind(draftId,ownerId).first<{document:string}>();
 if(!row)throw new ReaderError(404,'The story selection draft does not exist.');
 const doc=JSON.parse(row.document) as Document;
 if(doc.reselection?.parentId===parentId)await repo.remove(draftId,ownerId);
 else if(!(doc.revision?.kind==='selection'&&doc.revision.parentId===parentId))throw new ReaderError(409,'This draft does not belong to this story.');
 // A lost commit response cannot make cancelling the old window delete the submitted version.
 return repo.current(parentId,ownerId);
}
