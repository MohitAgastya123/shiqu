// English browser controls exercise the same production workflow and preserve Chinese source fixtures.
// Run the production app behind the real development proxy with controlled inference and retained SQLite.
// UI tests mutate only through browser controls; helpers expose read-only state and model completion gates.
// Metadata-loading regressions may block service workers so controlled image routes remain interceptable.
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {createHttpServer} from '../../server/http.ts';
import {developmentAccess} from '../../server/development-access.ts';
import {developmentServerOptions,protectDevelopmentLibrary} from '../../scripts/development-server.mjs';
import {withLocalBooks} from '../../server/local-generation.ts';
import {productionFixture,until} from './production.mjs';
import {libraryFixture} from './story-library.mjs';
export const runId=process.env.SHIQU_E2E_RUN_ID||new Date().toISOString().replace(/[:.]/g,'-')+'-'+process.pid;
export const runDirectory=path.resolve('.data/e2e',runId);
async function reservePort(){const server=createHttpServer(async()=>new Response('reserved'));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;}
export async function storyBrowser(t,caseId,{serviceWorkers='allow'}={}){
 const directory=path.join(runDirectory,caseId);await mkdir(directory,{recursive:true});
 const f=await productionFixture(undefined,'codex',{}, {parentDirectory:directory,retain:true}),library=libraryFixture();
 let api,vite,browser,capture;
 t.after(async()=>{try{await capture?.();}finally{await browser?.close();await vite?.close();if(api)await new Promise(resolve=>{api.closeAllConnections();api.close(resolve);});await f.stop();}});
 f.control.autoLength=3;f.control.hold=false;
 // Translate only the two fixed source passages, preserving source IDs and complete chapter context.
 const englishPassages=[
  'A fisherman returns a stranded turtle to the water. When a flood later sweeps him away, the turtle carries the fisherman safely back to shore.',
  'A warrior confronts a mountain tiger to protect the villagers. He drives the tiger away and returns safely to the village.',
 ];
 f.control.translateSource=({text})=>{
  for(const [index,unit]of library.book.sections[0].units.entries())text=text.replaceAll(unit.text,englishPassages[index]);
  for(const [original,english]of [['篇章','Chapter'],['第一章','Chapter 1'],['测试原典','Controlled source']])text=text.replaceAll(original,english);
  assert.doesNotMatch(text,/[\p{Script=Han}]/u,'The controlled source translation must cover every supplied sentence');
  return {title:'The selected source passage',text};
 };
 f.control.beforeText=async(kind,payload)=>{
  if(kind==='recommend')return {storySummary:englishPassages[payload.chosenStory===library.stories[1].title?1:0],storyMatchReason:'The complete source describes the decisive action and its later outcome.'};
  if(kind==='review')return {issues:[],...(payload.acceptanceCriteria?.length?{acceptanceResults:payload.acceptanceCriteria.map((_,i)=>({criterion:i+1,status:'passed',pages:[1],evidence:'The controlled storyboard includes the required visible action.'}))}:{})};
 };
 f.generation.suggestions=async(...args)=>{
  const result=await library.provider.suggestions(...args),target=args[2].scan?.targetStoryTitle;
  return target?{...result,stories:library.stories.filter(story=>story.title===target&&args[2].text.includes('['+story.source.firstUnit+']')).map(({summary,...story})=>{void summary;return story;}),scan:{blockComplete:true,pendingEvents:[],resolvedEventIds:[]}}:result;
 };
 f.generation.matchStories=library.provider.matchStories;
 f.options.generation=withLocalBooks(f.generation,library.books,f.media);await f.restart();f.app.services.localBooks=library.books;
 const port=await reservePort();api=createHttpServer(developmentAccess(request=>f.app.handle(request),{SHIQU_DEV_FRONTEND_PORT:String(port)},0));
 await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
 vite=await createServer({envFile:false,cacheDir:path.join(f.root,'vite-cache'),logLevel:'error',plugins:[protectDevelopmentLibrary(f.dataDirectory)],server:developmentServerOptions({port,apiPort:api.address().port,library:f.dataDirectory})});
 await vite.listen();browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:1000},serviceWorkers});await context.tracing.start({screenshots:true,snapshots:true,sources:true});
 await context.addInitScript(()=>localStorage.setItem('shiqu-last-tab','shelf'));
 const page=await context.newPage(),url=`http://127.0.0.1:${port}`,errors=[],transitions=[],commands=[];let result='PASS',failure,closed=false;
 page.setDefaultTimeout(10000);
 page.on('pageerror',error=>errors.push(error.message));
 page.on('response',async response=>{
  if(response.request().method()==='GET'||!response.url().includes('/api/reader/'))return;
  try{commands.push({path:new URL(response.url()).pathname,method:response.request().method(),body:response.request().postDataJSON(),status:response.status()});}catch{}
 });
 const seen=new Map();let reading=false;
 async function sample(){if(reading||closed)return;reading=true;try{
  const {results}=await f.app.services.database.prepare('SELECT id,state,generation_control,document FROM stories').all();
  for(const row of results){const doc=JSON.parse(row.document),value={id:row.id,state:row.state,control:row.generation_control,intake:doc.intake?.phase,search:doc.intake?.search.state,review:doc.visualReview?.status,reviewPhase:doc.visualReview?.phase,ready:doc.images?.filter(Boolean).length||0,planned:doc.plan?.pages.length||doc.draft?.pages?.length||0};const key=JSON.stringify(value);if(seen.get(row.id)!==key){seen.set(row.id,key);transitions.push({at:new Date().toISOString(),...value});}}
 }finally{reading=false;}}
 const timer=setInterval(()=>void sample(),30);
 capture=async()=>{await sample();closed=true;clearInterval(timer);await page.screenshot({path:path.join(directory,'final.png'),fullPage:true}).catch(()=>{});await context.tracing.stop({path:path.join(directory,'trace.zip')});
  await writeFile(path.join(directory,'result.json'),JSON.stringify({caseId,result,failure,build:process.env.SHIQU_E2E_BUILD_ID||'source-folder+development',database:path.join(f.dataDirectory,'shiqu.sqlite'),url,errors,commands,transitions,calls:{catalog:library.calls.catalog.length,plans:f.control.plans.length,images:f.control.calls.length,reviews:f.control.reviews.length}},null,2));
 };
 async function execute(body){try{await body();assert.deepEqual(errors,[],'No uncaught browser errors');}catch(error){result='FAIL';failure=error.stack;throw error;}}
 async function screenshot(name){await page.screenshot({path:path.join(directory,name+'.png'),fullPage:true});}
 async function create({title,theme,prepare=true}={}){
  await page.goto(url);await page.getByRole('button',{name:"New story",exact:true}).click();
  const sheet=page.getByRole('dialog',{name:"How would you like to read this story?"});
  await sheet.getByRole('group',{name:"Choose book"}).getByRole('button',{name:"Zhuangzi",exact:true}).click();
  if(theme){await sheet.getByRole('group',{name:"Story theme"}).getByRole('button',{name:'Other',exact:true}).click();await sheet.getByLabel("Enter a theme to explore").fill(theme);}
  const creation=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/reader/sessions'&&response.request().method()==='POST');
  await sheet.getByRole('button',{name:"Find stories",exact:true}).click();const saved=await(await creation).json();
  const picker=page.getByRole('dialog',{name:"Story settings",exact:true});await picker.getByRole('button',{name:"Start discovery",exact:true}).waitFor();
  assert.equal(saved.intake.search.state,'idle');assert.equal(library.calls.catalog.length,0);
  if(!prepare)return saved;
  return extract(saved,title);
 }
 async function extract(saved,title){
  const picker=page.getByRole('dialog',{name:"Story settings",exact:true});
  if(title){await picker.getByRole('button',{name:"Enter title",exact:true}).click();await picker.getByLabel("Story title",{exact:true}).fill(title);await picker.getByRole('button',{name:"Find by title",exact:true}).click();}
  else await picker.getByRole('button',{name:"Start discovery",exact:true}).click();
  await picker.getByRole('button').filter({has:page.getByText(title||'乌龟报恩',{exact:true})}).click();
  await until(async()=>(await f.read(saved.id)).intake.phase==='confirming',15000);await page.getByRole('link',{name:"Start production",exact:true}).waitFor();return f.read(saved.id);
 }
 async function confirm(){await page.getByRole('link',{name:"Start production",exact:true}).click();}
 async function completed(id){await until(async()=>(await f.read(id)).state==='completed',20000);}
 async function reader(id){await page.goto(url+'/?id='+id);await page.getByRole('button',{name:"Story settings",exact:true}).waitFor();}
 async function workflow(){return settings();}
 async function settings(){await page.getByRole('button',{name:"Story settings",exact:true}).click();return page.getByRole('dialog',{name:"Story settings",exact:true});}
 return {f,library,page,context,url,directory,execute,screenshot,create,extract,confirm,completed,reader,settings,workflow,commands,transitions};
}
