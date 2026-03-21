import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { apiGet, apiSend } from "../api/client";
import type { EventRow, StageRow } from "../api/types";
import { useState } from "react";

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const qc = useQueryClient();

  const eventQ = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => apiGet<{ event: EventRow }>(`/api/v1/events/${eventId}`),
    enabled: Boolean(eventId),
  });

  const stagesQ = useQuery({
    queryKey: ["stages", eventId],
    queryFn: () =>
      apiGet<{ stages: StageRow[] }>(`/api/v1/events/${eventId}/stages`),
    enabled: Boolean(eventId),
  });

  const [name, setName] = useState("");

  const createStage = useMutation({
    mutationFn: () =>
      apiSend<{ stage: StageRow }>(
        `/api/v1/events/${eventId}/stages`,
        "POST",
        { name: name || "Main stage" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stages", eventId] });
      setName("");
    },
  });

  if (!eventId) return null;
  if (eventQ.isLoading || stagesQ.isLoading) {
    return <p className="muted">Loading…</p>;
  }
  if (eventQ.error || !eventQ.data) {
    return <p role="alert">Event not found.</p>;
  }

  const ev = eventQ.data.event;

  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        <Link to="/">Events</Link> / {ev.name}
      </p>
      <h1 style={{ marginTop: 0 }}>{ev.name}</h1>
      <p className="muted">
        {ev.startDate} → {ev.endDate}
      </p>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div className="title-bar" style={{ marginBottom: "0.75rem" }}>
          New stage
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Stage name"
            style={{ flex: "1 1 200px" }}
          />
          <button
            type="button"
            className="primary"
            onClick={() => createStage.mutate()}
            disabled={createStage.isPending}
          >
            Add stage
          </button>
        </div>
      </div>

      <h2 className="title-bar">Stages</h2>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {stagesQ.data!.stages.map((s) => (
          <li key={s.id} className="card" style={{ marginBottom: "0.75rem" }}>
            <Link to={`/stages/${s.id}`}>{s.name}</Link>
          </li>
        ))}
      </ul>
      {stagesQ.data!.stages.length === 0 && (
        <p className="muted">No stages yet.</p>
      )}
    </div>
  );
}
