import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiGet, apiSend } from "../api/client";
import type { EventRow, StageRow, StageDayRow } from "../api/types";
import { useState } from "react";
import { StagePatchTemplatePicker } from "../components/PatchTemplateTools";
import { FileAttachments } from "../components/FileAttachments";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { formatDateShort } from "../lib/dateFormat";

function dateRange(from: string, to: string): string[] {
  const result: string[] = [];
  const cur = new Date(from + "T00:00:00");
  const stop = new Date(to + "T00:00:00");
  while (cur <= stop) {
    result.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

export function StageDetailPage() {
  const { stageId } = useParams<{ stageId: string }>();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const stageQ = useQuery({
    queryKey: ["stage", stageId],
    queryFn: () => apiGet<{ stage: StageRow }>(`/api/v1/stages/${stageId}`),
    enabled: Boolean(stageId),
  });

  const eventId = stageQ.data?.stage?.eventId;
  const eventQ = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => apiGet<{ event: EventRow }>(`/api/v1/events/${eventId}`),
    enabled: Boolean(eventId),
  });

  const daysQ = useQuery({
    queryKey: ["stageDays", stageId],
    queryFn: () =>
      apiGet<{ stageDays: StageDayRow[] }>(`/api/v1/stages/${stageId}/days`),
    enabled: Boolean(stageId),
  });

  const [dayDate, setDayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [bulkFrom, setBulkFrom] = useState("");
  const [bulkTo, setBulkTo] = useState("");
  const [editingStage, setEditingStage] = useState(false);
  const [stageName, setStageName] = useState("");
  const [deleteStageOpen, setDeleteStageOpen] = useState(false);
  const [deleteDayId, setDeleteDayId] = useState<string | null>(null);

  const createDay = useMutation({
    mutationFn: (date?: string) =>
      apiSend<{ stageDay: StageDayRow }>(
        `/api/v1/stages/${stageId}/days`,
        "POST",
        { dayDate: date ?? dayDate },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stageDays", stageId] });
    },
  });

  const bulkCreate = useMutation({
    mutationFn: async () => {
      // Match controlled inputs: they show event start/end when bulkFrom/bulkTo are still "".
      const ev = eventQ.data?.event;
      const from = bulkFrom || ev?.startDate || "";
      const to = bulkTo || ev?.endDate || "";
      if (!from || !to) {
        throw new Error("Set both From and To dates, or add start/end dates on the event.");
      }
      const dates = dateRange(from, to);
      for (const d of dates) {
        await apiSend(`/api/v1/stages/${stageId}/days`, "POST", { dayDate: d });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stageDays", stageId] });
      setBulkFrom("");
      setBulkTo("");
    },
  });

  const patchStage = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiSend(`/api/v1/stages/${stageId}`, "PATCH", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stage", stageId] });
      qc.invalidateQueries({ queryKey: ["stages", eventId] });
      setEditingStage(false);
    },
  });

  const deleteStage = useMutation({
    mutationFn: () => apiSend(`/api/v1/stages/${stageId}`, "DELETE"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stages", eventId] });
      if (eventId) navigate(`/events/${eventId}`);
      else navigate("/");
    },
  });

  const deleteDay = useMutation({
    mutationFn: (id: string) => apiSend(`/api/v1/stage-days/${id}`, "DELETE"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stageDays", stageId] });
      setDeleteDayId(null);
    },
  });

  if (!stageId) return null;
  if (stageQ.isLoading || daysQ.isLoading) return <p className="muted">Loading…</p>;
  if (stageQ.error || !stageQ.data) return <p role="alert">Stage not found.</p>;

  const st = stageQ.data.stage;
  const event = eventQ.data?.event;
  const days = [...(daysQ.data?.stageDays ?? [])].sort((a, b) =>
    a.dayDate.localeCompare(b.dayDate),
  );
  const deleteD = days.find((d) => d.id === deleteDayId);

  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        {event ? (
          <Link to={`/events/${st.eventId}`}>{event.name}</Link>
        ) : (
          <Link to={`/events/${st.eventId}`}>Event</Link>
        )}
        {" / "}
        {st.name}
      </p>

      {editingStage ? (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <div className="title-bar" style={{ marginBottom: "0.75rem" }}>Edit stage</div>
          <div className="form-row">
            <input value={stageName} onChange={(e) => setStageName(e.target.value)} style={{ flex: "1 1 200px" }} />
            <button type="button" className="primary" onClick={() => patchStage.mutate({ name: stageName })}>Save</button>
            <button type="button" onClick={() => setEditingStage(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <h1 style={{ marginTop: 0 }}>
          {st.name}
          <button
            type="button"
            className="icon-btn"
            title="Edit stage"
            style={{ marginLeft: "0.5rem", verticalAlign: "middle" }}
            onClick={() => { setEditingStage(true); setStageName(st.name); }}
          >
            ✎
          </button>
          <button
            type="button"
            className="icon-btn danger-text"
            title="Delete stage"
            style={{ verticalAlign: "middle" }}
            onClick={() => setDeleteStageOpen(true)}
          >
            ✕
          </button>
        </h1>
      )}

      <StagePatchTemplatePicker
        stageId={stageId}
        eventId={st.eventId}
        defaultPatchTemplateId={st.defaultPatchTemplateId ?? null}
        hasPatchTemplate={Boolean(st.hasPatchTemplate)}
      />

      <FileAttachments scope={{ kind: "stage", stageId }} title="Stage files" />

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="title-bar" style={{ marginBottom: "0.75rem" }}>Add single day</div>
        <div className="form-row">
          <input type="date" value={dayDate} onChange={(e) => setDayDate(e.target.value)} />
          <button
            type="button"
            className="primary"
            onClick={() => createDay.mutate()}
            disabled={createDay.isPending}
          >
            Add day
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div className="title-bar" style={{ marginBottom: "0.75rem" }}>Bulk add days</div>
        <div className="form-row">
          <label>
            <span className="form-label">From</span>
            <input
              type="date"
              value={bulkFrom || (event?.startDate ?? "")}
              onChange={(e) => setBulkFrom(e.target.value)}
            />
          </label>
          <label>
            <span className="form-label">To</span>
            <input
              type="date"
              value={bulkTo || (event?.endDate ?? "")}
              onChange={(e) => setBulkTo(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="primary"
            onClick={() => bulkCreate.mutate()}
            disabled={bulkCreate.isPending}
          >
            {bulkCreate.isPending ? "Creating…" : "Add range"}
          </button>
        </div>
      </div>

      <h2 className="title-bar">Days</h2>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {days.map((d) => (
          <li key={d.id} className="card" style={{ marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <Link to={`/stage-days/${d.id}`} style={{ fontWeight: 600 }}>
                {formatDateShort(d.dayDate)}
              </Link>
              <button
                type="button"
                className="icon-btn danger-text"
                title="Delete day"
                onClick={() => setDeleteDayId(d.id)}
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
      {days.length === 0 && (
        <div className="empty-state card">
          <h2>No days yet</h2>
          <p>Add individual days or use "Bulk add days" to create all days from the event date range at once.</p>
        </div>
      )}

      <ConfirmDialog
        open={deleteStageOpen}
        title="Delete stage"
        message={`Delete "${st.name}"? All days, performances, workbooks, and files will be removed.`}
        onConfirm={() => deleteStage.mutate()}
        onCancel={() => setDeleteStageOpen(false)}
      />
      <ConfirmDialog
        open={deleteDayId !== null}
        title="Delete day"
        message={deleteD ? `Delete ${formatDateShort(deleteD.dayDate)}? All performances and workbooks for this day will be removed.` : ""}
        onConfirm={() => deleteDayId && deleteDay.mutate(deleteDayId)}
        onCancel={() => setDeleteDayId(null)}
      />
    </div>
  );
}
