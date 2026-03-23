import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../api/client";
import { fetchAllEvents } from "../api/paginated";
import type { EventRow, StageRow, StageDayRow } from "../api/types";

export type StageDayWithContext = {
  event: EventRow;
  stage: StageRow;
  day: StageDayRow;
};

/**
 * All stages and their days (used by Clock overview, event dashboard, multi-stage today).
 * Query key prefix `["allStagesForClock"]` — invalidate via SSE after event/stage/day changes.
 */
export function useAllStagesClockBundle() {
  const eventsQ = useQuery({
    queryKey: ["events", "allForClock"],
    queryFn: () => fetchAllEvents(),
  });

  const events = eventsQ.data ?? [];
  const eventIds = events.map((e) => e.id).sort().join(",");

  const stagesQs = useQuery({
    queryKey: ["allStagesForClock", eventIds],
    queryFn: async () => {
      const nested = await Promise.all(
        events.map(async (ev) => {
          const stagesRes = await apiGet<{ stages: StageRow[] }>(
            `/api/v1/events/${ev.id}/stages`,
          );
          return Promise.all(
            stagesRes.stages.map(async (st) => {
              const daysRes = await apiGet<{ stageDays: StageDayRow[] }>(
                `/api/v1/stages/${st.id}/days`,
              );
              return { event: ev, stage: st, days: daysRes.stageDays };
            }),
          );
        }),
      );
      return nested.flat();
    },
    enabled: events.length > 0,
  });

  return { eventsQ, events, stagesQs };
}

export function flattenStageDaysForClock(
  bundle: { event: EventRow; stage: StageRow; days: StageDayRow[] }[],
): StageDayWithContext[] {
  return bundle.flatMap((r) =>
    r.days.map((d) => ({ event: r.event, stage: r.stage, day: d })),
  );
}
