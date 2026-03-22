/** Minutes from midnight for HH:mm (24h). Returns NaN if the string is malformed. */
export function hhmmToMinutes(hhmm: string): number {
  const parts = hhmm.split(":");
  if (parts.length !== 2) return Number.NaN;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return Number.NaN;
  if (h < 0 || h > 23 || m < 0 || m > 59) return Number.NaN;
  return h * 60 + m;
}

export type PerfInterval = {
  id: string;
  startTime: string;
  endTime: string | null;
};

/**
 * Returns an error message if performances overlap or times are invalid; otherwise null.
 * Sorted by start time. Open-ended slots (no end) run until the next performance's start.
 * Touching at boundaries (end 14:00, next start 14:00) is allowed.
 */
export function validatePerformanceSchedule(
  items: PerfInterval[],
): string | null {
  if (items.length === 0) return null;

  const sorted = [...items].sort((a, b) => {
    const da = hhmmToMinutes(a.startTime);
    const db = hhmmToMinutes(b.startTime);
    if (Number.isNaN(da) || Number.isNaN(db)) return a.id.localeCompare(b.id);
    if (da !== db) return da - db;
    return a.id.localeCompare(b.id);
  });

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const s = hhmmToMinutes(p.startTime);
    if (Number.isNaN(s)) return "Invalid start time (use HH:mm)";
    const next = sorted[i + 1];
    const nextStart = next ? hhmmToMinutes(next.startTime) : null;
    if (nextStart != null && Number.isNaN(nextStart)) {
      return "Invalid start time (use HH:mm)";
    }

    if (p.endTime !== null) {
      const e = hhmmToMinutes(p.endTime);
      if (Number.isNaN(e)) return "Invalid end time (use HH:mm)";
      if (e <= s) return "End time must be after start time";
      if (nextStart !== null && e > nextStart) {
        return "Performances overlap — adjust times so slots do not overlap";
      }
    } else if (next !== null) {
      if (s >= nextStart!) {
        return "Performances overlap — same start time as another act, or adjust end times";
      }
    }
  }

  return null;
}
