// Application dependencies are supplied by the server, never by hosting globals.
// Local uploads and series orchestration share the same database, media and production service.
import type {SqliteRemoteDatabase} from 'drizzle-orm/sqlite-proxy';
import type * as schema from '../db/schema.ts';
import type {ReaderProvider} from './reader-provider.ts';
import type {Database} from './reader-repository.ts';
import type {LocalBooks} from '../server/local-books.ts';
import type {ReaderProduction} from './reader-production.ts';
import type {StorySeries} from '../server/story-series.ts';

export interface MediaObject {body:Uint8Array<ArrayBuffer>;contentType:string;arrayBuffer():Promise<ArrayBuffer>}
export interface MediaStore {
 get(key:string):Promise<MediaObject|null>;
 put(key:string,value:ArrayBuffer|Uint8Array,options:{contentType:string}):Promise<unknown>;
}
export interface Services {
 commandOnly?:boolean;
 db:SqliteRemoteDatabase<typeof schema>;
 database:Database;
 media:MediaStore;
 variables:Record<string,string|undefined>;
 ownerId:string;
 transport:typeof fetch;
 generation:ReaderProvider;
 localBooks?:LocalBooks;
 production?:ReaderProduction;
 series?:StorySeries;
}
