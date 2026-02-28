/** Matches Rust TaskResult / BOINC RESULT struct. */
export interface TaskResult {
  name: string;
  wu_name: string;
  project_url: string;
  report_deadline: number;
  received_time: number;
  elapsed_time: number;
  estimated_cpu_time_remaining: number;
  fraction_done: number;
  state: number;
  scheduler_state: number;
  active_task_state: number;
  active_task: boolean;
  suspended_via_gui: boolean;
  project_suspended_via_gui: boolean;
  ready_to_report: boolean;
  got_server_ack: boolean;
  plan_class: string;
  resources: string;
  // Extended fields (Phase 2)
  version_num: number;
  slot: number;
  pid: number;
  checkpoint_cpu_time: number;
  current_cpu_time: number;
  progress_rate: number;
  working_set_size_smoothed: number;
  swap_size: number;
  slot_path: string;
  graphics_exec_path: string;
  web_graphics_url: string;
  remote_desktop_addr: string;
}

/** A GUI URL associated with a project. */
export interface GuiUrl {
  name: string;
  description: string;
  url: string;
}

/** Matches Rust Project / BOINC PROJECT struct. */
export interface Project {
  master_url: string;
  project_name: string;
  user_name: string;
  team_name: string;
  user_total_credit: number;
  user_expavg_credit: number;
  host_total_credit: number;
  host_expavg_credit: number;
  suspended_via_gui: boolean;
  dont_request_more_work: boolean;
  attached_via_acct_mgr: boolean;
  // Extended fields (Phase 2)
  resource_share: number;
  hostid: number;
  disk_usage: number;
  nrpc_failures: number;
  min_rpc_time: number;
  download_backoff: number;
  upload_backoff: number;
  sched_priority: number;
  duration_correction_factor: number;
  last_rpc_time: number;
  njobs_success: number;
  njobs_error: number;
  venue: string;
  gui_urls: GuiUrl[];
}

/** Matches Rust CcStatus / BOINC CC_STATUS struct. */
export interface CcStatus {
  task_mode: number;
  task_mode_perm: number;
  task_mode_delay: number;
  gpu_mode: number;
  gpu_mode_perm: number;
  gpu_mode_delay: number;
  network_mode: number;
  network_mode_perm: number;
  network_mode_delay: number;
  network_status: number;
  task_suspend_reason: number;
  gpu_suspend_reason: number;
  network_suspend_reason: number;
  ams_password_error: boolean;
  manager_must_quit: boolean;
  disallow_attach: boolean;
  simple_gui_only: boolean;
  max_event_log_lines: number;
}

/** Matches Rust FileTransfer / BOINC FILE_TRANSFER struct. */
export interface FileTransfer {
  project_url: string;
  project_name: string;
  name: string;
  nbytes: number;
  status: number;
  bytes_xferred: number;
  xfer_speed: number;
  is_upload: boolean;
  num_retries: number;
  first_request_time: number;
  next_request_time: number;
  time_so_far: number;
  estimated_xfer_time_remaining: number;
  file_offset: number;
  hostname: string;
  project_backoff: number;
}

/** BOINC run mode codes (from common_defs.h). */
export const RUN_MODE = {
  ALWAYS: 1,
  AUTO: 2,
  NEVER: 3,
} as const;

export type RunMode = (typeof RUN_MODE)[keyof typeof RUN_MODE];

/** Connection state string constants. */
export const CONNECTION_STATE = {
  DISCONNECTED: "Disconnected",
  CONNECTING: "Connecting",
  CONNECTED: "Connected",
  RECONNECTING: "Reconnecting",
  AUTH_ERROR: "AuthError",
} as const;

export type ConnectionState =
  | (typeof CONNECTION_STATE)[keyof typeof CONNECTION_STATE]
  | { Error: string };

/** Sort direction constants. */
export const SORT_DIR = {
  ASC: "asc",
  DESC: "desc",
} as const;

export type SortDir = (typeof SORT_DIR)[keyof typeof SORT_DIR];

/** Connection mode constants. */
export const CONNECTION_MODE = {
  LOCAL: "local",
  REMOTE: "remote",
} as const;

export type ConnectionMode = (typeof CONNECTION_MODE)[keyof typeof CONNECTION_MODE];

/** BOINC result state codes (from common_defs.h). */
export const RESULT_STATE = {
  NEW: 0,
  FILES_DOWNLOADING: 1,
  FILES_DOWNLOADED: 2,
  COMPUTE_ERROR: 3,
  FILES_UPLOADING: 4,
  FILES_UPLOADED: 5,
  ABORTED: 6,
  UPLOAD_FAILED: 7,
} as const;

/** BOINC active task state codes. */
export const ACTIVE_TASK_STATE = {
  UNINITIALIZED: 0,
  EXECUTING: 1,
  SUSPENDED: 9,
  ABORT_PENDING: 5,
  QUIT_PENDING: 8,
  COPY_PENDING: 10,
} as const;

/** BOINC scheduler state codes. */
export const SCHEDULER_STATE = {
  UNINITIALIZED: 0,
  PREEMPTED: 1,
  SCHEDULED: 2,
} as const;

/** Suspend reason bitmask values (from common_defs.h). */
export const SUSPEND_REASON = {
  BATTERIES: 1,
  USER_ACTIVE: 2,
  USER_REQ: 4,
  TIME_OF_DAY: 8,
  BENCHMARKS: 16,
  DISK_SIZE: 32,
  CPU_THROTTLE: 64,
  NO_RECENT_INPUT: 128,
  INITIAL_DELAY: 256,
  EXCLUSIVE_APP: 512,
  CPU_USAGE: 1024,
  NETWORK_QUOTA: 2048,
  OS: 4096,
} as const;

/** A single day's statistics for a project. */
export interface DailyStats {
  day: number;
  user_total_credit: number;
  user_expavg_credit: number;
  host_total_credit: number;
  host_expavg_credit: number;
}

/** Statistics for a single project. */
export interface ProjectStatistics {
  master_url: string;
  daily_statistics: DailyStats[];
}

/** A BOINC message (event log entry). */
export interface Message {
  project: string;
  priority: number;
  seqno: number;
  body: string;
  timestamp: number;
}

/** Message priority levels. */
export const MSG_PRIORITY = {
  INFO: 1,
  USER_ALERT: 2,
  INTERNAL_ERROR: 3,
} as const;

/** A BOINC notice. */
export interface Notice {
  seqno: number;
  title: string;
  description: string;
  create_time: number;
  project_name: string;
  link: string;
  category: string;
  is_private: boolean;
}

/** Disk usage for a single project. */
export interface DiskUsageProject {
  master_url: string;
  disk_usage: number;
}

/** Overall disk usage summary. */
export interface DiskUsage {
  projects: DiskUsageProject[];
  d_total: number;
  d_free: number;
  d_boinc: number;
  d_allowed: number;
}

/** Per-day-of-week preferences. */
export interface DayOfWeekPrefs {
  day_of_week: number;
  start_hour: number;
  end_hour: number;
  net_start_hour: number;
  net_end_hour: number;
}

/** Global preferences. */
export interface GlobalPreferences {
  run_on_batteries: boolean;
  run_if_user_active: boolean;
  run_gpu_if_user_active: boolean;
  idle_time_to_run: number;
  max_ncpus_pct: number;
  cpu_usage_limit: number;
  ram_max_used_busy_frac: number;
  ram_max_used_idle_frac: number;
  max_bytes_sec_down: number;
  max_bytes_sec_up: number;
  daily_xfer_limit_mb: number;
  daily_xfer_period_days: number;
  disk_max_used_gb: number;
  disk_max_used_pct: number;
  disk_min_free_gb: number;
  disk_interval: number;
  work_buf_min_days: number;
  cpu_scheduling_period_minutes: number;
  start_hour: number;
  end_hour: number;
  net_start_hour: number;
  net_end_hour: number;
  suspend_if_no_recent_input: number;
  suspend_cpu_usage: number;
  niu_suspend_cpu_usage: number;
  niu_cpu_usage_limit: number;
  niu_max_ncpus_pct: number;
  leave_apps_in_memory: boolean;
  dont_verify_images: boolean;
  confirm_before_connecting: boolean;
  hangup_if_dialed: boolean;
  network_wifi_only: boolean;
  work_buf_additional_days: number;
  max_ncpus: number;
  battery_charge_min_pct: number;
  battery_max_temperature: number;
  vm_max_used_frac: number;
  day_prefs: DayOfWeekPrefs[];
}

/** GPU coprocessor information (CUDA or OpenCL). */
export interface Coproc {
  coproc_type: string;
  name: string;
  count: number;
  available_ram: number;
  driver_version: string;
  cuda_version: number;
  compute_cap_major: number;
  compute_cap_minor: number;
  clock_rate: number;
  multiprocessor_count: number;
  peak_flops: number;
  opencl_device_version: string;
  opencl_driver_version: string;
  vendor: string;
}

/** A WSL distribution. */
export interface WslDistro {
  distro_name: string;
  os_name: string;
  os_version: string;
  wsl_version: string;
  is_buda_runner: boolean;
  buda_runner_version: number;
  docker_version: string;
  docker_type: string;
}

/** Host information. */
export interface HostInfo {
  domain_name: string;
  ip_addr: string;
  p_ncpus: number;
  p_vendor: string;
  p_model: string;
  p_fpops: number;
  p_iops: number;
  m_nbytes: number;
  m_cache: number;
  m_swap: number;
  d_total: number;
  d_free: number;
  os_name: string;
  os_version: string;
  product_name: string;
  virtualbox_version: string;
  timezone: number;
  host_cpid: string;
  p_features: string;
  p_membw: number;
  p_calculated: number;
  p_vm_extensions_disabled: boolean;
  mac_address: string;
  docker_version: string;
  coprocs: Coproc[];
  wsl_distros: WslDistro[];
}

/** Entry in the all-projects list. */
export interface ProjectListEntry {
  name: string;
  url: string;
  general_area: string;
  specific_area: string;
  description: string;
  home: string;
  platforms: string[];
}

/** Result of an account lookup. */
export interface AccountOut {
  error_num: number;
  authenticator: string;
  error_msg: string;
}

/** Result of a project attach operation. */
export interface ProjectAttachReply {
  error_num: number;
  messages: string[];
}

/** Project configuration (Phase 4). */
export interface ProjectConfig {
  error_num: number;
  name: string;
  master_url: string;
  min_passwd_length: number;
  account_creation_disabled: boolean;
  client_account_creation_disabled: boolean;
  uses_username: boolean;
  terms_of_use: string;
  terms_of_use_is_html: boolean;
  ldap_auth: boolean;
  platforms: string[];
  sched_stopped: boolean;
  web_stopped: boolean;
}

/** Account manager info (Phase 4). */
export interface AcctMgrInfo {
  acct_mgr_name: string;
  acct_mgr_url: string;
  have_credentials: boolean;
}

/** Account manager RPC reply (Phase 4). */
export interface AcctMgrRpcReply {
  error_num: number;
  messages: string[];
}

/** Proxy settings (Phase 5). */
export interface ProxyInfo {
  use_http_proxy: boolean;
  http_server_name: string;
  http_server_port: number;
  http_user_name: string;
  http_user_passwd: string;
  use_http_auth: boolean;
  use_socks_proxy: boolean;
  socks_server_name: string;
  socks_server_port: number;
  socks5_user_name: string;
  socks5_user_passwd: string;
  socks5_remote_dns: boolean;
  noproxy_hosts: string;
}

/** Log flags. */
export interface LogFlags {
  task: boolean;
  file_xfer: boolean;
  sched_ops: boolean;
  cpu_sched: boolean;
  network_xfer: boolean;
  mem_usage: boolean;
  disk_usage: boolean;
  http_debug: boolean;
  state_debug: boolean;
  statefile_debug: boolean;
  android_debug: boolean;
  app_msg_receive: boolean;
  app_msg_send: boolean;
  benchmark_debug: boolean;
  checkpoint_debug: boolean;
  coproc_debug: boolean;
  cpu_sched_debug: boolean;
  cpu_sched_status: boolean;
  file_xfer_debug: boolean;
  gui_rpc_debug: boolean;
  http_xfer_debug: boolean;
  network_status_debug: boolean;
  notice_debug: boolean;
  proxy_debug: boolean;
  rr_simulation: boolean;
  suspend_debug: boolean;
  work_fetch_debug: boolean;
}

/** CC Config. */
export interface CcConfig {
  exclusive_apps: string[];
  exclusive_gpu_apps: string[];
  log_flags: LogFlags;
  max_file_xfers: number;
  max_file_xfers_per_project: number;
  max_ncpus: number;
  report_results_immediately: boolean;
  fetch_minimal_work: boolean;
  http_transfer_timeout: number;
  max_stderr_file_size: number;
  max_stdout_file_size: number;
}

/** Newer version info. */
export interface NewerVersionInfo {
  newer_version: string;
  download_url: string;
}

/** Version information from exchange_versions. */
export interface VersionInfo {
  major: number;
  minor: number;
  release: number;
}

/** Full client state from get_state. */
export interface CcState {
  projects: Project[];
  results: TaskResult[];
  platforms: string[];
  version_info: VersionInfo;
  executing_as_daemon: boolean;
  host_info: HostInfo;
}

/** Project init status (for auto-attach). */
export interface ProjectInitStatus {
  url: string;
  name: string;
  team_name: string;
  has_account_key: boolean;
  embedded: boolean;
}

/** A single daily transfer record. */
export interface DailyXfer {
  when: number;
  up: number;
  down: number;
}

/** Daily transfer history. */
export interface DailyXferHistory {
  daily_xfers: DailyXfer[];
}

/** An old (completed) result. */
export interface OldResult {
  project_url: string;
  result_name: string;
  app_name: string;
  exit_status: number;
  elapsed_time: number;
  cpu_time: number;
  completed_time: number;
  create_time: number;
}
