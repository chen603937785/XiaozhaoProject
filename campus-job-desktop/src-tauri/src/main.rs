#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{LogicalPosition, LogicalSize, Manager, State, WebviewBuilder, WebviewUrl};

struct TitleState(Arc<Mutex<HashMap<String, String>>>);

/// 简历数据（字段名 -> 字段值）
struct ResumeState(Arc<Mutex<HashMap<String, String>>>);

fn get_child_webview(window: &tauri::Window, label: &str) -> Option<tauri::Webview> {
    window.webviews().into_iter().find(|w| w.label() == label)
}

fn get_main_webview(window: &tauri::Window) -> Option<tauri::Webview> {
    window
        .webviews()
        .into_iter()
        .find(|w| w.label() == "main" || w.label() == window.label())
}

fn eval_on_label(window: &tauri::Window, label: &str, js: &str) -> Result<(), String> {
    if let Some(w) = get_child_webview(window, label) {
        return w.eval(js).map_err(|e| e.to_string());
    }
    if let Some(w) = window.app_handle().get_webview_window(label) {
        return w.eval(js).map_err(|e| e.to_string());
    }
    Ok(())
}

fn window_logical_size(window: &tauri::Window) -> Result<(f64, f64), String> {
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let inner = window.inner_size().map_err(|e| e.to_string())?;
    Ok((inner.width as f64 / scale, inner.height as f64 / scale))
}

/// Windows 上两层 WebView2 不能重叠。把主界面收成顶栏，网页铺在下面。
fn split_main_for_browser(window: &tauri::Window, chrome_h: f64) -> Result<(), String> {
    let Some(main) = get_main_webview(window) else {
        return Ok(());
    };
    let (lw, _) = window_logical_size(window)?;
    main.set_auto_resize(false).map_err(|e| e.to_string())?;
    main.set_position(LogicalPosition::new(0.0, 0.0))
        .map_err(|e| e.to_string())?;
    main.set_size(LogicalSize::new(lw, chrome_h.max(48.0)))
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn restore_main_webview(window: &tauri::Window) -> Result<(), String> {
    let Some(main) = get_main_webview(window) else {
        return Ok(());
    };
    let (lw, lh) = window_logical_size(window)?;
    main.set_position(LogicalPosition::new(0.0, 0.0))
        .map_err(|e| e.to_string())?;
    main.set_size(LogicalSize::new(lw, lh))
        .map_err(|e| e.to_string())?;
    main.set_auto_resize(true).map_err(|e| e.to_string())?;
    Ok(())
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

/// 打开内置浏览器。必须 async：Windows 同步创建 WebView2 会和主线程死锁。
#[tauri::command]
async fn create_webview(
    window: tauri::Window,
    state: State<'_, TitleState>,
    resume: State<'_, ResumeState>,
    label: String,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let parsed = url::Url::parse(&url).map_err(|e| e.to_string())?;
    let resume_data = resume.0.lock().map_err(|e| e.to_string())?.clone();
    let resume_json = serde_json::to_string(&resume_data).unwrap_or_else(|_| "{}".into());
    let resume_script = format!("window.__RESUME_DATA__ = {};", resume_json);
    let map = state.0.clone();
    let title_label = label.clone();

    // 尺寸必须从原生窗口读取：主 webview 收缩后，前端的
    // window.innerHeight 只剩顶栏高度，不能再用它计算网页高度。
    let (window_width, window_height) = window_logical_size(&window)?;
    let browser_width = (window_width - x).max(1.0);
    let browser_height = (window_height - y).max(1.0);
    let _ = (width, height);

    // 先收起主 webview，网页从工具条下方开始，避免挡住前进/后退。
    split_main_for_browser(&window, y)?;

    let mut builder = WebviewBuilder::new(label, WebviewUrl::External(parsed))
        .on_document_title_changed(move |_webview, title| {
            if let Ok(mut m) = map.lock() {
                m.insert(title_label.clone(), title);
            }
        })
        .initialization_script(&resume_script)
        .initialization_script(include_str!("../autofill.js"));
    #[cfg(target_os = "macos")]
    {
        builder = builder.data_store_identifier(*b"campus-job-web01");
    }
    window
        .add_child(
            builder,
            LogicalPosition::new(x, y),
            LogicalSize::new(browser_width, browser_height),
        )
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn layout_browser(
    window: tauri::Window,
    label: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let (window_width, window_height) = window_logical_size(&window)?;
    let browser_width = (window_width - x).max(1.0);
    let browser_height = (window_height - y).max(1.0);
    let _ = (width, height);
    split_main_for_browser(&window, y)?;
    if let Some(webview) = get_child_webview(&window, &label) {
        webview
            .set_position(LogicalPosition::new(x, y))
            .map_err(|e| e.to_string())?;
        webview
            .set_size(LogicalSize::new(browser_width, browser_height))
            .map_err(|e| e.to_string())?;
        let _ = webview.show();
    }
    Ok(())
}

#[tauri::command]
fn restore_main_layout(window: tauri::Window) -> Result<(), String> {
    restore_main_webview(&window)
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
    eval_on_label(&window, &label, "window.location.reload()")
}

/// 后退
#[tauri::command]
fn webview_go_back(window: tauri::Window, label: String) -> Result<(), String> {
    eval_on_label(&window, &label, "window.history.back()")
}

/// 前进
#[tauri::command]
fn webview_go_forward(window: tauri::Window, label: String) -> Result<(), String> {
    eval_on_label(&window, &label, "window.history.forward()")
}

/// 缩放
#[tauri::command]
fn webview_zoom(window: tauri::Window, label: String, zoom: f64) -> Result<(), String> {
    eval_on_label(
        &window,
        &label,
        &format!("document.body.style.zoom = '{}'", zoom),
    )
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
            layout_browser,
            restore_main_layout,
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
