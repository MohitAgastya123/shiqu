// Locate immutable pre-upgrade files using frozen v3 serializers, never today's prompt or block layout.
import frozen from '../lib/reader-discovery-v1.json' with {type:'json'};
import {discoveryHash} from './story-discovery-cache.ts';
import {legacySummaryCatalogPrompt,legacySummaryCatalogJson} from '../lib/reader-legacy-catalog.ts';
import type {LocalBook} from './local-books.ts';
import type {ReadingLimits} from './story-reading-inputs.ts';
const defaults={whole:400000,chapter:12000};
export function previousReadingPlanKey(book:LocalBook,provider:string,limits:ReadingLimits=defaults){return discoveryHash(['reading-plan-v3',book.id,book.edition,discoveryHash(book.input.text),provider,limits,frozen.scanPrompt,frozen.localScanJson]);}
export function previousDiscoveryNamespace(book:LocalBook,provider:string,model:string,limits:ReadingLimits=defaults,effort?:string){return discoveryHash(['story-library-v1',previousReadingPlanKey(book,provider,limits),model,frozen.catalogPrompt,frozen.localCatalogJson,...(effort?[effort]:[])]);}
export function previousSummaryNamespace(book:LocalBook,provider:string,model:string,limits:ReadingLimits=defaults,effort?:string){return discoveryHash(['story-library-v1',previousReadingPlanKey(book,provider,limits),model,legacySummaryCatalogPrompt,legacySummaryCatalogJson,...(effort?[effort]:[])]);}
