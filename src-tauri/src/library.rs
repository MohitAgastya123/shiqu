// Read summaries and manage reversible reader tombstones without starting generation or deleting media.
use rusqlite::{Connection, OpenFlags};
use serde_json::{json, Value};
use std::{path::Path, time::Duration};

// The declaration is compiled into both distributions; no runtime asset lookup is needed.
fn supported_version() -> i64 {
    serde_json::from_str::<Value>(include_str!("../../db/library-format.json")).unwrap()
        ["schemaVersion"]
        .as_i64()
        .unwrap()
}
pub fn needs_upgrade(directory: &Path) -> Result<bool, String> {
    let journal = directory.join(".desktop-upgrade.json");
    if journal.exists() {
        let value: Value =
            serde_json::from_slice(&std::fs::read(journal).map_err(|e| e.to_string())?)
                .map_err(|e| e.to_string())?;
        if value["version"].as_i64() != Some(supported_version()) {
            return Err("LIBRARY_NEWER_UPGRADER: unsupported recovery journal".into());
        }
        return Ok(true);
    }
    let file = directory.join("shiqu.sqlite");
    if !file.exists() {
        return Ok(false);
    }
    let database = Connection::open_with_flags(file, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| e.to_string())?;
    let version: i64 = database
        .query_row("PRAGMA user_version", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    if version > supported_version() {
        return Err("LIBRARY_NEWER_SCHEMA: use a newer Shiqu app".into());
    }
    let column: bool = database
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM pragma_table_info('stories') WHERE name='document')",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let retired: bool = database.query_row("SELECT EXISTS(SELECT 1 FROM sqlite_schema WHERE name IN ('reader_sessions','jobs','progress'))", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    if version == supported_version() && column && !retired {
        return Ok(false);
    }
    let historical: bool = database.query_row("SELECT EXISTS(SELECT 1 FROM pragma_table_info('reader_sessions') WHERE name='document')", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    if version == 0 && historical {
        return Ok(true);
    }
    Err("LIBRARY_UNKNOWN_SCHEMA".into())
}
fn gate(directory: &Path) -> Result<Connection, String> {
    if needs_upgrade(directory)? {
        return Err("LIBRARY_UPGRADE_REQUIRED".into());
    }
    let gate = Connection::open(directory.join(".desktop-upgrade-lock.sqlite"))
        .map_err(|e| e.to_string())?;
    gate.execute_batch("PRAGMA busy_timeout=0; BEGIN EXCLUSIVE")
        .map_err(|_| "DATA_BUSY: library upgrade in progress".to_string())?;
    if needs_upgrade(directory)? {
        return Err("LIBRARY_UPGRADE_REQUIRED".into());
    }
    Ok(gate)
}

pub fn summary(directory: &Path) -> Result<Value, String> {
    let file = directory.join("shiqu.sqlite");
    if !file.exists() {
        if needs_upgrade(directory)? {
            return Err("LIBRARY_UPGRADE_REQUIRED".into());
        }
        return Ok(json!({"stories": []}));
    }
    let _gate = gate(directory)?;
    let read = || -> Result<Value, Box<dyn std::error::Error>> {
        let database = Connection::open_with_flags(file, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
        database.busy_timeout(Duration::from_secs(1))?;
        let value: String =
            database.query_row(include_str!("../../desktop/library.sql"), [], |row| {
                row.get(0)
            })?;
        let mut result: Value = serde_json::from_str(&value)?;
        let report = directory.join(".desktop-upgrade-result.json");
        if report.exists() {
            let report: Value = serde_json::from_slice(&std::fs::read(report)?)?;
            if let Some(backup) = report["backup"].as_str() {
                result["upgradeBackup"] = json!(backup);
            }
        }
        Ok(result)
    };
    read().map_err(|_| "无法读取本地书架，请检查数据目录及数据库版本。".into())
}

pub fn set_deleted(directory: &Path, id: &str, deleted: bool) -> Result<(), String> {
    let _gate = gate(directory)?;
    let update = || -> Result<(), Box<dyn std::error::Error>> {
        let mut database = Connection::open_with_flags(
            directory.join("shiqu.sqlite"),
            OpenFlags::SQLITE_OPEN_READ_WRITE,
        )?;
        database.busy_timeout(Duration::from_secs(5))?;
        let transaction =
            database.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
        let exists: bool = transaction.query_row(
            "SELECT EXISTS(SELECT 1 FROM stories WHERE id=?1)",
            [id],
            |row| row.get(0),
        )?;
        if !exists {
            return Err("Story not found".into());
        }
        transaction.execute(
            if deleted {
                include_str!("../../desktop/library-delete.sql")
            } else {
                include_str!("../../desktop/library-restore.sql")
            },
            [id],
        )?;
        transaction.commit()?;
        Ok(())
    };
    update().map_err(|_| "故事暂时无法更新，请重试。".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_refusal_and_shared_gate_precede_native_writes() {
        let folder =
            std::env::temp_dir().join(format!("shiqu-library-gate-{}", std::process::id()));
        std::fs::create_dir_all(&folder).unwrap();
        let file = folder.join("shiqu.sqlite");
        let db = Connection::open(&file).unwrap();
        db.execute_batch(
            "CREATE TABLE stories(id TEXT,user_id TEXT,document TEXT); PRAGMA user_version=2;",
        )
        .unwrap();
        drop(db);
        let before = std::fs::read(&file).unwrap();
        assert!(summary(&folder).unwrap_err().contains("NEWER_SCHEMA"));
        assert!(set_deleted(&folder, "id", true)
            .unwrap_err()
            .contains("NEWER_SCHEMA"));
        assert_eq!(std::fs::read(&file).unwrap(), before);
        assert!(!folder.join(".desktop-upgrade-lock.sqlite").exists());
        let db = Connection::open(&file).unwrap();
        db.execute_batch("PRAGMA user_version=1").unwrap();
        drop(db);
        let lock = Connection::open(folder.join(".desktop-upgrade-lock.sqlite")).unwrap();
        lock.execute_batch("BEGIN EXCLUSIVE").unwrap();
        assert!(summary(&folder).unwrap_err().contains("DATA_BUSY"));
        assert!(set_deleted(&folder, "id", true)
            .unwrap_err()
            .contains("DATA_BUSY"));
        drop(lock);
        std::fs::remove_dir_all(folder).unwrap();
    }

    #[test]
    fn summary_reads_existing_data_without_creating_a_missing_library() {
        let folder =
            std::env::temp_dir().join(format!("shiqu-library-summary-{}", std::process::id()));
        assert_eq!(summary(&folder).unwrap(), json!({"stories": []}));
        assert!(!folder.exists());
        std::fs::create_dir(&folder).unwrap();
        let file = folder.join("shiqu.sqlite");
        let database = Connection::open(&file).unwrap();
        for migration in [
            include_str!("../../drizzle/0000_bitter_dragon_lord.sql"),
            include_str!("../../drizzle/0001_perfect_lester.sql"),
            include_str!("../../drizzle/0002_absent_tempest.sql"),
            include_str!("../../drizzle/0003_flowery_jetstream.sql"),
        ] {
            database.execute_batch(migration).unwrap();
        }
        database.execute("INSERT INTO reader_sessions (id,user_id,selection,document,state,created_at,updated_at) VALUES ('test','owner','{\"bookId\":\"book\",\"storyTitle\":\"故事\"}','{\"plan\":null,\"images\":[]}', 'idle','2026-10-29','2026-10-29')", []).unwrap();
        database.execute_batch("DROP TABLE stories; DROP TABLE jobs; DROP TABLE progress; ALTER TABLE reader_sessions RENAME TO stories; PRAGMA user_version=1;").unwrap();
        drop(database);
        let before = std::fs::read(&file).unwrap();
        let result = summary(&folder).unwrap();
        assert_eq!(result["stories"][0]["title"], "故事");
        assert_eq!(result["stories"][0]["jobs"], 0);
        assert_eq!(std::fs::read(&file).unwrap(), before);
        set_deleted(&folder, "test", true).unwrap();
        set_deleted(&folder, "test", true).unwrap();
        assert_eq!(summary(&folder).unwrap(), json!({"stories": []}));
        set_deleted(&folder, "test", false).unwrap();
        set_deleted(&folder, "test", false).unwrap();
        assert_eq!(summary(&folder).unwrap(), result);
        assert!(set_deleted(&folder, "missing", true).is_err());
        std::fs::remove_dir_all(folder).unwrap();
    }
}
