// English native controls and diagnostics; persisted identifiers and source data are unchanged.
// Keep desktop privileges in local-only native commands; reader/phone pages never load this bridge.
mod config;
mod library;
mod runtime;

use config::Settings;
use serde_json::{json, Value};
use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

#[derive(Default)]
struct Control {
    runtime: Option<runtime::Runtime>,
    last_error: Option<String>,
}
#[derive(Clone, Default)]
struct DesktopState(Arc<Mutex<Control>>);

async fn blocking<T: Send + 'static>(
    operation: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(operation)
        .await
        .map_err(|_| "The desktop operation did not complete. Retry.".to_string())?
}
fn resource_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if cfg!(debug_assertions) {
        return Ok(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../desktop/resources/runtime"));
    }
    Ok(app
        .path()
        .resource_dir()
        .map_err(|_| "The app resources directory could not be determined.")?
        .join("runtime"))
}
fn settings_view(app: &tauri::AppHandle, control: &mut Control) -> Result<Value, String> {
    let store = open_store(app, control)?;
    let (settings, revision, gemini, openai) = store.settings_snapshot()?;
    let key_present = match settings.provider.as_str() {
        "gemini" => gemini,
        "openai" => openai,
        _ => false,
    };
    Ok(
        json!({"settings":settings,"revision":revision,"keyPresent":key_present,"providerKeys":{"gemini":gemini,"openai":openai},"runtimeConfigured":provider_configuration(&store).map(|(settings,key)| settings.provider=="codex" || settings.provider=="readonly" || !key.is_empty()).unwrap_or(false),"credentialError":null,"platform":std::env::consts::OS}),
    )
}
fn open_store(app: &tauri::AppHandle, _control: &mut Control) -> Result<config::Store, String> {
    let (file, data) = config::directories(app)?;
    config::Store::open(&file, &data)
}
// Invocation overrides never mutate the saved settings or import environment credentials.
fn provider_configuration(store: &config::Store) -> Result<(Settings, String), String> {
    provider_configuration_with(store, |name| std::env::var(name).ok())
}
fn provider_configuration_with(
    store: &config::Store,
    read: impl Fn(&str) -> Option<String>,
) -> Result<(Settings, String), String> {
    let mut settings = store.settings()?;
    if let Some(value) = read("SHIQU_AI_PROVIDER") {
        settings.provider = value;
    }
    for (name, target) in [
        ("GEMINI_TEXT_MODEL", &mut settings.text_model),
        ("GEMINI_IMAGE_MODEL", &mut settings.image_model),
        ("OPENAI_TEXT_MODEL", &mut settings.openai_text_model),
        ("OPENAI_IMAGE_MODEL", &mut settings.openai_image_model),
        ("CODEX_MODEL", &mut settings.codex_model),
        ("CODEX_BIN", &mut settings.codex_path),
        ("SHIQU_CODEX_HOME", &mut settings.codex_home),
        (
            "CODEX_REASONING_EFFORT",
            &mut settings.codex_reasoning_effort,
        ),
    ] {
        if let Some(value) = read(name) {
            *target = value;
        }
    }
    let mut efforts =
        serde_json::to_value(&settings.task_reasoning_efforts).map_err(|_| "Invalid task reasoning settings.")?;
    for task in [
        "suggest", "art", "frames", "outline", "plan", "review", "repair",
    ] {
        if let Some(value) = read(&format!("SHIQU_REASONING_{}", task.to_uppercase())) {
            efforts[task] = value.into();
        }
    }
    settings.task_reasoning_efforts =
        serde_json::from_value(efforts).map_err(|_| "Invalid task reasoning settings.")?;
    settings.validate()?;
    let name = match settings.provider.as_str() {
        "openai" => Some("OPENAI_API_KEY"),
        "gemini" => Some("GEMINI_API_KEY"),
        _ => None,
    };
    let key = match name.and_then(&read) {
        Some(value) => config::validate_key(&value)?,
        None => store.key_for(&settings.provider)?,
    };
    Ok((settings, key))
}

#[tauri::command]
async fn get_settings(
    app: tauri::AppHandle,
    state: tauri::State<'_, DesktopState>,
) -> Result<Value, String> {
    let shared = state.0.clone();
    blocking(move || {
        let mut control = shared.lock().map_err(|_| "The service controller is unavailable.")?;
        settings_view(&app, &mut control)
    })
    .await
}

#[tauri::command]
async fn library_summary(
    app: tauri::AppHandle,
    state: tauri::State<'_, DesktopState>,
) -> Result<Value, String> {
    let shared = state.0.clone();
    blocking(move || {
        let settings = {
            let mut control = shared.lock().map_err(|_| "The service controller is unavailable.")?;
            open_store(&app, &mut control)?.settings()?
        };
        runtime::ensure_library(&settings, &resource_root(&app)?)?;
        library::summary(std::path::Path::new(&settings.data_directory))
    })
    .await
}

#[tauri::command]
async fn set_library_story_deleted(
    app: tauri::AppHandle,
    state: tauri::State<'_, DesktopState>,
    id: String,
    deleted: bool,
) -> Result<(), String> {
    let shared = state.0.clone();
    blocking(move || {
        let settings = {
            let mut control = shared.lock().map_err(|_| "The service controller is unavailable.")?;
            open_store(&app, &mut control)?.settings()?
        };
        runtime::ensure_library(&settings, &resource_root(&app)?)?;
        library::set_deleted(std::path::Path::new(&settings.data_directory), &id, deleted)
    })
    .await
}

#[tauri::command]
async fn save_settings(
    app: tauri::AppHandle,
    state: tauri::State<'_, DesktopState>,
    mut settings: Settings,
    expected_revision: Option<i64>,
    key_action: String,
    key: String,
) -> Result<Value, String> {
    let shared = state.0.clone();
    blocking(move || {
        let mut guard = shared.lock().map_err(|_| "The service controller is unavailable.")?;
        if guard.runtime.is_some() {
            return Err("Stop the service before changing settings or keys.".into());
        }
        let replacement;
        let change = match key_action.as_str() {
            "keep" => config::KeyChange::Keep,
            "replace" => {
                replacement = config::validate_key(&key)?;
                config::KeyChange::Set(&replacement)
            }
            "delete" => config::KeyChange::Delete,
            _ => return Err("Invalid key operation.".into()),
        };
        let mut store = open_store(&app, &mut guard)?;
        settings.library_configured = true;
        settings.provider_configured = match settings.provider.as_str() {
            "gemini" | "openai" => {
                if key_action == "replace" {
                    true
                } else if key_action == "delete" {
                    false
                } else {
                    !store.key_for(&settings.provider)?.is_empty()
                }
            }
            _ => true,
        };
        store.save_at(&settings, change, expected_revision)?;
        drop(store);
        settings_view(&app, &mut guard)
    })
    .await
}

#[tauri::command]
async fn reset_providers(
    app: tauri::AppHandle,
    state: tauri::State<'_, DesktopState>,
) -> Result<Value, String> {
    let shared = state.0.clone();
    blocking(move || {
        let mut control = shared.lock().map_err(|_| "The service controller is unavailable.")?;
        if control.runtime.is_some() {
            return Err("Stop the service before resetting configuration.".into());
        }
        open_store(&app, &mut control)?.reset_providers()?;
        settings_view(&app, &mut control)
    })
    .await
}

#[tauri::command]
async fn detect_node(
    app: tauri::AppHandle,
    node_path: String,
) -> Result<runtime::NodeInfo, String> {
    blocking(move || runtime::node_info(&node_path, &resource_root(&app)?)).await
}

#[tauri::command]
async fn choose_path(app: tauri::AppHandle, kind: String) -> Result<Option<String>, String> {
    blocking(move || {
        let dialog = app.dialog().file();
        let chosen = match kind.as_str() {
            "codex" => dialog.blocking_pick_file(),
            "data" | "codexHome" => dialog.blocking_pick_folder(),
            _ => return Err("Invalid file selection type.".into()),
        };
        chosen
            .map(|file| {
                file.into_path()
                    .map(|path| path.to_string_lossy().into())
                    .map_err(|_| "Choose a local path.".into())
            })
            .transpose()
    })
    .await
}

#[tauri::command]
async fn start_server(
    app: tauri::AppHandle,
    state: tauri::State<'_, DesktopState>,
) -> Result<Value, String> {
    let shared = state.0.clone();
    blocking(move || {
        let mut control = shared.lock().map_err(|_| "The service controller is unavailable.")?;
        if let Some(runtime) = &mut control.runtime {
            return Ok(runtime.snapshot());
        }
        let store = open_store(&app, &mut control)?;
        let (settings, key) = provider_configuration(&store)?;
        if !["readonly", "codex"].contains(&settings.provider.as_str()) && key.is_empty() {
            return Err("Configure a generation provider first, or choose read-only mode.".into());
        }
        match runtime::start(&settings, &key, &resource_root(&app)?) {
            Ok(runtime) => {
                let result = runtime.status.clone();
                control.runtime = Some(runtime);
                control.last_error = None;
                Ok(result)
            }
            Err(error) => {
                control.last_error = Some(error.clone());
                Err(error)
            }
        }
    })
    .await
}

fn stop_control(state: &DesktopState) {
    if let Ok(mut control) = state.0.lock() {
        drop(control.runtime.take());
        control.last_error = None;
    }
}
#[tauri::command]
async fn stop_server(state: tauri::State<'_, DesktopState>) -> Result<Value, String> {
    let state = state.inner().clone();
    blocking(move || {
        stop_control(&state);
        Ok(json!({"running":false,"phoneUrls":[]}))
    })
    .await
}
#[tauri::command]
async fn server_status(state: tauri::State<'_, DesktopState>) -> Result<Value, String> {
    let shared = state.0.clone();
    blocking(move || {
        let mut control = shared.lock().map_err(|_| "The service controller is unavailable.")?;
        if let Some(runtime) = &mut control.runtime {
            match runtime.child.try_wait() {
                Ok(None) => return Ok(runtime.snapshot()),
                _ => {
                    drop(control.runtime.take());
                    control.last_error = Some("The service exited. Check settings and restart it.".into());
                }
            }
        }
        Ok(json!({"running":false,"phoneUrls":[],"error":control.last_error}))
    })
    .await
}

#[tauri::command]
async fn test_provider(
    app: tauri::AppHandle,
    state: tauri::State<'_, DesktopState>,
) -> Result<Value, String> {
    let shared = state.0.clone();
    blocking(move || {
        let mut guard = shared.lock().map_err(|_| "The service controller is unavailable.")?;
        if guard.runtime.is_some() {
            return Err("Stop the service before testing configuration.".into());
        }
        let store = open_store(&app, &mut guard)?;
        let (settings, credential) = provider_configuration(&store)?;
        let (mut child, result, _updates) =
            runtime::launch(&settings, &credential, &resource_root(&app)?, "test")?;
        drop(child.stdin.take());
        let _ = child.wait();
        Ok(result)
    })
    .await
}

#[tauri::command]
fn open_reader(app: tauri::AppHandle, state: tauri::State<'_, DesktopState>) -> Result<(), String> {
    let control = state.0.lock().map_err(|_| "The service controller is unavailable.")?;
    let url = control
        .runtime
        .as_ref()
        .and_then(|runtime| runtime.status["url"].as_str())
        .ok_or("Start the service first.")?;
    let parsed = tauri::Url::parse(url).map_err(|_| "Invalid service address.")?;
    if parsed.scheme() != "http"
        || parsed.host_str() != Some("127.0.0.1")
        || parsed.path() != "/"
        || parsed.query().is_some()
        || parsed.fragment().is_some()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err("Invalid service address.".into());
    }
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|_| "The default browser could not be opened. Copy the local link.".into())
}
#[tauri::command]
async fn quit_app(
    app: tauri::AppHandle,
    state: tauri::State<'_, DesktopState>,
) -> Result<(), String> {
    let state = state.inner().clone();
    blocking(move || {
        stop_control(&state);
        app.exit(0);
        Ok(())
    })
    .await
}
fn show(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| show(app)))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(DesktopState::default())
        .invoke_handler(tauri::generate_handler![
            get_settings,
            library_summary,
            set_library_story_deleted,
            save_settings,
            reset_providers,
            detect_node,
            choose_path,
            start_server,
            stop_server,
            server_status,
            test_provider,
            open_reader,
            quit_app
        ])
        .setup(|app| {
            let show_item = MenuItem::with_id(app, "show", "Open Shiqu settings", true, None::<&str>)?;
            let stop_item = MenuItem::with_id(app, "stop", "Stop service", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Shiqu", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &stop_item, &quit_item])?;
            let mut tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("Shiqu")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show(app),
                    "stop" | "quit" => {
                        let app = app.clone();
                        let quit = event.id.as_ref() == "quit";
                        thread_stop(app, quit);
                    }
                    _ => {}
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("Desktop startup failed");
    app.run(|app, event| match event {
        tauri::RunEvent::Exit => stop_control(app.state::<DesktopState>().inner()),
        #[cfg(target_os = "macos")]
        tauri::RunEvent::Reopen { .. } => show(app),
        _ => {}
    });
}
fn thread_stop(app: tauri::AppHandle, quit: bool) {
    std::thread::spawn(move || {
        stop_control(app.state::<DesktopState>().inner());
        if quit {
            app.exit(0);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn provider_commands_only_use_committed_database_configuration() {
        let folder =
            std::env::temp_dir().join(format!("shiqu-command-config-{}", std::process::id()));
        let file = folder.join("desktop.sqlite");
        let mut store = config::Store::open(&file, &folder).unwrap();
        let mut settings = store.settings().unwrap();
        settings.text_model = "saved-model".into();
        store
            .save(&settings, config::KeyChange::Set("disposable-command-key"))
            .unwrap();
        drop(store);
        let mut store = config::Store::open(&file, &folder).unwrap();
        let (loaded, key) = provider_configuration_with(&store, |_| None).unwrap();
        assert_eq!(loaded.text_model, "saved-model");
        assert_eq!(key, "disposable-command-key");
        store.save(&settings, config::KeyChange::Delete).unwrap();
        assert!(provider_configuration_with(&store, |_| None)
            .unwrap()
            .1
            .is_empty());
        #[cfg(not(windows))]
        {
            settings.provider = "codex".into();
            store.save(&settings, config::KeyChange::Keep).unwrap();
            assert!(provider_configuration_with(&store, |_| None)
                .unwrap()
                .1
                .is_empty());
        }
        drop(store);
        std::fs::remove_dir_all(folder).unwrap();
    }
    #[test]
    fn provider_environment_is_invocation_only_and_does_not_import_credentials() {
        let folder =
            std::env::temp_dir().join(format!("shiqu-provider-env-{}", std::process::id()));
        let file = folder.join("desktop.sqlite");
        let mut store = config::Store::open(&file, &folder).unwrap();
        let settings = store.settings().unwrap();
        store
            .save(&settings, config::KeyChange::Set("saved-gemini"))
            .unwrap();
        let revision = store.revision().unwrap();
        let (effective, key) = provider_configuration_with(&store, |name| match name {
            "SHIQU_AI_PROVIDER" => Some("openai".into()),
            "OPENAI_API_KEY" => Some("env-only-key".into()),
            "OPENAI_TEXT_MODEL" => Some("env-model".into()),
            _ => None,
        })
        .unwrap();
        assert_eq!(effective.provider, "openai");
        assert_eq!(effective.openai_text_model, "env-model");
        assert_eq!(key, "env-only-key");
        assert_eq!(store.settings().unwrap().provider, "gemini");
        assert!(store.key_for("openai").unwrap().is_empty());
        assert_eq!(store.revision().unwrap(), revision);
        assert!(
            provider_configuration_with(&store, |name| if name == "GEMINI_API_KEY" {
                Some("private-invalid\nkey".into())
            } else {
                None
            })
            .is_err()
        );
        drop(store);
        std::fs::remove_dir_all(folder).unwrap();
    }
}
