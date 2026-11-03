// Persist one authorization per immutable failure; replay observes receipts instead of resetting work.
import {createHash} from 'node:crypto';
import {ReaderError} from '../lib/reader-model.ts';
import type {Database} from '../lib/reader-repository.ts';
import {supersededSql} from '../lib/reader-repository.ts';
import type {ProductionAction} from '../lib/reader-model.ts';

export type ReaderFault={id:string;session_id:string;owner_id:string;job_id:string|null;kind:'job'|'image-loss'|'interrupted';page:number|null;version:string;image:string|null;message:string;state:'pending'|'recovering'|'resolved'|'replaced';command_id:string|null;created_at:number;updated_at:number};
export type CommandReceipt={request_id:string;owner_id:string;session_id:string;action:string;fingerprint:string;payload:string;fault_id:string|null;result_id:string|null;status:'queued'|'running'|'succeeded'|'failed';result:string|null;error:string|null;created_at:number;updated_at:number};
export const commandFingerprint=(input:unknown)=>createHash('sha256').update(JSON.stringify(input)).digest('hex');
export async function commandReceipt(db:Database,ownerId:string,requestId:string,fingerprint?:string){
 const row=await db.prepare('SELECT * FROM reader_commands WHERE owner_id=? AND request_id=?').bind(ownerId,requestId).first<CommandReceipt>();
 if(!row&&await db.prepare('SELECT id FROM reader_sessions WHERE id=? AND user_id=?').bind(requestId,ownerId).first())throw new ReaderError(409,'这个操作编号已用于创建或提交故事。');
 if(row&&fingerprint!==undefined&&row.fingerprint!==fingerprint)throw new ReaderError(409,'这个操作编号已用于其他内容，请重新操作。');
 return row;
}
export async function sessionFaults(db:Database,sessionId:string,ownerId:string){
 return (await db.prepare("SELECT * FROM reader_faults WHERE session_id=? AND owner_id=? AND state IN ('pending','recovering') ORDER BY created_at,id").bind(sessionId,ownerId).all<ReaderFault>()).results;
}
export async function recordNoop(db:Database,ownerId:string,sessionId:string,requestId:string,action:string,fingerprint:string,resultId=sessionId,now=Date.now()){
 const existing=await commandReceipt(db,ownerId,requestId,fingerprint);if(existing)return existing;
 await db.prepare(`INSERT INTO reader_commands(request_id,owner_id,session_id,action,fingerprint,payload,result_id,created_at,updated_at)
  VALUES(?,?,?,?,?,'{}',?,?,?) ON CONFLICT(owner_id,request_id) DO NOTHING`)
  .bind(requestId,ownerId,sessionId,action,fingerprint,resultId,now,now).run();
 return (await commandReceipt(db,ownerId,requestId,fingerprint))!;
}
export async function authorizeRecovery(db:Database,input:{ownerId:string;sessionId:string;requestId:string;faultId:string;jobs:string[];resolutionJob:string;redraw?:boolean;resolved?:boolean;adopt?:{jobId:string;result:string;attempts:number};basis?:{selection:string;document:string}},now=Date.now()){
 const {ownerId,sessionId,requestId,faultId,jobs,resolutionJob,redraw=false}=input;
 const resolved=input.resolved||false,payload=JSON.stringify({jobs,resolutionJob,redraw,...(input.adopt?{adopt:input.adopt}:{})}),fingerprint=commandFingerprint(['recover',sessionId,faultId,jobs,resolutionJob,redraw,resolved,...(input.adopt?[input.adopt]:[])]);
 const replay=await commandReceipt(db,ownerId,requestId,fingerprint);if(replay)return replay;
 if(!resolved&&(!jobs.length||!jobs.includes(resolutionJob)||new Set(jobs).size!==jobs.length))throw new ReaderError(400,'恢复任务不完整。');
 const eligible=input.basis?`AND EXISTS(SELECT 1 FROM reader_sessions s WHERE s.id=f.session_id AND s.user_id=f.owner_id
  AND s.generation_control='active' AND NOT ${supersededSql('s')}
  AND NOT EXISTS(SELECT 1 FROM library_deletions d WHERE d.story_id=s.id AND d.user_id=s.user_id)
  AND json_remove(s.selection,'$.displayTitle')=json_remove(?,'$.displayTitle')
  AND json_extract(s.document,'$.plan') IS json_extract(?,'$.plan')
  AND COALESCE(json_extract(s.document,'$.intake.generation'),-1)=COALESCE(json_extract(?,'$.intake.generation'),-1)
  AND (f.image IS NULL OR json_extract(s.document,'$.images['||f.page||']')=f.image))`:'';
 await db.prepare(`INSERT INTO reader_commands(request_id,owner_id,session_id,action,fingerprint,payload,fault_id,status,created_at,updated_at)
  SELECT ?,?,?,'recover',?,?,?,?,?,? FROM reader_faults f
  WHERE f.id=? AND f.session_id=? AND f.owner_id=? AND f.state='pending'
   AND NOT EXISTS(SELECT 1 FROM json_each(?) selected LEFT JOIN production_jobs j ON j.id=selected.value
    WHERE j.id IS NULL OR j.session_id!=? OR j.owner_id!=? OR j.state='running')
   AND NOT EXISTS(SELECT 1 FROM json_each(?) selected JOIN production_jobs j ON j.id=selected.value
    JOIN reader_commands c ON c.request_id=j.recovery_id AND c.owner_id=j.owner_id
    WHERE c.status IN ('queued','running'))
   ${eligible}
  ON CONFLICT(owner_id,request_id) DO NOTHING`)
  .bind(requestId,ownerId,sessionId,fingerprint,payload,faultId,resolved?'succeeded':'queued',now,now,faultId,sessionId,ownerId,JSON.stringify([...jobs,...(input.adopt?[input.adopt.jobId]:[])]),sessionId,ownerId,JSON.stringify([...jobs,...(input.adopt?[input.adopt.jobId]:[])]),...(input.basis?[input.basis.selection,input.basis.document,input.basis.document]:[])).run();
 const receipt=await commandReceipt(db,ownerId,requestId,fingerprint);
 if(receipt)return receipt;
 const fault=await db.prepare('SELECT * FROM reader_faults WHERE id=? AND owner_id=? AND session_id=?').bind(faultId,ownerId,sessionId).first<ReaderFault>();
 if(fault?.state==='recovering')throw new ReaderError(409,'这项问题正在处理，请等待已提交的恢复任务。');
 throw new ReaderError(409,'这项问题或输入已更新，请刷新后再操作。');
}

export async function authorizeControl(db:Database,ownerId:string,sessionId:string,requestId:string,action:ProductionAction,now=Date.now()){
 const fingerprint=commandFingerprint(['control',sessionId,action]),replay=await commandReceipt(db,ownerId,requestId,fingerprint);if(replay)return replay;
 await db.prepare(`INSERT INTO reader_commands(request_id,owner_id,session_id,action,fingerprint,payload,created_at,updated_at)
  SELECT ?,?,?,'control',?,?,?,? FROM reader_sessions s WHERE s.id=? AND s.user_id=? AND s.state!='completed'
   AND NOT ${supersededSql('s')} AND NOT EXISTS(SELECT 1 FROM library_deletions d WHERE d.story_id=s.id AND d.user_id=s.user_id)
  ON CONFLICT(owner_id,request_id) DO NOTHING`)
  .bind(requestId,ownerId,sessionId,fingerprint,JSON.stringify({action}),now,now,sessionId,ownerId).run();
 const receipt=await commandReceipt(db,ownerId,requestId,fingerprint);if(!receipt)throw new ReaderError(409,'故事已完成或版本已更新，请刷新后再操作。');return receipt;
}

export async function authorizeOverride(db:Database,ownerId:string,sessionId:string,command:{requestId:string;faultId:string},now=Date.now()){
 const fingerprint=commandFingerprint(['override',sessionId,command.faultId]),replay=await commandReceipt(db,ownerId,command.requestId,fingerprint);if(replay)return replay;
 await db.prepare(`INSERT INTO reader_commands(request_id,owner_id,session_id,action,fingerprint,payload,fault_id,created_at,updated_at)
  SELECT ?,?,?,'override',?,'{}',?,?,? FROM reader_sessions s JOIN reader_faults f ON f.session_id=s.id AND f.owner_id=s.user_id
  WHERE s.id=? AND s.user_id=? AND f.id=? AND f.state='pending' AND s.state!='running'
   AND json_extract(s.document,'$.visualReview.status')='blocked' AND NOT ${supersededSql('s')}
   AND NOT EXISTS(SELECT 1 FROM library_deletions d WHERE d.story_id=s.id AND d.user_id=s.user_id)
  ON CONFLICT(owner_id,request_id) DO NOTHING`)
  .bind(command.requestId,ownerId,sessionId,fingerprint,command.faultId,now,now,sessionId,ownerId,command.faultId).run();
 const receipt=await commandReceipt(db,ownerId,command.requestId,fingerprint);if(!receipt)throw new ReaderError(409,'审核问题正在处理或已更新，请刷新后再操作。');return receipt;
}
