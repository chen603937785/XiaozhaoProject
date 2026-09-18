#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{LogicalPosition, LogicalSize, State, WebviewBuilder, WebviewUrl};
#[cfg(target_os = "windows")]
use tauri::Manager;

struct TitleState(Arc<Mutex<HashMap<String, String>>>);

/// 简历数据（字段名 -> 字段值）
struct ResumeState(Arc<Mutex<HashMap<String, String>>>);

fn get_child_webview(window: &tauri::Window, label: &str) -> Option<tauri::Webview> {
    window.webviews().into_iter().find(|w| w.label() == label)
}

/// 保存简历数据
#[tauri::command]
fn save_resume(state: State<ResumeState>, data: HashMap<String, String>) -> Result<(), String> {
    let mut map = state.0.lock().map_err(|e| e.to_string())?;
    *map = data;
    Ok(())
}

/// 读取简历数据
#[tauri::command]
fn get_resume(state: State<ResumeState>) -> Result<HashMap<String, String>, String> {
    let map = state.0.lock().map_err(|e| e.to_string())?;
    Ok(map.clone())
}

/// 把简历数据实时同步到所有已打开的 webview（无需重新打开）
#[tauri::command]
fn update_webview_resume(window: tauri::Window, resume: State<ResumeState>) -> Result<(), String> {
    let data = resume.0.lock().map_err(|e| e.to_string())?.clone();
    let json = serde_json::to_string(&data).unwrap_or_else(|_| "{}".into());
    let script = format!("window.__RESUME_DATA__ = {};", json);
    for w in window.webviews() {
        let _ = w.eval(&script);
    }
    Ok(())
}

/// 在主窗口内创建子 webview（加载外部网页 + 注入自动填写脚本）
#[tauri::command]
fn create_webview(
    window: tauri::Window,
    state: State<TitleState>,
    resume: State<ResumeState>,
    label: String,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let url = url::Url::parse(&url).map_err(|e| e.to_string())?;
    // 注入简历数据
    let resume_data = resume.0.lock().map_err(|e| e.to_string())?.clone();
    let resume_json = serde_json::to_string(&resume_data).unwrap_or_else(|_| "{}".into());
    let resume_script = format!("window.__RESUME_DATA__ = {};", resume_json);
    // 标题回调
    let map = state.0.clone();
    let l = label.clone();
    let mut builder = WebviewBuilder::new(label, WebviewUrl::External(url))
        .on_document_title_changed(move |_webview, title| {
            if let Ok(mut m) = map.lock() {
                m.insert(l.clone(), title);
            }
        })
        .initialization_script(&resume_script)
        .initialization_script(include_str!("../autofill.js"));
    #[cfg(target_os = "macos")]
    {
        // macOS: 持久化 cookie/session（WKWebView 用 data_store_identifier）
        builder = builder.data_store_identifier(*b"campus-job-web01");
    }
    #[cfg(target_os = "windows")]
    {
        // 绝对路径的独立数据目录，避免与主 webview 共享 user data folder 冲突
        if let Ok(dir) = window.app_handle().path().app_data_dir() {
            builder = builder.data_directory(dir.join("webview-data"));
        }
        // 禁用 GPU 硬件加速，规避部分 Windows 显卡驱动下渲染进程 CPU/GPU 占满、页面卡死
        builder = builder.additional_browser_args("--disable-gpu");
    }
    window
        .add_child(
            builder,
            LogicalPosition::new(x, y),
            LogicalSize::new(width, height),
        )
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 显示/隐藏子 webview
#[tauri::command]
fn show_webview(window: tauri::Window, label: String, show: bool) -> Result<(), String> {
    if let Some(webview) = get_child_webview(&window, &label) {
        if show {
            webview.show().map_err(|e| e.to_string())?;
        } else {
            webview.hide().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// 销毁子 webview
#[tauri::command]
fn close_webview(window: tauri::Window, label: String) -> Result<(), String> {
    if let Some(webview) = get_child_webview(&window, &label) {
        webview.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 获取子 webview 页面标题
#[tauri::command]
fn webview_title(state: State<TitleState>, label: String) -> Result<String, String> {
    let map = state.0.lock().map_err(|e| e.to_string())?;
    Ok(map.get(&label).cloned().unwrap_or_default())
}

/// 用系统默认浏览器打开链接
#[tauri::command]
fn open_in_browser(app: tauri::AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 刷新子 webview
#[tauri::command]
fn reload_webview(window: tauri::Window, label: String) -> Result<(), String> {
    if let Some(webview) = get_child_webview(&window, &label) {
        webview.eval("window.location.reload()").map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 后退
#[tauri::command]
fn webview_go_back(window: tauri::Window, label: String) -> Result<(), String> {
    if let Some(webview) = get_child_webview(&window, &label) {
        webview.eval("window.history.back()").map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 前进
#[tauri::command]
fn webview_go_forward(window: tauri::Window, label: String) -> Result<(), String> {
    if let Some(webview) = get_child_webview(&window, &label) {
        webview.eval("window.history.forward()").map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 缩放
#[tauri::command]
fn webview_zoom(window: tauri::Window, label: String, zoom: f64) -> Result<(), String> {
    if let Some(webview) = get_child_webview(&window, &label) {
        webview
            .eval(&format!("document.body.style.zoom = '{}'", zoom))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(TitleState(Arc::new(Mutex::new(HashMap::new()))))
        .manage(ResumeState(Arc::new(Mutex::new(HashMap::new()))))
        .invoke_handler(tauri::generate_handler![
            save_resume,
            get_resume,
            update_webview_resume,
            create_webview,
            show_webview,
            close_webview,
            webview_title,
            open_in_browser,
            reload_webview,
            webview_go_back,
            webview_go_forward,
            webview_zoom
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
