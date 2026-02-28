use md5::{Digest, Md5};

/// Extract nonce value from auth1 response XML.
/// Expected: `<nonce>VALUE</nonce>`
pub fn extract_nonce(xml: &str) -> Option<String> {
    let start = xml.find("<nonce>")? + 7;
    let end = xml.find("</nonce>")?;
    Some(xml[start..end].trim().to_string())
}

/// Compute MD5(nonce + password) as hex string for auth2.
pub fn compute_auth_hash(nonce: &str, password: &str) -> String {
    let input = format!("{}{}", nonce, password);
    let mut hasher = Md5::new();
    hasher.update(input.as_bytes());
    hex::encode(hasher.finalize())
}

/// Read the GUI RPC password from the standard file location.
/// On Windows: `<BOINC data dir>\gui_rpc_auth.cfg`
/// On Unix: `/var/lib/boinc-client/gui_rpc_auth.cfg` or `~/.boinc/gui_rpc_auth.cfg`
pub fn read_password_from_file(data_dir: &str) -> Result<String, String> {
    let path = std::path::Path::new(data_dir).join("gui_rpc_auth.cfg");
    std::fs::read_to_string(&path)
        .map(|s| s.trim().to_string())
        .map_err(|e| format!("Cannot read {}: {}", path.display(), e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_nonce() {
        let xml = "<nonce>1708029643.123456</nonce>";
        assert_eq!(extract_nonce(xml), Some("1708029643.123456".to_string()));
    }

    #[test]
    fn test_extract_nonce_with_surrounding_xml() {
        let xml = "<boinc_gui_rpc_reply>\n<nonce>abc123</nonce>\n</boinc_gui_rpc_reply>";
        assert_eq!(extract_nonce(xml), Some("abc123".to_string()));
    }

    #[test]
    fn test_extract_nonce_missing() {
        assert_eq!(extract_nonce("<error/>"), None);
    }

    #[test]
    fn test_compute_auth_hash() {
        // MD5("testnonce" + "testpass") — verifiable with any MD5 tool
        let hash = compute_auth_hash("testnonce", "testpass");
        assert_eq!(hash.len(), 32); // MD5 hex is always 32 chars

        // Same inputs must produce same hash
        let hash2 = compute_auth_hash("testnonce", "testpass");
        assert_eq!(hash, hash2);

        // Different inputs must differ
        let hash3 = compute_auth_hash("other", "testpass");
        assert_ne!(hash, hash3);
    }
}
