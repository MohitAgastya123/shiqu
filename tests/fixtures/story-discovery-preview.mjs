// Loopback-only, disposable UI fixture. No .env, credentials, live providers, or production data.
import {createServer} from 'vite';
import {writeFile,rm} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createHttpServer} from '../../server/http.ts';
import {developmentServerOptions,protectDevelopmentLibrary} from '../../scripts/development-server.mjs';
import {discoveryService} from './discovery.mjs';
import {selection} from './story-library.mjs';
import {DiscoveryFailure} from '../../lib/reader-discovery-call.ts';
const service=await discoveryService(undefined,16),{f,library}=service;
const units=library.book.sections[0].units;
library.book.sections=Array.from({length:4},(_,i)=>({id:'s'+i,title:'第'+(i+1)+'章',units:units.slice(i*4,i*4+4)}));
for(const [i,story]of library.stories.entries())story.source.sectionId='s'+Math.floor(i/4);
library.book.input.text=library.book.sections.map(s=>'篇章 '+s.id+'：'+s.title+'\n'+s.units.map(u=>'['+u.id+']\n'+u.text).join('\n\n')).join('\n\n');
let release;const gate=new Promise(resolve=>release=resolve),original=library.provider.suggestions;
library.provider.suggestions=async(...args)=>{await gate;return original(...args);};
library.provider.matchStories=async(theme,input)=>{if(input.some(s=>s.title==='故事0'))throw new DiscoveryFailure('refused');return {matches:input.map(s=>({id:s.id,verdict:theme==='多章进度演示'&&s.title==='故事15'?'yes':'no',reason:'受控原文依据，非真实模型质量结果。'}))};};
const create=async theme=>(await f.json('sessions','POST',{requestId:randomUUID(),intake:true,selection:{...selection,theme,narrativeDetail:'balanced'}})).id;
const progressId=await create('多章进度演示'),unknownId=await create('无匹配演示');
const server=createHttpServer(async request=>{if(new URL(request.url).pathname==='/__test/release'){release();return Response.json({ok:true});}return f.app.handle(request);});
await new Promise(resolve=>server.listen(3142,'127.0.0.1',resolve));
const options=developmentServerOptions({port:3140,apiPort:3142,library:f.dataDirectory});options.host='127.0.0.1';options.proxy['/__test']={target:'http://127.0.0.1:3142'};
const frontend=await createServer({envFile:false,plugins:[protectDevelopmentLibrary(f.dataDirectory)],server:options});await frontend.listen();
await writeFile('/tmp/shiqu-discovery-preview.json',JSON.stringify({dataDirectory:f.dataDirectory,progressId,unknownId,readerUrl:'http://127.0.0.1:3140/',apiUrl:'http://127.0.0.1:3142/'}));
console.log('Controlled preview ready at http://127.0.0.1:3140/');
let stopping=false;async function stop(){if(stopping)return;stopping=true;release();await frontend.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await f.stop();await rm(f.root,{recursive:true,force:true});}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>void stop().then(()=>process.exit(0)));
