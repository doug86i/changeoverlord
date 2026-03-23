import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useLocation, useMatch } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiSend } from "../api/client";
import type {
  ChatMessageRow,
  ChatPresenceOnlineRow,
  StageRow,
} from "../api/types";
import {
  setChatPushHandler,
  type RealtimeChatPushV1,
} from "../realtime/chatPush";

const CHAT_NAME_KEY = "changeoverlord_chat_display_name";
const CHAT_CLIENT_ID_KEY = "changeoverlord_chat_client_id";

function readStoredChatName(): string {
  try {
    return localStorage.getItem(CHAT_NAME_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

function getChatClientId(): string {
  try {
    let id = sessionStorage.getItem(CHAT_CLIENT_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(CHAT_CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return `fallback-${Math.random().toString(36).slice(2)}`;
  }
}

function formatPresenceAge(iso: string): string {
  try {
    const t = new Date(iso).getTime();
    const s = Math.floor((Date.now() - t) / 1000);
    if (s < 60) return "Active now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** While POST is in flight, SSE may arrive before `onSuccess` sets `lastSentIdRef`. */
type PendingOwnEcho = {
  until: number;
  eventId: string;
  scope: "stage" | "event";
  stageId: string | null;
  author: string;
  body: string;
};

function chatPushMatchesPendingOwnEcho(
  msg: RealtimeChatPushV1,
  p: PendingOwnEcho,
  viewerStageId: string,
): boolean {
  if (Date.now() > p.until) return false;
  if (msg.eventId !== p.eventId) return false;
  if (msg.scope !== p.scope) return false;
  if (msg.author !== p.author) return false;
  if (msg.body !== p.body) return false;
  if (p.scope === "stage") {
    return msg.stageId === p.stageId && msg.stageId === viewerStageId;
  }
  return msg.scope === "event";
}

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
  /** Stage clock routes — no chat (keeps performer / fullscreen displays clear). */
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

  /** Open = full panel; closed = compact Chat button only. */
  const [expanded, setExpanded] = useState(false);
  const [flash, setFlash] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [presenceOpen, setPresenceOpen] = useState(false);
  const [introDone, setIntroDone] = useState(() => Boolean(readStoredChatName()));
  const [sendScope, setSendScope] = useState<"stage" | "event">("stage");
  const [draft, setDraft] = useState("");
  const [authorDraft, setAuthorDraft] = useState(() => readStoredChatName());
  const authorDraftRef = useRef(authorDraft);
  authorDraftRef.current = authorDraft;

  const lastSentIdRef = useRef<string | null>(null);
  const pendingOwnEchoRef = useRef<PendingOwnEcho | null>(null);
  const listEndRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const settingsOpenRef = useRef(false);
  const presenceOpenRef = useRef(false);

  const acknowledgeChatAttention = useCallback(() => {
    setFlash(false);
  }, []);

  useEffect(() => {
    settingsOpenRef.current = settingsOpen;
  }, [settingsOpen]);

  useEffect(() => {
    presenceOpenRef.current = presenceOpen;
  }, [presenceOpen]);

  const messagesQ = useQuery({
    queryKey: ["chatMessages", eventId, contextStageId],
    queryFn: () =>
      apiGet<{ chatMessages: ChatMessageRow[] }>(
        `/api/v1/chat/messages?eventId=${encodeURIComponent(eventId!)}&stageId=${encodeURIComponent(contextStageId!)}`,
      ),
    enabled: Boolean(eventId && contextStageId && introDone),
  });

  const presenceQ = useQuery({
    queryKey: ["chatPresence", eventId],
    queryFn: () =>
      apiGet<{ online: ChatPresenceOnlineRow[] }>(
        `/api/v1/chat/presence?eventId=${encodeURIComponent(eventId!)}`,
      ),
    enabled: Boolean(eventId && presenceOpen && introDone),
    refetchInterval: presenceOpen && introDone ? 20_000 : false,
  });

  useEffect(() => {
    if (!expanded || !introDone || !eventId) return;
    const tick = () => {
      void apiSend("/api/v1/chat/presence", "POST", {
        eventId,
        clientId: getChatClientId(),
        displayName: authorDraftRef.current.trim() || "Anonymous",
      }).catch(() => {
        /* offline / 401 — ignore */
      });
    };
    tick();
    const t = window.setInterval(tick, 45_000);
    return () => window.clearInterval(t);
  }, [expanded, introDone, eventId]);

  const sendMut = useMutation({
    mutationFn: async () => {
      const author = authorDraft.trim();
      const body = draft.trim();
      if (!author) throw new Error("Set your display name in Options.");
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
    onMutate: () => {
      if (!eventId || !contextStageId) return;
      const author = authorDraft.trim();
      const body = draft.trim();
      pendingOwnEchoRef.current = {
        until: Date.now() + 15_000,
        eventId,
        scope: sendScope,
        stageId: sendScope === "stage" ? contextStageId : null,
        author,
        body,
      };
    },
    onSuccess: (res) => {
      pendingOwnEchoRef.current = null;
      lastSentIdRef.current = res.chatMessage.id;
      void qc.invalidateQueries({ queryKey: ["chatMessages", eventId] });
      setDraft("");
    },
    onError: () => {
      pendingOwnEchoRef.current = null;
    },
  });

  const trySend = useCallback(() => {
    if (
      !draft.trim() ||
      !authorDraft.trim() ||
      sendMut.isPending ||
      !eventId ||
      !contextStageId
    )
      return;
    void sendMut.mutateAsync().catch(() => {
      /* surfaced below */
    });
  }, [draft, authorDraft, sendMut, eventId, contextStageId]);

  const onChatPush = useCallback(
    (msg: RealtimeChatPushV1) => {
      if (!eventId || !contextStageId) return;
      if (msg.eventId !== eventId) return;
      if (msg.scope === "stage" && msg.stageId !== contextStageId) return;
      const pending = pendingOwnEchoRef.current;
      if (
        pending &&
        chatPushMatchesPendingOwnEcho(msg, pending, contextStageId)
      ) {
        pendingOwnEchoRef.current = null;
        lastSentIdRef.current = msg.id;
        return;
      }
      if (lastSentIdRef.current === msg.id) {
        lastSentIdRef.current = null;
        return;
      }
      setExpanded(true);
      setFlash(true);
    },
    [eventId, contextStageId],
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
    if (!introDone) return;
    if (!messagesQ.data?.chatMessages.length) return;
    listEndRef.current?.scrollIntoView({ block: "end" });
  }, [introDone, messagesQ.data?.chatMessages]);

  useEffect(() => {
    if (!expanded) return;
    const onPointerDown = (e: PointerEvent) => {
      const root = rootRef.current;
      if (!root || root.contains(e.target as Node)) return;
      if (presenceOpenRef.current) {
        setPresenceOpen(false);
      } else if (settingsOpenRef.current) {
        setSettingsOpen(false);
      } else {
        setExpanded(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (presenceOpenRef.current) {
        setPresenceOpen(false);
      } else if (settingsOpenRef.current) {
        setSettingsOpen(false);
      } else {
        setExpanded(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  const showStagePicker = Boolean(eventIdFromRoute && stagesQ.data?.stages.length);

  const panelClass = useMemo(
    () =>
      `stage-chat-dock${flash ? " stage-chat-dock--flash" : ""}${expanded ? " stage-chat-dock--open" : " stage-chat-dock--collapsed"}`,
    [flash, expanded],
  );

  const completeIntro = useCallback(() => {
    const name = authorDraft.trim();
    if (!name) return;
    try {
      localStorage.setItem(CHAT_NAME_KEY, name);
    } catch {
      /* ignore */
    }
    setIntroDone(true);
  }, [authorDraft]);

  if (onClockScreen || !eventId || !contextStageId) {
    return null;
  }

  const stageLabel =
    stagesQ.data?.stages.find((s) => s.id === contextStageId)?.name ??
    "This stage";

  const messages = messagesQ.data?.chatMessages ?? [];

  /** Portal to `document.body` so stacking is not trapped under `#root` / flex ancestors (FortuneSheet, etc.). */
  return createPortal(
    <div
      ref={rootRef}
      className={panelClass}
      role="region"
      aria-label="Stage chat"
      onPointerDownCapture={acknowledgeChatAttention}
      onFocusCapture={acknowledgeChatAttention}
    >
      {!expanded ? (
        <button
          type="button"
          className="icon-btn stage-chat-dock__peek-btn"
          title={`Open chat — ${stageLabel}`}
          aria-expanded={false}
          aria-haspopup="dialog"
          onClick={() => setExpanded(true)}
        >
          Chat
        </button>
      ) : (
        <div
          id="stage-chat-dock-panel"
          className="stage-chat-dock__panel card"
          role="dialog"
          aria-modal="false"
          aria-label={`Chat — ${stageLabel}`}
        >
          <div className="stage-chat-dock__panel-header">
            <div className="stage-chat-dock__panel-title muted" id="stage-chat-dock-panel-title">
              {stageLabel}
            </div>
            <button
              type="button"
              className="icon-btn"
              aria-label="Minimize chat"
              title="Minimize"
              onClick={() => {
                setExpanded(false);
                setSettingsOpen(false);
                setPresenceOpen(false);
              }}
            >
              Minimize
            </button>
          </div>
          {!introDone ? (
            <div className="stage-chat-dock__intro">
              <p className="title-bar" style={{ marginBottom: "0.5rem" }}>
                Your name
              </p>
              <p className="muted" style={{ marginTop: 0, fontSize: "0.85rem" }}>
                This appears on messages you send. You can change it later in{" "}
                <strong>Options</strong>.
              </p>
              <input
                type="text"
                className="stage-chat-dock__input"
                value={authorDraft}
                onChange={(e) => setAuthorDraft(e.target.value)}
                maxLength={80}
                placeholder="e.g. FOH"
                aria-label="Your chat display name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || e.shiftKey) return;
                  e.preventDefault();
                  completeIntro();
                }}
              />
              <button
                type="button"
                className="primary"
                disabled={!authorDraft.trim()}
                onClick={completeIntro}
              >
                Continue
              </button>
            </div>
          ) : (
            <>
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
            {presenceOpen ? (
              <div
                className="stage-chat-dock__composer-drawer"
                role="region"
                aria-labelledby="stage-chat-dock-presence-heading"
              >
                <div
                  className="stage-chat-dock__composer-drawer-title title-bar"
                  id="stage-chat-dock-presence-heading"
                >
                  Who&apos;s online
                </div>
                <div className="stage-chat-dock__presence-panel">
                  {presenceQ.isLoading ? (
                    <p className="muted">Loading…</p>
                  ) : presenceQ.isError ? (
                    <p role="alert" className="stage-chat-dock__err">
                      Could not load presence.
                    </p>
                  ) : (presenceQ.data?.online.length ?? 0) === 0 ? (
                    <p className="muted" style={{ margin: 0 }}>
                      No other clients visible right now (or still connecting).
                    </p>
                  ) : (
                    <ul className="stage-chat-dock__presence-list">
                      {presenceQ.data!.online.map((p) => (
                        <li key={p.clientId}>
                          <span className="stage-chat-dock__presence-name">
                            {p.displayName}
                          </span>
                          <span className="muted stage-chat-dock__presence-age">
                            {formatPresenceAge(p.lastSeen)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="muted stage-chat-dock__presence-note">
                    Each open tab is listed separately. Entries expire ~90s after
                    the last heartbeat. Single server process only.
                  </p>
                </div>
              </div>
            ) : null}
            {settingsOpen ? (
              <div
                id="stage-chat-dock-settings"
                className="stage-chat-dock__composer-drawer"
                role="region"
                aria-labelledby="stage-chat-dock-options-heading"
              >
                <div
                  className="stage-chat-dock__composer-drawer-title title-bar"
                  id="stage-chat-dock-options-heading"
                >
                  Options
                </div>
                <div className="stage-chat-dock__settings-block">
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
              </div>
            ) : null}
            <div className="stage-chat-dock__composer-tools">
              <button
                type="button"
                className="icon-btn"
                aria-expanded={settingsOpen}
                id="stage-chat-dock-options-btn"
                onClick={() => {
                  setPresenceOpen(false);
                  setSettingsOpen((o) => !o);
                }}
              >
                Options
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-expanded={presenceOpen}
                id="stage-chat-dock-presence-btn"
                title="Browsers with chat open on this event (same server)"
                onClick={() => {
                  setSettingsOpen(false);
                  setPresenceOpen((o) => !o);
                }}
              >
                Who&apos;s online
              </button>
            </div>
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
              disabled={
                sendMut.isPending || !draft.trim() || !authorDraft.trim()
              }
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
            </>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}
