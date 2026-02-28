import type { CcStatus } from "../../types/boinc";
import { RUN_MODE, SUSPEND_REASON } from "../../types/boinc";

export const mockCcStatus: CcStatus = {
  task_mode: RUN_MODE.AUTO,
  task_mode_perm: RUN_MODE.AUTO,
  task_mode_delay: 0,
  task_suspend_reason: SUSPEND_REASON.CPU_THROTTLE,
  gpu_mode: RUN_MODE.AUTO,
  gpu_mode_perm: RUN_MODE.AUTO,
  gpu_mode_delay: 0,
  gpu_suspend_reason: 0,
  network_mode: RUN_MODE.AUTO,
  network_mode_perm: RUN_MODE.AUTO,
  network_mode_delay: 0,
  network_suspend_reason: 0,
  network_status: 0,
  ams_password_error: false,
  manager_must_quit: false,
  disallow_attach: false,
  simple_gui_only: false,
  max_event_log_lines: 2000,
};
