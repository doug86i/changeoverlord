/** Minutes from midnight for HH:mm (24h). */
export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
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
    if (da !== db) return da - db;
    return a.id.localeCompare(b.id);
  });

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const s = hhmmToMinutes(p.startTime);
    const next = sorted[i + 1];
    const nextStart = next ? hhmmToMinutes(next.startTime) : null;

    if (p.endTime !== null) {
      const e = hhmmToMinutes(p.endTime);
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
