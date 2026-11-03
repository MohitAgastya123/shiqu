-- Faults survive document checkpoints; receipts consume one user authorization atomically.
ALTER TABLE production_jobs ADD failure_id text;
ALTER TABLE production_jobs ADD recovery_id text;

CREATE TABLE reader_faults (
 id text PRIMARY KEY NOT NULL,
 session_id text NOT NULL,
 owner_id text NOT NULL,
 job_id text,
 kind text NOT NULL,
 page integer,
 version text NOT NULL,
 image text,
 message text NOT NULL,
 state text DEFAULT 'pending' NOT NULL,
 command_id text,
 created_at integer NOT NULL,
 updated_at integer NOT NULL
);
CREATE INDEX reader_faults_session ON reader_faults(session_id,owner_id,state);
CREATE UNIQUE INDEX reader_faults_image ON reader_faults(session_id,owner_id,page)
 WHERE kind='image-loss' AND state IN ('pending','recovering');

CREATE TABLE reader_commands (
 request_id text NOT NULL,
 owner_id text NOT NULL,
 session_id text NOT NULL,
 action text NOT NULL,
 fingerprint text NOT NULL,
 payload text NOT NULL,
 fault_id text,
 result_id text,
 status text DEFAULT 'succeeded' NOT NULL,
 result text,
 error text,
 created_at integer NOT NULL,
 updated_at integer NOT NULL,
 PRIMARY KEY(owner_id,request_id)
);
CREATE INDEX reader_commands_session ON reader_commands(session_id,owner_id);

-- Claim, enqueue and receipt share the INSERT's transaction, including across processes.
CREATE TRIGGER reader_recover_command AFTER INSERT ON reader_commands
 WHEN NEW.action='recover' BEGIN
 UPDATE reader_faults SET state='recovering',command_id=NEW.request_id,updated_at=NEW.updated_at
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

-- Each ordinary failure has a fresh identity. An interrupted attempt may retain its identity.
CREATE TRIGGER reader_job_failed AFTER UPDATE OF state ON production_jobs
 WHEN NEW.state='failed' AND (OLD.state!='failed' OR NEW.failure_id IS NOT OLD.failure_id) BEGIN
 UPDATE production_jobs SET failure_id=CASE
  WHEN NEW.failure_id IS NULL OR NEW.failure_id IS OLD.failure_id THEN lower(hex(randomblob(16)))
  ELSE NEW.failure_id END WHERE id=NEW.id;
 UPDATE reader_faults SET state='replaced',updated_at=NEW.updated_at
  WHERE session_id=NEW.session_id AND owner_id=NEW.owner_id AND state='recovering'
   AND (command_id=NEW.recovery_id OR job_id=NEW.id)
   AND id!=(SELECT failure_id FROM production_jobs WHERE id=NEW.id);
 INSERT INTO reader_faults(id,session_id,owner_id,job_id,kind,page,version,message,created_at,updated_at)
  SELECT failure_id,NEW.session_id,NEW.owner_id,NEW.id,
   CASE WHEN NEW.interrupted=1 THEN 'interrupted' ELSE 'job' END,
   CASE WHEN NEW.kind IN ('image','image-publish') THEN json_extract(NEW.payload,'$.page') END,
   NEW.version,COALESCE(NEW.error,'制作未完成'),NEW.updated_at,NEW.updated_at
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

-- Saved pre-upgrade failures become stable, explicitly recoverable checkpoints, never new work.
UPDATE production_jobs SET failure_id=lower(hex(randomblob(16))) WHERE state='failed';
INSERT INTO reader_faults(id,session_id,owner_id,job_id,kind,page,version,message,created_at,updated_at)
 SELECT failure_id,session_id,owner_id,id,CASE WHEN interrupted=1 THEN 'interrupted' ELSE 'job' END,
 CASE WHEN kind IN ('image','image-publish') THEN json_extract(payload,'$.page') END,
 version,COALESCE(error,'制作未完成'),updated_at,updated_at FROM production_jobs WHERE state='failed';
