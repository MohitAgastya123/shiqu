'use client';
// Expose exact authorized recovery scopes; pauses keep reasons visible without retrying.
import {useState} from 'react';
import type {SessionView} from '@/lib/reader-model';
import type {FaultView} from '@/lib/reader-recovery';

function label(fault:FaultView){
 if(fault.stage==='redraw')return fault.page===null?'重绘图片':`重绘第 ${fault.page+1} 幅`;
 return {prepare:'重试准备',source:'重试原文检索',publication:'重试保存图片',review:'继续自动修复',generation:'重试生成'}[fault.stage];
}
export default function StoryRetry({session,busy,onRetry,primary=false}:{session:SessionView;busy:boolean;onRetry:(faultId?:string)=>void|Promise<void>;primary?:boolean}){
 const [pending,setPending]=useState<string[]>([]);
 function recover(id:string){setPending(ids=>[...ids,id]);void Promise.resolve(onRetry(id)).finally(()=>setPending(ids=>ids.filter(value=>value!==id)));}
 const paused=!!session.generationControl&&session.generationControl!=='active';
 if(session.faults?.length)return <div className="yu-fault-list" aria-label="待处理问题">{session.faults.map(fault=><div className="yu-retry-control" key={fault.id}>
  <small>{fault.state==='recovering'?'正在处理：':paused?'已暂停，另有问题：':''}{fault.page===null?'':`第 ${fault.page+1} 幅：`}{fault.message}</small>
  {fault.stage==='redraw'&&fault.state==='pending'&&<small>将重新生成此幅，可能消耗额度；其他已保存图片保留。</small>}
  {fault.stage==='publication'&&<small>将重试保存已生成图片，不重新绘制。</small>}
  {fault.retryAllowed&&!paused&&<button type="button" className={primary?'yu-primary':undefined} disabled={pending.includes(fault.id)} onClick={()=>recover(fault.id)}>{pending.includes(fault.id)?'正在请求…':label(fault)}</button>}
 </div>)}</div>;
 if(!session.retryAllowed||paused)return null;
 const stage=session.retryStage;
 return <div className="yu-retry-control"><small>已完成的内容会保留，请刷新当前问题后恢复。</small><button className={primary?'yu-primary':undefined} disabled={busy} onClick={()=>onRetry()}>{busy?'正在请求…':stage==='review'?'继续自动修复':stage==='source'?'重试原文检索':stage==='publication'?'重试保存图片':stage==='prepare'?'重试准备':stage==='redraw'?'重绘图片':'重试生成'}</button></div>;
}
