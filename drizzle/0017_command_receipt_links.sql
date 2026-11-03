-- Replacement commits occupy the same owner/request namespace atomically with the family CAS.
CREATE TRIGGER reader_replace_receipt AFTER UPDATE OF document ON reader_sessions
 WHEN json_type(CASE WHEN json_valid(OLD.document) THEN OLD.document ELSE '{}' END,'$.reselection')='object'
  AND json_extract(NEW.document,'$.revision.kind')='selection' BEGIN
 INSERT INTO reader_commands(request_id,owner_id,session_id,action,fingerprint,payload,result_id,created_at,updated_at)
 VALUES(json_extract(NEW.document,'$.revision.selectionRequest'),NEW.user_id,json_extract(NEW.document,'$.revision.parentId'),
  'replace',json_extract(NEW.document,'$.revision.requestHash'),'{}',NEW.id,
  CAST(strftime('%s','now') AS integer)*1000,CAST(strftime('%s','now') AS integer)*1000);
END;
INSERT INTO reader_commands(request_id,owner_id,session_id,action,fingerprint,payload,result_id,created_at,updated_at)
 SELECT json_extract(document,'$.revision.selectionRequest'),user_id,json_extract(document,'$.revision.parentId'),
 'replace',json_extract(document,'$.revision.requestHash'),'{}',id,0,0 FROM reader_sessions s
 WHERE json_extract(CASE WHEN json_valid(document) THEN document ELSE '{}' END,'$.revision.kind')='selection'
 AND NOT EXISTS(SELECT 1 FROM reader_commands c WHERE c.owner_id=s.user_id AND c.request_id=json_extract(s.document,'$.revision.selectionRequest')
  AND c.action='replace' AND c.fingerprint=json_extract(s.document,'$.revision.requestHash'));

-- Explicit local recovery can carry an already-paid legacy result into the current graph. The
-- image stays succeeded; the grant retries only publication, and a crash cannot lose the link.
CREATE TRIGGER reader_recovery_adopt AFTER INSERT ON reader_commands
 WHEN NEW.action='recover' AND json_type(NEW.payload,'$.adopt')='object' BEGIN
 UPDATE production_jobs SET state='succeeded',result=json_extract(NEW.payload,'$.adopt.result'),
  attempts=json_extract(NEW.payload,'$.adopt.attempts'),error=NULL,interrupted=0,updated_at=NEW.updated_at
 WHERE id=json_extract(NEW.payload,'$.adopt.jobId') AND session_id=NEW.session_id AND owner_id=NEW.owner_id AND state!='running';
 UPDATE reader_faults SET job_id=json_extract(NEW.payload,'$.resolutionJob'),
  version=(SELECT version FROM production_jobs WHERE id=json_extract(NEW.payload,'$.resolutionJob'))
 WHERE id=NEW.fault_id AND session_id=NEW.session_id AND owner_id=NEW.owner_id;
END;
-- When a legacy paid publication is discovered lost, its fresh failure keeps the preserved link.
CREATE TRIGGER reader_legacy_fault_lineage AFTER INSERT ON reader_faults
 WHEN NEW.job_id IS NOT NULL AND EXISTS(SELECT 1 FROM reader_faults old WHERE old.job_id=NEW.job_id
  AND old.owner_id=NEW.owner_id AND old.version='legacy' AND old.id!=NEW.id) BEGIN
 UPDATE reader_faults SET version='legacy' WHERE id=NEW.id;
END;
-- A new pre-confirmation selection/preparation generation retires failures of the old input,
-- including unmanaged legacy faults that have no queue row for the normal prune hook.
CREATE TRIGGER reader_intake_fault_generation AFTER UPDATE OF document ON reader_sessions
 WHEN json_extract(CASE WHEN json_valid(OLD.document) THEN OLD.document ELSE '{}' END,'$.intake.generation') IS NOT NULL
 AND json_extract(OLD.document,'$.intake.phase')!='confirmed'
 AND json_extract(NEW.document,'$.intake.generation')!=json_extract(OLD.document,'$.intake.generation') BEGIN
 UPDATE reader_faults SET state='replaced' WHERE session_id=NEW.id AND owner_id=NEW.user_id AND state IN ('pending','recovering');
END;

-- Cross-table occupancy is checked under the same SQLite write lock, after any racing pre-read.
CREATE TRIGGER reader_command_id_guard BEFORE INSERT ON reader_commands
 WHEN EXISTS(SELECT 1 FROM reader_sessions s WHERE s.id=NEW.request_id AND s.user_id=NEW.owner_id) BEGIN
 SELECT RAISE(ABORT,'reader_request_id_conflict');
END;
CREATE TRIGGER reader_session_id_guard BEFORE INSERT ON reader_sessions
 WHEN EXISTS(SELECT 1 FROM reader_commands c WHERE c.request_id=NEW.id AND c.owner_id=NEW.user_id) BEGIN
 SELECT RAISE(ABORT,'reader_request_id_conflict');
END;
