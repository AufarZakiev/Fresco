export interface TimeObj {
  hours: number;
  minutes: number;
}

/**
 * Convert decimal hours (BOINC format) to a TimeObj for VueDatePicker.
 * 0 → null (meaning "all day"), 8.5 → {hours:8, minutes:30}, 24 → {hours:23, minutes:59}
 */
export function decimalHoursToTimeObj(n: number): TimeObj | null {
  if (n === 0) return null;
  if (n >= 24) return { hours: 23, minutes: 59 };
  const hours = Math.floor(n);
  const minutes = Math.round((n - hours) * 60);
  return { hours, minutes };
}

/**
 * Convert a VueDatePicker TimeObj back to decimal hours.
 * null → 0, {hours:8, minutes:30} → 8.5
 */
export function timeObjToDecimalHours(obj: TimeObj | null | undefined): number {
  if (!obj) return 0;
  return obj.hours + obj.minutes / 60;
}

/**
 * Convert decimal hours (BOINC format) to HH:MM time string.
 * 0 → "" (meaning "all day" / no restriction), 8.5 → "08:30", 24 → "23:59"
 */
export function decimalHoursToTimeString(n: number): string {
  if (n === 0) return "";
  if (n >= 24) return "23:59";
  const hours = Math.floor(n);
  const minutes = Math.round((n - hours) * 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Convert HH:MM time string to decimal hours (BOINC format).
 * "" → 0, "08:30" → 8.5
 */
export function timeStringToDecimalHours(s: string): number {
  if (!s) return 0;
  const [h, m] = s.split(":").map(Number);
  return h + m / 60;
}
