const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

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

/** Add minutes to HH:mm (same calendar day, clamped 00:00–23:59). */
export function addMinutesToHhmm(hhmm: string, delta: number): string {
  let total = hhmmToMinutes(hhmm) + delta;
  total = Math.max(0, Math.min(24 * 60 - 1, total));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/** Minutes between two HH:mm strings. Returns null if either is missing. */
export function minutesBetween(
  a: string | null | undefined,
  b: string | null | undefined,
): number | null {
  if (!a || !b) return null;
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return bh * 60 + bm - (ah * 60 + am);
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
