// Project Gemini response metadata for both console capture and diagnostic export; never retain text.
const finishReasons=new Set(['FINISH_REASON_UNSPECIFIED','STOP','MAX_TOKENS','SAFETY','RECITATION','LANGUAGE','OTHER','BLOCKLIST','PROHIBITED_CONTENT','SPII','MALFORMED_FUNCTION_CALL','IMAGE_SAFETY','IMAGE_PROHIBITED_CONTENT','IMAGE_OTHER','NO_IMAGE','IMAGE_RECITATION','UNEXPECTED_TOOL_CALL','TOO_MANY_TOOL_CALLS','MISSING_THOUGHT_SIGNATURE','MALFORMED_RESPONSE','ESCALATION','NO_CANDIDATE']);
const tasks=new Set(['suggest','art','frames','outline','plan','review','repair','image']);
const tokenFields=['promptTokenCount','candidatesTokenCount','thoughtsTokenCount','totalTokenCount','cachedContentTokenCount','toolUsePromptTokenCount','maxOutputTokens','elapsedMs'] as const;
export function geminiResponseDiagnostic(value:unknown){
 const raw=value&&typeof value==='object'?value as Record<string,unknown>:{},out:Record<string,string|number>={};
 if(raw.finishReason!==undefined)out.finishReason=typeof raw.finishReason==='string'&&finishReasons.has(raw.finishReason)?raw.finishReason:'UNKNOWN';
 if(typeof raw.task==='string'&&tasks.has(raw.task))out.task=raw.task;
 if(typeof raw.thinkingLevel==='string'&&['MINIMAL','LOW','MEDIUM','HIGH'].includes(raw.thinkingLevel))out.thinkingLevel=raw.thinkingLevel;
 for(const field of tokenFields)if(typeof raw[field]==='number'&&Number.isSafeInteger(raw[field])&&raw[field]>=0)out[field]=raw[field];
 return out;
}
