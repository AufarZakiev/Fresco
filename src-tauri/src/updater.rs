use std::path::PathBuf;
#[cfg(target_os = "macos")]
use std::path::Path;

fn current_exe_path() -> Result<PathBuf, String> {
    std::env::current_exe().map_err(|e| format!("Failed to get current exe path: {e}"))
}

/// Download the update binary to a `.update` file next to the current exe.
/// Used by the background "update on exit" flow.
///
/// On macOS this flow is not yet supported — see `update_now` for the proper
/// DMG-based update path.
#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn download_update(_asset_url: String) -> Result<(), String> {
    Err("\"Update on exit\" is not supported on macOS yet".into())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub async fn download_update(asset_url: String) -> Result<(), String> {
    let exe_path = current_exe_path()?;
    let update_path = exe_path.with_extension("update");
    download_to(&asset_url, &update_path).await
}

/// Download, swap binaries, and relaunch in one shot.
///
/// Windows/Linux: the release asset is a raw binary; write over the current
/// exe and relaunch. On Windows this function never returns.
///
/// macOS: the release asset is a `.dmg` containing `Fresco.app`. Mount the DMG,
/// copy the new `.app` to a sibling of the current install, atomically swap,
/// then spawn a detached `open` on the new bundle and exit. This function
/// never returns on macOS either.
#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn update_now(asset_url: String) -> Result<bool, String> {
    macos_update(asset_url).await
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub async fn update_now(asset_url: String) -> Result<bool, String> {
    let exe_path = current_exe_path()?;
    let update_path = exe_path.with_extension("update");
    download_to(&asset_url, &update_path).await?;
    do_install(&exe_path, &update_path)
}

#[cfg(not(target_os = "macos"))]
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

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o755);
        std::fs::set_permissions(update_path, perms)
            .map_err(|e| format!("Failed to set permissions: {e}"))?;
    }

    Ok(())
}

/// Swap binaries and relaunch (Windows/Linux only).
#[cfg(not(target_os = "macos"))]
fn do_install(exe_path: &std::path::Path, update_path: &std::path::Path) -> Result<bool, String> {
    let old_path = exe_path.with_extension("old");

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        if old_path.exists() {
            let _ = std::fs::remove_file(&old_path);
        }

        std::fs::rename(exe_path, &old_path)
            .map_err(|e| format!("Failed to rename current exe: {e}"))?;

        if let Err(e) = std::fs::rename(update_path, exe_path) {
            let _ = std::fs::rename(&old_path, exe_path);
            return Err(format!("Failed to rename update file: {e}"));
        }

        std::process::Command::new(exe_path)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| format!("Failed to launch updated binary: {e}"))?;

        std::process::exit(0);
    }

    #[cfg(all(unix, not(target_os = "macos")))]
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
#[cfg(target_os = "macos")]
#[tauri::command]
pub fn install_update() -> Result<bool, String> {
    Err("\"Update on exit\" is not supported on macOS yet".into())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn install_update() -> Result<bool, String> {
    let exe_path = current_exe_path()?;
    let update_path = exe_path.with_extension("update");

    if !update_path.exists() {
        return Err("No update file found".into());
    }

    do_install(&exe_path, &update_path)
}

#[cfg(target_os = "macos")]
#[tauri::command]
pub fn cleanup_old_binary() -> Result<(), String> {
    // On macOS we swap entire `.app` bundles; the backup is a directory.
    if let Ok(exe) = current_exe_path() {
        if let Ok(app_root) = find_app_root(&exe) {
            let old = app_root.with_extension("app.old");
            if old.exists() {
                let _ = std::fs::remove_dir_all(&old);
            }
            // Also clean any stale `.app.new` from an interrupted update.
            let new = app_root.with_extension("app.new");
            if new.exists() {
                let _ = std::fs::remove_dir_all(&new);
            }
        }
    }
    Ok(())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn cleanup_old_binary() -> Result<(), String> {
    let exe_path = current_exe_path()?;
    let old_path = exe_path.with_extension("old");
    if old_path.exists() {
        let _ = std::fs::remove_file(&old_path);
    }
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// macOS-specific update flow: DMG download → mount → .app swap → detached relaunch
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(target_os = "macos")]
async fn macos_update(asset_url: String) -> Result<bool, String> {
    let exe = current_exe_path()?;
    let app_root = find_app_root(&exe)?;

    // Early permission check: we need to rename the .app within its parent.
    let parent = app_root
        .parent()
        .ok_or_else(|| "App has no parent directory".to_string())?;
    if !is_writable(parent) {
        return Err(format!(
            "Cannot update: no write access to {}. Install Fresco in a user-writable location or update manually from the Releases page.",
            parent.display()
        ));
    }

    let dmg_path = std::env::temp_dir().join("fresco_update.dmg");
    let _ = std::fs::remove_file(&dmg_path);
    download_file_to(&asset_url, &dmg_path).await?;

    let mount = hdiutil_attach(&dmg_path)?;

    // Ensure the DMG is always detached and the download removed, regardless
    // of whether the swap succeeded.
    let install_result = macos_install_from_mount(&mount, &app_root);
    let _ = hdiutil_detach(&mount);
    let _ = std::fs::remove_file(&dmg_path);
    install_result?;

    spawn_detached_relaunch(&app_root)?;
    std::process::exit(0);
}

#[cfg(target_os = "macos")]
fn macos_install_from_mount(mount: &str, app_root: &Path) -> Result<(), String> {
    let src_app = find_app_on_mount(mount)?;

    let new_app_tmp = app_root.with_extension("app.new");
    let _ = std::fs::remove_dir_all(&new_app_tmp);

    // `ditto` preserves xattrs, ACLs, resource forks — the right tool for .app bundles.
    ditto(&src_app, &new_app_tmp)?;

    // Strip quarantine xattr so Gatekeeper doesn't re-prompt on relaunch.
    xattr_clear_recursive(&new_app_tmp);

    // Atomic-ish swap: current .app → .app.old, .app.new → .app.
    // Rollback if the second rename fails.
    let old_app = app_root.with_extension("app.old");
    let _ = std::fs::remove_dir_all(&old_app);
    std::fs::rename(app_root, &old_app)
        .map_err(|e| format!("Failed to move current app aside: {e}"))?;
    if let Err(e) = std::fs::rename(&new_app_tmp, app_root) {
        let _ = std::fs::rename(&old_app, app_root);
        return Err(format!("Failed to install new app: {e}"));
    }

    Ok(())
}

#[cfg(target_os = "macos")]
fn find_app_root(exe: &Path) -> Result<PathBuf, String> {
    // Expected layout: <.../Fresco.app>/Contents/MacOS/<binary>.
    // Walk up at most 4 parents looking for the `.app` directory.
    let mut cur = exe.to_path_buf();
    for _ in 0..4 {
        cur = cur
            .parent()
            .ok_or_else(|| format!("Binary is not inside an .app bundle: {}", exe.display()))?
            .to_path_buf();
        if cur.extension().and_then(|s| s.to_str()) == Some("app") {
            return Ok(cur);
        }
    }
    Err(format!(
        "Binary is not inside an .app bundle: {}",
        exe.display()
    ))
}

#[cfg(target_os = "macos")]
fn find_app_on_mount(mount: &str) -> Result<PathBuf, String> {
    let entries = std::fs::read_dir(mount)
        .map_err(|e| format!("Failed to read DMG mount {mount}: {e}"))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("app") {
            return Ok(path);
        }
    }
    Err(format!("No .app bundle found on DMG mount {mount}"))
}

#[cfg(target_os = "macos")]
fn hdiutil_attach(dmg: &Path) -> Result<String, String> {
    let output = std::process::Command::new("hdiutil")
        .args(["attach", "-nobrowse", "-readonly", "-plist"])
        .arg(dmg)
        .output()
        .map_err(|e| format!("Failed to spawn hdiutil attach: {e}"))?;

    if !output.status.success() {
        return Err(format!(
            "hdiutil attach failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    // Parse the plist manually: look for the first `<string>/Volumes/...</string>`.
    // hdiutil emits one such entry per mounted volume; a Fresco DMG has exactly one.
    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("<string>") {
            if let Some(path) = rest.strip_suffix("</string>") {
                if path.starts_with("/Volumes/") {
                    return Ok(path.to_string());
                }
            }
        }
    }
    Err("Could not determine DMG mount point from hdiutil output".into())
}

#[cfg(target_os = "macos")]
fn hdiutil_detach(mount: &str) -> Result<(), String> {
    let _ = std::process::Command::new("hdiutil")
        .args(["detach", "-force", mount])
        .output();
    Ok(())
}

#[cfg(target_os = "macos")]
fn ditto(src: &Path, dst: &Path) -> Result<(), String> {
    let output = std::process::Command::new("ditto")
        .arg(src)
        .arg(dst)
        .output()
        .map_err(|e| format!("Failed to spawn ditto: {e}"))?;
    if !output.status.success() {
        return Err(format!(
            "ditto failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn xattr_clear_recursive(path: &Path) {
    let _ = std::process::Command::new("xattr")
        .args(["-cr"])
        .arg(path)
        .output();
}

#[cfg(target_os = "macos")]
fn is_writable(path: &Path) -> bool {
    use std::fs::File;
    let probe = path.join(".fresco_update_write_probe");
    match File::create(&probe) {
        Ok(_) => {
            let _ = std::fs::remove_file(&probe);
            true
        }
        Err(_) => false,
    }
}

#[cfg(target_os = "macos")]
async fn download_file_to(url: &str, path: &Path) -> Result<(), String> {
    let response = reqwest::get(url)
        .await
        .map_err(|e| format!("Download failed: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("Download failed with status: {}", response.status()));
    }
    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read download: {e}"))?;
    std::fs::write(path, &bytes).map_err(|e| format!("Failed to write DMG: {e}"))?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn spawn_detached_relaunch(app_root: &Path) -> Result<(), String> {
    // Fork a shell that waits a moment, then launches the updated bundle.
    // The brief sleep lets the current process exit and release the
    // single-instance lock before the new instance starts up.
    let quoted = shell_escape(
        app_root
            .to_str()
            .ok_or_else(|| "App path contains invalid UTF-8".to_string())?,
    );
    let script = format!("sleep 1 && /usr/bin/open {quoted}");
    std::process::Command::new("/bin/sh")
        .args(["-c", &script])
        .spawn()
        .map_err(|e| format!("Failed to schedule relaunch: {e}"))?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn shell_escape(s: &str) -> String {
    // Wrap in single quotes; escape any embedded single quote with '\''.
    format!("'{}'", s.replace('\'', "'\\''"))
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;

    #[test]
    fn find_app_root_walks_three_levels_up() {
        let exe = PathBuf::from("/Applications/Fresco.app/Contents/MacOS/fresco");
        assert_eq!(
            find_app_root(&exe).unwrap(),
            PathBuf::from("/Applications/Fresco.app")
        );
    }

    #[test]
    fn find_app_root_handles_renamed_app() {
        let exe = PathBuf::from("/Users/bob/Apps/MyFresco.app/Contents/MacOS/fresco");
        assert_eq!(
            find_app_root(&exe).unwrap(),
            PathBuf::from("/Users/bob/Apps/MyFresco.app")
        );
    }

    #[test]
    fn find_app_root_rejects_non_bundle_exe() {
        let exe = PathBuf::from("/usr/local/bin/fresco");
        assert!(find_app_root(&exe).is_err());
    }

    #[test]
    fn shell_escape_wraps_plain_path() {
        assert_eq!(
            shell_escape("/Applications/Fresco.app"),
            "'/Applications/Fresco.app'"
        );
    }

    #[test]
    fn shell_escape_preserves_embedded_quote() {
        assert_eq!(shell_escape("Bob's App.app"), "'Bob'\\''s App.app'");
    }
}
