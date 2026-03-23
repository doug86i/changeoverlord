import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { apiGet, apiSend } from "../api/client";
import type { PerformanceRow, StageDayRow, StageRow, EventRow } from "../api/types";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useServerTime } from "../hooks/useServerTime";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  formatDateFriendly,
  formatDateShort,
  minutesBetween,
  formatDuration,
  formatCountdownOrDays,
  addMinutesToHhmm,
} from "../lib/dateFormat";
import { useClockNav } from "../ClockNavContext";
import { PrintDaySheet } from "../components/PrintDaySheet";

function parseLocal(dayDate: string, hhmm: string): Date {
  return new Date(`${dayDate}T${hhmm}:00`);
}

function sortPerfs(p: PerformanceRow[]): PerformanceRow[] {
  return [...p].sort((a, b) => {
    const t = a.startTime.localeCompare(b.startTime);
    if (t !== 0) return t;
    return a.id.localeCompare(b.id);
  });
}

/** Default slot length when the day is empty or a previous performance has no end. */
const DEFAULT_SET_LENGTH_MINS = 60;
/** Default changeover for the add form and duplicate spacing after a set end. */
const DEFAULT_CHANGEOVER_MINS = 30;

function durationMinsFromLastPerformance(last: PerformanceRow): number {
  if (last.endTime) {
    const m = minutesBetween(last.startTime, last.endTime);
    if (m !== null && m > 0) return m;
  }
  return DEFAULT_SET_LENGTH_MINS;
}

function InlineInput({
  value,
  onSave,
  type = "text",
  style,
  disabled,
}: {
  value: string;
  onSave: (v: string) => void;
  type?: "text" | "time";
  style?: React.CSSProperties;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  if (!editing) {
    return (
      <button
        type="button"
        className="inline-edit"
        onClick={() => !disabled && setEditing(true)}
        style={{ ...style, opacity: disabled ? 0.5 : 1 }}
        disabled={disabled}
      >
        {value || "—"}
      </button>
    );
  }

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  return (
    <input
      type={type}
      value={type === "time" ? (draft.length === 5 ? draft : draft.slice(0, 5)) : draft}
      onChange={(e) => setDraft(type === "time" ? e.target.value.slice(0, 5) : e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") { setDraft(value); setEditing(false); }
      }}
      autoFocus
      style={{ width: type === "time" ? "6rem" : "auto", ...style }}
    />
  );
}

export function StageDayPage() {
  const { stageDayId } = useParams<{ stageDayId: string }>();
  const qc = useQueryClient();
  const { setPreferredStageDayId } = useClockNav();

  useEffect(() => {
    if (stageDayId) setPreferredStageDayId(stageDayId);
  }, [stageDayId, setPreferredStageDayId]);

  const dayQ = useQuery({
    queryKey: ["stageDay", stageDayId],
    queryFn: () =>
      apiGet<{ stageDay: StageDayRow; eventLogoFileId?: string | null }>(
        `/api/v1/stage-days/${stageDayId}`,
      ),
    enabled: Boolean(stageDayId),
  });

  const stageId = dayQ.data?.stageDay?.stageId;

  const stageQ = useQuery({
    queryKey: ["stage", stageId],
    queryFn: () =>
      apiGet<{ stage: StageRow & { eventLogoFileId?: string | null } }>(
        `/api/v1/stages/${stageId}`,
      ),
    enabled: Boolean(stageId),
  });

  const daysListQ = useQuery({
    queryKey: ["stageDays", stageId],
    queryFn: () =>
      apiGet<{ stageDays: StageDayRow[] }>(`/api/v1/stages/${stageId}/days`),
    enabled: Boolean(stageId),
  });

  const eventId = stageQ.data?.stage?.eventId;
  const eventQ = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => apiGet<{ event: EventRow }>(`/api/v1/events/${eventId}`),
    enabled: Boolean(eventId),
  });

  const perfQ = useQuery({
    queryKey: ["performances", stageDayId],
    queryFn: () =>
      apiGet<{ performances: PerformanceRow[] }>(
        `/api/v1/stage-days/${stageDayId}/performances`,
      ),
    enabled: Boolean(stageDayId),
  });

  const { now } = useServerTime({
    tickIntervalMs: 1000,
    refetchIntervalMs: 30_000,
  });

  const [band, setBand] = useState("");
  const [start, setStart] = useState("12:00");
  const [end, setEnd] = useState(() => addMinutesToHhmm("12:00", DEFAULT_SET_LENGTH_MINS));
  /** "end" = enter end time; "duration" = enter set length in minutes (stored as end time on save). */
  const [addTimeMode, setAddTimeMode] = useState<"end" | "duration">("end");
  const [addDurationMins, setAddDurationMins] = useState(String(DEFAULT_SET_LENGTH_MINS));
  /** Minutes after this act’s end (or implied slot) — not saved; used to pre-fill the next start time. */
  const [addChangeoverMins, setAddChangeoverMins] = useState(DEFAULT_CHANGEOVER_MINS);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState<Set<string>>(new Set());

  // Swap mode state
  const [swapSourceId, setSwapSourceId] = useState<string | null>(null);

  // Shift state
  const [shiftTargetId, setShiftTargetId] = useState<string | null>(null);
  const [shiftMinutes, setShiftMinutes] = useState(15);
  const [copyTargetDayId, setCopyTargetDayId] = useState("");
  const [copyReplaceExisting, setCopyReplaceExisting] = useState(false);

  const sorted = useMemo(
    () => sortPerfs(perfQ.data?.performances ?? []),
    [perfQ.data],
  );

  /** Signature of the last performance — when it changes (local or remote), refresh add-form suggestions. */
  const lastPerfSignature = useMemo(() => {
    if (!sorted.length) return "empty";
    const last = sorted[sorted.length - 1];
    return `${last.id}:${last.startTime}:${last.endTime ?? ""}`;
  }, [sorted]);

  useEffect(() => {
    setAddChangeoverMins(DEFAULT_CHANGEOVER_MINS);
  }, [stageDayId]);

  /** Next-slot start / end / length when the running order’s last slot changes (local or remote). */
  useEffect(() => {
    if (!stageDayId || perfQ.isLoading) return;
    if (!sorted.length) {
      setStart("12:00");
      setEnd(addMinutesToHhmm("12:00", DEFAULT_SET_LENGTH_MINS));
      setAddDurationMins(String(DEFAULT_SET_LENGTH_MINS));
      return;
    }
    const last = sorted[sorted.length - 1];
    const durM = durationMinsFromLastPerformance(last);
    const next = last.endTime
      ? addMinutesToHhmm(last.endTime, addChangeoverMins)
      : addMinutesToHhmm(last.startTime, DEFAULT_SET_LENGTH_MINS + addChangeoverMins);
    setStart(next);
    setEnd(addMinutesToHhmm(next, durM));
    setAddDurationMins(String(durM));
  }, [stageDayId, perfQ.isLoading, lastPerfSignature, addChangeoverMins]);

  const day = dayQ.data?.stageDay;
  const stage = stageQ.data?.stage;
  const event = eventQ.data?.event;

  // Detect overlaps for visual warnings
  const overlappingIds = useMemo(() => {
    const ids = new Set<string>();
    for (let i = 0; i < sorted.length - 1; i++) {
      const cur = sorted[i];
      const nxt = sorted[i + 1];
      if (cur.endTime) {
        const gap = minutesBetween(cur.endTime, nxt.startTime);
        if (gap !== null && gap < 0) {
          ids.add(cur.id);
          ids.add(nxt.id);
        }
      }
    }
    return ids;
  }, [sorted]);

  const { currentIdx, nextIdx, secondsToNext } = useMemo(() => {
    if (!day || sorted.length === 0)
      return { currentIdx: -1, nextIdx: -1, secondsToNext: null as number | null };
    let current = -1;
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      const s = parseLocal(day.dayDate, p.startTime);
      const ns = sorted[i + 1] ? parseLocal(day.dayDate, sorted[i + 1].startTime) : null;
      const e = p.endTime ? parseLocal(day.dayDate, p.endTime) : ns;
      if (now >= s && (!e || now < e)) { current = i; break; }
    }
    let next = -1;
    let sec: number | null = null;
    for (let i = 0; i < sorted.length; i++) {
      const s = parseLocal(day.dayDate, sorted[i].startTime);
      if (s > now) { next = i; sec = Math.floor((s.getTime() - now.getTime()) / 1000); break; }
    }
    return { currentIdx: current, nextIdx: next, secondsToNext: sec };
  }, [day, sorted, now]);

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["performances", stageDayId] });
  }, [qc, stageDayId]);

  const canSubmitAddPerformance = useMemo(() => {
    const s = start.slice(0, 5);
    if (addTimeMode === "duration") {
      const d = parseInt(addDurationMins.trim(), 10);
      return !Number.isNaN(d) && d > 0;
    }
    if (!end || end.length < 4) return false;
    const m = minutesBetween(s, end.slice(0, 5));
    return m !== null && m > 0;
  }, [start, end, addTimeMode, addDurationMins]);

  const createPerf = useMutation({
    mutationFn: () => {
      const startH = start.slice(0, 5);
      let endH: string;
      if (addTimeMode === "duration") {
        const d = parseInt(addDurationMins.trim(), 10);
        if (Number.isNaN(d) || d <= 0) {
          throw new Error("Enter a set length greater than zero.");
        }
        endH = addMinutesToHhmm(startH, d);
      } else {
        if (!end || end.length < 4) {
          throw new Error("Enter an end time after the start.");
        }
        const endSlice = end.slice(0, 5);
        const gap = minutesBetween(startH, endSlice);
        if (gap === null || gap <= 0) {
          throw new Error("End time must be after the start time.");
        }
        endH = endSlice;
      }
      return apiSend<{ performance: PerformanceRow }>(
        `/api/v1/stage-days/${stageDayId}/performances`,
        "POST",
        { bandName: band, startTime: startH, endTime: endH },
      );
    },
    onSuccess: () => {
      invalidate();
      setBand("");
      const startH = start.slice(0, 5);
      const endH =
        addTimeMode === "duration"
          ? addMinutesToHhmm(startH, parseInt(addDurationMins.trim(), 10))
          : end.slice(0, 5);
      const durM = minutesBetween(startH, endH) ?? DEFAULT_SET_LENGTH_MINS;
      const nextStart = addMinutesToHhmm(endH, addChangeoverMins);
      setStart(nextStart);
      setEnd(addMinutesToHhmm(nextStart, durM));
      setAddDurationMins(String(durM));
    },
  });

  const patchPerf = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiSend(`/api/v1/performances/${id}`, "PATCH", body),
    onSuccess: invalidate,
  });

  const deletePerf = useMutation({
    mutationFn: (id: string) => apiSend(`/api/v1/performances/${id}`, "DELETE"),
    onSuccess: () => { invalidate(); setDeleteId(null); },
  });

  const duplicatePerf = useMutation({
    mutationFn: (p: PerformanceRow) => {
      const last = sorted[sorted.length - 1];
      const dur = minutesBetween(p.startTime, p.endTime);
      let newStart: string;
      let newEnd: string | null;

      if (!last.endTime) {
        if (sorted.length === 1) {
          newStart = addMinutesToHhmm(last.startTime, 60);
          newEnd =
            dur !== null && dur > 0
              ? addMinutesToHhmm(newStart, dur)
              : addMinutesToHhmm(newStart, 60);
        } else {
          throw new Error(
            "Set an end time on the last performance before duplicating.",
          );
        }
      } else {
        newStart = addMinutesToHhmm(last.endTime, DEFAULT_CHANGEOVER_MINS);
        newEnd =
          dur !== null && dur > 0
            ? addMinutesToHhmm(newStart, dur)
            : addMinutesToHhmm(newStart, DEFAULT_SET_LENGTH_MINS);
      }

      const baseName = p.bandName.trim() || "Untitled act";
      return apiSend(`/api/v1/stage-days/${stageDayId}/performances`, "POST", {
        bandName: `${baseName} (copy)`,
        startTime: newStart,
        endTime: newEnd,
        notes: p.notes,
      });
    },
    onSuccess: invalidate,
  });

  const swapPerf = useMutation({
    mutationFn: ({ sourceId, targetId }: { sourceId: string; targetId: string }) =>
      apiSend(`/api/v1/performances/${sourceId}/swap`, "POST", { targetId }),
    onSuccess: () => { invalidate(); setSwapSourceId(null); },
  });

  const duplicateDaySchedule = useMutation({
    mutationFn: ({ targetId, replace }: { targetId: string; replace: boolean }) =>
      apiSend<{ performanceIds: string[] }>(
        `/api/v1/stage-days/${stageDayId}/duplicate-schedule`,
        "POST",
        { targetStageDayId: targetId, replaceExisting: replace },
      ),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["performances", vars.targetId] });
      void qc.invalidateQueries({ queryKey: ["stageDay", vars.targetId] });
      void qc.invalidateQueries({ queryKey: ["allStagesForClock"] });
      setCopyTargetDayId("");
      setCopyReplaceExisting(false);
    },
  });

  const shiftPerfs = useMutation({
    mutationFn: ({ fromId, minutes }: { fromId: string; minutes: number }) =>
      apiSend(`/api/v1/stage-days/${stageDayId}/shift`, "POST", {
        fromPerformanceId: fromId,
        minutes,
      }),
    onSuccess: () => { invalidate(); setShiftTargetId(null); },
  });

  const handleCardClick = useCallback(
    (id: string) => {
      if (!swapSourceId || swapSourceId === id) return;
      swapPerf.mutate({ sourceId: swapSourceId, targetId: id });
    },
    [swapSourceId, swapPerf],
  );

  const toggleNotes = (id: string) =>
    setNotesOpen((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  if (!stageDayId) return null;
  if (dayQ.isLoading || perfQ.isLoading) return <p className="muted">Loading…</p>;
  if (dayQ.error || !dayQ.data) return <p role="alert">Day not found.</p>;

  const deleteName = sorted.find((p) => p.id === deleteId)?.bandName || "this performance";
  const pageTitle = stage
    ? `${stage.name} — ${formatDateShort(day!.dayDate)}`
    : formatDateShort(day!.dayDate);

  const inSwapMode = swapSourceId !== null;

  const otherStageDays = useMemo(() => {
    const rows = daysListQ.data?.stageDays ?? [];
    return [...rows]
      .filter((d) => d.id !== stageDayId)
      .sort((a, b) => a.dayDate.localeCompare(b.dayDate));
  }, [daysListQ.data, stageDayId]);

  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        {event && stage && (
          <>
            <Link to={`/events/${stage.eventId}`}>{event.name}</Link>
            {" / "}
            <Link to={`/stages/${stage.id}`}>{stage.name}</Link>
            {" / "}
          </>
        )}
        {formatDateShort(day!.dayDate)}
      </p>
      <h1 style={{ marginTop: 0 }}>{pageTitle}</h1>
      <p className="muted">
        <Link to={`/clock/day/${stageDayId}`}>Open stage clock</Link>
        {secondsToNext !== null && (
          <span style={{ marginLeft: "1rem" }}>
            Next act in{" "}
            <strong className="status-warn">{formatCountdownOrDays(secondsToNext)}</strong>
          </span>
        )}
      </p>

      {otherStageDays.length > 0 && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <div className="title-bar" style={{ marginBottom: "0.5rem" }}>
            Copy schedule to another day
          </div>
          <p className="muted" style={{ marginTop: 0, fontSize: "0.9rem" }}>
            Copies all acts and patch workbooks from <strong>{formatDateShort(day!.dayDate)}</strong>{" "}
            to the day you pick. Same stage only.
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              alignItems: "center",
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <span className="form-label">Target day</span>
              <select
                value={copyTargetDayId}
                onChange={(e) => setCopyTargetDayId(e.target.value)}
                style={{ minWidth: "12rem" }}
              >
                <option value="">Select…</option>
                {otherStageDays.map((d) => (
                  <option key={d.id} value={d.id}>
                    {formatDateFriendly(d.dayDate)}
                  </option>
                ))}
              </select>
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                cursor: "pointer",
                fontSize: "0.9rem",
              }}
            >
              <input
                type="checkbox"
                checked={copyReplaceExisting}
                onChange={(e) => setCopyReplaceExisting(e.target.checked)}
              />
              Replace existing acts on target
            </label>
            <button
              type="button"
              className="primary"
              disabled={
                !copyTargetDayId || duplicateDaySchedule.isPending
              }
              onClick={() => {
                if (!copyTargetDayId) return;
                void duplicateDaySchedule.mutate({
                  targetId: copyTargetDayId,
                  replace: copyReplaceExisting,
                });
              }}
            >
              {duplicateDaySchedule.isPending ? "Copying…" : "Copy schedule"}
            </button>
          </div>
          {duplicateDaySchedule.isError && (
            <p role="alert" style={{ color: "var(--color-danger)", marginBottom: 0 }}>
              {(duplicateDaySchedule.error as Error).message}
            </p>
          )}
        </div>
      )}

      {/* Swap mode banner */}
      {inSwapMode && (
        <div className="swap-banner" role="status">
          <span>
            Swapping <strong>{sorted.find((p) => p.id === swapSourceId)?.bandName}</strong>
            {" — click another act to swap, or "}
          </span>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setSwapSourceId(null)}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Shift popover */}
      {shiftTargetId && (
        <div className="shift-popover card" role="dialog" aria-label="Shift performances">
          <p style={{ margin: "0 0 0.5rem" }}>
            <strong>Shift from "{sorted.find((p) => p.id === shiftTargetId)?.bandName}" onward</strong>
          </p>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setShiftMinutes((m) => m - 5)}
            >−5</button>
            <span style={{ fontVariantNumeric: "tabular-nums", minWidth: "4.5rem", textAlign: "center" }}>
              {shiftMinutes > 0 ? "+" : ""}{shiftMinutes} min
            </span>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setShiftMinutes((m) => m + 5)}
            >+5</button>
            <button
              type="button"
              className="primary"
              disabled={shiftMinutes === 0 || shiftPerfs.isPending}
              onClick={() =>
                shiftPerfs.mutate({ fromId: shiftTargetId, minutes: shiftMinutes })
              }
            >
              {shiftPerfs.isPending ? "Shifting…" : "Apply"}
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => { setShiftTargetId(null); setShiftMinutes(15); }}
            >
              Cancel
            </button>
          </div>
          <p className="muted" style={{ fontSize: "0.8rem", margin: "0.4rem 0 0" }}>
            Moves this and all later acts by the chosen amount.
          </p>
          {shiftPerfs.isError && (
            <p role="alert" style={{ color: "var(--color-danger)", margin: "0.5rem 0 0" }}>
              {(shiftPerfs.error as Error).message}
            </p>
          )}
        </div>
      )}

      {/* Add performance form */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div className="title-bar" style={{ marginBottom: "0.75rem" }}>
          Add performance
        </div>
        <form
          className="form-row"
          style={{ alignItems: "flex-end" }}
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmitAddPerformance && !createPerf.isPending) createPerf.mutate();
          }}
        >
          <label>
            <span className="form-label">Band / act</span>
            <input
              value={band}
              onChange={(e) => setBand(e.target.value)}
              placeholder="Artist"
              style={{ width: "100%", minWidth: "8rem" }}
            />
          </label>
          <label>
            <span className="form-label">Start</span>
            <input
              type="time"
              value={start.length === 5 ? start : start.slice(0, 5)}
              onChange={(e) => {
                const newStart = e.target.value.slice(0, 5);
                if (addTimeMode === "end" && end && end.length >= 5) {
                  const len = minutesBetween(start.slice(0, 5), end.slice(0, 5));
                  if (len !== null && len > 0) {
                    setEnd(addMinutesToHhmm(newStart, len));
                  }
                }
                setStart(newStart);
              }}
            />
          </label>
          <fieldset style={{ border: "none", padding: 0, margin: 0, minWidth: 0 }}>
            <legend className="form-label" style={{ padding: 0, marginBottom: "0.25rem" }}>
              End or length
            </legend>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="addTimeMode"
                  checked={addTimeMode === "end"}
                  onChange={() => {
                    setAddTimeMode("end");
                    const s = start.slice(0, 5);
                    const d = parseInt(addDurationMins.trim(), 10);
                    if (!Number.isNaN(d) && d > 0) {
                      setEnd(addMinutesToHhmm(s, d));
                    }
                  }}
                />
                End time
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="addTimeMode"
                  checked={addTimeMode === "duration"}
                  onChange={() => {
                    setAddTimeMode("duration");
                    const s = start.slice(0, 5);
                    const e = end.length >= 5 ? end.slice(0, 5) : "";
                    if (e) {
                      const m = minutesBetween(s, e);
                      if (m !== null && m > 0) setAddDurationMins(String(m));
                    }
                  }}
                />
                Set length
              </label>
            </div>
          </fieldset>
          {addTimeMode === "end" ? (
            <label>
              <span className="form-label">End</span>
              <input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value.slice(0, 5))}
              />
            </label>
          ) : (
            <label>
              <span className="form-label">Length (min)</span>
              <input
                type="number"
                min={1}
                step={1}
                value={addDurationMins}
                onChange={(e) => setAddDurationMins(e.target.value)}
                placeholder="60"
                style={{ width: "5rem", fontVariantNumeric: "tabular-nums" }}
              />
            </label>
          )}
          <label>
            <span
              className="form-label"
              title="Not stored. After Add, the next start is this act’s end + changeover; end time and set length stay aligned with the last slot you added."
            >
              Changeover (min)
            </span>
            <input
              type="number"
              min={0}
              step={5}
              value={addChangeoverMins}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setAddChangeoverMins(Number.isNaN(v) ? 0 : Math.max(0, v));
              }}
              style={{ width: "4.5rem", fontVariantNumeric: "tabular-nums" }}
            />
          </label>
          <button
            type="submit"
            className="primary"
            disabled={!canSubmitAddPerformance || createPerf.isPending}
          >
            Add
          </button>
        </form>
        <p className="muted" style={{ fontSize: "0.8rem", margin: "0.75rem 0 0" }}>
          {addTimeMode === "duration"
            ? "Set length is stored as end time (start + length). Every slot has an end. Changeover fills the next start only — it is not saved. Switching to End time keeps the same length."
            : "End must be after start. Changeover fills the next start only — it is not saved. Switching to Set length keeps the same length."}
        </p>
        {createPerf.isError && (
          <p role="alert" style={{ color: "var(--color-danger)", marginTop: "0.75rem", marginBottom: 0 }}>
            {(createPerf.error as Error).message}
          </p>
        )}
      </div>

      {/* Performance list */}
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {sorted.map((p, i) => {
          const isNow = i === currentIdx;
          const isNext = i === nextIdx;
          const dur = minutesBetween(p.startTime, p.endTime);
          const prevEnd = i > 0 ? sorted[i - 1].endTime : null;
          const changeoverMin = minutesBetween(prevEnd, p.startTime);
          const hasOverlap = overlappingIds.has(p.id);
          const isSwapSource = swapSourceId === p.id;
          const hasNotes = Boolean(p.notes?.trim());

          const timeClass = isNow
            ? dur !== null && dur > 0
              ? (() => {
                  const elapsed = (now.getTime() - parseLocal(day!.dayDate, p.startTime).getTime()) / 60000;
                  const remaining = dur - elapsed;
                  if (remaining <= 1) return "status-danger";
                  if (remaining <= 5) return "status-warn";
                  return "status-ok";
                })()
              : "status-ok"
            : "";

          let cardClass = "card";
          if (isSwapSource) cardClass += " perf-swap-source";
          else if (inSwapMode) cardClass += " perf-swap-target";
          else if (isNow) cardClass += " perf-now";
          else if (isNext) cardClass += " perf-next";
          if (hasOverlap) cardClass += " perf-overlap";

          return (
            <li key={p.id}>
              {i > 0 && changeoverMin !== null && (
                <div
                  className={`changeover-badge${changeoverMin < 0 ? " changeover-overlap" : ""}`}
                >
                  {changeoverMin < 0
                    ? `⚠ ${formatDuration(changeoverMin)} OVERLAP`
                    : `↕ ${formatDuration(changeoverMin)} changeover`}
                </div>
              )}
              <div
                className={cardClass}
                style={{ marginBottom: "0.25rem", cursor: inSwapMode && !isSwapSource ? "pointer" : undefined }}
                onClick={inSwapMode && !isSwapSource ? () => handleCardClick(p.id) : undefined}
                role={inSwapMode && !isSwapSource ? "button" : undefined}
                tabIndex={inSwapMode && !isSwapSource ? 0 : undefined}
                onKeyDown={
                  inSwapMode && !isSwapSource
                    ? (e) => { if (e.key === "Enter" || e.key === " ") handleCardClick(p.id); }
                    : undefined
                }
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <InlineInput
                        value={p.bandName}
                        onSave={(v) => patchPerf.mutate({ id: p.id, body: { bandName: v } })}
                        style={{ fontWeight: 600, fontSize: "1rem" }}
                        disabled={inSwapMode}
                      />
                      {isNow && <span className="status-ok" style={{ fontSize: "0.75rem", fontWeight: 600 }}>● ON STAGE</span>}
                      {isNext && <span className="status-warn" style={{ fontSize: "0.75rem", fontWeight: 600 }}>● NEXT</span>}
                      {hasNotes && (
                        <span
                          className="perf-note-badge"
                          title={p.notes.trim().slice(0, 500)}
                        >
                          Note
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      fontVariantNumeric: "tabular-nums",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <InlineInput
                      value={p.startTime}
                      type="time"
                      onSave={(v) => patchPerf.mutate({ id: p.id, body: { startTime: v } })}
                      disabled={inSwapMode}
                    />
                    <span>–</span>
                    <InlineInput
                      value={p.endTime ?? ""}
                      type="time"
                      onSave={(v) => patchPerf.mutate({ id: p.id, body: { endTime: v || null } })}
                      disabled={inSwapMode}
                    />
                    {dur !== null && (
                      <span className={`muted ${timeClass}`} style={{ fontSize: "0.8rem", minWidth: "4rem" }}>
                        ({formatDuration(dur)})
                      </span>
                    )}
                  </div>
                </div>
                {/* Actions row */}
                {!inSwapMode && (
                  <div
                    style={{
                      display: "flex",
                      gap: "0.4rem",
                      flexWrap: "wrap",
                      marginTop: "0.5rem",
                      alignItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Link
                      to={`/patch/${p.id}`}
                      className="icon-btn"
                      title="Patch / RF workbook"
                    >
                      Patch / RF
                    </Link>
                    <Link
                      to={`/performances/${p.id}/files`}
                      className="icon-btn"
                      title="Band files"
                    >
                      Files
                    </Link>
                    <button
                      type="button"
                      className={`icon-btn${hasNotes ? " perf-notes-btn--has" : ""}`}
                      title={hasNotes ? "Notes (this act has notes)" : "Notes"}
                      onClick={() => toggleNotes(p.id)}
                      style={{ fontSize: "0.8rem" }}
                    >
                      {notesOpen.has(p.id) ? "▾ Notes" : "▸ Notes"}
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Swap this act with another (keeps time slots, swaps who's playing)"
                      onClick={() => setSwapSourceId(p.id)}
                      style={{ fontSize: "0.8rem" }}
                    >
                      ⇅ Swap
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Shift this and all later acts by ± minutes"
                      onClick={() => { setShiftTargetId(p.id); setShiftMinutes(15); }}
                      style={{ fontSize: "0.8rem" }}
                    >
                      ⏱ Shift
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Duplicate (appends after last act, with spacing)"
                      onClick={() => duplicatePerf.mutate(p)}
                      style={{ fontSize: "0.8rem" }}
                    >
                      ⧉ Dup
                    </button>
                    <button
                      type="button"
                      className="icon-btn danger-text"
                      title="Delete"
                      onClick={() => setDeleteId(p.id)}
                    >
                      ✕
                    </button>
                  </div>
                )}
                {/* Inline notes */}
                {notesOpen.has(p.id) && !inSwapMode && (
                  <div style={{ marginTop: "0.5rem" }}>
                    <textarea
                      key={p.id}
                      defaultValue={p.notes}
                      placeholder="Add notes…"
                      rows={2}
                      style={{ width: "100%", resize: "vertical" }}
                      onBlur={(e) => {
                        if (e.target.value !== p.notes)
                          patchPerf.mutate({ id: p.id, body: { notes: e.target.value } });
                      }}
                    />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {(patchPerf.isError || duplicatePerf.isError || swapPerf.isError) && (
        <p role="alert" style={{ color: "var(--color-danger)", marginTop: "0.75rem" }}>
          {(patchPerf.error as Error)?.message ??
            (duplicatePerf.error as Error)?.message ??
            (swapPerf.error as Error)?.message}
        </p>
      )}

      {sorted.length === 0 && (
        <div className="empty-state card">
          <h2>No performances yet</h2>
          <p>
            Add your first act above — default is <strong>1 hour</strong> slots and <strong>30 minute</strong> changeover; after that, new rows match the previous act’s length.
          </p>
        </div>
      )}

      {stage && sorted.length > 0 && (
        <PrintDaySheet
          stageName={stage.name}
          dayDate={day!.dayDate}
          performances={sorted}
        />
      )}

      {deletePerf.isError && (
        <p role="alert" style={{ color: "var(--color-danger)", marginTop: "0.75rem" }}>
          {(deletePerf.error as Error).message}
        </p>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete performance"
        message={`Delete "${deleteName}"? This will also remove its patch workbook and uploaded files.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteId) deletePerf.mutate(deleteId);
        }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
