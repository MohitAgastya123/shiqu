-- English recovery messages retain the same atomic fault and restored-image transitions.
-- Recognize historical prefixes without changing previously applied migrations.
DROP TRIGGER IF EXISTS reader_job_failed;
DROP TRIGGER IF EXISTS reader_image_restored;
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
    WHEN (NEW.error LIKE '这幅图片的文件已丢失或损坏。%' OR NEW.error LIKE 'This image file is missing or damaged.%') THEN 'image-loss'
    WHEN NEW.interrupted=1 THEN 'interrupted' ELSE 'job' END,
   CASE WHEN NEW.kind='image' AND (NEW.error LIKE '这幅图片的文件已丢失或损坏。%' OR NEW.error LIKE 'This image file is missing or damaged.%') THEN 0
    WHEN NEW.kind IN ('image','image-publish') THEN json_extract(NEW.payload,'$.page') END,
   NEW.version,(SELECT image FROM reader_faults f WHERE f.command_id=NEW.recovery_id AND f.owner_id=NEW.owner_id AND f.kind='image-loss' LIMIT 1),
   COALESCE(NEW.error,'Production did not complete.'),NEW.updated_at,NEW.updated_at
  FROM production_jobs WHERE id=NEW.id
  ON CONFLICT(id) DO UPDATE SET state='pending',message=excluded.message,updated_at=excluded.updated_at;
 UPDATE reader_commands SET status=CASE WHEN NEW.interrupted=1 AND NEW.attempts<3 THEN 'queued' ELSE 'failed' END,
  error=NEW.error,result=json_object('jobId',NEW.id,'faultId',(SELECT failure_id FROM production_jobs WHERE id=NEW.id)),updated_at=NEW.updated_at
  WHERE request_id=NEW.recovery_id AND owner_id=NEW.owner_id AND action='recover' AND status IN ('queued','running');
END;

CREATE TRIGGER reader_image_restored AFTER UPDATE OF state ON reader_faults
 WHEN OLD.state='pending' AND NEW.state='resolved' AND NEW.kind='image-loss' BEGIN
 UPDATE production_jobs SET
  state=CASE WHEN CAST(json_extract(payload,'$.page') AS integer)=NEW.page THEN 'succeeded' ELSE 'queued' END,
  result=CASE WHEN CAST(json_extract(payload,'$.page') AS integer)=NEW.page THEN
   json_object('value',(SELECT json_extract(document,'$.images['||NEW.page||']') FROM stories WHERE id=NEW.session_id AND user_id=NEW.owner_id),'model','saved','requestId',NULL,'usage',NULL) ELSE result END,
  error=NULL,interrupted=0,lease_token=NULL,lease_until=0,updated_at=NEW.updated_at
 WHERE id=NEW.job_id AND session_id=NEW.session_id AND owner_id=NEW.owner_id AND state='failed'
  AND kind IN ('image','image-publish')
  AND (NEW.command_id IS NOT NULL OR (error LIKE '这幅图片的文件已丢失或损坏。%' OR error LIKE 'This image file is missing or damaged.%'))
  AND EXISTS(SELECT 1 FROM stories s WHERE s.id=NEW.session_id AND s.user_id=NEW.owner_id
   AND COALESCE(json_extract(s.document,'$.images['||NEW.page||']'),'')!='');
 UPDATE stories SET state=CASE
  WHEN json_type(document,'$.plan')='object' AND json_type(document,'$.original')='object'
   AND (json_type(document,'$.intake') IS NULL OR json_extract(document,'$.intake.phase')='confirmed')
   AND (json_type(document,'$.visualReview') IS NULL OR json_extract(document,'$.visualReview.status')='passed' OR json_extract(document,'$.visualReview.overridden')=1)
   AND NOT EXISTS(SELECT 1 FROM json_each(document,'$.plan.pages') p WHERE COALESCE(json_extract(document,'$.images['||p.key||']'),'')='')
  THEN 'completed' ELSE 'idle' END,error=NULL WHERE id=NEW.session_id AND user_id=NEW.owner_id AND state='failed'
  AND NOT EXISTS(SELECT 1 FROM reader_faults f WHERE f.session_id=NEW.session_id AND f.owner_id=NEW.owner_id AND f.state IN ('pending','recovering'));
END;
