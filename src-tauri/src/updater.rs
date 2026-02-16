use std::path::PathBuf;

fn current_exe_path() -> Result<PathBuf, String> {
    std::env::current_exe().map_err(|e| format!("Failed to get current exe path: {e}"))
}

#[tauri::command]
pub async fn download_update(asset_url: String) -> Result<(), String> {
    let exe_path = current_exe_path()?;
    let update_path = exe_path.with_extension("update");

    // Download the binary
    let response = reqwest::get(&asset_url)
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

    // Write to temp file
    std::fs::write(&update_path, &bytes)
        .map_err(|e| format!("Failed to write update file: {e}"))?;

    // Platform-specific post-download steps
    #[cfg(target_os = "windows")]
    {
        // Strip Mark of the Web (Zone.Identifier ADS)
        let zone_id_path = format!("{}:Zone.Identifier", update_path.display());
        let _ = std::fs::remove_file(&zone_id_path);
    }

    #[cfg(not(target_os = "windows"))]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o755);
        std::fs::set_permissions(&update_path, perms)
            .map_err(|e| format!("Failed to set permissions: {e}"))?;
    }

    #[cfg(target_os = "macos")]
    {
        // Remove quarantine xattr
        let _ = std::process::Command::new("xattr")
            .args(["-d", "com.apple.quarantine"])
            .arg(&update_path)
            .output();
    }

    // Replace the current binary
    let old_path = exe_path.with_extension("old");

    // Remove any previous .old file
    let _ = std::fs::remove_file(&old_path);

    // Rename current -> .old
    std::fs::rename(&exe_path, &old_path).map_err(|e| {
        format!(
            "Failed to rename current binary. Is it in a writable location? Error: {e}"
        )
    })?;

    // Rename update -> current
    if let Err(e) = std::fs::rename(&update_path, &exe_path) {
        // Try to restore the original binary
        let _ = std::fs::rename(&old_path, &exe_path);
        return Err(format!("Failed to install update: {e}"));
    }

    Ok(())
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
