// 兼容现有分层命令；文件归属来自显式元数据，不读取夹具调用或导入文本。
import {loadMetadata,supported} from './test-metadata.mjs';
export async function tierTests(tier,root=process.cwd()){
 if(!['unit','flows','books'].includes(tier))throw Error('Test tier must be unit, flows or books');
 return loadMetadata(root).tests.filter(entry=>entry.suite===tier&&supported(entry)).map(entry=>entry.file);
}
