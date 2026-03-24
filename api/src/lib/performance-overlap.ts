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
  sortOrder: number;
  startTime: string;
  endTime: string | null;
};

type WalkOk = {
  ok: true;
  /** Extended minutes from midnight of the stage day (may exceed 1440). */
  startExtents: Map<string, number>;
};

type WalkErr = { ok: false; message: string };

/**
 * Walks performances in running order (sortOrder, startTime, id) and assigns
 * extended start times so overnight slots and post-midnight acts order correctly.
 */
export function walkPerformanceTimeline(
  items: PerfInterval[],
): WalkOk | WalkErr {
  if (items.length === 0) return { ok: true, startExtents: new Map() };

  const sorted = [...items].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    const t = a.startTime.localeCompare(b.startTime);
    if (t !== 0) return t;
    return a.id.localeCompare(b.id);
  });

  const startExtents = new Map<string, number>();
  let prevEndExt: number | null = null;

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const s = hhmmToMinutes(p.startTime);
    if (Number.isNaN(s)) return { ok: false, message: "Invalid start time (use HH:mm)" };

    let startExt = s;
    if (prevEndExt !== null) {
      while (startExt < prevEndExt) {
        startExt += 1440;
      }
    }
    startExtents.set(p.id, startExt);

    if (p.endTime !== null) {
      const e = hhmmToMinutes(p.endTime);
      if (Number.isNaN(e)) return { ok: false, message: "Invalid end time (use HH:mm)" };
      if (e === s) {
        return { ok: false, message: "End time must be after start time" };
      }
      let endExt: number;
      if (e > s) {
        endExt = startExt + (e - s);
      } else {
        endExt = startExt + (1440 - s + e);
      }
      prevEndExt = endExt;
    } else {
      const next = sorted[i + 1];
      if (!next) {
        prevEndExt = startExt + 1;
        continue;
      }
      const ns = hhmmToMinutes(next.startTime);
      if (Number.isNaN(ns)) return { ok: false, message: "Invalid start time (use HH:mm)" };
      let nextStartExt = ns;
      while (nextStartExt <= startExt) {
        nextStartExt += 1440;
      }
      prevEndExt = nextStartExt;
    }
  }

  return { ok: true, startExtents };
}

/**
 * Returns an error message if performances overlap or times are invalid; otherwise null.
 * Running order is sortOrder, then startTime, then id.
 */
export function validatePerformanceSchedule(items: PerfInterval[]): string | null {
  const w = walkPerformanceTimeline(items);
  if (!w.ok) return w.message;
  return null;
}

/**
 * Returns performance ids sorted by extended chronological start (then id).
 */
export function chronologicalIdsByExtendedStart(items: PerfInterval[]): string[] | null {
  const w = walkPerformanceTimeline(items);
  if (!w.ok) return null;
  const pairs = items.map((p) => ({
    id: p.id,
    sx: w.startExtents.get(p.id) ?? 0,
  }));
  pairs.sort((a, b) => {
    if (a.sx !== b.sx) return a.sx - b.sx;
    return a.id.localeCompare(b.id);
  });
  return pairs.map((x) => x.id);
}
