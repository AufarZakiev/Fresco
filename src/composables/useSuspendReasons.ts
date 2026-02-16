import { SUSPEND_REASON } from "../types/boinc";

const REASON_LABELS: Record<number, string> = {
  [SUSPEND_REASON.BATTERIES]: "On batteries",
  [SUSPEND_REASON.USER_ACTIVE]: "User active",
  [SUSPEND_REASON.USER_REQ]: "Suspended by user",
  [SUSPEND_REASON.TIME_OF_DAY]: "Time of day",
  [SUSPEND_REASON.BENCHMARKS]: "Running benchmarks",
  [SUSPEND_REASON.DISK_SIZE]: "Disk full",
  [SUSPEND_REASON.CPU_THROTTLE]: "CPU throttled",
  [SUSPEND_REASON.NO_RECENT_INPUT]: "No recent input",
  [SUSPEND_REASON.INITIAL_DELAY]: "Initial delay",
  [SUSPEND_REASON.EXCLUSIVE_APP]: "Exclusive app running",
  [SUSPEND_REASON.CPU_USAGE]: "CPU busy",
  [SUSPEND_REASON.NETWORK_QUOTA]: "Network quota exceeded",
  [SUSPEND_REASON.OS]: "OS restriction",
};

/**
 * Returns an array of human-readable suspend reason strings
 * decoded from a BOINC suspend-reason bitmask.
 */
export function getSuspendReasonList(reason: number): string[] {
  if (reason === 0) return [];

  const reasons: string[] = [];
  for (const [bit, label] of Object.entries(REASON_LABELS)) {
    if (reason & Number(bit)) {
      reasons.push(label);
    }
  }
  return reasons;
}

/**
 * Returns a comma-separated string of human-readable suspend reasons
 * decoded from a BOINC suspend-reason bitmask, or an empty string if
 * no reasons are set.
 */
export function getSuspendReasonText(reason: number): string {
  if (reason === 0) return "";
  return getSuspendReasonList(reason).join(", ");
}
