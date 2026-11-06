// Route reading, recovery and generation through the local library; source views expose saved English translations only.
// Private local uploads propose complete parts without inference; confirmed series commission ordinary jobs.
import {productionStageDurations} from './production-timing.ts';
import {publicationSchema} from './story-publication.ts';
import {draftInstructions} from './reader-generation-contract.ts';
import {outlineDirection,batchDirection} from './reader-storyboard.ts';
import {reviewSystemPrompt,repairSystemPrompt} from './reader-review.ts';
import {acceptanceInput,acceptanceDirection,acceptanceCriteria} from './reader-acceptance.ts';
import {getArtStyle} from './reader-styles.ts';
import {promptRecord} from './reader-prompt-records.ts';
import type {StoryPromptHistory} from './reader-prompt-records.ts';
import {storyReviewHistory} from './reader-review-history.ts';
import {BookImageReferences,withBookReference} from '../server/book-image-reference.ts';
import {events} from '../db/schema.ts';
import type {Services} from './services.ts';
import {z} from 'zod';
import {ReaderRepository,latestVersionMessage} from './reader-repository.ts';
import {advanceStory} from './reader-engine.ts';
import {suggestionRequestSchema} from './reader-suggestions.ts';
import {ReaderError,readableStory,selectionSchema,displayTitleSchema,view} from './reader-model.ts';
import {englishOriginal,sourceTranslationReady} from './reader-source-types.ts';
import {translateSourceCheckpoint} from './reader-source-english.ts';
import {readerMaxFrames} from './reader-limits.ts';
import type {Document,SessionView} from './reader-model.ts';
import {artRecommendationSchema} from './reader-art-recommendation.ts';
import {revisionChangesSchema} from './reader-revision.ts';
import {intakeActionSchema} from './reader-intake.ts';
import {recoveryRequestSchema} from './reader-recovery.ts';
import {bookContents} from '../server/local-book-contents.ts';
import {createIntake,changeIntake} from '../server/reader-intake.ts';
import {forkRevision,revisionSnapshot} from '../server/reader-revisions.ts';
import {openReselection,commitReselection,cancelReselection} from '../server/reader-reselection.ts';
import {replacementChoiceSchema} from './reader-reselection.ts';
import {storyImportLimits,storyImportPlanInputSchema,storySeriesCreateSchema,storySeriesControlSchema} from './story-import-contract.ts';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const uuid=z.string().uuid();
export function shelfView(session:SessionView):SessionView{
 if(!session.story)return session;
 const story={...session.story};delete story.original;story.sourceText='';
 return {...session,story};
}
async function body(req:Request,maxLength=4096){const s=await req.text();if(s.length>maxLength)throw new ReaderError(413,'The request is too long.');try{return JSON.parse(s);}catch{throw new ReaderError(400,'Invalid request format.');}}
async function importForm(req:Request){
 const maximum=storyImportLimits.fileBytes+1024*1024,reader=req.body?.getReader();if(!reader)throw new ReaderError(400,'Choose a Word or PDF file.');
 const chunks:Uint8Array[]=[];let length=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>maximum){await reader.cancel();throw new ReaderError(413,'Choose a Word or PDF file of at most 10 MB.');}chunks.push(value);}}
 finally{reader.releaseLock();}
 try{return await new Response(new Blob(chunks as BlobPart[]),{headers:{'Content-Type':req.headers.get('content-type')||''}}).formData();}
 catch{throw new ReaderError(400,'The uploaded file could not be read. Choose a Word or PDF file again.');}
}
export function createReaderApi(services:Services){
const provider=services.generation;
async function requireProvider(){if(services.commandOnly)return;const status=await provider.status();if(!status.configured)throw new ReaderError(503,status.message||'Configure a generation provider first. Open My space → Generation service and models on the computer running Shiqu.');}
return async function readerApi(req:Request,path:string[]):Promise<Response>{
 try{
  if(path.join('/')==='status'&&req.method==='GET')return json(await provider.status());
  const uid=services.ownerId;
  const url=new URL(req.url);if(req.method!=='GET'){const origin=req.headers.get('origin');if(origin&&origin!==url.origin)throw new ReaderError(403,'Cross-site requests are not allowed.');}
  if(!services.database)throw new ReaderError(503,'The bookshelf is temporarily unavailable.');
  const repo=new ReaderRepository(services.database);
  if(path[0]==='imports'){
   if(!services.series)throw new ReaderError(503,'Local story imports are temporarily unavailable.');
   if(path.length===1&&req.method==='POST'){
    const form=await importForm(req),file=form.get('file'),requestId=uuid.parse(form.get('requestId'));
    if(!file||typeof file==='string')throw new ReaderError(400,'Choose a Word or PDF file.');
    return json(await services.series.upload(uid,file.name,new Uint8Array(await file.arrayBuffer()),requestId),201);
   }
   if(path.length===2&&req.method==='GET')return json(await services.series.importedSource(uid,uuid.parse(path[1]),z.coerce.number().int().min(0).max(storyImportLimits.textCharacters).parse(url.searchParams.get('offset')||0),z.coerce.number().int().min(100).max(20000).parse(url.searchParams.get('limit')||6000)));
   if(path.length===3&&path[2]==='plan'&&req.method==='POST'){const input=storyImportPlanInputSchema.parse(await body(req,32768));return json(await services.series.plan(uid,uuid.parse(path[1]),input.title,input.settings));}
  }
  if(path[0]==='series'){
   if(!services.series)throw new ReaderError(503,'Comic series are temporarily unavailable.');
   if(path.length===1&&req.method==='GET')return json(await services.series.list(uid));
   if(path.length===1&&req.method==='POST'){await requireProvider();const input=storySeriesCreateSchema.parse(await body(req,32768)),created=await services.series.create(uid,input);services.production?.wake();return json(created,201);}
   if(path.length===2&&req.method==='GET')return json(await services.series.get(uid,uuid.parse(path[1])));
   if(path.length===3&&path[2]==='control'&&req.method==='POST'){const input=storySeriesControlSchema.parse(await body(req));if(input.action==='resume')await requireProvider();const saved=await services.series.control(uid,uuid.parse(path[1]),input);services.production?.wake();return json(saved);}
  }
  if(path.join('/')==='publication-defaults'){
   if(req.method==='GET')return json({publication:await repo.publicationDefaults(uid)});
   if(req.method==='POST'){
    const parsed=z.object({publication:publicationSchema,expected:publicationSchema.nullable()}).strict().safeParse(await body(req,32768));
    if(!parsed.success)throw new ReaderError(400,parsed.error.issues[0].message);
    return json({publication:await repo.savePublicationDefaults(uid,parsed.data.publication,parsed.data.expected)});
   }
  }
  if(path.join('/')==='deletions'&&req.method==='GET')return json(new URL(req.url).searchParams.get('inventory')==='1'?{deletions:await repo.deletions(uid),currentStoryIds:await repo.currentStoryIds(uid),complete:true}:await repo.deletions(uid));
  if(path[0]==='library'&&path.length===2&&req.method==='DELETE'){const id=z.string().min(1).max(100).parse(path[1]);return json(await repo.remove(id,uid));}
  if(path[0]==='library'&&path.length===3&&path[2]==='restore'&&req.method==='POST'){const id=z.string().min(1).max(100).parse(path[1]);return json(await repo.restore(id,uid));}
  if(path[0]==='library'&&path.length===3&&path[2]==='reference'){
   const id=z.string().min(1).max(100).parse(path[1]),references=new BookImageReferences(services.database,services.media,uid);
   if(req.method==='GET')return json(await references.get(id));
   if(req.method==='POST'){const data=z.object({page:z.number().int().min(0).max(readerMaxFrames-1),starred:z.boolean(),token:uuid.optional()}).strict().parse(await body(req));return json(await references.set(id,data.page,data.starred,data.token));}
  }
  if(path[0]==='library'&&path.length===3&&path[2]==='favorite'&&req.method==='POST'){const id=z.string().min(1).max(100).parse(path[1]);const b=z.object({saved:z.boolean()}).strict().parse(await body(req));return json(await repo.favorite(id,uid,b.saved));}
  if(path[0]==='books'&&path.length===3&&path[2]==='contents'&&req.method==='GET'){
   if(!services.localBooks)throw new ReaderError(503,'The local library is temporarily unavailable.');
   const query=z.string().max(200).parse(url.searchParams.get('q')||'');
   return json(await bookContents(services.localBooks,selectionSchema.parse({bookId:path[1],theme:'目录'}),query));
  }
  if(path.join('/')==='suggestions'&&req.method==='POST'){
   await requireProvider();
   const {excludeTitles,excludeSources,...selection}=suggestionRequestSchema.parse(await body(req,1048576));
   if(req.headers.get('accept')==='application/x-ndjson'){
    const abort=new AbortController(),encoder=new TextEncoder();
    const stream=new ReadableStream<Uint8Array>({
     start(controller){
      const send=(event:unknown)=>{if(!abort.signal.aborted)controller.enqueue(encoder.encode(JSON.stringify(event)+'\n'));};
      send({type:'progress',progress:{completed:0,total:1,completedChars:0,totalChars:0,stage:'reading'}});
      void provider.suggestions(selection,excludeTitles,undefined,{signal:abort.signal,onProgress:progress=>send({type:'progress',progress})},excludeSources)
       .then(batch=>send({type:'result',batch}))
       .catch(error=>{if(!abort.signal.aborted)send({type:'error',error:error instanceof ReaderError?error.message:provider.safeError(error)});})
       .finally(()=>{if(!abort.signal.aborted)controller.close();});
     },
     cancel(){abort.abort();},
    });
    return new Response(stream,{headers:{'Content-Type':'application/x-ndjson','Cache-Control':'private, no-store','X-Accel-Buffering':'no'}});
   }
   try{return json(await provider.suggestions(selection,excludeTitles,undefined,undefined,excludeSources));}catch(error){if(error instanceof ReaderError)throw error;throw new ReaderError(502,provider.safeError(error));}
  }
  if(path.join('/')==='art-recommendation'&&req.method==='POST'){
   await requireProvider();
   const selection=selectionSchema.parse(await body(req,32768));
   if(!selection.source||!selection.storyTitle)throw new ReaderError(400,'Select a story with a verified source first.');
   if(!provider.recommendArt)throw new ReaderError(503,'Style recommendations are unavailable. You can select a style manually.');
   try{return json(artRecommendationSchema.parse(await provider.recommendArt(selection)));}catch(error){if(error instanceof ReaderError)throw error;throw new ReaderError(502,provider.safeError(error));}
  }
  if(path[0]==='sessions'&&path.length===1){
   // One unreadable saved story must not take the whole shelf down with it.
   if(req.method==='GET'){
    const rows=(await repo.list(uid)).filter(readableStory),completed=rows.filter(row=>row.state==='completed').map(row=>row.id);
    // Load completed timing in one owner-scoped read; shelf visits never inspect media or start work.
    const timings=completed.length?(await repo.db.prepare("SELECT session_id,kind,payload FROM production_jobs WHERE owner_id=? AND session_id IN (SELECT value FROM json_each(?)) AND json_type(CASE WHEN json_valid(payload) THEN payload ELSE '{}' END,'$.timings')='array'").bind(uid,JSON.stringify(completed)).all<{session_id:string;kind:string;payload:string}>()).results:[];
    const bySession=new Map<string,typeof timings>();
    for(const timing of timings){const group=bySession.get(timing.session_id)||[];group.push(timing);bySession.set(timing.session_id,group);}
    return json(await Promise.all(rows.map(async row=>{
     const session=services.production&&row.state!=='completed'?await services.production.snapshot(uid,row.id):services.series?await services.series.decorate(view(row),row):view(row);
     if(row.state==='completed')session.generationProgress={...session.generationProgress!,stageDurations:productionStageDurations(bySession.get(row.id)||[],session.selection)};
     return shelfView(session);
    })));
   }
   if(req.method==='POST'){await requireProvider();const b=z.object({requestId:uuid,selection:selectionSchema.omit({displayTitle:true}),intake:z.boolean().optional()}).parse(await body(req,32768));if((b.selection.discoverySources||b.selection.discovery?.mode==='title')&&b.intake!==true)throw new ReaderError(400,'Start chapter or title extraction through story discovery.');return json(view(b.intake?await createIntake(repo,b.requestId,uid,b.selection,services.localBooks):await repo.create(b.requestId,uid,b.selection)),201);}
  }
  if(path[0]==='sessions'&&path[1]){
   const id=uuid.parse(path[1]);
   if(path[2]==='review-history'&&path.length===3&&req.method==='GET')return json(storyReviewHistory(await repo.get(id,uid)));
   if(path[2]==='prompts'&&path.length===3&&req.method==='GET'){
    const row=await repo.get(id,uid),doc=JSON.parse(row.document) as Document,selection=selectionSchema.parse(JSON.parse(row.selection));
    const preferences={productionPrompt:selection.productionPrompt,...acceptanceInput(selection),artDirection:getArtStyle(selection.artStyle).prompt,narrativeDetail:selection.narrativeDetail||'balanced',exactPageCount:selection.length};
    const history:StoryPromptHistory={
     productionPrompt:selection.productionPrompt,acceptancePrompt:selection.acceptancePrompt||'',
     records:(doc.usage||[]).flatMap((item,index)=>item.promptRecord?[{step:item.step,model:item.model,originId:item.originId||id,index,record:item.promptRecord}]:[]),
     missingRecords:(doc.usage||[]).flatMap((item,index)=>item.promptRecord?[]:[{step:item.step,model:item.model,originId:item.originId||id,index}]),
    };
    return json({...history,criteria:acceptanceCriteria(selection.acceptancePrompt),results:doc.visualReview?.reports.at(-1)?.acceptanceResults||[],overridden:!!doc.visualReview?.overridden,previews:{production:promptRecord(draftInstructions(!!doc.original?.localSource)+'\n\n## Outline stage\n'+outlineDirection+'\n\n## Storyboard batches\n'+batchDirection,preferences),acceptance:promptRecord(reviewSystemPrompt+'\n\n'+acceptanceDirection+'\n\n## Targeted revision\n'+repairSystemPrompt,preferences)}});
   }
   if(path[2]==='publication'&&path.length===3&&req.method==='POST'){
    const parsed=z.object({publication:publicationSchema,expected:publicationSchema.nullable()}).strict().safeParse(await body(req,32768));
    if(!parsed.success)throw new ReaderError(400,parsed.error.issues[0].message);
    return json(view(await repo.savePublication(id,uid,parsed.data.publication,parsed.data.expected)));
   }
   if(path[2]==='title'&&path.length===3&&req.method==='POST'){
    const parsed=z.object({title:displayTitleSchema}).strict().safeParse(await body(req));
    if(!parsed.success)throw new ReaderError(400,parsed.error.issues[0].message);
    return json(view(await repo.rename(id,uid,parsed.data.title)));
   }
   if(path.length===2&&req.method==='GET'){const row=await repo.get(id,uid);return json(services.production?await services.production.snapshot(uid,id):services.series?await services.series.decorate(view(row),row):view(row));}
   if(path[2]==='current'&&path.length===3&&req.method==='GET'){
    const row=await repo.current(id,uid);return json(services.production?await services.production.snapshot(uid,row.id):view(row));
   }
   if(path[2]==='reselection'&&path.length===3&&req.method==='POST'){
    await requireProvider();const b=z.object({requestId:uuid}).strict().parse(await body(req));
    return json(view(await openReselection(repo,id,uid,b.requestId,services.localBooks)),201);
   }
   if(path[2]==='reselection'&&path[3]&&path.length===4){
    const draftId=uuid.parse(path[3]);
    if(req.method==='POST'){
     await requireProvider();const command=replacementChoiceSchema.parse(await body(req,32768));
     const row=await commitReselection(repo,id,draftId,uid,command);services.production?.wake();
     return json(services.production?await services.production.snapshot(uid,row.id):view(row));
    }
    if(req.method==='DELETE'){
     const row=await cancelReselection(repo,id,draftId,uid);return json(view(row));
    }
   }
   if(path[2]==='recover'&&path.length===3&&req.method==='POST'){
    if(!services.production)throw new ReaderError(503,'The production queue is temporarily unavailable.');
    const command=recoveryRequestSchema.parse(await body(req));await requireProvider();
    return json(await services.production.recover(uid,id,command),202);
   }
   if(path[2]==='image-health'&&path.length===3&&req.method==='POST'){
    if(!services.production)throw new ReaderError(503,'The production queue is temporarily unavailable.');
    const b=z.object({page:z.number().int().min(0).max(readerMaxFrames-1),image:z.string().min(1).max(1024)}).strict().parse(await body(req));
    return json(await services.production.checkImage(uid,id,b.page,b.image));
   }
   if(path[2]==='setup'&&path.length===3&&req.method==='POST'){await requireProvider();const action=intakeActionSchema.parse(await body(req,32768));await changeIntake(repo,id,uid,action,services.localBooks);return json(services.production?await services.production.snapshot(uid,id):view(await repo.get(id,uid)));}
   if(path[2]==='revisions'&&path.length===3){
    await services.series?.requireStarted(uid,id);
    if(req.method==='GET')return json(await revisionSnapshot(repo,id,uid));
    if(req.method==='POST'){
     await requireProvider();
     if(!services.production)throw new ReaderError(503,'The production queue is temporarily unavailable.');
     const b=z.object({requestId:uuid,token:z.string().regex(/^[a-f0-9]{64}$/),changes:revisionChangesSchema,paused:z.boolean().default(false)}).strict().parse(await body(req,262144));
     const row=await forkRevision(repo,services.media,uid,id,b.requestId,b.token,b.changes,b.paused);
     const doc=JSON.parse(row.document) as Document;
     if(!b.paused&&!doc.revision?.handoff)services.production.wake();
     return json(doc.revision?.handoff?await services.production.control(uid,row.id,b.paused?'pause':'resume',true):await services.production.snapshot(uid,row.id),201);
    }
   }
   if(path[2]==='review-override'&&path.length===3&&req.method==='POST'){
    if(!services.production)throw new ReaderError(503,'The production queue is temporarily unavailable.');
    const command=recoveryRequestSchema.parse(await body(req));
    await requireProvider();
    return json(await services.production.overrideReview(uid,id,command));
   }
   if(path[2]==='production-control'&&path.length===3&&req.method==='POST'){
    if(!services.production)throw new ReaderError(503,'The production queue is temporarily unavailable.');
    const b=z.object({requestId:uuid,action:z.enum(['background','reader','pause','stop','resume'])}).strict().parse(await body(req));
    if(b.action==='background'||b.action==='resume')await requireProvider();
    return json(await services.production.control(uid,id,b.action,false,b.requestId));
   }
   if(path[2]==='production'&&path.length===3){
    if(!services.production)throw new ReaderError(503,'The production queue is temporarily unavailable.');
    if(req.method==='POST'){
     await requireProvider();const b=z.object({viewerId:uuid,page:z.number().int().min(0).max(readerMaxFrames-1),retry:z.boolean().default(false)}).strict().parse(await body(req));
     if(b.retry)throw new ReaderError(400,'Use recovery with the current fault and request identifiers to retry.');
     return json(await services.production.request(uid,id,b.viewerId,b.page,b.retry),202);
    }
    if(req.method==='DELETE'){
     const b=z.object({viewerId:uuid}).strict().parse(await body(req));await services.production.leave(uid,id,b.viewerId);return json({ok:true});
    }
   }
   if(path[2]==='source'&&path.length===3&&['GET','POST'].includes(req.method)){
    if(req.method==='POST'){await services.series?.requireStarted(uid,id);if(services.series&&!await services.series.eligible({id,user_id:uid}))throw new ReaderError(409,'Resume the comic series before preparing this part.');}
    const row=await repo.get(id,uid),selection=selectionSchema.parse(JSON.parse(row.selection)),doc=JSON.parse(row.document) as Document;
    if(doc.original){
     const source=englishOriginal(doc.original);
     if(source)return json({source,message:'',searchUrl:doc.original.url});
     if(req.method==='GET')return json({source:null,message:'Prepare an English source translation to read this passage. Translation uses your configured text provider.',searchUrl:doc.original.url});
    }
    if(req.method==='GET')return json({source:null,message:'The source has not been prepared in English yet. Prepare this story to continue.',searchUrl:doc.original?.url||''});
    await requireProvider();
    if(await repo.superseded(id,uid))throw new ReaderError(409,latestVersionMessage);
    if(row.state==='running')throw new ReaderError(409,'Production is running. Wait before translating the source.');
    const generator=provider.generator();
    const controls=async()=>Number((await repo.db.prepare("SELECT COUNT(*) AS n FROM reader_commands WHERE session_id=? AND owner_id=? AND action='control'").bind(id,uid).first<{n:number}>())?.n||0);
    const initialControls=await controls();
    const token=await repo.acquire(row,{kind:'source',page:0,key:'source:english'},true);
    if(!token)throw new ReaderError(409,'Source preparation is already running. Reload this story to see its progress.');
    // Source conversion shares the production lock and checkpoints, including paid-call provenance.
    const heartbeat=setInterval(()=>{void repo.db.prepare("UPDATE stories SET lock_until=? WHERE id=? AND user_id=? AND state='running' AND lock_token=?").bind(Date.now()+180000,id,uid,token).run().catch(()=>{});},30000);
    heartbeat.unref();
    const hadSavedOriginal=!!doc.original;
    let translationError:unknown;
    try{
     if(!doc.original){
      if(!doc.plan)throw new ReaderError(409,'Prepare the story source before translating it.');
      const result=await generator.original(selection,doc.plan,id);
      if(!result.source)throw new ReaderError(503,result.message||'The source could not be retrieved.');
      doc.original=result.source;await repo.saveImageProgress(row,token,structuredClone(doc));
     }
     if(hadSavedOriginal&&doc.original.localSource&&!selection.source){
      if(!doc.plan)throw new ReaderError(409,'Select a verified source before preparing its English translation.');
      const verified=await generator.original(selection,doc.plan,id);
      if(!verified.source||verified.source.text!==doc.original.text||JSON.stringify(verified.source.chapterContext||null)!==JSON.stringify(doc.original.chapterContext||null))throw new ReaderError(409,'The saved source could not be verified against its edition. Prepare a new story version.');
      generator.validateOriginal?.({...selection,source:doc.original.localSource},doc.original);
     }else if(hadSavedOriginal||selection.source)generator.validateOriginal?.(selection,doc.original);
     while(!sourceTranslationReady(doc.original)){
      const current=await repo.get(id,uid);
      if(current.generation_control!==row.generation_control||await controls()!==initialControls||await repo.superseded(id,uid))throw new ReaderError(409,'Source translation stopped because story controls or the current version changed. Saved translation progress is retained.');
      const translated=await translateSourceCheckpoint(doc.original,generator);
      if(translated)doc.usage.push({step:'source-translation',model:translated.model,requestId:translated.requestId,usage:translated.usage,...(translated.reasoningEffort?{reasoningEffort:translated.reasoningEffort}:{})});
      await repo.saveImageProgress(row,token,structuredClone(doc));
     }
    }catch(error){translationError=error;}finally{clearInterval(heartbeat);}
    // A failed persistence operation must propagate as persistence, never a provider failure.
    await repo.save(row,token,doc,row.state==='completed',row.error);
    if(translationError){if(translationError instanceof ReaderError)throw translationError;throw new ReaderError(502,provider.safeError(translationError));}
    return json({source:englishOriginal(doc.original),message:'',searchUrl:doc.original?.url||''});

   }
   if(path[2]==='events'&&req.method==='POST'){const row=await repo.get(id,uid);const b=z.object({id:z.string().max(200),visitor:uuid,session:uuid,storyId:uuid,kind:z.enum(['start','page','complete','next','save','audio','feedback_positive','feedback_negative']),page:z.number().int().min(0).max(readerMaxFrames-1).nullable(),mode:z.enum(['manual','audio']),cohort:z.enum(['internal','pilot'])}).parse(await body(req));const current=view(row);if(b.storyId!==id||(b.page!==null&&!current.story?.pages[b.page]?.image))throw new ReaderError(400,'This frame is not ready yet.');await services.db.insert(events).values({...b,createdAt:new Date().toISOString()}).onConflictDoNothing();return json({ok:true});}
   if(path[2]==='progress'&&req.method==='POST'){const b=z.object({page:z.number().int().min(0).max(readerMaxFrames-1),saved:z.boolean()}).parse(await body(req));return json(view(await repo.progress(id,uid,b.page,b.saved)));}
   if(path[2]==='frame-count'&&path.length===3&&req.method==='POST'){const b=z.object({count:z.union([z.number().int().min(1).max(readerMaxFrames),z.literal('auto')])}).strict().parse(await body(req));return json(view(await repo.confirmFrameCount(id,uid,b.count)));}
   if(path[2]==='advance'&&req.method==='POST'){await requireProvider();const b=z.object({throughPage:z.number().int().min(0).max(readerMaxFrames-1),retry:z.boolean().default(false)}).parse(await body(req));if(b.retry)throw new ReaderError(400,'Use recovery with the current fault and request identifiers to retry.');const result=services.production?await services.production.advance(uid,id,b.throughPage,false):await advanceStory(repo,withBookReference(provider.generator(),new BookImageReferences(services.database,services.media,uid)),uid,id,b.throughPage,false);return json(result,result.state==='running'?202:200);}
  }
  if(path[0]==='media'&&path[1]&&path[2]&&path.length===3&&req.method==='GET'){
   const id=uuid.parse(path[1]);await repo.get(id,uid);const file=/^(0|[1-9][0-9]?)\.(png|jpg|webp|wav)$/.exec(path[2]);if(!file||Number(file[1])>=readerMaxFrames)throw new ReaderError(404,'Frame not found.');const object=await services.media?.get(`reader/${id}/${path[2]}`);if(!object)throw new ReaderError(404,'This frame has not been generated yet.');const headers=new Headers({'Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff'});headers.set('Content-Type',object.contentType);return new Response(object.body,{headers});
  }
  if(path[0]==='media'&&path[1]&&path[2]==='artifacts'&&path.length===4&&req.method==='GET'){
   const id=uuid.parse(path[1]);await repo.get(id,uid);
   const file=/^(0|[1-9][0-9]?)-[a-f0-9]{64}\.(png|jpg|webp)$/.exec(path[3]);
   if(!file||Number(file[1])>=readerMaxFrames)throw new ReaderError(404,'Frame not found.');
   const asset=await services.media?.get(`reader/${id}/artifacts/${path[3]}`);if(!asset)throw new ReaderError(404,'This frame has not been generated yet.');
   return new Response(asset.body,{headers:{'Cache-Control':'private, max-age=31536000, immutable','X-Content-Type-Options':'nosniff','Content-Type':asset.contentType}});
  }
  throw new ReaderError(404,'Story endpoint not found.');
 }catch(error){if(error instanceof Error&&error.message.includes('reader_request_id_conflict'))return json({error:'This request identifier has already been used for another operation. Try again.'},409);if(error instanceof ReaderError)return json({error:error.message},error.status);if(error instanceof z.ZodError)return json({error:'Select a valid book, theme and page count.'},400);return json({error:'The story cannot be opened right now. Please try again.'},500);}
}

}
