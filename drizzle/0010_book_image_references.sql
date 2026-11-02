CREATE TABLE book_image_references (
 owner_id TEXT NOT NULL,
 book_key TEXT NOT NULL,
 story_id TEXT NOT NULL,
 page INTEGER NOT NULL,
 token TEXT NOT NULL,
 asset_key TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(owner_id,book_key)
);
CREATE TRIGGER book_image_reference_on_delete AFTER INSERT ON library_deletions
BEGIN
 DELETE FROM book_image_references WHERE owner_id=NEW.user_id AND story_id=NEW.story_id;
END;
