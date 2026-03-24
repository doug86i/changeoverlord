import { apiGet } from "../api/client";
import { fetchAllEvents } from "../api/paginated";
import { formatLocalCalendarDate } from "./dateFormat";
import { logDebug } from "./debug";
import { LAST_STAGE_DAY_STORAGE_KEY } from "./useLastVisited";

/**
 * Resolves where "My stage today" should go: **last visited** stage-day running order
 * (`/stage-days/:id`) when that row still exists; otherwise today’s stage-day when
 * unambiguous; otherwise `/dashboard` (event overview) or `/`.
 */
export async function resolveMyStageTodayPath(): Promise<string> {
  const time = await apiGet<{ unixMs: number }>("/api/v1/time");
  const today = formatLocalCalendarDate(new Date(time.unixMs));

  let lastId: string | null = null;
  try {
    lastId = localStorage.getItem(LAST_STAGE_DAY_STORAGE_KEY);
  } catch {
    /* localStorage unavailable */
  }

  if (lastId) {
    try {
      await apiGet<{ stageDay: { dayDate: string } }>(
        `/api/v1/stage-days/${lastId}`,
      );
      return `/stage-days/${lastId}`;
    } catch (e) {
      logDebug("myStageToday: last stage-day missing or invalid", { lastId, e });
    }
  }

  const events = await fetchAllEvents();
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
  return "/dashboard";
}
