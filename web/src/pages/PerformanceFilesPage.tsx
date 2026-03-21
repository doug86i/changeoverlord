import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { apiGet } from "../api/client";
import type { PerformanceRow, StageDayRow, StageRow } from "../api/types";
import { FileAttachments } from "../components/FileAttachments";
import { PerformanceBandNav } from "../components/PerformanceBandNav";

export function PerformanceFilesPage() {
  const { performanceId } = useParams<{ performanceId: string }>();

  const perfQ = useQuery({
    queryKey: ["performance", performanceId],
    queryFn: () =>
      apiGet<{ performance: PerformanceRow }>(
        `/api/v1/performances/${performanceId}`,
      ),
    enabled: Boolean(performanceId),
  });

  const stageDayId = perfQ.data?.performance.stageDayId;

  const dayQ = useQuery({
    queryKey: ["stageDay", stageDayId],
    queryFn: () =>
      apiGet<{ stageDay: StageDayRow }>(`/api/v1/stage-days/${stageDayId}`),
    enabled: Boolean(stageDayId),
  });

  const stageId = dayQ.data?.stageDay.stageId;

  const stageQ = useQuery({
    queryKey: ["stage", stageId],
    queryFn: () => apiGet<{ stage: StageRow }>(`/api/v1/stages/${stageId}`),
    enabled: Boolean(stageId),
  });

  if (!performanceId) return null;
  if (perfQ.isLoading || dayQ.isLoading) {
    return <p className="muted">Loading…</p>;
  }
  if (perfQ.error || !perfQ.data) {
    return <p role="alert">Performance not found.</p>;
  }

  const perf = perfQ.data.performance;
  const day = dayQ.data?.stageDay;
  const stage = stageQ.data?.stage;

  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        {stage && day && (
          <>
            <Link to={`/events/${stage.eventId}`}>Event</Link>
            {" / "}
            <Link to={`/stages/${stage.id}`}>{stage.name}</Link>
            {" / "}
            <Link to={`/stage-days/${day.id}`}>{day.dayDate}</Link>
            {" / "}
          </>
        )}
        <span>{perf.bandName || "Performance"}</span>
        {" · "}
        <Link to={`/patch/${perf.id}`}>Patch / RF</Link>
      </p>

      {stageDayId && (
        <PerformanceBandNav
          performanceId={performanceId}
          stageDayId={stageDayId}
          mode="files"
        />
      )}

      <h1 style={{ marginTop: 0 }}>Files — {perf.bandName}</h1>
      <p className="muted">
        Documents and images for this act only. New uploads are <strong>Other</strong> until you mark{" "}
        <strong>Rider</strong> or <strong>Stage plot</strong> on each row (only one rider and one stage plot
        per list). PDFs can <strong>Extract</strong> a page to a new single-page file (saved as stage plot).
      </p>
      {stageId && (
        <FileAttachments
          scope={{ kind: "performance", performanceId, stageId }}
          title="Performance files"
        />
      )}
    </div>
  );
}
