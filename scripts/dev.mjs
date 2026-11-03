// Run Vite and the watched REST server together; local mode always uses a checkout-owned shelf.
import {createServer} from 'vite';
import {context} from 'esbuild';
import {spawn} from 'node:child_process';
import {printPhoneAccess,phoneUrls} from '../server/phone-access.ts';
import {developmentLibraryDirectory} from '../server/library-directory.ts';
import {developmentArguments,developmentServerOptions,protectDevelopmentLibrary} from './development-server.mjs';
try{process.loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}
const {port,apiPort,library}=developmentArguments(process.argv.slice(2));
process.env.SHIQU_DATA_DIR=library||developmentLibraryDirectory();
const build=await context({entryPoints:['server/index.ts'],outfile:'dist/dev/server.js',bundle:true,platform:'node',format:'esm',target:'node24',packages:'external',sourcemap:true});
let stopping=false,backend,frontend;
async function stop(code=0){if(stopping)return;stopping=true;backend?.kill('SIGTERM');await Promise.all([frontend?.close(),build.dispose()]);process.exitCode=code;}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>void stop());
try{
 await build.rebuild();await build.watch();
 frontend=await createServer({plugins:[protectDevelopmentLibrary(process.env.SHIQU_DATA_DIR)],server:developmentServerOptions({port,apiPort,library:process.env.SHIQU_DATA_DIR})});
 await frontend.listen();if(stopping)throw Error('Development startup stopped');
 // Validate public paths and bind the frontend before opening the shared database in a child.
 backend=spawn(process.execPath,['--env-file-if-exists=.env','--watch','dist/dev/server.js'],{stdio:'inherit',env:{...process.env,PORT:String(apiPort),SHIQU_BIND_IP:'127.0.0.1',SHIQU_DEV_FRONTEND_PORT:String(port)}});
 backend.on('exit',code=>{if(!stopping)void stop(code||1);});
 frontend.printUrls();
 console.log(`拾趣开发版：http://127.0.0.1:${port}`);
 printPhoneAccess(phoneUrls('0.0.0.0',port));
}catch(error){await stop(1);throw error;}
