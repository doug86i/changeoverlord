import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { apiGet, apiSend } from "../api/client";
import type { StageRow, StageDayRow } from "../api/types";
import { useState } from "react";

export function StageDetailPage() {
  const { stageId } = useParams<{ stageId: string }>();
  const qc = useQueryClient();

  const stageQ = useQuery({
    queryKey: ["stage", stageId],
    queryFn: () => apiGet<{ stage: StageRow }>(`/api/v1/stages/${stageId}`),
    enabled: Boolean(stageId),
  });

  const daysQ = useQuery({
    queryKey: ["stageDays", stageId],
    queryFn: () =>
      apiGet<{ stageDays: StageDayRow[] }>(`/api/v1/stages/${stageId}/days`),
    enabled: Boolean(stageId),
  });

  const [dayDate, setDayDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );

  const createDay = useMutation({
    mutationFn: () =>
      apiSend<{ stageDay: StageDayRow }>(
        `/api/v1/stages/${stageId}/days`,
        "POST",
        { dayDate },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stageDays", stageId] });
    },
  });

  if (!stageId) return null;
  if (stageQ.isLoading || daysQ.isLoading) {
    return <p className="muted">Loading…</p>;
  }
  if (stageQ.error || !stageQ.data) {
    return <p role="alert">Stage not found.</p>;
  }

  const st = stageQ.data.stage;

  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        <Link to={`/events/${st.eventId}`}>Event</Link> / {st.name}
      </p>
      <h1 style={{ marginTop: 0 }}>{st.name}</h1>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div className="title-bar" style={{ marginBottom: "0.75rem" }}>
          Add calendar day
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <input
            type="date"
            value={dayDate}
            onChange={(e) => setDayDate(e.target.value)}
          />
          <button
            type="button"
            className="primary"
            onClick={() => createDay.mutate()}
            disabled={createDay.isPending}
          >
            Add day
          </button>
        </div>
        {createDay.isError && (
          <p style={{ color: "var(--color-brand)", marginTop: "0.75rem" }}>
            {(createDay.error as Error).message}
          </p>
        )}
      </div>

      <h2 className="title-bar">Days</h2>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {daysQ.data!.stageDays.map((d) => (
          <li key={d.id} className="card" style={{ marginBottom: "0.75rem" }}>
            <Link to={`/stage-days/${d.id}`}>{d.dayDate}</Link>
          </li>
        ))}
      </ul>
      {daysQ.data!.stageDays.length === 0 && (
        <p className="muted">No days yet.</p>
      )}
    </div>
  );
}
