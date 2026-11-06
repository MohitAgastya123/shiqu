// Resolve active series authority from owner-scoped reserved roots, never uploaded provenance alone.
// Eligibility is reusable in queue selection, atomic claims and the final provider-dispatch fence.
import {familyRoot,supersededSql} from '../lib/reader-repository.ts';
import type {Database} from '../lib/reader-repository.ts';
import type {SessionRow} from '../lib/reader-model.ts';
import type {StorySeriesMembership} from '../lib/story-import-contract.ts';
const document=(alias:string)=>`CASE WHEN json_valid(${alias}.document) THEN ${alias}.document ELSE '{}' END`;
const field=(alias:string,path:string)=>`json_extract(${document(alias)},'${path}')`;
function reserved(alias:string){return `p.root_id=${familyRoot(alias)} AND p.owner_id=${alias}.user_id AND r.owner_id=${alias}.user_id AND src.owner_id=${alias}.user_id
 AND ${field(alias,'$.copiedFrom')} IS NULL AND ${field(alias,'$.original.imported.partRootId')}=p.root_id
 AND ${field(alias,'$.original.imported.seriesId')}=r.id AND ${field(alias,'$.original.imported.sourceId')}=src.id
 AND ${field(alias,'$.original.imported.fileSha256')}=src.file_sha256 AND ${field(alias,'$.original.imported.textSha256')}=src.text_sha256
 AND ${field(alias,'$.original.imported.partNumber')}=p.number AND ${field(alias,'$.original.imported.partCount')}=json_array_length(r.parts)
 AND ${field(alias,'$.original.imported.start')}=json_extract(p.plan,'$.start') AND ${field(alias,'$.original.imported.end')}=json_extract(p.plan,'$.end')
 AND ${field(alias,'$.original.text')}=p.source_text`;}
const joins='story_series_parts p JOIN story_series r ON r.id=p.series_id JOIN story_import_sources src ON src.id=r.source_id';
export const completePredecessorsSql=(partAlias='p')=>`NOT EXISTS(SELECT 1 FROM story_series_parts prior WHERE prior.series_id=${partAlias}.series_id AND prior.owner_id=${partAlias}.owner_id AND prior.number<${partAlias}.number
 AND NOT EXISTS(SELECT 1 FROM stories previous WHERE previous.user_id=prior.owner_id AND ${familyRoot('previous')}=prior.root_id AND previous.state='completed' AND NOT ${supersededSql('previous')}
 AND NOT EXISTS(SELECT 1 FROM reader_faults fault WHERE fault.session_id=previous.id AND fault.owner_id=previous.user_id AND fault.state IN ('pending','recovering'))
 AND NOT EXISTS(SELECT 1 FROM library_deletions deleted WHERE deleted.user_id=previous.user_id AND deleted.story_id=previous.id)))`;
export const seriesMemberSql=(alias='stories')=>`EXISTS(SELECT 1 FROM ${joins} WHERE ${reserved(alias)})`;
export const seriesEligibleSql=(alias='stories')=>`(NOT ${seriesMemberSql(alias)} OR EXISTS(SELECT 1 FROM ${joins} WHERE ${reserved(alias)} AND r.state='active' AND r.error IS NULL AND p.activated=1 AND ${completePredecessorsSql()}))`;
export async function storySeriesMembership(db:Database,row:Pick<SessionRow,'id'|'user_id'>):Promise<StorySeriesMembership|null>{
 const result=await db.prepare(`SELECT r.id,r.title,p.number AS part,(SELECT COUNT(*) FROM story_series_parts allparts WHERE allparts.series_id=r.id AND allparts.owner_id=r.owner_id) AS parts FROM stories s JOIN story_series_parts p ON p.root_id=${familyRoot('s')} AND p.owner_id=s.user_id JOIN story_series r ON r.id=p.series_id WHERE s.id=? AND s.user_id=? AND ${seriesMemberSql('s')}`).bind(row.id,row.user_id).first<StorySeriesMembership>();
 return result||null;
}
