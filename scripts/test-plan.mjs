// Union affected responsibilities; unknown/shared/toolchain changes select full coverage and each file runs once.
import {loadMetadata,groups,supported} from './test-metadata.mjs';
export function fullScope(reason='unknown impact'){
 return {code:true,books:true,native:true,full:true,groups:[...groups],reasons:[reason]};
}
const rules=[
 [/^(?:client|public)\//,['reader']],
 [/^desktop\//,['desktop']],
 [/^src-tauri\//,['desktop'],true],
 [/^(?:db|drizzle)\//,null,true],
 [/^data\/library\//,['books','discovery']],
 [/^skills\//,['tooling','startup']],
 [/^server\/(?:system-settings|cli-options|cli-setup|config|browser-provider-settings)\.ts$/,['startup','providers','desktop'],true],
 [/^lib\/(?:system-settings|provider-settings)\.ts$/,['startup','providers','desktop'],true],
 [/^server\/(?:cli|start|index|headless-cli)\.ts$/,['startup','production','tooling']],
 [/^server\/(?:desktop|desktop-access|desktop-owner|desktop-remote|desktop-tunnel|phone-access)\.ts$/,['desktop']],
 [/^server\/(?:development|development-access|cli-skill)\.ts$/,['tooling','startup']],
 [/^server\/(?:database|database-migrations|library-schema)\.ts$/,null,true],
 [/^server\/(?:library-backup|library-directory|library-maintenance|library-upgrade|import-legacy|diagnostics)\.ts$/,['storage','startup'],true],
 [/^server\/(?:app|http|media)\.ts$/,['storage','production','reader','media']],
 [/^server\/(?:local-books|local-book-[\w-]+|local-source-[\w-]+|story-reading-inputs)\.ts$/,['books','discovery']],
 [/^server\/(?:local-story-discovery|story-discovery-[\w-]+|story-theme-matching|story-token-budget)\.ts$/,['discovery']],
 [/^server\/local-generation\.ts$/,['books','providers','discovery','preparation','review','production','media']],
 [/^server\/(?:generation|provider-runtime)\.ts$/,['providers','discovery','preparation','review','production','media']],
 [/^server\/(?:codex-runner|claude-runner|openai-provider)\.ts$/,['providers']],
 [/^server\/(?:production-queue|reader-commands|reader-production|reader-reselection|reader-revisions|reader-input-migration|story-summary-migration)\.ts$/,['production','storage']],
 [/^server\/reader-intake\.ts$/,['preparation','discovery']],
 [/^server\/(?:reader-image-health|story-export|book-image-reference)\.ts$/,['media','review']],
 [/^server\/reader-copy\.ts$/,['reader','production']],
 [/^lib\/(?:reader-model|reader-api|reader-generation-contract|reader-local-contract|reader-source-types|reader-prompts|reader-legacy-prompts|services|server)\.ts$/,null,true],
 [/^lib\/(?:reader-provider|reader-gemini[\w-]*|reader-responses-diagnostics|reader-reasoning|codex-settings)\.ts$/,['providers']],
 [/^lib\/(?:reader-limits|reader-engine|reader-generation)\.ts$/,['providers','preparation','review','production','discovery']],
 [/^lib\/(?:reader-source[\w-]*|reader-verified-passages|reader-books|reader-contents|reader-legacy-catalog|reader-discovery-call|reader-suggestion-request|reader-suggestions|reader-theme-match)\.ts$|^lib\/reader-discovery-v1\.json$/,['books','discovery']],
 [/^lib\/(?:reader-intake|reader-story-brief|reader-requirements|reader-editorial|reader-art-recommendation)\.ts$/,['preparation']],
 [/^lib\/(?:reader-acceptance|reader-frame-recommendation|reader-review[\w-]*|reader-storyboard|reader-structure)\.ts$/,['review']],
 [/^lib\/(?:reader-repository|reader-recovery|reader-production|reader-reselection|reader-revision[\w-]*|reader-versions|production-[\w-]+|generation-progress)\.ts$/,['production','storage']],
 [/^lib\/(?:reader-image[\w-]*|reader-png|reader-pdf|reader-zip[\w-]*|story-export-runtime|story-publication|story-watermark|story-webp-metadata)\.ts$|^lib\/public-story-zip\.mjs$/,['media']],
 [/^lib\/(?:reader-production-client|shelf-generation)\.ts$/,['reader','production','discovery','preparation']],
 [/^lib\/(?:reader-home|reader-navigation|reader-production-client|reader-request|reader-snapshots|reader-styles|reader-prompt-format|reader-prompt-records|reader-random-id|shelf-[\w-]+|content|utils)\.ts$/,['reader']],
 // Scope known independent tools by responsibility; test/build infrastructure and unknown scripts retain full coverage.
 [/^scripts\/export-story\.mjs$/,['media','tooling']],
 [/^scripts\/(?:desktop-node|desktop-resources|desktop-smoke)\.mjs$/,['desktop'],true],
 [/^scripts\/eval-story-discovery\.mjs$/,['discovery']],
];
function documentation(file){
 if(/^(?:data|tests|scripts|server|lib|skills|db|drizzle)\//.test(file))return false;
 return /\.md$|^\.docs\/|^(?:LICENSE|NOTICE)$/.test(file);
}
export function changeScope(files,metadata=loadMetadata()){
 if(!files.length)return fullScope('empty comparison');
 const selected=new Set(),reasons=[];let code=false,native=false;
 for(const file of files){
  if(typeof file!=='string'||file.includes('\\')||file.startsWith('/')||file.split('/').includes('..'))return fullScope('invalid path');
  if(documentation(file))continue;
  code=true;
  const test=metadata.tests.find(entry=>entry.file===file);
  if(test){test.groups.forEach(group=>selected.add(group));native||=test.level==='native';reasons.push(file);continue;}
  const rule=rules.find(([pattern])=>pattern.test(file));
  if(!rule||!rule[1])return fullScope(file);
  rule[1].forEach(group=>selected.add(group));native||=Boolean(rule[2]);
  for(const consumer of metadata.tests.filter(entry=>entry.covers.includes(file))){consumer.groups.forEach(group=>selected.add(group));native||=consumer.level==='native';}
  reasons.push(file);
 }
 return {code,books:selected.has('books'),native,full:false,groups:[...selected].sort(),reasons};
}
export function validScope(scope){
 return scope&&['code','books','native','full'].every(key=>typeof scope[key]==='boolean')&&Array.isArray(scope.groups)&&new Set(scope.groups).size===scope.groups.length&&scope.groups.every(g=>groups.includes(g))&&(!scope.full||(scope.code&&scope.native&&groups.every(g=>scope.groups.includes(g))))&&(scope.code||(!scope.groups.length&&!scope.native&&!scope.books))&&(!scope.code||scope.groups.length>0)&&scope.books===scope.groups.includes('books');
}
export function createPlan(scope,metadata=loadMetadata(),{platform=process.platform}={}){
 if(!validScope(scope))scope=fullScope('missing/invalid scope');
 const core=scope.groups.some(group=>['discovery','preparation','review','production'].includes(group));
 const selected=metadata.tests.filter(entry=>entry.level!=='native'&&(scope.full||entry.pr==='always'||scope.code&&(entry.pr==='code'||entry.groups.some(group=>scope.groups.includes(group))||core&&entry.gates.includes('extended'))));
 const tests=selected.filter(entry=>supported(entry,platform)).map(entry=>({file:entry.file,level:entry.level,mode:scope.full||entry.groups.some(group=>scope.groups.includes(group))||core&&entry.gates.includes('extended')?'full':'fast'}));
 return {version:1,platform,scope,native:scope.native,tests,excluded:selected.filter(entry=>!supported(entry,platform)).map(entry=>entry.file)};
}
