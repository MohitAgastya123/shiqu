// Browser provider settings share the desktop schema without exposing system paths or stored secrets.
import {z} from 'zod';
import {systemSettingsSchema} from './system-settings.ts';
import type {ProviderStatus} from './reader-provider.ts';
import {taskReasoningSchema} from './reader-reasoning.ts';

export const providerSettingsPath='/api/local/provider-settings';
export const providerSettingsProofHeader='x-shiqu-local-settings-proof';
export const providerSettingsSchema=systemSettingsSchema.innerType().pick({provider:true,textModel:true,imageModel:true,openaiTextModel:true,openaiImageModel:true,codexModel:true,codexReasoningEffort:true,taskReasoningEfforts:true}).strict();
export type ProviderSettings=z.infer<typeof providerSettingsSchema>;
const providerSettingsPatchSchema=providerSettingsSchema.partial().extend({taskReasoningEfforts:taskReasoningSchema.removeDefault().partial().optional()});
export const providerSettingsSaveSchema=z.object({settings:providerSettingsPatchSchema,expectedRevision:z.number().int().nonnegative(),keyAction:z.enum(['keep','replace','remove']),key:z.string().max(4096).default('')}).strict();
export type ProviderSettingsSave=z.infer<typeof providerSettingsSaveSchema>;
export type ProviderSettingsView={settings:ProviderSettings;revision:number;keyPresent:{gemini:boolean;openai:boolean};runtime:Pick<ProviderStatus,'provider'|'configured'|'models'|'taskReasoningEfforts'>;overrides:string[];restartRequired:boolean;platform:string};
export function loopbackAddress(address:string|undefined){return address==='127.0.0.1'||address==='::1'||address==='::ffff:127.0.0.1';}
