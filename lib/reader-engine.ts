// Advance local story generation under one session lock, retaining every paid result it can save.
// A failed save is rethrown for recovery; bounded English source translations are durable preparation steps.
// Translation keeps model usage but omits raw-language prompt input from public prompt history.
// Every newly generated or repaired balloon receives source verification and automatic readable placement.
// Imported full review covers every evidence unit; unspent paused production yields preserve checkpoints without faults.
import {blockedIssues,nextStep,reviewPhase,planSchema,reflectionCandidatesSchema,storyPresentationSchema,storyDraftSchema,storyboardOutlineSchema,storyboardBatchSchema,selectionSchema,view,ReaderError,productionComplete,readerBooks} from './reader-model.ts';
import type {Document,Plan,StoryDraft,ReflectionCandidates,StoryPresentation,Selection,SessionRow,Storyboard,StoryboardOutline} from './reader-model.ts';
import type {BubblePlacementFeedback} from './reader-bubbles.ts';
import {autoPlaceBubbles,validateBubbleEvidence,BubbleDensityError} from './reader-bubbles.ts';
import {sourceTranslationReady,verifiedOriginalPayload} from './reader-source-types.ts';
import {translateSourceCheckpoint} from './reader-source-english.ts';
import {persistenceError} from './reader-repository.ts';
import type {ReaderRepository} from './reader-repository.ts';
import type {ArtStyleId} from './reader-styles.ts';
import type {OriginalSource,SourceResult,SourceHint} from './reader-source-types.ts';
import {suggestedSettings} from './reader-requirements.ts';
import {frameRecommendationOutputSchema} from './reader-frame-recommendation.ts';
import {storyBriefSchema,storyBriefVerified} from './reader-story-brief.ts';
import {storyEditorialContext} from './reader-prompts.ts';
import type {FrameRecommendation} from './reader-frame-recommendation.ts';
import {artRecommendationSchema} from './reader-art-recommendation.ts';
import type {ArtRecommendation} from './reader-art-recommendation.ts';
import {readerImageBatchSize,readerStoryboardBatchSize,readerMaxAutomaticRepairs} from './reader-limits.ts';
import {newReview,parseFrameCountReport,reviewReportSchema,repairOutputSchema,pendingRepairs,storyReplanMessage} from './reader-review.ts';
import {syncRevisionImages,reusableRevisionImages} from './reader-revision.ts';
import {applyStructuralEdits} from './reader-structure.ts';
import type {StructuralEdits} from './reader-structure.ts';
import {validateEditorialCoverage,assertImportedCoverageReady} from './reader-editorial.ts';
import type {EditorialCoverage} from './reader-editorial.ts';
import type {ReviewIssue,ReviewReport,RepairedPage,FrameCountReport,FrameCountContext} from './reader-review.ts';
import type {PromptRecord} from './reader-prompt-records.ts';
export type Generated<T>={promptRecord?:PromptRecord;value:T;model:string;requestId:string|null;usage:unknown;reasoningEffort?:string};
export interface StoryGenerator{validateOriginal?(selection:Selection,original:OriginalSource):void;translateSource?(text:string,title:string):Promise<Generated<{title:string;text:string}>>;recommendArt?(selection:Selection,original:OriginalSource):Promise<ArtRecommendation>;prepareOriginal?(selection:Selection,id:string):Promise<OriginalSource|null>;recommend?(selection:Selection,id:string,original:OriginalSource,prepareRequirements?:boolean):Promise<Generated<FrameRecommendation>>;outline?(selection:Selection,id:string,original?:OriginalSource):Promise<Generated<StoryboardOutline>>;planBatch?(selection:Selection,id:string,storyboard:Storyboard,original:OriginalSource,bubblePlacementRetry?:BubblePlacementFeedback):Promise<Generated<Plan['pages']>>;reviewFrameCount?(selection:Selection,plan:Plan,original:OriginalSource):Promise<Generated<FrameCountReport>>;review?(selection:Selection,plan:Plan,original:OriginalSource,outline?:StoryboardOutline,candidates?:ReflectionCandidates):Promise<Generated<ReviewReport>>;restructure?(selection:Selection,plan:Plan,original:OriginalSource,issues:ReviewIssue[],coverage?:EditorialCoverage[],frameCountContext?:FrameCountContext,bubblePlacementRetry?:BubblePlacementFeedback):Promise<Generated<StructuralEdits>>;repair?(selection:Selection,plan:Plan,original:OriginalSource,issues:ReviewIssue[],outline?:StoryboardOutline,bubblePlacementRetry?:BubblePlacementFeedback):Promise<Generated<RepairedPage[]>>;reflectionCandidates(selection:Selection,draft:StoryDraft,original:OriginalSource):Promise<Generated<StoryPresentation>>;reflection(selection:Selection,draft:StoryDraft,original:OriginalSource,revision?:{reflection:string;issues:ReviewIssue[]}):Promise<Generated<string>>;plan(selection:Selection,id:string,original?:OriginalSource,bubblePlacementRetry?:BubblePlacementFeedback):Promise<Generated<StoryDraft>>;original(selection:Selection,plan:SourceHint,id:string):Promise<SourceResult>;image(plan:Plan,page:number,id:string,reference:string,style?:ArtStyleId,productionPrompt?:string,artifactId?:string):Promise<Generated<string>>;audio(caption:string,id:string,page:number):Promise<Generated<string>>;safeError(error:unknown):string;}

async function drawRequestedImages(repo:ReaderRepository,generator:StoryGenerator,row:SessionRow,token:string,doc:Document,selection:Selection,throughPage:number){
 assertImportedCoverageReady(doc);
 const pages=doc.plan!.pages.map((_,page)=>page).filter(page=>page<=throughPage&&!doc.images[page]);
 // A new story establishes its reference alone; later requests may draw three missing scenes.
 const batch=pages.slice(0,doc.images[0]?readerImageBatchSize:1);
 const reference=doc.images[0]||'';
 let writes=Promise.resolve();
 const drawing=batch.map(async page=>{
  const image=await generator.image(doc.plan!,page,row.id,reference,selection.artStyle,selection.productionPrompt);
  doc.images[page]=image.value;
  doc.usage.push({step:`image:${page}`,model:image.model,requestId:image.requestId,usage:image.usage,...(image.promptRecord?{promptRecord:image.promptRecord}:{})});
  // Queue immutable snapshots; once a write fails, skip later writes until final recovery.
  const snapshot=structuredClone(doc);
  writes=writes.then(()=>repo.saveImageProgress(row,token,snapshot));
  await writes;
 });
 const outcomes=await Promise.allSettled(drawing);
 for(const outcome of outcomes)if(outcome.status==='rejected')throw outcome.reason;
}

export async function advanceStory(repo:ReaderRepository,generator:StoryGenerator,uid:string,id:string,throughPage:number,retry=false,onAcquired?:(token:string)=>void,onFailed?:(error:unknown)=>void){
 function preparedPages<T extends Plan['pages'][number]>(pages:T[],original:OriginalSource|undefined):T[]{
  const source=original?verifiedOriginalPayload(original):null;
  validateBubbleEvidence(pages,source?[source.text,source.chapterContext?.text||''].join('\n'):'');
  return pages.map(page=>page.bubbles?.length?{...page,bubbles:autoPlaceBubbles(page.bubbles)}:page);
 }
 let row=await repo.get(id,uid);
 if(row.generation_control&&row.generation_control!=='active')return view(row);
 if(row.state==='running'){if(row.lock_until>Date.now())return view(row);row=await repo.stale(row);}
 if(row.state==='failed'&&!retry)return view(row);
 const selection=selectionSchema.parse(JSON.parse(row.selection)),doc=JSON.parse(row.document) as Document;
 const step=nextStep(doc,selection,throughPage);if(!step||step.kind==='discover')return view(row);
 const token=await repo.acquire(row,step);if(!token)return view(await repo.get(id,uid));
 onAcquired?.(token);
 let progressMap:number[]|undefined;
 try{
  let generated:Generated<unknown>|undefined;
  async function fittedGeneration<T>(produce:(feedback?:BubblePlacementFeedback)=>Promise<Generated<T>>,fit:(value:T)=>T,pages:(value:T)=>Plan['pages']):Promise<Generated<T>>{
   let feedback:BubblePlacementFeedback|undefined;
   for(let attempt=1;attempt<=2;attempt++){
    const result=await produce(feedback);
    try{return {...result,value:fit(result.value)};}
    catch(error){
     doc.usage.push({step:step!.key+':bubble-placement:'+attempt,model:result.model,requestId:result.requestId,usage:result.usage,...(result.promptRecord?{promptRecord:result.promptRecord}:{}),...(result.reasoningEffort?{reasoningEffort:result.reasoningEffort}:{})});
     if(error instanceof BubbleDensityError&&attempt===1){feedback={message:error.message+' Preserve the story facts and source quotations; shorten balloon wording, reduce repeated dialogue or restage speaker targets within this same frame count.',previousPages:pages(result.value)};continue;}
     throw new ReaderError(502,error instanceof Error?error.message:'Generated comic balloons are invalid. Retry this storyboard step.');
    }
   }
   throw new ReaderError(502,'Comic balloon fitting could not be completed. Retry this storyboard step.');
  }

  // Both explicit preparation and the legacy planning fallback save the same verified checkpoint.
  async function prepareRecommendation(ownedToken:string){
   if(!doc.original){
    let original=await generator.prepareOriginal?.(selection,id);
    if(!original){
     const book=selection.bookId==='other'?selection.customBook:readerBooks.find(b=>b.id===selection.bookId)?.title||selection.bookId;
     const result=await generator.original(selection,{sourceReference:`《${book||''}》${selection.storyTitle||''}`},id);
     if(!result.source)throw new ReaderError(503,'The source could not be verified. A summary cannot be prepared yet. '+result.message);
     original=result.source;
    }
    doc.original=structuredClone(original);await repo.saveImageProgress(row,ownedToken,structuredClone(doc));
   }
   const chosen=doc.intake?.selected,candidate=chosen?doc.intake!.batches[chosen.batch]?.stories[chosen.index]:undefined;
   // Candidate guidance or an explicit placeholder stays bound to the saved original until checked.
   const pendingBrief=candidate?.storyBrief||{summary:doc.storyboard?.outline.summary||'A complete summary has not been prepared. Write it from the verified source.',matchReason:candidate?.matchReason||(storyEditorialContext(selection.theme).mode==='source'?'Direct source selection: preserve the complete original story without imposing an additional theme.':'Check the selected story against the source for theme evidence and complete narrative coverage.')};
   if(!doc.original.storyBrief){
    doc.original.storyBrief={...storyBriefSchema.parse(pendingBrief),verified:false};
    await repo.saveImageProgress(row,ownedToken,structuredClone(doc));
   }
   generator.validateOriginal?.(selection,doc.original);
   if(!sourceTranslationReady(doc.original)){
    const translated=await translateSourceCheckpoint(doc.original,generator);
    if(translated)return {...translated,promptRecord:undefined,translationOnly:true};
   }
   if(candidate?.source&&!candidate.artRecommendation&&generator.recommendArt){
    const recommendation=artRecommendationSchema.parse(await generator.recommendArt(selection,doc.original));
    await repo.saveArtRecommendation(row,ownedToken,doc,recommendation);
    candidate.artRecommendation=recommendation;
    if(!doc.intake!.manualArt)selection.artStyle=recommendation.artStyle;
   }
   if(!generator.recommend)throw new ReaderError(503,'This provider does not support frame recommendations. Update it and try again.');
   const prepareRequirements=!!doc.intake&&!doc.setupRequirements?.suggestions;
   const result=await generator.recommend(selection,id,doc.original,prepareRequirements),recommendation=frameRecommendationOutputSchema(doc.original,prepareRequirements).parse(result.value);
   if(prepareRequirements){
    doc.setupRequirements={...doc.setupRequirements,suggestions:recommendation.requirements!};
    doc.intake!.draft??=suggestedSettings(selection,doc.setupRequirements.suggestions!,doc.setupRequirements.overrides);
   }
   if(doc.original.storyBrief)doc.original.storyBrief={summary:recommendation.storySummary!,matchReason:recommendation.storyMatchReason!,verified:true};
   doc.frameRecommendation=recommendation;if(selection.length==='auto'&&!doc.intake)doc.frameCountConfirmed=true;return result;
  }
  if(step.kind==='recommend'){const result=await prepareRecommendation(token);generated=result;if(doc.intake&&doc.intake.phase!=='confirmed'&&!('translationOnly' in result))doc.intake.phase='confirming';}
  else if(step.kind==='plan'){
   if(doc.original?.storyBrief&&!storyBriefVerified(doc.original)||!storyBriefVerified(doc.original)&&!doc.storyboard?.outline.summary?.trim()){
    const result=await prepareRecommendation(token);
    if('translationOnly' in result){doc.usage.push({step:'source-translation',model:result.model,requestId:result.requestId,usage:result.usage});return view(await repo.save(row,token,doc,false,null));}
    doc.usage.push({step:'summary',model:result.model,requestId:result.requestId,usage:result.usage,...(result.promptRecord?{promptRecord:result.promptRecord}:{}),...(result.reasoningEffort?{reasoningEffort:result.reasoningEffort}:{})});
    await repo.saveImageProgress(row,token,structuredClone(doc));
   }
   if(generator.prepareOriginal&&!doc.original){
    const original=await generator.prepareOriginal(selection,id);
    if(original){doc.original=structuredClone(original);await repo.saveImageProgress(row,token,structuredClone(doc));}
   }
   if(doc.storyboard||generator.outline&&generator.planBatch&&(selection.length==='auto'||selection.length>readerStoryboardBatchSize)){
    if(!doc.storyboard){
     if(!generator.outline)throw Error('STORYBOARD_UNAVAILABLE');
     const result=await generator.outline(selection,id,doc.original),outline=storyboardOutlineSchema.parse(result.value);
     if(storyBriefVerified(doc.original))outline.summary=doc.original!.storyBrief!.summary;
     if(selection.length!=='auto'&&outline.beats.length!==selection.length)throw Error('PLAN_LENGTH');
     doc.storyboard={outline,pages:[]};generated=result;
    }else{
     if(!doc.original)throw new ReaderError(503,'Verify the source before refining the storyboard.');
     if(!generator.planBatch)throw Error('STORYBOARD_UNAVAILABLE');
     const draft=doc.storyboard,count=Math.min(readerStoryboardBatchSize,draft.outline.beats.length-draft.pages.length);
     if(storyBriefVerified(doc.original))draft.outline.summary=doc.original!.storyBrief!.summary;
     const result=await fittedGeneration(feedback=>generator.planBatch!(selection,id,structuredClone(draft),doc.original!,feedback),value=>preparedPages(storyboardBatchSchema(count).parse({pages:value}).pages,doc.original),value=>value);
     const pages=[...draft.pages,...result.value];
     const plan=pages.length===draft.outline.beats.length?storyDraftSchema.parse({...draft.outline,pages}):null;
     doc.storyboard={outline:draft.outline,pages};if(plan)doc.draft=plan;generated=result;
    }
   }else{
    const result=await fittedGeneration(feedback=>generator.plan(selection,id,doc.original,feedback),value=>{const draft=storyDraftSchema.parse(value);return {...draft,pages:preparedPages(draft.pages,doc.original)};},value=>value.pages);if(selection.length!=='auto'&&result.value.pages.length!==selection.length)throw Error('PLAN_LENGTH');
    doc.draft=storyDraftSchema.parse(result.value);if(storyBriefVerified(doc.original))doc.draft.summary=doc.original!.storyBrief!.summary;generated=result;
   }
  }
  else if(step.kind==='reflection'){
   if(!generator.review)throw new ReaderError(503,'This provider does not support ending selection. Update it and try again.');
   const result=await generator.reflectionCandidates(selection,structuredClone(doc.draft!),doc.original!);
   const {title,candidates}=storyPresentationSchema.parse(result.value);
   doc.plan=planSchema.parse({...doc.draft,title,reflection:candidates[0]});doc.reflectionCandidates=candidates;delete doc.draft;generated=result;
  }
  else if(step.kind==='source'){/* Resume original retrieval without paying to re-plan. */}
  else if(step.kind==='review'){
   const review=doc.visualReview!;
   if(review.status==='blocked'){
    // Only an explicit retry can reach a blocked session; reuse the saved issues without a new audit.
    if(review.stopReason==='requirements')throw new ReaderError(409,'Acceptance criteria conflict or cannot be assessed. Edit them and create a revision.');
    if(review.stopReason==='replan')throw new ReaderError(409,review.issues.some(issue=>issue.requiresReplan&&issue.category==='continuity')?'Character continuity needs revision. Adjust the production instructions and replan.':storyReplanMessage);
    if(!retry)throw new ReaderError(409,'Storyboard review has not passed. Continue revision explicitly.');
    // Give the continuation its own generation so the later recheck cannot reuse this receipt.
    const partial=review.stopReason==='unchanged';review.round++;review.status='repair';review.repairs=0;if(!partial)review.repaired=[];delete review.stopReason;
   }else if(reviewPhase(review,selection)==='frames'){
    if(!generator.reviewFrameCount)throw new ReaderError(503,'This provider does not support frame-count review. Update it and try again.');
    const result=await generator.reviewFrameCount(selection,structuredClone(doc.plan!),doc.original!);
    const report=parseFrameCountReport(doc.plan!.pages.length,{frameCountReview:result.value.frameCountReview,requirements:result.value.requirements});
    validateEditorialCoverage(report.coverage,doc.original!,false);
    (review.frameCountReports??=[]).push({...report,step:step.key,recordedAt:new Date().toISOString()});review.issues=report.issues;review.repaired=[];
    review.phase=report.issues.length?'frames':'full';
    review.status=!report.issues.length?'pending':review.repairs>=readerMaxAutomaticRepairs?'blocked':'repair';
    if(review.status==='blocked')review.stopReason='limit';else delete review.stopReason;generated=result;
   }else{
    if(!generator.review)throw new ReaderError(503,'This provider does not support storyboard review. Update it and try again.');
    const candidates=doc.reflectionCandidates?reflectionCandidatesSchema.parse(doc.reflectionCandidates):undefined;
    const result=await generator.review(selection,structuredClone(doc.plan!),doc.original!,doc.storyboard?.outline,candidates);
    const report=reviewReportSchema(doc.plan!.pages.length,candidates,selection.acceptancePrompt).parse(result.value);
    if(selection.length==='auto'&&!report.coverage)throw new ReaderError(502,'Review did not return source coverage evidence. The draft is saved; illustration has not started.');
    if(report.coverage)validateEditorialCoverage(report.coverage,doc.original!);
    const previousTitle=doc.plan!.title;doc.plan={...doc.plan!,title:report.titleReview.title};
    if(candidates&&report.reflectionChoice){doc.plan={...doc.plan!,reflection:candidates[report.reflectionChoice.index-1]};delete doc.reflectionCandidates;}
    review.phase='full';review.reports.push({step:step.key,recordedAt:new Date().toISOString(),round:review.round,...(report.acceptanceResults?{acceptanceResults:report.acceptanceResults}:{}),issues:report.issues,...(report.coverage?{coverage:report.coverage}:{}),titleReview:{...report.titleReview,previousTitle},...(candidates&&report.reflectionChoice?{reflectionChoice:{...report.reflectionChoice,candidates}}:{})});review.round++;review.issues=report.issues;review.repaired=[];
    const unknown=report.acceptanceResults?.some(result=>result.status==='unknown');
    const replan=report.issues.some(issue=>issue.requiresReplan);
    review.status=unknown?'blocked':!report.issues.length?'passed':replan&&selection.length!=='auto'||review.repairs>=readerMaxAutomaticRepairs?'blocked':'repair';if(review.status==='blocked')review.stopReason=unknown?'requirements':replan&&selection.length!=='auto'?'replan':'limit';else delete review.stopReason;generated=result;
   }
  }
  else if(step.kind==='repair'){
   const review=doc.visualReview!,requested=pendingRepairs(review),issues=review.issues.filter(issue=>requested.includes(issue.page));
   if(review.issues.some(issue=>issue.requiresReplan)){
    if(selection.length!=='auto'||!generator.restructure)throw new ReaderError(503,'This provider does not support storyboard restructuring. Review results are saved; illustration has not started.');
    const count=reviewPhase(review,selection)==='frames'?review.frameCountReports?.at(-1):undefined;
    const before=doc.plan!,result=await fittedGeneration(feedback=>generator.restructure!(selection,structuredClone(before),doc.original!,review.issues,count?.coverage||review.reports.at(-1)?.coverage,count?{frameCountReview:count.frameCountReview,requirements:count.requirements}:undefined,feedback),value=>({...value,edits:value.edits.map(edit=>({...edit,pages:preparedPages(edit.pages,doc.original)}))}),value=>value.edits.flatMap(edit=>edit.pages));
    const edited=applyStructuralEdits(before,result.value);
    (review.history??=[]).push({step:step.key,recordedAt:new Date().toISOString(),changed:edited.changed,round:review.round,requested:review.issues.filter(issue=>issue.requiresReplan).map(issue=>issue.page),changes:[],structure:{edits:edited.edits,before:before.pages.length,after:edited.plan.pages.length,sourcePages:edited.sourcePages,removed:edited.removed,...(edited.characters?{characters:edited.characters,previousCharacters:edited.previousCharacters}:{}),...(doc.storyboard?{previousOutline:doc.storyboard.outline}:{})}});
    generated=result;
    if(!edited.changed){review.status='blocked';review.stopReason='unchanged';}
    else{
     doc.images=reusableRevisionImages({selection,plan:before,images:doc.images},selection,edited.plan,edited.sourcePages);
     doc.audio=[];doc.plan=edited.plan;progressMap=edited.progressMap;
     delete doc.storyboard;delete doc.draft;
     review.phase='frames';review.status='pending';review.repaired=[];review.repairs++;
    }
   }else if(requested[0]===0){
    const result=await generator.reflection(selection,structuredClone(doc.plan!),doc.original!,{reflection:doc.plan!.reflection,issues});
    const reflection=planSchema.shape.reflection.parse(result.value),changed=reflection!==doc.plan!.reflection;
    (review.history??=[]).push({step:step.key,recordedAt:new Date().toISOString(),changed,round:review.round,requested,changes:[],previousReflection:doc.plan!.reflection,...(changed?{reflection}:{})});
    if(!changed){review.status='blocked';review.stopReason='unchanged';}
    else{doc.plan={...doc.plan!,reflection};review.repaired.push(0);review.status='pending';review.repairs++;}
    generated=result;
   }else{
    if(!generator.repair)throw new ReaderError(503,'This provider does not support storyboard revision. Update it and try again.');
    const result=await fittedGeneration(feedback=>generator.repair!(selection,structuredClone(doc.plan!),doc.original!,issues,doc.storyboard?.outline,feedback),value=>preparedPages(repairOutputSchema(requested).parse({pages:value}).pages,doc.original),value=>value);
    const pages=result.value,updated=structuredClone(doc.plan!);
    const changed=pages.filter(({page,...content})=>JSON.stringify(content)!==JSON.stringify(doc.plan!.pages[page-1]));
    (review.history??=[]).push({step:step.key,recordedAt:new Date().toISOString(),changed:!!changed.length,round:review.round,requested:[...requested],before:requested.map(page=>({page,...doc.plan!.pages[page-1]})),changes:structuredClone(changed)});
    for(const {page,...content} of pages)updated.pages[page-1]=content;
    doc.images=reusableRevisionImages({selection,plan:doc.plan,images:doc.images},selection,updated,updated.pages.map((_,i)=>i));
    doc.plan=planSchema.parse(updated);if(doc.storyboard)doc.storyboard.pages=structuredClone(doc.plan.pages);
    if(!changed.length){review.status='blocked';review.stopReason='unchanged';}else{review.repaired.push(...requested);if(!pendingRepairs(review).length){review.status='pending';review.repairs++;}}generated=result;
   }
  }
  else if(step.kind==='image')await drawRequestedImages(repo,generator,row,token,doc,selection,throughPage);
  else{const result=await generator.audio(doc.plan!.pages[step.page].caption,id,step.page);doc.audio[step.page]=result.value;generated=result;}
  if((step.kind==='plan'||step.kind==='reflection')&&doc.plan)syncRevisionImages(doc,selection);
  // Freeze the current script's redraw requirement before drawing fills its empty image slots.
  if(doc.revision&&doc.plan&&step.kind!=='image'&&step.kind!=='audio')doc.revision.actualRedraw=doc.plan.pages.length-doc.images.slice(0,doc.plan.pages.length).filter(Boolean).length;
  if(generated)doc.usage.push({step:step.key,model:generated.model,requestId:generated.requestId,usage:generated.usage,...(generated.promptRecord?{promptRecord:generated.promptRecord}:{}),...(generated.reasoningEffort?{reasoningEffort:generated.reasoningEffort}:{})});
  if((step.kind==='plan'||step.kind==='reflection')&&doc.plan&&!doc.visualReview&&(doc.reflectionCandidates||generator.review&&generator.repair))doc.visualReview=newReview();
  if((step.kind==='plan'||step.kind==='source')&&!doc.original){
   // URL-backed legacy sessions first resolve a real citation through provider URL context.
   // Save that paid directory before source lookup so a source outage cannot replay inference.
   if(doc.storyboard)await repo.saveImageProgress(row,token,structuredClone(doc));
   const result=await generator.original(selection,doc.plan||doc.draft||doc.storyboard!.outline,id);
   if(!result.source)throw new ReaderError(503,'The source could not be saved. '+result.message+' The storyboard is saved. Retry source retrieval.');
   doc.original=result.source;
  }
  if(doc.visualReview?.status==='blocked'){
   if(doc.visualReview.stopReason==='requirements')throw new ReaderError(422,'Acceptance criteria conflict or cannot be assessed. Illustration has stopped. '+(doc.visualReview.reports.at(-1)?.acceptanceResults||[]).filter(result=>result.status==='unknown').map(result=>result.evidence).join('; ')+' Edit the acceptance criteria and create a revision.');
   if(doc.visualReview.stopReason==='replan')throw new ReaderError(422,(doc.visualReview.issues.some(issue=>issue.requiresReplan&&issue.category==='continuity')?'Character continuity needs revision. Adjust the production instructions and replan.':storyReplanMessage)+' '+doc.visualReview.issues.filter(issue=>issue.requiresReplan).map(issue=>issue.problem).join('; '));
   const issues=blockedIssues(doc.visualReview),summary=issues.slice(0,3).map(issue=>`${issue.category==='reflection'?'Ending':`Frame ${issue.page}`}: ${issue.problem}`).join('; ');
   throw new ReaderError(422,`${doc.visualReview.stopReason==='unchanged'?'Revision made no substantive changes':`Review still has issues after ${readerMaxAutomaticRepairs} automatic repair rounds`}; ${issues.length} issues remain. Illustration has stopped. ${summary}. Continue revision explicitly.`);
  }
  return view(await repo.save(row,token,doc,productionComplete(doc,selection),null,progressMap));
 }catch(error){
  if(error&&typeof error==='object'&&'productionYield'in error&&error.productionYield===true){await repo.save(row,token,doc,false,null,progressMap);throw error;}
  if(error instanceof ReaderError&&error.status===404||persistenceError(error))throw error;
  const coverageFailure=!!doc.original?.imported&&error instanceof Error&&/^(?:IMPORTED_SOURCE_|EDITORIAL_SOURCE_QUOTE)/.test(error.message);
  const message=coverageFailure?'The storyboard review did not verify every section of this uploaded part. Your source and storyboard are retained, and drawing has not started. Retry the review to continue.':error instanceof ReaderError?error.message:generator.safeError(error);
  onFailed?.(coverageFailure?new ReaderError(502,message):error);return view(await repo.save(row,token,doc,false,message,progressMap));
 }
}
