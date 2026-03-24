import type { PerformanceRow, StageDayRow } from "../api/types";
import { buildPerformanceTimeline } from "./performanceTimeline";

/** One hour after the last performance ends, advance to the next stage day (if any). */
export const HOUR_AFTER_LAST_MS = 60 * 60 * 1000;

/** End of the last performance on this day (local event time; overnight-aware). */
export function getLastPerformanceEndMs(dayDate: string, sorted: PerformanceRow[]): number | null {
  if (sorted.length === 0) return null;
  const timeline = buildPerformanceTimeline(dayDate, sorted);
  const last = timeline[timeline.length - 1]!;
  if (last.endMs !== null) return last.endMs;
  return last.startMs + 60 * 60 * 1000;
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
