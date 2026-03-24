import type { PerformanceRow } from "../api/types";
import { buildPerformanceTimeline } from "./performanceTimeline";

/** @deprecated Prefer {@link sortPerformancesByRunOrder} from `./performanceTimeline` — name kept for call sites. */
export { sortPerformancesByRunOrder as sortPerformancesByStart } from "./performanceTimeline";

/**
 * Prominent clock messaging for TV / distance viewing.
 * - **between_acts** — scheduled gap after the day has begun (not pre-show).
 * - **pre_show** — waiting for the first act of the day.
 * - **on_stage_next** — current slot has no published end; the big timer counts to the **next** act’s start (not “time left in your set”).
 */
export type ClockBannerMode = "none" | "pre_show" | "between_acts" | "on_stage_next";

const EMPTY: {
  currentIdx: number;
  nextIdx: number;
  secondsToNext: number | null;
  secondsRemaining: number | null;
  heroSeconds: number | null;
  heroLabel: string;
  clockBanner: ClockBannerMode;
} = {
  currentIdx: -1,
  nextIdx: -1,
  secondsToNext: null,
  secondsRemaining: null,
  heroSeconds: null,
  heroLabel: "",
  clockBanner: "none",
};

/** Use when there is no day or no performances (same shape as {@link computeStageDayClockMetrics}). */
export function emptyStageDayClockMetrics(): typeof EMPTY {
  return { ...EMPTY };
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
  clockBanner: ClockBannerMode;
} {
  if (!dayDate || sorted.length === 0) {
    return { ...EMPTY };
  }
  const timeline = buildPerformanceTimeline(dayDate, sorted);
  const nowMs = now.getTime();

  let current = -1;
  let remaining: number | null = null;
  for (let i = 0; i < sorted.length; i++) {
    const t = timeline[i]!;
    const startMs = t.startMs;
    const endMs = t.endMs;
    if (nowMs >= startMs && (endMs === null || nowMs < endMs)) {
      current = i;
      if (endMs !== null) {
        remaining = Math.floor((endMs - nowMs) / 1000);
      }
      break;
    }
  }

  let next = -1;
  let sec: number | null = null;
  for (let i = 0; i < sorted.length; i++) {
    const t = timeline[i]!;
    if (t.startMs > nowMs) {
      next = i;
      sec = Math.floor((t.startMs - nowMs) / 1000);
      break;
    }
  }

  const pCurrent = current >= 0 ? sorted[current] : null;
  const hasExplicitSlotEnd = Boolean(pCurrent?.endTime);
  const hasFollowingAct = current >= 0 && current + 1 < sorted.length;
  const implicitCountdownToNext =
    current >= 0 && remaining !== null && !hasExplicitSlotEnd && hasFollowingAct;

  let heroSeconds: number | null = null;
  let heroLabel = "";
  if (current >= 0) {
    if (remaining !== null) {
      heroSeconds = remaining;
      heroLabel = implicitCountdownToNext ? "Until next act" : "Time left";
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

  let clockBanner: ClockBannerMode = "none";
  if (implicitCountdownToNext) {
    clockBanner = "on_stage_next";
  } else if (current < 0 && next >= 0 && sec !== null) {
    const firstStartMs = timeline[0]!.startMs;
    clockBanner = nowMs < firstStartMs ? "pre_show" : "between_acts";
  }

  return {
    currentIdx: current,
    nextIdx: next,
    secondsToNext: sec,
    secondsRemaining: remaining,
    heroSeconds,
    heroLabel,
    clockBanner,
  };
}
