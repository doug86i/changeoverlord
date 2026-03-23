import { useQuery } from "@tanstack/react-query";
import { useMatch } from "react-router-dom";
import { apiGet } from "../api/client";
import type { EventRow, PerformanceRow, StageDayRow, StageRow } from "../api/types";

/**
 * Shows the current event’s logo in the app header when the route maps to an event
 * (event page, stage, day, patch, or performance files).
 */
export function HeaderEventLogo() {
  const eventM = useMatch({ path: "/events/:eventId", end: false });
  const stageM = useMatch({ path: "/stages/:stageId", end: false });
  const dayM = useMatch({ path: "/stage-days/:stageDayId", end: false });
  const patchM = useMatch({ path: "/patch/:performanceId", end: false });
  const filesM = useMatch({ path: "/performances/:performanceId/files", end: false });

  const eventId = eventM?.params.eventId;
  const stageId = stageM?.params.stageId;
  const stageDayId = dayM?.params.stageDayId;
  const performanceId =
    patchM?.params.performanceId ?? filesM?.params.performanceId;

  const eventQ = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => apiGet<{ event: EventRow }>(`/api/v1/events/${eventId}`),
    enabled: Boolean(eventId),
  });

  const stageQ = useQuery({
    queryKey: ["stage", stageId],
    queryFn: () =>
      apiGet<{ stage: StageRow & { eventLogoFileId?: string | null } }>(
        `/api/v1/stages/${stageId}`,
      ),
    enabled: Boolean(stageId) && !eventId,
  });

  const dayQ = useQuery({
    queryKey: ["stageDay", stageDayId],
    queryFn: () =>
      apiGet<{ stageDay: StageDayRow; eventLogoFileId?: string | null }>(
        `/api/v1/stage-days/${stageDayId}`,
      ),
    enabled: Boolean(stageDayId) && !eventId && !stageId,
  });

  const perfQ = useQuery({
    queryKey: ["performance", performanceId],
    queryFn: () =>
      apiGet<{ performance: PerformanceRow; eventLogoFileId?: string | null }>(
        `/api/v1/performances/${performanceId}`,
      ),
    enabled: Boolean(performanceId) && !eventId && !stageId && !stageDayId,
  });

  const logoFileId =
    eventQ.data?.event.logoFileId ??
    stageQ.data?.stage.eventLogoFileId ??
    dayQ.data?.eventLogoFileId ??
    perfQ.data?.eventLogoFileId ??
    null;

  if (!logoFileId) return null;

  return (
    <img
      className="header-event-logo"
      src={`/api/v1/files/${logoFileId}/raw`}
      alt=""
    />
  );
}
