use std::path::PathBuf;

fn current_exe_path() -> Result<PathBuf, String> {
    std::env::current_exe().map_err(|e| format!("Failed to get current exe path: {e}"))
}

/// Download the update binary to a `.update` file next to the current exe.
/// Used by the background "update on exit" flow.
#[tauri::command]
pub async fn download_update(asset_url: String) -> Result<(), String> {
    let exe_path = current_exe_path()?;
    let update_path = exe_path.with_extension("update");
    download_to(&asset_url, &update_path).await
}

/// Download, swap binaries, and relaunch in one shot.
/// On Windows this function never returns (calls process::exit).
/// On other platforms returns true (caller should relaunch).
#[tauri::command]
pub async fn update_now(asset_url: String) -> Result<bool, String> {
    let exe_path = current_exe_path()?;
    let update_path = exe_path.with_extension("update");

    download_to(&asset_url, &update_path).await?;
    do_install(&exe_path, &update_path)
}

async fn download_to(asset_url: &str, update_path: &std::path::Path) -> Result<(), String> {
    let response = reqwest::get(asset_url)
        .await
        .map_err(|e| format!("Download failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Download failed with status: {}",
            response.status()
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read download: {e}"))?;

    std::fs::write(update_path, &bytes)
        .map_err(|e| format!("Failed to write update file: {e}"))?;

    #[cfg(target_os = "windows")]
    {
        let zone_id_path = format!("{}:Zone.Identifier", update_path.display());
        let _ = std::fs::remove_file(&zone_id_path);
    }

    #[cfg(not(target_os = "windows"))]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o755);
        std::fs::set_permissions(update_path, perms)
            .map_err(|e| format!("Failed to set permissions: {e}"))?;
    }

    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("xattr")
            .args(["-d", "com.apple.quarantine"])
            .arg(update_path)
            .output();
    }

    Ok(())
}

/// Swap binaries and relaunch.
///
/// Windows: a running exe CAN be renamed. We rename current→.old,
/// .update→current, spawn the new binary, and exit immediately.
///
/// On Windows this function never returns.
fn do_install(exe_path: &std::path::Path, update_path: &std::path::Path) -> Result<bool, String> {
    let old_path = exe_path.with_extension("old");

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        if old_path.exists() {
            let _ = std::fs::remove_file(&old_path);
        }

        // Rename running exe → .old  (allowed on Windows)
        std::fs::rename(exe_path, &old_path)
            .map_err(|e| format!("Failed to rename current exe: {e}"))?;

        // Rename .update → exe name
        if let Err(e) = std::fs::rename(update_path, exe_path) {
            let _ = std::fs::rename(&old_path, exe_path); // rollback
            return Err(format!("Failed to rename update file: {e}"));
        }

        // Launch the new binary
        std::process::Command::new(exe_path)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| format!("Failed to launch updated binary: {e}"))?;

        std::process::exit(0);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = std::fs::remove_file(&old_path);
        std::fs::rename(exe_path, &old_path)
            .map_err(|e| format!("Failed to rename current binary: {e}"))?;
        if let Err(e) = std::fs::rename(update_path, exe_path) {
            let _ = std::fs::rename(&old_path, exe_path);
            return Err(format!("Failed to install update: {e}"));
        }
        Ok(true)
    }
}

/// Install a previously downloaded update (used by "update on exit" flow).
#[tauri::command]
pub fn install_update() -> Result<bool, String> {
    let exe_path = current_exe_path()?;
    let update_path = exe_path.with_extension("update");

    if !update_path.exists() {
        return Err("No update file found".into());
    }

    do_install(&exe_path, &update_path)
}

#[tauri::command]
pub fn cleanup_old_binary() -> Result<(), String> {
    let exe_path = current_exe_path()?;
    let old_path = exe_path.with_extension("old");
    if old_path.exists() {
        let _ = std::fs::remove_file(&old_path);
    }
    Ok(())
}
