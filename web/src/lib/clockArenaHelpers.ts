import type { PerformanceRow } from "../api/types";
import type {
  ClockArenaActPresentation,
  ClockArenaHeroUrgency,
} from "../components/ClockArena";

/** Green → amber → red; final minute uses flashing red (CSS class). */
export function urgencyFromSeconds(seconds: number | null): ClockArenaHeroUrgency {
  if (seconds === null) return { tier: "ok" };
  if (seconds <= 60) return { tier: "danger" };
  if (seconds <= 300) return { tier: "warn" };
  return { tier: "ok" };
}

/** Same act / next / finished labels as the full stage clock (`ClockDayPage`). */
export function buildClockArenaActPresentation(
  sorted: PerformanceRow[],
  currentIdx: number,
  nextIdx: number,
): ClockArenaActPresentation {
  if (sorted.length === 0) {
    return { title: "No performances", sub: "", badge: "idle" };
  }
  if (currentIdx >= 0) {
    const p = sorted[currentIdx];
    return {
      title: p.bandName || "—",
      sub: [p.startTime, p.endTime ? p.endTime : null].filter(Boolean).join(" – "),
      badge: "on",
    };
  }
  if (nextIdx >= 0) {
    const p = sorted[nextIdx];
    return {
      title: p.bandName || "—",
      sub: `Starts ${p.startTime}`,
      badge: "next",
    };
  }
  return { title: "Day finished", sub: "", badge: "idle" };
}
