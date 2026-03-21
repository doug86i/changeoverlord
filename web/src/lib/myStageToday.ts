import { apiGet } from "../api/client";
import { logDebug } from "./debug";
import { LAST_STAGE_DAY_STORAGE_KEY } from "./useLastVisited";

function localDateYmdFromUnixMs(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Resolves where "My stage today" should go: today's stage-day running order
 * (`/stage-days/:id`) when unambiguous, otherwise `/clock` (pick a stage) or `/`.
 */
export async function resolveMyStageTodayPath(): Promise<string> {
  const time = await apiGet<{ unixMs: number }>("/api/v1/time");
  const today = localDateYmdFromUnixMs(time.unixMs);

  let lastId: string | null = null;
  try {
    lastId = localStorage.getItem(LAST_STAGE_DAY_STORAGE_KEY);
  } catch {
    /* localStorage unavailable */
  }

  if (lastId) {
    try {
      const { stageDay } = await apiGet<{ stageDay: { dayDate: string } }>(
        `/api/v1/stage-days/${lastId}`,
      );
      if (stageDay.dayDate === today) {
        return `/stage-days/${lastId}`;
      }
    } catch (e) {
      logDebug("myStageToday: last stage-day missing or invalid", { lastId, e });
    }
  }

  const { events } = await apiGet<{ events: { id: string }[] }>("/api/v1/events");
  if (events.length === 0) return "/";

  const todayIds: string[] = [];
  for (const ev of events) {
    const { stages } = await apiGet<{ stages: { id: string }[] }>(
      `/api/v1/events/${ev.id}/stages`,
    );
    for (const st of stages) {
      const { stageDays } = await apiGet<{ stageDays: { id: string; dayDate: string }[] }>(
        `/api/v1/stages/${st.id}/days`,
      );
      for (const d of stageDays) {
        if (d.dayDate === today) todayIds.push(d.id);
      }
    }
  }

  if (todayIds.length === 1) return `/stage-days/${todayIds[0]}`;
  if (todayIds.length > 1) return "/clock";
  return "/clock";
}
