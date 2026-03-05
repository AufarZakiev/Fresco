use super::connection::RpcClient;
use super::types::{
    AccountOut, AcctMgrInfo, AcctMgrRpcReply, CcConfig, CcState, CcStatus, DailyXferHistory,
    DiskUsage, FileTransfer, GlobalPreferences, HostInfo, Message, NewerVersionInfo, Notice,
    OldResult, Project, ProjectAttachReply, ProjectConfig, ProjectInitStatus, ProjectListEntry,
    ProjectStatistics, ProxyInfo, TaskResult, VersionInfo,
};
use super::xml_parse;

/// Escape XML special characters in a string value.
/// Only use for values inserted between XML tags, not for tag names.
fn xml_escape(input: &str) -> String {
    let mut out = String::with_capacity(input.len());

    for ch in input.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&apos;"),
            _ => out.push(ch),
        }
    }

    out
}

/// High-level RPC commands that return typed data.
impl RpcClient {
    // ── Read operations ──────────────────────────────────────────────

    /// Get all results (tasks). If `active_only` is true, only active tasks are returned.
    pub async fn get_results(&self, active_only: bool) -> Result<Vec<TaskResult>, String> {
        let req = if active_only {
            "<get_results>\n<active_only>1</active_only>\n</get_results>"
        } else {
            "<get_results/>"
        };
        let xml = self.rpc_call(req).await?;
        Ok(xml_parse::parse_results(&xml))
    }

    /// Get all attached projects.
    pub async fn get_project_status(&self) -> Result<Vec<Project>, String> {
        let xml = self.rpc_call("<get_project_status/>").await?;
        Ok(xml_parse::parse_projects(&xml))
    }

    /// Get the client's current status (run modes, network status).
    pub async fn get_cc_status(&self) -> Result<CcStatus, String> {
        let xml = self.rpc_call("<get_cc_status/>").await?;
        Ok(xml_parse::parse_cc_status(&xml))
    }

    /// Get all active file transfers.
    pub async fn get_file_transfers(&self) -> Result<Vec<FileTransfer>, String> {
        let xml = self.rpc_call("<get_file_transfers/>").await?;
        Ok(xml_parse::parse_file_transfers(&xml))
    }

    // ── Task (result) operations ─────────────────────────────────────

    /// Send a task operation identified by project URL and result name.
    async fn result_op(&self, op: &str, project_url: &str, name: &str) -> Result<(), String> {
        let safe_url = xml_escape(project_url);
        let safe_name = xml_escape(name);
        let req = format!(
            "<{op}>\n<project_url>{safe_url}</project_url>\n<name>{safe_name}</name>\n</{op}>"
        );
        let xml = self.rpc_call(&req).await?;
        xml_parse::parse_success(&xml)
    }

    pub async fn suspend_result(&self, project_url: &str, name: &str) -> Result<(), String> {
        self.result_op("suspend_result", project_url, name).await
    }

    pub async fn resume_result(&self, project_url: &str, name: &str) -> Result<(), String> {
        self.result_op("resume_result", project_url, name).await
    }

    pub async fn abort_result(&self, project_url: &str, name: &str) -> Result<(), String> {
        self.result_op("abort_result", project_url, name).await
    }

    // ── Project operations ───────────────────────────────────────────

    /// Send a project operation identified by master URL.
    async fn project_op(&self, op: &str, project_url: &str) -> Result<(), String> {
        let safe_url = xml_escape(project_url);
        let req = format!(
            "<{op}>\n<project_url>{safe_url}</project_url>\n</{op}>"
        );
        let xml = self.rpc_call(&req).await?;
        xml_parse::parse_success(&xml)
    }

    pub async fn project_suspend(&self, project_url: &str) -> Result<(), String> {
        self.project_op("project_suspend", project_url).await
    }

    pub async fn project_resume(&self, project_url: &str) -> Result<(), String> {
        self.project_op("project_resume", project_url).await
    }

    pub async fn project_update(&self, project_url: &str) -> Result<(), String> {
        self.project_op("project_update", project_url).await
    }

    pub async fn project_nomorework(&self, project_url: &str) -> Result<(), String> {
        self.project_op("project_nomorework", project_url).await
    }

    pub async fn project_allowmorework(&self, project_url: &str) -> Result<(), String> {
        self.project_op("project_allowmorework", project_url).await
    }

    pub async fn project_reset(&self, project_url: &str) -> Result<(), String> {
        self.project_op("project_reset", project_url).await
    }

    pub async fn project_detach(&self, project_url: &str) -> Result<(), String> {
        self.project_op("project_detach", project_url).await
    }

    // ── Mode controls ────────────────────────────────────────────────

    /// Set a run mode. `mode`: 1=always, 2=auto, 3=never. `duration`: seconds (0=permanent).
    async fn set_mode(&self, tag: &str, mode: i32, duration: f64) -> Result<(), String> {
        let mode_tag = match mode {
            1 => "always",
            2 => "auto",
            3 => "never",
            4 => "restore",
            _ => return Err(format!("Unknown mode: {}", mode)),
        };
        let req = format!(
            "<set_{tag}>\n<{mode_tag}/>\n<duration>{duration}</duration>\n</set_{tag}>"
        );
        let xml = self.rpc_call(&req).await?;
        xml_parse::parse_success(&xml)
    }

    pub async fn set_run_mode(&self, mode: i32, duration: f64) -> Result<(), String> {
        self.set_mode("run_mode", mode, duration).await
    }

    pub async fn set_gpu_mode(&self, mode: i32, duration: f64) -> Result<(), String> {
        self.set_mode("gpu_mode", mode, duration).await
    }

    pub async fn set_network_mode(&self, mode: i32, duration: f64) -> Result<(), String> {
        self.set_mode("network_mode", mode, duration).await
    }

    // ── Transfer operations ──────────────────────────────────────────

    /// Send a file transfer operation identified by project URL and filename.
    async fn transfer_op(&self, op: &str, project_url: &str, filename: &str) -> Result<(), String> {
        let safe_url = xml_escape(project_url);
        let safe_filename = xml_escape(filename);
        let req = format!(
            "<{op}>\n<project_url>{safe_url}</project_url>\n<filename>{safe_filename}</filename>\n</{op}>"
        );
        let xml = self.rpc_call(&req).await?;
        xml_parse::parse_success(&xml)
    }

    pub async fn retry_file_transfer(&self, project_url: &str, filename: &str) -> Result<(), String> {
        self.transfer_op("retry_file_transfer", project_url, filename).await
    }

    pub async fn abort_file_transfer(&self, project_url: &str, filename: &str) -> Result<(), String> {
        self.transfer_op("abort_file_transfer", project_url, filename).await
    }

    // ── Other operations ─────────────────────────────────────────────

    pub async fn run_benchmarks(&self) -> Result<(), String> {
        let xml = self.rpc_call("<run_benchmarks/>").await?;
        xml_parse::parse_success(&xml)
    }

    pub async fn network_available(&self) -> Result<(), String> {
        let xml = self.rpc_call("<network_available/>").await?;
        xml_parse::parse_success(&xml)
    }

    pub async fn quit(&self) -> Result<(), String> {
        let xml = self.rpc_call("<quit/>").await?;
        xml_parse::parse_success(&xml)
    }

    // ── Statistics ─────────────────────────────────────────────────

    pub async fn get_statistics(&self) -> Result<Vec<ProjectStatistics>, String> {
        let xml = self.rpc_call("<get_statistics/>").await?;
        Ok(xml_parse::parse_statistics(&xml))
    }

    // ── Messages ──────────────────────────────────────────────────

    pub async fn get_messages(&self, seqno: i32) -> Result<Vec<Message>, String> {
        let req = format!(
            "<get_messages>\n<seqno>{seqno}</seqno>\n</get_messages>"
        );
        let xml = self.rpc_call(&req).await?;
        Ok(xml_parse::parse_messages(&xml))
    }

    // ── Notices ───────────────────────────────────────────────────

    pub async fn get_notices(&self, seqno: i32) -> Result<Vec<Notice>, String> {
        let req = format!(
            "<get_notices>\n<seqno>{seqno}</seqno>\n</get_notices>"
        );
        let xml = self.rpc_call(&req).await?;
        Ok(xml_parse::parse_notices(&xml))
    }

    // ── Disk usage ────────────────────────────────────────────────

    pub async fn get_disk_usage(&self) -> Result<DiskUsage, String> {
        let xml = self.rpc_call("<get_disk_usage/>").await?;
        Ok(xml_parse::parse_disk_usage(&xml))
    }

    // ── Preferences ───────────────────────────────────────────────

    pub async fn get_global_prefs_override(&self) -> Result<GlobalPreferences, String> {
        let xml = self.rpc_call("<get_global_prefs_override/>").await?;
        Ok(xml_parse::parse_global_preferences(&xml))
    }

    pub async fn set_global_prefs_override(
        &self,
        prefs: &GlobalPreferences,
    ) -> Result<(), String> {
        let prefs_xml = xml_parse::serialize_global_preferences(prefs);
        let req = format!(
            "<set_global_prefs_override>\n{prefs_xml}\n</set_global_prefs_override>"
        );
        self.rpc_call(&req).await?;
        let xml = self.rpc_call("<read_global_prefs_override/>").await?;
        xml_parse::parse_success(&xml)
    }

    // ── Host info ─────────────────────────────────────────────────

    pub async fn get_host_info(&self) -> Result<HostInfo, String> {
        let xml = self.rpc_call("<get_host_info/>").await?;
        Ok(xml_parse::parse_host_info(&xml))
    }

    // ── Project attach ────────────────────────────────────────────

    pub async fn get_all_projects_list(&self) -> Result<Vec<ProjectListEntry>, String> {
        let xml = self.rpc_call("<get_all_projects_list/>").await?;
        Ok(xml_parse::parse_all_projects_list(&xml))
    }

    pub async fn lookup_account(
        &self,
        url: &str,
        email: &str,
        password: &str,
    ) -> Result<(), String> {
        let safe_url = xml_escape(url);
        let safe_email = xml_escape(email);
        let safe_password = xml_escape(password);
        let req = format!(
            "<lookup_account>\n\
             <url>{safe_url}</url>\n\
             <email_addr>{safe_email}</email_addr>\n\
             <passwd_hash>{safe_password}</passwd_hash>\n\
             </lookup_account>"
        );
        self.rpc_call(&req).await?;
        Ok(())
    }

    pub async fn lookup_account_poll(&self) -> Result<AccountOut, String> {
        let xml = self.rpc_call("<lookup_account_poll/>").await?;
        Ok(xml_parse::parse_account_out(&xml))
    }

    pub async fn project_attach(
        &self,
        url: &str,
        authenticator: &str,
        name: &str,
    ) -> Result<(), String> {
        let safe_url = xml_escape(url);
        let safe_auth = xml_escape(authenticator);
        let safe_name = xml_escape(name);
        let req = format!(
            "<project_attach>\n\
             <project_url>{safe_url}</project_url>\n\
             <authenticator>{safe_auth}</authenticator>\n\
             <project_name>{safe_name}</project_name>\n\
             </project_attach>"
        );
        self.rpc_call(&req).await?;
        Ok(())
    }

    pub async fn project_attach_poll(&self) -> Result<ProjectAttachReply, String> {
        let xml = self.rpc_call("<project_attach_poll/>").await?;
        Ok(xml_parse::parse_project_attach_reply(&xml))
    }

    // ── Project config (Phase 4) ──────────────────────────────────

    pub async fn get_project_config(&self, url: &str) -> Result<(), String> {
        let safe_url = xml_escape(url);
        let req = format!("<get_project_config>\n<url>{safe_url}</url>\n</get_project_config>");
        self.rpc_call(&req).await?;
        Ok(())
    }

    pub async fn get_project_config_poll(&self) -> Result<ProjectConfig, String> {
        let xml = self.rpc_call("<get_project_config_poll/>").await?;
        Ok(xml_parse::parse_project_config(&xml))
    }

    pub async fn create_account(
        &self,
        url: &str,
        email: &str,
        passwd_hash: &str,
        user_name: &str,
        team_name: &str,
    ) -> Result<(), String> {
        let safe_url = xml_escape(url);
        let safe_email = xml_escape(email);
        let safe_hash = xml_escape(passwd_hash);
        let safe_user = xml_escape(user_name);
        let safe_team = xml_escape(team_name);
        let req = format!(
            "<create_account>\n\
             <url>{safe_url}</url>\n\
             <email_addr>{safe_email}</email_addr>\n\
             <passwd_hash>{safe_hash}</passwd_hash>\n\
             <user_name>{safe_user}</user_name>\n\
             <team_name>{safe_team}</team_name>\n\
             </create_account>"
        );
        self.rpc_call(&req).await?;
        Ok(())
    }

    pub async fn create_account_poll(&self) -> Result<AccountOut, String> {
        let xml = self.rpc_call("<create_account_poll/>").await?;
        Ok(xml_parse::parse_account_out(&xml))
    }

    // ── Account manager (Phase 4) ────────────────────────────────

    pub async fn acct_mgr_info(&self) -> Result<AcctMgrInfo, String> {
        let xml = self.rpc_call("<acct_mgr_info/>").await?;
        Ok(xml_parse::parse_acct_mgr_info(&xml))
    }

    pub async fn acct_mgr_rpc(
        &self,
        url: &str,
        name: &str,
        password: &str,
    ) -> Result<(), String> {
        let safe_url = xml_escape(url);
        let safe_name = xml_escape(name);
        let safe_password = xml_escape(password);
        let req = format!(
            "<acct_mgr_rpc>\n\
             <url>{safe_url}</url>\n\
             <name>{safe_name}</name>\n\
             <password>{safe_password}</password>\n\
             </acct_mgr_rpc>"
        );
        self.rpc_call(&req).await?;
        Ok(())
    }

    pub async fn acct_mgr_rpc_poll(&self) -> Result<AcctMgrRpcReply, String> {
        let xml = self.rpc_call("<acct_mgr_rpc_poll/>").await?;
        Ok(xml_parse::parse_acct_mgr_rpc_reply(&xml))
    }

    // ── Proxy settings (Phase 5) ─────────────────────────────────

    pub async fn get_proxy_settings(&self) -> Result<ProxyInfo, String> {
        let xml = self.rpc_call("<get_proxy_settings/>").await?;
        Ok(xml_parse::parse_proxy_info(&xml))
    }

    pub async fn set_proxy_settings(&self, info: &ProxyInfo) -> Result<(), String> {
        let proxy_xml = xml_parse::serialize_proxy_info(info);
        let req = format!(
            "<set_proxy_settings>\n{proxy_xml}\n</set_proxy_settings>"
        );
        let xml = self.rpc_call(&req).await?;
        xml_parse::parse_success(&xml)
    }

    // ── CC Config (Phase 5) ──────────────────────────────────────

    pub async fn get_cc_config(&self) -> Result<CcConfig, String> {
        let xml = self.rpc_call("<get_cc_config/>").await?;
        Ok(xml_parse::parse_cc_config(&xml))
    }

    pub async fn set_cc_config(&self, config: &CcConfig) -> Result<(), String> {
        let config_xml = xml_parse::serialize_cc_config(config);
        let req = format!(
            "<set_cc_config>\n{config_xml}\n</set_cc_config>"
        );
        self.rpc_call(&req).await?;
        let xml = self.rpc_call("<read_cc_config/>").await?;
        xml_parse::parse_success(&xml)
    }

    // ── Version check ─────────────────────────────────────────────

    pub async fn get_newer_version(&self) -> Result<NewerVersionInfo, String> {
        let xml = self.rpc_call("<get_newer_version/>").await?;
        Ok(xml_parse::parse_newer_version(&xml))
    }

    // ── Exchange versions ───────────────────────────────────────

    pub async fn exchange_versions(&self) -> Result<VersionInfo, String> {
        let req = "<exchange_versions>\n\
                   <major>8</major>\n\
                   <minor>0</minor>\n\
                   <release>0</release>\n\
                   </exchange_versions>";
        let xml = self.rpc_call(req).await?;
        Ok(xml_parse::parse_version_info(&xml))
    }

    // ── Get state ───────────────────────────────────────────────

    pub async fn get_state(&self) -> Result<CcState, String> {
        let xml = self.rpc_call("<get_state/>").await?;
        Ok(xml_parse::parse_cc_state(&xml))
    }

    // ── Read commands ───────────────────────────────────────────

    pub async fn read_global_prefs_override(&self) -> Result<(), String> {
        let xml = self.rpc_call("<read_global_prefs_override/>").await?;
        xml_parse::parse_success(&xml)
    }

    pub async fn read_cc_config(&self) -> Result<(), String> {
        let xml = self.rpc_call("<read_cc_config/>").await?;
        xml_parse::parse_success(&xml)
    }

    pub async fn get_global_prefs_working(&self) -> Result<GlobalPreferences, String> {
        let xml = self.rpc_call("<get_global_prefs_working/>").await?;
        Ok(xml_parse::parse_global_preferences(&xml))
    }

    pub async fn get_global_prefs_file(&self) -> Result<GlobalPreferences, String> {
        let xml = self.rpc_call("<get_global_prefs_file/>").await?;
        Ok(xml_parse::parse_global_preferences(&xml))
    }

    // ── Language ────────────────────────────────────────────────

    pub async fn set_language(&self, lang: &str) -> Result<(), String> {
        let safe_lang = xml_escape(lang);
        let req = format!("<set_language>\n<language>{safe_lang}</language>\n</set_language>");
        let xml = self.rpc_call(&req).await?;
        xml_parse::parse_success(&xml)
    }

    // ── Project init ────────────────────────────────────────────

    pub async fn get_project_init_status(&self) -> Result<ProjectInitStatus, String> {
        let xml = self.rpc_call("<get_project_init_status/>").await?;
        Ok(xml_parse::parse_project_init_status(&xml))
    }

    pub async fn project_attach_from_file(&self) -> Result<(), String> {
        let xml = self.rpc_call("<project_attach>\n<use_config_file/>\n</project_attach>").await?;
        xml_parse::parse_success(&xml).or(Ok(()))
    }

    // ── Old results ─────────────────────────────────────────────

    pub async fn get_old_results(&self) -> Result<Vec<OldResult>, String> {
        let xml = self.rpc_call("<get_old_results/>").await?;
        Ok(xml_parse::parse_old_results(&xml))
    }

    // ── Message count ───────────────────────────────────────────

    pub async fn get_message_count(&self) -> Result<i32, String> {
        let xml = self.rpc_call("<get_message_count/>").await?;
        Ok(xml_parse::parse_message_count(&xml))
    }

    // ── Daily transfer history ──────────────────────────────────

    pub async fn get_daily_xfer_history(&self) -> Result<DailyXferHistory, String> {
        let xml = self.rpc_call("<get_daily_xfer_history/>").await?;
        Ok(xml_parse::parse_daily_xfer_history(&xml))
    }
}

#[cfg(test)]
mod tests {
    use super::xml_escape;

    #[test]
    fn no_special_characters() {
        assert_eq!(xml_escape("hello world"), "hello world");
    }

    #[test]
    fn escapes_ampersand() {
        assert_eq!(xml_escape("a&b"), "a&amp;b");
    }

    #[test]
    fn escapes_angle_brackets() {
        assert_eq!(xml_escape("<script>"), "&lt;script&gt;");
    }

    #[test]
    fn escapes_quotes() {
        assert_eq!(xml_escape(r#"say "hello""#), "say &quot;hello&quot;");
        assert_eq!(xml_escape("it's"), "it&apos;s");
    }

    #[test]
    fn escapes_all_special_characters_together() {
        assert_eq!(
            xml_escape(r#"<a href="x">&'y'"#),
            "&lt;a href=&quot;x&quot;&gt;&amp;&apos;y&apos;"
        );
    }

    #[test]
    fn empty_string() {
        assert_eq!(xml_escape(""), "");
    }

    #[test]
    fn already_escaped_is_re_escaped() {
        // Already-escaped input gets escaped again (correct behavior for raw text escaping)
        assert_eq!(xml_escape("&amp;"), "&amp;amp;");
    }

    #[test]
    fn url_with_ampersand() {
        assert_eq!(
            xml_escape("http://example.com?a=1&b=2"),
            "http://example.com?a=1&amp;b=2"
        );
    }
}
