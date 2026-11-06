// English product messages; source evidence and machine identifiers remain stable.
// Maintenance resolves only the library location, never provider setup or credentials, and never starts work.
import {restoreAndUpgradeLibrary} from './library-upgrade.ts';
import path from 'node:path';
import {readFileSync,writeFileSync,existsSync,lstatSync} from 'node:fs';
import {createLibraryBackup,verifyLibraryBackup,containsPath} from './library-backup.ts';
import {diagnosticReport} from './diagnostics.ts';
import {ownDesktopData} from './desktop-owner.ts';
import {savedDesktopLibraryDirectory,desktopLibraryPaths} from './library-directory.ts';
import type {CliOptions} from './cli-options.ts';

export async function maintainLibrary(root:string,options:CliOptions){
 if(!options.backup&&!options.restore&&!options.verifyBackup&&!options.diagnostics)return false;
 if(options.verifyBackup){const manifest=verifyLibraryBackup(path.resolve(options.verifyBackup));console.log(`Backup verified: ${manifest.files.length} files.`);return true;}
 const explicit=options.dataDirectory||process.env.SHIQU_DATA_DIR?.trim();
 const directory=path.resolve(explicit||savedDesktopLibraryDirectory()||desktopLibraryPaths().library);
 const output=options.backup||options.diagnostics||options.restore&&directory;
 if(output)for(const served of ['public','dist/client'])if(containsPath(path.join(root,served),path.resolve(output)))throw Error('Maintenance output cannot be saved in the app public assets directory.');
 const version=JSON.parse(readFileSync(path.join(root,'package.json'),'utf8')).version;
 if(options.restore){
  if(!options.dataDirectory)throw Error('Restoring requires --data-dir with a new directory that does not yet exist.');
  restoreAndUpgradeLibrary(path.resolve(options.restore),directory,root);console.log('Library restored to: '+directory+'; the service has not been started.');return true;
 }
 if(options.diagnostics){
  const target=path.resolve(options.diagnostics);
  if(containsPath(directory,target))throw Error('Diagnostic output must be outside the library.');
  writeFileSync(target,JSON.stringify(diagnosticReport(directory,version),null,2)+'\n',{flag:'wx',mode:0o600});console.log('Redacted diagnostics saved: '+target);return true;
 }
 if(!existsSync(directory)||!lstatSync(directory).isDirectory())throw Error('The library does not exist. No empty library was created.');
 const release=await ownDesktopData(directory);
 try{const manifest=createLibraryBackup(directory,path.resolve(options.backup!),version);console.log(`Library backup verified: ${path.resolve(options.backup!)} (${manifest.files.length} files).`);}finally{await release();}
 return true;
}
