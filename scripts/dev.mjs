// English product messages; source evidence and machine identifiers remain stable.
// Run Vite and the watched REST server with shared saved settings; local owns its checkout shelf.
// Provider credentials are resolved only by the backend, never loaded from project .env into Vite.
// Close each frontend before removing its unique optimizer cache; failed competing launches stay isolated.
import {createServer} from 'vite';
import {context} from 'esbuild';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {printPhoneAccess,phoneUrls} from '../server/phone-access.ts';
import {developmentLibraryDirectory} from '../server/library-directory.ts';
import {createDevelopmentCache,developmentArguments,developmentServerOptions,protectDevelopmentLibrary,protectLocalProviderSettings} from './development-server.mjs';
const {port,apiPort,library}=developmentArguments(process.argv.slice(2));
const settingsProxyToken=randomUUID();
process.env.SHIQU_DATA_DIR=library||developmentLibraryDirectory();
const build=await context({entryPoints:['server/development.ts'],outfile:'dist/dev/server.js',bundle:true,platform:'node',format:'esm',target:'node24',packages:'external',sourcemap:true});
let stopping=false,backend,frontend,cache,cachePending,frontendPending,listenPending,cleanup;
function stop(code=0){
 if(stopping)return cleanup;stopping=true;
 cleanup=(async()=>{
  backend?.kill('SIGTERM');
  // A signal may arrive before an async factory publishes its resource. Settle it before closing/removing.
  await Promise.allSettled([cachePending,frontendPending,listenPending]);
  const [closed,disposed]=await Promise.allSettled([frontend?.close(),build.dispose()]);
  const failures=[closed,disposed].filter(result=>result.status==='rejected').map(result=>result.reason);
  if(closed.status==='fulfilled')try{await cache?.remove();}catch(error){failures.push(error);}
  for(const error of failures)console.error('Development cleanup failed; any unclosed frontend cache was preserved.',error);
  process.exitCode=failures.length?1:code;
 })();return cleanup;
}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>void stop());
async function start(){
 await build.rebuild();if(stopping)return;await build.watch();if(stopping)return;
 cachePending=createDevelopmentCache().then(value=>(cache=value));await cachePending;if(stopping)return;
 frontendPending=createServer({cacheDir:cache.directory,plugins:[protectLocalProviderSettings(settingsProxyToken),protectDevelopmentLibrary(process.env.SHIQU_DATA_DIR)],server:developmentServerOptions({port,apiPort,library:process.env.SHIQU_DATA_DIR})}).then(value=>(frontend=value));await frontendPending;if(stopping)return;
 listenPending=frontend.listen();await listenPending;if(stopping)return;
 // Validate public paths and bind the frontend before opening the shared database in a child.
 backend=spawn(process.execPath,['--watch','dist/dev/server.js'],{stdio:'inherit',env:{...process.env,PORT:String(apiPort),SHIQU_BIND_IP:'127.0.0.1',SHIQU_DEV_FRONTEND_PORT:String(port),SHIQU_LOCAL_SETTINGS_PROXY_TOKEN:settingsProxyToken}});
 backend.on('exit',code=>{if(!stopping)void stop(code||1);});
 frontend.printUrls();
 console.log(`Shiqu development: http://127.0.0.1:${port}`);
 printPhoneAccess(phoneUrls('0.0.0.0',port));
}
try{await start();}catch(error){const interrupted=stopping;await stop(1);if(!interrupted)throw error;}
