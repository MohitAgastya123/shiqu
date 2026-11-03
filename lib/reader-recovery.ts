// Keep user recovery intent separate from demand heartbeats and from mutable session errors.
import {z} from 'zod';
export const recoveryRequestSchema=z.object({requestId:z.string().uuid(),faultId:z.string().min(1).max(100)}).strict();
export type RecoveryRequest=z.infer<typeof recoveryRequestSchema>;
export type FaultView={id:string;message:string;page:number|null;stage:'source'|'prepare'|'generation'|'publication'|'review'|'redraw';state:'pending'|'recovering';retryAllowed:boolean};
export type RecoveryReceiptView={requestId:string;status:'queued'|'running'|'succeeded'|'failed';error:string|null};
