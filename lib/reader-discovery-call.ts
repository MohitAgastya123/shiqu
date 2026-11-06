// English product text and generation contracts; canonical source evidence remains unchanged.
// Observe discovery calls once without storing prompts, provider bodies, or raw errors.
// Only known content/output failures may be isolated; ambiguous service failures stop dispatch.
import {ReaderError} from './reader-model.ts';
export type DiscoveryCode='refused'|'invalid-output'|'timeout'|'service';
export class DiscoveryFailure extends ReaderError{
 code:DiscoveryCode;
 constructor(code:DiscoveryCode){super(code==='service'?503:502,code==='service'?'The generation service is unavailable. Progress is saved; retry.':'Theme matching did not finish for this story. Other results are saved.');this.code=code;}
}
export function discoveryCode(error:unknown):DiscoveryCode{
 if(error instanceof DiscoveryFailure)return error.code;
 if(error instanceof SyntaxError||error instanceof Error&&error.name==='ZodError')return 'invalid-output';
 const e=error as {message?:string;name?:string;inferenceStarted?:boolean};
 if(['REFUSED','CONTENT_BLOCKED'].includes(e?.message||''))return 'refused';
 if(['INVALID_OUTPUT','INVALID_JSON','INVALID_TEXT','INCOMPLETE_RESPONSE'].includes(e?.message||''))return 'invalid-output';
 if((e?.name==='TimeoutError'||e?.message==='TIMEOUT')&&e.inferenceStarted)return 'timeout';
 return 'service';
}
export type DiscoveryCallEvent={id:string;stage:'extraction'|'matching';provider:string;model:string;effort:string;durationMs:number;status:'success'|'partial'|DiscoveryCode;cancelled:boolean;requestedCount:number;acceptedCount:number;inputTokens:number|null;outputTokens:number|null;isolation:boolean};
export type DiscoveryContext={cycleId?:string;signal?:AbortSignal;isolation?:boolean;onCall?:(event:DiscoveryCallEvent)=>void;onCallStart?:()=>((event:DiscoveryCallEvent)=>void)};
type Meta={model?:string;usage?:unknown;acceptedCount?:number};
const token=(...values:unknown[])=>values.find(value=>typeof value==='number'&&Number.isFinite(value)&&value>=0) as number|undefined;
export function discoveryUsage(usage:unknown){
 const u=usage as Record<string,unknown>|null;
 return {inputTokens:token(u?.input_tokens,u?.inputTokens,u?.promptTokenCount)??null,outputTokens:token(u?.output_tokens,u?.outputTokens,u?.candidatesTokenCount)??null};
}
export async function discoveryCall<T>(identity:Pick<DiscoveryCallEvent,'stage'|'provider'|'model'|'effort'|'requestedCount'>,context:DiscoveryContext|undefined,work:(report:(meta:Meta)=>void)=>Promise<T>):Promise<T>{
 const deliver=context?.onCallStart?.()||context?.onCall;
 const started=performance.now();let metadata:Meta={},status:DiscoveryCallEvent['status']='success';
 try{return await work(meta=>{metadata={...metadata,...meta};});}
 catch(error){status=discoveryCode(error);const safe=error as Meta;metadata={...metadata,usage:metadata.usage??safe?.usage,model:metadata.model??safe?.model};throw error;}
 finally{
  const model=metadata.model&&/^[\w.-]{1,100}$/.test(metadata.model)?metadata.model:identity.model;
  if(status==='success'&&identity.stage==='matching'&&(metadata.acceptedCount||0)<identity.requestedCount)status='partial';
  const event:DiscoveryCallEvent={id:crypto.randomUUID(),...identity,model,durationMs:Math.max(0,performance.now()-started),status,cancelled:!!context?.signal?.aborted,acceptedCount:metadata.acceptedCount||0,...discoveryUsage(metadata.usage),isolation:!!context?.isolation};
  console.info('story_discovery_call',JSON.stringify(event));deliver?.(event);
 }
}
