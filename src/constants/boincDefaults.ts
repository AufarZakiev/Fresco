import type { GlobalPreferences } from "../types/boinc";

/** BOINC hardcoded boolean defaults (from lib/prefs.cpp). */
export const BOINC_BOOL_DEFAULTS: Partial<Record<keyof GlobalPreferences, boolean>> = {
  run_on_batteries: false,
  run_if_user_active: true,
  leave_apps_in_memory: false,
};

/** BOINC hardcoded defaults (from lib/prefs.cpp). */
export const BOINC_DEFAULTS: Partial<Record<keyof GlobalPreferences, number>> = {
  idle_time_to_run: 3,
  max_ncpus_pct: 100,
  cpu_usage_limit: 100,
  ram_max_used_busy_frac: 0.5,
  ram_max_used_idle_frac: 0.9,
  max_bytes_sec_down: 0,
  max_bytes_sec_up: 0,
  daily_xfer_limit_mb: 0,
  daily_xfer_period_days: 0,
  disk_max_used_gb: 0,
  disk_max_used_pct: 90,
  disk_min_free_gb: 0.1,
  disk_interval: 60,
  work_buf_min_days: 0.1,
  work_buf_additional_days: 0.25,
  cpu_scheduling_period_minutes: 60,
  start_hour: 0,
  end_hour: 0,
  net_start_hour: 0,
  net_end_hour: 0,
  suspend_if_no_recent_input: 0,
  suspend_cpu_usage: 25,
  niu_suspend_cpu_usage: 50,
  niu_cpu_usage_limit: 100,
  niu_max_ncpus_pct: 100,
  max_ncpus: 0,
  battery_charge_min_pct: 90,
  battery_max_temperature: 40,
  vm_max_used_frac: 0.75,
};
