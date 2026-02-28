use serde::{Deserialize, Serialize};

/// Matches BOINC's RESULT struct — represents a task/work unit result.
#[derive(Debug, Clone, Serialize, Default)]
pub struct TaskResult {
    pub name: String,
    pub wu_name: String,
    pub project_url: String,
    pub report_deadline: f64,
    pub received_time: f64,
    pub elapsed_time: f64,
    pub estimated_cpu_time_remaining: f64,
    pub fraction_done: f64,
    pub state: i32,
    pub scheduler_state: i32,
    pub active_task_state: i32,
    pub active_task: bool,
    pub suspended_via_gui: bool,
    pub project_suspended_via_gui: bool,
    pub ready_to_report: bool,
    pub got_server_ack: bool,
    pub plan_class: String,
    pub resources: String,
    // Extended fields (Phase 2)
    pub version_num: i32,
    pub slot: i32,
    pub pid: i32,
    pub checkpoint_cpu_time: f64,
    pub current_cpu_time: f64,
    pub progress_rate: f64,
    pub working_set_size_smoothed: f64,
    pub swap_size: f64,
    pub slot_path: String,
    pub graphics_exec_path: String,
    pub web_graphics_url: String,
    pub remote_desktop_addr: String,
}

/// A GUI URL associated with a project.
#[derive(Debug, Clone, Serialize, Default)]
pub struct GuiUrl {
    pub name: String,
    pub description: String,
    pub url: String,
}

/// Matches BOINC's PROJECT struct.
#[derive(Debug, Clone, Serialize, Default)]
pub struct Project {
    pub master_url: String,
    pub project_name: String,
    pub user_name: String,
    pub team_name: String,
    pub user_total_credit: f64,
    pub user_expavg_credit: f64,
    pub host_total_credit: f64,
    pub host_expavg_credit: f64,
    pub suspended_via_gui: bool,
    pub dont_request_more_work: bool,
    pub attached_via_acct_mgr: bool,
    // Extended fields (Phase 2)
    pub resource_share: f64,
    pub hostid: i32,
    pub disk_usage: f64,
    pub nrpc_failures: i32,
    pub min_rpc_time: f64,
    pub download_backoff: f64,
    pub upload_backoff: f64,
    pub sched_priority: f64,
    pub duration_correction_factor: f64,
    pub last_rpc_time: f64,
    pub njobs_success: i32,
    pub njobs_error: i32,
    pub venue: String,
    pub gui_urls: Vec<GuiUrl>,
}

/// Matches BOINC's CC_STATUS struct.
#[derive(Debug, Clone, Serialize, Default)]
pub struct CcStatus {
    pub task_mode: i32,
    pub task_mode_perm: i32,
    pub task_mode_delay: f64,
    pub gpu_mode: i32,
    pub gpu_mode_perm: i32,
    pub gpu_mode_delay: f64,
    pub network_mode: i32,
    pub network_mode_perm: i32,
    pub network_mode_delay: f64,
    pub network_status: i32,
    pub task_suspend_reason: i32,
    pub gpu_suspend_reason: i32,
    pub network_suspend_reason: i32,
    pub ams_password_error: bool,
    pub manager_must_quit: bool,
    pub disallow_attach: bool,
    pub simple_gui_only: bool,
    pub max_event_log_lines: i32,
}

/// Matches BOINC's FILE_TRANSFER struct.
#[derive(Debug, Clone, Serialize, Default)]
pub struct FileTransfer {
    pub project_url: String,
    pub project_name: String,
    pub name: String,
    pub nbytes: f64,
    pub status: i32,
    pub bytes_xferred: f64,
    pub xfer_speed: f64,
    pub is_upload: bool,
    pub num_retries: i32,
    pub first_request_time: f64,
    pub next_request_time: f64,
    pub time_so_far: f64,
    pub estimated_xfer_time_remaining: f64,
    pub file_offset: f64,
    pub hostname: String,
    pub project_backoff: f64,
}

/// State of the RPC connection.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub enum ConnectionState {
    Disconnected,
    Connecting,
    Connected,
    AuthError,
}

/// A single day's statistics for a project.
#[derive(Debug, Clone, Serialize, Default)]
pub struct DailyStats {
    pub day: f64,
    pub user_total_credit: f64,
    pub user_expavg_credit: f64,
    pub host_total_credit: f64,
    pub host_expavg_credit: f64,
}

/// Statistics for a single project, containing daily data points.
#[derive(Debug, Clone, Serialize, Default)]
pub struct ProjectStatistics {
    pub master_url: String,
    pub daily_statistics: Vec<DailyStats>,
}

/// A BOINC message (event log entry).
#[derive(Debug, Clone, Serialize, Default)]
pub struct Message {
    pub project: String,
    pub priority: i32,
    pub seqno: i32,
    pub body: String,
    pub timestamp: f64,
}

/// A BOINC notice.
#[derive(Debug, Clone, Serialize, Default)]
pub struct Notice {
    pub seqno: i32,
    pub title: String,
    pub description: String,
    pub create_time: f64,
    pub project_name: String,
    pub link: String,
    pub category: String,
    pub is_private: bool,
}

/// Disk usage for a single project.
#[derive(Debug, Clone, Serialize, Default)]
pub struct DiskUsageProject {
    pub master_url: String,
    pub disk_usage: f64,
}

/// Overall disk usage summary.
#[derive(Debug, Clone, Serialize, Default)]
pub struct DiskUsage {
    pub projects: Vec<DiskUsageProject>,
    pub d_total: f64,
    pub d_free: f64,
    pub d_boinc: f64,
    pub d_allowed: f64,
}

/// Per-day-of-week preferences.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DayOfWeekPrefs {
    pub day_of_week: i32,
    pub start_hour: f64,
    pub end_hour: f64,
    pub net_start_hour: f64,
    pub net_end_hour: f64,
}

/// Global preferences (computing/network/storage settings).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GlobalPreferences {
    pub run_on_batteries: bool,
    pub run_if_user_active: bool,
    pub run_gpu_if_user_active: bool,
    pub idle_time_to_run: f64,
    pub max_ncpus_pct: f64,
    pub cpu_usage_limit: f64,
    pub ram_max_used_busy_frac: f64,
    pub ram_max_used_idle_frac: f64,
    pub max_bytes_sec_down: f64,
    pub max_bytes_sec_up: f64,
    pub daily_xfer_limit_mb: f64,
    pub daily_xfer_period_days: i32,
    pub disk_max_used_gb: f64,
    pub disk_max_used_pct: f64,
    pub disk_min_free_gb: f64,
    pub disk_interval: f64,
    pub work_buf_min_days: f64,
    pub cpu_scheduling_period_minutes: f64,
    pub start_hour: f64,
    pub end_hour: f64,
    pub net_start_hour: f64,
    pub net_end_hour: f64,
    pub suspend_if_no_recent_input: f64,
    pub suspend_cpu_usage: f64,
    pub niu_suspend_cpu_usage: f64,
    pub niu_cpu_usage_limit: f64,
    pub niu_max_ncpus_pct: f64,
    pub leave_apps_in_memory: bool,
    pub dont_verify_images: bool,
    pub confirm_before_connecting: bool,
    pub hangup_if_dialed: bool,
    pub network_wifi_only: bool,
    pub work_buf_additional_days: f64,
    pub max_ncpus: i32,
    pub battery_charge_min_pct: f64,
    pub battery_max_temperature: f64,
    pub vm_max_used_frac: f64,
    pub day_prefs: Vec<DayOfWeekPrefs>,
}

/// GPU coprocessor information (CUDA or OpenCL).
#[derive(Debug, Clone, Serialize, Default)]
pub struct Coproc {
    pub coproc_type: String,
    pub name: String,
    pub count: i32,
    pub available_ram: f64,
    pub driver_version: String,
    pub cuda_version: i32,
    pub compute_cap_major: i32,
    pub compute_cap_minor: i32,
    pub clock_rate: f64,
    pub multiprocessor_count: i32,
    pub peak_flops: f64,
    pub opencl_device_version: String,
    pub opencl_driver_version: String,
    pub vendor: String,
}

/// A WSL distribution.
#[derive(Debug, Clone, Serialize, Default)]
pub struct WslDistro {
    pub distro_name: String,
    pub os_name: String,
    pub os_version: String,
    pub wsl_version: String,
    pub is_buda_runner: bool,
    pub buda_runner_version: i32,
    pub docker_version: String,
    pub docker_type: String,
}

/// Host information.
#[derive(Debug, Clone, Serialize, Default)]
pub struct HostInfo {
    pub domain_name: String,
    pub ip_addr: String,
    pub p_ncpus: i32,
    pub p_vendor: String,
    pub p_model: String,
    pub p_fpops: f64,
    pub p_iops: f64,
    pub m_nbytes: f64,
    pub m_cache: f64,
    pub m_swap: f64,
    pub d_total: f64,
    pub d_free: f64,
    pub os_name: String,
    pub os_version: String,
    pub product_name: String,
    pub virtualbox_version: String,
    pub timezone: i32,
    pub host_cpid: String,
    pub p_features: String,
    pub p_membw: f64,
    pub p_calculated: f64,
    pub p_vm_extensions_disabled: bool,
    pub mac_address: String,
    pub docker_version: String,
    pub coprocs: Vec<Coproc>,
    pub wsl_distros: Vec<WslDistro>,
}

/// Entry in the all-projects list.
#[derive(Debug, Clone, Serialize, Default)]
pub struct ProjectListEntry {
    pub name: String,
    pub url: String,
    pub general_area: String,
    pub specific_area: String,
    pub description: String,
    pub home: String,
    pub platforms: Vec<String>,
}

/// Result of an account lookup (authenticator or error).
#[derive(Debug, Clone, Serialize, Default)]
pub struct AccountOut {
    pub error_num: i32,
    pub authenticator: String,
    pub error_msg: String,
}

/// Result of a project attach operation.
#[derive(Debug, Clone, Serialize, Default)]
pub struct ProjectAttachReply {
    pub error_num: i32,
    pub messages: Vec<String>,
}

/// Project configuration from get_project_config (Phase 4).
#[derive(Debug, Clone, Serialize, Default)]
pub struct ProjectConfig {
    pub error_num: i32,
    pub name: String,
    pub master_url: String,
    pub min_passwd_length: i32,
    pub account_creation_disabled: bool,
    pub client_account_creation_disabled: bool,
    pub uses_username: bool,
    pub terms_of_use: String,
    pub terms_of_use_is_html: bool,
    pub ldap_auth: bool,
    pub platforms: Vec<String>,
    pub sched_stopped: bool,
    pub web_stopped: bool,
}

/// Account manager info (Phase 4).
#[derive(Debug, Clone, Serialize, Default)]
pub struct AcctMgrInfo {
    pub acct_mgr_name: String,
    pub acct_mgr_url: String,
    pub have_credentials: bool,
}

/// Account manager RPC reply (Phase 4).
#[derive(Debug, Clone, Serialize, Default)]
pub struct AcctMgrRpcReply {
    pub error_num: i32,
    pub messages: Vec<String>,
}

/// Proxy settings (Phase 5).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProxyInfo {
    pub use_http_proxy: bool,
    pub http_server_name: String,
    pub http_server_port: i32,
    pub http_user_name: String,
    pub http_user_passwd: String,
    pub use_http_auth: bool,
    pub use_socks_proxy: bool,
    pub socks_server_name: String,
    pub socks_server_port: i32,
    pub socks5_user_name: String,
    pub socks5_user_passwd: String,
    pub socks5_remote_dns: bool,
    pub noproxy_hosts: String,
}

/// CC Config.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CcConfig {
    pub exclusive_apps: Vec<String>,
    pub exclusive_gpu_apps: Vec<String>,
    pub log_flags: LogFlags,
    pub max_file_xfers: i32,
    pub max_file_xfers_per_project: i32,
    pub max_ncpus: i32,
    pub report_results_immediately: bool,
    pub fetch_minimal_work: bool,
    pub http_transfer_timeout: i32,
    pub max_stderr_file_size: i32,
    pub max_stdout_file_size: i32,
}

/// Log flags.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LogFlags {
    pub task: bool,
    pub file_xfer: bool,
    pub sched_ops: bool,
    pub cpu_sched: bool,
    pub network_xfer: bool,
    pub mem_usage: bool,
    pub disk_usage: bool,
    pub http_debug: bool,
    pub state_debug: bool,
    pub statefile_debug: bool,
    pub android_debug: bool,
    pub app_msg_receive: bool,
    pub app_msg_send: bool,
    pub benchmark_debug: bool,
    pub checkpoint_debug: bool,
    pub coproc_debug: bool,
    pub cpu_sched_debug: bool,
    pub cpu_sched_status: bool,
    pub file_xfer_debug: bool,
    pub gui_rpc_debug: bool,
    pub http_xfer_debug: bool,
    pub network_status_debug: bool,
    pub notice_debug: bool,
    pub proxy_debug: bool,
    pub rr_simulation: bool,
    pub suspend_debug: bool,
    pub work_fetch_debug: bool,
}

/// Newer version check result.
#[derive(Debug, Clone, Serialize, Default)]
pub struct NewerVersionInfo {
    pub newer_version: String,
    pub download_url: String,
}

/// Version information from exchange_versions.
#[derive(Debug, Clone, Serialize, Default)]
pub struct VersionInfo {
    pub major: i32,
    pub minor: i32,
    pub release: i32,
}

/// Full client state from get_state.
#[derive(Debug, Clone, Serialize, Default)]
pub struct CcState {
    pub projects: Vec<Project>,
    pub results: Vec<TaskResult>,
    pub platforms: Vec<String>,
    pub version_info: VersionInfo,
    pub executing_as_daemon: bool,
    pub host_info: HostInfo,
}

/// Project init status (for auto-attach).
#[derive(Debug, Clone, Serialize, Default)]
pub struct ProjectInitStatus {
    pub url: String,
    pub name: String,
    pub team_name: String,
    pub has_account_key: bool,
    pub embedded: bool,
}

/// A single daily transfer record.
#[derive(Debug, Clone, Serialize, Default)]
pub struct DailyXfer {
    pub when: i32,
    pub up: f64,
    pub down: f64,
}

/// Daily transfer history.
#[derive(Debug, Clone, Serialize, Default)]
pub struct DailyXferHistory {
    pub daily_xfers: Vec<DailyXfer>,
}

/// An old (completed) result.
#[derive(Debug, Clone, Serialize, Default)]
pub struct OldResult {
    pub project_url: String,
    pub result_name: String,
    pub app_name: String,
    pub exit_status: i32,
    pub elapsed_time: f64,
    pub cpu_time: f64,
    pub completed_time: f64,
    pub create_time: f64,
}
