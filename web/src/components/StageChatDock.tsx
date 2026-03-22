import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useMatch } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiSend } from "../api/client";
import type { ChatMessageRow, StageRow } from "../api/types";
import {
  setChatPushHandler,
  type RealtimeChatPushV1,
} from "../realtime/chatPush";

const CHAT_NAME_KEY = "changeoverlord_chat_display_name";
const CHAT_DOCK_HIDDEN_KEY = "changeoverlord_chat_dock_hidden";

function formatChatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function StageChatDock() {
  const qc = useQueryClient();
  const { pathname } = useLocation();
  /** Fullscreen / kiosk clock — no chat (even when a stage day is in the URL). */
  const onClockScreen =
    pathname === "/clock" || pathname.startsWith("/clock/");

  const mEvent = useMatch("/events/:eventId");
  const mStage = useMatch("/stages/:stageId");
  const mStageDay = useMatch("/stage-days/:stageDayId");
  const mClockDay = useMatch("/clock/day/:stageDayId");
  const mPatch = useMatch("/patch/:performanceId");
  const mPerfFiles = useMatch("/performances/:performanceId/files");

  const eventIdFromRoute = mEvent?.params.eventId;
  const stageIdFromRoute = mStage?.params.stageId;
  const stageDayIdFromRoute =
    mStageDay?.params.stageDayId ??
    (onClockScreen ? undefined : mClockDay?.params.stageDayId);
  const performanceIdFromRoute =
    mPatch?.params.performanceId ?? mPerfFiles?.params.performanceId;

  const stageDayQ = useQuery({
    queryKey: ["stageDay", stageDayIdFromRoute!],
    queryFn: () =>
      apiGet<{ stageDay: { id: string; stageId: string } }>(
        `/api/v1/stage-days/${stageDayIdFromRoute}`,
      ),
    enabled: Boolean(stageDayIdFromRoute),
  });
  const stageIdFromDay = stageDayQ.data?.stageDay.stageId;

  const perfQ = useQuery({
    queryKey: ["performance", performanceIdFromRoute!],
    queryFn: () =>
      apiGet<{ performance: { stageDayId: string } }>(
        `/api/v1/performances/${performanceIdFromRoute}`,
      ),
    enabled: Boolean(performanceIdFromRoute),
  });
  const stageDayIdFromPerf = perfQ.data?.performance.stageDayId;

  const stageDayForPerfQ = useQuery({
    queryKey: ["stageDay", stageDayIdFromPerf!],
    queryFn: () =>
      apiGet<{ stageDay: { stageId: string } }>(
        `/api/v1/stage-days/${stageDayIdFromPerf}`,
      ),
    enabled: Boolean(stageDayIdFromPerf),
  });
  const stageIdFromPerfChain = stageDayForPerfQ.data?.stageDay.stageId;

  const sid =
    stageIdFromRoute ??
    stageIdFromDay ??
    stageIdFromPerfChain ??
    null;

  const stageMetaQ = useQuery({
    queryKey: ["stage", sid!],
    queryFn: () => apiGet<{ stage: StageRow }>(`/api/v1/stages/${sid}`),
    enabled: Boolean(sid),
  });

  const eventId =
    eventIdFromRoute ?? stageMetaQ.data?.stage.eventId ?? null;

  const stagesQ = useQuery({
    queryKey: ["stages", eventId!],
    queryFn: () =>
      apiGet<{ stages: StageRow[] }>(`/api/v1/events/${eventId}/stages`),
    enabled: Boolean(eventId),
  });

  const [pickedStageId, setPickedStageId] = useState<string | null>(null);

  useEffect(() => {
    if (!eventIdFromRoute || !stagesQ.data?.stages.length) return;
    const list = stagesQ.data.stages;
    setPickedStageId((prev) => {
      if (prev && list.some((s) => s.id === prev)) return prev;
      return list[0]?.id ?? null;
    });
  }, [eventIdFromRoute, stagesQ.data]);

  /** Only the event detail URL uses `pickedStageId`; avoid leaking it to other routes (e.g. clock). */
  const contextStageId =
    sid ?? (eventIdFromRoute ? pickedStageId : null) ?? null;

  const [dockHidden, setDockHiddenState] = useState(() => {
    try {
      return sessionStorage.getItem(CHAT_DOCK_HIDDEN_KEY) === "1";
    } catch {
      return false;
    }
  });

  const setDockHidden = useCallback((hidden: boolean) => {
    setDockHiddenState(hidden);
    try {
      if (hidden) sessionStorage.setItem(CHAT_DOCK_HIDDEN_KEY, "1");
      else sessionStorage.removeItem(CHAT_DOCK_HIDDEN_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const [expanded, setExpanded] = useState(false);
  const [flash, setFlash] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sendScope, setSendScope] = useState<"stage" | "event">("stage");
  const [draft, setDraft] = useState("");
  const [authorDraft, setAuthorDraft] = useState(() => {
    try {
      return localStorage.getItem(CHAT_NAME_KEY) ?? "";
    } catch {
      return "";
    }
  });

  const lastSentIdRef = useRef<string | null>(null);
  const listEndRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const settingsOpenRef = useRef(false);

  useEffect(() => {
    settingsOpenRef.current = settingsOpen;
  }, [settingsOpen]);

  const messagesQ = useQuery({
    queryKey: ["chatMessages", eventId, contextStageId],
    queryFn: () =>
      apiGet<{ chatMessages: ChatMessageRow[] }>(
        `/api/v1/chat/messages?eventId=${encodeURIComponent(eventId!)}&stageId=${encodeURIComponent(contextStageId!)}`,
      ),
    enabled: Boolean(eventId && contextStageId),
  });

  const sendMut = useMutation({
    mutationFn: async () => {
      const author = authorDraft.trim();
      const body = draft.trim();
      if (!eventId || !contextStageId) throw new Error("Missing context");
      try {
        localStorage.setItem(CHAT_NAME_KEY, author);
      } catch {
        /* ignore */
      }
      return apiSend<{ chatMessage: ChatMessageRow }>(
        "/api/v1/chat/messages",
        "POST",
        {
          eventId,
          scope: sendScope,
          ...(sendScope === "stage" ? { stageId: contextStageId } : {}),
          author,
          body,
        },
      );
    },
    onSuccess: (res) => {
      lastSentIdRef.current = res.chatMessage.id;
      void qc.invalidateQueries({ queryKey: ["chatMessages", eventId] });
      setDraft("");
    },
  });

  const trySend = useCallback(() => {
    if (!draft.trim() || sendMut.isPending || !eventId || !contextStageId) return;
    void sendMut.mutateAsync().catch(() => {
      /* surfaced below */
    });
  }, [draft, sendMut, eventId, contextStageId]);

  const onChatPush = useCallback(
    (msg: RealtimeChatPushV1) => {
      if (!eventId || !contextStageId) return;
      if (msg.eventId !== eventId) return;
      if (msg.scope === "stage" && msg.stageId !== contextStageId) return;
      if (lastSentIdRef.current === msg.id) {
        lastSentIdRef.current = null;
        return;
      }
      setDockHidden(false);
      setExpanded(true);
      setFlash(true);
      window.setTimeout(() => setFlash(false), 1600);
    },
    [eventId, contextStageId, setDockHidden],
  );

  useEffect(() => {
    if (!eventId || !contextStageId) {
      setChatPushHandler(null);
      return;
    }
    setChatPushHandler(onChatPush);
    return () => {
      setChatPushHandler(null);
    };
  }, [eventId, contextStageId, onChatPush]);

  useEffect(() => {
    if (!messagesQ.data?.chatMessages.length) return;
    listEndRef.current?.scrollIntoView({ block: "end" });
  }, [messagesQ.data?.chatMessages]);

  useEffect(() => {
    if (!expanded || dockHidden) return;
    const onPointerDown = (e: PointerEvent) => {
      const root = rootRef.current;
      if (!root || root.contains(e.target as Node)) return;
      // First dismiss Options (e.g. after using the stage <select>), then the panel.
      if (settingsOpenRef.current) {
        setSettingsOpen(false);
      } else {
        setExpanded(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [expanded, dockHidden]);

  useEffect(() => {
    if (!expanded || dockHidden) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (settingsOpenRef.current) {
        setSettingsOpen(false);
      } else {
        setExpanded(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded, dockHidden]);

  const showStagePicker = Boolean(eventIdFromRoute && stagesQ.data?.stages.length);

  const panelClass = useMemo(
    () =>
      `stage-chat-dock${flash ? " stage-chat-dock--flash" : ""}${expanded ? " stage-chat-dock--open" : ""}`,
    [flash, expanded],
  );

  if (onClockScreen || !eventId || !contextStageId) {
    return null;
  }

  const stageLabel =
    stagesQ.data?.stages.find((s) => s.id === contextStageId)?.name ??
    "This stage";

  if (dockHidden) {
    return (
      <div
        ref={rootRef}
        className="stage-chat-dock stage-chat-dock--minimized"
        role="region"
        aria-label="Stage chat"
      >
        <button
          type="button"
          className="icon-btn"
          title={`Show chat — ${stageLabel}`}
          onClick={() => setDockHidden(false)}
        >
          Chat
        </button>
      </div>
    );
  }

  const messages = messagesQ.data?.chatMessages ?? [];

  return (
    <div ref={rootRef} className={panelClass} role="region" aria-label="Stage chat">
      <div className="stage-chat-dock__bar">
        <button
          type="button"
          className="stage-chat-dock__toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((e) => !e)}
        >
          Chat
        </button>
        <button
          type="button"
          className="icon-btn stage-chat-dock__hide-btn"
          aria-label="Hide chat"
          title="Hide chat (new messages will show it again)"
          onClick={() => {
            setDockHidden(true);
            setExpanded(false);
            setSettingsOpen(false);
          }}
        >
          Hide
        </button>
      </div>
      {expanded ? (
        <div className="stage-chat-dock__panel card">
          <div className="stage-chat-dock__panel-title muted">{stageLabel}</div>
          <div className="stage-chat-dock__messages" role="log" aria-live="polite">
            {messagesQ.isLoading ? (
              <p className="muted">Loading…</p>
            ) : messagesQ.error ? (
              <p role="alert">Could not load chat.</p>
            ) : messages.length === 0 ? (
              <p className="muted">No messages yet.</p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="stage-chat-dock__msg">
                  <div className="stage-chat-dock__msg-meta">
                    <span className="stage-chat-dock__msg-who">
                      {m.author.trim() || "Anonymous"}
                    </span>
                    <span className="muted">{formatChatTime(m.createdAt)}</span>
                    {m.scope === "event" ? (
                      <span className="stage-chat-dock__badge">Event</span>
                    ) : null}
                  </div>
                  <div className="stage-chat-dock__msg-body">{m.body}</div>
                </div>
              ))
            )}
            <div ref={listEndRef} />
          </div>
          <div className="stage-chat-dock__composer">
            <div className="stage-chat-dock__composer-tools">
              <button
                type="button"
                className="icon-btn"
                aria-expanded={settingsOpen}
                id="stage-chat-dock-options-btn"
                onClick={() => setSettingsOpen((o) => !o)}
              >
                Options
              </button>
            </div>
            {settingsOpen ? (
              <div
                id="stage-chat-dock-settings"
                className="stage-chat-dock__settings-block"
                role="region"
                aria-labelledby="stage-chat-dock-options-btn"
              >
                <label className="muted stage-chat-dock__settings-label">
                  Name
                  <input
                    type="text"
                    className="stage-chat-dock__input"
                    value={authorDraft}
                    onChange={(e) => setAuthorDraft(e.target.value)}
                    maxLength={80}
                    placeholder="e.g. FOH"
                    aria-label="Chat display name"
                  />
                </label>
                {showStagePicker ? (
                  <label className="muted stage-chat-dock__settings-label">
                    Stage
                    <select
                      className="stage-chat-dock__select stage-chat-dock__select--full"
                      value={contextStageId}
                      onChange={(e) => setPickedStageId(e.target.value)}
                      aria-label="Chat stage"
                    >
                      {stagesQ.data!.stages.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <div className="stage-chat-dock__scope">
                  <label>
                    <input
                      type="radio"
                      name="chat-scope"
                      checked={sendScope === "stage"}
                      onChange={() => setSendScope("stage")}
                    />{" "}
                    This stage
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="chat-scope"
                      checked={sendScope === "event"}
                      onChange={() => setSendScope("event")}
                    />{" "}
                    Whole event
                  </label>
                </div>
              </div>
            ) : null}
            <textarea
              className="stage-chat-dock__textarea"
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || e.shiftKey) return;
                e.preventDefault();
                trySend();
              }}
              maxLength={2000}
              placeholder="Message… (Enter to send)"
              aria-label="Chat message"
            />
            <button
              type="button"
              className="primary"
              disabled={sendMut.isPending || !draft.trim()}
              onClick={() => trySend()}
            >
              {sendMut.isPending ? "Sending…" : "Send"}
            </button>
            {sendMut.isError ? (
              <p role="alert" className="stage-chat-dock__err">
                {sendMut.error instanceof Error
                  ? sendMut.error.message
                  : "Send failed"}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
