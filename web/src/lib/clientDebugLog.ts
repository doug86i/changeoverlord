import type { Op } from "@fortune-sheet/core";
import { logDebug } from "./debug";

/**
 * When true (Vite env at dev-server start), collab debug lines are POSTed to the API and appended
 * to `CLIENT_LOG_FILE` as NDJSON. See docs/LOGGING.md.
 */
export const isClientDebugFileIngestEnabled =
  import.meta.env.VITE_CLIENT_LOG_FILE === "true";

/** Stable id for this browser tab — use to separate NDJSON lines from multiple windows. */
const CLIENT_LOG_TAB_ID =
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `tab-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

let clientLogSeq = 0;

type ClientDebugLine = {
  ts: string;
  scope: string;
  message: string;
  roomId?: string;
  meta?: Record<string, unknown>;
};

const queue: ClientDebugLine[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let warnedMissingEndpoint = false;

const FLUSH_MS = 200;
const MAX_BATCH = 50;

/** Exposed for rare console debugging (`getClientLogTabId()` in DevTools). */
export function getClientLogTabId(): string {
  return CLIENT_LOG_TAB_ID;
}

/**
 * Per-line context merged into NDJSON `meta` (and console `logDebug`) for collab diagnosis.
 * No secrets; keep fields coarse (no full query strings).
 */
function nextClientLogEnvelope(): Record<string, unknown> {
  clientLogSeq += 1;
  const env: Record<string, unknown> = {
    tabId: CLIENT_LOG_TAB_ID,
    seq: clientLogSeq,
    viteMode: import.meta.env.MODE,
    strictDev: import.meta.env.DEV,
  };

  if (typeof window !== "undefined") {
    env.path = window.location.pathname;
    env.searchLen = window.location.search.length;
  }
  if (typeof document !== "undefined") {
    env.vis = document.visibilityState;
  }
  if (typeof navigator !== "undefined") {
    env.online = navigator.onLine;
    const c = navigator as Navigator & {
      connection?: { effectiveType?: string; downlink?: number };
    };
    if (c.connection?.effectiveType) {
      env.net = c.connection.effectiveType;
    }
  }
  if (typeof window !== "undefined" && window.screen) {
    env.sw = window.screen.width;
    env.sh = window.screen.height;
  }
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    env.t = Math.round(performance.now());
  }

  return env;
}

function sanitizeMeta(meta: Record<string, unknown>): Record<string, unknown> {
  try {
    const s = JSON.stringify(meta);
    if (s.length <= 48_000) return JSON.parse(s) as Record<string, unknown>;
    return {
      _truncated: true,
      approxLen: s.length,
      preview: s.slice(0, 12_000),
    };
  } catch {
    return { _error: "meta not JSON-serializable" };
  }
}

async function postBatch(lines: ClientDebugLine[]): Promise<void> {
  try {
    const r = await fetch("/api/v1/debug/client-log", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ lines }),
      keepalive: true,
    });
    if (r.status === 404 && !warnedMissingEndpoint) {
      warnedMissingEndpoint = true;
      logDebug(
        "client-debug-log",
        "ingest route missing — set CLIENT_LOG_FILE on the API (see docs/LOGGING.md)",
      );
    }
  } catch {
    /* dev-only path */
  }
}

function scheduleFlush(): void {
  if (flushTimer != null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    const batch = queue.splice(0, MAX_BATCH);
    if (batch.length > 0) void postBatch(batch);
    if (queue.length > 0) scheduleFlush();
  }, FLUSH_MS);
}

/** Compact op batch summary for logs (no giant cell payloads). */
export function summarizeOpsForClientLog(ops: Op[]): {
  count: number;
  head: string;
} {
  const count = ops?.length ?? 0;
  if (count === 0) return { count: 0, head: "empty" };
  const bits = ops.slice(0, 8).map((raw) => {
    const o = raw as Record<string, unknown>;
    if (typeof o.op === "string") return o.op;
    const path = o.path;
    if (Array.isArray(path) && path.length > 0) {
      return `path:${path.slice(0, 5).join("/")}`;
    }
    if (typeof o.t === "string") return o.t;
    return "?";
  });
  return { count, head: bits.join("|") };
}

/**
 * Patch workbook collab: mirror to `logDebug` and optionally append NDJSON via the API.
 * Automatically adds **`tabId`**, monotonic **`seq`**, path, visibility, etc. (see LOGGING.md).
 * Do not put secrets in `meta`.
 */
export function logClientDebugCollab(
  scope: string,
  message: string,
  meta?: Record<string, unknown> & { roomId?: string },
): void {
  const roomId =
    typeof meta?.roomId === "string" ? meta.roomId : undefined;
  const restEntries =
    meta == null ? [] : Object.entries(meta).filter(([k]) => k !== "roomId");
  const rest =
    restEntries.length > 0 ? Object.fromEntries(restEntries) : undefined;

  const merged: Record<string, unknown> = {
    ...nextClientLogEnvelope(),
    ...(rest ?? {}),
  };

  logDebug(scope, message, merged);

  if (!isClientDebugFileIngestEnabled) return;

  const line: ClientDebugLine = {
    ts: new Date().toISOString(),
    scope,
    message,
    ...(roomId ? { roomId } : {}),
    meta: sanitizeMeta(merged),
  };
  queue.push(line);
  scheduleFlush();
}

export async function flushClientDebugLog(): Promise<void> {
  if (flushTimer != null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  const batch = queue.splice(0, queue.length);
  if (batch.length === 0) return;
  await postBatch(batch);
}

/** Flush queued lines when the tab hides / unloads (best-effort). */
export function registerClientDebugLogUnload(): void {
  if (!isClientDebugFileIngestEnabled) return;
  const run = () => {
    void flushClientDebugLog();
  };
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") run();
  });
  window.addEventListener("pagehide", run);
}
