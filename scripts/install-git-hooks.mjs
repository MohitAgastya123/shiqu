// Enable the checkout's versioned hooks without replacing another configured hook directory.
import {execFileSync,spawnSync} from 'node:child_process';
import {chmodSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const configured=spawnSync('git',['config','--get','core.hooksPath'],{cwd:root,encoding:'utf8'});
if(configured.status!==0&&configured.status!==1)throw Error(configured.stderr||'Cannot read Git hook configuration.');
const hooks=configured.stdout.trim();
if(hooks&&hooks!=='.githooks')throw Error(`Existing core.hooksPath is ${hooks}; integrate .githooks/pre-push there before changing it.`);
chmodSync(new URL('../.githooks/pre-push',import.meta.url),0o755);
execFileSync('git',['config','--local','core.hooksPath','.githooks'],{cwd:root});
console.log('Enabled release-tag pre-push checks for this checkout.');
