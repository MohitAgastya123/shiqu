-- The loss record and completion revocation must survive a crash as one transaction.
CREATE TRIGGER reader_image_lost AFTER INSERT ON reader_faults WHEN NEW.kind='image-loss' BEGIN
 UPDATE reader_sessions SET state=CASE WHEN state='running' THEN state ELSE 'failed' END,error=NEW.message
  WHERE id=NEW.session_id AND user_id=NEW.owner_id;
END;

-- A restored original is a saved result, not new drawing permission. Close its failed local/model
-- checkpoint, or requeue only the dependent call that failed before inference on its missing anchor.
CREATE TRIGGER reader_image_restored AFTER UPDATE OF state ON reader_faults
 WHEN OLD.state='pending' AND NEW.state='resolved' AND NEW.kind='image-loss' BEGIN
 UPDATE production_jobs SET
  state=CASE WHEN CAST(json_extract(payload,'$.page') AS integer)=NEW.page THEN 'succeeded' ELSE 'queued' END,
  result=CASE WHEN CAST(json_extract(payload,'$.page') AS integer)=NEW.page THEN
   json_object('value',(SELECT json_extract(document,'$.images['||NEW.page||']') FROM reader_sessions WHERE id=NEW.session_id AND user_id=NEW.owner_id),'model','saved','requestId',NULL,'usage',NULL) ELSE result END,
  error=NULL,interrupted=0,lease_token=NULL,lease_until=0,updated_at=NEW.updated_at
 WHERE id=NEW.job_id AND session_id=NEW.session_id AND owner_id=NEW.owner_id AND state='failed'
  AND kind IN ('image','image-publish')
  AND (NEW.command_id IS NOT NULL OR error LIKE '这幅图片的文件已丢失或损坏。%')
  AND EXISTS(SELECT 1 FROM reader_sessions s WHERE s.id=NEW.session_id AND s.user_id=NEW.owner_id
   AND COALESCE(json_extract(s.document,'$.images['||NEW.page||']'),'')!='');
 UPDATE reader_sessions SET state=CASE
  WHEN json_type(document,'$.plan')='object' AND json_type(document,'$.original')='object'
   AND (json_type(document,'$.intake') IS NULL OR json_extract(document,'$.intake.phase')='confirmed')
   AND (json_type(document,'$.visualReview') IS NULL OR json_extract(document,'$.visualReview.status')='passed' OR json_extract(document,'$.visualReview.overridden')=1)
   AND NOT EXISTS(SELECT 1 FROM json_each(document,'$.plan.pages') p WHERE COALESCE(json_extract(document,'$.images['||p.key||']'),'')='')
  THEN 'completed' ELSE 'idle' END,error=NULL WHERE id=NEW.session_id AND user_id=NEW.owner_id AND state='failed'
  AND NOT EXISTS(SELECT 1 FROM reader_faults f WHERE f.session_id=NEW.session_id AND f.owner_id=NEW.owner_id AND f.state IN ('pending','recovering'));
END;
