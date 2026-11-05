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
        .map_err(|_| "桌面操作未完成，请重试。".to_string())?
}
fn resource_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if cfg!(debug_assertions) {
        return Ok(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../desktop/resources/runtime"));
    }
    Ok(app
        .path()
        .resource_dir()
        .map_err(|_| "无法确定应用资源目录。")?
        .join("runtime"))
}
fn settings_view(app: &tauri::AppHandle, control: &mut Control) -> Result<Value, String> {
    let store = open_store(app, control)?;
    let (settings, revision, gemini, openai) = store.settings_snapshot()?;
    let present = |provider: &str| match provider {
        "gemini" => gemini,
        "openai" => openai,
        _ => false,
    };
    let key_present = present(&settings.provider);
    let image_key_present = present(settings.effective_image_provider());
    Ok(
        json!({"settings":settings,"revision":revision,"keyPresent":key_present,"imageKeyPresent":image_key_present,"providerKeys":{"gemini":gemini,"openai":openai},"runtimeConfigured":provider_configuration(&store).map(|(settings,key,image_key)| provider_ready(&settings,&key,&image_key)).unwrap_or(false),"credentialError":null,"platform":std::env::consts::OS}),
    )
}
fn open_store(app: &tauri::AppHandle, _control: &mut Control) -> Result<config::Store, String> {
    let (file, data) = config::directories(app)?;
    config::Store::open(&file, &data)
}
// Read-only needs nothing; each active API provider needs its own credential.
fn provider_ready(settings: &Settings, key: &str, image_key: &str) -> bool {
    let api = |name: &str| ["gemini", "openai"].contains(&name);
    let image = settings.effective_image_provider();
    settings.provider == "readonly"
        || (!(api(&settings.provider) && key.is_empty())
            && !(image != settings.provider && api(image) && image_key.is_empty()))
}
// Invocation overrides never mutate the saved settings or import environment credentials.
fn provider_configuration(store: &config::Store) -> Result<(Settings, String, String), String> {
    provider_configuration_with(store, |name| std::env::var(name).ok())
}
fn provider_configuration_with(
    store: &config::Store,
    read: impl Fn(&str) -> Option<String>,
) -> Result<(Settings, String, String), String> {
    let mut settings = store.settings()?;
    if let Some(value) = read("SHIQU_AI_PROVIDER") {
        settings.provider = value;
    }
    // Blank keeps the saved image choice; read-only ignores the image side, matching the CLI.
    if let Some(value) = read("SHIQU_IMAGE_PROVIDER").filter(|value| !value.trim().is_empty()) {
        if settings.provider != "readonly" {
            settings.image_provider = value.trim().into();
        }
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
        serde_json::to_value(&settings.task_reasoning_efforts).map_err(|_| "任务推理设置无效。")?;
    for task in [
        "suggest", "art", "frames", "outline", "plan", "review", "repair",
    ] {
        if let Some(value) = read(&format!("SHIQU_REASONING_{}", task.to_uppercase())) {
            efforts[task] = value.into();
        }
    }
    settings.task_reasoning_efforts =
        serde_json::from_value(efforts).map_err(|_| "任务推理设置无效。")?;
    settings.validate()?;
    let credential = |provider: &str| -> Result<String, String> {
        let name = match provider {
            "openai" => Some("OPENAI_API_KEY"),
            "gemini" => Some("GEMINI_API_KEY"),
            _ => None,
        };
        match name.and_then(&read) {
            Some(value) => config::validate_key(&value),
            None => store.key_for(provider),
        }
    };
    let key = credential(&settings.provider)?;
    let image = settings.effective_image_provider();
    let image_key = if image == settings.provider {
        String::new()
    } else {
        credential(image)?
    };
    Ok((settings, key, image_key))
}

#[tauri::command]
async fn get_settings(
    app: tauri::AppHandle,
    state: tauri::State<'_, DesktopState>,
) -> Result<Value, String> {
    let shared = state.0.clone();
    blocking(move || {
        let mut control = shared.lock().map_err(|_| "服务控制器不可用。")?;
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
            let mut control = shared.lock().map_err(|_| "服务控制器不可用。")?;
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
            let mut control = shared.lock().map_err(|_| "服务控制器不可用。")?;
            open_store(&app, &mut control)?.settings()?
        };
        runtime::ensure_library(&settings, &resource_root(&app)?)?;
        library::set_deleted(std::path::Path::new(&settings.data_directory), &id, deleted)
    })
    .await
}

fn key_change(change: Option<bool>, value: &str) -> config::KeyChange<'_> {
    match change {
        None => config::KeyChange::Keep,
        Some(true) => config::KeyChange::Set(value),
        Some(false) => config::KeyChange::Delete,
    }
}

#[tauri::command]
async fn save_settings(
    app: tauri::AppHandle,
    state: tauri::State<'_, DesktopState>,
    mut settings: Settings,
    expected_revision: Option<i64>,
    key_action: String,
    key: String,
    image_key_action: Option<String>,
    image_key: Option<String>,
) -> Result<Value, String> {
    let shared = state.0.clone();
    blocking(move || {
        let mut guard = shared.lock().map_err(|_| "服务控制器不可用。")?;
        if guard.runtime.is_some() {
            return Err("请先停止服务，再修改设置或密钥。".into());
        }
        let image_key_action = image_key_action.unwrap_or_else(|| "keep".into());
        let image_key = image_key.unwrap_or_default();
        let parse = |action: &str, value: &str| -> Result<(Option<bool>, String), String> {
            match action {
                "keep" => Ok((None, String::new())),
                "replace" => Ok((Some(true), config::validate_key(value)?)),
                "delete" => Ok((Some(false), String::new())),
                _ => Err("密钥操作无效。".into()),
            }
        };
        let (text_change, text_replacement) = parse(&key_action, &key)?;
        let (image_change, image_replacement) = parse(&image_key_action, &image_key)?;
        let mut store = open_store(&app, &mut guard)?;
        settings.library_configured = true;
        // "Same as text" is stored as unset so older builds can still read the settings.
        if settings.image_provider == settings.provider {
            settings.image_provider.clear();
        }
        let image = settings.effective_image_provider().to_string();
        let separate = image != settings.provider;
        if !separate && image_change.is_some() {
            return Err("图片服务与文本服务相同，请使用文本服务的密钥。".into());
        }
        let configured = |provider: &str, change: Option<bool>| -> Result<bool, String> {
            Ok(match provider {
                "gemini" | "openai" => match change {
                    Some(set) => set,
                    None => !store.key_for(provider)?.is_empty(),
                },
                _ => true,
            })
        };
        settings.provider_configured = configured(&settings.provider, text_change)?
            && (!separate || settings.provider == "readonly" || configured(&image, image_change)?);
        let provider = settings.provider.clone();
        store.save_keys_at(
            &settings,
            &[
                (
                    provider.as_str(),
                    key_change(text_change, &text_replacement),
                ),
                (image.as_str(), key_change(image_change, &image_replacement)),
            ],
            expected_revision,
        )?;
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
        let mut control = shared.lock().map_err(|_| "服务控制器不可用。")?;
        if control.runtime.is_some() {
            return Err("请先停止服务，再重置配置。".into());
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
            _ => return Err("文件选择类型无效。".into()),
        };
        chosen
            .map(|file| {
                file.into_path()
                    .map(|path| path.to_string_lossy().into())
                    .map_err(|_| "请选择本机路径。".into())
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
        let mut control = shared.lock().map_err(|_| "服务控制器不可用。")?;
        if let Some(runtime) = &mut control.runtime {
            return Ok(runtime.snapshot());
        }
        let store = open_store(&app, &mut control)?;
        let (settings, key, image_key) = provider_configuration(&store)?;
        if !provider_ready(&settings, &key, &image_key) {
            return Err("请先配置生成服务，或选择只读模式。".into());
        }
        match runtime::start(&settings, &key, &image_key, &resource_root(&app)?) {
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
        let mut control = shared.lock().map_err(|_| "服务控制器不可用。")?;
        if let Some(runtime) = &mut control.runtime {
            match runtime.child.try_wait() {
                Ok(None) => return Ok(runtime.snapshot()),
                _ => {
                    drop(control.runtime.take());
                    control.last_error = Some("服务已退出，请检查设置后重新启动。".into());
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
        let mut guard = shared.lock().map_err(|_| "服务控制器不可用。")?;
        if guard.runtime.is_some() {
            return Err("请先停止服务，再测试配置。".into());
        }
        let store = open_store(&app, &mut guard)?;
        let (settings, credential, image_credential) = provider_configuration(&store)?;
        let (mut child, result, _updates) = runtime::launch(
            &settings,
            &credential,
            &image_credential,
            &resource_root(&app)?,
            "test",
        )?;
        drop(child.stdin.take());
        let _ = child.wait();
        Ok(result)
    })
    .await
}

#[tauri::command]
fn open_reader(app: tauri::AppHandle, state: tauri::State<'_, DesktopState>) -> Result<(), String> {
    let control = state.0.lock().map_err(|_| "服务控制器不可用。")?;
    let url = control
        .runtime
        .as_ref()
        .and_then(|runtime| runtime.status["url"].as_str())
        .ok_or("请先启动服务。")?;
    let parsed = tauri::Url::parse(url).map_err(|_| "服务地址无效。")?;
    if parsed.scheme() != "http"
        || parsed.host_str() != Some("127.0.0.1")
        || parsed.path() != "/"
        || parsed.query().is_some()
        || parsed.fragment().is_some()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err("服务地址无效。".into());
    }
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|_| "无法打开默认浏览器，请复制本机链接。".into())
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
            let show_item = MenuItem::with_id(app, "show", "打开拾趣设置", true, None::<&str>)?;
            let stop_item = MenuItem::with_id(app, "stop", "停止服务", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出拾趣", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &stop_item, &quit_item])?;
            let mut tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("拾趣")
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
        let (loaded, key, _) = provider_configuration_with(&store, |_| None).unwrap();
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
        let (effective, key, _) = provider_configuration_with(&store, |name| match name {
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
    #[test]
    fn separate_image_provider_uses_its_own_credential_and_readiness() {
        let folder =
            std::env::temp_dir().join(format!("shiqu-image-provider-{}", std::process::id()));
        let file = folder.join("desktop.sqlite");
        let mut store = config::Store::open(&file, &folder).unwrap();
        let mut settings = store.settings().unwrap();
        settings.provider = "openai".into();
        settings.image_provider = "gemini".into();
        store
            .save_keys_at(
                &settings,
                &[
                    ("openai", config::KeyChange::Set("text-only-key")),
                    ("gemini", config::KeyChange::Keep),
                ],
                None,
            )
            .unwrap();
        let (loaded, key, image_key) = provider_configuration_with(&store, |_| None).unwrap();
        assert_eq!(loaded.image_provider, "gemini");
        assert_eq!((key.as_str(), image_key.as_str()), ("text-only-key", ""));
        assert!(!provider_ready(&loaded, &key, &image_key));
        store
            .save_keys_at(
                &settings,
                &[("gemini", config::KeyChange::Set("image-only-key"))],
                None,
            )
            .unwrap();
        let (loaded, key, image_key) = provider_configuration_with(&store, |_| None).unwrap();
        assert_eq!(image_key, "image-only-key");
        assert!(provider_ready(&loaded, &key, &image_key));
        // The image override is invocation-only; an unused provider's key is never read.
        let (effective, _, image_key) = provider_configuration_with(&store, |name| match name {
            "SHIQU_IMAGE_PROVIDER" => Some("openai".into()),
            _ => None,
        })
        .unwrap();
        assert_eq!(effective.effective_image_provider(), "openai");
        assert!(image_key.is_empty());
        assert_eq!(store.settings().unwrap().image_provider, "gemini");
        // Blank keeps the saved choice; read-only ignores an invalid image override.
        let blank = provider_configuration_with(&store, |name| {
            (name == "SHIQU_IMAGE_PROVIDER").then(|| " ".into())
        })
        .unwrap();
        assert_eq!(blank.0.image_provider, "gemini");
        assert!(provider_configuration_with(&store, |name| match name {
            "SHIQU_AI_PROVIDER" => Some("readonly".into()),
            "SHIQU_IMAGE_PROVIDER" => Some("invalid".into()),
            _ => None,
        })
        .is_ok());
        settings.provider = "readonly".into();
        assert!(store
            .save_keys_at(&settings, &[("gemini", config::KeyChange::Delete)], None)
            .is_err());
        assert_eq!(store.key_for("gemini").unwrap(), "image-only-key");
        settings.provider = "openai".into();
        settings.image_provider.clear();
        assert!(store
            .save_keys_at(&settings, &[("gemini", config::KeyChange::Delete)], None)
            .is_err());
        store.save(&settings, config::KeyChange::Keep).unwrap();
        let saved: serde_json::Value = serde_json::to_value(store.settings().unwrap()).unwrap();
        assert!(saved.get("imageProvider").is_none());
        drop(store);
        std::fs::remove_dir_all(folder).unwrap();
    }
}
