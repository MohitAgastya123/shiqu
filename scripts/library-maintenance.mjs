// Expose production CLI maintenance from a source checkout without building an installer.
import {fileURLToPath} from 'node:url';
import {runCli} from '../server/cli.ts';
try{await runCli(fileURLToPath(new URL('../',import.meta.url)));}
catch(error){console.error(error.message);process.exitCode=1;}
