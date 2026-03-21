import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import type { Transaction, YArrayEvent } from "yjs";
import { WebsocketProvider } from "y-websocket";
import { Workbook, type WorkbookInstance } from "@fortune-sheet/react";
import type { Op, Sheet } from "@fortune-sheet/core";
import { apiGet } from "../api/client";
import { logDebug } from "../lib/debug";
import { PatchWorkbookErrorBoundary } from "../components/PatchWorkbookErrorBoundary";

const ORIGIN = "fortune-local";

function createEmptyPatchSheets(): Sheet[] {
  return [
    {
      id: "patch-sheet-input",
      name: "Input",
      status: 1,
      row: 36,
      column: 18,
      order: 0,
    },
    {
      id: "patch-sheet-rf",
      name: "RF",
      status: 0,
      row: 36,
      column: 18,
      order: 1,
    },
  ];
}

export function PatchTemplateEditorPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const wbRef = useRef<WorkbookInstance>(null);
  const [conn, setConn] = useState<"connecting" | "connected" | "error">(
    "connecting",
  );
  const [synced, setSynced] = useState(false);

  const tplQ = useQuery({
    queryKey: ["patchTemplate", templateId],
    queryFn: () =>
      apiGet<{ patchTemplate: { id: string; name: string } }>(
        `/api/v1/patch-templates/${templateId}`,
      ),
    enabled: Boolean(templateId),
  });

  const ydoc = useMemo(() => new Y.Doc(), [templateId]);
  const yops = useMemo(() => ydoc.getArray<string>("opLog"), [ydoc]);

  const initialSheets = useMemo(() => createEmptyPatchSheets(), [templateId]);

  const onOp = useCallback(
    (ops: Op[]) => {
      ydoc.transact(() => {
        yops.push([JSON.stringify(ops)]);
      }, ORIGIN);
    },
    [ydoc, yops],
  );

  useEffect(() => {
    if (!templateId) return;

    logDebug("patch-workbook", "Template editor Yjs provider starting", {
      templateId,
    });

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const base = `${proto}//${window.location.host}/ws/v1/collab-template`;
    const provider = new WebsocketProvider(base, templateId, ydoc, {
      connect: true,
    });

    const onStatus = (ev: { status: string }) => {
      logDebug("patch-workbook", "template y-websocket status", ev.status);
      if (ev.status === "connected") setConn("connected");
      if (ev.status === "disconnected") setConn("connecting");
    };
    const onSync = (isSynced: boolean) => {
      logDebug("patch-workbook", "template y-websocket synced", isSynced);
      setSynced(isSynced);
    };
    const onErr = () => {
      logDebug("patch-workbook", "template y-websocket connection-error");
      setConn("error");
    };

    provider.on("status", onStatus);
    provider.on("sync", onSync);
    provider.on("connection-error", onErr);

    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [templateId, ydoc]);

  useEffect(() => {
    const handler = (event: YArrayEvent<string>, transaction: Transaction) => {
      if (transaction.origin === ORIGIN) return;
      for (const d of event.changes.delta) {
        if (d.insert === undefined) continue;
        const inserts = Array.isArray(d.insert) ? d.insert : [d.insert];
        for (const item of inserts) {
          if (typeof item !== "string") continue;
          try {
            const ops = JSON.parse(item) as Op[];
            wbRef.current?.applyOp(ops);
          } catch {
            /* ignore bad remote payload */
          }
        }
      }
    };
    yops.observe(handler);
    return () => {
      yops.unobserve(handler);
    };
  }, [yops]);

  if (!templateId) return null;
  if (tplQ.isLoading) return <p className="muted">Loading…</p>;
  if (tplQ.error || !tplQ.data) {
    return <p role="alert">Template not found.</p>;
  }

  const tpl = tplQ.data.patchTemplate;

  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        <Link to="/settings">Settings</Link>
        {" · "}
        <span>{tpl.name}</span>
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "0.75rem",
        }}
      >
        <h1 style={{ margin: 0 }}>Edit patch template</h1>
        <span className="muted" style={{ fontSize: "0.85rem" }}>
          {conn === "error"
            ? "Realtime connection error — check network / login"
            : !synced
              ? "Syncing…"
              : "Live (saved to library)"}
        </span>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Changes are saved automatically and apply to <strong>new</strong>{" "}
        performances that use this template. Close this tab when done.
      </p>
      <div
        style={{
          height: "min(70vh, 720px)",
          minHeight: 360,
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
        }}
      >
        <PatchWorkbookErrorBoundary key={templateId}>
          <Workbook
            key={templateId}
            ref={wbRef}
            data={initialSheets}
            onOp={onOp}
            showToolbar
            showFormulaBar
            showSheetTabs
          />
        </PatchWorkbookErrorBoundary>
      </div>
    </div>
  );
}
