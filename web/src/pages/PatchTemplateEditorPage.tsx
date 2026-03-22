import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Workbook } from "@fortune-sheet/react";
import { apiGet, fetchPatchWorkbookBootstrapSheets } from "../api/client";
import { PatchWorkbookErrorBoundary } from "../components/PatchWorkbookErrorBoundary";
import {
  WORKBOOK_PLACEHOLDER,
  usePatchWorkbookCollab,
} from "../lib/patchWorkbookCollab";

export function PatchTemplateEditorPage() {
  const { templateId } = useParams<{ templateId: string }>();

  const tplQ = useQuery({
    queryKey: ["patchTemplate", templateId],
    queryFn: () =>
      apiGet<{
        patchTemplate: {
          id: string;
          name: string;
        };
      }>(`/api/v1/patch-templates/${templateId}`),
    enabled: Boolean(templateId),
  });

  const bootstrapQ = useQuery({
    queryKey: ["patchWorkbookBootstrap", "template", templateId],
    queryFn: () =>
      fetchPatchWorkbookBootstrapSheets(
        `/api/v1/patch-templates/${templateId}/sheets-export`,
      ),
    enabled: Boolean(templateId),
    staleTime: 60_000,
    retry: 1,
  });

  const workbookReady = Boolean(
    templateId &&
      tplQ.isSuccess &&
      tplQ.data &&
      (!bootstrapQ.isPending || bootstrapQ.isError),
  );

  const bootstrapSheets =
    bootstrapQ.isError ||
    bootstrapQ.data == null ||
    bootstrapQ.data.length === 0
      ? WORKBOOK_PLACEHOLDER
      : bootstrapQ.data;

  const { wbRef, onOp, conn, synced, workbookHydrated, workbookReplayError } =
    usePatchWorkbookCollab({
      roomId: templateId,
      mode: "template",
      workbookReady,
    });

  const blockingWorkbook =
    workbookReady &&
    !workbookHydrated &&
    conn !== "error" &&
    !workbookReplayError;

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
        <span
          className={
            conn === "error" || workbookReplayError ? "status-danger" : "muted"
          }
          style={{ fontSize: "0.85rem" }}
        >
          {conn === "error"
            ? "Realtime connection error — check network / login"
            : workbookReplayError
              ? "Workbook out of sync — reload or leave this page and return"
              : !synced
                ? "Syncing…"
                : !workbookHydrated
                  ? "Loading workbook…"
                  : "Live — edits save automatically"}
        </span>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        While you are connected, edits persist to this template’s snapshot on the
        server (same real-time path as band patch sheets).{" "}
        <strong>New</strong> performances only copy that snapshot{" "}
        <strong>when they are created</strong> — if this template is the stage’s
        default at that moment. Existing band patch workbooks are already separate
        copies and are <strong>not</strong> updated when you edit here.
      </p>
      <div
        className="patch-workbook-host"
        style={{
          height: "min(70vh, 720px)",
          minHeight: 360,
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
        }}
      >
        {workbookReplayError ? (
          <p
            role="alert"
            className="status-danger"
            style={{ margin: "0 0 0.75rem", fontSize: "0.9rem" }}
          >
            Workbook out of sync — the live edit history could not be applied safely. Reload the
            page or leave this editor and return. ({workbookReplayError})
          </p>
        ) : null}
        {bootstrapQ.isError ? (
          <p
            role="alert"
            className="status-warn"
            style={{ margin: "0 0 0.75rem", fontSize: "0.9rem" }}
          >
            Could not load the template file from storage (
            {(bootstrapQ.error as Error).message}). Using a minimal grid; collaboration may still
            apply.{" "}
            <button
              type="button"
              className="icon-btn"
              onClick={() => void bootstrapQ.refetch()}
            >
              Retry
            </button>
          </p>
        ) : null}
        {blockingWorkbook ? (
          <div
            className="patch-workbook-host__loading"
            aria-busy="true"
            aria-live="polite"
          >
            Loading workbook…
          </div>
        ) : null}
        {bootstrapQ.isPending ? (
          <div
            className="patch-workbook-host__loading"
            aria-busy="true"
            aria-live="polite"
          >
            Loading sheet layout…
          </div>
        ) : (
          <PatchWorkbookErrorBoundary
            key={templateId}
            roomId={templateId}
            collabDebug={{
              conn,
              synced,
              workbookHydrated,
              workbookReplayError,
            }}
          >
            <Workbook
              key={templateId}
              ref={wbRef}
              data={bootstrapSheets}
              onOp={onOp}
              allowEdit
              showToolbar
              showFormulaBar
              showSheetTabs
            />
          </PatchWorkbookErrorBoundary>
        )}
      </div>
    </div>
  );
}
