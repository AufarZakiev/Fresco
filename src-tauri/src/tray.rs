use tauri::{
    menu::{MenuBuilder, MenuItem, MenuItemBuilder, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager,
};

use crate::AppState;

const TRAY_ID: &str = "main-tray";

/// BOINC run-mode value that means "never run" (i.e. snoozed).
const MODE_NEVER: i32 = 3;

/// Holds references to tray menu items so they can be updated at runtime.
pub(crate) struct TrayState {
    cpu_item: MenuItem<tauri::Wry>,
    gpu_item: MenuItem<tauri::Wry>,
}

pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // On macOS, use a monochrome template image — the OS handles dark/light automatically.
    // On other platforms, detect the current theme and pick the matching tray icon.
    #[cfg(target_os = "macos")]
    let icon = tauri::include_image!("icons/tray-icon.png");

    #[cfg(not(target_os = "macos"))]
    let icon = {
        let is_dark = app
            .get_webview_window("main")
            .and_then(|w| w.theme().ok())
            .map(|t| t == tauri::Theme::Dark)
            .unwrap_or(true);
        if is_dark {
            tauri::include_image!("icons/tray-icon-dark.png")
        } else {
            tauri::include_image!("icons/tray-icon-light.png")
        }
    };

    let open = MenuItemBuilder::with_id("tray_open", "Open Manager").build(app)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let cpu_item =
        MenuItemBuilder::with_id("tray_cpu", "Snooze CPU (1 hr)").build(app)?;
    let gpu_item =
        MenuItemBuilder::with_id("tray_gpu", "Snooze GPU (1 hr)").build(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let exit = MenuItemBuilder::with_id("tray_exit", "Exit").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&open)
        .item(&sep1)
        .item(&cpu_item)
        .item(&gpu_item)
        .item(&sep2)
        .item(&exit)
        .build()?;

    // Store menu item references so sync_tray_modes can update labels later.
    app.manage(TrayState {
        cpu_item: cpu_item.clone(),
        gpu_item: gpu_item.clone(),
    });

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .icon_as_template(cfg!(target_os = "macos"))
        .tooltip("BOINC Manager")
        .menu(&menu)
        .on_menu_event(move |app, event| {
            let id = event.id().as_ref();
            match id {
                "tray_open" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                    }
                }
                "tray_cpu" => {
                    let tray_state = app.state::<TrayState>();
                    let is_snoozed = tray_state
                        .cpu_item
                        .text()
                        .map(|t| t.starts_with("Resume"))
                        .unwrap_or(false);
                    if is_snoozed {
                        let _ = tray_state.cpu_item.set_text("Snooze CPU (1 hr)");
                        let _ = app.emit("tray-action", "resume_cpu");
                    } else {
                        let _ = tray_state.cpu_item.set_text("Resume CPU");
                        let _ = app.emit("tray-action", "snooze_cpu");
                    }
                }
                "tray_gpu" => {
                    let tray_state = app.state::<TrayState>();
                    let is_snoozed = tray_state
                        .gpu_item
                        .text()
                        .map(|t| t.starts_with("Resume"))
                        .unwrap_or(false);
                    if is_snoozed {
                        let _ = tray_state.gpu_item.set_text("Snooze GPU (1 hr)");
                        let _ = app.emit("tray-action", "resume_gpu");
                    } else {
                        let _ = tray_state.gpu_item.set_text("Resume GPU");
                        let _ = app.emit("tray-action", "snooze_gpu");
                    }
                }
                "tray_exit" => {
                    let handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        let state = handle.state::<AppState>();
                        let guard = state.client.lock().await;
                        if let Some(client) = guard.as_ref() {
                            let _ = client.quit().await;
                        }
                        drop(guard);
                        handle.exit(0);
                    });
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::Click {
                button: tauri::tray::MouseButton::Left,
                button_state: tauri::tray::MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}

/// Synchronise tray menu labels with the actual BOINC run modes.
/// Called from the frontend every time cc_status is polled.
#[tauri::command]
pub fn sync_tray_modes(
    tray_state: tauri::State<'_, TrayState>,
    task_mode: i32,
    gpu_mode: i32,
) {
    let cpu_label = if task_mode == MODE_NEVER {
        "Resume CPU"
    } else {
        "Snooze CPU (1 hr)"
    };
    let gpu_label = if gpu_mode == MODE_NEVER {
        "Resume GPU"
    } else {
        "Snooze GPU (1 hr)"
    };
    let _ = tray_state.cpu_item.set_text(cpu_label);
    let _ = tray_state.gpu_item.set_text(gpu_label);
}

/// Switch tray and window icons to match the system theme.
/// On macOS this is a no-op — the tray uses a template image and the Dock icon is fixed.
#[cfg(target_os = "macos")]
pub fn update_icons_for_theme(_app: &AppHandle, _theme: tauri::Theme) {}

#[cfg(not(target_os = "macos"))]
pub fn update_icons_for_theme(app: &AppHandle, theme: tauri::Theme) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let icon = match theme {
            tauri::Theme::Dark => tauri::include_image!("icons/tray-icon-dark.png"),
            _ => tauri::include_image!("icons/tray-icon-light.png"),
        };
        let _ = tray.set_icon(Some(icon));
    }

    if let Some(window) = app.get_webview_window("main") {
        let icon = match theme {
            tauri::Theme::Dark => tauri::include_image!("icons/icon-dark.png"),
            _ => tauri::include_image!("icons/icon.png"),
        };
        let _ = window.set_icon(icon);
    }
}
