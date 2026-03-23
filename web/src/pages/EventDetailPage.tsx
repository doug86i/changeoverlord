import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiGet, apiSend, apiSendForm } from "../api/client";
import type { EventRow, FileAssetRow, StageRow } from "../api/types";
import { useRef, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ExportEventButton } from "../components/ExportImportTools";
import { formatDateFriendly } from "../lib/dateFormat";

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const qc = useQueryClient();
  const navigate = useNavigate();

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

  const eventFilesQ = useQuery({
    queryKey: ["files", "event", eventId],
    queryFn: () =>
      apiGet<{ files: FileAssetRow[] }>(`/api/v1/files?eventId=${eventId}`),
    enabled: Boolean(eventId),
  });

  const logoInputRef = useRef<HTMLInputElement>(null);

  const setLogoMut = useMutation({
    mutationFn: (logoFileId: string | null) =>
      apiSend(`/api/v1/events/${eventId}`, "PATCH", { logoFileId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["event", eventId] });
      void qc.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const uploadEventFile = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return apiSendForm<{ file: FileAssetRow }>(
        `/api/v1/files?eventId=${eventId}`,
        "POST",
        fd,
      );
    },
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["files", "event", eventId] });
      const mime = res?.file?.mimeType ?? "";
      if (mime.startsWith("image/") && res?.file?.id) {
        setLogoMut.mutate(res.file.id);
      }
    },
  });

  const [name, setName] = useState("");
  const [editingEvent, setEditingEvent] = useState(false);
  const [evName, setEvName] = useState("");
  const [evStart, setEvStart] = useState("");
  const [evEnd, setEvEnd] = useState("");
  const [deleteEventOpen, setDeleteEventOpen] = useState(false);
  const [editStageId, setEditStageId] = useState<string | null>(null);
  const [editStageName, setEditStageName] = useState("");
  const [deleteStageId, setDeleteStageId] = useState<string | null>(null);

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

  const patchEvent = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiSend(`/api/v1/events/${eventId}`, "PATCH", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event", eventId] });
      qc.invalidateQueries({ queryKey: ["events"] });
      setEditingEvent(false);
    },
  });

  const deleteEvent = useMutation({
    mutationFn: () => apiSend(`/api/v1/events/${eventId}`, "DELETE"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      navigate("/");
    },
  });

  const patchStage = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiSend(`/api/v1/stages/${id}`, "PATCH", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stages", eventId] });
      setEditStageId(null);
    },
  });

  const deleteStage = useMutation({
    mutationFn: (id: string) => apiSend(`/api/v1/stages/${id}`, "DELETE"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stages", eventId] });
      setDeleteStageId(null);
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
  const stages = [...(stagesQ.data?.stages ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const deleteS = stages.find((s) => s.id === deleteStageId);

  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        <Link to="/">Events</Link> / {ev.name}
      </p>

      {editingEvent ? (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <div className="title-bar" style={{ marginBottom: "0.75rem" }}>Edit event</div>
          <div className="form-row">
            <label>
              <span className="form-label">Name</span>
              <input value={evName} onChange={(e) => setEvName(e.target.value)} style={{ width: "100%" }} />
            </label>
            <label>
              <span className="form-label">Start</span>
              <input type="date" value={evStart} onChange={(e) => setEvStart(e.target.value)} />
            </label>
            <label>
              <span className="form-label">End</span>
              <input type="date" value={evEnd} onChange={(e) => setEvEnd(e.target.value)} />
            </label>
            <button
              type="button"
              className="primary"
              onClick={() => patchEvent.mutate({ name: evName, startDate: evStart, endDate: evEnd })}
            >
              Save
            </button>
            <button type="button" onClick={() => setEditingEvent(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <h1 style={{ marginTop: 0 }}>
            {ev.name}
            <button
              type="button"
              className="icon-btn"
              title="Edit event"
              style={{ marginLeft: "0.5rem", verticalAlign: "middle" }}
              onClick={() => {
                setEditingEvent(true);
                setEvName(ev.name);
                setEvStart(ev.startDate);
                setEvEnd(ev.endDate);
              }}
            >
              ✎
            </button>
            <button
              type="button"
              className="icon-btn danger-text"
              title="Delete event"
              style={{ verticalAlign: "middle" }}
              onClick={() => setDeleteEventOpen(true)}
            >
              ✕
            </button>
          </h1>
          <p className="muted">
            {formatDateFriendly(ev.startDate)} → {formatDateFriendly(ev.endDate)}
            <span style={{ marginLeft: "1rem" }}>
              <ExportEventButton eventId={ev.id} eventName={ev.name} />
            </span>
          </p>
        </>
      )}

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div className="title-bar" style={{ marginBottom: "0.75rem" }}>
          Event logo
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Shown in the header when you work inside this event. PNG or JPEG recommended.
        </p>
        {ev.logoFileId ? (
          <div style={{ marginBottom: "0.75rem" }}>
            <img
              src={`/api/v1/files/${ev.logoFileId}/raw`}
              alt=""
              style={{ maxHeight: 56, maxWidth: 200, objectFit: "contain" }}
            />
          </div>
        ) : (
          <p className="muted" style={{ marginTop: 0 }}>
            No logo set.
          </p>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
          <button
            type="button"
            className="icon-btn"
            disabled={uploadEventFile.isPending}
            onClick={() => logoInputRef.current?.click()}
          >
            Upload image
          </button>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) uploadEventFile.mutate(f);
            }}
          />
          {ev.logoFileId ? (
            <button
              type="button"
              className="icon-btn danger-text"
              disabled={setLogoMut.isPending}
              onClick={() => setLogoMut.mutate(null)}
            >
              Clear logo
            </button>
          ) : null}
        </div>
        {eventFilesQ.data?.files?.some((f) => f.mimeType.startsWith("image/")) ? (
          <div style={{ marginTop: "0.75rem" }}>
            <div className="muted" style={{ fontSize: "0.85rem", marginBottom: "0.35rem" }}>
              Or pick an uploaded image:
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {eventFilesQ.data.files
                .filter((f) => f.mimeType.startsWith("image/"))
                .map((f) => (
                  <li key={f.id} style={{ marginBottom: "0.35rem" }}>
                    <button
                      type="button"
                      className="icon-btn"
                      disabled={setLogoMut.isPending || ev.logoFileId === f.id}
                      onClick={() => setLogoMut.mutate(f.id)}
                    >
                      Use as logo
                    </button>
                    <span className="muted" style={{ marginLeft: "0.5rem", fontSize: "0.85rem" }}>
                      {f.originalName}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div className="title-bar" style={{ marginBottom: "0.75rem" }}>
          New stage
        </div>
        <div className="form-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Stage name"
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
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {stages.map((s) => (
          <li key={s.id} className="card" style={{ marginBottom: "0.75rem" }}>
            {editStageId === s.id ? (
              <div className="form-row">
                <input
                  value={editStageName}
                  onChange={(e) => setEditStageName(e.target.value)}
                />
                <button
                  type="button"
                  className="primary"
                  onClick={() => patchStage.mutate({ id: s.id, body: { name: editStageName } })}
                >
                  Save
                </button>
                <button type="button" onClick={() => setEditStageId(null)}>Cancel</button>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                <Link to={`/stages/${s.id}`} style={{ fontWeight: 600 }}>{s.name}</Link>
                <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Edit stage name"
                    onClick={() => { setEditStageId(s.id); setEditStageName(s.name); }}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger-text"
                    title="Delete stage"
                    onClick={() => setDeleteStageId(s.id)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {stages.length === 0 && (
        <div className="empty-state card">
          <h2>No stages yet</h2>
          <p>Add your first stage — each stage has its own running order, patch workbook, and clock.</p>
        </div>
      )}

      <ConfirmDialog
        open={deleteEventOpen}
        title="Delete event"
        message={`Delete "${ev.name}"? All stages, days, performances, workbooks, and files will be permanently removed.`}
        onConfirm={() => deleteEvent.mutate()}
        onCancel={() => setDeleteEventOpen(false)}
      />
      <ConfirmDialog
        open={deleteStageId !== null}
        title="Delete stage"
        message={deleteS ? `Delete "${deleteS.name}"? This will remove all days, performances, workbooks, and files for this stage.` : ""}
        onConfirm={() => deleteStageId && deleteStage.mutate(deleteStageId)}
        onCancel={() => setDeleteStageId(null)}
      />
    </div>
  );
}
