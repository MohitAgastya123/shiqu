-- Extend command/checkpoint transitions without rewriting an applied migration.
DROP TRIGGER IF EXISTS reader_recover_command;
DROP TRIGGER IF EXISTS reader_control_command;
DROP TRIGGER IF EXISTS reader_override_command;
DROP TRIGGER IF EXISTS reader_job_deleted;
DROP TRIGGER IF EXISTS reader_job_failed;
DROP TRIGGER IF EXISTS reader_job_queued;
DROP TRIGGER IF EXISTS reader_job_running;
DROP TRIGGER IF EXISTS reader_job_succeeded;
DROP TRIGGER IF EXISTS reader_legacy_failure;
DROP TRIGGER IF EXISTS reader_intake_command;
DROP TRIGGER IF EXISTS reader_search_command;
-- Claim, enqueue and receipt share the INSERT's transaction, including across processes.
CREATE TRIGGER reader_recover_command AFTER INSERT ON reader_commands
 WHEN NEW.action='recover' BEGIN
 UPDATE reader_faults SET state=CASE WHEN NEW.status='succeeded' THEN 'resolved' ELSE 'recovering' END,command_id=NEW.request_id,updated_at=NEW.updated_at
  WHERE id=NEW.fault_id AND owner_id=NEW.owner_id AND session_id=NEW.session_id AND state='pending';
 UPDATE production_jobs SET state='queued',error=NULL,interrupted=0,lease_token=NULL,lease_until=0,
  attempts=0,recovery_id=NEW.request_id,
  result=CASE WHEN json_extract(NEW.payload,'$.redraw')=1 THEN NULL ELSE result END,
  updated_at=NEW.updated_at
  WHERE session_id=NEW.session_id AND owner_id=NEW.owner_id
   AND id IN (SELECT value FROM json_each(NEW.payload,'$.jobs')) AND state!='running';
 UPDATE reader_sessions SET state='idle',error=NULL
  WHERE id=NEW.session_id AND user_id=NEW.owner_id AND state='failed';
END;

CREATE TRIGGER reader_control_command AFTER INSERT ON reader_commands
 WHEN NEW.action='control' BEGIN
 UPDATE reader_sessions SET
  generation_control=CASE json_extract(NEW.payload,'$.action') WHEN 'resume' THEN 'active' WHEN 'pause' THEN 'paused' WHEN 'stop' THEN 'stopped' ELSE generation_control END,
  generation_mode=CASE json_extract(NEW.payload,'$.action') WHEN 'resume' THEN 'background' WHEN 'background' THEN 'background' WHEN 'reader' THEN 'reader' ELSE generation_mode END,
  document=CASE WHEN json_extract(NEW.payload,'$.action') IN ('resume','pause') THEN json_remove(document,'$.revision.handoff') ELSE document END
  WHERE id=NEW.session_id AND user_id=NEW.owner_id;
END;

CREATE TRIGGER reader_override_command AFTER INSERT ON reader_commands
 WHEN NEW.action='override' BEGIN
 UPDATE reader_sessions SET document=json_remove(json_set(document,'$.visualReview.status','passed','$.visualReview.overridden',json('true')),'$.visualReview.stopReason'),
  state='idle',error=NULL,lock_token=NULL,lock_until=0 WHERE id=NEW.session_id AND user_id=NEW.owner_id;
 UPDATE reader_faults SET state='resolved',command_id=NEW.request_id,updated_at=NEW.updated_at
  WHERE id=NEW.fault_id AND owner_id=NEW.owner_id AND session_id=NEW.session_id AND state='pending';
 DELETE FROM production_jobs WHERE session_id=NEW.session_id AND owner_id=NEW.owner_id AND pool='text' AND kind!='discover' AND state IN ('queued','failed');
END;

CREATE TRIGGER reader_job_deleted AFTER DELETE ON production_jobs BEGIN
 UPDATE reader_faults SET state='replaced' WHERE job_id=OLD.id AND owner_id=OLD.owner_id AND state IN ('pending','recovering');
END;

-- Each ordinary failure has a fresh identity. An interrupted attempt may retain its identity.
CREATE TRIGGER reader_job_failed AFTER UPDATE OF state ON production_jobs
 WHEN NEW.state='failed' AND (OLD.state!='failed' OR NEW.failure_id IS NOT OLD.failure_id) BEGIN
 UPDATE production_jobs SET failure_id=CASE
  WHEN NEW.failure_id IS NULL OR NEW.failure_id IS OLD.failure_id THEN lower(hex(randomblob(16)))
  ELSE NEW.failure_id END WHERE id=NEW.id;
 UPDATE reader_faults SET state='replaced',updated_at=NEW.updated_at
  WHERE session_id=NEW.session_id AND owner_id=NEW.owner_id AND state IN ('pending','recovering')
   AND (command_id=NEW.recovery_id OR job_id=NEW.id)
   AND id!=(SELECT failure_id FROM production_jobs WHERE id=NEW.id);
 INSERT INTO reader_faults(id,session_id,owner_id,job_id,kind,page,version,image,message,created_at,updated_at)
  SELECT failure_id,NEW.session_id,NEW.owner_id,NEW.id,
   CASE WHEN EXISTS(SELECT 1 FROM reader_faults f WHERE f.command_id=NEW.recovery_id AND f.owner_id=NEW.owner_id AND f.kind='image-loss') THEN 'image-loss'
    WHEN NEW.error LIKE '这幅图片的文件已丢失或损坏。%' THEN 'image-loss'
    WHEN NEW.interrupted=1 THEN 'interrupted' ELSE 'job' END,
   CASE WHEN NEW.kind='image' AND NEW.error LIKE '这幅图片的文件已丢失或损坏。%' THEN 0
    WHEN NEW.kind IN ('image','image-publish') THEN json_extract(NEW.payload,'$.page') END,
   NEW.version,(SELECT image FROM reader_faults f WHERE f.command_id=NEW.recovery_id AND f.owner_id=NEW.owner_id AND f.kind='image-loss' LIMIT 1),
   COALESCE(NEW.error,'制作未完成'),NEW.updated_at,NEW.updated_at
  FROM production_jobs WHERE id=NEW.id
  ON CONFLICT(id) DO UPDATE SET state='pending',message=excluded.message,updated_at=excluded.updated_at;
 UPDATE reader_commands SET status=CASE WHEN NEW.interrupted=1 AND NEW.attempts<3 THEN 'queued' ELSE 'failed' END,
  error=NEW.error,result=json_object('jobId',NEW.id,'faultId',(SELECT failure_id FROM production_jobs WHERE id=NEW.id)),updated_at=NEW.updated_at
  WHERE request_id=NEW.recovery_id AND owner_id=NEW.owner_id AND action='recover' AND status IN ('queued','running');
END;

CREATE TRIGGER reader_job_queued AFTER UPDATE OF state ON production_jobs
 WHEN NEW.state='queued' AND OLD.state='failed' AND OLD.interrupted=1 BEGIN
 UPDATE reader_faults SET state='recovering',updated_at=NEW.updated_at
  WHERE id=NEW.failure_id AND session_id=NEW.session_id AND owner_id=NEW.owner_id AND state='pending';
 UPDATE reader_commands SET status='queued',updated_at=NEW.updated_at
  WHERE request_id=NEW.recovery_id AND owner_id=NEW.owner_id AND action='recover' AND status!='succeeded';
END;

CREATE TRIGGER reader_job_running AFTER UPDATE OF state ON production_jobs
 WHEN NEW.state='running' AND OLD.state!='running' BEGIN
 UPDATE reader_commands SET status='running',updated_at=NEW.updated_at
  WHERE request_id=NEW.recovery_id AND owner_id=NEW.owner_id AND action='recover' AND status='queued';
END;

CREATE TRIGGER reader_job_succeeded AFTER UPDATE OF state ON production_jobs
 WHEN NEW.state='succeeded' AND OLD.state!='succeeded' BEGIN
 UPDATE reader_faults SET state='resolved',updated_at=NEW.updated_at
  WHERE session_id=NEW.session_id AND owner_id=NEW.owner_id AND state IN ('pending','recovering')
   AND (job_id=NEW.id OR command_id=NEW.recovery_id AND EXISTS (
    SELECT 1 FROM reader_commands c WHERE c.owner_id=NEW.owner_id AND c.request_id=NEW.recovery_id
     AND json_extract(c.payload,'$.resolutionJob')=NEW.id))
   AND (command_id IS NULL OR command_id=NEW.recovery_id);
 UPDATE reader_commands SET status='succeeded',error=NULL,result=NEW.result,updated_at=NEW.updated_at
  WHERE request_id=NEW.recovery_id AND owner_id=NEW.owner_id AND action='recover'
   AND status IN ('queued','running') AND json_extract(payload,'$.resolutionJob')=NEW.id;
END;

INSERT INTO reader_faults(id,session_id,owner_id,kind,version,message,created_at,updated_at)
 SELECT lower(hex(randomblob(16))),s.id,s.user_id,'job','legacy',COALESCE(s.error,'制作未完成'),
 COALESCE(CAST(strftime('%s',s.updated_at) AS integer),CAST(strftime('%s','now') AS integer))*1000,COALESCE(CAST(strftime('%s',s.updated_at) AS integer),CAST(strftime('%s','now') AS integer))*1000
 FROM reader_sessions s WHERE s.state='failed' AND NOT EXISTS(
  SELECT 1 FROM reader_faults f WHERE f.session_id=s.id AND f.owner_id=s.user_id AND f.state IN ('pending','recovering'));

CREATE TRIGGER reader_legacy_failure AFTER UPDATE OF state ON reader_sessions
 WHEN NEW.state='failed' AND OLD.state!='failed'
 AND NOT EXISTS(SELECT 1 FROM production_jobs j WHERE j.session_id=NEW.id AND j.owner_id=NEW.user_id AND j.state='running')
 AND NOT EXISTS(SELECT 1 FROM reader_faults f WHERE f.session_id=NEW.id AND f.owner_id=NEW.user_id AND f.state IN ('pending','recovering')) BEGIN
 INSERT INTO reader_faults(id,session_id,owner_id,kind,version,message,created_at,updated_at)
 VALUES(lower(hex(randomblob(16))),NEW.id,NEW.user_id,'job','legacy',COALESCE(NEW.error,'制作未完成'),
 CAST(strftime('%s','now') AS integer)*1000,CAST(strftime('%s','now') AS integer)*1000);
END;

-- Intake checkpoints and their accepted command receipts are one atomic write.
CREATE TRIGGER reader_intake_command AFTER UPDATE OF document ON reader_sessions
 WHEN json_type(CASE WHEN json_valid(NEW.document) THEN NEW.document ELSE '{}' END,'$.intake.lastAction.id')='text'
 AND json_extract(NEW.document,'$.intake.lastAction.id') IS NOT json_extract(CASE WHEN json_valid(OLD.document) THEN OLD.document ELSE '{}' END,'$.intake.lastAction.id') BEGIN
 INSERT INTO reader_commands(request_id,owner_id,session_id,action,fingerprint,payload,result_id,created_at,updated_at)
 VALUES(json_extract(NEW.document,'$.intake.lastAction.id'),NEW.user_id,NEW.id,'setup',json_extract(NEW.document,'$.intake.lastAction.hash'),'{}',NEW.id,
 CAST(strftime('%s','now') AS integer)*1000,CAST(strftime('%s','now') AS integer)*1000);
END;
CREATE TRIGGER reader_search_command AFTER UPDATE OF document ON reader_sessions
 WHEN json_type(CASE WHEN json_valid(NEW.document) THEN NEW.document ELSE '{}' END,'$.intake.search.commandHash')='text'
 AND json_extract(NEW.document,'$.intake.search.requestId') IS NOT json_extract(CASE WHEN json_valid(OLD.document) THEN OLD.document ELSE '{}' END,'$.intake.search.requestId') BEGIN
 INSERT INTO reader_commands(request_id,owner_id,session_id,action,fingerprint,payload,result_id,created_at,updated_at)
 VALUES(json_extract(NEW.document,'$.intake.search.requestId'),NEW.user_id,NEW.id,'setup',json_extract(NEW.document,'$.intake.search.commandHash'),'{}',NEW.id,
 CAST(strftime('%s','now') AS integer)*1000,CAST(strftime('%s','now') AS integer)*1000);
END;
