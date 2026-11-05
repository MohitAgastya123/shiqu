-- A rejected review inherited by a revision is already failed at INSERT, so the
-- ordinary UPDATE failure trigger cannot create its recovery authorization.
-- Keep the child and its own fault atomic; parent faults remain parent-owned.
CREATE TRIGGER stories_blocked_revision_fault AFTER INSERT ON stories
 WHEN NEW.state='failed' AND json_valid(NEW.document)
 AND json_type(NEW.document,'$.revision.parentId')='text'
 AND json_extract(NEW.document,'$.visualReview.status')='blocked'
 AND COALESCE(json_extract(NEW.document,'$.visualReview.overridden'),0)=0
 AND NOT EXISTS(SELECT 1 FROM reader_faults f WHERE f.session_id=NEW.id
  AND f.owner_id=NEW.user_id AND f.state IN ('pending','recovering')) BEGIN
 INSERT INTO reader_faults(id,session_id,owner_id,kind,version,message,created_at,updated_at)
 VALUES(lower(hex(randomblob(16))),NEW.id,NEW.user_id,'job','legacy',COALESCE(NEW.error,'制作未完成'),
  CAST(strftime('%s','now') AS integer)*1000,CAST(strftime('%s','now') AS integer)*1000);
END;

-- Repair only stranded blocked revisions; existing authorizations keep their IDs.
INSERT INTO reader_faults(id,session_id,owner_id,kind,version,message,created_at,updated_at)
 SELECT lower(hex(randomblob(16))),s.id,s.user_id,'job','legacy',COALESCE(s.error,'制作未完成'),
 CAST(strftime('%s','now') AS integer)*1000,CAST(strftime('%s','now') AS integer)*1000
 FROM stories s WHERE s.state='failed' AND json_valid(s.document)
 AND json_type(s.document,'$.revision.parentId')='text'
 AND json_extract(s.document,'$.visualReview.status')='blocked'
 AND COALESCE(json_extract(s.document,'$.visualReview.overridden'),0)=0
 AND NOT EXISTS(SELECT 1 FROM reader_faults f WHERE f.session_id=s.id
  AND f.owner_id=s.user_id AND f.state IN ('pending','recovering'));
