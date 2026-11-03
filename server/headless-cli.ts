// Agent-facing local commands use production Requests and a dormant/scoped coordinator, never HTTP.
// stdout is a versioned JSON receipt; only explicit run can invoke generation, all writes retain API guards.
import path from 'node:path';
import os from 'node:os';
import {parseArgs} from 'node:util';
import {readFile,writeFile,stat,lstat} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {createApplication} from './app.ts';
import {ownDesktopData} from './desktop-owner.ts';
import {desktopLibraryPaths,savedDesktopLibraryDirectory} from './library-directory.ts';
import {SystemSettingsStore} from './system-settings.ts';
import {effectiveProviderVariables} from './cli-setup.ts';
import {installDiagnostics} from './diagnostics.ts';
import {diagnosticReport} from './diagnostics.ts';
import {createLibraryBackup,restoreLibraryBackup,verifyLibraryBackup,containsPath} from './library-backup.ts';
import {bundledSkill,installSkill} from './cli-skill.ts';
import {stopCodexProcesses} from './codex-runner.ts';
import {readerBooks} from '../lib/reader-books.ts';
import {artStyles,artStyleGroups} from '../lib/reader-styles.ts';
import {themes} from '../lib/content.ts';
import {emptyPublication} from '../lib/story-publication.ts';
import {selectionSchema,reviewPassed} from '../lib/reader-model.ts';
import type {ReaderProvider} from '../lib/reader-provider.ts';
import type {LocalBooks} from './local-books.ts';

const commandNames=new Set(['skill','help','init','status','catalog','books','themes','styles','stories','run','preview','export','backup','restore','verify-backup','diagnostics','config','api']);
const commands=[
 ['skill show|install','Read the bundled skill or install a copy with explicit --scope project|global.','skill install --scope project'],
 ['init','Initialize a local database without configuring providers or starting work.','init --data-dir /private/library'],
 ['status','Library integrity/counts and runtime metadata; no cloud readiness request.','status'],
 ['catalog','Books, themes and styles. books contents BOOK --query words reads local sources.','books contents zhuangzi'],
 ['stories list|get|current','Inspect saved stories and current-family versions.','stories get STORY_ID'],
 ['stories create','Save intake intent; input is a selection or {selection,intake:true,requestId}.','stories create --input selection.json --request-id UUID'],
 ['stories setup|search|choose|confirm','Persist intake actions with explicit --generation or input.generation; inference requires run.','stories choose ID --batch 0 --index 0 --generation N'],
 ['run / stories run','Run only one current story to candidates, prepared, reviewed or completed; never resumes a pause/fault implicitly.','run ID --until reviewed --timeout 900'],
 ['stories edit','Commit a revision using production token/changes validation; does not generate.','stories edit ID --input revision.json --request-id UUID'],
 ['stories pause|resume|stop|retry|override','Control or explicitly recover the current fault; input faultId is required for retry/override.','stories retry ID --input recovery.json --request-id UUID'],
 ['stories rename|delete|restore|favorite|reference','Shared library actions; reference input is {page,starred,token?}.','stories rename ID --title 新标题'],
 ['stories revisions|prompts|review-history|source','Read saved production checkpoints and history.','stories review-history ID'],
 ['stories reselect|replace|cancel-reselection','Replace a choice within the same family using production draft/generation contracts.','stories replace ID DRAFT_ID --input replacement.json'],
 ['preview','Write an offline HTML preview with escaped text and embedded saved images.','preview ID --output /private/preview.html'],
 ['export','Write json|md|zip|pdf|png using shared export rules. ZIP defaults public; internal prompts require --include-prompts.','export ID --format zip --output /private/story.zip'],
 ['backup|verify-backup|restore|diagnostics','Private verified library maintenance; restore requires an explicit new --data-dir.','backup /private/new-backup'],
 ['config get|set|reset','Shared saved settings; secret replacement only in JSON input, never argv or output.','config set --input settings.json'],
 ['api METHOD reader/ROUTE','In-process allowlisted reader persistence/inspection. Direct inference is rejected; run advances production.','api GET reader/sessions'],
].map(([name,description,example])=>({name,description,example}));
export class CliCommandError extends Error{
 readonly code:string;readonly exitCode:number;readonly details?:unknown;
 constructor(code:string,message:string,exitCode=2,details?:unknown){super(message);this.code=code;this.exitCode=exitCode;this.details=details;}
}
function need(ok:unknown,code:string,message:string):asserts ok{if(!ok)throw new CliCommandError(code,message);}
const uuid=(s:string)=>/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(s);
const inputs={
 setup:{note:'stories setup ID accepts an action; requestId defaults to a new UUID; generation is required from stories get ID. Keep both fixed for replay.',examples:[{action:'conditions',conditions:{bookId:'zhuangzi',theme:'善意与误解',productionPrompt:''}},{action:'more'},{action:'draft',settings:{artStyle:'ink-pencil',productionPrompt:'',acceptancePrompt:'',narrativeDetail:'balanced',length:'auto'}}]},
 confirm:{settings:{productionPrompt:'保留关键行动',acceptancePrompt:'人物回应落实到画面'}},
 retry:{faultId:'current fault UUID from stories get'},favorite:{saved:true},reference:{page:0,starred:true},replace:{batch:0,index:0},
 publication:{get:'api GET reader/publication-defaults',set:'api POST reader/publication-defaults --input publication.json',input:{publication:{...emptyPublication,author:'你的署名',watermarkFontSize:24},expected:'Use the exact publication object (or null) returned by GET.'}},
 frameCount:{command:'api POST reader/sessions/ID/frame-count --input count.json',input:{count:8}},
 config:{command:'config set --input settings.json',input:{settings:{provider:'codex',providerConfigured:true},expectedRevision:'from config get'},key:'For API providers only: key:{provider:"openai"|"gemini",value:"secret"|null}; never pass a key in argv.'},
};
type Context={cwd?:string;home?:string;generation?:ReaderProvider;localBooks?:LocalBooks;variables?:Record<string,string|undefined>;input?:unknown;signal?:AbortSignal};
function parse(args:string[]){return parseArgs({args,allowPositionals:true,strict:true,options:Object.fromEntries([
 ...['data-dir','input','output','format','until','timeout','title','request-id','query','batch','index','scope','generation'].map(k=>[k,{type:'string'}]),
 ...['json','help','allow-unsigned','include-prompts','no-intake'].map(k=>[k,{type:'boolean'}]),
 ]) as Record<string,{type:'string'|'boolean'}>});}
async function readInput(filename?:string){
 if(!filename)return {};
 let text='';if(filename==='-'){for await(const chunk of process.stdin){text+=chunk;if(Buffer.byteLength(text)>1048576)throw new CliCommandError('INPUT_TOO_LARGE','JSON input exceeds 1 MiB.');}}
 else{if((await stat(path.resolve(filename))).size>1048576)throw new CliCommandError('INPUT_TOO_LARGE','JSON input exceeds 1 MiB.');text=await readFile(path.resolve(filename),'utf8');}
 try{return JSON.parse(text);}catch{throw new CliCommandError('INVALID_JSON','Input must contain valid JSON.');}
}
const apiAllow=(method:string,route:string)=>{
 const base=route.split('?')[0];
 if(method==='GET')return /^(?:sessions(?:\/[a-f0-9-]{36}(?:\/(?:current|revisions|prompts|review-history|source))?)?|deletions|publication-defaults|books\/[^/]+\/contents)$/.test(base);
 if(method==='POST')return /^(?:sessions|publication-defaults|sessions\/[a-f0-9-]{36}\/(?:setup|revisions|title|publication|production-control|recover|review-override|frame-count|reselection|progress)|sessions\/[a-f0-9-]{36}\/reselection\/[a-f0-9-]{36}|library\/[^/]+\/(?:restore|favorite|reference))$/.test(base);
 return method==='DELETE'&&/^(?:library\/[^/]+|sessions\/[a-f0-9-]{36}\/reselection\/[a-f0-9-]{36})$/.test(base);
};
async function api(app:ReturnType<typeof createApplication>,method:string,route:string,input?:unknown){
 const response=await app.handle(new Request('http://shiqu.local/api/reader/'+route,{method,headers:{'Content-Type':'application/json'},...(input===undefined?{}:{body:JSON.stringify(input)})}));
 const data=await response.json();if(!response.ok)throw new CliCommandError(response.status===409?'CONFLICT':response.status===404?'NOT_FOUND':response.status===503?'PROVIDER_UNAVAILABLE':'INVALID_REQUEST',data.error||'The production action failed.',response.status>=500?4:2,{status:response.status});return data;
}
function outputOutside(root:string,filename:string){for(const served of ['public','dist/client'])need(!containsPath(path.join(root,served),filename),'PRIVATE_OUTPUT_REQUIRED','Output must be outside application static directories.');}
export async function executeHeadless(root:string,args:string[],context:Context={}){
 const {values:v,positionals:p}=parse(args);const command=p[0]||'help',action=p[1],id=p[2],value=(name:string)=>typeof v[name]==='string'?v[name] as string:undefined;
 need(commandNames.has(command),'UNKNOWN_COMMAND','Use help --json for available commands.');
 const appVersion=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version||'unknown';
 if(command==='help'||v.help)return {schemaVersion:1,appVersion,default:'No subcommand starts the existing browser service.',commands,inputs,options:{'--data-dir':'Private library, otherwise saved desktop/CLI location.','--input':'JSON file or - for stdin.','--output':'New output path; never overwrites.','--request-id':'Stable UUID for mutation replay; retain original generation/token/faultId and input.','--generation':'Required intake generation from stories get ID for setup/search/choose/confirm.','--until':'candidates|prepared|reviewed|completed (default completed).','--timeout':'Explicit run timeout in seconds, default 900, max 86400.','--allow-unsigned':'Explicitly permit an unsigned export.','--json':'Subcommands always return one JSON receipt on stdout.'},selectionExample:{bookId:'zhuangzi',theme:'原典故事',artStyle:'ink-pencil',narrativeDetail:'balanced'},editExample:{token:'from stories revisions ID',changes:{productionPrompt:'保留关键人物回应'}},runResults:['completed','candidates','prepared','choice','frame_count_required','already_prepared','already_selected','reviewed','paused','blocked','superseded'],execution:'Only explicit run performs inference. All other commands save or inspect local state.'};
 if(command==='catalog'||command==='themes'||command==='styles'||command==='books'&&action!=='contents'){
  return command==='books'?readerBooks:command==='themes'?themes:command==='styles'?artStyles.map(({prompt,...style})=>style):{books:readerBooks,themes,styles:artStyles.map(({prompt,...style})=>style),styleGroups:artStyleGroups};
 }
 if(command==='skill'){
  if(action==='show')return {appVersion,text:await bundledSkill(root)};
  const scope=value('scope');need(action==='install'&&['project','global'].includes(scope||''),'SKILL_SCOPE_REQUIRED','Use skill show or skill install --scope project|global.');
  return {appVersion,scope,...await installSkill(root,scope==='global'?context.home||os.homedir():context.cwd)};
 }
 const input=context.input??await readInput(value('input'));need(input&&typeof input==='object'&&!Array.isArray(input),'INVALID_INPUT','JSON input must be an object.');
 const supplied=(input as any).requestId||value('request-id'),requestId=supplied||randomUUID();need(uuid(requestId),'INVALID_REQUEST_ID','requestId must be a UUID.');
 const variables=context.variables||process.env,locations=desktopLibraryPaths({variables});
 if(command==='config'){
  const store=new SystemSettingsStore(locations.settings,locations.library);
  try{
   if(action==='set')store.save((input as any).settings||{},(input as any).key,(input as any).expectedRevision);
   else if(action==='reset')store.resetProviders();else need(action==='get','UNKNOWN_COMMAND','Use config get|set|reset.');
   return {settings:store.settings(),revision:store.revision(),keyPresent:{gemini:!!store.key('gemini'),openai:!!store.key('openai')}};
  }finally{store.close();}
 }
 if(command==='verify-backup'){need(action,'BACKUP_PATH_REQUIRED','Specify a backup directory.');const verified=verifyLibraryBackup(path.resolve(action));return {verified:true,files:verified.files.length,createdAt:verified.createdAt};}
 const directory=path.resolve(value('data-dir')||variables.SHIQU_DATA_DIR||savedDesktopLibraryDirectory({variables})||locations.library);
 if(command==='restore'){need(action&&value('data-dir'),'RESTORE_TARGET_REQUIRED','restore BACKUP requires explicit --data-dir NEW_DIRECTORY.');outputOutside(root,directory);const manifest=restoreLibraryBackup(path.resolve(action),directory);return {restored:true,path:directory,files:manifest.files.length,started:false};}
 if(command==='diagnostics'){
  const output=value('output')||action;need(output,'OUTPUT_REQUIRED','Specify --output NEW_FILE.');outputOutside(root,path.resolve(output));need(!containsPath(directory,path.resolve(output)),'PRIVATE_OUTPUT_REQUIRED','Diagnostic output must be outside the library.');
  await writeFile(path.resolve(output),JSON.stringify(diagnosticReport(directory,appVersion),null,2)+'\n',{flag:'wx',mode:0o600});return {path:path.resolve(output)};
 }
 if(command!=='init')need(existsSync(path.join(directory,'shiqu.sqlite')),'LIBRARY_NOT_FOUND','Library does not exist; run init --data-dir DIRECTORY.');
 const release=await ownDesktopData(directory),removeDiagnostics=installDiagnostics(directory);let app:ReturnType<typeof createApplication>|undefined;
 const running=command==='run'||command==='stories'&&action==='run',target=command==='run'?action:id;
 const until=value('until')||'completed',timeout=Number(value('timeout')||900);let timer:ReturnType<typeof setTimeout>|undefined;
 const abort=new AbortController();let timedOut=false;
 const interrupt=()=>{app?.stopGeneration();abort.abort();void stopCodexProcesses();};
 try{
  if(command==='backup'){need(action,'BACKUP_PATH_REQUIRED','Specify a new backup directory.');outputOutside(root,path.resolve(action));const manifest=createLibraryBackup(directory,path.resolve(action),appVersion);return {path:path.resolve(action),files:manifest.files.length,verified:true};}
  let effective:Record<string,string|undefined>={...variables,SHIQU_AI_PROVIDER:'readonly'};
  if(running&&!context.generation){
   if(existsSync(locations.settings)){const store=new SystemSettingsStore(locations.settings,locations.library);try{effective=effectiveProviderVariables(store,variables);}finally{store.close();}}
   else effective={...variables,SHIQU_AI_PROVIDER:variables.SHIQU_AI_PROVIDER||'readonly'};
   need(effective.SHIQU_AI_PROVIDER!=='readonly','PROVIDER_UNAVAILABLE','Configure a provider using config set, --configure or environment variables before run.');
  }
  if(running){need(target&&uuid(target),'STORY_ID_REQUIRED','run requires a story UUID.');need(['candidates','prepared','reviewed','completed'].includes(until),'INVALID_UNTIL','Use candidates|prepared|reviewed|completed.');need(Number.isFinite(timeout)&&timeout>0&&timeout<=86400,'INVALID_TIMEOUT','Timeout must be between 0 and 86400 seconds.');}
  const transport:typeof fetch=(url,options)=>fetch(url,{...options,signal:options?.signal?AbortSignal.any([options.signal,abort.signal]):abort.signal});
  app=createApplication({root,dataDirectory:directory,variables:effective,transport,generation:context.generation,commandOnly:!running,production:{autoStart:false,targetSessionId:running?target:undefined,stopBeforeImages:running&&until!=='completed'}});
  if(context.localBooks)app.services.localBooks=context.localBooks;
  if(command==='init')return {initialized:true,path:directory,started:false};
  if(command==='status')return diagnosticReport(directory,appVersion);
  if(command==='books'&&action==='contents'){need(id,'BOOK_ID_REQUIRED','Specify a book ID.');return await api(app,'GET',`books/${encodeURIComponent(id)}/contents?q=${encodeURIComponent(value('query')||'')}`);}
  if(command==='api'){
   const route=(p[2]||'').replace(/^\/?(?:api\/)?reader\//,'');need(action&&apiAllow(action.toUpperCase(),route),'EXECUTION_REQUIRED','Only allowlisted non-inference reader actions are supported; use run for generation.');
   const data={...(input as any)};if(action.toUpperCase()==='POST'&&(route==='sessions'||/\/(setup|revisions|recover|review-override|reselection|production-control)$/.test(route)))data.requestId??=requestId;
   return await api(app,action.toUpperCase(),route,['GET','HEAD'].includes(action.toUpperCase())?undefined:data);
  }
  if(command==='preview'||command==='export'){
   need(action&&uuid(action),'STORY_ID_REQUIRED','Specify a story UUID.');const output=value('output');need(output,'OUTPUT_REQUIRED','Specify --output NEW_FILE.');outputOutside(root,path.resolve(output));need(!containsPath(directory,path.resolve(output)),'PRIVATE_OUTPUT_REQUIRED','Export outside the private library.');
   const current=await api(app,'GET',`sessions/${action}/current`);need(current.id===action,'SUPERSEDED_VERSION','Export the current family version.');const session=await api(app,'GET',`sessions/${action}`);const {exportLocalStory}=await import('./story-export.ts');return await exportLocalStory(root,app,session,{output,format:value('format')||'zip',preview:command==='preview',includePrompts:!!v['include-prompts'],allowUnsigned:!!v['allow-unsigned']});
  }
  if(running){
   const status=await app.services.generation.status();need(status.configured,'PROVIDER_UNAVAILABLE',status.message||'Provider is not ready.');
   const current=await api(app,'GET',`sessions/${target}/current`);const initial=await api(app,'GET',`sessions/${target}`);need(current.id===target&&!initial.superseded,'SUPERSEDED_VERSION','Use the current family version.');
   if(initial.generationControl!=='active')return {reason:'paused',session:initial};
   if(initial.state==='failed')return {reason:'blocked',session:initial};
   const boundary=(snapshot:any)=>snapshot.state==='completed'?'completed':snapshot.awaitingFrameCount?'frame_count_required':until==='prepared'&&snapshot.intake?.phase==='confirmed'?'already_prepared':until==='prepared'&&snapshot.frameRecommendation?'prepared':until==='candidates'&&snapshot.intake?.selected?'already_selected':null;
   const reached=boundary(initial);if(reached)return {reason:reached,session:initial};
   if(until==='candidates')need(initial.intake,'BOUNDARY_UNAVAILABLE','Candidates require an intake story.');
   if(until==='prepared'&&!initial.intake)need(initial.selection.narrativeDetail&&initial.selection.length!=='auto','BOUNDARY_UNAVAILABLE','This legacy story has no preparation gate; use --until reviewed or completed.');
   process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);context.signal?.addEventListener('abort',interrupt,{once:true});
   if(context.signal?.aborted)interrupt();
   timer=setTimeout(()=>{timedOut=true;interrupt();},timeout*1000);
   const viewerId=randomUUID();app.startGeneration();let snapshot=initial;
   try{
    while(!abort.signal.aborted){
     snapshot=await app.services.production!.request(app.services.ownerId,target!,viewerId,0,false);
     const intake=snapshot.intake,doc=await app.services.database.prepare('SELECT document FROM reader_sessions WHERE id=?').bind(target).first<{document:string}>(),saved=JSON.parse(doc!.document);
     const reason=snapshot.superseded?'superseded':snapshot.state==='failed'?'blocked':snapshot.generationControl!=='active'?'paused':boundary(snapshot)|| (until==='candidates'&&intake?.batches.some((batch:any)=>batch.stories.length)?'candidates':intake?.phase==='confirming'?'prepared':intake?.phase==='choosing'&&intake.search.state!=='searching'?'choice':until==='reviewed'&&saved.plan&&reviewPassed(saved)?'reviewed':null);
     if(reason)return {reason,session:snapshot};await delay(80,undefined,{signal:abort.signal}).catch(()=>{});
    }
    throw new CliCommandError(timedOut?'TIMEOUT':'INTERRUPTED',timedOut?'Run timed out; saved checkpoints are retained.':'Run interrupted; saved checkpoints are retained.',timedOut?5:130,{session:snapshot});
   }finally{await app.services.production!.leave(app.services.ownerId,target!,viewerId);}
  }
  need(command==='stories','UNKNOWN_COMMAND','Use help --json for available commands.');
  if(action==='list')return await api(app,'GET','sessions');
  if(action==='create'){
   const data=input as any,selection=selectionSchema.parse(data.selection||data);return {requestId,session:await api(app,'POST','sessions',{requestId,selection,intake:data.intake??!v['no-intake']})};
  }
  need(id&&uuid(id),'STORY_ID_REQUIRED','Specify a story UUID.');const route=`sessions/${id}`,data={...(input as any)};
  if(['get','current','revisions','prompts','review-history','source'].includes(action))return await api(app,'GET',route+(action==='get'?'':'/'+action));
  if(action==='rename')return await api(app,'POST',route+'/title',{title:value('title')||data.title});
  if(action==='delete')return await api(app,'DELETE',`library/${id}`);
  if(['restore','favorite','reference'].includes(action))return await api(app,'POST',`library/${id}/${action}`,data);
  if(['pause','resume','stop'].includes(action))return {requestId,session:await api(app,'POST',route+'/production-control',{requestId,action})};
  if(['retry','override'].includes(action)){
   const faultId=data.faultId;
   need(faultId,'FAULT_ID_REQUIRED','Choose a current faultId from stories get.');return {requestId,session:await api(app,'POST',route+(action==='retry'?'/recover':'/review-override'),{requestId,faultId})};
  }
  if(action==='edit'){
   need(typeof data.token==='string'&&data.token,'TOKEN_REQUIRED','Read stories revisions ID and submit its token with changes.');return {requestId,session:await api(app,'POST',route+'/revisions',{requestId,token:data.token,changes:data.changes||Object.fromEntries(Object.entries(data).filter(([key])=>!['token','paused','requestId'].includes(key))),paused:data.paused??false})};
  }
  if(action==='reselect')return {requestId,session:await api(app,'POST',route+'/reselection',{requestId})};
  if(['replace','cancel-reselection'].includes(action)){need(p[3]&&uuid(p[3]),'DRAFT_ID_REQUIRED','Specify a reselection draft UUID.');return await api(app,action==='replace'?'POST':'DELETE',route+'/reselection/'+p[3],action==='replace'?{...data,requestId}:undefined);}
  if(['setup','search','choose','confirm'].includes(action)){
   const generation=data.generation??(value('generation')===undefined?undefined:Number(value('generation')));need(Number.isInteger(generation)&&generation>=0,'GENERATION_REQUIRED','Read stories get ID and retain its intake.generation for this request and replay.');
   const session=await api(app,'GET',route);const settings={artStyle:session.selection.artStyle,productionPrompt:session.selection.productionPrompt||'',acceptancePrompt:session.selection.acceptancePrompt||'',narrativeDetail:session.selection.narrativeDetail||'balanced',length:session.selection.length,...(session.intake?.draft||{})};
   const change=action==='setup'?data:action==='search'?{action:'search',title:value('title')||data.title||''}:action==='choose'?{action:'choose',batch:Number(value('batch')??data.batch??0),index:Number(value('index')??data.index??0),...(data.settings?{settings:data.settings}:{})}:{action:'confirm',settings:{...settings,...(data.settings||Object.fromEntries(Object.entries(data).filter(([key])=>!['generation','requestId'].includes(key))))}};
   return {requestId,session:await api(app,'POST',route+'/setup',{...change,requestId,generation})};
  }
  throw new CliCommandError('UNKNOWN_COMMAND','Use help --json for available commands.');
 }finally{
  if(timer)clearTimeout(timer);process.off('SIGINT',interrupt);process.off('SIGTERM',interrupt);context.signal?.removeEventListener('abort',interrupt);
  try{if(app){app.stopGeneration();abort.abort();if(running)await stopCodexProcesses();await app.close();}}finally{removeDiagnostics();await release();}
 }
}
export async function routeHeadless(root:string,args:string[]){
 if(!commandNames.has(args[0])&&!(args[0]&&!args[0].startsWith('-'))&&!(args.includes('--json')&&args.includes('--help')))return false;
 const saved={log:console.log,info:console.info,warn:console.warn};
 console.log=console.info=console.warn=(...values:unknown[])=>console.error(...values);
 try{const data=await executeHeadless(root,args[0]?.startsWith('-')?['help',...args]:args);process.stdout.write(args[0]==='skill'&&args[1]==='show'&&!args.includes('--json')?(data as {text:string}).text:JSON.stringify({schemaVersion:1,ok:true,data})+'\n');}
 catch(error){
  const known=error instanceof CliCommandError,code=known?error.code:(error as NodeJS.ErrnoException)?.code==='EEXIST'?'TARGET_EXISTS':(error as Error)?.message==='DATA_BUSY'?'LIBRARY_BUSY':(error as Error)?.name==='ZodError'?'INVALID_INPUT':'COMMAND_FAILED';
  const message=known?error.message:code==='TARGET_EXISTS'?'Output already exists.':code==='LIBRARY_BUSY'?'Stop all services using this library and retry.':code==='INVALID_INPUT'?'Input does not match the production schema.':/^(EXPORT_|BACKUP_|SKILL_)/.test((error as Error)?.message||'')?(error as Error).message:'Command failed; check paths, provider configuration and diagnostics.';
  process.stdout.write(JSON.stringify({schemaVersion:1,ok:false,error:{code,message,...(known&&error.details?{details:error.details}:{})}})+'\n');process.exitCode=known?error.exitCode:1;
 }finally{Object.assign(console,saved);}return true;
}
