use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager,
};

pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let icon = app.default_window_icon().cloned().expect("no default icon");

    let open = MenuItemBuilder::with_id("tray_open", "Open Manager").build(app)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let snooze_cpu = MenuItemBuilder::with_id("tray_snooze_cpu", "Snooze CPU (1 hr)").build(app)?;
    let snooze_gpu = MenuItemBuilder::with_id("tray_snooze_gpu", "Snooze GPU (1 hr)").build(app)?;
    let resume = MenuItemBuilder::with_id("tray_resume", "Resume").build(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let about = MenuItemBuilder::with_id("tray_about", "About BOINC").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&open)
        .item(&sep1)
        .item(&snooze_cpu)
        .item(&snooze_gpu)
        .item(&resume)
        .item(&sep2)
        .item(&about)
        .build()?;

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
                "tray_snooze_cpu" => {
                    let _ = app.emit("tray-action", "snooze_cpu");
                }
                "tray_snooze_gpu" => {
                    let _ = app.emit("tray-action", "snooze_gpu");
                }
                "tray_resume" => {
                    let _ = app.emit("tray-action", "resume");
                }
                "tray_about" => {
                    let _ = app.emit("tray-action", "about");
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
