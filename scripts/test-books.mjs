// 运行共享选择器中的真实原著套件，覆盖内容、加载、出处及阅读流程；CI 按变更范围调用。
import {spawn} from 'node:child_process';
import {tierTests} from './test-tiers.mjs';
const files=await tierTests('books');
const env={...process.env,SHIQU_TEST_BOOKS:'1'};delete env.NODE_TEST_CONTEXT;
// 运行完整文件，包括逐字检查和同文件中的加载、校验与制作边界测试。
const child=spawn(process.execPath,['--experimental-strip-types','--test',...files],{env,stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));
child.once('exit',(code,signal)=>{process.exitCode=code??(signal?1:0);});
