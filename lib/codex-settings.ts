// Share Codex generation deadlines and effort choices; blank effort inherits the CLI default.
import {z} from 'zod';

export const codexGenerationTimeoutMs=15*60*1000;
export const codexReasoningEfforts=['low','medium','high','xhigh','max'] as const;
export const codexReasoningEffortSchema=z.union([z.literal(''),z.enum(codexReasoningEfforts)]).default('');
export type CodexReasoningEffort=z.infer<typeof codexReasoningEffortSchema>;
