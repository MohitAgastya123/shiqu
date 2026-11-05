// Project Responses status and token counters without persisting output, reasoning, model text or keys.
const statuses=new Set(['completed','incomplete','failed','cancelled','in_progress','queued']);
const reasons=new Set(['max_output_tokens','content_filter']);
const efforts=new Set(['low','high','max']);
export function responsesDiagnostic(value:unknown){
 const raw=value&&typeof value==='object'?value as Record<string,unknown>:{},out:Record<string,string|number>={};
 if(raw.status!==undefined)out.status=typeof raw.status==='string'&&statuses.has(raw.status)?raw.status:'UNKNOWN';
 if(raw.incompleteReason!==undefined)out.incompleteReason=typeof raw.incompleteReason==='string'&&reasons.has(raw.incompleteReason)?raw.incompleteReason:'UNKNOWN';
 if(typeof raw.reasoningEffort==='string'&&efforts.has(raw.reasoningEffort))out.reasoningEffort=raw.reasoningEffort;
 for(const name of ['inputTokens','outputTokens','reasoningTokens','cachedInputTokens','maxOutputTokens','elapsedMs'])if(typeof raw[name]==='number'&&Number.isSafeInteger(raw[name])&&raw[name]>=0)out[name]=raw[name];
 return out;
}
