// Build static React assets and bundle server source while keeping packages external.
// Ship the isolated document-reader worker beside every production server entry.
import {build as buildClient} from 'vite';
import {build} from 'esbuild';
import {rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await buildClient();
await build({entryPoints:['server/index.ts','server/import-legacy.ts'],outdir:'dist/server',bundle:true,platform:'node',format:'esm',target:'node24',packages:'external',sourcemap:true});
await build({entryPoints:['server/story-import-worker.mjs'],outfile:'dist/server/story-import-worker.mjs',bundle:true,platform:'node',format:'esm',target:'node24',packages:'external'});
