// Rebuilding a concurrent Vite server must preserve the first reader's versioned React URL.
// Use the reader's default cache and a separate preview cache; never open a story library.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,rm,realpath} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createServer as createSocket} from 'node:net';
import {createServer} from 'vite';

async function freePort(){
 const socket=createSocket();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));
 const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));return port;
}

test('concurrent development optimizers retain each reader dependency URL',{timeout:30000},async t=>{
 const root=await realpath(await mkdtemp(path.join(os.tmpdir(),'shiqu-vite-cache-'))),servers=[];
 t.after(async()=>{await Promise.all(servers.map(server=>server.close()));await rm(root,{recursive:true,force:true});});
 await mkdir(path.join(root,'node_modules'));
 await writeFile(path.join(root,'package.json'),'{"type":"module"}');
 await writeFile(path.join(root,'index.html'),'<script type="module" src="/main.js"></script>');
 await writeFile(path.join(root,'main.js'),'import {createElement} from "react"; console.log(createElement("div"));');
 await symlink(path.resolve('node_modules/react'),path.join(root,'node_modules/react'),'junction');
 async function start({cacheDir,force=false}={}){
  const port=await freePort();
  const server=await createServer({configFile:false,root,cacheDir,logLevel:'silent',optimizeDeps:{include:['react'],force},server:{host:'127.0.0.1',port,strictPort:true}});
  servers.push(server);await server.listen();
  const origin=`http://127.0.0.1:${port}`,main=await fetch(origin+'/main.js');assert.equal(main.status,200);
  const source=await main.text(),dependency=source.match(/"([^"\n]*\/react\.js\?v=[^"\n]+)"/);
  assert.ok(dependency,source);
  const url=new URL(dependency[1],origin),response=await fetch(url);assert.equal(response.status,200);
  return {server,cacheDir:server.config.cacheDir,url,source:await response.text()};
 }
 const reader=await start(),other=await start({cacheDir:path.join(root,'preview-cache'),force:true});
 assert.notEqual(reader.cacheDir,other.cacheDir);
 await other.server.close();servers.splice(servers.indexOf(other.server),1);
 await rm(other.cacheDir,{recursive:true,force:true});
 const response=await fetch(reader.url);assert.equal(response.status,200);
 assert.equal(await response.text(),reader.source,'The original versioned React module must survive another optimizer and its cleanup');
});
