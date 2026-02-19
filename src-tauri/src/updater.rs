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

    Ok(())
}

/// Returns true if the caller should relaunch, false if it should exit
/// (a helper script handles the swap and relaunch on Windows).
#[tauri::command]
pub fn install_update() -> Result<bool, String> {
    let exe_path = current_exe_path()?;
    let update_path = exe_path.with_extension("update");

    if !update_path.exists() {
        return Err("No update file found".into());
    }

    let old_path = exe_path.with_extension("old");

    #[cfg(target_os = "windows")]
    {
        spawn_update_script(&exe_path, &update_path, &old_path)?;
        Ok(false)
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = std::fs::remove_file(&old_path);
        std::fs::rename(&exe_path, &old_path).map_err(|e| {
            format!("Failed to rename current binary: {e}")
        })?;
        if let Err(e) = std::fs::rename(&update_path, &exe_path) {
            let _ = std::fs::rename(&old_path, &exe_path); // rollback
            return Err(format!("Failed to install update: {e}"));
        }
        Ok(true)
    }
}

/// Spawn a hidden PowerShell script that waits for our process to exit,
/// swaps the binaries, and launches the new version.
#[cfg(target_os = "windows")]
fn spawn_update_script(
    exe_path: &std::path::Path,
    update_path: &std::path::Path,
    old_path: &std::path::Path,
) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let pid = std::process::id();
    let exe_leaf = exe_path
        .file_name()
        .ok_or("Invalid exe path")?
        .to_string_lossy()
        .replace('\'', "''");
    let old_leaf = old_path
        .file_name()
        .ok_or("Invalid old path")?
        .to_string_lossy()
        .replace('\'', "''");

    let script = format!(
        r#"try {{ Wait-Process -Id {pid} -ErrorAction SilentlyContinue }} catch {{}}
Start-Sleep -Milliseconds 500
$ErrorActionPreference = 'Stop'
$exe = '{exe}'
$old = '{old}'
$upd = '{upd}'
try {{
    if (Test-Path $old) {{ Remove-Item -Force $old }}
    Rename-Item -Path $exe -NewName '{old_leaf}'
    Rename-Item -Path $upd -NewName '{exe_leaf}'
    Start-Process $exe
}} catch {{
    try {{ Rename-Item -Path $old -NewName '{exe_leaf}' }} catch {{}}
}}"#,
        pid = pid,
        exe = exe_path.display().to_string().replace('\'', "''"),
        old = old_path.display().to_string().replace('\'', "''"),
        upd = update_path.display().to_string().replace('\'', "''"),
        exe_leaf = exe_leaf,
        old_leaf = old_leaf,
    );

    let script_path = std::env::temp_dir().join("fresco-updater.ps1");
    std::fs::write(&script_path, &script)
        .map_err(|e| format!("Failed to write updater script: {e}"))?;

    std::process::Command::new("powershell")
        .args([
            "-WindowStyle",
            "Hidden",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            &script_path.display().to_string(),
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| format!("Failed to launch updater: {e}"))?;

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
