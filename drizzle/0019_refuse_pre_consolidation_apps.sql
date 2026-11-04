-- Released 0.2-0.7 apps have no schema-version check, but each one seeds liaozhai first with its
-- source URL and demo text on every open. Abort that write so they refuse this library with a clear
-- message instead of opening it and failing every story request. The 0.8+ seed row is empty.
-- 0.7 CLI receipts show only EXPORT_/BACKUP_/SKILL_ messages, so the code uses the BACKUP_ prefix.
CREATE TRIGGER books_refuse_pre_consolidation_seed BEFORE INSERT ON books
WHEN NEW.id='liaozhai' AND (NEW.source_url<>'' OR NEW.excerpt<>'')
BEGIN
 SELECT RAISE(ABORT,'BACKUP_APP_TOO_OLD: this library requires Shiqu 0.8.0 or later; update the app, or restore the pre-upgrade backup with its matching older app');
END;
