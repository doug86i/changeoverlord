import type { PerformanceRow } from "../api/types";

function parseLocal(dayDate: string, hhmm: string): Date {
  const t = hhmm.slice(0, 5);
  return new Date(`${dayDate}T${t}:00`);
}

export function sortPerformancesByStart(p: PerformanceRow[]): PerformanceRow[] {
  return [...p].sort((a, b) => {
    const t = a.startTime.localeCompare(b.startTime);
    if (t !== 0) return t;
    return a.id.localeCompare(b.id);
  });
}

/** Same rules as the stage day clock hero (time left / until next / next act in). */
export function computeStageDayClockMetrics(
  dayDate: string,
  sorted: PerformanceRow[],
  now: Date,
): {
  currentIdx: number;
  nextIdx: number;
  secondsToNext: number | null;
  secondsRemaining: number | null;
  heroSeconds: number | null;
  heroLabel: string;
} {
  if (!dayDate || sorted.length === 0) {
    return {
      currentIdx: -1,
      nextIdx: -1,
      secondsToNext: null,
      secondsRemaining: null,
      heroSeconds: null,
      heroLabel: "",
    };
  }
  let current = -1;
  let remaining: number | null = null;
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const start = parseLocal(dayDate, p.startTime);
    const nextStart = sorted[i + 1] ? parseLocal(dayDate, sorted[i + 1].startTime) : null;
    const end = p.endTime ? parseLocal(dayDate, p.endTime) : nextStart;
    if (now >= start && (!end || now < end)) {
      current = i;
      if (end) remaining = Math.floor((end.getTime() - now.getTime()) / 1000);
      break;
    }
  }
  let next = -1;
  let sec: number | null = null;
  for (let i = 0; i < sorted.length; i++) {
    const start = parseLocal(dayDate, sorted[i].startTime);
    if (start > now) {
      next = i;
      sec = Math.floor((start.getTime() - now.getTime()) / 1000);
      break;
    }
  }

  let heroSeconds: number | null = null;
  let heroLabel = "";
  if (current >= 0) {
    if (remaining !== null) {
      heroSeconds = remaining;
      heroLabel = "Time left";
    } else if (sec !== null) {
      heroSeconds = sec;
      heroLabel = "Until next act";
    } else {
      heroLabel = "On stage";
    }
  } else if (sec !== null) {
    heroSeconds = sec;
    heroLabel = "Next act in";
  } else {
    heroLabel = "Finished";
  }

  return {
    currentIdx: current,
    nextIdx: next,
    secondsToNext: sec,
    secondsRemaining: remaining,
    heroSeconds,
    heroLabel,
  };
}
