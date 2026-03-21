import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { apiGet, apiSend } from "../api/client";
import type { PerformanceRow, StageDayRow, StageRow } from "../api/types";
import { useState } from "react";

export function StageDayPage() {
  const { stageDayId } = useParams<{ stageDayId: string }>();
  const qc = useQueryClient();

  const dayQ = useQuery({
    queryKey: ["stageDay", stageDayId],
    queryFn: () =>
      apiGet<{ stageDay: StageDayRow }>(`/api/v1/stage-days/${stageDayId}`),
    enabled: Boolean(stageDayId),
  });

  const stageId = dayQ.data?.stageDay?.stageId;

  const stageQ = useQuery({
    queryKey: ["stage", stageId],
    queryFn: () => apiGet<{ stage: StageRow }>(`/api/v1/stages/${stageId}`),
    enabled: Boolean(stageId),
  });

  const perfQ = useQuery({
    queryKey: ["performances", stageDayId],
    queryFn: () =>
      apiGet<{ performances: PerformanceRow[] }>(
        `/api/v1/stage-days/${stageDayId}/performances`,
      ),
    enabled: Boolean(stageDayId),
  });

  const [band, setBand] = useState("");
  const [start, setStart] = useState("12:00");
  const [end, setEnd] = useState("");

  const createPerf = useMutation({
    mutationFn: () =>
      apiSend<{ performance: PerformanceRow }>(
        `/api/v1/stage-days/${stageDayId}/performances`,
        "POST",
        {
          bandName: band,
          startTime: start.slice(0, 5),
          endTime: end ? end.slice(0, 5) : null,
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["performances", stageDayId] });
      setBand("");
    },
  });

  if (!stageDayId) return null;
  if (dayQ.isLoading || perfQ.isLoading) {
    return <p className="muted">Loading…</p>;
  }
  if (dayQ.error || !dayQ.data) {
    return <p role="alert">Day not found.</p>;
  }

  const day = dayQ.data.stageDay;
  const stage = stageQ.data?.stage;

  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        {stage && (
          <>
            <Link to={`/events/${stage.eventId}`}>Event</Link>
            {" / "}
            <Link to={`/stages/${stage.id}`}>{stage.name}</Link>
            {" / "}
          </>
        )}
        {day.dayDate}
      </p>
      <h1 style={{ marginTop: 0 }}>Running order</h1>
      <p className="muted">Local times (HH:mm).</p>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div className="title-bar" style={{ marginBottom: "0.75rem" }}>
          Add performance
        </div>
        <div
          style={{
            display: "grid",
            gap: "0.75rem",
            gridTemplateColumns: "1fr 1fr 1fr auto",
            alignItems: "end",
          }}
        >
          <label>
            <span className="muted" style={{ display: "block", marginBottom: 4 }}>
              Band / act
            </span>
            <input
              value={band}
              onChange={(e) => setBand(e.target.value)}
              placeholder="Artist"
              style={{ width: "100%" }}
            />
          </label>
          <label>
            <span className="muted" style={{ display: "block", marginBottom: 4 }}>
              Start
            </span>
            <input
              type="time"
              value={start.length === 5 ? start : start.slice(0, 5)}
              onChange={(e) => setStart(e.target.value.slice(0, 5))}
            />
          </label>
          <label>
            <span className="muted" style={{ display: "block", marginBottom: 4 }}>
              End (optional)
            </span>
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value.slice(0, 5))}
            />
          </label>
          <button
            type="button"
            className="primary"
            onClick={() => createPerf.mutate()}
            disabled={createPerf.isPending}
          >
            Add
          </button>
        </div>
      </div>

      <ul style={{ listStyle: "none", padding: 0 }}>
        {perfQ.data!.performances.map((p) => (
          <li
            key={p.id}
            className="card"
            style={{
              marginBottom: "0.5rem",
              display: "flex",
              justifyContent: "space-between",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <div>
              <strong>{p.bandName || "—"}</strong>
              {p.notes && (
                <div className="muted" style={{ marginTop: 4 }}>
                  {p.notes}
                </div>
              )}
            </div>
            <div style={{ fontVariantNumeric: "tabular-nums" }}>
              {p.startTime}
              {p.endTime ? ` – ${p.endTime}` : ""}
            </div>
          </li>
        ))}
      </ul>
      {perfQ.data!.performances.length === 0 && (
        <p className="muted">No performances yet.</p>
      )}
    </div>
  );
}
