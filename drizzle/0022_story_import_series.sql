-- Preserve private uploaded documents and ordered series intent without replacing canonical stories.
-- Atomic action/activation triggers fence parent controls against paused child publication.
CREATE TABLE story_import_sources (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, file_name TEXT NOT NULL, format TEXT NOT NULL,
 file_sha256 TEXT NOT NULL, text_sha256 TEXT NOT NULL, original_bytes BLOB NOT NULL,
 text TEXT NOT NULL, units TEXT NOT NULL, characters INTEGER NOT NULL, word_count INTEGER NOT NULL, page_count INTEGER, warnings TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX story_import_sources_owner ON story_import_sources(owner_id,created_at);
CREATE TABLE story_series (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, source_id TEXT NOT NULL, title TEXT NOT NULL,
 settings TEXT NOT NULL, parts TEXT NOT NULL, fingerprint TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'active', version INTEGER NOT NULL DEFAULT 0, error TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 FOREIGN KEY(source_id) REFERENCES story_import_sources(id)
);
CREATE INDEX story_series_owner ON story_series(owner_id,created_at);
CREATE TABLE story_series_parts (
 series_id TEXT NOT NULL, owner_id TEXT NOT NULL, number INTEGER NOT NULL, root_id TEXT NOT NULL UNIQUE,
 plan TEXT NOT NULL, source_text TEXT NOT NULL, activated INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(series_id,number), FOREIGN KEY(series_id) REFERENCES story_series(id)
);
CREATE INDEX story_series_parts_owner ON story_series_parts(owner_id,root_id);
CREATE TABLE story_series_actions (
 request_id TEXT NOT NULL, owner_id TEXT NOT NULL, series_id TEXT NOT NULL, action TEXT NOT NULL,
 fingerprint TEXT NOT NULL, expected_version INTEGER NOT NULL, result_version INTEGER NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(owner_id,request_id), FOREIGN KEY(series_id) REFERENCES story_series(id)
);
CREATE TRIGGER story_series_action_apply AFTER INSERT ON story_series_actions BEGIN
 UPDATE story_series SET state=CASE NEW.action WHEN 'resume' THEN 'active' WHEN 'pause' THEN 'paused' ELSE 'stopped' END,
  version=NEW.result_version,error=CASE WHEN NEW.action='resume' THEN NULL ELSE error END,updated_at=NEW.created_at WHERE id=NEW.series_id AND owner_id=NEW.owner_id AND version=NEW.expected_version;
 UPDATE stories SET generation_control=CASE NEW.action WHEN 'resume' THEN 'active' WHEN 'pause' THEN 'paused' ELSE 'stopped' END,
  generation_mode=CASE WHEN NEW.action='resume' THEN 'background' ELSE generation_mode END,updated_at=NEW.created_at
  WHERE user_id=NEW.owner_id AND state!='completed'
   AND COALESCE(json_extract(CASE WHEN json_valid(document) THEN document ELSE '{}' END,'$.revision.rootId'),id) IN (SELECT root_id FROM story_series_parts WHERE series_id=NEW.series_id AND owner_id=NEW.owner_id AND activated=1)
   AND json_extract(CASE WHEN json_valid(document) THEN document ELSE '{}' END,'$.original.imported.seriesId')=NEW.series_id
   AND json_extract(CASE WHEN json_valid(document) THEN document ELSE '{}' END,'$.original.imported.partRootId')=COALESCE(json_extract(CASE WHEN json_valid(document) THEN document ELSE '{}' END,'$.revision.rootId'),id)
   AND json_type(CASE WHEN json_valid(document) THEN document ELSE '{}' END,'$.copiedFrom') IS NULL
   AND NOT EXISTS(SELECT 1 FROM stories newer WHERE newer.user_id=stories.user_id AND COALESCE(json_extract(CASE WHEN json_valid(newer.document) THEN newer.document ELSE '{}' END,'$.revision.rootId'),newer.id)=COALESCE(json_extract(CASE WHEN json_valid(stories.document) THEN stories.document ELSE '{}' END,'$.revision.rootId'),stories.id) AND COALESCE(json_extract(CASE WHEN json_valid(newer.document) THEN newer.document ELSE '{}' END,'$.revision.number'),1)>COALESCE(json_extract(CASE WHEN json_valid(stories.document) THEN stories.document ELSE '{}' END,'$.revision.number'),1));
END;
CREATE TRIGGER story_series_part_activate AFTER UPDATE OF activated ON story_series_parts
 WHEN OLD.activated=0 AND NEW.activated=1 BEGIN
 UPDATE stories SET generation_control='active',generation_mode='background',
  document=json_set(document,'$.original.imported.activated',json('true'))
  WHERE COALESCE(json_extract(CASE WHEN json_valid(document) THEN document ELSE '{}' END,'$.revision.rootId'),id)=NEW.root_id AND user_id=NEW.owner_id AND generation_control='paused' AND state='idle'
   AND json_extract(CASE WHEN json_valid(document) THEN document ELSE '{}' END,'$.original.imported.seriesId')=NEW.series_id
   AND json_extract(CASE WHEN json_valid(document) THEN document ELSE '{}' END,'$.original.imported.partRootId')=NEW.root_id
   AND NOT EXISTS(SELECT 1 FROM stories newer WHERE newer.user_id=stories.user_id AND COALESCE(json_extract(CASE WHEN json_valid(newer.document) THEN newer.document ELSE '{}' END,'$.revision.rootId'),newer.id)=NEW.root_id AND COALESCE(json_extract(CASE WHEN json_valid(newer.document) THEN newer.document ELSE '{}' END,'$.revision.number'),1)>COALESCE(json_extract(CASE WHEN json_valid(stories.document) THEN stories.document ELSE '{}' END,'$.revision.number'),1));
END;

-- Publishing an explicit current-part revision reopens a completed series without redrawing later parts.
CREATE TRIGGER story_series_revision_reopen AFTER INSERT ON stories
 WHEN json_valid(NEW.document) AND json_type(CASE WHEN json_valid(NEW.document) THEN NEW.document ELSE '{}' END,'$.revision')='object'
  AND json_type(CASE WHEN json_valid(NEW.document) THEN NEW.document ELSE '{}' END,'$.copiedFrom') IS NULL BEGIN
 UPDATE story_series SET state='active',error=NULL,version=version+1,updated_at=NEW.updated_at
  WHERE state='completed' AND owner_id=NEW.user_id AND id=json_extract(CASE WHEN json_valid(NEW.document) THEN NEW.document ELSE '{}' END,'$.original.imported.seriesId')
   AND EXISTS(SELECT 1 FROM story_series_parts p JOIN story_import_sources source ON source.id=story_series.source_id
    WHERE p.series_id=story_series.id AND p.owner_id=NEW.user_id AND source.owner_id=NEW.user_id
     AND p.root_id=json_extract(CASE WHEN json_valid(NEW.document) THEN NEW.document ELSE '{}' END,'$.revision.rootId')
     AND p.root_id=json_extract(CASE WHEN json_valid(NEW.document) THEN NEW.document ELSE '{}' END,'$.original.imported.partRootId')
     AND p.activated=1 AND p.number=json_extract(CASE WHEN json_valid(NEW.document) THEN NEW.document ELSE '{}' END,'$.original.imported.partNumber')
     AND json_array_length(story_series.parts)=json_extract(CASE WHEN json_valid(NEW.document) THEN NEW.document ELSE '{}' END,'$.original.imported.partCount')
     AND source.id=json_extract(CASE WHEN json_valid(NEW.document) THEN NEW.document ELSE '{}' END,'$.original.imported.sourceId')
     AND source.file_sha256=json_extract(CASE WHEN json_valid(NEW.document) THEN NEW.document ELSE '{}' END,'$.original.imported.fileSha256')
     AND source.text_sha256=json_extract(CASE WHEN json_valid(NEW.document) THEN NEW.document ELSE '{}' END,'$.original.imported.textSha256')
     AND json_extract(p.plan,'$.start')=json_extract(CASE WHEN json_valid(NEW.document) THEN NEW.document ELSE '{}' END,'$.original.imported.start')
     AND json_extract(p.plan,'$.end')=json_extract(CASE WHEN json_valid(NEW.document) THEN NEW.document ELSE '{}' END,'$.original.imported.end')
     AND p.source_text=json_extract(CASE WHEN json_valid(NEW.document) THEN NEW.document ELSE '{}' END,'$.original.text'));
END;

-- Series overviews resolve current family revisions without reparsing every prompt history for each part.
CREATE INDEX story_series_family_current ON stories(user_id,
 COALESCE(json_extract(CASE WHEN json_valid(document) THEN document ELSE '{}' END,'$.revision.rootId'),id),
 COALESCE(json_extract(CASE WHEN json_valid(document) THEN document ELSE '{}' END,'$.revision.number'),1));

-- Only an accepted explicit recovery command can reopen completed series production after physical image loss.
CREATE TRIGGER story_series_recovery_reopen AFTER INSERT ON reader_commands
 WHEN NEW.action='recover' AND NEW.status IN ('queued','running') BEGIN
 UPDATE story_series SET state='active',error=NULL,version=version+1,
  updated_at=strftime('%Y-%m-%dT%H:%M:%fZ',NEW.created_at/1000.0,'unixepoch')
  WHERE owner_id=NEW.owner_id AND (state='completed' OR state='active' AND error IS NOT NULL)
   AND EXISTS(SELECT 1 FROM stories s JOIN story_series_parts p ON p.series_id=story_series.id AND p.owner_id=s.user_id
    JOIN story_import_sources source ON source.id=story_series.source_id AND source.owner_id=s.user_id
    WHERE s.id=NEW.session_id AND s.user_id=NEW.owner_id AND p.activated=1
     AND p.root_id=COALESCE(json_extract(CASE WHEN json_valid(s.document) THEN s.document ELSE '{}' END,'$.revision.rootId'),s.id)
     AND json_extract(CASE WHEN json_valid(s.document) THEN s.document ELSE '{}' END,'$.copiedFrom') IS NULL
     AND json_extract(CASE WHEN json_valid(s.document) THEN s.document ELSE '{}' END,'$.original.imported.seriesId')=story_series.id
     AND json_extract(CASE WHEN json_valid(s.document) THEN s.document ELSE '{}' END,'$.original.imported.partRootId')=p.root_id
     AND json_extract(CASE WHEN json_valid(s.document) THEN s.document ELSE '{}' END,'$.original.imported.partNumber')=p.number
     AND json_extract(CASE WHEN json_valid(s.document) THEN s.document ELSE '{}' END,'$.original.imported.partCount')=json_array_length(story_series.parts)
     AND json_extract(CASE WHEN json_valid(s.document) THEN s.document ELSE '{}' END,'$.original.imported.sourceId')=source.id
     AND json_extract(CASE WHEN json_valid(s.document) THEN s.document ELSE '{}' END,'$.original.imported.fileSha256')=source.file_sha256
     AND json_extract(CASE WHEN json_valid(s.document) THEN s.document ELSE '{}' END,'$.original.imported.textSha256')=source.text_sha256
     AND json_extract(CASE WHEN json_valid(s.document) THEN s.document ELSE '{}' END,'$.original.imported.start')=json_extract(p.plan,'$.start')
     AND json_extract(CASE WHEN json_valid(s.document) THEN s.document ELSE '{}' END,'$.original.imported.end')=json_extract(p.plan,'$.end')
     AND json_extract(CASE WHEN json_valid(s.document) THEN s.document ELSE '{}' END,'$.original.text')=p.source_text);
END;
