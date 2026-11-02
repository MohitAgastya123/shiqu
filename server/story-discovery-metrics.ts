// Persist privacy-limited cycle totals, including receipts that settle after the reader has returned.
import {z} from 'zod';
import {StoryDiscoveryCache,discoveryHash} from './story-discovery-cache.ts';
import type {DiscoveryCallEvent} from '../lib/reader-discovery-call.ts';
const schema=z.object({started:z.number(),cold:z.boolean(),firstStoredMs:z.number().nullable(),firstMatchMs:z.number().nullable(),calls:z.number(),isolationCalls:z.number(),inputTokens:z.number(),outputTokens:z.number(),unknownUsage:z.number(),status:z.enum(['searching','matched','incomplete','none','failed','cancelled']),ids:z.array(z.string()).max(50000)});
export async function discoveryMeasurement(cache:StoryDiscoveryCache,cycle:string,cold:boolean){
 const key='discovery-measurement/'+discoveryHash(cycle),initial=()=>({started:Date.now(),cold,firstStoredMs:null,firstMatchMs:null,calls:0,isolationCalls:0,inputTokens:0,outputTokens:0,unknownUsage:0,status:'searching' as const,ids:[] as string[]});
 await cache.update(key,schema,initial,value=>value);let pending=Promise.resolve();
 const update=(change:(value:z.infer<typeof schema>)=>void)=>{pending=pending.then(async()=>{const value=await cache.update(key,schema,initial,value=>{change(value);return value;});const {ids,started,...publicValue}=value;void ids;void started;console.info('story_discovery_search',JSON.stringify(publicValue));});return pending;};
 return {
  call:(event:DiscoveryCallEvent)=>{void update(value=>{if(value.ids.includes(event.id))return;value.ids.push(event.id);value.calls++;value.isolationCalls+=Number(event.isolation);value.inputTokens+=event.inputTokens||0;value.outputTokens+=event.outputTokens||0;value.unknownUsage+=Number(event.inputTokens===null||event.outputTokens===null);}).catch(()=>{});},
  stored:()=>update(value=>{value.firstStoredMs??=Date.now()-value.started;}),
  finish:(status:z.infer<typeof schema>['status'])=>update(value=>{value.status=status;if(status==='matched')value.firstMatchMs??=Date.now()-value.started;}),
 };
}
