// Exercise real editor/export handlers: restoring is a draft operation and cached downloads cannot skip consent.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {until} from './fixtures/production.mjs';
import {makeStory} from './fixtures/story.mjs';
import {emptyPublication} from '../lib/story-publication.ts';

const bundle=await build({stdin:{contents:"export {default as Editor,StoryPublicationSummary as Summary} from './client/ui/StoryPublication.tsx';export {default as ExportControl} from './client/ui/StoryExportControl.tsx';export {beginRender,resetHooks,flushEffects,cleanupEffects} from 'react';export {setRequest} from 'test-request';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',loader:{'.css':'empty'},plugins:[{
 name:'publication-form-hooks',setup(b){
  b.onResolve({filter:/^react$/},()=>({path:'hooks',namespace:'publication'}));
  b.onResolve({filter:/^(\.\/shared|test-request)$/},()=>({path:'request',namespace:'publication'}));
  b.onLoad({filter:/.*/,namespace:'publication'},args=>({loader:'js',contents:args.path==='request'?`
   let call;export function setRequest(value){call=value;}export function request(...args){return call(...args);}
  `:`
   const cells=[],effects=[];let cursor=0;export function beginRender(){cursor=0;}export function cleanupEffects(){for(const effect of effects)effect?.cleanup?.();effects.length=0;}export function resetHooks(){cleanupEffects();cells.length=0;cursor=0;}
   export function useState(initial){const index=cursor++;if(!(index in cells))cells[index]=initial;return [cells[index],next=>{cells[index]=typeof next==='function'?next(cells[index]):next;}];}
   export function useRef(value){const index=cursor++;return cells[index]??={current:value};}
   export function useEffect(callback,deps){const index=cursor++,prior=effects[index];if(!prior||deps.some((value,i)=>!Object.is(value,prior.deps[i])))effects[index]={callback,deps,cleanup:prior?.cleanup,pending:true};}
   export function flushEffects(){for(const effect of effects)if(effect?.pending){effect.pending=false;effect.cleanup?.();effect.cleanup=effect.callback();}}
  `}));
 }
}]});
function harness(){const module={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);return module.exports;}
function find(node,predicate){
 if(!node||typeof node!=='object')return null;
 if(predicate(node))return node;
 for(const child of [node.props?.children].flat(Infinity)){const found=find(child,predicate);if(found)return found;}
 return null;
}
const text=node=>typeof node==='string'?node:Array.isArray(node)?node.map(text).join(''):node&&typeof node==='object'?text(node.props?.children):'';
const button=(tree,label)=>find(tree,node=>node.type==='button'&&text(node)===label);
const input=(tree,label)=>find(find(tree,node=>node.type==='label'&&node.props.children[0]===label),node=>node.type==='input'||node.type==='textarea');
const initial={author:'本篇制作人',workUrl:'https://example.org/story',contact:'本篇联系',sourceNote:'本篇来源',reuse:'本篇条件'};
const defaults={author:'默认制作人',workUrl:'https://example.org/default',contact:'默认联系',sourceNote:'默认来源',reuse:'默认条件',watermarkFontSize:32};

function summaryHarness(t){
 const hooks=harness(),previous={window:globalThis.window,document:globalThis.document};
 globalThis.window=new EventTarget();globalThis.document=Object.assign(new EventTarget(),{visibilityState:'visible'});
 t.after(()=>{hooks.cleanupEffects();for(const [key,value] of Object.entries(previous))if(value===undefined)delete globalThis[key];else globalThis[key]=value;});
 return hooks;
}

test('settings show the resolved default author, refresh on return and keep explicit work credits',async t=>{
 const {Summary,beginRender,flushEffects,setRequest}=summaryHarness(t);let current=defaults,reads=0;
 setRequest(async path=>{assert.equal(path,'reader/publication-defaults');reads++;return {publication:current};});
 const props={story:{...makeStory(1),generated:true},onEdit(){}};
 const render=()=>{beginRender();const tree=Summary(props);flushEffects();return tree;};
 assert.match(text(render()),/制作：正在读取署名/);
 await until(()=>text(render()).includes('制作：默认制作人'));assert.equal(reads,1);assert.ok(!text(render()).includes('沿用「我的」默认署名'));
 current={...defaults,author:'实时更新的默认名字'};window.dispatchEvent(new Event('focus'));
 assert.match(text(render()),/制作：正在读取署名/);await until(()=>text(render()).includes('制作：实时更新的默认名字'));assert.equal(reads,2);
 document.visibilityState='hidden';document.dispatchEvent(new Event('visibilitychange'));assert.equal(reads,2);
 current={...defaults,author:'切回页面后的名字'};document.visibilityState='visible';document.dispatchEvent(new Event('visibilitychange'));
 await until(()=>text(render()).includes('制作：切回页面后的名字'));assert.equal(reads,3);
 props.story={...props.story,publication:initial};assert.match(text(render()),/制作：本篇制作人/);
 window.dispatchEvent(new Event('focus'));assert.equal(reads,3,'an explicit work author needs no default lookup');
 props.story=makeStory(1);assert.match(text(render()),/制作：未署名/);assert.equal(reads,3,'shared samples must keep their own credit');
});

test('settings distinguish a failed lookup from an unsigned work and allow retry',async t=>{
 const {Summary,beginRender,flushEffects,setRequest}=summaryHarness(t);let fail=true,current=defaults;
 setRequest(async()=>{if(fail)throw Error('读取失败');return {publication:current};});
 const render=()=>{beginRender();const tree=Summary({story:{...makeStory(1),generated:true}});flushEffects();return tree;};
 render();await until(()=>!render().props['aria-busy']);assert.match(text(render()),/制作：暂时无法读取/);assert.ok(!text(render()).includes('制作：未署名'));
 fail=false;button(render(),'重新读取署名').props.onClick();render();await until(()=>text(render()).includes('制作：默认制作人'));
 current=null;window.dispatchEvent(new Event('focus'));await until(()=>text(render()).includes('制作：未署名'));
});

test('late default reads cannot replace a newer name or flash the previous story author',async t=>{
 const {Summary,beginRender,flushEffects,setRequest}=summaryHarness(t),resolves=[];
 setRequest(()=>new Promise(resolve=>resolves.push(resolve)));
 const props={story:{...makeStory(1),generated:true}};
 const render=()=>{beginRender();const tree=Summary(props);flushEffects();return tree;};
 render();window.dispatchEvent(new Event('focus'));assert.equal(resolves.length,2);
 resolves[1]({publication:{...defaults,author:'较新的名字'}});await until(()=>text(render()).includes('制作：较新的名字'));
 resolves[0]({publication:{...defaults,author:'迟到的旧名字'}});await new Promise(resolve=>setImmediate(resolve));assert.match(text(render()),/制作：较新的名字/);
 props.story={...props.story,id:'another-story'};assert.match(text(render()),/制作：正在读取署名/);assert.ok(!text(render()).includes('较新的名字'));
 resolves[2]({publication:{...defaults,author:'另一篇的默认名字'}});await until(()=>text(render()).includes('制作：另一篇的默认名字'));
});

test('restore fetches current defaults, locks duplicate requests and changes all draft fields without saving',async()=>{
 const {Editor,beginRender,setRequest}=harness();let release,closed=0;const calls=[],saves=[];
 setRequest((...args)=>{calls.push(args);return new Promise(resolve=>release=resolve);});
 const render=()=>{beginRender();return Editor({story:{...makeStory(1),publication:initial},onClose:()=>closed++,onSave:async(...args)=>saves.push(args)});};
 const submit=()=>find(render(),node=>node.type==='form').props.onSubmit({preventDefault(){}});
 button(render(),'恢复默认说明').props.onClick();button(render(),'正在读取默认…').props.onClick();submit();
 assert.deepEqual(calls,[['reader/publication-defaults']]);assert.equal(render().props.busy,true);assert.equal(input(render(),'制作署名').props.disabled,true);assert.deepEqual(saves,[]);
 release({publication:defaults});await until(()=>!render().props.busy);
 for(const [key,label] of Object.entries({author:'制作署名',workUrl:'公开作品链接',contact:'公开联系方式',sourceNote:'来源版本与许可说明',reuse:'转载与再使用条件'}))assert.equal(input(render(),label).props.value,defaults[key]);
 assert.equal(find(render(),node=>node.props?.type==='range').props.value,32);
 assert.match(text(find(render(),node=>node.props?.role==='status')),/保存后应用于本篇/);
 assert.deepEqual(saves,[]);button(render(),'取消').props.onClick();assert.equal(closed,1);
 // Saving the loaded draft still compares against the story that was opened, not the defaults.
 submit();await until(()=>saves.length===1);assert.deepEqual(saves,[[defaults,initial]]);
});

test('a failed restore keeps local edits and retry reads latest defaults; missing defaults restore to blank',async()=>{
 const {Editor,beginRender,setRequest,resetHooks}=harness();let fail=true,next=defaults;const saves=[];
 setRequest(async()=>{if(fail)throw Error('读取失败');return {publication:next};});
 const render=()=>{beginRender();return Editor({story:{...makeStory(1),publication:initial},onClose(){},onSave:async(...args)=>saves.push(args)});};
 input(render(),'制作署名').props.onChange({target:{value:'未保存修改'}});
 button(render(),'恢复默认说明').props.onClick();await until(()=>!render().props.busy);
 assert.equal(input(render(),'制作署名').props.value,'未保存修改');assert.equal(text(find(render(),node=>node.props?.role==='alert')),'读取失败');assert.deepEqual(saves,[]);
 fail=false;button(render(),'恢复默认说明').props.onClick();await until(()=>!render().props.busy);assert.equal(input(render(),'制作署名').props.value,defaults.author);
 next={...defaults,author:'更新后的默认署名'};button(render(),'恢复默认说明').props.onClick();await until(()=>!render().props.busy);assert.equal(input(render(),'制作署名').props.value,next.author);
 next=null;button(render(),'恢复默认说明').props.onClick();await until(()=>!render().props.busy);assert.equal(input(render(),'制作署名').props.value,'');assert.match(text(find(render(),node=>node.props?.role==='status')),/尚未设置默认说明/);
 assert.equal(find(render(),node=>node.props?.type==='range').props.value,24);
 find(render(),node=>node.type==='form').props.onSubmit({preventDefault(){}});await until(()=>saves.length===1);assert.deepEqual(saves,[[emptyPublication,initial]]);
 resetHooks();beginRender();const global=Editor({publication:defaults,onClose(){},onSave:async()=>{}});assert.equal(button(global,'恢复默认说明'),null);
});

test('watermark sizing shows a 24px default and saves an independent single-story value',async()=>{
 const {Editor,beginRender}=harness(),saves=[];
 const render=()=>{beginRender();return Editor({story:{...makeStory(1),publication:initial},onClose(){},onSave:async(...args)=>saves.push(args)});};
 const slider=()=>find(render(),node=>node.props?.type==='range');
 assert.equal(slider().props.min,12);assert.equal(slider().props.max,48);assert.equal(slider().props.step,1);assert.equal(slider().props.value,24);
 assert.equal(find(render(),node=>node.props?.type==='submit').props.disabled,true);
 slider().props.onChange({target:{value:'40'}});assert.equal(slider().props.value,40);
 find(render(),node=>node.type==='form').props.onSubmit({preventDefault(){}});await until(()=>saves.length===1);
 assert.deepEqual(saves,[[{...initial,watermarkFontSize:40},initial]]);
});

for(const format of ['pdf','png','zip'])test(`${format}: every output attempt rechecks defaults before unsigned consent`,async()=>{
 const {ExportControl,beginRender,setRequest}=harness();const exported=[];let edited=0,reads=0;
 setRequest(async path=>{assert.equal(path,'reader/publication-defaults');reads++;return {publication:null};});
 const props={story:{...makeStory(1),generated:true},format,className:'download',disabled:false,busy:false,onExport:story=>exported.push(story),onEdit:()=>edited++,children:'下载'};
 const render=()=>{beginRender();return ExportControl(props);};
 const control=()=>find(render(),node=>node.props?.className==='download');
 const confirmation=()=>find(render(),node=>node.props?.title==='作品还未署名');
 const settle=()=>until(()=>!control().props['aria-busy']);
 const click=async()=>{control().props.onClick();await settle();};
 await click();assert.equal(reads,1);assert.equal(exported.length,0);assert.ok(confirmation());
 button(render(),'取消').props.onClick();assert.equal(confirmation(),null);assert.equal(exported.length,0);
 await click();button(render(),'先填写署名').props.onClick();assert.equal(edited,1);assert.equal(exported.length,0);assert.equal(confirmation(),null);
 await click();button(render(),'仍以未署名导出 '+format.toUpperCase()).props.onClick();await settle();assert.equal(exported.length,1);assert.equal(confirmation(),null);assert.equal(reads,4);
 // An already prepared file goes through this same callback; the reader validates its resolved export key.
 await click();assert.ok(confirmation());assert.equal(exported.length,1);button(render(),'取消').props.onClick();
 for(const author of ['   ','未署名']){props.story={...props.story,publication:{...emptyPublication,author}};await click();assert.ok(confirmation());button(render(),'取消').props.onClick();}
 props.story={...props.story,publication:initial};await click();assert.equal(confirmation(),null);assert.equal(exported.length,2);assert.equal(exported.at(-1).publication.author,initial.author);
 const before=reads;props.disabled=true;await click();assert.equal(reads,before);assert.equal(exported.length,2);
});

for(const format of ['pdf','png','zip'])test(`${format}: live defaults fill blank work fields, refresh on repeated download and preserve explicit overrides`,async()=>{
 const {ExportControl,beginRender,setRequest}=harness(),exported=[];let current=defaults,reads=0;
 setRequest(async path=>{assert.equal(path,'reader/publication-defaults');reads++;return {publication:current};});
 const original={...emptyPublication,sourceNote:'本篇专门的来源许可'};
 const props={story:{...makeStory(1),generated:true,publication:original},format,className:'download',disabled:false,busy:false,onExport:story=>exported.push(story),children:'下载'};
 const render=()=>{beginRender();return ExportControl(props);};
 const control=()=>find(render(),node=>node.props?.className==='download');
 const click=async()=>{control().props.onClick();await until(()=>!control().props['aria-busy']);};
 await click();assert.equal(exported.length,1);assert.equal(exported[0].publication.author,defaults.author);assert.equal(exported[0].publication.sourceNote,original.sourceNote);assert.equal(exported[0].publication.watermarkFontSize,32);
 assert.deepEqual(props.story.publication,original,'preflight must not rewrite persisted story metadata');
 current={...defaults,author:'刚修改的默认署名',watermarkFontSize:40};await click();assert.equal(reads,2);assert.equal(exported[1].publication.author,current.author);assert.equal(exported[1].publication.watermarkFontSize,40);
 props.story={...props.story,publication:{...initial,watermarkFontSize:16}};await click();assert.equal(reads,3);assert.deepEqual(exported[2].publication,props.story.publication);
});

test('preflight blocks duplicate clicks, fails without exporting on read errors and can retry',async()=>{
 const {ExportControl,beginRender,setRequest}=harness();let reject,reads=0;const exported=[];
 setRequest(()=>{reads++;return new Promise((_,no)=>reject=no);});
 const props={story:{...makeStory(1),generated:true},format:'pdf',className:'download',disabled:false,busy:false,onExport:story=>exported.push(story),children:'下载'};
 const render=()=>{beginRender();return ExportControl(props);};
 const control=()=>find(render(),node=>node.props?.className==='download');
 control().props.onClick();control().props.onClick();assert.equal(reads,1);assert.equal(control().props.disabled,true);
 reject(Error('读取默认署名失败'));await until(()=>!control().props['aria-busy']);
 assert.equal(exported.length,0);assert.equal(text(find(render(),node=>node.props?.role==='alert')),'读取默认署名失败');
 setRequest(async()=>({publication:defaults}));control().props.onClick();await until(()=>!control().props['aria-busy']);assert.equal(exported.length,1);assert.equal(exported[0].publication.author,defaults.author);
});

test('continuing from unsigned confirmation rechecks a default name saved while the dialog was open',async()=>{
 const {ExportControl,beginRender,setRequest}=harness(),exported=[];let current=null,reads=0;
 setRequest(async()=>{reads++;return {publication:current};});
 const render=()=>{beginRender();return ExportControl({story:{...makeStory(1),generated:true},format:'zip',className:'download',disabled:false,busy:false,onExport:story=>exported.push(story),children:'下载'});};
 const control=()=>find(render(),node=>node.props?.className==='download');
 control().props.onClick();await until(()=>!control().props['aria-busy']);assert.ok(find(render(),node=>node.props?.title==='作品还未署名'));
 current=defaults;button(render(),'仍以未署名导出 ZIP').props.onClick();await until(()=>!control().props['aria-busy']);
 assert.equal(reads,2);assert.equal(exported.length,1);assert.equal(exported[0].publication.author,defaults.author);
});
