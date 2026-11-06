// 验证 PR 的保守范围判定、改名检测和 Git 故障回退，使用临时仓库而不访问用户书库。
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {changeScope,detectScope} from '../scripts/ci-scope.mjs';

test('book scope skips only known unrelated UI, desktop, native, public and documentation paths',()=>{
 for(const file of ['client/ui/Reader.tsx','client/ui/Reader.css','desktop/ServiceCard.tsx','desktop/vite.config.ts','src-tauri/src/runtime.rs','public/icon.png']){
  assert.deepEqual(changeScope([file]),{code:true,books:false},file);
 }
 for(const file of ['README.md','.docs/reqs/example.md','LICENSE','NOTICE'])assert.deepEqual(changeScope([file]),{code:false,books:false},file);
 for(const file of ['data/library/originals/book.md','data/library/catalog.json','server/local-books.ts','server/app.ts','server/generation.ts','lib/reader-model.ts','lib/reader-prompts.ts','server/story-token-budget.ts','tests/fixtures/source.md','tests/local-books.test.mjs','scripts/test-tiers.mjs','skills/shiqu/SKILL.md','package.json','pnpm-lock.yaml','.nvmrc','.npmrc','pnpm-workspace.yaml','tsconfig.json','.github/workflows/desktop-macos.yml','new-runtime/module.js']){
  assert.deepEqual(changeScope([file]),{code:true,books:true},file);
 }
 assert.deepEqual(changeScope([]),{code:true,books:true});
 assert.deepEqual(changeScope(['client/ui/Reader.tsx','lib/reader-model.ts']),{code:true,books:true});
 assert.deepEqual(changeScope(['README.md','desktop/main.tsx']),{code:true,books:false});
});
test('real merge-base diffs preserve book relevance across renames and fail closed for invalid refs',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'shiqu-ci-scope-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 git('init');git('config','user.name','Test');git('config','user.email','test@example.org');
 await writeFile(path.join(root,'runtime.js'),'export const value=1;');git('add','.');git('commit','-m','base');const base=git('rev-parse','HEAD');
 git('mv','runtime.js','README.md');git('commit','-m','rename');const head=git('rev-parse','HEAD');
 assert.deepEqual(detectScope(base,head,root),{code:true,books:true});
 assert.deepEqual(detectScope(base,base,root),{code:true,books:true});
 assert.deepEqual(detectScope(base,'missing-ref',root),{code:true,books:true});
 assert.deepEqual(detectScope('',head,root),{code:true,books:true});
 const output=path.join(root,'output'),entry=fileURLToPath(new URL('../scripts/ci-scope.mjs',import.meta.url));
 execFileSync(process.execPath,[entry],{cwd:root,env:{...process.env,BASE:base,HEAD:head,GITHUB_OUTPUT:output}});
 assert.equal(await readFile(output,'utf8'),'code=true\nbooks=true\n');
});
