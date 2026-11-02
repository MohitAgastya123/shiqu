-- Defaults are copied into new stories; existing publication snapshots stay independent.
CREATE TABLE reader_publication_defaults (
 owner_id TEXT PRIMARY KEY NOT NULL,
 publication TEXT NOT NULL
);
