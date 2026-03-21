import type { PerformanceRow, StageDayRow } from "../api/types";

/** One hour after the last performance ends, advance to the next stage day (if any). */
export const HOUR_AFTER_LAST_MS = 60 * 60 * 1000;

/** End of the last performance on this day (local event time). */
export function getLastPerformanceEndMs(dayDate: string, sorted: PerformanceRow[]): number | null {
  if (sorted.length === 0) return null;
  const last = sorted[sorted.length - 1];
  const start = new Date(`${dayDate}T${last.startTime.slice(0, 5)}:00`);
  if (last.endTime) {
    return new Date(`${dayDate}T${last.endTime.slice(0, 5)}:00`).getTime();
  }
  return start.getTime() + 60 * 60 * 1000;
}

/** Next calendar day on this stage, or null if this is the last one. */
export function findNextStageDay(
  stageDays: StageDayRow[],
  currentStageDayId: string,
): StageDayRow | null {
  const list = [...stageDays].sort((a, b) => {
    const d = a.dayDate.localeCompare(b.dayDate);
    if (d !== 0) return d;
    return a.sortOrder - b.sortOrder;
  });
  const i = list.findIndex((d) => d.id === currentStageDayId);
  if (i < 0 || i >= list.length - 1) return null;
  return list[i + 1] ?? null;
}
