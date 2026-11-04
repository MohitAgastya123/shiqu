-- The coordinator inventories files and verifies recovery before this destructive transaction.
DELETE FROM book_image_references WHERE story_id NOT IN (SELECT id FROM reader_sessions);
DELETE FROM events WHERE story_id NOT IN (SELECT id FROM reader_sessions);
DELETE FROM library_deletions WHERE kind='published';
-- liaozhai returns to the seed placeholder so upgraded and new libraries hold the same catalog row.
UPDATE books SET excerpt='',source_url='',note=CASE id WHEN 'liaozhai' THEN '待录入选定篇目的原文与来源。' ELSE '' END WHERE id IN ('liaozhai','zhongshanlang');
DELETE FROM books WHERE id='zhongshanlang' AND NOT EXISTS (
 SELECT 1 FROM reader_sessions WHERE json_extract(selection,'$.bookId')='zhongshanlang');
DROP TABLE stories;
DROP TABLE jobs;
DROP TABLE progress;
ALTER TABLE reader_sessions RENAME TO stories;
PRAGMA user_version=1;
