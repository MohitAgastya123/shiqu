// Exercise the desktop's real Vite import pipeline without preparing resources or opening a port.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createServer} from 'vite';

test('desktop Vite transforms the shared production timeline and resolves its library imports',async t=>{
 const server=await createServer({configFile:path.resolve('desktop/vite.config.ts'),server:{middlewareMode:true,ws:false,watch:null},optimizeDeps:{noDiscovery:true,include:[]}});
 t.after(()=>server.close());
 const result=await server.transformRequest('/@fs/'+path.resolve('client/ui/ProductionTimeline.tsx'));
 assert.ok(result);
 assert.match(result.code,/\/lib\/generation-progress\.ts/);
});
