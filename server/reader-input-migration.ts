// Remove display names from persisted work identities before workers start. Move receipts and
// dependencies together in the caller's migration transaction; collisions abort rather than pay again.
import type {DatabaseSync} from 'node:sqlite';
import {selectionSchema} from '../lib/reader-model.ts';
import {inputVersion,productionJobId} from './production-queue.ts';
export const readerInputMigration='0014_reader_input_identity.sql';
export function migrateReaderInputs(sqlite:DatabaseSync){
 const remapped=new Map<string,string>();
 for(const row of sqlite.prepare('SELECT id,user_id,selection,document FROM reader_sessions WHERE json_valid(selection) AND json_valid(document)').all()){
  const parsed=selectionSchema.safeParse(JSON.parse(String(row.selection)));if(!parsed.success||!parsed.data.displayTitle)continue;
  const selection=parsed.data,doc=JSON.parse(String(row.document)),setup=doc.intake?{setupGeneration:doc.intake.generation}:{};
  const oldScript=inputVersion({selection,...setup}),{displayTitle:_,...inputs}=selection;void _;
  const script=inputVersion({selection:inputs,...setup});
  const oldImage=inputVersion({scriptVersion:oldScript,plan:doc.plan,style:selection.artStyle,prompt:selection.productionPrompt});
  const image=inputVersion({scriptVersion:script,plan:doc.plan,style:selection.artStyle,prompt:selection.productionPrompt});
  for(const job of sqlite.prepare("SELECT * FROM production_jobs WHERE session_id=? AND owner_id=? AND ((kind IN ('script','prepare') AND version=?) OR (kind IN ('image','image-publish') AND version=?))").all(row.id,row.user_id,oldScript,oldImage)){
   const payload=JSON.parse(String(job.payload));if(doc.intake&&payload.setupGeneration!==doc.intake.generation)continue;
   const version=job.kind==='script'||job.kind==='prepare'?script:image,key=job.kind==='script'||job.kind==='prepare'?payload.stepKey||'':String(payload.page);
   const id=productionJobId(String(row.id),String(job.kind),version,key),oldId=String(job.id);
   if(id===oldId)continue;
   if(sqlite.prepare('SELECT id FROM production_jobs WHERE id=?').get(id))throw Error('Reader input identity collision; restore the matching database backup before rollback');
   sqlite.prepare('UPDATE production_jobs SET id=?,version=? WHERE id=?').run(id,version,oldId);
   sqlite.prepare('UPDATE reader_faults SET job_id=?,version=? WHERE job_id=? AND session_id=? AND owner_id=?').run(id,version,oldId,row.id,row.user_id);
   remapped.set(oldId,id);
  }
  sqlite.prepare('UPDATE reader_faults SET version=? WHERE session_id=? AND owner_id=? AND version=? AND job_id IS NULL').run(image,row.id,row.user_id,oldImage);
 }
 if(!remapped.size)return;
 for(const job of sqlite.prepare('SELECT id,dependencies FROM production_jobs WHERE json_valid(dependencies)').all()){
  const previous=JSON.parse(String(job.dependencies));if(!Array.isArray(previous))continue;
  const next=previous.map(id=>remapped.get(id)||id);if(next.some((id,i)=>id!==previous[i]))sqlite.prepare('UPDATE production_jobs SET dependencies=? WHERE id=?').run(JSON.stringify(next),job.id);
 }
 for(const command of sqlite.prepare("SELECT request_id,owner_id,payload FROM reader_commands WHERE action='recover'").all()){
  const payload=JSON.parse(String(command.payload));payload.jobs=payload.jobs.map((id:string)=>remapped.get(id)||id);payload.resolutionJob=remapped.get(payload.resolutionJob)||payload.resolutionJob;
  sqlite.prepare('UPDATE reader_commands SET payload=? WHERE request_id=? AND owner_id=?').run(JSON.stringify(payload),command.request_id,command.owner_id);
 }
}
