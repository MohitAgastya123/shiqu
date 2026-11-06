// The native gate checks only library format and recovery journals; reject unknown versions before ownership writes without reading story records.
use rusqlite::{Connection, OpenFlags};
use serde_json::Value;
use std::path::Path;

// Both distributions compile the same format declaration without runtime resource discovery.
fn library_format() -> Value {
    serde_json::from_str(include_str!("../../db/library-format.json")).unwrap()
}
fn supported_version() -> i64 {
    library_format()["schemaVersion"].as_i64().unwrap()
}
// Node applies later migrations; native code only checks that the latest migration exists.
fn latest_migration() -> String {
    library_format()["latestMigration"]
        .as_str()
        .unwrap()
        .to_string()
}
pub fn needs_upgrade(directory: &Path) -> Result<bool, String> {
    if directory
        .symlink_metadata()
        .is_ok_and(|m| m.file_type().is_symlink())
    {
        return Err("LIBRARY_UNSAFE_DIRECTORY".into());
    }
    let journal = directory.join(".desktop-upgrade.json");
    let pending = journal.symlink_metadata().is_ok();
    if pending {
        if journal
            .symlink_metadata()
            .is_ok_and(|m| m.file_type().is_symlink())
        {
            return Err("LIBRARY_UNSAFE_JOURNAL".into());
        }
        let value: Value =
            serde_json::from_slice(&std::fs::read(journal).map_err(|e| e.to_string())?)
                .map_err(|e| e.to_string())?;
        if value["version"].as_i64() != Some(supported_version()) {
            return Err("LIBRARY_NEWER_UPGRADER: unsupported recovery journal".into());
        }
        let work = value["work"].as_str().unwrap_or("");
        let suffix = work.strip_prefix(".desktop-upgrade-").unwrap_or("");
        if suffix.len() != 36
            || !suffix.bytes().enumerate().all(|(i, b)| {
                if [8, 13, 18, 23].contains(&i) {
                    b == b'-'
                } else {
                    b.is_ascii_hexdigit()
                }
            })
            || !(value.get("backup") == Some(&Value::Null) || value["backup"].is_string())
        {
            return Err("LIBRARY_INVALID_JOURNAL".into());
        }
    }
    let file = directory.join("shiqu.sqlite");
    if file
        .symlink_metadata()
        .is_ok_and(|m| m.file_type().is_symlink())
    {
        return Err("LIBRARY_UNSAFE_DATABASE".into());
    }
    if !file.exists() {
        return Ok(pending);
    }
    let database = Connection::open_with_flags(file, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| e.to_string())?;
    let version: i64 = match database.query_row("PRAGMA user_version", [], |r| r.get(0)) {
        Ok(version) => version,
        Err(_) if pending => return Ok(true),
        Err(error) => return Err(error.to_string()),
    };
    if version > supported_version() {
        return Err("LIBRARY_NEWER_SCHEMA: use a newer Shiqu app".into());
    }
    if pending {
        return Ok(true);
    }
    let column: bool = database
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM pragma_table_info('stories') WHERE name='document')",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let retired: bool = database.query_row("SELECT EXISTS(SELECT 1 FROM sqlite_schema WHERE name IN ('reader_sessions','jobs','progress'))", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    if version >= 1 && column && !retired {
        let migrated: bool = database
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM app_migrations WHERE name=?1)",
                [latest_migration()],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        return Ok(!migrated);
    }
    let historical: bool = database.query_row("SELECT EXISTS(SELECT 1 FROM pragma_table_info('reader_sessions') WHERE name='document')", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    if version == 0 && historical {
        return Ok(true);
    }
    Err("LIBRARY_UNKNOWN_SCHEMA".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn refusal_precedes_ownership_writes() {
        let folder =
            std::env::temp_dir().join(format!("shiqu-format-refusal-{}", std::process::id()));
        std::fs::create_dir_all(&folder).unwrap();
        let file = folder.join("shiqu.sqlite");
        let db = Connection::open(&file).unwrap();
        db.execute_batch("PRAGMA user_version=999").unwrap();
        drop(db);
        let before = std::fs::read(&file).unwrap();
        assert!(needs_upgrade(&folder).unwrap_err().contains("NEWER_SCHEMA"));
        assert_eq!(before, std::fs::read(&file).unwrap());
        std::fs::remove_file(&file).unwrap();
        for journal in [
            r#"{"version":999}"#,
            r#"{"version":1}"#,
            r#"{"version":1,"work":"../bad","backup":null}"#,
        ] {
            std::fs::write(folder.join(".desktop-upgrade.json"), journal).unwrap();
            assert!(needs_upgrade(&folder).is_err());
            assert!(!folder.join(".desktop.lock").exists());
            assert!(!folder.join(".desktop-owner.sqlite").exists());
        }
        std::fs::remove_dir_all(folder).unwrap();
    }
}
