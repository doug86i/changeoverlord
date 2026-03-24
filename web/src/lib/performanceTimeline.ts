import type { PerformanceRow } from "../api/types";
import { formatLocalCalendarDate } from "./dateFormat";

/** Running order: sortOrder, then start time, then id (matches API). */
export function sortPerformancesByRunOrder(p: PerformanceRow[]): PerformanceRow[] {
  return [...p].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    const t = a.startTime.localeCompare(b.startTime);
    if (t !== 0) return t;
    return a.id.localeCompare(b.id);
  });
}

function hhmmToMinutes(hhmm: string): number {
  const parts = hhmm.split(":");
  if (parts.length !== 2) return Number.NaN;
  const h = Number(parts[0]!);
  const m = Number(parts[1]!);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return Number.NaN;
  if (h < 0 || h > 23 || m < 0 || m > 59) return Number.NaN;
  return h * 60 + m;
}

export type PerformanceTimelineRow = {
  startMs: number;
  endMs: number | null;
};

/**
 * Absolute wall times for each performance (overnight slots and post-midnight acts).
 * `sorted` must already be in running order (see {@link sortPerformancesByRunOrder}).
 */
export function buildPerformanceTimeline(
  dayDate: string,
  sorted: PerformanceRow[],
): PerformanceTimelineRow[] {
  const day0 = new Date(`${dayDate}T00:00:00`).getTime();
  const out: PerformanceTimelineRow[] = [];
  let prevEndExt: number | null = null;

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const s = hhmmToMinutes(p.startTime.slice(0, 5));
    let startExt = s;
    if (prevEndExt !== null) {
      while (startExt < prevEndExt) {
        startExt += 1440;
      }
    }
    const startMs = day0 + startExt * 60 * 1000;

    if (p.endTime) {
      const e = hhmmToMinutes(p.endTime.slice(0, 5));
      if (e === s) {
        prevEndExt = startExt;
        out.push({ startMs, endMs: startMs });
        continue;
      }
      let endExt: number;
      if (e > s) {
        endExt = startExt + (e - s);
      } else {
        endExt = startExt + (1440 - s + e);
      }
      const endMs = day0 + endExt * 60 * 1000;
      prevEndExt = endExt;
      out.push({ startMs, endMs });
    } else {
      const next = sorted[i + 1];
      if (!next) {
        prevEndExt = startExt + 1;
        out.push({ startMs, endMs: null });
        continue;
      }
      const ns = hhmmToMinutes(next.startTime.slice(0, 5));
      let nextStartExt = ns;
      while (nextStartExt <= startExt) {
        nextStartExt += 1440;
      }
      const endMs = day0 + nextStartExt * 60 * 1000;
      prevEndExt = nextStartExt;
      out.push({ startMs, endMs });
    }
  }

  return out;
}

/** True when the resolved start instant is on a later calendar day than `stageDayDate` (YYYY-MM-DD). */
export function isTimelineStartNextCalendarDay(
  stageDayDate: string,
  startMs: number,
): boolean {
  const startDay = formatLocalCalendarDate(new Date(startMs));
  return startDay > stageDayDate;
}
