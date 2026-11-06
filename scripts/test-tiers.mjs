// Preserve tier commands using explicit ownership metadata rather than fixture-call or import-text heuristics.
import {loadMetadata,supported} from './test-metadata.mjs';
export async function tierTests(tier,root=process.cwd()){
 if(!['unit','flows','books'].includes(tier))throw Error('Test tier must be unit, flows or books');
 return loadMetadata(root).tests.filter(entry=>entry.suite===tier&&supported(entry)).map(entry=>entry.file);
}
