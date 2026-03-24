const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * YYYY-MM-DD in the browser's local calendar — matches `stage_days.day_date`
 * and date pickers (naive calendar day, not UTC).
 */
export function formatLocalCalendarDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Fri 20 Jun 2026" from "2026-06-20" */
export function formatDateFriendly(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${SHORT_DAYS[dt.getDay()]} ${d} ${SHORT_MONTHS[dt.getMonth()]} ${y}`;
}

/** "Fri 20 Jun" (no year) */
export function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${SHORT_DAYS[dt.getDay()]} ${d} ${SHORT_MONTHS[dt.getMonth()]}`;
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Add minutes to HH:mm; wraps past midnight (00:00–23:59 wall clock, same as HTML time inputs). */
export function addMinutesToHhmm(hhmm: string, delta: number): string {
  let total = hhmmToMinutes(hhmm) + delta;
  total = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * Set length in minutes from start/end wall times (end may be “next morning” after midnight).
 */
export function slotDurationMinutes(start: string, end: string): number {
  const s = hhmmToMinutes(start.slice(0, 5));
  const e = hhmmToMinutes(end.slice(0, 5));
  if (Number.isNaN(s) || Number.isNaN(e) || e === s) return 0;
  if (e > s) return e - s;
  return 1440 - s + e;
}

/** Format a duration in minutes: "45 min" or "1h 15m" */
export function formatDuration(mins: number): string {
  if (mins < 0) return `−${formatDuration(-mins)}`;
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Format seconds as M:SS */
export function formatCountdown(seconds: number): string {
  if (seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const SECONDS_PER_HOUR = 60 * 60;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;

/**
 * Time until the next act: explicit units at three scales —
 * under 1 hour: minutes + seconds (e.g. `12m 05s`);
 * 1 hour up to (but not including) 24 hours: hours + minutes (e.g. `2h 15m`);
 * 24 hours or more: whole days (e.g. `3 days`).
 */
export function formatCountdownOrDays(seconds: number): string {
  if (seconds < 0) return "0m 00s";
  if (seconds >= SECONDS_PER_DAY) {
    const days = Math.floor(seconds / SECONDS_PER_DAY);
    return days === 1 ? "1 day" : `${days} days`;
  }
  if (seconds >= SECONDS_PER_HOUR) {
    const h = Math.floor(seconds / SECONDS_PER_HOUR);
    const m = Math.floor((seconds % SECONDS_PER_HOUR) / 60);
    return `${h}h ${m}m`;
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

/**
 * Stage clock hero, patch sidebar countdown, and clock focus “starts in” —
 * **minutes:seconds** ({@link formatCountdown}: total minutes, not wrapped at 60) for waits under **24 hours**;
 * **whole days** when the gap is a day or more (easier to read than very large minute counts).
 */
export function formatStageClockCountdown(seconds: number): string {
  if (seconds < 0) return "0:00";
  if (seconds >= SECONDS_PER_DAY) {
    const days = Math.floor(seconds / SECONDS_PER_DAY);
    return days === 1 ? "1 day" : `${days} days`;
  }
  return formatCountdown(seconds);
}

/**
 * Same as {@link formatStageClockCountdown}; `heroLabel` is kept for call sites only (format does not depend on it).
 */
export function formatClockHeroCountdown(_heroLabel: string, seconds: number): string {
  return formatStageClockCountdown(seconds);
}
