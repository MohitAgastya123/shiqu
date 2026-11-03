// Persist one authorization per immutable failure; replay observes receipts instead of resetting work.
import {createHash} from 'node:crypto';
import {ReaderError} from '../lib/reader-model.ts';
import type {Database} from '../lib/reader-repository.ts';

export type ReaderFault={id:string;session_id:string;owner_id:string;job_id:string|null;kind:'job'|'image-loss'|'interrupted';page:number|null;version:string;image:string|null;message:string;state:'pending'|'recovering'|'resolved'|'replaced';command_id:string|null;created_at:number;updated_at:number};
export type CommandReceipt={request_id:string;owner_id:string;session_id:string;action:string;fingerprint:string;payload:string;fault_id:string|null;result_id:string|null;status:'queued'|'running'|'succeeded'|'failed';result:string|null;error:string|null;created_at:number;updated_at:number};
export const commandFingerprint=(input:unknown)=>createHash('sha256').update(JSON.stringify(input)).digest('hex');
export async function commandReceipt(db:Database,ownerId:string,requestId:string,fingerprint?:string){
 const row=await db.prepare('SELECT * FROM reader_commands WHERE owner_id=? AND request_id=?').bind(ownerId,requestId).first<CommandReceipt>();
 if(row&&fingerprint!==undefined&&row.fingerprint!==fingerprint)throw new ReaderError(409,'这个操作编号已用于其他内容，请重新操作。');
 return row;
}
export async function sessionFaults(db:Database,sessionId:string,ownerId:string){
 return (await db.prepare("SELECT * FROM reader_faults WHERE session_id=? AND owner_id=? AND state IN ('pending','recovering') ORDER BY created_at,id").bind(sessionId,ownerId).all<ReaderFault>()).results;
}
export async function authorizeRecovery(db:Database,input:{ownerId:string;sessionId:string;requestId:string;faultId:string;jobs:string[];resolutionJob:string;redraw?:boolean},now=Date.now()){
 const {ownerId,sessionId,requestId,faultId,jobs,resolutionJob,redraw=false}=input;
 const payload=JSON.stringify({jobs,resolutionJob,redraw}),fingerprint=commandFingerprint(['recover',sessionId,faultId,jobs,resolutionJob,redraw]);
 const replay=await commandReceipt(db,ownerId,requestId,fingerprint);if(replay)return replay;
 if(!jobs.length||!jobs.includes(resolutionJob)||new Set(jobs).size!==jobs.length)throw new ReaderError(400,'恢复任务不完整。');
 await db.prepare(`INSERT INTO reader_commands(request_id,owner_id,session_id,action,fingerprint,payload,fault_id,status,created_at,updated_at)
  SELECT ?,?,?,'recover',?,?,?,'queued',?,? FROM reader_faults f
  WHERE f.id=? AND f.session_id=? AND f.owner_id=? AND f.state='pending'
   AND NOT EXISTS(SELECT 1 FROM json_each(?) selected LEFT JOIN production_jobs j ON j.id=selected.value
    WHERE j.id IS NULL OR j.session_id!=? OR j.owner_id!=? OR j.state='running')
  ON CONFLICT(owner_id,request_id) DO NOTHING`)
  .bind(requestId,ownerId,sessionId,fingerprint,payload,faultId,now,now,faultId,sessionId,ownerId,JSON.stringify(jobs),sessionId,ownerId).run();
 const receipt=await commandReceipt(db,ownerId,requestId,fingerprint);
 if(receipt)return receipt;
 const fault=await db.prepare('SELECT * FROM reader_faults WHERE id=? AND owner_id=? AND session_id=?').bind(faultId,ownerId,sessionId).first<ReaderFault>();
 if(fault?.state==='recovering')throw new ReaderError(409,'这项问题正在处理，请等待已提交的恢复任务。');
 throw new ReaderError(409,'这项问题或输入已更新，请刷新后再操作。');
}
