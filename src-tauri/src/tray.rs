use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager,
};

use crate::AppState;

pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let icon = app.default_window_icon().cloned().expect("no default icon");

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

    let cpu_snoozed = Arc::new(AtomicBool::new(false));
    let gpu_snoozed = Arc::new(AtomicBool::new(false));

    let cpu_item_ref = cpu_item.clone();
    let gpu_item_ref = gpu_item.clone();
    let cpu_snoozed_ref = cpu_snoozed.clone();
    let gpu_snoozed_ref = gpu_snoozed.clone();

    TrayIconBuilder::new()
        .icon(icon)
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
                    if cpu_snoozed_ref.load(Ordering::Relaxed) {
                        cpu_snoozed_ref.store(false, Ordering::Relaxed);
                        let _ = cpu_item_ref.set_text("Snooze CPU (1 hr)");
                        let _ = app.emit("tray-action", "resume_cpu");
                    } else {
                        cpu_snoozed_ref.store(true, Ordering::Relaxed);
                        let _ = cpu_item_ref.set_text("Resume CPU");
                        let _ = app.emit("tray-action", "snooze_cpu");
                    }
                }
                "tray_gpu" => {
                    if gpu_snoozed_ref.load(Ordering::Relaxed) {
                        gpu_snoozed_ref.store(false, Ordering::Relaxed);
                        let _ = gpu_item_ref.set_text("Snooze GPU (1 hr)");
                        let _ = app.emit("tray-action", "resume_gpu");
                    } else {
                        gpu_snoozed_ref.store(true, Ordering::Relaxed);
                        let _ = gpu_item_ref.set_text("Resume GPU");
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
